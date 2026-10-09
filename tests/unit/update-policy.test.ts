import { describe, expect, it } from "vitest";
import {
  usesStoreUpdates,
  precutStoreUrl,
} from "../../apps/desktop/electron/update-policy";
describe("unsigned release updates", () => {
  it("uses manual Store updates when this platform has no publisher pin", () => {
    const publishers = { macTeamIds: [], windowsSpkiSha256: ["a".repeat(64)] };
    expect(usesStoreUpdates(publishers, "darwin")).toBe(true);
    expect(usesStoreUpdates(publishers, "win32")).toBe(false);
    expect(
      usesStoreUpdates(
        { macTeamIds: ["ABCDE12345"], windowsSpkiSha256: [] },
        "darwin",
      ),
    ).toBe(false);
    expect(
      usesStoreUpdates({ macTeamIds: [], windowsSpkiSha256: [] }, "win32"),
    ).toBe(true);
  });
  it("opens only the product page under the configured HTTPS Store origin", () => {
    expect(precutStoreUrl("https://store.t2etech.com")).toBe(
      "https://store.t2etech.com/products/precut",
    );
    for (const origin of [
      "http://store.t2etech.com",
      "https://user:secret@store.t2etech.com",
      "https://store.t2etech.com/other",
      "https://store.t2etech.com?redirect=other",
    ])
      expect(() => precutStoreUrl(origin)).toThrow();
  });
});
