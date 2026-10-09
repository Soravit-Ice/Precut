import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  utilityProcess,
  shell,
  nativeTheme,
} from "electron";
import { join, resolve, extname, basename, dirname } from "node:path";
import { existsSync, createReadStream, mkdirSync } from "node:fs";
import {
  readFile,
  stat,
  copyFile,
  mkdir,
  rm,
  readdir,
  link,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  schemas,
  type Method,
  type Snapshot,
  type Job,
  type AppEvent,
  type Settings,
  type Model,
  type MediaAsset,
  type ExportOptions,
  type CleanupOptions,
} from "../../../packages/shared/src/contracts";
import { databaseBridge } from "./bridge";
import { Licensing } from "./license";
import { folderSize } from "./directory-size";
import { stopOrphanedSidecars } from "../../../packages/media/src/recovery";
import { terminate } from "../../../packages/media/src/process";
import { fingerprint, probe } from "../../../packages/media/src/probe";
import { modelDefinitions, type EngineTask } from "./engine";
// Keep the existing Keychain service identity stable when moving from the
// development runner to Precut.app. The OS bundle and UI still display Precut.
app.setName("@t2e/precut");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "precut-media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);
const appRoot = resolve(__dirname, "..");
const explicitUserData = app.commandLine.getSwitchValue("user-data-dir");
const dataRoot =
  process.env.PRECUT_TEST_DATA && !app.isPackaged
    ? resolve(process.env.PRECUT_TEST_DATA)
    : explicitUserData
      ? resolve(explicitUserData)
      : join(app.getPath("appData"), "com.t2etech.precut");
mkdirSync(dataRoot, { recursive: true });
app.setPath("userData", dataRoot);
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();
const resources = app.isPackaged ? process.resourcesPath : appRoot;
const nativeRoot = app.isPackaged
  ? join(resources, "native")
  : join(appRoot, "native", `${process.platform}-${process.arch}`);
const bundledModels = app.isPackaged
  ? join(resources, "models")
  : join(appRoot, "native", "models");
const modelsRoot = join(dataRoot, "models"),
  projectsRoot = join(dataRoot, "projects"),
  fontsRoot = app.isPackaged
    ? join(resources, "fonts")
    : join(appRoot, "apps", "desktop", "public", "fonts");
let db: ReturnType<typeof databaseBridge>;
const licensing = new Licensing(dataRoot, projectsRoot, (status) => {
  if (window && !window.isDestroyed()) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
  emit({ type: "license", status, source: "signin" });
});
const assets = new Map<string, MediaAsset>();
const jobs = new Map<string, Job>();
const active = new Map<
  string,
  { worker: Electron.UtilityProcess; pids: Set<number>; cancel: () => void }
>();
const cancelledJobs = new Set<string>();
const exportRequests = new Set<string>();
let window: BrowserWindow | undefined,
  quitting = false;
