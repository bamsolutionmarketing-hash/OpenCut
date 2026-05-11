import { app, BrowserWindow, shell, Menu } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DEV_URL = process.env.OPENCUT_DEV_URL ?? "http://localhost:3000";
const LANDING_PATH = process.env.OPENCUT_LANDING_PATH ?? "/projects";
const IS_DEV = process.env.OPENCUT_DEV === "1" || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;

function startBundledNextServer(): Promise<string> {
	return new Promise((resolve, reject) => {
		const standaloneDir = join(process.resourcesPath, "web");
		const serverEntry = join(standaloneDir, "apps", "web", "server.js");
		if (!existsSync(serverEntry)) {
			reject(
				new Error(
					`Bundled Next.js server not found at ${serverEntry}. Did you run 'bun run build:web' before packaging?`,
				),
			);
			return;
		}

		const port = String(3000 + Math.floor(Math.random() * 1000));
		nextServer = spawn(process.execPath, [serverEntry], {
			cwd: standaloneDir,
			env: {
				...process.env,
				PORT: port,
				HOSTNAME: "127.0.0.1",
				NODE_ENV: "production",
				ELECTRON_RUN_AS_NODE: "1",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		const url = `http://127.0.0.1:${port}`;
		let resolved = false;

		const onData = (chunk: Buffer) => {
			const text = chunk.toString();
			process.stdout.write(`[next] ${text}`);
			if (!resolved && /ready|started server|listening/i.test(text)) {
				resolved = true;
				resolve(url);
			}
		};

		nextServer.stdout?.on("data", onData);
		nextServer.stderr?.on("data", (chunk) => {
			process.stderr.write(`[next-err] ${chunk.toString()}`);
		});
		nextServer.on("exit", (code) => {
			if (!resolved) reject(new Error(`Next server exited early with code ${code}`));
		});

		// Fallback: assume ready after 8s if Next never logs the ready line.
		setTimeout(() => {
			if (!resolved) {
				resolved = true;
				resolve(url);
			}
		}, 8000);
	});
}

async function resolveAppUrl(): Promise<string> {
	if (IS_DEV) return DEV_URL;
	return await startBundledNextServer();
}

function createWindow(url: string) {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 960,
		minHeight: 600,
		title: "OpenCut",
		backgroundColor: "#000000",
		autoHideMenuBar: true,
		webPreferences: {
			preload: join(__dirname, "preload.js"),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
		},
	});

	const target = `${url.replace(/\/$/, "")}${LANDING_PATH}`;
	mainWindow.loadURL(target).catch((err) => {
		console.error("Failed to load URL", target, err);
	});

	// External links open in the user's default browser.
	mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
		shell.openExternal(openUrl);
		return { action: "deny" };
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

function buildMenu() {
	const isMac = process.platform === "darwin";
	Menu.setApplicationMenu(
		Menu.buildFromTemplate([
			...(isMac
				? [
						{
							label: app.name,
							submenu: [
								{ role: "about" as const },
								{ type: "separator" as const },
								{ role: "services" as const },
								{ type: "separator" as const },
								{ role: "hide" as const },
								{ role: "hideOthers" as const },
								{ role: "unhide" as const },
								{ type: "separator" as const },
								{ role: "quit" as const },
							],
						},
					]
				: []),
			{
				label: "View",
				submenu: [
					{ role: "reload" },
					{ role: "forceReload" },
					{ role: "toggleDevTools" },
					{ type: "separator" },
					{ role: "resetZoom" },
					{ role: "zoomIn" },
					{ role: "zoomOut" },
					{ type: "separator" },
					{ role: "togglefullscreen" },
				],
			},
			{
				label: "Window",
				submenu: [{ role: "minimize" }, { role: "close" }],
			},
		]),
	);
}

app.whenReady().then(async () => {
	buildMenu();
	try {
		const url = await resolveAppUrl();
		createWindow(url);
	} catch (err) {
		console.error("Startup failed:", err);
		app.exit(1);
	}

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
			resolveAppUrl().then(createWindow).catch((err) => console.error(err));
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
	if (nextServer && !nextServer.killed) {
		nextServer.kill("SIGTERM");
	}
});
