import { describe, expect, it } from 'vitest';
import { formatPdfBytes, MAX_PDF_BATCH_PAGES } from '../src/tools/pdf-merger/logic';

describe('formatPdfBytes', () => {
  it('formats zero and invalid input as 0 B', () => {
    expect(formatPdfBytes(0)).toBe('0 B');
    expect(formatPdfBytes(-1)).toBe('0 B');
    expect(formatPdfBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
  });

  it('formats common sizes', () => {
    expect(formatPdfBytes(900)).toBe('900 B');
    expect(formatPdfBytes(2048)).toBe('2.0 KB');
    expect(formatPdfBytes(25 * 1024 * 1024)).toBe('25.0 MB');
  });
});

describe('PDF limits', () => {
  it('keeps the documented batch page limit', () => {
    expect(MAX_PDF_BATCH_PAGES).toBe(2000);
  });
});
