import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Metadata is build input, not executable code. Read the literal syntax without
// importing modules or evaluating expressions in the build process.
export function parseToolMetadata(source, filename = 'meta.ts') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fail = (message) => {
    throw new Error(`${filename}: ${message}`);
  };
  if (file.parseDiagnostics.length) fail('invalid TypeScript metadata syntax');
  const statement = file.statements[0];
  if (
    file.statements.length !== 1 ||
    !ts.isVariableStatement(statement) ||
    !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ||
    (statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    statement.declarationList.declarations.length !== 1
  ) {
    fail('meta.ts must contain only an exported const meta literal (zero imports or executable statements)');
  }
  const declaration = statement.declarationList.declarations[0];
  if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'meta' || !declaration.initializer) {
    fail('expected export const meta = { ... }');
  }

  function readLiteral(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(readLiteral);
    if (ts.isObjectLiteralExpression(node)) {
      const result = Object.create(null);
      for (const property of node.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        ) {
          fail('metadata must use plain literal properties; expressions, methods, and spreads are not supported');
        }
        const key = property.name.text;
        if (Object.hasOwn(result, key)) fail(`duplicate metadata property: ${key}`);
        result[key] = readLiteral(property.initializer);
      }
      return result;
    }
    fail('metadata values must be literals; executable expressions are not supported');
  }

  const meta = readLiteral(declaration.initializer);
  if (
    !meta ||
    typeof meta.name !== 'string' ||
    !meta.name ||
    typeof meta.description !== 'string' ||
    !meta.description
  ) {
    fail('meta must define nonempty name and description strings');
  }
  return meta;
}

export function discoverToolMetadata(toolsRoot) {
  if (!fs.existsSync(toolsRoot)) return [];
  return (
    fs
      .readdirSync(toolsRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('_') &&
          fs.existsSync(path.join(toolsRoot, entry.name, 'index.tsx')) &&
          fs.existsSync(path.join(toolsRoot, entry.name, 'meta.ts')),
      )
      .map((entry) => {
        const filename = path.join(toolsRoot, entry.name, 'meta.ts');
        const meta = parseToolMetadata(fs.readFileSync(filename, 'utf8'), filename);
        return { ...meta, slug: meta.slug || entry.name };
      })
      // Match the client registry so prerendered links and JSON-LD do not reorder
      // when React mounts.
      .sort((a, b) => {
        if (Boolean(a.popular) !== Boolean(b.popular)) return a.popular ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
  );
}
