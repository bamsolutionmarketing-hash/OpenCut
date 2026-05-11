/// <reference lib="webworker" />
import {
	pipeline,
	type TextToAudioPipeline,
} from "@huggingface/transformers";

export type TtsWorkerMessage =
	| { type: "init"; modelId: string }
	| { type: "synthesize"; id: string; text: string }
	| { type: "cancel" };

export type TtsWorkerResponse =
	| { type: "init-progress"; progress: number }
	| { type: "init-complete" }
	| { type: "init-error"; error: string }
	| {
			type: "synthesize-complete";
			id: string;
			pcm: Float32Array;
			sampleRate: number;
	  }
	| { type: "synthesize-error"; id: string; error: string }
	| { type: "cancelled" };

let synth: TextToAudioPipeline | null = null;
let cancelled = false;
let lastReportedProgress = -1;
const fileBytes = new Map<string, { loaded: number; total: number }>();

function post(message: TtsWorkerResponse, transfer?: Transferable[]) {
	if (transfer && transfer.length) {
		(self as unknown as Worker).postMessage(message, transfer);
	} else {
		self.postMessage(message);
	}
}

self.onmessage = async (event: MessageEvent<TtsWorkerMessage>) => {
	const message = event.data;
	switch (message.type) {
		case "init":
			await handleInit({ modelId: message.modelId });
			break;
		case "synthesize":
			await handleSynthesize({ id: message.id, text: message.text });
			break;
		case "cancel":
			cancelled = true;
			post({ type: "cancelled" });
			break;
	}
};

async function handleInit({ modelId }: { modelId: string }) {
	lastReportedProgress = -1;
	fileBytes.clear();

	try {
		synth = (await pipeline("text-to-speech", modelId, {
			dtype: "fp32",
			device: "auto",
			progress_callback: (info: {
				status?: string;
				file?: string;
				loaded?: number;
				total?: number;
			}) => {
				const file = info.file;
				if (!file) return;
				const loaded = info.loaded ?? 0;
				const total = info.total ?? 0;

				if (info.status === "progress" && total > 0) {
					fileBytes.set(file, { loaded, total });
				} else if (info.status === "done") {
					const existing = fileBytes.get(file);
					if (existing) {
						fileBytes.set(file, {
							loaded: existing.total,
							total: existing.total,
						});
					}
				}

				let totalLoaded = 0;
				let totalSize = 0;
				for (const v of fileBytes.values()) {
					totalLoaded += v.loaded;
					totalSize += v.total;
				}
				if (totalSize === 0) return;

				const overall = Math.floor((totalLoaded / totalSize) * 100);
				if (overall !== lastReportedProgress) {
					lastReportedProgress = overall;
					post({ type: "init-progress", progress: overall });
				}
			},
		})) as unknown as TextToAudioPipeline;

		post({ type: "init-complete" });
	} catch (error) {
		post({
			type: "init-error",
			error: error instanceof Error ? error.message : "Failed to load TTS model",
		});
	}
}

async function handleSynthesize({ id, text }: { id: string; text: string }) {
	if (!synth) {
		post({ type: "synthesize-error", id, error: "TTS not initialized" });
		return;
	}

	cancelled = false;
	try {
		const output = await synth(text, {});
		if (cancelled) return;

		const pcm = output.audio;
		const sampleRate = output.sampling_rate;
		// Transfer the underlying buffer to avoid a copy.
		post(
			{ type: "synthesize-complete", id, pcm, sampleRate },
			[pcm.buffer],
		);
	} catch (error) {
		if (cancelled) return;
		post({
			type: "synthesize-error",
			id,
			error: error instanceof Error ? error.message : "Synthesis failed",
		});
	}
}
