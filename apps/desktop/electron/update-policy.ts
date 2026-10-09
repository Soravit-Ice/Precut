export function usesStoreUpdates(
  publishers: { macTeamIds: string[]; windowsSpkiSha256: string[] },
  platform: string,
) {
  return platform === "darwin"
    ? publishers.macTeamIds.length === 0
    : platform === "win32"
      ? publishers.windowsSpkiSha256.length === 0
      : true;
}

export function precutStoreUrl(origin: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("The Store origin must be a plain HTTPS origin.");
  return new URL("/products/precut", url).href;
}
