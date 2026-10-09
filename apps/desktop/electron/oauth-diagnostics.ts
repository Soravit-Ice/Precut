// Keep only standard OAuth error classifications. Codes, verifiers, tokens and
// server error descriptions never enter app status or diagnostics.
export type OAuthFailure = { status: number; code: string };
const standardErrors: Record<string, string> = {
  invalid_client: "OAUTH_CLIENT_INVALID",
  unauthorized_client: "OAUTH_CLIENT_INVALID",
  invalid_grant: "OAUTH_GRANT_INVALID",
  invalid_scope: "OAUTH_SCOPE_INVALID",
  access_denied: "OAUTH_ACCESS_DENIED",
  server_error: "OAUTH_SERVER_ERROR",
  temporarily_unavailable: "OAUTH_SERVER_ERROR",
};

export function oauthDiagnosticFetch(
  supabaseUrl: string,
  onFailure: (failure: OAuthFailure) => void,
  fetcher: typeof fetch = fetch,
): typeof fetch {
  const endpoint = new URL("/auth/v1/oauth/token", supabaseUrl).href;
  return async (input, init) => {
    const response = await fetcher(input, init);
    const url = input instanceof Request ? input.url : String(input);
    if (url !== endpoint || response.ok) return response;
    let code =
      response.status === 401
        ? "OAUTH_CLIENT_INVALID"
        : response.status === 429
          ? "OAUTH_RATE_LIMITED"
          : response.status >= 500
            ? "OAUTH_SERVER_ERROR"
            : "OAUTH_REQUEST_FAILED";
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      reader = response.clone().body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4096) {
          void reader.cancel().catch(() => {});
          break;
        }
        chunks.push(value);
      }
      if (size <= 4096) {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const error = typeof body?.error === "string" ? body.error : undefined;
        if (error && Object.hasOwn(standardErrors, error))
          code = standardErrors[error];
      }
    } catch {
      // Inspection cannot change the signed SDK's normal response handling.
    } finally {
      reader?.releaseLock();
    }
    try {
      onFailure({ status: response.status, code });
    } catch {
      // A diagnostics observer cannot change authentication behavior.
    }
    return response;
  };
}

export function safeSignInError(error: unknown, failure?: OAuthFailure) {
  const code = (error as { code?: unknown })?.code;
  if (code === "OAUTH_REQUEST_FAILED" && failure) return failure.code;
  if (code === "LICENSE_NETWORK_ERROR") return "OAUTH_NETWORK_ERROR";
  if (
    code === "OAUTH_CALLBACK_INVALID" ||
    code === "OAUTH_RESPONSE_INVALID" ||
    code === "OAUTH_ACCESS_DENIED"
  )
    return code;
  return "OAUTH_SIGNIN_FAILED";
}
