/**
 * API client for MartechOS backend.
 *
 * Handles authentication (Bearer token, 401 handling), error parsing into a standard
 * envelope, and request/response transformation. Used by all data-fetching hooks and
 * API calls from the web app.
 *
 * Flows:
 * - Token: read from localStorage on init; inject Authorization header on every request.
 * - 401: clear token, invoke optional callback (e.g. redirect to login).
 * - Errors: non-2xx responses parsed into ApiError; thrown as ApiClientError.
 */

/**
 * Base URL for the API. Uses VITE_API_BASE_URL in build, or falls back to localhost:58000 in development.
 * @internal
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:58000';

/**
 * Standard API error envelope returned by the backend and exposed to the UI.
 *
 * @property code - Stable machine-readable code (e.g. "auth.invalid_credentials").
 * @property message - Human-readable fallback message.
 * @property messageKey - Optional i18n key for frontend translation (e.g. "signup.auth.errors.invalidEmail").
 * @property correlationId - Optional request/correlation ID for support.
 * @property details - Optional extra payload from the backend.
 */
export interface ApiError {
  code: string;
  message: string;
  messageKey?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

/**
 * Error thrown when an API request fails (non-2xx). Carries status, parsed error, and optional Response.
 *
 * @param status - HTTP status code (e.g. 400, 401, 500).
 * @param error - Parsed ApiError from the response body.
 * @param response - Optional raw Response for callers that need headers or body.
 */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public error: ApiError,
    public response?: Response
  ) {
    super(error.message);
    this.name = 'ApiClientError';
  }
}

/**
 * Parses a fetch Response: on non-ok, throws ApiClientError; on ok, returns JSON body as T.
 * Handles 204 and empty or non-JSON bodies by returning {} as T.
 *
 * @param response - Raw fetch Response.
 * @returns Parsed JSON as T, or {} for 204/empty.
 * @throws ApiClientError when response.ok is false.
 * @internal
 */
type HandleResponseOptions = {
  /** When true, skip `console.error` for 404 (e.g. expected miss before client-side fallback). */
  suppressErrorLog?: boolean;
};

async function handleResponse<T>(response: Response, opts?: HandleResponseOptions): Promise<T> {
  // Handle 204 No Content responses (no body) - return early
  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    let error: ApiError;
    
    if (contentType?.includes('application/json')) {
      try {
        const data = await response.json();
        // Support both standard envelope { error: {...} } and FastAPI { detail: {...} | string }
        const rawDetail = data.detail;
        const detailObj = rawDetail && typeof rawDetail === 'object' ? rawDetail : null;
        const err = data.error || detailObj || {
          code: `HTTP_${response.status}`,
          message: (typeof rawDetail === 'string' ? rawDetail : null) || data.message || response.statusText,
        };
        error = {
          code: err.code ?? `HTTP_${response.status}`,
          message: err.message ?? response.statusText,
          messageKey: err.messageKey,
          correlationId: err.correlationId,
          details: err.details,
        };
      } catch (e) {
        // Failed to parse JSON error response
        error = {
          code: `HTTP_${response.status}`,
          message: response.statusText,
        };
      }
    } else {
      // Try to get text error message
      try {
        const text = await response.text();
        error = {
          code: `HTTP_${response.status}`,
          message: text || response.statusText,
        };
      } catch (e) {
        error = {
          code: `HTTP_${response.status}`,
          message: response.statusText,
        };
      }
    }

    const quiet404 = opts?.suppressErrorLog && response.status === 404;
    if (!quiet404) {
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        error,
        url: response.url,
      });
    }

    throw new ApiClientError(response.status, error, response);
  }

  // Check if response has content before trying to parse JSON
  const contentLength = response.headers.get('content-length');

  // If content-length is 0, return empty object
  if (contentLength === '0') {
    return {} as T;
  }

  // Try to parse JSON, but handle empty responses gracefully
  const text = await response.text();
  if (!text || text.trim() === '') {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    // If JSON parsing fails but response was OK, return empty object
    // This can happen with malformed responses or non-JSON content
    return {} as T;
  }
}

