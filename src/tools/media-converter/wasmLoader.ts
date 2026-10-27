export interface WasmDownloadProgress {
  bytesReceived: number;
  totalBytes: number;
  progress: number;
}

interface WasmPart {
  path: string;
  byteLength: number;
  sha256: string;
}

interface WasmManifest {
  schemaVersion: number;
  source: string;
  sourceSha256: string;
  byteLength: number;
  partBytes: number;
  parts: WasmPart[];
}

const MAX_WASM_BYTES = 64 * 1024 * 1024;
const MAX_PART_BYTES = 20 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateManifest(value: unknown): WasmManifest {
  if (!isRecord(value)) throw new Error('The local FFmpeg asset manifest is invalid.');
  const { schemaVersion, source, sourceSha256, byteLength, partBytes, parts } = value;
  if (
    schemaVersion !== 1
    || source !== 'ffmpeg-core.wasm'
    || typeof sourceSha256 !== 'string'
    || !SHA256_PATTERN.test(sourceSha256)
    || !Number.isSafeInteger(byteLength)
    || (byteLength as number) <= 0
    || (byteLength as number) > MAX_WASM_BYTES
    || !Number.isSafeInteger(partBytes)
    || (partBytes as number) <= 0
    || (partBytes as number) > MAX_PART_BYTES
    || !Array.isArray(parts)
    || parts.length < 1
    || parts.length > 8
  ) {
    throw new Error('The local FFmpeg asset manifest is invalid.');
  }

  const validatedParts: WasmPart[] = [];
  let totalBytes = 0;
  for (const [index, item] of parts.entries()) {
    if (!isRecord(item)) throw new Error('The local FFmpeg asset manifest is invalid.');
    const { path, byteLength: partByteLength, sha256 } = item;
    const expectedPrefix = `part-${String(index + 1).padStart(2, '0')}-`;
    if (
      typeof path !== 'string'
      || !path.startsWith(expectedPrefix)
      || !/^part-\d{2}-[a-f0-9]{64}\.bin$/.test(path)
      || !Number.isSafeInteger(partByteLength)
      || (partByteLength as number) <= 0
      || (partByteLength as number) > (partBytes as number)
      || (partByteLength as number) > MAX_PART_BYTES
      || typeof sha256 !== 'string'
      || !SHA256_PATTERN.test(sha256)
    ) {
      throw new Error('The local FFmpeg asset manifest is invalid.');
    }
    totalBytes += partByteLength as number;
    validatedParts.push({ path, byteLength: partByteLength as number, sha256 });
  }
  if (totalBytes !== byteLength) throw new Error('The local FFmpeg asset manifest has inconsistent part sizes.');

  return {
    schemaVersion: 1,
    source: 'ffmpeg-core.wasm',
    sourceSha256,
    byteLength: byteLength as number,
    partBytes: partBytes as number,
    parts: validatedParts,
  };
}

async function digestHex(data: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadVerifiedWasm(
  manifestURL: string,
  signal: AbortSignal,
  onProgress?: (progress: WasmDownloadProgress) => void,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot verify the local FFmpeg asset integrity.');
  const origin = globalThis.location.origin;
  const resolvedManifestURL = new URL(manifestURL, globalThis.location.href);
  const isLoopback = resolvedManifestURL.hostname === 'localhost'
    || resolvedManifestURL.hostname === '127.0.0.1'
    || resolvedManifestURL.hostname === '[::1]'
    || resolvedManifestURL.hostname.endsWith('.localhost');
  if (resolvedManifestURL.origin !== origin || (resolvedManifestURL.protocol !== 'https:' && !isLoopback)) {
    throw new Error('The FFmpeg manifest must be loaded from this site over a secure connection.');
  }

  const manifestResponse = await fetcher(resolvedManifestURL, {
    credentials: 'same-origin',
    cache: 'no-cache',
    signal,
  });
  if (!manifestResponse.ok) throw new Error('Could not load the local FFmpeg asset manifest.');

  let manifest: WasmManifest;
  try {
    manifest = validateManifest(await manifestResponse.json());
  } catch (error) {
    if (error instanceof Error && error.message.includes('manifest')) throw error;
    throw new Error('The local FFmpeg asset manifest could not be read.');
  }

  const partDirectory = new URL('.', resolvedManifestURL);
  const wasmBytes = new Uint8Array(manifest.byteLength);
  const offsets: Array<{ start: number; end: number; expectedHash: string }> = [];
  let offset = 0;
  onProgress?.({ bytesReceived: 0, totalBytes: manifest.byteLength, progress: 0 });

  for (const part of manifest.parts) {
    if (signal.aborted) throw new DOMException('The FFmpeg download was cancelled.', 'AbortError');
    const partURL = new URL(part.path, resolvedManifestURL);
    if (partURL.origin !== origin || !partURL.pathname.startsWith(partDirectory.pathname)) {
      throw new Error('A FFmpeg asset part does not resolve to this site.');
    }

    const response = await fetcher(partURL, {
      credentials: 'same-origin',
      cache: 'force-cache',
      signal,
    });
    if (!response.ok || !response.body) throw new Error('A local FFmpeg asset part could not be downloaded.');

    const start = offset;
    const reader = response.body.getReader();
    let partBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (signal.aborted) throw new DOMException('The FFmpeg download was cancelled.', 'AbortError');
        if (offset + value.byteLength > wasmBytes.byteLength || partBytes + value.byteLength > part.byteLength) {
          throw new Error('A local FFmpeg asset part is larger than the manifest allows.');
        }
        wasmBytes.set(value, offset);
        offset += value.byteLength;
        partBytes += value.byteLength;
        onProgress?.({
          bytesReceived: offset,
          totalBytes: manifest.byteLength,
          progress: offset / manifest.byteLength,
        });
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }

    if (partBytes !== part.byteLength) throw new Error('A local FFmpeg asset part has an unexpected size.');
    offsets.push({ start, end: offset, expectedHash: part.sha256 });
  }

  if (offset !== manifest.byteLength) throw new Error('The local FFmpeg assets do not match the manifest size.');
  for (const part of offsets) {
    const partHash = await digestHex(wasmBytes.subarray(part.start, part.end));
    if (partHash !== part.expectedHash) throw new Error('A local FFmpeg asset part failed its integrity check.');
  }
  if (await digestHex(wasmBytes) !== manifest.sourceSha256) {
    throw new Error('The FFmpeg WebAssembly integrity check failed. The converter was not loaded.');
  }
  if (signal.aborted) throw new DOMException('The FFmpeg download was cancelled.', 'AbortError');

  const blob = new Blob([wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength) as ArrayBuffer], {
    type: 'application/wasm',
  });
  onProgress?.({ bytesReceived: manifest.byteLength, totalBytes: manifest.byteLength, progress: 1 });
  return URL.createObjectURL(blob);
}
