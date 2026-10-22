import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  formatBytes,
  generateBatchZip,
  uniqueZipEntryName,
  type CompressedItem,
} from '../src/tools/image-compressor/logic';

describe('formatBytes', () => {
  it('formats zero and invalid input as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-10)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });

  it('formats bytes without decimals and larger units with one decimal', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('caps the unit at GB', () => {
    expect(formatBytes(5 * 1024 * 1024 * 1024 * 1024)).toBe('5120.0 GB');
  });
});

describe('uniqueZipEntryName', () => {
  it('keeps the first use of a name unchanged', () => {
    const used = new Set<string>();
    expect(uniqueZipEntryName('photo.png', used)).toBe('photo.png');
  });

  it('deduplicates repeated names with an incrementing suffix', () => {
    const used = new Set<string>();
    expect(uniqueZipEntryName('photo.png', used)).toBe('photo.png');
    expect(uniqueZipEntryName('photo.png', used)).toBe('photo (2).png');
    expect(uniqueZipEntryName('photo.png', used)).toBe('photo (3).png');
  });

  it('treats names case-insensitively, like common filesystems', () => {
    const used = new Set<string>();
    expect(uniqueZipEntryName('Photo.PNG', used)).toBe('Photo.PNG');
    expect(uniqueZipEntryName('photo.png', used)).toBe('photo (2).png');
  });

  it('replaces path separators so entries cannot escape the ZIP root', () => {
    const used = new Set<string>();
    expect(uniqueZipEntryName('a/b\\c.png', used)).toBe('a_b_c.png');
  });
});

describe('generateBatchZip', () => {
  const makeItem = (name: string, content: string): CompressedItem => ({
    id: name + content,
    originalFile: { name } as File,
    compressedBlob: new Blob([content]),
    originalSize: content.length,
    compressedSize: content.length,
    savedPercent: 0,
  });

  it('creates a ZIP whose entries keep their contents', async () => {
    const blob = await generateBatchZip([makeItem('one.png', 'first'), makeItem('two.jpg', 'second')]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['one.png', 'two.jpg']);
    expect(await zip.file('one.png')?.async('string')).toBe('first');
    expect(await zip.file('two.jpg')?.async('string')).toBe('second');
  });

  it('deduplicates entry names inside the ZIP', async () => {
    const blob = await generateBatchZip([makeItem('same.png', 'a'), makeItem('same.png', 'b')]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['same (2).png', 'same.png']);
  });
});
