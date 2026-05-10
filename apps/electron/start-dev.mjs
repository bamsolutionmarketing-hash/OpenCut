#!/usr/bin/env node
/**
 * Boots `apps/web` in Next dev mode and launches Electron pointing at it.
 * Kills both children on exit. No external deps — uses node child_process only.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_WEB_DIR = join(__dirname, "..", "web");
const ELECTRON_BIN = join(__dirname, "node_modules", ".bin", "electron");

const PORT = Number(process.env.OPENCUT_PORT ?? 3000);
const URL = `http://localhost:${PORT}`;

const children = [];

function spawnChild(name, cmd, args, opts) {
	const child = spawn(cmd, args, {
		stdio: "inherit",
		shell: process.platform === "win32",
		...opts,
	});
	child.on("exit", (code) => {
		console.log(`[${name}] exited with code ${code}`);
	});
	children.push(child);
	return child;
}

function killAll() {
	for (const child of children) {
		if (!child.killed) {
			child.kill("SIGTERM");
		}
	}
}

process.on("SIGINT", () => {
	killAll();
	process.exit(0);
});
process.on("SIGTERM", () => {
	killAll();
	process.exit(0);
});

async function waitForServer({ url, timeoutMs = 60_000 }) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok || res.status === 404) return;
		} catch {
			// Not ready yet.
		}
		await wait(500);
	}
	throw new Error(`Next dev server did not respond at ${url} within ${timeoutMs}ms`);
}

async function main() {
	console.log("→ starting Next dev server in apps/web …");
	spawnChild("next", "bun", ["run", "dev"], {
		cwd: REPO_WEB_DIR,
		env: { ...process.env, PORT: String(PORT) },
	});

	console.log(`→ waiting for ${URL} …`);
	await waitForServer({ url: URL });

	console.log("→ launching Electron …");
	spawnChild("electron", ELECTRON_BIN, ["."], {
		cwd: __dirname,
		env: {
			...process.env,
			OPENCUT_DEV: "1",
			OPENCUT_DEV_URL: URL,
		},
	});
}

main().catch((err) => {
	console.error(err);
	killAll();
	process.exit(1);
});
