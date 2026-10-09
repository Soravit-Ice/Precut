import { app, shell, dialog } from "electron";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  createLicenseSDKFromConfig,
  type LicenseSdk,
  type LicenseSdkState,
} from "@t2e/license-sdk";
import { ProductSdkConfigSchema } from "@t2e/license-sdk/contracts";
import {
  ElectronSdkStorage,
  downloadInstaller,
  verifyInstallerSignature,
  openVerifiedInstaller,
} from "@t2e/license-sdk/electron";
import { recoverExport } from "../../../packages/core/src/receipts";
import type { LicenseStatus } from "../../../packages/shared/src/contracts";
import { bindPrecutOAuth } from "./oauth-callback";
import { usesStoreUpdates, precutStoreUrl } from "./update-policy";
import {
  oauthDiagnosticFetch,
  safeSignInError,
  type OAuthFailure,
} from "./oauth-diagnostics";
export class Licensing {
  private sdk?: LicenseSdk;
  private heldOperation?: string;
  private lastStatus?: LicenseStatus;
  private recoveryMessage =
    "An export has an uncertain result. Restore its export destination and restart Precut to reconcile it. The trial reservation has been retained.";
  private available() {
    if (this.heldOperation) throw new Error(this.recoveryMessage);
  }
  private config?: ReturnType<typeof ProductSdkConfigSchema.parse>;
  private fault?: string;
  private sessionPresent = false;
  private sessionDigest?: string;
  private sessionRevision = 0;
  private authorizationExpiresAt?: number;
  private loginPhase: NonNullable<LicenseStatus["loginPhase"]> = "idle";
  private loginError?: string;
  private oauthFailure?: OAuthFailure;
  private automaticReturn = false;
  private configurationError?: LicenseStatus["configurationError"];
  // Observe only successfully loaded/saved OS-encrypted SDK state in the main
  // process. These display fields never authorize exports or expose credentials.
  private observeState(state: LicenseSdkState | null) {
    const digest = state?.oauth
      ? createHash("sha256").update(state.oauth.accessToken).digest("hex")
      : undefined;
    if (digest !== this.sessionDigest) this.sessionRevision++;
    this.sessionDigest = digest;
    this.sessionPresent = Boolean(state?.oauth);
    this.authorizationExpiresAt = state?.authorization?.expiresAt;
  }
  private display(): Pick<
    LicenseStatus,
    "signedIn" | "loginPhase" | "loginError" | "automaticReturn"
  > {
    return {
      signedIn: this.sessionPresent,
      loginPhase:
        this.loginPhase === "idle" && this.authorizationExpiresAt
          ? this.authorizationExpiresAt > Date.now()
            ? "waiting"
            : "error"
          : this.loginPhase,
      loginError:
        this.loginError ??
        (this.loginPhase === "idle" &&
        this.authorizationExpiresAt &&
        this.authorizationExpiresAt <= Date.now()
          ? "OAUTH_REQUEST_EXPIRED"
          : undefined),
      automaticReturn: this.automaticReturn,
    };
  }
  private unbind?: () => void;
  private finishInitialization!: () => void;
  private initialized = new Promise<void>((resolve) => {
    this.finishInitialization = resolve;
  });
  private completing?: Promise<LicenseStatus>;
  private completingCallback?: string;
  private completedCallback?: string;
  private update?: { id: string; sha256: string };
  constructor(
    private root: string,
    private projectRoot: string,
    private onStatus: (status: LicenseStatus) => void = () => {},
  ) {
    this.unbind = bindPrecutOAuth(
      this.initialized,
      (url) => this.completeLogin(url),
      () => {
        if (this.loginPhase === "error") return;
        this.loginPhase = "error";
        this.loginError = "OAUTH_SIGNIN_FAILED";
        void this.status(false).then((status) => this.onStatus(status));
      },
    );
  }
  async initialize(configFile: string) {
    let encrypted: ElectronSdkStorage | undefined;
    try {
      const raw = await readFile(configFile, "utf8");
      const config = ProductSdkConfigSchema.parse(JSON.parse(raw));
      if (config.productCode !== "PC" || config.appId !== "com.t2etech.precut")
        throw new Error("Configuration belongs to another product");
      if (config.oauthRedirectUri !== "com.t2etech.precut://oauth/callback")
        throw new Error("Precut requires its exact OAuth callback.");
      this.config = config;
      encrypted = new ElectronSdkStorage(
        join(this.root, "license-sdk.enc"),
        "PC",
      );
      this.observeState(await encrypted.load());
      const storage = encrypted;
      this.sdk = createLicenseSDKFromConfig(config, {
        fetch: oauthDiagnosticFetch(config.supabaseUrl!, (failure) => {
          this.oauthFailure = failure;
        }),
        storage: {
          load: async () => {
            const state = await storage.load();
            this.observeState(state);
            return state;
          },
          save: async (state) => {
            await storage.save(state);
            this.observeState(state);
          },
          dispose: () => storage.dispose(),
        },
        openExternal: (url) => shell.openExternal(url),
        platform: process.platform === "darwin" ? "MACOS" : "WINDOWS",
        architecture: process.arch === "arm64" ? "ARM64" : "X64",
        recoverOperation: async (operation) =>
          operation.recovery?.projectId
            ? recoverExport(
                this.projectRoot,
                operation.operationId,
                operation.recovery.projectId,
              )
            : "UNKNOWN",
      });
      this.automaticReturn =
        app.isPackaged && app.setAsDefaultProtocolClient("com.t2etech.precut");
      void this.sdk.initialize().catch(() => {
        this.fault =
          "Licence recovery needs attention. Open Licence settings when ready; your projects remain available.";
      });
    } catch (error) {
      if (!this.sdk) await encrypted?.dispose();
      const code = (error as { code?: string }).code;
      this.configurationError =
        code === "ENOENT"
          ? "MISSING_CONFIG"
          : code === "SDK_STORAGE_IN_USE" ||
              code === "DEVICE_STORAGE_INVALID" ||
              code === "SECURE_STORAGE_UNAVAILABLE"
            ? code
            : "SDK_CONFIG_INVALID";
      this.fault =
        this.configurationError === "DEVICE_STORAGE_INVALID"
          ? "The encrypted licence storage cannot be opened by this app. It has been preserved."
          : this.configurationError === "SDK_STORAGE_IN_USE"
            ? "Close the other Precut session, then restart this app."
            : "Licence configuration or encrypted storage needs attention. Your projects remain available.";
      console.warn("PRECUT_LICENSE_UNAVAILABLE", this.configurationError);
    } finally {
      this.finishInitialization();
    }
  }
  private get development() {
    return (
      !app.isPackaged &&
      process.env.PRECUT_DEV_EXPORT === "1" &&
      !this.sdk &&
      !this.fault
    );
  }
  async status(check = true): Promise<LicenseStatus> {
    await this.initialized;
    if (this.sdk && !check)
      return {
        ...(this.lastStatus ?? {
          mode: "configured",
          tier: "UNCHECKED",
          valid: false,
          signedIn: false,
          activated: false,
          permanentOffline: false,
          requiresOnline: false,
          pendingOperations: 0,
          reason: "Licence will be checked at export.",
          verification: "unchecked",
        }),
        ...this.display(),
      };
    if (this.heldOperation)
      return {
        ...(this.lastStatus ?? {
          mode: "configured",
          tier: "NONE",
          signedIn: false,
          activated: false,
          permanentOffline: false,
          requiresOnline: true,
        }),
        valid: false,
        pendingOperations: 1,
        reason: this.recoveryMessage,
        ...this.display(),
      };
    if (!this.sdk)
      return {
        mode: this.development ? "development" : "pending-config",
        valid: this.development,
        tier: this.development ? "DEVELOPMENT" : "NONE",
        activated: false,
        permanentOffline: false,
        requiresOnline: !this.development,
        reason:
          this.fault ?? "Precut product configuration has not been supplied.",
        pendingOperations: 0,
        configurationError: this.configurationError,
        ...this.display(),
      };
    try {
      const status = await this.sdk.getAccess();
      return (this.lastStatus = {
        mode: "configured",
        valid: status.valid,
        tier: status.tier,
        activated: status.activated,
        permanentOffline: status.permanentOffline,
        requiresOnline: status.requiresOnline,
        remaining: status.quota.export?.remaining,
        reason: status.reason,
        pendingOperations: status.pendingOperations,
        verification:
          status.reason && status.reason !== "TRIAL_DISABLED"
            ? "unavailable"
            : "verified",
        ...this.display(),
      });
    } catch {
      return (this.lastStatus = {
        mode: "configured",
        valid: false,
        tier: "UNCHECKED",
        activated: false,
        permanentOffline: false,
        requiresOnline: true,
        reason: "Licence could not be checked. Retry when connected.",
        pendingOperations: 0,
        verification: "unavailable",
        ...this.display(),
      });
    }
  }
  async run<T>(
    operationId: string,
    projectId: string,
    engine: () => Promise<T>,
  ) {
    this.available();
    if (this.sdk)
      return new Promise<T>((resolveResult, rejectResult) => {
        void this.sdk!.runWithAccess(
          { feature: "export", operationId, recovery: { projectId } },
          async () => {
            try {
              return await engine();
            } catch (error) {
              const outcome = await recoverExport(
                this.projectRoot,
                operationId,
                projectId,
              );
              if (outcome === "FAILED") throw error;
              if (outcome === "SUCCEEDED") {
                const receipt = JSON.parse(
                  await readFile(
                    join(
                      this.projectRoot,
                      projectId,
                      "export-cache",
                      `${operationId}.receipt.json`,
                    ),
                    "utf8",
                  ),
                ) as { artifacts: { path: string }[] };
                return {
                  path: receipt.artifacts[0].path,
                  recovered: true,
                } as T;
              }
              // SDK rc.1 treats a rejected engine callback as a definite failure. Keep RUNNING
              // durable until restart reconciliation instead of releasing an ambiguous export.
              this.heldOperation = operationId;
              rejectResult(new Error(this.recoveryMessage));
              return await new Promise<T>(() => {});
            }
          },
        ).then(resolveResult, rejectResult);
      });
    if (this.development) return engine();
    throw new Error(
      this.fault ??
        "Add the Precut product.config.json before enabling production exports. Projects and edits remain available.",
    );
  }
  async login() {
    this.available();
    if (!this.sdk)
      throw new Error("Precut account login needs the product configuration.");
    if (this.completing) throw new Error("Sign-in is finishing. Please wait.");
    this.completedCallback = undefined;
    this.fault = undefined;
    this.loginError = undefined;
    this.oauthFailure = undefined;
    await this.sdk.login();
    this.loginPhase = "waiting";
    return this.status(false);
  }
  async completeLogin(callbackUrl: string): Promise<LicenseStatus> {
    this.available();
    if (!this.sdk)
      throw new Error("Account login needs the Precut product configuration.");
    const digest = createHash("sha256").update(callbackUrl).digest("hex");
    if (digest === this.completedCallback) return this.status();
    if (this.completing) {
      if (this.completingCallback !== digest)
        throw new Error("Another sign-in is finishing. Please wait.");
      return this.completing;
    }
    this.completingCallback = digest;
    const sessionBefore = this.sessionRevision;
    this.completing = (async () => {
      this.loginPhase = "completing";
      this.loginError = undefined;
      this.oauthFailure = undefined;
      this.onStatus(await this.status(false));
      try {
        await this.sdk!.completeLogin(callbackUrl);
        this.completedCallback = digest;
        this.fault = undefined;
        this.loginPhase = "complete";
        const status = await this.status();
        this.onStatus(status);
        return status;
      } catch (error) {
        // Never send a callback, authorization code or upstream response to the UI/logs.
        const code = (error as { code?: string }).code;
        if (this.sessionPresent && this.sessionRevision > sessionBefore) {
          // rc.1 can finish token exchange and then reject purchase activation.
          // Report the persisted account connection separately from its licence.
          this.completedCallback = digest;
          this.loginPhase = "complete";
          this.loginError = "ACTIVATION_PENDING";
          const status = await this.status();
          this.onStatus(status);
          return status;
        }
        this.loginPhase = "error";
        this.loginError = safeSignInError(error, this.oauthFailure);
        console.warn("PRECUT_SIGNIN_FAILED", this.loginError);
        this.onStatus(await this.status(false));
        throw new Error(
          code === "OAUTH_ACCESS_DENIED"
            ? "Sign-in was cancelled. Start a new sign-in when ready."
            : "Sign-in could not finish. Start Sign in again and use the new return link from that request.",
        );
      } finally {
        this.completing = undefined;
        this.completingCallback = undefined;
      }
    })();
    return this.completing;
  }
  async activate(key?: string) {
    this.available();
    if (!this.sdk)
      throw new Error("Activation needs the Precut product configuration.");
    if (key) await this.sdk.activate(key);
    else await this.sdk.activate();
    return this.status();
  }
  async deactivate() {
    this.available();
    if (this.sdk) await this.sdk.deactivate();
    return this.status();
  }
  async logout() {
    this.available();
    if (this.sdk) await this.sdk.logout();
    this.loginPhase = "idle";
    this.loginError = undefined;
    return this.status();
  }
  async checkUpdates() {
    this.available();
    if (!this.sdk)
      throw new Error(
        "Updates are available after the Precut store integration is configured.",
      );
    // Unsigned distribution uses the Store's download/install flow. The SDK's
    // signed installer path remains intact for products with pinned publishers.
    if (
      this.config &&
      usesStoreUpdates(this.config.installerPublishers, process.platform)
    ) {
      this.update = undefined;
      return { manual: true, hasUpdate: false, version: app.getVersion() };
    }
    const result = await this.sdk.checkForUpdates(app.getVersion());
    this.update = result.hasUpdate ? result.artifacts[0] : undefined;
    return {
      hasUpdate: Boolean(this.update),
      version: result.version,
      releaseNotes: result.releaseNotes,
    };
  }
  async installUpdate() {
    this.available();
    if (
      this.sdk &&
      this.config &&
      usesStoreUpdates(this.config.installerPublishers, process.platform)
    ) {
      await shell.openExternal(precutStoreUrl(this.config.licenseApiOrigin));
      return { opened: true, manual: true };
    }
    if (!this.sdk || !this.config || !this.update)
      throw new Error("Check for updates first.");
    const auth = await this.sdk.authorizeDownload(this.update.id);
    const path = await downloadInstaller(auth, join(this.root, "updates"), {
      platform: process.platform === "darwin" ? "MACOS" : "WINDOWS",
      architecture: process.arch === "arm64" ? "ARM64" : "X64",
    });
    await verifyInstallerSignature(path, this.config.installerPublishers);
    const choice = await dialog.showMessageBox({
      type: "question",
      message: "Open the verified Precut update installer?",
      buttons: ["Cancel", "Install update"],
      defaultId: 0,
      cancelId: 0,
    });
    if (choice.response === 1)
      await openVerifiedInstaller(
        path,
        this.config.installerPublishers,
        this.update.sha256,
      );
    return { opened: choice.response === 1 };
  }
  async dispose() {
    this.unbind?.();
    await this.sdk?.dispose();
  }
}
