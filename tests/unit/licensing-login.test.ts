import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  bind: vi.fn(),
  complete: vi.fn(),
  access: vi.fn(),
  login: vi.fn(),
  unbind: vi.fn(),
  dispose: vi.fn(),
  storageLoad: vi.fn(),
  storageSave: vi.fn(),
  recover: vi.fn(),
  run: vi.fn(),
}));
vi.mock("../../packages/core/src/receipts", () => ({
  recoverExport: mocks.recover,
}));
vi.mock("electron", () => ({
  app: { isPackaged: false, getVersion: () => "1.0.0" },
  shell: { openExternal: vi.fn() },
  dialog: {},
}));
vi.mock("node:fs/promises", async (original) => ({
  ...(await original<typeof import("node:fs/promises")>()),
  readFile: async () =>
    JSON.stringify({
      schemaVersion: 1,
      sdkVersion: "1.0.0-rc.1",
      runtime: "electron",
      productCode: "PC",
      productName: "Precut",
      appId: "com.t2etech.precut",
      oauthClientId: "00000000-0000-4000-8000-000000000000",
      licenseApiOrigin: "https://licence.precut.test",
      licenseIssuer: "https://licence.precut.test",
      licenseJwks: {
        keys: [
          {
            kty: "OKP",
            crv: "Ed25519",
            kid: "test-key",
            x: "A".repeat(43),
            alg: "EdDSA",
            use: "sig",
          },
        ],
      },
      jwksMode: "store-keyring",
      trialEnabled: true,
      supabaseUrl: "https://auth.precut.test",
      oauthRedirectUri: "com.t2etech.precut://oauth/callback",
      installerPublishers: { macTeamIds: [], windowsSpkiSha256: [] },
    }),
}));
vi.mock("@t2e/license-sdk", () => ({
  createLicenseSDKFromConfig: mocks.create,
}));
vi.mock("@t2e/license-sdk/electron", () => ({
  ElectronSdkStorage: class {
    load = mocks.storageLoad;
    save = mocks.storageSave;
    dispose = mocks.dispose;
  },
  downloadInstaller: vi.fn(),
  verifyInstallerSignature: vi.fn(),
  openVerifiedInstaller: vi.fn(),
}));
vi.mock("../../apps/desktop/electron/oauth-callback", () => ({
  bindPrecutOAuth: mocks.bind,
}));
import { Licensing } from "../../apps/desktop/electron/license";
import { shell } from "electron";
const callback = `com.t2etech.precut://oauth/callback?code=test-code&state=${"s".repeat(43)}`;
const status = {
  valid: true,
  tier: "FREE",
  signedIn: true,
  activated: false,
  permanentOffline: false,
  requiresOnline: true,
  quota: { export: { remaining: 3 } },
  pendingOperations: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.bind.mockReturnValue(mocks.unbind);
  mocks.storageLoad.mockResolvedValue(null);
  mocks.complete.mockResolvedValue({ signedIn: true, activated: false });
  mocks.access.mockResolvedValue(status);
  mocks.recover.mockResolvedValue("FAILED");
  mocks.run.mockImplementation(async (_input, engine) => engine());
  mocks.create.mockImplementation((_config, options) => ({
    initialize: async () => {},
    completeLogin: async (url: string) => {
      const result = await mocks.complete(url);
      await options.storage.save({
        version: 1,
        productCode: "PC",
        license: null,
        pending: [],
        oauth: {
          accessToken: "test-session",
          refreshToken: "test-refresh",
          expiresAt: Date.now() + 3600000,
        },
      });
      return result;
    },
    getAccess: mocks.access,
    login: mocks.login,
    dispose: mocks.dispose,
    runWithAccess: mocks.run,
  }));
});
describe("Precut account status notification", () => {
  it("uses the Store page for unsigned updates without calling the SDK signed installer flow", async () => {
    const licensing = new Licensing(
      "/tmp/unused-precut-test",
      "/tmp/unused-projects",
    );
    await licensing.initialize("product.config.json");
    expect(await licensing.checkUpdates()).toEqual({
      manual: true,
      hasUpdate: false,
      version: "1.0.0",
    });
    expect(await licensing.installUpdate()).toEqual({
      opened: true,
      manual: true,
    });
    expect(shell.openExternal).toHaveBeenCalledExactlyOnceWith(
      "https://licence.precut.test/products/precut",
    );
    await licensing.dispose();
  });
  it("binds before initialization, sends the verified status and handles duplicate callback delivery once", async () => {
    const changed = vi.fn();
    const licensing = new Licensing(
      "/tmp/unused-precut-test",
      "/tmp/unused-projects",
      changed,
    );
    expect(mocks.bind).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
    await licensing.initialize("product.config.json");
    const result = await licensing.completeLogin(callback);
    expect(result).toMatchObject({
      signedIn: true,
      activated: false,
      remaining: 3,
    });
    expect(changed).toHaveBeenLastCalledWith(result);
    expect(changed.mock.calls[0][0].loginPhase).toBe("completing");
    await licensing.completeLogin(callback);
    expect(mocks.complete).toHaveBeenCalledExactlyOnceWith(callback);
    await licensing.dispose();
    expect(mocks.unbind).toHaveBeenCalledOnce();
  });
  it("does not announce success or expose upstream errors after SDK rejection", async () => {
    const changed = vi.fn();
    const licensing = new Licensing(
      "/tmp/unused-precut-test",
      "/tmp/unused-projects",
      changed,
    );
    await licensing.initialize("product.config.json");
    mocks.complete.mockRejectedValue(new Error("upstream-secret-code"));
    await expect(licensing.completeLogin(callback)).rejects.toThrow(
      "Start Sign in again",
    );
    expect(changed).toHaveBeenCalledTimes(2);
    expect(changed.mock.calls[1][0]).toMatchObject({
      signedIn: false,
      loginPhase: "error",
    });
    await licensing.dispose();
  });
  it("shares concurrent completion for the same callback, rejects a competing link and blocks restarting mid-exchange", async () => {
    let finish!: () => void;
    mocks.complete.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const licensing = new Licensing(
      "/tmp/unused-precut-test",
      "/tmp/unused-projects",
    );
    await licensing.initialize("product.config.json");
    const first = licensing.completeLogin(callback),
      second = licensing.completeLogin(callback);
    await expect(
      licensing.completeLogin(callback.replace("test-code", "different")),
    ).rejects.toThrow("Please wait");
    await expect(licensing.login()).rejects.toThrow("Please wait");
    finish();
    await Promise.all([first, second]);
    expect(mocks.complete).toHaveBeenCalledOnce();
    await licensing.dispose();
  });
});

