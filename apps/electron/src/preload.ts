import { contextBridge } from "electron";

// Minimal preload — OpenCut runs entirely in the renderer with no IPC needs
// today. Expose a tiny marker so the web app can detect the desktop shell.
contextBridge.exposeInMainWorld("opencutDesktop", {
	platform: process.platform,
	version: "0.1.0",
});
