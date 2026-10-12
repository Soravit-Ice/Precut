import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm, readdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { resolve, join } from "node:path";

// Versioned upstream URLs with reviewed archive pins. Never download latest.
const whisper = {
  url: "https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.5.tar.gz",
  sha256: "ff1a9053feb509ff9d7729703355541ae9690073a6b1c40eb692c962e0dc1720",
};
const sources = {
  "darwin-x64": [
    {
      name: "ffmpeg",
      url: "https://github.com/Soravit-Ice/Precut/releases/download/native-darwin-x64-9.0.2/ffmpeg-9.0.2.zip",
      fallbackUrls: [
        "https://evermeet.cx/ffmpeg/ffmpeg-9.0.2.zip",
        "https://web.archive.org/web/20260924075450id_/https://evermeet.cx/ffmpeg/ffmpeg-9.0.2.zip",
      ],
      sha256:
        "4acc0be580f9b2788029eb7bd4d645ff87968911b0a62aeeb3940d42d54558d5",
    },
    {
      name: "ffprobe",
      url: "https://github.com/Soravit-Ice/Precut/releases/download/native-darwin-x64-9.0.2/ffprobe-9.0.2.zip",
      fallbackUrls: [
        "https://evermeet.cx/ffmpeg/ffprobe-9.0.2.zip",
        "https://web.archive.org/web/20260924075448id_/https://evermeet.cx/ffmpeg/ffprobe-9.0.2.zip",
      ],
      sha256:
        "24a9c968cd4da72d99c7245e914b921815835eb6dff01d99868031aebaf1d439",
    },
  ],
  "win32-x64": [
    {
      name: "ffmpeg",
      url: "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip",
      sha256:
        "60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba",
    },
  ],
};
const target = `${process.platform}-${process.arch}`;
if (!sources[target])
  throw new Error(
    "Bootstrap supports native Mac Intel and Windows x64 runners only",
  );
const tools = resolve(".tools/release-native");
await mkdir(tools, { recursive: true });
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function download(source, path, retries = 3) {
  if (existsSync(path) && (await sha256(path)) === source.sha256) return;
  const partial = path + ".partial";
  await rm(partial, { force: true });
  const urls = [source.url, ...(source.fallbackUrls || [])].filter(Boolean);
  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const url of urls) {
      try {
        console.log(
          `Fetching ${source.name || "archive"} from ${url} (attempt ${attempt}/${retries})...`,
        );
        const response = await fetch(url, {
          signal: AbortSignal.timeout(600_000),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            Accept: "*/*",
          },
        });
        if (response.status === 429) {
          console.warn(
            `Server rate limit (HTTP 429) encountered for ${url}. Trying next mirror...`,
          );
          continue;
        }
        if (response.status >= 500) {
          console.warn(
            `Server error (HTTP ${response.status}) for ${url}. Trying next mirror...`,
          );
          continue;
        }
        if (
          !response.ok ||
          new URL(response.url).protocol !== "https:" ||
          !response.body
        ) {
          console.warn(
            `Download failed: HTTP ${response.status} (${response.statusText}) from ${url}. Trying next mirror...`,
          );
          continue;
        }
        await pipeline(
          Readable.fromWeb(response.body),
          createWriteStream(partial),
        );
        if ((await sha256(partial)) !== source.sha256) {
          await rm(partial, { force: true });
          console.warn(
            `Pinned native archive checksum mismatch for ${url}. Trying next mirror...`,
          );
          continue;
        }
        await rename(partial, path);
        console.log(`Successfully verified ${source.name || path}`);
        return;
      } catch (error) {
        console.warn(`Download error for ${url}: ${error.message}`);
      }
    }
    if (attempt < retries) {
      const delay = Math.min(5 * attempt, 20);
      console.log(`Waiting ${delay}s before retrying candidate mirrors...`);
      await new Promise((r) => setTimeout(r, delay * 1000));
    }
  }
  throw new Error(
    `Failed to download verified ${source.name || path} from all available sources after ${retries} attempts`,
  );
}
const media = join(tools, "media");
await rm(media, { recursive: true, force: true });
await mkdir(media, { recursive: true });
for (let i = 0; i < sources[target].length; i++) {
  const source = sources[target][i];
  const archive = join(tools, `${source.name}.zip`);
  await download(source, archive);
  execFileSync("tar", ["-xf", archive, "-C", media], { stdio: "inherit" });
}
const archive = resolve(".tools/whisper.tar.gz");
await download(whisper, archive);
const source = join(tools, "whisper.cpp-1.9.5");
await rm(source, { recursive: true, force: true });
execFileSync("tar", ["-xf", archive, "-C", tools], { stdio: "inherit" });
const build = join(tools, "whisper-build");
await rm(build, { recursive: true, force: true });
const buildEnv = {
  ...process.env,
  PRECUT_WHISPER_SOURCE: source,
  PRECUT_WHISPER_BUILD: build,
  PRECUT_SPEECH_BUILD_ONLY: "1",
};
execFileSync(process.execPath, ["scripts/build-speech-native.mjs"], {
  stdio: "inherit",
  env: buildEnv,
});
const ext = process.platform === "win32" ? ".exe" : "";
const mediaBin =
  process.platform === "win32"
    ? join(
        media,
        (await readdir(media)).find(
          (name) => name === "ffmpeg-9.0.2-essentials_build",
        ),
        "bin",
      )
    : media;
const inputs = {
  ffmpeg: join(mediaBin, `ffmpeg${ext}`),
  ffprobe: join(mediaBin, `ffprobe${ext}`),
};
for (const name of ["whisper-cli", "whisper-vad-speech-segments"]) {
  const direct = join(build, "bin", name + ext);
  inputs[name] = existsSync(direct)
    ? direct
    : join(build, "bin", "Release", name + ext);
}
const buildconf = execFileSync(inputs.ffmpeg, ["-buildconf"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
if (buildconf.includes("--enable-nonfree"))
  throw new Error("Non-redistributable FFmpeg build rejected");
execFileSync(process.execPath, ["scripts/prepare-native.mjs"], {
  stdio: "inherit",
  env: {
    ...buildEnv,
    PRECUT_NATIVE_INPUTS: JSON.stringify(inputs),
    PRECUT_NATIVE_SOURCES: JSON.stringify({ media: sources[target], whisper }),
  },
});
