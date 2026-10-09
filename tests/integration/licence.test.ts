import { describe, it, expect, vi } from "vitest";
import { LicenseSdk } from "@t2e/license-sdk";
import { MemorySdkStorage } from "@t2e/license-sdk/testing";
import { createHash } from "node:crypto";

describe("installed SDK browser/manual OAuth handoff", () => {
  it("rejects expired and denied requests without exchanging a token", async () => {
    const storage = new MemorySdkStorage(),
      fetcher = vi.fn();
    const sdk = new LicenseSdk({
      baseUrl: "https://licence.precut.test",
      productCode: "PC",
      storage,
      trialEnabled: false,
      fetch: fetcher,
      oauth: {
        supabaseUrl: "https://auth.precut.test",
        clientId: "test-client",
        redirectUri: "com.t2etech.precut://oauth/callback",
        openExternal: async () => {},
      },
    });
    try {
      await sdk.login();
      const state = (await storage.load())!;
      await storage.save({
        ...state,
        authorization: { ...state.authorization!, expiresAt: Date.now() - 1 },
      });
      await expect(
        sdk.completeLogin(
          `com.t2etech.precut://oauth/callback?code=code&state=${state.authorization!.state}`,
        ),
      ).rejects.toMatchObject({ code: "OAUTH_CALLBACK_INVALID" });
      await sdk.login();
      const fresh = (await storage.load())!.authorization!;
      await expect(
        sdk.completeLogin(
          `com.t2etech.precut://oauth/callback?error=access_denied&state=${fresh.state}`,
        ),
      ).rejects.toMatchObject({ code: "OAUTH_ACCESS_DENIED" });
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await sdk.dispose();
    }
  });
  it("uses the original PKCE verifier, rejects a forged state and consumes the link once", async () => {
    const storage = new MemorySdkStorage();
    let authorizationUrl = "";
    const fetcher = vi.fn(
      async (url: string | URL | Request) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("/oauth/token")
              ? {
                  access_token: "test-access",
                  refresh_token: "test-refresh",
                  expires_in: 3600,
                  token_type: "Bearer",
                }
              : { data: [] },
          ),
          { headers: { "content-type": "application/json" } },
        ),
    );
    const sdk = new LicenseSdk({
      baseUrl: "https://licence.precut.test",
      productCode: "PC",
      storage,
      trialEnabled: false,
      fetch: fetcher,
      machineIdentity: async () => "test-device",
      oauth: {
        supabaseUrl: "https://auth.precut.test",
        clientId: "test-public-client",
        redirectUri: "com.t2etech.precut://oauth/callback",
        openExternal: async (url) => {
          authorizationUrl = url;
        },
      },
    });
    try {
      await sdk.login();
      const authorization = (await storage.load())!.authorization!;
      expect(new URL(authorizationUrl).searchParams.get("code_challenge")).toBe(
        createHash("sha256").update(authorization.verifier).digest("base64url"),
      );
      await expect(
        sdk.completeLogin(
          `com.t2etech.precut://oauth/callback?code=code&state=${"x".repeat(43)}`,
        ),
      ).rejects.toMatchObject({ code: "OAUTH_CALLBACK_INVALID" });
      expect(fetcher).not.toHaveBeenCalled();
      const callback = `com.t2etech.precut://oauth/callback?code=code&state=${authorization.state}`;
      await expect(sdk.completeLogin(callback)).resolves.toEqual({
        signedIn: true,
        activated: false,
      });
      const tokenRequest = fetcher.mock.calls.find(([url]) =>
        String(url).endsWith("/oauth/token"),
      )!;
      const init = (tokenRequest as unknown as [unknown, RequestInit])[1];
      expect(new URLSearchParams(String(init.body)).get("code_verifier")).toBe(
        authorization.verifier,
      );
      expect((await sdk.getAccess()).signedIn).toBe(true);
      await expect(sdk.completeLogin(callback)).rejects.toMatchObject({
        code: "OAUTH_CALLBACK_INVALID",
      });
    } finally {
      await sdk.dispose();
    }
  });
});
describe("installed SDK export trust boundary", () => {
  it("does not run a trial export while offline", async () => {
    const sdk = new LicenseSdk({
      baseUrl: "https://licence.precut.test",
      productCode: "PC",
      storage: new MemorySdkStorage(),
      machineIdentity: async () => "stable-test-machine",
      fetch: async () => {
        throw new Error("offline");
      },
    });
    const engine = vi.fn();
    await expect(
      sdk.runWithAccess(
        {
          feature: "export",
          operationId: crypto.randomUUID(),
          recovery: { projectId: crypto.randomUUID() },
        },
        engine,
      ),
    ).rejects.toMatchObject({ code: "LICENSE_NETWORK_ERROR" });
    expect(engine).not.toHaveBeenCalled();
    await sdk.dispose();
  });
  it("rejects persisted state belonging to a different product", async () => {
    const storage = new MemorySdkStorage();
    await storage.save({
      version: 1,
      productCode: "LX",
      license: null,
      pending: [],
    });
    const sdk = new LicenseSdk({
      baseUrl: "https://licence.precut.test",
      productCode: "PC",
      storage,
    });
    await expect(sdk.getAccess()).rejects.toMatchObject({
      code: "DEVICE_STORAGE_INVALID",
    });
    expect((await storage.load())?.productCode).toBe("LX");
    await sdk.dispose();
  });
});
