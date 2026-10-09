import { describe, expect, it, vi } from "vitest";
import {
  oauthDiagnosticFetch,
  safeSignInError,
} from "../../apps/desktop/electron/oauth-diagnostics";
import { signInErrorMessage } from "../../apps/desktop/src/lib/signin-error";

const endpoint = "https://auth.precut.test/auth/v1/oauth/token";
describe("safe OAuth diagnostics", () => {
  it("classifies a rejected public client without exposing server descriptions or credentials", async () => {
    const payload = {
      error: "invalid_client",
      error_description: "private server detail",
      code: "private-code",
      refresh_token: "private-token",
    };
    const response = new Response(JSON.stringify(payload), { status: 401 });
    const failed = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    const fetch = oauthDiagnosticFetch(
      "https://auth.precut.test",
      failed,
      fetcher,
    );
    const input = { method: "POST", body: "private-request" };
    expect(await fetch(endpoint, input)).toBe(response);
    expect(fetcher).toHaveBeenCalledWith(endpoint, input);
    expect(failed).toHaveBeenCalledExactlyOnceWith({
      status: 401,
      code: "OAUTH_CLIENT_INVALID",
    });
    expect(await response.json()).toEqual(payload);
    expect(
      safeSignInError(
        { code: "OAUTH_REQUEST_FAILED" },
        failed.mock.calls[0][0],
      ),
    ).toBe("OAUTH_CLIENT_INVALID");
    expect(signInErrorMessage("OAUTH_CLIENT_INVALID", false)).not.toContain(
      "expired",
    );
  });
  it("does not inspect successful tokens or unrelated API failures", async () => {
    const failed = vi.fn();
    const response = new Response("private response", { status: 200 });
    const clone = vi.spyOn(response, "clone");
    const fetch = oauthDiagnosticFetch(
      "https://auth.precut.test",
      failed,
      vi.fn<typeof fetch>().mockResolvedValue(response),
    );
    expect(await fetch(endpoint)).toBe(response);
    expect(clone).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    const unrelated = new Response("private response", { status: 401 });
    const unrelatedClone = vi.spyOn(unrelated, "clone");
    const otherFetch = oauthDiagnosticFetch(
      "https://auth.precut.test",
      failed,
      vi.fn<typeof fetch>().mockResolvedValue(unrelated),
    );
    expect(await otherFetch("https://store.precut.test/v1/licenses")).toBe(
      unrelated,
    );
    expect(unrelatedClone).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });
  it.each(["constructor", "__proto__", "private-code"])(
    "does not accept unlisted or prototype error codes: %s",
    async (error) => {
      const failed = vi.fn();
      const fetch = oauthDiagnosticFetch(
        "https://auth.precut.test",
        failed,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response(JSON.stringify({ error }), { status: 400 }),
          ),
      );
      await fetch(endpoint);
      expect(failed).toHaveBeenCalledExactlyOnceWith({
        status: 400,
        code: "OAUTH_REQUEST_FAILED",
      });
    },
  );
  it("bounds diagnostic reads and preserves the response when inspection or observers fail", async () => {
    const response = new Response("x".repeat(8192), { status: 503 });
    const fetch = oauthDiagnosticFetch(
      "https://auth.precut.test",
      () => {
        throw new Error("observer failed");
      },
      vi.fn<typeof fetch>().mockResolvedValue(response),
    );
    expect(await fetch(endpoint)).toBe(response);
    expect((await response.text()).length).toBe(8192);
  });
  it("separates callback, network and service failures while hiding arbitrary errors", () => {
    expect(safeSignInError({ code: "OAUTH_CALLBACK_INVALID" })).toBe(
      "OAUTH_CALLBACK_INVALID",
    );
    expect(safeSignInError({ code: "LICENSE_NETWORK_ERROR" })).toBe(
      "OAUTH_NETWORK_ERROR",
    );
    expect(safeSignInError(new Error("private-token"))).toBe(
      "OAUTH_SIGNIN_FAILED",
    );
    expect(signInErrorMessage("OAUTH_NETWORK_ERROR", true)).toContain(
      "อินเทอร์เน็ต",
    );
  });
});
