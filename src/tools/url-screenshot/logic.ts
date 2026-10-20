export interface TelemetryResponse {
  success: true;
  target: string;
  finalUrl: string;
  timestamp: number;
  upstreamStatus: number;
  upstreamStatusText: string;
  contentType: string;
  title: string | null;
  description: string | null;
  responseHeaders: Record<string, string>;
  bodyTruncated: boolean;
  edgeColo: string;
  country: string;
  userAgent: string;
}

interface ApiError {
  success: false;
  error: string;
}

export async function fetchEdgeTelemetry(
  targetUrl: string,
  signal?: AbortSignal,
): Promise<TelemetryResponse> {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Enter a public HTTPS URL.');
  }

  const response = await fetch(`/api/screenshot?url=${encodeURIComponent(parsed.href)}`, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });

  let payload: TelemetryResponse | ApiError;
  try {
    payload = await response.json() as TelemetryResponse | ApiError;
  } catch {
    throw new Error('The edge function returned an invalid response.');
  }

  if (!response.ok || payload.success !== true) {
    throw new Error(payload.success === false ? payload.error : 'The edge function could not inspect this URL.');
  }
  return payload;
}