describe("durable account display independent of export authorization", () => {
  const stored = {
    version: 1,
    productCode: "PC",
    license: null,
    pending: [],
    oauth: {
      accessToken: "stored-session",
      refreshToken: "stored-refresh",
      expiresAt: Date.now() + 3600000,
    },
  };
  it("restores a connection on cold launch without making a network access request", async () => {
    mocks.storageLoad.mockResolvedValue(stored);
    const licensing = new Licensing("/tmp/unused", "/tmp/projects");
    await licensing.initialize("product.config.json");
    expect(await licensing.status(false)).toMatchObject({
      signedIn: true,
      valid: false,
      tier: "UNCHECKED",
      verification: "unchecked",
    });
    expect(mocks.access).not.toHaveBeenCalled();
    await licensing.dispose();
  });
  it("retains the connection and unknown quota after a network failure, and never grants access", async () => {
    mocks.storageLoad.mockResolvedValue(stored);
    mocks.access.mockRejectedValue(new Error("private-upstream-body"));
    const licensing = new Licensing("/tmp/unused", "/tmp/projects");
    await licensing.initialize("product.config.json");
    const result = await licensing.status();
    expect(result).toMatchObject({
      signedIn: true,
      valid: false,
      activated: false,
      verification: "unavailable",
    });
    expect(result.remaining).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("private-upstream-body");
    expect(await licensing.status(false)).toMatchObject({
      signedIn: true,
      valid: false,
    });
    await licensing.dispose();
  });
  it("reports a successful token exchange even if subsequent purchase activation fails", async () => {
    mocks.create.mockImplementation((_config, options) => ({
      initialize: async () => {},
      completeLogin: async () => {
        await options.storage.save(stored);
        throw Object.assign(new Error("private-activation-body"), {
          code: "LICENSE_NETWORK_ERROR",
        });
      },
      getAccess: mocks.access,
      dispose: mocks.dispose,
    }));
    const changed = vi.fn(),
      licensing = new Licensing("/tmp/unused", "/tmp/projects", changed);
    await licensing.initialize("product.config.json");
    const result = await licensing.completeLogin(callback);
    expect(result).toMatchObject({
      signedIn: true,
      activated: false,
      loginPhase: "complete",
      loginError: "ACTIVATION_PENDING",
    });
    expect(changed).toHaveBeenLastCalledWith(result);
    expect(JSON.stringify(result)).not.toContain("stored-session");
    await licensing.dispose();
  });
  it("does not mistake an existing connection for success when a different login fails", async () => {
    mocks.storageLoad.mockResolvedValue(stored);
    mocks.complete.mockRejectedValue(
      Object.assign(new Error("private-callback"), {
        code: "OAUTH_CALLBACK_INVALID",
      }),
    );
    const licensing = new Licensing("/tmp/unused", "/tmp/projects");
    await licensing.initialize("product.config.json");
    await expect(licensing.completeLogin(callback)).rejects.toThrow(
      "Start Sign in again",
    );
    expect(await licensing.status(false)).toMatchObject({
      signedIn: true,
      valid: false,
      loginPhase: "error",
    });
    await licensing.dispose();
  });
  it("restores a pending browser request after restart", async () => {
    mocks.storageLoad.mockResolvedValue({
      ...stored,
      oauth: undefined,
      authorization: {
        state: "s".repeat(43),
        verifier: "v".repeat(43),
        expiresAt: Date.now() + 600000,
      },
    });
    const licensing = new Licensing("/tmp/unused", "/tmp/projects");
    await licensing.initialize("product.config.json");
    expect(await licensing.status(false)).toMatchObject({
      signedIn: false,
      loginPhase: "waiting",
    });
    await licensing.dispose();
  });
});

