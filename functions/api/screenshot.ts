interface EdgeProperties {
  colo?: string;
  country?: string;
}

interface PagesContext {
  request: Request & { cf?: EdgeProperties };
  env?: {
    URL_INSPECTOR_ALLOWED_HOSTS?: string;
    // A trusted service binding, never an arbitrary proxy URL. See SECURITY.md.
    URL_INSPECTOR_EGRESS?: { fetch(input: string, init: RequestInit): Promise<Response> };
  };
}

class InvalidTargetError extends Error {}

let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 4; // Per isolate only; shared quotas belong in the egress service.

const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const INSPECTED_HEADERS = [
  'cache-control',
  'content-security-policy',
  'etag',
  'last-modified',
  'server',
  'x-content-type-options',
  'cf-cache-status',
  'cf-ray',
];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function validateTarget(rawUrl: string): URL {
  if (!rawUrl || rawUrl.length > MAX_URL_LENGTH) {
    throw new InvalidTargetError('Provide a URL no longer than 2048 characters.');
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new InvalidTargetError('The target URL is invalid.');
  }

  if (target.protocol !== 'https:') {
    throw new InvalidTargetError('Only public HTTPS URLs can be inspected.');
  }
  if (target.username || target.password) {
    throw new InvalidTargetError('URLs containing credentials are not allowed.');
  }
  if (target.port && target.port !== '443') {
    throw new InvalidTargetError('Only the standard HTTPS port is allowed.');
  }

  const hostname = target.hostname.toLowerCase().replace(/\.$/, '');
  const blockedSuffixes = [
    '.localhost', '.local', '.internal', '.lan', '.home', '.home.arpa',
    '.test', '.example', '.invalid', '.onion', '.i2p', '.arpa',
    '.nip.io', '.sslip.io', '.xip.io', '.localtest.me', '.lvh.me', '.local.gd',
  ];
  const isIpv4Literal = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isIpv6Literal = hostname.includes(':') || hostname.startsWith('[');
  if (!hostname.includes('.') || isIpv4Literal || isIpv6Literal
      || hostname === 'localhost'
      || blockedSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    throw new InvalidTargetError('Local, private, and IP-literal hosts are not allowed. Use a public hostname.');
  }

  target.hostname = hostname;
  target.hash = '';
  return target;
}

function allowedHosts(value: string | undefined): Set<string> {
  if (!value || value.length > 8192) throw new Error('Missing target policy');
  const entries = value.split(',').map((entry) => entry.trim());
  if (entries.length > 100) throw new Error('Too many hosts');
  return new Set(entries.map((entry) => {
    // Exact DNS names only; no URL syntax, wildcards, subdomain expansion or IDN ambiguity.
    if (!/^[a-zA-Z0-9.-]+$/.test(entry) || entry.length > 253
        || entry.split('.').some((label) => !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))) {
      throw new Error('Invalid target policy');
    }
    return validateTarget(`https://${entry}`).hostname;
  }));
}

function cancelBody(response: Response): void {
  // A peer's stalled cancellation must not extend the handler deadline.
  void response.body?.cancel().catch(() => undefined);
}

function safeDisplayUrl(url: URL): string {
  // Do not reflect query strings, which may contain API tokens or other secrets.
  return `${url.origin}${url.pathname}`;
}

async function readHtmlPrefix(response: Response, withinDeadline: <T>(work: Promise<T>) => Promise<T>): Promise<{ html: string; truncated: boolean }> {
  if (!response.body) return { html: '', truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  let truncated = false;
  let reads = 0;

  try {
    while (bytesRead < MAX_HTML_BYTES) {
      if (++reads > 2048) {
        truncated = true;
        break;
      }
      const { done, value } = await withinDeadline(reader.read());
      if (done) break;
      if (!value) continue;
      const remaining = MAX_HTML_BYTES - bytesRead;
      const slice = value.subarray(0, remaining);
      bytesRead += slice.byteLength;
      chunks.push(decoder.decode(slice, { stream: true }));
      if (slice.byteLength < value.byteLength || bytesRead >= MAX_HTML_BYTES) {
        truncated = true;
        void reader.cancel().catch(() => undefined);
        break;
      }
    }
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  chunks.push(decoder.decode());
  return { html: chunks.join(''), truncated };
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[\da-f]{1,6}|#\d{1,7}|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    if (lower === 'nbsp') return ' ';
    const hex = lower.startsWith('#x');
    const codePoint = Number.parseInt(lower.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return match;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return match;
    }
  });
}