function emit(event: AppEvent) {
  if (window && !window.isDestroyed())
    window.webContents.send("precut:event", event);
}
async function snapshot(id: string) {
  const snap = await db.call<Snapshot>("projects.open", { id });
  for (const asset of snap.assets) assets.set(asset.id, asset);
  return snap;
}
async function record(job: Job) {
  jobs.set(job.id, { ...job });
  await db.call("jobs.put", { job });
  emit({ type: "job", job: { ...job } });
}
async function ensureModels() {
  await mkdir(modelsRoot, { recursive: true });
  let bundled: { file: string; id: string }[] = [];
  try {
    bundled = JSON.parse(
      await readFile(join(bundledModels, "manifest.json"), "utf8"),
    );
  } catch {
    return;
  }
  for (const model of bundled) {
    const output = join(modelsRoot, model.file);
    if (!existsSync(output)) {
      await mkdir(dirname(output), { recursive: true });
      await copyFile(join(bundledModels, model.file), output);
    }
  }
  if (!existsSync(join(modelsRoot, "manifest.json")))
    await copyFile(
      join(bundledModels, "manifest.json"),
      join(modelsRoot, "manifest.json"),
    );
}
async function taskFor(
  job: Job,
  extra: Partial<EngineTask>,
): Promise<EngineTask> {
  return {
    id: job.id,
    projectId: job.projectId,
    type: job.type,
    nativeRoot,
    modelsRoot,
    fontsRoot,
    projectRoot: join(projectsRoot, job.projectId),
    settings: await db.call<Settings>("settings.get"),
    ...extra,
  };
}
async function launch(job: Job, task: EngineTask) {
  await record(job);
  if (cancelledJobs.delete(job.id)) {
    job.state = "cancelled";
    job.error = "Cancelled";
    await record(job);
    throw new Error("Cancelled");
  }
  return new Promise<Record<string, unknown>>((resolveJob, reject) => {
    const worker = utilityProcess.fork(join(__dirname, "engine.cjs"), [], {
      serviceName: `Precut ${job.type}`,
    });
    const pids = new Set<number>();
    let completed = false,
      lastProgress = 0;
    const finish = async (error?: Error, result?: Record<string, unknown>) => {
      if (completed) return;
      completed = true;
      active.delete(job.id);
      job.durationMs = Date.now() - job.startedAt;
      job.state = error
        ? job.state === "cancelled"
          ? "cancelled"
          : "failed"
        : "completed";
      job.error = error?.message;
      job.progress = error ? job.progress : 1;
      job.output = result?.path as string | undefined;
      if (error && job.type === "analyze")
        await db
          .call("analysis.abort", { projectId: job.projectId, runId: job.id })
          .catch(() => {});
      await record(job);
      emit({ type: "project", projectId: job.projectId });
      worker.kill();
      if (error) reject(error);
      else resolveJob(result ?? {});
    };
    active.set(job.id, {
      worker,
      pids,
      cancel: () => {
        job.state = "cancelled";
        worker.postMessage({ type: "cancel" });
        for (const pid of pids) terminate(pid);
        setTimeout(() => {
          if (!completed) void finish(new Error("Cancelled"));
        }, 4000).unref();
      },
    });
    worker.on(
      "message",
      async (message: {
        type: string;
        pid?: number;
        stage?: string;
        progress?: number;
        requestId?: string;
        method?: string;
        args?: unknown;
        result?: Record<string, unknown>;
        error?: string;
        cancelled?: boolean;
      }) => {
        try {
          if (completed) return;
          if (message.type === "spawn") {
            if (message.pid! > 0) pids.add(message.pid!);
            else pids.delete(-message.pid!);
          } else if (message.type === "progress") {
            job.stage = message.stage!;
            job.progress = message.progress!;
            if (Date.now() - lastProgress > 200) {
              lastProgress = Date.now();
              await record(job);
            }
          } else if (message.type === "db") {
            try {
              const result =
                message.method === "waveform.ready"
                  ? true
                  : await db.call(message.method!, message.args);
              worker.postMessage({
                type: "db-reply",
                requestId: message.requestId,
                result,
              });
              if (message.method?.startsWith("assets."))
                await snapshot(job.projectId);
              emit({ type: "project", projectId: job.projectId });
            } catch (e) {
              worker.postMessage({
                type: "db-reply",
                requestId: message.requestId,
                error: e instanceof Error ? e.message : "Project update failed",
              });
            }
          } else if (message.type === "complete")
            await finish(undefined, message.result);
          else if (message.type === "failed") {
            if (message.cancelled) job.state = "cancelled";
            await finish(new Error(message.error ?? "Processing failed"));
          }
        } catch (e) {
          await finish(e instanceof Error ? e : new Error("Worker failed"));
        }
      },
    );
    worker.on("exit", () => {
      for (const pid of pids) terminate(pid);
      if (!completed)
        void finish(
          new Error(
            "A background worker stopped. Your saved project is safe. Retry the operation.",
          ),
        );
    });
    worker.postMessage({ type: "run", task });
  });
}
function newJob(projectId: string, type: Job["type"]): Job {
  return {
    id: randomUUID(),
    projectId,
    type,
    state: "running",
    stage: "Starting",
    progress: 0,
    startedAt: Date.now(),
  };
}
function processing(projectId: string) {
  return [...jobs.values()].some(
    (j) =>
      j.projectId === projectId && j.state === "running" && j.type !== "proxy",
  );
}
async function importFile(projectId: string, path: string, external = false) {
  if (processing(projectId))
    throw new Error("Wait for the current operation or cancel it first.");
  if (
    ![
      ".mp4",
      ".mov",
      ".mkv",
      ".m4a",
      ".wav",
      ".mp3",
      ".webm",
      ".flac",
    ].includes(extname(path).toLowerCase())
  )
    throw new Error("Choose an MP4, MOV, MKV, M4A, WAV or MP3 file.");
  const info = await stat(path);
  if (!info.isFile()) throw new Error("Choose a media file.");
  const job = newJob(projectId, "import");
  const task = await taskFor(job, { path: resolve(path), external });
  void launch(job, task)
    .then(async () => {
      const snap = await snapshot(projectId);
      if (
        !external &&
        snap.assets[0]?.hasVideo &&
        (snap.assets[0].codec !== "h264" || snap.assets[0].vfr)
      ) {
        const proxy = newJob(projectId, "proxy");
        void launch(proxy, await taskFor(proxy, { snapshot: snap })).catch(
          () => {},
        );
      }
    })
    .catch(() => {});
  return job;
}
const requestSchema = z
  .object({ method: z.string(), input: z.unknown() })
  .strict();
