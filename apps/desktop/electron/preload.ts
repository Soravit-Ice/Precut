import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  AppEvent,
  PrecutAPI,
} from "../../../packages/shared/src/contracts";
const api: PrecutAPI = {
  call: (method, input = {}) =>
    ipcRenderer.invoke("precut:call", { method, input }),
  importDropped: (projectId, file) =>
    ipcRenderer.invoke("precut:call", {
      method: "media.import",
      input: {
        projectId,
        path: webUtils.getPathForFile(file),
        external: false,
      },
    }),
  onEvent: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, event: AppEvent) =>
      callback(event);
    ipcRenderer.on("precut:event", handler);
    return () => ipcRenderer.removeListener("precut:event", handler);
  },
  platform: process.platform as PrecutAPI["platform"],
};
if (process.isMainFrame) contextBridge.exposeInMainWorld("precut", api);
