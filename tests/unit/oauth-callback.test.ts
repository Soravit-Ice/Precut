import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PrecutOAuthCallbackSchema,
  schemas,
} from "../../packages/shared/src/contracts";
const mock = vi.hoisted(() => ({ whenReady: vi.fn() }));
const events = new EventEmitter();
vi.mock("electron", () => ({
  app: {
    on: (...args: Parameters<typeof events.on>) => events.on(...args),
    removeListener: (...args: Parameters<typeof events.removeListener>) =>
      events.removeListener(...args),
    whenReady: mock.whenReady,
  },
}));
import { bindPrecutOAuth } from "../../apps/desktop/electron/oauth-callback";
const callback = `com.t2etech.precut://oauth/callback?code=one-use-code&state=${"s".repeat(43)}`;
beforeEach(() => {
  events.removeAllListeners();
  mock.whenReady.mockResolvedValue(undefined);
});
describe("desktop callback lifecycle", () => {
  it("queues a cold-launch callback before initialization and consumes duplicate OS delivery once", async () => {
    let ready!: () => void;
    const initialized = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const complete = vi.fn().mockResolvedValue({ signedIn: true });
    const cleanup = bindPrecutOAuth(initialized, complete, vi.fn());
    const event = { preventDefault: vi.fn() };
    events.emit("open-url", event, callback);
    events.emit("second-instance", {}, ["electron", callback]);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    ready();
    await vi.waitFor(() =>
      expect(complete).toHaveBeenCalledExactlyOnceWith(callback),
    );
    cleanup();
    expect(events.listenerCount("open-url")).toBe(0);
  });
  it("ignores foreign and malformed callbacks and stops queued callbacks after disposal", async () => {
    const complete = vi.fn(),
      failed = vi.fn();
    const cleanup = bindPrecutOAuth(Promise.resolve(), complete, failed);
    events.emit(
      "open-url",
      { preventDefault: vi.fn() },
      callback.replace("precut", "other"),
    );
    events.emit("second-instance", {}, [
      callback.replace("s".repeat(43), "bad"),
    ]);
    events.emit("open-url", { preventDefault: vi.fn() }, callback);
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(complete).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });
  it("reports SDK rejection without emitting callback contents", async () => {
    const failed = vi.fn();
    const cleanup = bindPrecutOAuth(
      Promise.resolve(),
      vi.fn().mockRejectedValue(new Error("private-code")),
      failed,
    );
    events.emit("second-instance", {}, [callback]);
    await vi.waitFor(() => expect(failed).toHaveBeenCalledExactlyOnceWith());
    cleanup();
  });
});
describe("manual return-link IPC boundary", () => {
  it("accepts an exact callback and rejects duplicates, fragments, credentials and other apps", () => {
    expect(
      schemas["license.completeLogin"].parse({ callbackUrl: ` ${callback} ` })
        .callbackUrl,
    ).toBe(callback);
    for (const value of [
      callback + "#fragment",
      callback + "&code=two",
      callback + "&state=duplicate",
      callback.replace("precut", "other"),
      callback.replace("//oauth", "//user@oauth"),
      "https://store.t2etech.com/oauth/consent",
      callback.replace("/callback?", "/callback/evil?"),
    ])
      expect(PrecutOAuthCallbackSchema.safeParse(value).success).toBe(false);
    expect(
      schemas["license.completeLogin"].safeParse({
        callbackUrl: callback,
        token: "not-allowed",
      }).success,
    ).toBe(false);
  });
});
