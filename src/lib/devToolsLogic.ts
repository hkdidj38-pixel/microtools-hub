export interface TransformOutcome {
  output: string;
  error: string | null;
  detail?: string;
}

function sortJsonDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonDeep);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortJsonDeep(v)]);
    return Object.fromEntries(entries);
  }
  return value;
}

export function transformJson(
  input: string,
  mode: 'pretty2' | 'pretty4' | 'minify' | 'sort',
): TransformOutcome {
  if (!input.trim()) return { output: '', error: null };
  try {
    const parsed: unknown = JSON.parse(input);
    if (mode === 'minify') {
      return { output: JSON.stringify(parsed), error: null, detail: 'Valid JSON · Minified' };
    }
    if (mode === 'pretty4') {
      return { output: JSON.stringify(parsed, null, 4), error: null, detail: 'Valid JSON · 4-space indent' };
    }
    if (mode === 'sort') {
      return {
        output: JSON.stringify(sortJsonDeep(parsed), null, 2),
        error: null,
        detail: 'Valid JSON · Keys sorted lexicographically',
      };
    }
    return { output: JSON.stringify(parsed, null, 2), error: null, detail: 'Valid JSON · 2-space indent' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON syntax';
    return { output: '', error: `SyntaxError: ${message}` };
  }
}

function decodeBase64UrlToUtf8(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function inspectJwt(input: string): TransformOutcome {
  const trimmed = input.trim().replace(/^Bearer\s+/i, '').trim();
  if (!trimmed) return { output: '', error: null };

  const parts = trimmed.split('.');
  if (parts.length < 2 || parts.length > 3) {
    return {
      output: '',
      error: `Expected 3 dot-separated JWT segments (header.payload.signature), received ${parts.length}.`,
    };
  }

  try {
    const headerRaw = decodeBase64UrlToUtf8(parts[0]);
    const payloadRaw = decodeBase64UrlToUtf8(parts[1]);
    const header = JSON.parse(headerRaw) as Record<string, unknown>;
    const payload = JSON.parse(payloadRaw) as Record<string, unknown>;

    const timing: Record<string, string> = {};
    const nowSec = Math.floor(Date.now() / 1000);
    for (const key of ['iat', 'nbf', 'exp', 'auth_time']) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        timing[key] = new Date(value * 1000).toISOString();
      }
    }

    let status = 'No exp claim';
    if (typeof payload.exp === 'number') {
      const delta = payload.exp - nowSec;
      status = delta >= 0 ? `Unexpired (${delta}s remaining)` : `Expired (${Math.abs(delta)}s ago)`;
    }

    const report = {
      status,
      header,
      payload,
      decodedTimestamps: Object.keys(timing).length ? timing : undefined,
      signature: parts[2] ? `${parts[2].slice(0, 16)}… (${parts[2].length} Base64URL chars, unverified client-side)` : 'none (unsecured JWT)',
    };

    return {
      output: JSON.stringify(report, null, 2),
      error: null,
      detail: `alg: ${String(header.alg ?? 'unknown')} · ${status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Malformed Base64URL or JSON segment';
    return { output: '', error: `JWT decode error: ${msg}` };
  }
}

export function transformBase64(
  input: string,
  mode: 'encode' | 'decode' | 'encode-url' | 'decode-url',
): TransformOutcome {
  if (!input) return { output: '', error: null };
  try {
    if (mode === 'encode' || mode === 'encode-url') {
      const bytes = new TextEncoder().encode(input);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const b64 = btoa(binary);
      const result = mode === 'encode-url' ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
      return {
        output: result,
        error: null,
        detail: mode === 'encode-url' ? 'RFC 4648 Base64URL encoded' : 'Standard Base64 encoded',
      };
    }

    const cleaned = input.trim().replace(/\s+/g, '');
    const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { output: decoded, error: null, detail: `Decoded ${bytes.byteLength} UTF-8 bytes` };
  } catch {
    return { output: '', error: 'Invalid Base64 input or non-UTF-8 byte sequence.' };
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function computeHashes(
  input: string,
  encoding: 'hex' | 'base64' = 'hex',
): Promise<TransformOutcome> {
  if (!input) return { output: '', error: null };
  const data = new TextEncoder().encode(input);
  const algorithms = ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'] as const;
  const digests = await Promise.all(
    algorithms.map(async (alg) => {
      const buf = await crypto.subtle.digest(alg, data);
      const formatted = encoding === 'base64' ? toBase64(buf) : toHex(buf);
      return `${alg.padEnd(8, ' ')}  ${formatted}`;
    }),
  );
  return {
    output: digests.join('\n'),
    error: null,
    detail: `WebCrypto SubtleCrypto · ${encoding.toUpperCase()}`,
  };
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function createUlid(): string {
  let time = Date.now();
  let timeChars = '';
  for (let i = 0; i < 10; i += 1) {
    timeChars = CROCKFORD[time % 32] + timeChars;
    time = Math.floor(time / 32);
  }
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  let randChars = '';
  for (let i = 0; i < 16; i += 1) {
    randChars += CROCKFORD[rand[i] & 31];
  }
  return timeChars + randChars;
}

export function generateIdentifiers(
  input: string,
  mode: 'uuid' | 'ulid' | 'hex256',
): TransformOutcome {
  const parsedCount = Number.parseInt(input.trim(), 10);
  const count = Number.isFinite(parsedCount) ? Math.min(Math.max(parsedCount, 1), 50) : 8;
  const rows: string[] = [];

  for (let i = 0; i < count; i += 1) {
    if (mode === 'uuid') {
      rows.push(crypto.randomUUID());
    } else if (mode === 'ulid') {
      rows.push(createUlid());
    } else {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      rows.push(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));
    }
  }

  return {
    output: rows.join('\n'),
    error: null,
    detail: `Generated ${count} ${mode.toUpperCase()} token${count === 1 ? '' : 's'} via CSPRNG`,
  };
}

export function transformUrl(
  input: string,
  mode: 'encode' | 'decode' | 'parse',
): TransformOutcome {
  if (!input.trim()) return { output: '', error: null };
  try {
    if (mode === 'encode') {
      return { output: encodeURIComponent(input), error: null, detail: 'RFC 3986 component encoded' };
    }
    if (mode === 'decode') {
      return { output: decodeURIComponent(input.replace(/\+/g, '%20')), error: null, detail: 'URI component decoded' };
    }

    const candidate = input.trim();
    const url = candidate.includes('://')
      ? new URL(candidate)
      : new URL(candidate.startsWith('?') ? `https://local.invalid/${candidate}` : `https://local.invalid/?${candidate}`);

    const params: Record<string, string | string[]> = {};
    for (const [key, val] of url.searchParams.entries()) {
      const existing = params[key];
      if (existing === undefined) params[key] = val;
      else if (Array.isArray(existing)) existing.push(val);
      else params[key] = [existing, val];
    }

    const parsed = candidate.includes('://')
      ? {
          protocol: url.protocol,
          host: url.host,
          pathname: url.pathname,
          queryCount: Array.from(url.searchParams.keys()).length,
          query: params,
          hash: url.hash || null,
        }
      : {
          queryCount: Array.from(url.searchParams.keys()).length,
          query: params,
        };

    return { output: JSON.stringify(parsed, null, 2), error: null, detail: 'Parsed query parameters' };
  } catch (err) {
    return { output: '', error: err instanceof Error ? err.message : 'Malformed URI sequence' };
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  copy: '©',
  reg: '®',
  mdash: '—',
  ndash: '–',
};

export function transformHtmlEntities(input: string, mode: 'encode' | 'decode'): TransformOutcome {
  if (!input) return { output: '', error: null };
  if (mode === 'encode') {
    const encoded = input.replace(/[&<>"']|[^\x20-\x7E\n\r\t]/g, (ch) => {
      switch (ch) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default: {
          const code = ch.codePointAt(0);
          return code !== undefined ? `&#x${code.toString(16).toUpperCase()};` : ch;
        }
      }
    });
    return { output: encoded, error: null, detail: 'HTML / JSX safe entities' };
  }

  const decoded = input.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
    }
    return NAMED_ENTITIES[entity] ?? full;
  });
  return { output: decoded, error: null, detail: 'Entities unescaped to UTF-8' };
}

