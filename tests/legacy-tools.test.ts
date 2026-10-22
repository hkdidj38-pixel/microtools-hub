import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * Black-box tests for the classic tools in public/js/. Each script is an IIFE
 * that wires DOM elements on load, so the tests run the real files against a
 * minimal fake DOM, set input values, fire the same events a browser would,
 * and read back the outputs. The legacy files are not modified.
 */

type Handler = () => void;

class FakeElement {
  value = '';
  textContent: string | number = '';
  className = '';
  checked = false;
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  private listeners = new Map<string, Handler[]>();

  addEventListener(type: string, fn: Handler) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  dispatch(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn();
  }

  getAttribute(name: string) {
    return this.attrs[name] ?? null;
  }

  select() {}
  focus() {}
}

function loadLegacyScript(relativePath: string, caseButtons: FakeElement[] = []) {
  const elements = new Map<string, FakeElement>();
  const getEl = (id: string): FakeElement => {
    let el = elements.get(id);
    if (!el) {
      el = new FakeElement();
      elements.set(id, el);
    }
    return el;
  };
  const documentStub = {
    getElementById: getEl,
    querySelectorAll: (selector: string) => (selector === '[data-case]' ? caseButtons : []),
  };
  const code = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
  vm.runInNewContext(code, {
    document: documentStub,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    window: {},
    console,
  }, { filename: relativePath });
  return { getEl };
}

describe('slug generator (public/js/slug-generator.js)', () => {
  const setup = () => {
    const { getEl } = loadLegacyScript('public/js/slug-generator.js');
    getEl('separator').value = '-';
    return { getEl };
  };

  it('lowercases, strips accents, and hyphenates', () => {
    const { getEl } = setup();
    getEl('slug-input').value = 'Héllo Wörld! 2026';
    getEl('slug-input').dispatch('input');
    expect(getEl('slug-output').value).toBe('hello-world-2026');
    expect(getEl('status').className).toBe('success');
  });

  it('honours the underscore separator', () => {
    const { getEl } = setup();
    getEl('separator').value = '_';
    getEl('slug-input').value = 'My First Post';
    getEl('slug-input').dispatch('input');
    expect(getEl('slug-output').value).toBe('my_first_post');
  });

  it('drops numbers when asked and truncates to the max length', () => {
    const { getEl } = setup();
    getEl('remove-numbers').checked = true;
    getEl('slug-input').value = 'Top 10 Tips For 2026';
    getEl('slug-input').dispatch('input');
    expect(getEl('slug-output').value).toBe('top-tips-for');

    getEl('remove-numbers').checked = false;
    getEl('max-length').value = '7';
    getEl('slug-input').dispatch('input');
    expect(getEl('slug-output').value).toBe('top-10');
  });

  it('reports an error for empty input', () => {
    const { getEl } = setup();
    getEl('slug-input').value = '   ';
    getEl('slug-input').dispatch('input');
    expect(getEl('slug-output').value).toBe('');
    expect(getEl('status').className).toBe('error');
  });
});

