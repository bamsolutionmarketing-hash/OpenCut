import { EditorCore } from "@/core";
import { processMediaAssets } from "@/media/processing";
import { AddMediaAssetCommand } from "@/commands/media";
import { InsertElementCommand } from "@/commands/timeline";
import { BatchCommand, type Command } from "@/commands";
import { parseSubtitleFile } from "@/subtitles/parse";
import type { CreateTimelineElement } from "@/timeline";
import { collectSampledFrames } from "./sample-frames";
import { createOcrSession, recognizeFrames } from "./ocr";
import { ocrFramesToCues } from "./ocr-to-cues";
import { matchAllCues } from "./match";
import { createTtsSession, synthesizeAll } from "./tts";
import { fitAll } from "./fit-audio";
import { classifyAllCues } from "./sfx/classifier";
import {
	limitSfxDensity,
	pickSfxForCues,
	pickSfxForSegmentBoundaries,
} from "./sfx/picker";
import { buildAllCoverElements } from "./build-cover-element";
import { buildAllCaptionElements } from "./build-caption-element";
import { buildAudioElement } from "./build-audio-element";
import { pcmToWavFile } from "./wav";
import { computeLogoSlots } from "./logo-placement";
import { buildLogoElements } from "./build-logo-elements";
import { buildSegmentInstances } from "./segment-variation";
import { buildSegmentVideoElements } from "./build-segment-elements";
import { loadSfxFile, buildSfxElement } from "./sfx/build-sfx-elements";
import { createPipelineEmitter, type PipelineEmitter } from "./progress";
import { createSeededRng, randomSeed } from "./random-utils";
import type {
	MatchedCue,
	PipelineOptions,
	PipelineResult,
	PipelineWarning,
	SfxPick,
} from "./types";

export interface RunPipelineArgs {
	videoFile: File;
	subtitleFile?: File | null;
	logoFile?: File | null;
	options: PipelineOptions;
	signal?: AbortSignal;
	onProgress?: (progress: import("./types").PipelineProgress) => void;
}

