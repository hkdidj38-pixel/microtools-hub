export const meta = {
  slug: 'regex-tester',
  name: 'Regex Tester & Capture Inspector',
  description: 'Test JavaScript regular expressions with flags, match offsets, and named capture groups in real time.',
  useCase: 'Debug ECMAScript regex patterns against multi-line logs and inspect capture groups as JSON.',
  codePreview: '/(?<lvl>WARN|ERR):\\s+(.*)/gm → 2 matches',
  category: 'Dev',
  privacy: {
    mode: 'local',
    label: 'Local RegExp engine',
    description: 'Log lines and regex patterns execute locally in your browser JavaScript engine.',
  },
  keywords: ['regex tester', 'javascript regexp debugger', 'named capture groups', 'offline regex'],
  steps: [
    { title: 'Define pattern and flags', detail: 'Enter your ECMAScript regular expression and flags (such as gm or gi) in the pattern bar.' },
    { title: 'Paste sample log or text corpus', detail: 'Add multi-line text in the left editor or load the built-in log sample.' },
    { title: 'Inspect structured matches', detail: 'Review match indices, numbered captures, and named groups in the JSON output pane.' },
  ],
  faqs: [
    {
      q: 'Which regex flavor does this use?',
      a: 'It runs your browser’s native ECMAScript RegExp engine, including lookbehind assertions, Unicode property escapes (\\p{...}), and named capture groups (?<name>...).',
    },
    {
      q: 'What happens on zero-length matches?',
      a: 'The runner advances lastIndex safely on empty matches and caps output at 500 matches to prevent accidental infinite loops.',
    },
  ],
};
