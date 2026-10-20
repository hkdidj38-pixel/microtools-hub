export const meta = {
  slug: 'pdf-merger',
  name: 'PDF Merger & Page Organizer',
  description: 'Combine multiple PDF files into a single document instantly in your browser. 100% private, client-side PDF joining using pdf-lib with zero server uploads.',
  category: 'PDF',
  keywords: [
    'merge pdf',
    'combine pdf files',
    'client side pdf merger',
    'free pdf joiner',
  ],
  faqs: [
    {
      q: 'Are my PDF files uploaded to a server?',
      a: 'No. Your PDFs are read and merged locally in your browser with pdf-lib. The files are never sent to a server.',
    },
    {
      q: 'Can I change the order of pages or documents?',
      a: 'You can move entire PDF files up or down before merging. Pages from each file remain in their original order.',
    },
    {
      q: 'Does the merger change the quality of my PDFs?',
      a: 'The merger copies pages into a new PDF without rasterizing them, so text and vector content remain crisp and selectable.',
    },
    {
      q: 'Can I merge password-protected PDFs?',
      a: 'Encrypted PDFs that cannot be opened by pdf-lib are not supported. Remove the password protection before adding the file.',
    },
  ],
};