async function handle(
  method: Method,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method) {
    case "projects.open":
      return snapshot(input.id as string);
    case "projects.create":
      return db.call(method, input);
    case "projects.list":
    case "projects.rename":
    case "settings.get":
      return db.call(method, input);
    case "settings.update":
      nativeTheme.themeSource = input.theme as "light" | "dark" | "system";
      return db.call(method, input);
    case "media.choose": {
      const result = await dialog.showOpenDialog(window!, {
        title: input.external ? "Choose external audio" : "Choose raw footage",
        properties: ["openFile"],
        filters: [
          {
            name: "Video and audio",
            extensions: [
              "mp4",
              "mov",
              "mkv",
              "m4a",
              "wav",
              "mp3",
              "webm",
              "flac",
            ],
          },
        ],
      });
      return result.canceled
        ? null
        : importFile(
            input.projectId as string,
            result.filePaths[0],
            input.external as boolean,
          );
    }
    case "media.import":
      return importFile(
        input.projectId as string,
        input.path as string,
        input.external as boolean,
      );
    case "media.relink": {
      const snap = await snapshot(input.projectId as string),
        asset = snap.assets.find((a) => a.id === input.assetId);
      if (!asset) throw new Error("Media asset not found.");
      const result = await dialog.showOpenDialog(window!, {
        title: `Locate ${asset.name}`,
        properties: ["openFile"],
      });
      if (result.canceled) return snap;
      const path = result.filePaths[0];
      const replacement = await probe(
        path,
        snap.project.id,
        nativeRoot,
        new AbortController().signal,
      );
      if (
        replacement.fingerprint !== asset.fingerprint ||
        Math.abs(replacement.durationUs - asset.durationUs) > 100000
      )
        throw new Error(
          "This file does not match the original fingerprint and duration. Choose the original recording.",
        );
      const updated = { ...asset, path, missing: false };
      await db.call("assets.update", {
        projectId: snap.project.id,
        asset: updated,
      });
      assets.set(updated.id, updated);
      emit({ type: "project", projectId: snap.project.id });
      return snapshot(snap.project.id);
    }
    case "media.offset":
    case "projects.speech":
    case "edits.decide":
    case "edits.safe":
    case "edits.manual":
    case "edits.trim":
    case "edits.undo":
    case "edits.redo":
    case "captions.style":
    case "captions.correct": {
      const result = await db.call(method, input);
      emit({ type: "project", projectId: input.projectId as string });
      return result;
    }
    case "jobs.analyze": {
      const id = input.projectId as string;
      if (processing(id))
        throw new Error(
          "An operation is already running. Cancel it before starting another.",
        );
      const snap = await snapshot(id),
        job = newJob(id, "analyze");
      void launch(
        job,
        await taskFor(job, {
          snapshot: snap,
          options: input.options as CleanupOptions,
          speech: input.speech as EngineTask["speech"],
          force: input.force as boolean,
          autoApplySilence: input.autoApplySilence as boolean,
          reassessKeptSilence: input.reassessKeptSilence as boolean,
        }),
      ).catch(() => {});
      return job;
    }
    case "jobs.list":
      return [...jobs.values()];
    case "jobs.cancel": {
      const id = input.id as string,
        job = jobs.get(id);
      if (!job || !["running", "queued"].includes(job.state))
        return { cancelled: false };
      const task = active.get(id);
      if (task) task.cancel();
      else {
        cancelledJobs.add(id);
        job.state = "cancelled";
        await record(job);
      }
      return { cancelled: true };
    }
    case "exports.start": {
      const options = input as unknown as ExportOptions;
      if (exportRequests.has(options.projectId))
        throw new Error("An export request is already open.");
      exportRequests.add(options.projectId);
      try {
        const snap = await snapshot(options.projectId);
        if (!snap.assets.length || snap.assets[0].missing)
          throw new Error("Locate the original source before exporting.");
        if (options.format === "srt" && !snap.words.length)
          throw new Error("Analyze speech before exporting subtitles.");
        if (processing(options.projectId))
          throw new Error("Wait for the current operation or cancel it first.");
        const extension =
          options.format === "mp4"
            ? "mp4"
            : options.format === "srt"
              ? "srt"
              : options.format === "final-cut"
                ? "fcpxml"
                : "xml";
        const result = await dialog.showSaveDialog(window!, {
          title: "Export your clean first cut",
          defaultPath: `${snap.project.name.replace(/[^\p{L}\p{N} _-]/gu, "")}.${extension}`,
          filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
        });
        if (result.canceled || !result.filePath) return null;
        const output = result.filePath.endsWith(`.${extension}`)
          ? result.filePath
          : `${result.filePath}.${extension}`;
        const job = newJob(options.projectId, "export"),
          task = await taskFor(job, {
            snapshot: snap,
            exportOptions: options,
            output,
          });
        await db.call("export.journal", {
          projectId: options.projectId,
          id: job.id,
          state: "prepared",
          output,
        });
        await record(job);
        void licensing
          .run(job.id, options.projectId, () => launch(job, task))
          .then(async (result) => {
            if (job.state !== "completed" && result.path) {
              job.state = "completed";
              job.output = result.path as string;
              job.error = undefined;
              job.stage = "Export recovered";
              job.progress = 1;
              await record(job);
            }
            emit({ type: "license", status: await licensing.status() });
            await db.call("export.journal", {
              projectId: options.projectId,
              id: job.id,
              state: "completed",
              output,
            });
          })
          .catch(async (error) => {
            if (job.state !== "cancelled") job.state = "failed";
            job.error =
              error instanceof Error ? error.message : "Licence check failed";
            await record(job);
            emit({ type: "license", status: await licensing.status() });
          });
        return job;
      } finally {
        exportRequests.delete(options.projectId);
      }
    }
    case "exports.reveal": {
      const job = jobs.get(input.jobId as string);
      if (job?.state !== "completed" || !job.output)
        throw new Error("This export is not complete.");
      shell.showItemInFolder(job.output);
      return true;
    }
    case "license.status":
      return licensing.status(input.check as boolean);
    case "license.login":
      return licensing.login();
    case "license.completeLogin":
      return licensing.completeLogin(input.callbackUrl as string);
    case "license.activate":
      return licensing.activate(input.key as string | undefined);
    case "license.deactivate":
      return licensing.deactivate();
    case "license.logout":
      return licensing.logout();
    case "license.checkUpdates":
      return licensing.checkUpdates();
    case "license.installUpdate":
      return licensing.installUpdate();
    case "models.list":
      return modelDefinitions.map((m) => ({
        ...m,
        installed: existsSync(join(modelsRoot, m.file)),
      }));
    case "models.download": {
      if (
        [...jobs.values()].some(
          (j) => j.type === "model" && j.state === "running",
        )
      )
        throw new Error("A model is already downloading.");
      const job = newJob(randomUUID(), "model");
      void launch(
        job,
        await taskFor(job, { modelId: input.id as Model["id"] }),
      ).catch(() => {});
      return job;
    }
    case "models.delete": {
      if ([...jobs.values()].some((j) => j.state === "running"))
        throw new Error(
          "Wait for processing to finish before deleting a model.",
        );
      const model = modelDefinitions.find((m) => m.id === input.id)!;
      await rm(
        input.id === "semantic"
          ? join(modelsRoot, "semantic")
          : join(modelsRoot, model.file),
        { recursive: input.id === "semantic", force: true },
      );
      const settings = await db.call<Settings>("settings.get");
      if (settings.speechQuality === input.id)
        await db.call("settings.update", {
          ...settings,
          speechQuality: "fast",
        });
      return true;
    }
    case "storage.info":
      return { path: dataRoot, size: await folderSize(dataRoot) };
    case "storage.clear": {
      if (
        [...jobs.values()].some(
          (j) => j.projectId === input.projectId && j.state === "running",
        )
      )
        throw new Error("Cancel processing before clearing cache.");
      for (const name of ["audio", "analysis", "transcript"])
        await rm(join(projectsRoot, input.projectId as string, name), {
          recursive: true,
          force: true,
        });
      return true;
    }
    case "diagnostics.export": {
      const result = await dialog.showSaveDialog(window!, {
        defaultPath: "Precut-diagnostics.json",
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(
        result.filePath,
        JSON.stringify(
          {
            version: app.getVersion(),
            platform: process.platform,
            arch: process.arch,
            jobs: [...jobs.values()].map((j) => ({
              type: j.type,
              state: j.state,
              stage: j.stage,
              durationMs: j.durationMs,
              error: j.error ? "PROCESSING_FAILED" : undefined,
            })),
            licence: (await licensing.status()).mode,
          },
          null,
          2,
        ),
      );
      return true;
    }
  }
}
async function createWindow() {
  window = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    title: "Precut",
    icon: join(__dirname, "renderer", "brand", "precut-app-icon.png"),
    backgroundColor: "#ffffff",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 17, y: 18 },
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_c, _p, callback) =>
    callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.once("ready-to-show", () => window?.show());
  let refreshing = false;
  let refreshedAt = 0;
  const refreshLicence = async () => {
    if (refreshing || Date.now() - refreshedAt < 15_000) return;
    if ((await licensing.status(false)).loginPhase === "completing") return;
    refreshing = true;
    refreshedAt = Date.now();
    try {
      emit({
        type: "license",
        status: await licensing.status(),
        source: "refresh",
      });
    } finally {
      refreshing = false;
    }
  };
  window.on("focus", () => void refreshLicence());
  window.webContents.once("did-finish-load", () => void refreshLicence());
  if (!app.isPackaged && process.platform === "darwin")
    app.dock?.setIcon(
      join(__dirname, "renderer", "brand", "precut-app-icon.png"),
    );
  if (!app.isPackaged && process.env.PRECUT_RENDERER_URL)
    await window.loadURL(process.env.PRECUT_RENDERER_URL);
  else await window.loadFile(join(__dirname, "renderer", "index.html"));
}
if (primary) {
  void app
    .whenReady()
    .then(async () => {
      db = databaseBridge(__dirname, dataRoot);
      await ensureModels();
      await stopOrphanedSidecars(projectsRoot, nativeRoot);
      await db.call("recovery");
      for (const job of await db.call<Job[]>("jobs.list"))
        jobs.set(job.id, job);
      protocol.handle("precut-media", async (request) => {
        try {
          const url = new URL(request.url),
            asset = assets.get(url.pathname.slice(1));
          if (!asset) return new Response("Not found", { status: 404 });
          const kind = url.searchParams.get("kind");
          const path =
            kind === "proxy"
              ? asset.proxyPath
              : kind === "thumbnail"
                ? asset.thumbnailPath
                : asset.path;
          if (!path) return new Response("Not found", { status: 404 });
          const info = await stat(path);
          const mime =
            kind === "thumbnail"
              ? "image/jpeg"
              : ((
                  {
                    ".mp4": "video/mp4",
                    ".mov": "video/quicktime",
                    ".mkv": "video/x-matroska",
                    ".webm": "video/webm",
                    ".wav": "audio/wav",
                    ".mp3": "audio/mpeg",
                    ".m4a": "audio/mp4",
                    ".flac": "audio/flac",
                  } as Record<string, string>
                )[extname(path).toLowerCase()] ?? "application/octet-stream");
          const range = request.headers.get("range");
          let start = 0,
            end = info.size - 1;
          if (range) {
            const match = /^bytes=(\d+)-(\d*)$/.exec(range);
            if (!match) return new Response(null, { status: 416 });
            start = Number(match[1]);
            end = match[2] ? Math.min(Number(match[2]), end) : end;
            if (start > end)
              return new Response(null, {
                status: 416,
                headers: { "Content-Range": `bytes */${info.size}` },
              });
          }
          const { Readable } = await import("node:stream");
          return new Response(
            Readable.toWeb(
              createReadStream(path, { start, end }),
            ) as ReadableStream,
            {
              status: range ? 206 : 200,
              headers: {
                "Content-Type": mime,
                "Accept-Ranges": "bytes",
                "Content-Length": String(end - start + 1),
                ...(range
                  ? { "Content-Range": `bytes ${start}-${end}/${info.size}` }
                  : {}),
              },
            },
          );
        } catch {
          return new Response("Media unavailable", { status: 404 });
        }
      });
      ipcMain.handle("precut:call", async (event, payload: unknown) => {
        if (
          !window ||
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame
        )
          throw new Error("Untrusted frame");
        const request = requestSchema.parse(payload);
        if (!(request.method in schemas))
          throw new Error("Unsupported operation");
        const method = request.method as Method;
        const input = schemas[method].parse(request.input);
        return handle(method, input as Record<string, unknown>);
      });
      await createWindow();
      await licensing.initialize(join(appRoot, "product.config.json"));
      app.on("activate", () => {
        if (!window || window.isDestroyed()) void createWindow();
      });
    })
    .catch((error) => {
      console.error(
        "PRECUT_START_FAILED",
        error instanceof Error ? error.message : "Initialization failed",
      );
      app.quit();
    });
}
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  for (const job of active.values()) job.cancel();
  void Promise.race([
    licensing.dispose(),
    new Promise((res) => setTimeout(res, 3000)),
  ]).finally(() => {
    db?.dispose();
    app.quit();
  });
});