function cleanText(value: string, maxLength: number): string {
  return decodeHtmlEntities(value.slice(0, 8192).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, maxLength);
}

function readAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const matcher = /(?:^|[\s<])([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(tag)) !== null) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function extractPageMetadata(html: string): { title: string | null; description: string | null } {
  let title = '';
  let description = '';
  let cursor = 0;
  let tags = 0;
  let titleSeen = false;
  // Scan each tag once. Repeated malformed open tags must not trigger quadratic regex scans.
  while (cursor < html.length && tags < 2048) {
    const start = html.indexOf('<', cursor);
    if (start === -1) break;
    const end = html.indexOf('>', start + 1);
    if (end === -1) break;
    cursor = end + 1;
    tags += 1;
    if (end - start > 8192) continue;
    const tag = html.slice(start, cursor);
    if (!titleSeen && /^<title\b/i.test(tag)) {
      titleSeen = true;
      const closing = /<\/title\s*>/i.exec(html.slice(cursor));
      if (closing) title = cleanText(html.slice(cursor, cursor + closing.index), 300);
    }
    if (!description && /^<meta\b/i.test(tag)) {
      const attributes = readAttributes(tag);
      const name = (attributes.name || attributes.property || '').toLowerCase();
      if (name === 'description' || name === 'og:description') {
        description = cleanText(attributes.content || '', 500);
      }
    }
    if (title && description) break;
  }
  return { title: title || null, description: description || null };
}

