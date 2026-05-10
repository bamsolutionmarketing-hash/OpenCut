import { describe, expect, test } from "bun:test";
import {
	SFX_MANIFEST,
	filterSfxByCategory,
	filterSfxByTag,
	getSfxAssetById,
} from "../sfx/manifest";

describe("SFX manifest", () => {
	test("contains roughly 50 entries across emotion / text / transition", () => {
		expect(SFX_MANIFEST.length).toBeGreaterThanOrEqual(40);
		expect(SFX_MANIFEST.length).toBeLessThanOrEqual(60);
	});

	test("ids are unique", () => {
		const ids = new Set(SFX_MANIFEST.map((a) => a.id));
		expect(ids.size).toBe(SFX_MANIFEST.length);
	});

	test("file paths are namespaced under /cn-vi-auto/sfx", () => {
		for (const asset of SFX_MANIFEST) {
			expect(asset.file.startsWith("/cn-vi-auto/sfx/")).toBe(true);
		}
	});

	test("categories cover all three buckets", () => {
		expect(filterSfxByCategory({ category: "emotion" }).length).toBeGreaterThan(0);
		expect(filterSfxByCategory({ category: "text" }).length).toBeGreaterThan(0);
		expect(filterSfxByCategory({ category: "transition" }).length).toBeGreaterThan(0);
	});

	test("getSfxAssetById finds known assets and returns null otherwise", () => {
		const known = SFX_MANIFEST[0]!;
		expect(getSfxAssetById({ id: known.id })?.id).toBe(known.id);
		expect(getSfxAssetById({ id: "does-not-exist" })).toBeNull();
	});

	test("filterSfxByTag finds assets by their tag", () => {
		const happy = filterSfxByTag({ tag: "happy" });
		expect(happy.length).toBeGreaterThan(0);
		for (const asset of happy) {
			expect(asset.tags).toContain("happy");
		}
	});
});
