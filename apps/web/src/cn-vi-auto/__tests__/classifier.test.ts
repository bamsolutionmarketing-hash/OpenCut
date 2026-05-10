import { describe, expect, test } from "bun:test";
import { classifyCue, tokenizeVietnamese } from "../sfx/classifier";

describe("tokenizeVietnamese", () => {
	test("strips diacritics and lowercases", () => {
		expect(tokenizeVietnamese({ text: "Xin chào, bạn có vui không?" })).toBe(
			"xin chao ban co vui khong",
		);
	});

	test("handles uppercase đ", () => {
		expect(tokenizeVietnamese({ text: "Đầy đủ" })).toBe("day du");
	});

	test("collapses whitespace", () => {
		expect(tokenizeVietnamese({ text: "a    b\n\tc" })).toBe("a b c");
	});
});

describe("classifyCue", () => {
	test("happy keyword maps to happy", () => {
		expect(classifyCue({ text: "Hôm nay tôi rất vui." })).toContain("happy");
	});

	test("sad keyword maps to sad", () => {
		expect(classifyCue({ text: "Tôi buồn quá." })).toContain("sad");
	});

	test("question mark adds question tag", () => {
		expect(classifyCue({ text: "Bạn có khỏe không?" })).toContain("question");
	});

	test("exclamation mark adds exclaim tag", () => {
		expect(classifyCue({ text: "Tuyệt vời!" })).toContain("exclaim");
	});

	test("ellipsis adds suspense tag", () => {
		expect(classifyCue({ text: "Đợi đã..." })).toContain("suspense");
	});

	test("Unicode ellipsis adds suspense tag", () => {
		expect(classifyCue({ text: "Đợi đã…" })).toContain("suspense");
	});

	test("negation flips happy → sad", () => {
		const tags = classifyCue({ text: "Tôi không vui chút nào." });
		expect(tags).toContain("sad");
		expect(tags).not.toContain("happy");
	});

	test("laughing returns laugh tag", () => {
		expect(classifyCue({ text: "haha buồn cười quá" })).toContain("laugh");
	});

	test("romantic phrase returns romantic", () => {
		expect(classifyCue({ text: "Anh yêu em rất nhiều." })).toContain(
			"romantic",
		);
	});

	test("empty content yields neutral", () => {
		expect(classifyCue({ text: "" })).toEqual(["neutral"]);
	});

	test("fully neutral sentence yields neutral", () => {
		expect(classifyCue({ text: "Hôm nay là thứ ba." })).toEqual(["neutral"]);
	});

	test("multiple emotions can coexist", () => {
		const tags = classifyCue({ text: "Vui quá! Tuyệt vời!" });
		expect(tags).toContain("happy");
		expect(tags).toContain("exclaim");
	});

	test("surprise via 'wow'", () => {
		expect(classifyCue({ text: "wow đẹp quá" })).toContain("surprise");
	});

	test("suspense via keyword 'nguy hiểm'", () => {
		expect(classifyCue({ text: "Cẩn thận, nguy hiểm." })).toContain("suspense");
	});

	test("cry → sad", () => {
		expect(classifyCue({ text: "Cô ấy đang khóc" })).toContain("sad");
	});

	test("never returns empty array", () => {
		expect(classifyCue({ text: "abc xyz" }).length).toBeGreaterThan(0);
	});
});
