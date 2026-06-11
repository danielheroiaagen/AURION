/**
 * Machine identity against a real IdP (ADR-033): OAuth2 client_credentials
 * with in-memory caching and early refresh. Plain fetch — no SDK, the
 * gateway's runtime dependency set stays `ws` only.
 *
 * Fail-closed by design: a token the IdP refuses to mint surfaces as an
 * error on the API call path (`upstream_failed`), never as an unsigned
 * request.
 */
export interface OidcClientConfig {
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly audience?: string | null;
  readonly timeoutMs: number;
}

export class OidcTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OidcTokenError';
  }
}

interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
}

/** Refresh this many seconds BEFORE the token expires. */
const EARLY_REFRESH_SEC = 60;

export class OidcTokenProvider {
  private cached: { token: string; expiresAtMs: number } | null = null;
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly config: OidcClientConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  /** Current machine token, minting/refreshing as needed (single-flight). */
  async getToken(): Promise<string> {
    if (this.cached && this.now() < this.cached.expiresAtMs) {
      return this.cached.token;
    }
    if (!this.inflight) {
      this.inflight = this.mint().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private async mint(): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let parsed: TokenResponse;
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        ...(this.config.audience ? { audience: this.config.audience } : {}),
      });
      const response = await this.fetchImpl(this.config.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new OidcTokenError(`Token endpoint responded ${response.status}.`);
      }
      parsed = (await response.json()) as TokenResponse;
    } catch (error) {
      if (error instanceof OidcTokenError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OidcTokenError(
          `Token endpoint did not respond within ${this.config.timeoutMs}ms.`,
        );
      }
      throw new OidcTokenError('Token endpoint could not be reached.');
    } finally {
      clearTimeout(timer);
    }

    if (typeof parsed.access_token !== 'string' || parsed.access_token.length === 0) {
      throw new OidcTokenError('Token endpoint returned no access_token.');
    }
    const expiresInSec = typeof parsed.expires_in === 'number' ? parsed.expires_in : 300;
    this.cached = {
      token: parsed.access_token,
      expiresAtMs: this.now() + Math.max(30, expiresInSec - EARLY_REFRESH_SEC) * 1000,
    };
    return parsed.access_token;
  }
}
