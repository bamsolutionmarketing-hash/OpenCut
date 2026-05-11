import { DEFAULT_PIPELINE_OPTIONS } from "./defaults";
import type { ChannelProfile, PipelineOptions } from "./types";

const STORAGE_KEY = "cn-vi-auto.profiles.v1";
const ACTIVE_KEY = "cn-vi-auto.profiles.active.v1";
const SCHEMA_VERSION = 1;

interface StoredState {
	version: number;
	profiles: ChannelProfile[];
}

/**
 * Storage adapter — defaults to globalThis.localStorage but is injectable
 * for tests. Returning null silences the entire store (SSR-safe).
 */
export interface ProfileStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

function defaultStorage(): ProfileStorage | null {
	try {
		if (typeof globalThis !== "undefined" && globalThis.localStorage) {
			return globalThis.localStorage as ProfileStorage;
		}
	} catch {
		// Access denied (e.g. SSR / private mode) — fall through.
	}
	return null;
}

function readState({
	storage,
}: {
	storage: ProfileStorage | null;
}): StoredState {
	if (!storage) return { version: SCHEMA_VERSION, profiles: [] };
	const raw = storage.getItem(STORAGE_KEY);
	if (!raw) return { version: SCHEMA_VERSION, profiles: [] };
	try {
		const parsed = JSON.parse(raw) as Partial<StoredState>;
		if (!parsed || typeof parsed !== "object") {
			return { version: SCHEMA_VERSION, profiles: [] };
		}
		return migrate({ state: parsed });
	} catch {
		return { version: SCHEMA_VERSION, profiles: [] };
	}
}

function writeState({
	storage,
	state,
}: {
	storage: ProfileStorage | null;
	state: StoredState;
}): void {
	if (!storage) return;
	storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Bring older shapes forward to the current schema. v1 is the first version,
 * so this currently fills in missing fields with defaults.
 */
export function migrate({
	state,
}: {
	state: Partial<StoredState>;
}): StoredState {
	const profiles = Array.isArray(state.profiles) ? state.profiles : [];
	return {
		version: SCHEMA_VERSION,
		profiles: profiles.map((p) => ({
			id: p.id ?? cryptoId(),
			name: p.name ?? "Untitled",
			logoDataUrl: p.logoDataUrl ?? null,
			options: mergeOptions({ overrides: p.options }),
			createdAt: p.createdAt ?? Date.now(),
			updatedAt: p.updatedAt ?? Date.now(),
		})),
	};
}

function mergeOptions({
	overrides,
}: {
	overrides: Partial<PipelineOptions> | undefined;
}): PipelineOptions {
	if (!overrides) return DEFAULT_PIPELINE_OPTIONS;
	return {
		...DEFAULT_PIPELINE_OPTIONS,
		...overrides,
		cover: { ...DEFAULT_PIPELINE_OPTIONS.cover, ...(overrides.cover ?? {}) },
		caption: {
			...DEFAULT_PIPELINE_OPTIONS.caption,
			...(overrides.caption ?? {}),
		},
		tts: { ...DEFAULT_PIPELINE_OPTIONS.tts, ...(overrides.tts ?? {}) },
		logo: { ...DEFAULT_PIPELINE_OPTIONS.logo, ...(overrides.logo ?? {}) },
		segment: {
			...DEFAULT_PIPELINE_OPTIONS.segment,
			...(overrides.segment ?? {}),
		},
		sfx: { ...DEFAULT_PIPELINE_OPTIONS.sfx, ...(overrides.sfx ?? {}) },
	};
}

function cryptoId(): string {
	if (
		typeof globalThis !== "undefined" &&
		"crypto" in globalThis &&
		"randomUUID" in (globalThis.crypto as Crypto)
	) {
		return globalThis.crypto.randomUUID();
	}
	return `p-${Date.now()}-${Math.floor(Math.random() * 0xffffff).toString(16)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function listProfiles({
	storage = defaultStorage(),
}: {
	storage?: ProfileStorage | null;
} = {}): ChannelProfile[] {
	return readState({ storage }).profiles;
}

export function getProfile({
	id,
	storage = defaultStorage(),
}: {
	id: string;
	storage?: ProfileStorage | null;
}): ChannelProfile | null {
	return readState({ storage }).profiles.find((p) => p.id === id) ?? null;
}

export function saveProfile({
	profile,
	storage = defaultStorage(),
}: {
	profile: ChannelProfile;
	storage?: ProfileStorage | null;
}): ChannelProfile {
	const state = readState({ storage });
	const idx = state.profiles.findIndex((p) => p.id === profile.id);
	const next: ChannelProfile = { ...profile, updatedAt: Date.now() };
	if (idx === -1) state.profiles.push(next);
	else state.profiles[idx] = next;
	writeState({ storage, state });
	return next;
}

export function deleteProfile({
	id,
	storage = defaultStorage(),
}: {
	id: string;
	storage?: ProfileStorage | null;
}): void {
	const state = readState({ storage });
	state.profiles = state.profiles.filter((p) => p.id !== id);
	writeState({ storage, state });
	if (getActiveProfileId({ storage }) === id) {
		setActiveProfileId({ id: null, storage });
	}
}

export function getActiveProfileId({
	storage = defaultStorage(),
}: {
	storage?: ProfileStorage | null;
} = {}): string | null {
	if (!storage) return null;
	return storage.getItem(ACTIVE_KEY);
}

export function setActiveProfileId({
	id,
	storage = defaultStorage(),
}: {
	id: string | null;
	storage?: ProfileStorage | null;
}): void {
	if (!storage) return;
	if (id === null) storage.removeItem(ACTIVE_KEY);
	else storage.setItem(ACTIVE_KEY, id);
}

export function getActiveProfile({
	storage = defaultStorage(),
}: {
	storage?: ProfileStorage | null;
} = {}): ChannelProfile | null {
	const id = getActiveProfileId({ storage });
	if (!id) return null;
	return getProfile({ id, storage });
}

export function createDefaultProfile({
	name,
}: {
	name: string;
}): ChannelProfile {
	const now = Date.now();
	return {
		id: cryptoId(),
		name,
		logoDataUrl: null,
		options: DEFAULT_PIPELINE_OPTIONS,
		createdAt: now,
		updatedAt: now,
	};
}
