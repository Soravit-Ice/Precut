import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductSdkConfigSchema } from "@t2e/license-sdk/contracts";
import { checkReleaseRef } from "./check-release-ref.mjs";

export async function checkRelease(
  directory = process.cwd(),
  environment = process.env,
) {
  const { version } = await checkReleaseRef(directory, environment);
  const pkg = JSON.parse(
    await readFile(resolve(directory, "package.json"), "utf8"),
  );
  const config = ProductSdkConfigSchema.parse(
    JSON.parse(
      await readFile(resolve(directory, "product.config.json"), "utf8"),
    ),
  );
  if (
    pkg.build.appId !== "com.t2etech.precut" ||
    config.appId !== pkg.build.appId ||
    config.productCode !== "PC" ||
    config.runtime !== "electron"
  )
    throw new Error("Precut product identity mismatch.");
  if (
    config.licenseApiOrigin !== "https://store.t2etech.com" ||
    config.oauthRedirectUri !== "com.t2etech.precut://oauth/callback" ||
    !config.oauthClientId ||
    !config.supabaseUrl
  )
    throw new Error("Supply the production Store-exported PC configuration.");
  if (environment.PRECUT_DEV_EXPORT || environment.PRECUT_TEST_DATA)
    throw new Error(
      "Remove development/test overrides before a release build.",
    );
  return {
    version,
    productCode: config.productCode,
    appId: config.appId,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkRelease();
  console.log(JSON.stringify(result)); // Public identity only; never serialize config or credentials.
}