export function evaluateRegex(pattern: string, flags: string, corpus: string): TransformOutcome {
  if (!pattern) return { output: '', error: null };
  try {
    const safeFlags = flags.includes('g') ? flags : `${flags}g`;
    const regex = new RegExp(pattern, safeFlags);
    if (!corpus) {
      return { output: '[]', error: null, detail: `Compiled /${pattern}/${safeFlags} · Awaiting test input` };
    }

    const matches: Array<{
      index: number;
      match: string;
      captures: (string | null)[];
      groups?: Record<string, string>;
    }> = [];

    let current: RegExpExecArray | null;
    let safety = 0;
    while ((current = regex.exec(corpus)) !== null && safety < 500) {
      safety += 1;
      matches.push({
        index: current.index,
        match: current[0],
        captures: current.slice(1).map((item) => item ?? null),
        groups: current.groups ? { ...current.groups } : undefined,
      });
      if (current[0].length === 0) regex.lastIndex += 1;
      if (!flags.includes('g')) break;
    }

    return {
      output: JSON.stringify(matches, null, 2),
      error: null,
      detail: `${matches.length} match${matches.length === 1 ? '' : 'es'} for /${pattern}/${flags}`,
    };
  } catch (err) {
    return { output: '', error: err instanceof Error ? err.message : 'Invalid regular expression' };
  }
}

