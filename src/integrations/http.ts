import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
  }
}

/**
 * Native HTTP on Android (no CORS restrictions – needed for iCal feeds,
 * Liftoff and the holiday API). Falls back to fetch in the browser.
 */
export async function httpRequest<T = unknown>(opts: {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  data?: unknown;
  responseType?: 'json' | 'text';
  timeoutMs?: number;
}): Promise<T> {
  const res = await CapacitorHttp.request({
    url: opts.url,
    method: opts.method ?? 'GET',
    headers: opts.headers,
    data: opts.data,
    responseType: opts.responseType ?? 'json',
    connectTimeout: opts.timeoutMs ?? 20_000,
    readTimeout: opts.timeoutMs ?? 30_000,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new HttpError(`HTTP ${res.status}`, res.status, res.data);
  }
  let data = res.data;
  if (opts.responseType !== 'text' && typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      /* keep string */
    }
  }
  return data as T;
}