/**
 * Callback invoked when the API client detects an expired token (401).
 * Typically used to redirect the user to login or clear auth state.
 */
type TokenExpiredCallback = () => void;

/**
 * Callback invoked when the API client receives 403 Forbidden.
 * Use to show a global user-friendly message (e.g. toast). Callers can still catch
 * ApiClientError for page-level overrides. Per docs/rbac.md: 403 = insufficient permission.
 */
type ForbiddenCallback = (error: ApiClientError) => void;

/** Fetch options plus API client-only flags (not passed to `fetch`). */
export type ApiRequestInit = RequestInit & { suppressErrorLog?: boolean };

/**
 * HTTP client for the MartechOS backend API.
 *
 * Provides a typed interface for all REST calls: configurable base URL, Bearer token
 * from localStorage, and consistent error handling. On 401, the client clears the token
 * and optionally invokes a callback (e.g. redirect to login). All methods throw
 * {@link ApiClientError} on non-2xx responses. The singleton {@link apiClient} is
 * used by data-fetching hooks and components across the app.
 */
export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private onTokenExpired: TokenExpiredCallback | null = null;
  private onForbidden: ForbiddenCallback | null = null;
  private isHandlingTokenExpired: boolean = false;

  /**
   * Creates the client and loads the auth token from localStorage if present.
   *
   * @param baseUrl - Base URL for the API (defaults to VITE_API_BASE_URL or localhost:58000).
   */
  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Guard for Next.js SSR: the singleton is constructed at module scope,
    // where localStorage only exists in the browser.
    this.token = typeof window === 'undefined' ? null : localStorage.getItem('auth_token');
  }

  /**
   * Sets or clears the Bearer token. Persists to localStorage when non-null.
   *
   * @param token - New token value, or null to clear and remove from storage.
   */
  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  /**
   * Returns the current Bearer token (or null).
   *
   * @returns Current token or null.
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Registers a callback to run when a 401 is received (e.g. redirect to login).
   *
   * @param callback - Function to call on 401; pass null to clear.
   */
  setOnTokenExpired(callback: TokenExpiredCallback | null) {
    this.onTokenExpired = callback;
  }

  /**
   * Registers a callback to run when a 403 Forbidden is received.
   * Use for global user-friendly messaging (e.g. toast). Callers can still catch
   * ApiClientError for custom messaging. Pass null to clear.
   */
  setOnForbidden(callback: ForbiddenCallback | null) {
    this.onForbidden = callback;
  }

  /**
   * Sends an HTTP request with base URL, JSON headers, and Bearer token. On 401, clears token and invokes onTokenExpired.
   *
   * @param endpoint - Path relative to baseUrl (e.g. "/v1/plans").
   * @param options - Fetch RequestInit (method, body, headers, etc.).
   * @returns Parsed response body as T.
   * @throws ApiClientError when response is not ok.
   * @internal
   */
  private async request<T>(endpoint: string, options: ApiRequestInit = {}): Promise<T> {
    const { suppressErrorLog, ...fetchInit } = options;
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      ...(fetchInit.headers as Record<string, string>),
    };
    if (!(fetchInit.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...fetchInit,
      headers,
    });

    // Handle 401 Unauthorized - token might be expired
    if (response.status === 401 && this.token && !this.isHandlingTokenExpired) {
      // Prevent multiple simultaneous logout calls
      this.isHandlingTokenExpired = true;
      // Clear token and trigger callback
      this.setToken(null);
      if (this.onTokenExpired) {
        // Call asynchronously to avoid blocking the response handling
        setTimeout(() => {
          this.onTokenExpired?.();
          this.isHandlingTokenExpired = false;
        }, 0);
      } else {
        this.isHandlingTokenExpired = false;
      }
    }

    try {
      return await handleResponse<T>(response, { suppressErrorLog });
    } catch (e) {
      // Global 403 handling: show user-friendly message; callers can still catch for overrides
      if (e instanceof ApiClientError && e.status === 403 && this.onForbidden) {
        this.onForbidden(e);
      }
      throw e;
    }
  }

  /**
   * GET binary body (e.g. proxied image download). Does not set JSON Content-Type.
   * On error, parses JSON/text error envelope like other methods.
   */
  async getBlob(endpoint: string, options?: ApiRequestInit): Promise<Blob> {
    const { suppressErrorLog, ...fetchInit } = options ?? {};
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      ...(fetchInit.headers as Record<string, string>),
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...fetchInit,
      method: 'GET',
      headers,
    });

    if (response.status === 401 && this.token && !this.isHandlingTokenExpired) {
      this.isHandlingTokenExpired = true;
      this.setToken(null);
      if (this.onTokenExpired) {
        setTimeout(() => {
          this.onTokenExpired?.();
          this.isHandlingTokenExpired = false;
        }, 0);
      } else {
        this.isHandlingTokenExpired = false;
      }
    }

    try {
      if (!response.ok) {
        await handleResponse<never>(response.clone(), { suppressErrorLog });
      }
      return await response.blob();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 403 && this.onForbidden) {
        this.onForbidden(e);
      }
      throw e;
    }
  }

  /**
   * Performs an HTTP GET. Response body is parsed as JSON.
   *
   * @param endpoint - Path relative to base URL (e.g. "/v1/plans").
   * @param options - Optional fetch RequestInit (e.g. headers, signal).
   * @returns Parsed JSON as T.
   * @throws ApiClientError when response is not ok.
   */
  async get<T>(endpoint: string, options?: ApiRequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Performs an HTTP POST with JSON body (or FormData). Content-Type is set automatically.
   *
   * @param endpoint - Path relative to base URL.
   * @param body - Optional JSON-serializable body or FormData.
   * @param options - Optional fetch RequestInit.
   * @returns Parsed JSON as T.
   * @throws ApiClientError when response is not ok.
   */
  async post<T>(endpoint: string, body?: unknown, options?: ApiRequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * POST multipart/form-data (e.g. file upload). Do not set Content-Type; the browser sets it with boundary.
   *
   * @param endpoint - Path relative to base URL.
   * @param formData - FormData instance to send as body.
   * @returns Parsed JSON as T.
   * @throws ApiClientError when response is not ok.
   */
  async postFormData<T>(endpoint: string, formData: FormData, options?: ApiRequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Performs an HTTP PUT with JSON body.
   *
   * @param endpoint - Path relative to base URL.
   * @param body - Optional JSON-serializable body.
   * @param options - Optional fetch RequestInit.
   * @returns Parsed JSON as T.
   * @throws ApiClientError when response is not ok.
   */
  async put<T>(endpoint: string, body?: unknown, options?: ApiRequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Performs an HTTP PATCH with JSON body.
   *
   * @param endpoint - Path relative to base URL.
   * @param body - Optional JSON-serializable body.
   * @param options - Optional fetch RequestInit.
   * @returns Parsed JSON as T.
   * @throws ApiClientError when response is not ok.
   */
  async patch<T>(endpoint: string, body?: unknown, options?: ApiRequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Performs an HTTP DELETE.
   *
   * @param endpoint - Path relative to base URL.
   * @param options - Optional fetch RequestInit.
   * @returns Parsed JSON as T (often empty for 204).
   * @throws ApiClientError when response is not ok.
   */
  async delete<T>(endpoint: string, options?: ApiRequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

/**
 * Singleton API client instance. Use this for all backend HTTP requests from the web app.
 * Configure token and 401 callback via {@link ApiClient.setToken} and {@link ApiClient.setOnTokenExpired}.
 */
export const apiClient = new ApiClient();

