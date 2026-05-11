import { readCache, writeCache } from "./tts-cache";
import type { TtsResult } from "./types";
import type { SubtitleCue } from "@/subtitles/types";
import type {
	TtsWorkerMessage,
	TtsWorkerResponse,
} from "./workers/tts.worker";

export const DEFAULT_TTS_MODEL_ID = "Xenova/mms-tts-vie";

export interface TtsProgress {
	stage: "loading-model" | "synthesizing";
	current: number;
	total: number;
	message?: string;
}

export interface CreateTtsSessionOptions {
	modelId?: string;
	onProgress?: (progress: TtsProgress) => void;
	signal?: AbortSignal;
}

export interface TtsSession {
	synthesize(text: string): Promise<TtsResult>;
	dispose(): void;
}

interface PendingRequest {
	resolve: (result: TtsResult) => void;
	reject: (error: Error) => void;
}

export async function createTtsSession({
	modelId = DEFAULT_TTS_MODEL_ID,
	onProgress,
	signal,
}: CreateTtsSessionOptions = {}): Promise<TtsSession> {
	const worker = new Worker(
		new URL("./workers/tts.worker.ts", import.meta.url),
		{ type: "module" },
	);

	const pending = new Map<string, PendingRequest>();
	let nextId = 0;
	let disposed = false;

	const messageHandler = (event: MessageEvent<TtsWorkerResponse>) => {
		const response = event.data;
		if (response.type === "synthesize-complete") {
			const req = pending.get(response.id);
			if (!req) return;
			pending.delete(response.id);
			const durationSec = response.pcm.length / response.sampleRate;
			req.resolve({
				pcm: response.pcm,
				sampleRate: response.sampleRate,
				durationSec,
			});
		} else if (response.type === "synthesize-error") {
			const req = pending.get(response.id);
			if (!req) return;
			pending.delete(response.id);
			req.reject(new Error(response.error));
		}
	};
	worker.addEventListener("message", messageHandler);

	const onAbort = () => {
		const msg: TtsWorkerMessage = { type: "cancel" };
		worker.postMessage(msg);
	};
	signal?.addEventListener("abort", onAbort);

	// ── init ────────────────────────────────────────────────────────────────
	await new Promise<void>((resolve, reject) => {
		const initHandler = (event: MessageEvent<TtsWorkerResponse>) => {
			const response = event.data;
			if (response.type === "init-progress") {
				onProgress?.({
					stage: "loading-model",
					current: response.progress,
					total: 100,
					message: "Loading Vietnamese TTS model...",
				});
			} else if (response.type === "init-complete") {
				worker.removeEventListener("message", initHandler);
				resolve();
			} else if (response.type === "init-error") {
				worker.removeEventListener("message", initHandler);
				reject(new Error(response.error));
			}
		};
		worker.addEventListener("message", initHandler);
		const msg: TtsWorkerMessage = { type: "init", modelId };
		worker.postMessage(msg);
	});

	async function synthesize(text: string): Promise<TtsResult> {
		if (disposed) throw new Error("TtsSession is disposed");

		const cached = await readCache({ text });
		if (cached) {
			return {
				pcm: cached.pcm,
				sampleRate: cached.sampleRate,
				durationSec: cached.pcm.length / cached.sampleRate,
			};
		}

		const id = `s${nextId++}`;
		const result = await new Promise<TtsResult>((resolve, reject) => {
			pending.set(id, { resolve, reject });
			const msg: TtsWorkerMessage = { type: "synthesize", id, text };
			worker.postMessage(msg);
		});

		// IDB needs a copy because the worker transferred the buffer.
		await writeCache({
			text,
			entry: {
				pcm: new Float32Array(result.pcm),
				sampleRate: result.sampleRate,
			},
		});

		return result;
	}

	function dispose() {
		if (disposed) return;
		disposed = true;
		signal?.removeEventListener("abort", onAbort);
		worker.removeEventListener("message", messageHandler);
		worker.terminate();
		for (const req of pending.values()) {
			req.reject(new Error("TtsSession disposed"));
		}
		pending.clear();
	}

	return { synthesize, dispose };
}

export async function synthesizeAll({
	cues,
	session,
	onProgress,
	signal,
}: {
	cues: Pick<SubtitleCue, "text">[];
	session: TtsSession;
	onProgress?: (progress: TtsProgress) => void;
	signal?: AbortSignal;
}): Promise<TtsResult[]> {
	const out: TtsResult[] = [];
	for (let i = 0; i < cues.length; i++) {
		if (signal?.aborted) throw new Error("aborted");
		const result = await session.synthesize(cues[i]!.text);
		out.push(result);
		onProgress?.({
			stage: "synthesizing",
			current: i + 1,
			total: cues.length,
		});
	}
	return out;
}
