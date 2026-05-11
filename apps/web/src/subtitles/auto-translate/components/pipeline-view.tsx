"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runCnToViPipeline } from "@/subtitles/auto-translate/orchestrator";
import { DEFAULT_PIPELINE_OPTIONS } from "@/subtitles/auto-translate/defaults";
import type {
	PipelineProgress,
	PipelineWarning,
} from "@/subtitles/auto-translate/types";

type RunState =
	| { kind: "idle" }
	| { kind: "running"; progress: PipelineProgress | null; abort: AbortController }
	| { kind: "done"; warnings: PipelineWarning[]; projectId: string }
	| { kind: "error"; message: string };

export function PipelineView({ onClose }: { onClose?: () => void } = {}) {
	const editor = useEditor();
	const router = useRouter();
	const [videoFile, setVideoFile] = useState<File | null>(null);
	const [srtFile, setSrtFile] = useState<File | null>(null);
	const [logoFile, setLogoFile] = useState<File | null>(null);
	const [run, setRun] = useState<RunState>({ kind: "idle" });

	async function handleRun() {
		if (!videoFile || !srtFile) {
			toast.error("Upload both video and Vietnamese SRT first.");
			return;
		}
		let projectId = editor.project.getActiveOrNull()?.metadata.id ?? null;
		if (!projectId) {
			projectId = await editor.project.createNewProject({
				name: `CN→VI: ${videoFile.name}`,
			});
			await editor.project.loadProject({ id: projectId });
		}
		const abort = new AbortController();
		setRun({ kind: "running", progress: null, abort });
		try {
			const result = await runCnToViPipeline({
				videoFile,
				subtitleFile: srtFile,
				logoFile,
				options: DEFAULT_PIPELINE_OPTIONS,
				signal: abort.signal,
				onProgress: (p) =>
					setRun((curr) =>
						curr.kind === "running" ? { ...curr, progress: p } : curr,
					),
			});
			setRun({ kind: "done", warnings: result.warnings, projectId });
			toast.success("Pipeline finished.");
		} catch (err) {
			if (abort.signal.aborted) {
				setRun({ kind: "idle" });
				toast.info("Pipeline cancelled.");
				return;
			}
			const message = err instanceof Error ? err.message : String(err);
			setRun({ kind: "error", message });
			toast.error(`Pipeline failed: ${message}`);
		}
	}

	return (
		<div className="p-6 flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h2 className="text-xl font-bold">Auto CN→VI pipeline</h2>
				<p className="text-muted-foreground text-sm">
					Upload a Chinese video and the matching pre-translated Vietnamese SRT.
					The pipeline OCRs the position of hardcoded Chinese subs, covers them
					with a colored box, overlays the Vietnamese text from the SRT at the
					same position, and generates Vietnamese TTS audio (speed-adjusted to
					fit each cue while preserving pitch).
				</p>
			</header>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="flex flex-col gap-2">
					<Label>Chinese video (mp4)</Label>
					<Input
						type="file"
						accept="video/*"
						onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
					/>
					{videoFile && (
						<p className="text-xs text-muted-foreground truncate">
							{videoFile.name}
						</p>
					)}
				</div>
				<div className="flex flex-col gap-2">
					<Label>Vietnamese SRT</Label>
					<Input
						type="file"
						accept=".srt,.ass"
						onChange={(e) => setSrtFile(e.target.files?.[0] ?? null)}
					/>
					{srtFile && (
						<p className="text-xs text-muted-foreground truncate">
							{srtFile.name}
						</p>
					)}
				</div>
				<div className="flex flex-col gap-2">
					<Label>Logo <span className="text-muted-foreground">(optional)</span></Label>
					<Input
						type="file"
						accept="image/*"
						onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
					/>
					{logoFile && (
						<p className="text-xs text-muted-foreground truncate">
							{logoFile.name}
						</p>
					)}
				</div>
			</div>

			{run.kind === "running" && run.progress && (
				<div className="rounded-md border p-3 text-sm">
					<p className="font-medium">{run.progress.stage}</p>
					{run.progress.message && (
						<p className="text-muted-foreground">{run.progress.message}</p>
					)}
					<p className="text-muted-foreground">
						{run.progress.current}/{run.progress.total}
					</p>
				</div>
			)}

			{run.kind === "done" && (
				<div className="rounded-md border p-3 text-sm">
					<p className="font-medium text-green-600">Pipeline finished.</p>
					{run.warnings.length > 0 && (
						<ul className="mt-2 list-disc pl-4 text-amber-700">
							{run.warnings.map((w, i) => (
								<li key={i}>{w.message}</li>
							))}
						</ul>
					)}
				</div>
			)}

			{run.kind === "error" && (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{run.message}
				</div>
			)}

			<div className="flex justify-end gap-2">
				{run.kind === "running" ? (
					<Button variant="outline" onClick={() => run.abort.abort()}>
						Cancel
					</Button>
				) : run.kind === "done" ? (
					<>
						<Button variant="outline" onClick={() => onClose?.()}>
							Close
						</Button>
						<Button
							onClick={() => {
								onClose?.();
								router.push(`/editor/${run.projectId}`);
							}}
						>
							Open editor
						</Button>
					</>
				) : (
					<>
						{onClose && (
							<Button variant="outline" onClick={onClose}>
								Cancel
							</Button>
						)}
						<Button
							onClick={handleRun}
							disabled={!videoFile || !srtFile}
							size="lg"
						>
							Process
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
