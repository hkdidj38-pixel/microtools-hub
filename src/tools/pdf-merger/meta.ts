export const meta = {
  slug: 'pdf-merger',
  name: 'PDF Merger & Page Organizer',
  description: 'Combine multiple PDF files into one document in your browser. Client-side PDF joining with pdf-lib; your documents are not uploaded.',
  useCase: 'Count pages, reorder PDF documents, and merge vector pages in-memory with pdf-lib.',
  codePreview: '[alpha.pdf, beta.pdf] → merged-document.pdf',
  category: 'Files',
  privacy: {
    mode: 'local',
    label: 'Local PDF processing',
    description: 'PDF files are read and merged in your browser. Your documents are not uploaded.',
  },
  keywords: [
    'merge pdf',
    'combine pdf files',
    'client side pdf merger',
    'free pdf joiner',
  ],
  steps: [
    { title: 'Drop two or more PDF files', detail: 'Background workers inspect page counts without uploading confidential documents.' },
    { title: 'Arrange document sequence', detail: 'Reorder files with keyboard-accessible Up/Down controls or remove unwanted items.' },
    { title: 'Export lossless merged PDF', detail: 'pdf-lib copies vector and text streams directly without rasterizing pages.' },
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
