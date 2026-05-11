import { describe, expect, test } from "bun:test";
import { cacheKeyForText } from "../tts-cache";

describe("cacheKeyForText", () => {
	test("returns the same key for the same text", () => {
		expect(cacheKeyForText("Xin chào")).toBe(cacheKeyForText("Xin chào"));
	});

	test("returns different keys for different text", () => {
		expect(cacheKeyForText("Xin chào")).not.toBe(cacheKeyForText("Tạm biệt"));
	});

	test("is whitespace-sensitive", () => {
		expect(cacheKeyForText("a b")).not.toBe(cacheKeyForText("ab"));
	});
});
