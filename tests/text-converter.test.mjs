import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../public/js/text-converter.js', import.meta.url), 'utf8');

function convert(value, mode) {
  const listeners = {};
  const input = { value };
  const button = {
    getAttribute: () => mode,
    textContent: mode,
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  vm.runInNewContext(source, {
    document: {
      getElementById: (id) => id === 'text-input' ? input : { addEventListener() {} },
      querySelectorAll: () => [button],
    },
  });
  listeners.click();
  return input.value;
}

for (const [mode, expected] of Object.entries({ camel: 'helloWorld', pascal: 'HelloWorld', snake: 'hello_world', kebab: 'hello-world' })) {
  test(`${mode} preserves word boundaries in existing camelCase`, () => {
    assert.equal(convert('helloWorld', mode), expected);
  });
}

test('existing spaces, separators, and explicit capitalization still convert', () => {
  assert.equal(convert('Hello WORLD_test-case', 'camel'), 'helloWorldTestCase');
  assert.equal(convert('hello world', 'upper'), 'HELLO WORLD');
  assert.equal(convert('', 'snake'), '');
});
