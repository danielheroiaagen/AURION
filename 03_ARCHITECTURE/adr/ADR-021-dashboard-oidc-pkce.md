---
project: AURION
status: accepted
owner: Daniel Gonzalez Junco
created_at: 2026-06-10
related: ADR-016, ADR-017
---

# ADR-021 — Dashboard sign-in: OIDC Authorization Code + PKCE

## Decision

The dashboard signs users in against the external IdP (ADR-016) with the
**Authorization Code flow + PKCE (S256)** as a **public client**: no client
secret exists anywhere in the dashboard, the code verifier is generated per
attempt with WebCrypto, and `state` binds the callback to the attempt that
initiated it.

Configuration is explicit (no discovery fetch, mirroring ADR-016's
explicit-JWKS stance): `VITE_OIDC_AUTHORIZATION_URL`, `VITE_OIDC_TOKEN_URL`,
`VITE_OIDC_CLIENT_ID`, optional `VITE_OIDC_SCOPE` (default
`openid profile`) and `VITE_OIDC_AUDIENCE`. When OIDC is not configured the
sign-in screen falls back to the manual token paste (dev/hs256 mode) —
exactly the seam ADR-017 reserved.

## Flow

1. **Start**: generate `code_verifier` (43+ chars, `crypto.getRandomValues`)
   and `state`; store both in `sessionStorage` (transient, per-tab, dies
   with the attempt); redirect to the authorization URL with
   `code_challenge = base64url(SHA-256(verifier))`,
   `code_challenge_method=S256`, `redirect_uri = <origin>/callback`.
2. **Callback** (`/callback`): reject unless the returned `state` equals the
   stored one (then consume both — single use); exchange the code at the
   token endpoint (`grant_type=authorization_code`, `code_verifier`,
   `redirect_uri`, `client_id` — form-encoded, no secret).
3. **Session**: the returned `access_token` enters through the SAME door as
   a pasted token — `signIn()` validates shape, expiry and the API before
   accepting (ADR-017). OIDC changes how a token arrives, never what it is
   allowed to do.

## Security properties

- PKCE S256 makes a stolen authorization code useless without the verifier;
  the verifier never leaves the tab that minted it.
- `state` is single-use and compared before any exchange — a forged or
  replayed callback dies before a network call.
- The token endpoint response is handled by one function with explicit
  error mapping; IdP error responses surface as sign-in errors, never as a
  half-authenticated session.
- The existing session rules are unchanged: `sessionStorage` only, claims
  are UX hints, any 401 kills the session.

## Consequences

- IdP-side setup (SPA application, allowed callback
  `https://<domain>/callback`, M2M client for the voice gateway) is
  operational configuration documented per IdP at onboarding.
- Refresh tokens are deliberately NOT requested (`offline_access` excluded):
  a dashboard session lives as long as the access token; re-auth is a
  redirect. Silent renewal can be added later behind the same module.
- Out of scope: RP-initiated logout at the IdP, multi-IdP selection,
  `id_token` validation (the dashboard trusts only the API's verdict on the
  access token — the API is the resource server, ADR-016).