export function convertTimestamp(input: string): TransformOutcome {
  const raw = input.trim();
  if (!raw) return { output: '', error: null };

  let date: Date;
  if (/^now$/i.test(raw)) {
    date = new Date();
  } else if (/^-?\d+$/.test(raw)) {
    const num = Number(raw);
    const ms = Math.abs(num) < 1e11 ? num * 1000 : num;
    date = new Date(ms);
  } else {
    date = new Date(raw);
  }

  if (Number.isNaN(date.getTime())) {
    return { output: '', error: 'Unrecognized epoch integer or ISO-8601 date string.' };
  }

  const ms = date.getTime();
  const sec = Math.floor(ms / 1000);
  const diffSec = Math.round((ms - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  const unit =
    absSec < 60
      ? `${absSec}s`
      : absSec < 3600
        ? `${Math.round(absSec / 60)}m`
        : absSec < 86400
          ? `${Math.round(absSec / 3600)}h`
          : `${Math.round(absSec / 86400)}d`;
  const relative = diffSec === 0 ? 'now' : diffSec > 0 ? `in ${unit}` : `${unit} ago`;

  const report = {
    unix_seconds: sec,
    unix_milliseconds: ms,
    iso_8601_utc: date.toISOString(),
    utc_rfc2822: date.toUTCString(),
    local_time: date.toString(),
    relative,
  };

  return {
    output: JSON.stringify(report, null, 2),
    error: null,
    detail: `Epoch ${sec} (${relative})`,
  };
}

function splitWords(line: string): string[] {
  return line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function formatWords(words: string[], style: string): string {
  const lower = words.map((w) => w.toLowerCase());
  switch (style) {
    case 'camel':
      return lower.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
    case 'pascal':
      return lower.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
    case 'snake':
      return lower.join('_');
    case 'constant':
      return lower.join('_').toUpperCase();
    case 'kebab':
    case 'slug':
      return lower.join('-');
    case 'title':
      return lower.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    default:
      return lower.join(' ');
  }
}

export function transformCase(
  input: string,
  mode: 'matrix' | 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'slug',
): TransformOutcome {
  if (!input.trim()) return { output: '', error: null };
  if (mode === 'matrix') {
    const words = splitWords(input);
    if (!words.length) return { output: '', error: 'No alphanumeric tokens found.' };
    const matrix = [
      `camelCase      ${formatWords(words, 'camel')}`,
      `PascalCase     ${formatWords(words, 'pascal')}`,
      `snake_case     ${formatWords(words, 'snake')}`,
      `CONSTANT_CASE  ${formatWords(words, 'constant')}`,
      `kebab-case     ${formatWords(words, 'kebab')}`,
      `Title Case     ${formatWords(words, 'title')}`,
      `url-slug       ${formatWords(words, 'slug')}`,
    ];
    return { output: matrix.join('\n'), error: null, detail: `${words.length} identifier tokens` };
  }

  const lines = input
    .split(/\r?\n/)
    .map((line) => {
      const words = splitWords(line);
      return words.length ? formatWords(words, mode) : '';
    })
    .join('\n');
  return { output: lines, error: null, detail: `Converted to ${mode}` };
}

export function computeLineDiff(input: string): TransformOutcome {
  if (!input.trim()) return { output: '', error: null };
  const parts = input.split(/\r?\n===\r?\n/);
  if (parts.length < 2) {
    return {
      output: '',
      error: 'Separate the original and modified blocks with a line containing ===',
    };
  }

  const left = parts[0].split(/\r?\n/);
  const right = parts.slice(1).join('\n===\n').split(/\r?\n/);

  if (left.length * right.length > 250_000) {
    return { output: '', error: 'Diff input exceeds 500×500 line interactive matrix cap.' };
  }

  const m = left.length;
  const n = right.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: string[] = ['--- a/original', '+++ b/modified'];
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (left[i] === right[j]) {
      out.push(`  ${left[i]}`);
      unchanged += 1;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(`- ${left[i]}`);
      removed += 1;
      i += 1;
    } else {
      out.push(`+ ${right[j]}`);
      added += 1;
      j += 1;
    }
  }
  while (i < m) {
    out.push(`- ${left[i]}`);
    removed += 1;
    i += 1;
  }
  while (j < n) {
    out.push(`+ ${right[j]}`);
    added += 1;
    j += 1;
  }

  return {
    output: out.join('\n'),
    error: null,
    detail: `+${added} added · -${removed} removed · ${unchanged} unchanged`,
  };
}

export function analyzeTextMetrics(input: string): TransformOutcome {
  if (!input) return { output: '', error: null };
  const bytes = new TextEncoder().encode(input).byteLength;
  const chars = Array.from(input).length;
  const charsNoSpaces = input.replace(/\s+/g, '').length;
  const wordsList = input.trim() ? input.trim().split(/\s+/) : [];
  const lines = input.split(/\r?\n/);
  const paragraphs = input.trim() ? input.trim().split(/\r?\n\s*\r?\n/).filter(Boolean).length : 0;
  const sentences = input.trim() ? (input.match(/[.!?]+(?=\s|$)/g)?.length ?? 1) : 0;

  const freq = new Map<string, number>();
  for (const raw of wordsList) {
    const clean = raw.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    if (clean.length >= 3) freq.set(clean, (freq.get(clean) ?? 0) + 1);
  }
  const topTokens = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([token, count]) => ({ token, count }));

  const readingSec = Math.ceil((wordsList.length / 225) * 60);
  const speakingSec = Math.ceil((wordsList.length / 140) * 60);

  const report = {
    words: wordsList.length,
    characters: chars,
    characters_no_whitespace: charsNoSpaces,
    utf8_bytes: bytes,
    lines: lines.length,
    paragraphs,
    sentences,
    reading_time_sec: readingSec,
    speaking_time_sec: speakingSec,
    top_tokens: topTokens,
  };

  return {
    output: JSON.stringify(report, null, 2),
    error: null,
    detail: `${wordsList.length} words · ${bytes} UTF-8 bytes`,
  };
}
