export const meta = {
  slug: 'timestamp-converter',
  name: 'Unix Timestamp & ISO-8601 Converter',
  description: 'Convert Unix epoch seconds, milliseconds, or ISO-8601 date strings into UTC, local time, and relative deltas.',
  useCase: 'Translate log timestamps between Unix seconds/ms, ISO-8601 UTC, and local timezone.',
  codePreview: '1761523200 → 2025-10-27T00:00:00.000Z',
  category: 'Dev',
  privacy: {
    mode: 'local',
    label: 'Local Date/Intl clock',
    description: 'Timestamp math uses your local browser Date runtime with zero external time APIs.',
  },
  keywords: ['unix timestamp converter', 'epoch to iso8601', 'milliseconds to date', 'utc date converter'],
  steps: [
    { title: 'Paste epoch integer or ISO date', detail: 'Enter 10-digit seconds, 13-digit milliseconds, an ISO-8601 string, or click Now.' },
    { title: 'Auto-detect precision', detail: 'Values under 10^11 are interpreted as Unix seconds; larger integers map to milliseconds.' },
    { title: 'Copy normalized output', detail: 'Read ISO-8601 UTC, RFC 2822, local timezone, and relative time delta side by side.' },
  ],
  faqs: [
    {
      q: 'How does the tool distinguish seconds from milliseconds?',
      a: 'Integers with absolute value below 100,000,000,000 (10 digits) are treated as Unix seconds; 13-digit values are treated as epoch milliseconds.',
    },
    {
      q: 'Can I convert an ISO-8601 string back to Unix epoch?',
      a: 'Yes. Paste any valid ISO-8601 or RFC 2822 timestamp and both unix_seconds and unix_milliseconds are emitted.',
    },
  ],
};
