/**
 * MSR Penny — Centralized API Client
 * File: src/services/api/apiClient.ts
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  source?: 'serverless' | 'google_sheets' | 'local_fallback';
  timestamp?: string;
}

export class ApiClient {
  private static defaultTimeoutMs = 15000;

  /**
   * Performs an HTTP request with timeout and standardized error handling.
   */
  public static async request<T = any>(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = ApiClient.defaultTimeoutMs
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      clearTimeout(timer);

      const json = await response.json();
      return json;
    } catch (err: any) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError';
      return {
        success: false,
        error: isAbort ? 'Request timed out after 15 seconds' : (err.message || 'Network request failed'),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Resolves the effective API base URL.
   */
  public static resolveUrl(route: string, scriptUrl?: string): string {
    const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
    if (scriptUrl && scriptUrl.trim()) {
      const delimiter = scriptUrl.includes('?') ? '&' : '?';
      return `${scriptUrl.trim()}${delimiter}action=${cleanRoute}`;
    }
    return `/api/${cleanRoute}`;
  }
}