export async function runCnToViPipeline(
	args: RunPipelineArgs,
): Promise<PipelineResult> {
	const { videoFile, subtitleFile, logoFile, options, signal, onProgress } =
		args;
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) throw new Error("No active project — please open or create a project first.");
	const projectId = project.metadata.id;

	const emitter = createPipelineEmitter();
	if (onProgress) emitter.on(onProgress);
	const seed = options.seed === 0 ? randomSeed() : options.seed;
	const rng = createSeededRng(seed);
	const warnings: PipelineWarning[] = [];

	function abortGuard() {
		if (signal?.aborted) throw new Error("aborted");
	}

	// ── 1. import video ────────────────────────────────────────────────────
	emitter.stage("importing-video", videoFile.name);
	const [videoProcessed] = await processMediaAssets({ files: [videoFile] });
	if (!videoProcessed) throw new Error("Failed to process video");
	const addVideoCmd = new AddMediaAssetCommand({
		projectId,
		asset: videoProcessed,
	});
	const videoMediaId = addVideoCmd.getAssetId();
	abortGuard();

	const canvas = {
		width: videoProcessed.width ?? 1080,
		height: videoProcessed.height ?? 1920,
	};
	const totalDurationSec = videoProcessed.duration ?? 0;

	// ── 2. sample frames + OCR ────────────────────────────────────────────
	emitter.stage("sampling-frames");
	const frames = await collectSampledFrames({
		file: videoFile,
		signal,
		onProgress: (e) =>
			emitter.progress({
				stage: "sampling-frames",
				current: e.current,
				total: e.total,
			}),
	});
	abortGuard();

	emitter.stage("ocr");
	const ocrSession = await createOcrSession({
		onLoad: (e) =>
			emitter.progress({
				stage: "ocr",
				current: Math.floor(e.progress * 100),
				total: 100,
				message: e.status,
			}),
	});
	let ocrFrames;
	try {
		ocrFrames = await recognizeFrames({
			frames,
			session: ocrSession,
			signal,
			onProgress: (e) =>
				emitter.progress({
					stage: "ocr",
					current: e.current,
					total: e.total ?? frames.length,
				}),
		});
	} finally {
		await ocrSession.dispose();
	}
	abortGuard();

	// ── 3. parse SRT or derive cues from OCR ──────────────────────────────
	let sourceCues;
	if (subtitleFile) {
		emitter.stage("parsing-srt");
		const srtText = await subtitleFile.text();
		const parsed = parseSubtitleFile({
			fileName: subtitleFile.name,
			input: srtText,
		});
		for (const w of parsed.warnings) {
			warnings.push({ code: "ocr-missing-cue", message: w });
		}
		sourceCues = parsed.captions;
	} else {
		emitter.stage("parsing-srt"); // reuse stage label
		sourceCues = ocrFramesToCues({ frames: ocrFrames });
		if (sourceCues.length === 0) {
			warnings.push({
				code: "ocr-missing-cue",
				message: "OCR found no Chinese text in the video. Check that the video has visible hardcoded subtitles.",
			});
		}
	}
	abortGuard();

	// ── 4. match cues ──────────────────────────────────────────────────────
	emitter.stage("matching");
	const matched: MatchedCue[] = matchAllCues({
		cues: sourceCues,
		ocrFrames,
		options: { canvas },
	});

	// ── 6. TTS ──────────────────────────────────────────────────────────────
	let ttsResults: Awaited<ReturnType<typeof synthesizeAll>> = [];
	if (options.tts.enabled && matched.length > 0) {
		emitter.stage("loading-models");
		const ttsSession = await createTtsSession({
			onProgress: (p) =>
				emitter.progress({
					stage: "loading-models",
					current: p.current,
					total: p.total,
					message: p.message,
				}),
			signal,
		});
		try {
			emitter.stage("generating-tts");
			ttsResults = await synthesizeAll({
				cues: matched,
				session: ttsSession,
				signal,
				onProgress: (p) =>
					emitter.progress({
						stage: "generating-tts",
						current: p.current,
						total: p.total,
					}),
			});
		} finally {
			ttsSession.dispose();
		}
		abortGuard();
	}

	// ── 7. fit TTS to slots ────────────────────────────────────────────────
	let fittedTts: Awaited<ReturnType<typeof fitAll>>["fitted"] = [];
	if (ttsResults.length > 0) {
		emitter.stage("fitting-audio");
		const fitResult = await fitAll({
			ttsResults,
			cues: matched,
			signal,
		});
		fittedTts = fitResult.fitted;
		warnings.push(...fitResult.warnings);
	}

	// ── 8. classify + 9. pick SFX ──────────────────────────────────────────
	emitter.stage("classifying-emotions");
	const classified = classifyAllCues({ cues: matched });

	emitter.stage("picking-sfx");
	const cueSfx = pickSfxForCues({
		cues: classified,
		options: options.sfx,
		rng: rng.fork(11),
	});
	const segments = buildSegmentInstances({
		cues: matched,
		options: options.segment,
		totalDurationSec,
		rng: rng.fork(22),
	});
	const transitionSfx = pickSfxForSegmentBoundaries({
		boundaries: segments.map((s) => ({ startSec: s.startSec })),
		options: options.sfx,
		rng: rng.fork(33),
	});
	const allSfx = limitSfxDensity({ picks: [...cueSfx, ...transitionSfx] });

	// ── 10. logo slots ──────────────────────────────────────────────────────
	emitter.stage("building-segments");
	const logoSlots = computeLogoSlots({
		cues: matched,
		options: options.logo,
		canvas,
		totalDurationSec,
		rng: rng.fork(44),
	});

	// ── 11. media for logo ──────────────────────────────────────────────────
	const mediaCommands: Command[] = [addVideoCmd];
	let logoMediaId: string | null = null;
	if (logoFile && logoSlots.length > 0) {
		const [logoProcessed] = await processMediaAssets({ files: [logoFile] });
		if (logoProcessed) {
			const addLogoCmd = new AddMediaAssetCommand({
				projectId,
				asset: logoProcessed,
			});
			logoMediaId = addLogoCmd.getAssetId();
			mediaCommands.push(addLogoCmd);
		}
	}

	// ── 12. media for TTS WAVs ──────────────────────────────────────────────
	const ttsMediaIds: string[] = [];
	for (let i = 0; i < fittedTts.length; i++) {
		const tts = fittedTts[i]!;
		const file = pcmToWavFile({
			pcm: tts.pcm,
			sampleRate: tts.sampleRate,
			name: `tts-${i + 1}.wav`,
		});
		const [processed] = await processMediaAssets({ files: [file] });
		if (!processed) continue;
		const cmd = new AddMediaAssetCommand({ projectId, asset: processed });
		ttsMediaIds.push(cmd.getAssetId());
		mediaCommands.push(cmd);
	}

	// ── 13. media for SFX (skip-and-warn for missing files) ─────────────────
	const sfxWithIds: { pick: SfxPick; mediaId: string }[] = [];
	for (const pick of allSfx) {
		const file = await loadSfxFile({ asset: pick.asset, signal });
		if (!file) {
			warnings.push({
				code: "ocr-missing-cue",
				message: `SFX asset missing: ${pick.asset.id} (${pick.asset.file})`,
			});
			continue;
		}
		const [processed] = await processMediaAssets({ files: [file] });
		if (!processed) continue;
		const cmd = new AddMediaAssetCommand({ projectId, asset: processed });
		sfxWithIds.push({ pick, mediaId: cmd.getAssetId() });
		mediaCommands.push(cmd);
	}

	// ── 14. build elements ──────────────────────────────────────────────────
	emitter.stage("building-elements");

	const videoElements = buildSegmentVideoElements({
		mediaId: videoMediaId,
		segments,
		sourceDurationSec: totalDurationSec,
		canvas,
	});
	const coverElements = buildAllCoverElements({
		cues: matched,
		style: options.cover,
		canvas,
	});
	const captionElements = buildAllCaptionElements({
		cues: matched,
		style: options.caption,
		canvas,
	});
	const audioElements = fittedTts.map((tts, i) =>
		buildAudioElement({
			mediaId: ttsMediaIds[i] ?? "",
			fittedTts: tts,
			startSec: matched[i]?.startTime ?? 0,
			name: `Caption ${i + 1} TTS`,
		}),
	);
	const logoElements = logoMediaId
		? buildLogoElements({
				mediaId: logoMediaId,
				slots: logoSlots,
				options: options.logo,
				canvas,
			})
		: [];
	const sfxElements = sfxWithIds.map(({ pick, mediaId }) =>
		buildSfxElement({ mediaId, pick }),
	);

	// ── 15. assemble & execute BatchCommand ─────────────────────────────────
	emitter.stage("executing-command");
	const insertCommands: Command[] = [];
	function queueInsert(
		element: CreateTimelineElement,
		trackType: "video" | "audio" | "text" | "graphic",
	) {
		insertCommands.push(
			new InsertElementCommand({
				element,
				placement: { mode: "auto", trackType },
			}),
		);
	}

	for (const el of videoElements) queueInsert(el, "video");
	for (const el of coverElements) queueInsert(el, "graphic");
	for (const el of captionElements) queueInsert(el, "text");
	for (const el of audioElements) {
		if (el.mediaId) queueInsert(el, "audio");
	}
	for (const el of logoElements) queueInsert(el, "video");
	for (const el of sfxElements) queueInsert(el, "audio");

	const batch = new BatchCommand([...mediaCommands, ...insertCommands]);
	editor.command.execute({ command: batch });

	emitter.stage("done");
	return {
		captionTrackId: null,
		coverTrackId: null,
		audioTrackId: null,
		logoTrackId: logoMediaId ? logoMediaId : null,
		sfxTrackId: null,
		warnings,
	};
}

export type { PipelineEmitter };
