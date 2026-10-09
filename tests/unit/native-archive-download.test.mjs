import { describe, it, expect, vi } from "vitest";
import { fetchNativeArchive } from "../../scripts/fetch-native-bundle.mjs";
describe("private native build input", () => {
  it("sends the repo token only to the exact GitHub asset API and strips it on the signed download", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://release-assets.githubusercontent.com/native.zip?signature=fixture",
          },
        }),
      )
      .mockResolvedValueOnce(new Response("archive"));
    await fetchNativeArchive(
      "https://api.github.com/repos/Soravit-Ice/Precut/releases/assets/123",
      "fixture-token",
      fetcher,
    );
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe(
      "Bearer fixture-token",
    );
    expect(fetcher.mock.calls[1][1]).toEqual({ redirect: "error" });
  });
  it("rejects an unexpected asset redirect and other repository API paths", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "https://untrusted.example/native.zip" },
        }),
      );
    await expect(
      fetchNativeArchive(
        "https://api.github.com/repos/Soravit-Ice/Precut/releases/assets/123",
        "fixture-token",
        fetcher,
      ),
    ).rejects.toThrow("Unexpected");
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher.mockClear();
    await expect(
      fetchNativeArchive(
        "https://api.github.com/repos/Other/App/releases/assets/123",
        "fixture-token",
        fetcher,
      ),
    ).rejects.toThrow("Precut");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not send a GitHub token to public HTTPS storage", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("archive"));
    await fetchNativeArchive(
      "https://media.example/native.zip",
      "fixture-token",
      fetcher,
    );
    expect(fetcher.mock.calls[0][1]).toEqual({ redirect: "error" });
  });
});