it("waits for secure-storage startup instead of briefly reporting missing configuration", async () => {
  const licensing = new Licensing("/tmp/unused", "/tmp/projects");
  const pending = licensing.status(false);
  let settled = false;
  void pending.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  await licensing.initialize("product.config.json");
  expect(await pending).toMatchObject({
    mode: "configured",
    verification: "unchecked",
  });
  await licensing.dispose();
});

it("reports a proven startup failure and lets the next export retry through the SDK", async () => {
  const licensing = new Licensing("/tmp/unused", "/tmp/projects");
  await licensing.initialize("product.config.json");
  const error = new Error("EPERM: receipt fsync"),
    engine = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ path: "output.mp4" });
  const projectId = crypto.randomUUID();
  await expect(
    licensing.run(crypto.randomUUID(), projectId, engine),
  ).rejects.toBe(error);
  await expect(
    licensing.run(crypto.randomUUID(), projectId, engine),
  ).resolves.toEqual({ path: "output.mp4" });
  expect(mocks.run).toHaveBeenCalledTimes(2);
  expect(engine).toHaveBeenCalledTimes(2);
  await licensing.dispose();
});

it("keeps ambiguous work reserved and blocks even cached status without queuing another SDK request", async () => {
  mocks.recover.mockResolvedValue("UNKNOWN");
  const licensing = new Licensing("/tmp/unused", "/tmp/projects");
  await licensing.initialize("product.config.json");
  await licensing.status();
  const engine = vi.fn().mockRejectedValue(new Error("Worker crashed"));
  await expect(
    licensing.run(crypto.randomUUID(), crypto.randomUUID(), engine),
  ).rejects.toThrow("trial reservation has been retained");
  expect(await licensing.status(false)).toMatchObject({
    valid: false,
    pendingOperations: 1,
  });
  expect(await licensing.status()).toMatchObject({
    valid: false,
    pendingOperations: 1,
  });
  await expect(
    licensing.run(crypto.randomUUID(), crypto.randomUUID(), engine),
  ).rejects.toThrow("trial reservation has been retained");
  expect(engine).toHaveBeenCalledOnce();
  expect(mocks.run).toHaveBeenCalledOnce();
  expect(mocks.access).toHaveBeenCalledOnce();
  await licensing.dispose();
});
