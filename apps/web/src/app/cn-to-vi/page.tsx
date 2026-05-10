"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { runCnToViPipeline } from "@/cn-vi-auto/orchestrator";
import {
	createDefaultProfile,
	deleteProfile,
	getActiveProfile,
	getActiveProfileId,
	listProfiles,
	saveProfile,
	setActiveProfileId,
} from "@/cn-vi-auto/profile-store";
import type {
	ChannelProfile,
	PipelineOptions,
	PipelineProgress,
	PipelineWarning,
	SfxLevel,
} from "@/cn-vi-auto/types";

type RunState =
	| { kind: "idle" }
	| { kind: "running"; progress: PipelineProgress | null; abort: AbortController }
	| { kind: "done"; warnings: PipelineWarning[]; projectId: string }
	| { kind: "error"; message: string };

const SFX_LEVELS: SfxLevel[] = ["off", "light", "medium", "heavy"];

export default function CnToViPage() {
	const editor = useEditor();
	const router = useRouter();
	const [profiles, setProfiles] = useState<ChannelProfile[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const activeProfile = useMemo(
		() => profiles.find((p) => p.id === activeId) ?? null,
		[profiles, activeId],
	);
	const [videoFile, setVideoFile] = useState<File | null>(null);
	const [srtFile, setSrtFile] = useState<File | null>(null);
	const [logoFile, setLogoFile] = useState<File | null>(null);
	const [run, setRun] = useState<RunState>({ kind: "idle" });
	const initialized = useRef(false);

	useEffect(() => {
		if (initialized.current) return;
		initialized.current = true;
		const list = listProfiles();
		if (list.length === 0) {
			const fresh = saveProfile({ profile: createDefaultProfile({ name: "Default" }) });
			setProfiles([fresh]);
			setActiveProfileId({ id: fresh.id });
			setActiveId(fresh.id);
		} else {
			setProfiles(list);
			const aid = getActiveProfileId() ?? list[0]!.id;
			setActiveId(aid);
			if (!getActiveProfileId()) setActiveProfileId({ id: aid });
		}
	}, []);

	function patchProfile(patch: (p: ChannelProfile) => ChannelProfile) {
		if (!activeProfile) return;
		const next = patch(activeProfile);
		const saved = saveProfile({ profile: next });
		setProfiles((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
	}

	function patchOptions(patch: (o: PipelineOptions) => PipelineOptions) {
		patchProfile((p) => ({ ...p, options: patch(p.options) }));
	}

	async function handleRun() {
		if (!videoFile || !activeProfile) {
			toast.error("Upload a Chinese video first.");
			return;
		}
		const project = editor.project.getActiveOrNull();
		let projectId = project?.metadata.id ?? null;
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
				options: activeProfile.options,
				signal: abort.signal,
				onProgress: (p) =>
					setRun((curr) =>
						curr.kind === "running" ? { ...curr, progress: p } : curr,
					),
			});
			setRun({
				kind: "done",
				warnings: result.warnings,
				projectId: projectId!,
			});
			toast.success("Pipeline finished. Open the editor to review.");
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

	function handleNewProfile() {
		const name = prompt("Profile name?")?.trim();
		if (!name) return;
		const fresh = saveProfile({ profile: createDefaultProfile({ name }) });
		setProfiles((prev) => [...prev, fresh]);
		setActiveProfileId({ id: fresh.id });
		setActiveId(fresh.id);
	}

	function handleDeleteProfile() {
		if (!activeProfile) return;
		if (!confirm(`Delete profile "${activeProfile.name}"?`)) return;
		deleteProfile({ id: activeProfile.id });
		const next = profiles.filter((p) => p.id !== activeProfile.id);
		setProfiles(next);
		const newActive = next[0]?.id ?? null;
		setActiveId(newActive);
		setActiveProfileId({ id: newActive });
	}

	return (
		<main className="mx-auto max-w-4xl px-6 py-10 flex flex-col gap-8 [&_*]:!outline-none [&_*]:!ring-0 [&_*]:!ring-offset-0">
			<header className="flex flex-col gap-2">
				<h1 className="text-2xl font-bold">Chinese → Vietnamese auto-pipeline</h1>
				<p className="text-muted-foreground text-sm">
					Upload a Chinese video and a Vietnamese SRT. The pipeline OCRs the
					hardcoded subtitles, covers them with a colored box, overlays
					Vietnamese captions at the same position, generates Vietnamese TTS
					audio, splits the video into segments with random transforms, places
					a logo, and adds emotion-aware SFX.
				</p>
			</header>

			<ProfileSwitcher
				profiles={profiles}
				activeId={activeId}
				onSelect={(id) => {
					setActiveId(id);
					setActiveProfileId({ id });
				}}
				onNew={handleNewProfile}
				onDelete={handleDeleteProfile}
			/>

			<UploadCard
				videoFile={videoFile}
				srtFile={srtFile}
				logoFile={logoFile}
				onVideo={setVideoFile}
				onSrt={setSrtFile}
				onLogo={setLogoFile}
			/>

			{activeProfile && (
				<SettingsPanel
					profile={activeProfile}
					onPatch={patchOptions}
				/>
			)}

			{run.kind === "running" && (
				<RunningView
					progress={run.progress}
					onCancel={() => run.abort.abort()}
				/>
			)}
			{run.kind === "done" && (
				<DoneView
					warnings={run.warnings}
					onOpen={() => router.push(`/editor/${run.projectId}`)}
				/>
			)}
			{run.kind === "error" && (
				<Card className="border-0 shadow-none bg-transparent">
					<CardContent className="p-4 text-destructive">{run.message}</CardContent>
				</Card>
			)}

			<div className="flex justify-end gap-2">
				<Button
					size="lg"
					disabled={
						run.kind === "running" || !videoFile || !activeProfile
					}
					onClick={handleRun}
				>
					{run.kind === "running" ? "Processing…" : "Process"}
				</Button>
			</div>
		</main>
	);
}

// ── Components ───────────────────────────────────────────────────────────────

function ProfileSwitcher({
	profiles,
	activeId,
	onSelect,
	onNew,
	onDelete,
}: {
	profiles: ChannelProfile[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: () => void;
}) {
	return (
		<Card className="border-0 shadow-none bg-transparent">
			<CardContent className="p-4 flex items-center gap-3">
				<Label className="shrink-0">Channel profile</Label>
				<Select value={activeId ?? ""} onValueChange={onSelect}>
					<SelectTrigger className="w-64">
						<SelectValue placeholder="Pick a profile" />
					</SelectTrigger>
					<SelectContent>
						{profiles.map((p) => (
							<SelectItem key={p.id} value={p.id}>
								{p.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button variant="outline" onClick={onNew}>
					New
				</Button>
				<Button variant="outline" onClick={onDelete} disabled={profiles.length <= 1}>
					Delete
				</Button>
			</CardContent>
		</Card>
	);
}

function UploadCard({
	videoFile,
	srtFile,
	logoFile,
	onVideo,
	onSrt,
	onLogo,
}: {
	videoFile: File | null;
	srtFile: File | null;
	logoFile: File | null;
	onVideo: (f: File | null) => void;
	onSrt: (f: File | null) => void;
	onLogo: (f: File | null) => void;
}) {
	return (
		<Card className="border-0 shadow-none bg-transparent">
			<CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
				<FileSlot
					label="Chinese video (9:16)"
					accept="video/*"
					file={videoFile}
					onChange={onVideo}
				/>
				<FileSlot
					label="Vietnamese SRT/ASS"
					accept=".srt,.ass,text/*"
					file={srtFile}
					onChange={onSrt}
				/>
				<FileSlot
					label="Logo (optional, PNG)"
					accept="image/png,image/*"
					file={logoFile}
					onChange={onLogo}
				/>
			</CardContent>
		</Card>
	);
}

function FileSlot({
	label,
	accept,
	file,
	onChange,
}: {
	label: string;
	accept: string;
	file: File | null;
	onChange: (f: File | null) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label>{label}</Label>
			<Input
				type="file"
				accept={accept}
				onChange={(e) => onChange(e.target.files?.[0] ?? null)}
			/>
			{file && (
				<span className="text-muted-foreground text-xs truncate">
					{file.name} ({Math.round(file.size / 1024)} KB)
				</span>
			)}
		</div>
	);
}

function SettingsPanel({
	profile,
	onPatch,
}: {
	profile: ChannelProfile;
	onPatch: (patch: (o: PipelineOptions) => PipelineOptions) => void;
}) {
	const o = profile.options;
	return (
		<Card className="border-0 shadow-none bg-transparent">
			<CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
				<Section title="Cover">
					<Row label="Color">
						<Input
							type="color"
							value={o.cover.color}
							onChange={(e) =>
								onPatch((opts) => ({
									...opts,
									cover: { ...opts.cover, color: e.target.value },
								}))
							}
							className="w-20 h-9 p-1"
						/>
					</Row>
					<Row label={`Opacity ${o.cover.opacity.toFixed(2)}`}>
						<Slider
							min={0}
							max={1}
							step={0.05}
							value={[o.cover.opacity]}
							onValueChange={([v]) =>
								onPatch((opts) => ({
									...opts,
									cover: { ...opts.cover, opacity: v ?? 1 },
								}))
							}
						/>
					</Row>
				</Section>

				<Section title="Caption">
					<Row label="Font family">
						<Input
							value={o.caption.fontFamily}
							onChange={(e) =>
								onPatch((opts) => ({
									...opts,
									caption: { ...opts.caption, fontFamily: e.target.value },
								}))
							}
						/>
					</Row>
					<Row label="Color">
						<Input
							type="color"
							value={o.caption.color}
							onChange={(e) =>
								onPatch((opts) => ({
									...opts,
									caption: { ...opts.caption, color: e.target.value },
								}))
							}
							className="w-20 h-9 p-1"
						/>
					</Row>
				</Section>

				<Section title="TTS">
					<Row label="Generate Vietnamese voice">
						<Switch
							checked={o.tts.enabled}
							onCheckedChange={(v) =>
								onPatch((opts) => ({
									...opts,
									tts: { ...opts.tts, enabled: v },
								}))
							}
						/>
					</Row>
				</Section>

				<Section title="Logo">
					<Row label="Enabled">
						<Switch
							checked={o.logo.enabled}
							onCheckedChange={(v) =>
								onPatch((opts) => ({
									...opts,
									logo: { ...opts.logo, enabled: v },
								}))
							}
						/>
					</Row>
					<Row label={`Interval ${o.logo.intervalSec}s`}>
						<Slider
							min={2}
							max={20}
							step={1}
							value={[o.logo.intervalSec]}
							onValueChange={([v]) =>
								onPatch((opts) => ({
									...opts,
									logo: { ...opts.logo, intervalSec: v ?? 5 },
								}))
							}
						/>
					</Row>
					<Row label="Avoid caption">
						<Switch
							checked={o.logo.avoidCaption}
							onCheckedChange={(v) =>
								onPatch((opts) => ({
									...opts,
									logo: { ...opts.logo, avoidCaption: v },
								}))
							}
						/>
					</Row>
				</Section>

				<Section title="Segments">
					<Row label={`Duration ${o.segment.durationSec}s`}>
						<Slider
							min={5}
							max={60}
							step={1}
							value={[o.segment.durationSec]}
							onValueChange={([v]) =>
								onPatch((opts) => ({
									...opts,
									segment: { ...opts.segment, durationSec: v ?? 15 },
								}))
							}
						/>
					</Row>
					<Row label="Random scale">
						<Switch
							checked={o.segment.scale.enabled}
							onCheckedChange={(v) =>
								onPatch((opts) => ({
									...opts,
									segment: {
										...opts.segment,
										scale: { ...opts.segment.scale, enabled: v },
									},
								}))
							}
						/>
					</Row>
					<Row label="Random rotate">
						<Switch
							checked={o.segment.rotate.enabled}
							onCheckedChange={(v) =>
								onPatch((opts) => ({
									...opts,
									segment: {
										...opts.segment,
										rotate: { ...opts.segment.rotate, enabled: v },
									},
								}))
							}
						/>
					</Row>
					<Row label="Random flip (cue-safe)">
						<Switch
							checked={o.segment.flip.enabled}
							onCheckedChange={(v) =>
								onPatch((opts) => ({
									...opts,
									segment: {
										...opts.segment,
										flip: { ...opts.segment.flip, enabled: v },
									},
								}))
							}
						/>
					</Row>
				</Section>

				<Section title="SFX">
					<Row label="Enabled">
						<Switch
							checked={o.sfx.enabled}
							onCheckedChange={(v) =>
								onPatch((opts) => ({
									...opts,
									sfx: { ...opts.sfx, enabled: v },
								}))
							}
						/>
					</Row>
					<Row label="Density">
						<Select
							value={o.sfx.level}
							onValueChange={(v) =>
								onPatch((opts) => ({
									...opts,
									sfx: { ...opts.sfx, level: v as SfxLevel },
								}))
							}
						>
							<SelectTrigger className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SFX_LEVELS.map((l) => (
									<SelectItem key={l} value={l}>
										{l}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Row>
					<Row label={`Master gain ${o.sfx.masterGain.toFixed(2)}`}>
						<Slider
							min={0}
							max={1}
							step={0.05}
							value={[o.sfx.masterGain]}
							onValueChange={([v]) =>
								onPatch((opts) => ({
									...opts,
									sfx: { ...opts.sfx, masterGain: v ?? 0.6 },
								}))
							}
						/>
					</Row>
				</Section>

				<Section title="Seed">
					<Row label="Seed (0 = random)">
						<Input
							type="number"
							value={o.seed}
							onChange={(e) =>
								onPatch((opts) => ({
									...opts,
									seed: Number(e.target.value) || 0,
								}))
							}
						/>
					</Row>
				</Section>
			</CardContent>
		</Card>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
				{title}
			</h3>
			{children}
		</div>
	);
}

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<Label className="text-sm">{label}</Label>
			<div className="min-w-32">{children}</div>
		</div>
	);
}

function RunningView({
	progress,
	onCancel,
}: {
	progress: PipelineProgress | null;
	onCancel: () => void;
}) {
	const pct = progress?.total
		? Math.round((progress.current / progress.total) * 100)
		: 0;
	return (
		<Card className="border-0 shadow-none bg-transparent">
			<CardContent className="p-4 flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium">
						{progress?.stage ?? "starting…"}
						{progress?.message ? ` — ${progress.message}` : ""}
					</span>
					<Button size="sm" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
				</div>
				<div className="bg-muted rounded h-2 overflow-hidden">
					<div
						className="bg-primary h-2 transition-all"
						style={{ width: `${pct}%` }}
					/>
				</div>
				<span className="text-xs text-muted-foreground">
					{progress?.current ?? 0} / {progress?.total ?? 0} ({pct}%)
				</span>
			</CardContent>
		</Card>
	);
}

function DoneView({
	warnings,
	onOpen,
}: {
	warnings: PipelineWarning[];
	onOpen: () => void;
}) {
	return (
		<Card className="border-0 shadow-none bg-transparent">
			<CardContent className="p-4 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium text-green-600">
						Pipeline complete.
					</span>
					<Button size="sm" onClick={onOpen}>
						Open editor
					</Button>
				</div>
				{warnings.length > 0 && (
					<details className="text-xs">
						<summary className="cursor-pointer text-muted-foreground">
							{warnings.length} warning{warnings.length > 1 ? "s" : ""}
						</summary>
						<ul className="mt-2 list-disc pl-5 space-y-1">
							{warnings.map((w, i) => (
								<li key={i}>
									<strong>{w.code}</strong>: {w.message}
								</li>
							))}
						</ul>
					</details>
				)}
			</CardContent>
		</Card>
	);
}