describe('text case converter (public/js/text-converter.js)', () => {
  const LABELS: Record<string, string> = {
    upper: 'UPPERCASE', lower: 'lowercase', title: 'Title Case', sentence: 'Sentence case',
    camel: 'camelCase', pascal: 'PascalCase', snake: 'snake_case', kebab: 'kebab-case', toggle: 'tOGGLE cASE',
  };
  const setup = () => {
    const buttons = Object.keys(LABELS).map((type) => {
      const btn = new FakeElement();
      btn.attrs['data-case'] = type;
      btn.textContent = LABELS[type];
      return btn;
    });
    const { getEl } = loadLegacyScript('public/js/text-converter.js', buttons);
    const click = (type: string) => buttons.find((b) => b.attrs['data-case'] === type)?.dispatch('click');
    return { getEl, click };
  };

  it('converts to camelCase and PascalCase from spaced and hyphenated words', () => {
    const { getEl, click } = setup();
    getEl('text-input').value = 'hello world-example';
    click('camel');
    expect(getEl('text-input').value).toBe('helloWorldExample');
    getEl('text-input').value = 'hello world-example';
    click('pascal');
    expect(getEl('text-input').value).toBe('HelloWorldExample');
  });

  it('converts spaced input to snake_case and kebab-case', () => {
    const { getEl, click } = setup();
    getEl('text-input').value = 'hello world example';
    click('snake');
    expect(getEl('text-input').value).toBe('hello_world_example');
    getEl('text-input').value = 'hello world example';
    click('kebab');
    expect(getEl('text-input').value).toBe('hello-world-example');
  });

  it('documents current behaviour: camelCase humps are not split (callers lowercase first)', () => {
    // splitWords() has a camel-hump regex, but every converter lowercases the
    // input before calling it, so 'helloWorld' is treated as a single word.
    // This pins the shipped behaviour; changing it is a product decision.
    const { getEl, click } = setup();
    getEl('text-input').value = 'helloWorldExample';
    click('snake');
    expect(getEl('text-input').value).toBe('helloworldexample');
  });

  it('converts title, sentence, and toggle case', () => {
    const { getEl, click } = setup();
    getEl('text-input').value = 'hello world';
    click('title');
    expect(getEl('text-input').value).toBe('Hello World');
    getEl('text-input').value = 'hello. WORLD AGAIN';
    click('sentence');
    expect(getEl('text-input').value).toBe('Hello. World again');
    getEl('text-input').value = 'AbC';
    click('toggle');
    expect(getEl('text-input').value).toBe('aBc');
  });
});

describe('JSON formatter (public/js/json-formatter.js)', () => {
  const setup = () => loadLegacyScript('public/js/json-formatter.js');

  it('formats valid JSON with two-space indentation', () => {
    const { getEl } = setup();
    getEl('json-input').value = '{"a":1,"b":[2,3]}';
    getEl('format-btn').dispatch('click');
    expect(getEl('json-output').value).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
    expect(getEl('status').textContent).toBe('JSON is valid and formatted.');
    expect(getEl('output-group').style.display).toBe('block');
  });

  it('minifies valid JSON', () => {
    const { getEl } = setup();
    getEl('json-input').value = '{\n  "a": 1\n}';
    getEl('minify-btn').dispatch('click');
    expect(getEl('json-output').value).toBe('{"a":1}');
  });

  it('reports invalid JSON and empty input as errors', () => {
    const { getEl } = setup();
    getEl('json-input').value = '{"a":}';
    getEl('validate-btn').dispatch('click');
    expect(String(getEl('status').textContent)).toMatch(/^Invalid JSON:/);
    expect(getEl('status').className).toBe('error');

    getEl('json-input').value = '  ';
    getEl('validate-btn').dispatch('click');
    expect(getEl('status').textContent).toBe('Invalid JSON: Please enter some JSON first.');
  });
});

describe('word counter (public/js/word-counter.js)', () => {
  it('counts words, characters, sentences, paragraphs, and reading time', () => {
    const { getEl } = loadLegacyScript('public/js/word-counter.js');
    const text = 'One two three. Four five!\n\nNew paragraph here.';
    getEl('text-input').value = text;
    getEl('text-input').dispatch('input');
    expect(Number(getEl('word-count').textContent)).toBe(8);
    expect(Number(getEl('char-count').textContent)).toBe(text.length);
    expect(Number(getEl('char-no-spaces').textContent)).toBe(text.replace(/\s/g, '').length);
    expect(Number(getEl('sentence-count').textContent)).toBe(3);
    expect(Number(getEl('paragraph-count').textContent)).toBe(2);
    expect(Number(getEl('reading-time').textContent)).toBe(1);
  });

  it('reports zeros for empty text', () => {
    const { getEl } = loadLegacyScript('public/js/word-counter.js');
    getEl('text-input').value = '';
    getEl('text-input').dispatch('input');
    expect(Number(getEl('word-count').textContent)).toBe(0);
    expect(Number(getEl('sentence-count').textContent)).toBe(0);
  });
});
