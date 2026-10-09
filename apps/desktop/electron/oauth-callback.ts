import { app } from "electron";
import { createHash } from "node:crypto";
import { PrecutOAuthCallbackSchema } from "../../../packages/shared/src/contracts";

// Bind before app readiness so a cold launch does not lose macOS open-url.
// The SDK remains responsible for matching the saved state and exchanging PKCE.
export function bindPrecutOAuth(
  ready: Promise<void>,
  complete: (url: string) => Promise<unknown>,
  failed: () => void,
) {
  let disposed = false;
  let lastDigest: string | undefined;
  const receive = (value: string) => {
    if (!PrecutOAuthCallbackSchema.safeParse(value).success) return;
    const digest = createHash("sha256").update(value).digest("hex");
    if (digest === lastDigest) return;
    lastDigest = digest;
    void Promise.all([app.whenReady(), ready])
      .then(() => !disposed && complete(value))
      .catch(() => {
        if (!disposed) failed();
      });
  };
  const opened = (event: Electron.Event, value: string) => {
    if (!value.startsWith("com.t2etech.precut:")) return;
    event.preventDefault();
    receive(value);
  };
  const second = (_event: Electron.Event, argv: string[]) => {
    const value = argv.find((argument) =>
      argument.startsWith("com.t2etech.precut:"),
    );
    if (value) receive(value);
  };
  app.on("open-url", opened);
  app.on("second-instance", second);
  const initial = process.argv.find((value) =>
    value.startsWith("com.t2etech.precut:"),
  );
  if (initial) receive(initial);
  return () => {
    disposed = true;
    app.removeListener("open-url", opened);
    app.removeListener("second-instance", second);
  };
}