function getResponseHeaders(response: Response): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of INSPECTED_HEADERS) {
    const value = response.headers.get(name);
    if (value) result[name] = value.slice(0, 400);
  }
  return result;
}

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const cancelledResponse = () => jsonResponse({ success: false, error: 'The inspection request was cancelled.' }, 499);
  if (context.request.signal.aborted) return cancelledResponse();
  const requestUrl = new URL(context.request.url);
  const rawTarget = requestUrl.searchParams.get('url');
  if (!rawTarget) return jsonResponse({ success: false, error: 'Missing target url parameter.' }, 400);

  let target: URL;
  try {
    target = validateTarget(rawTarget);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'The target URL is not allowed.',
    }, 400);
  }

  const egress = context.env?.URL_INSPECTOR_EGRESS;
  let hosts: Set<string>;
  try {
    hosts = allowedHosts(context.env?.URL_INSPECTOR_ALLOWED_HOSTS);
    if (typeof egress?.fetch !== 'function') throw new Error('Missing egress binding');
  } catch {
    return jsonResponse({ success: false, error: 'URL inspection is unavailable until secure egress is configured.' }, 503);
  }
  if (!hosts.has(target.hostname)) {
    return jsonResponse({ success: false, error: 'This hostname is not approved for inspection.' }, 403);
  }
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return jsonResponse({ success: false, error: 'The inspector is busy. Try again later.' }, 429);
  }
  activeRequests += 1;
  const controller = new AbortController();
  let expire!: () => void;
  let cancel!: () => void;
  let interruption: 'cancelled' | 'timeout' | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    const stop = (reason: 'cancelled' | 'timeout') => {
      if (interruption) return;
      interruption = reason;
      reject(new Error(reason));
      controller.abort();
    };
    expire = () => stop('timeout');
    cancel = () => stop('cancelled');
  });
  context.request.signal.addEventListener('abort', cancel, { once: true });
  const timeoutId = setTimeout(expire, FETCH_TIMEOUT_MS);
  const withinDeadline = <T>(work: Promise<T>): Promise<T> => Promise.race([work, deadline]);
  const throwIfInterrupted = (response?: Response): void => {
    if (!interruption) return;
    if (response) cancelBody(response);
    throw new Error(interruption);
  };
  let upstreamResponse: Response | null = null;
  let finalTarget = target;
  const visited = new Set<string>();

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      throwIfInterrupted();
      if (visited.has(finalTarget.href)) {
        return jsonResponse({ success: false, error: 'The target returned a redirect loop.' }, 502);
      }
      visited.add(finalTarget.href);

      // Never forward browser cookies, authorization, or arbitrary request headers.
      const response = await withinDeadline(egress!.fetch(finalTarget.href, {
        method: 'GET',
        headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1' },
        redirect: 'manual',
        signal: controller.signal,
      }).then((result) => {
        if (controller.signal.aborted) cancelBody(result);
        return result;
      }));
      // A settled race cannot reject if interruption arrives before this continuation.
      throwIfInterrupted(response);
      if (response.status === 429 || response.status === 503) {
        cancelBody(response);
        throwIfInterrupted();
        return jsonResponse({ success: false, error: 'Inspection is temporarily unavailable or rate limited.' }, response.status);
      }

      const location = response.headers.get('location');
      if (REDIRECT_STATUSES.has(response.status) && location) {
        if (redirectCount === MAX_REDIRECTS) {
          cancelBody(response);
          throwIfInterrupted();
          return jsonResponse({ success: false, error: 'The target redirected too many times.' }, 502);
        }
        try {
          finalTarget = validateTarget(new URL(location, finalTarget).href);
          if (!hosts.has(finalTarget.hostname)) throw new InvalidTargetError('Unapproved redirect');
        } catch {
          cancelBody(response);
          throwIfInterrupted();
          return jsonResponse({ success: false, error: 'The target redirected to a blocked URL.' }, 502);
        }
        cancelBody(response);
        continue;
      }
      upstreamResponse = response;
      break;
    }

    if (!upstreamResponse) return jsonResponse({ success: false, error: 'Could not reach the target website.' }, 502);

    const contentType = (upstreamResponse.headers.get('content-type') || '').slice(0, 200);
    let title: string | null = null;
    let description: string | null = null;
    let bodyTruncated = false;

    if (/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(contentType)) {
      const result = await readHtmlPrefix(upstreamResponse, withinDeadline);
      const metadata = extractPageMetadata(result.html);
      title = metadata.title;
      description = metadata.description;
      bodyTruncated = result.truncated;
    } else {
      cancelBody(upstreamResponse);
    }

    throwIfInterrupted();
    const edge = context.request.cf;
    const userAgent = (context.request.headers.get('user-agent') || 'Unknown').slice(0, 200);
    return jsonResponse({
      success: true,
      target: safeDisplayUrl(target),
      finalUrl: safeDisplayUrl(finalTarget),
      timestamp: Date.now(),
      upstreamStatus: upstreamResponse.status,
      upstreamStatusText: upstreamResponse.statusText.slice(0, 100),
      contentType,
      title,
      description,
      responseHeaders: getResponseHeaders(upstreamResponse),
      bodyTruncated,
      edgeColo: edge?.colo || 'UNKNOWN',
      country: edge?.country || 'GLOBAL',
      userAgent,
    });
  } catch (error) {
    if (interruption === 'cancelled') return cancelledResponse();
    if (interruption === 'timeout') {
      return jsonResponse({ success: false, error: 'The target website took too long to respond.' }, 504);
    }
    return jsonResponse({ success: false, error: 'Could not fetch the target website. It may be unavailable or block automated requests.' }, 502);
  } finally {
    clearTimeout(timeoutId);
    context.request.signal.removeEventListener('abort', cancel);
    // End service work on success and early returns too, including stalled body cancellation.
    controller.abort();
    activeRequests -= 1;
    if (upstreamResponse?.body && !upstreamResponse.bodyUsed) {
      cancelBody(upstreamResponse);
    }
  }
};
