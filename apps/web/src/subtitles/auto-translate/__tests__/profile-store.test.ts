import { beforeEach, describe, expect, test } from "bun:test";
import {
	createDefaultProfile,
	deleteProfile,
	getActiveProfile,
	getActiveProfileId,
	getProfile,
	listProfiles,
	migrate,
	saveProfile,
	setActiveProfileId,
	type ProfileStorage,
} from "../profile-store";

function memoryStorage(): ProfileStorage & { dump(): Record<string, string> } {
	const map = new Map<string, string>();
	return {
		getItem(key) {
			return map.get(key) ?? null;
		},
		setItem(key, value) {
			map.set(key, value);
		},
		removeItem(key) {
			map.delete(key);
		},
		dump() {
			return Object.fromEntries(map);
		},
	};
}

let storage: ProfileStorage;

beforeEach(() => {
	storage = memoryStorage();
});

describe("profile-store", () => {
	test("listProfiles returns empty when storage is empty", () => {
		expect(listProfiles({ storage })).toEqual([]);
	});

	test("saveProfile inserts and listProfiles returns it", () => {
		const profile = createDefaultProfile({ name: "Channel A" });
		saveProfile({ profile, storage });
		const list = listProfiles({ storage });
		expect(list).toHaveLength(1);
		expect(list[0]!.name).toBe("Channel A");
	});

	test("saveProfile updates an existing profile by id", () => {
		const a = createDefaultProfile({ name: "A" });
		saveProfile({ profile: a, storage });
		saveProfile({
			profile: { ...a, name: "A renamed" },
			storage,
		});
		const list = listProfiles({ storage });
		expect(list).toHaveLength(1);
		expect(list[0]!.name).toBe("A renamed");
	});

	test("getProfile by id returns null for unknown ids", () => {
		expect(getProfile({ id: "nope", storage })).toBeNull();
	});

	test("deleteProfile removes the profile", () => {
		const a = createDefaultProfile({ name: "A" });
		const b = createDefaultProfile({ name: "B" });
		saveProfile({ profile: a, storage });
		saveProfile({ profile: b, storage });
		deleteProfile({ id: a.id, storage });
		const list = listProfiles({ storage });
		expect(list.map((p) => p.id)).toEqual([b.id]);
	});

	test("active profile round-trips", () => {
		const a = createDefaultProfile({ name: "A" });
		saveProfile({ profile: a, storage });
		setActiveProfileId({ id: a.id, storage });
		expect(getActiveProfileId({ storage })).toBe(a.id);
		expect(getActiveProfile({ storage })?.id).toBe(a.id);
	});

	test("deleting the active profile clears active id", () => {
		const a = createDefaultProfile({ name: "A" });
		saveProfile({ profile: a, storage });
		setActiveProfileId({ id: a.id, storage });
		deleteProfile({ id: a.id, storage });
		expect(getActiveProfileId({ storage })).toBeNull();
	});

	test("migrate fills missing fields with defaults", () => {
		const migrated = migrate({
			state: {
				profiles: [
					{
						id: "x",
						name: "old",
						logoDataUrl: null,
						options: undefined as unknown as never,
						createdAt: 1,
						updatedAt: 1,
					},
				],
			},
		});
		expect(migrated.profiles[0]!.options.cover).toBeDefined();
		expect(migrated.profiles[0]!.options.sfx.level).toBeDefined();
	});

	test("malformed JSON falls back to empty list", () => {
		storage.setItem("cn-vi-auto.profiles.v1", "{ not json");
		expect(listProfiles({ storage })).toEqual([]);
	});

	test("createDefaultProfile uses DEFAULT_PIPELINE_OPTIONS", () => {
		const p = createDefaultProfile({ name: "x" });
		expect(p.options.tts.enabled).toBe(true);
		expect(p.options.sfx.enabled).toBe(true);
		expect(p.options.segment.durationSec).toBe(15);
	});
});
