import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductSdkConfigSchema } from "@t2e/license-sdk/contracts";

export async function checkRelease(
  directory = process.cwd(),
  environment = process.env,
) {
  const pkg = JSON.parse(
    await readFile(resolve(directory, "package.json"), "utf8"),
  );
  const config = ProductSdkConfigSchema.parse(
    JSON.parse(
      await readFile(resolve(directory, "product.config.json"), "utf8"),
    ),
  );
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version))
    throw new Error("Use a stable version such as 1.0.0 for Store releases.");
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
  if (
    environment.GITHUB_REF &&
    environment.GITHUB_REF !== `refs/tags/v${pkg.version}`
  )
    throw new Error("The GitHub tag must match package.json: v" + pkg.version);
  return {
    version: pkg.version,
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
