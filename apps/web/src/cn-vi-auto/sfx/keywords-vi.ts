import type { EmotionTag } from "../types";

/**
 * Vietnamese keyword → emotion map.
 * Keywords are stored in their normalized (diacritic-stripped, lowercase) form
 * — the classifier strips diacritics from input before matching.
 */
export const EMOTION_KEYWORDS: Record<EmotionTag, string[]> = {
	happy: [
		"vui",
		"hanh phuc",
		"yeu doi",
		"phan khoi",
		"thich",
		"sung suong",
		"tuyet voi",
		"tuyet",
		"hay qua",
		"chuc mung",
	],
	laugh: [
		"haha",
		"hihi",
		"buon cuoi",
		"hai huoc",
		"cuoi",
		"loi cuoi",
		"vui nhon",
	],
	sad: [
		"buon",
		"dau long",
		"khoc",
		"nuoc mat",
		"co don",
		"chia tay",
		"that vong",
		"kho",
		"dau",
		"thuong",
	],
	surprise: [
		"bat ngo",
		"ngac nhien",
		"khong ngo",
		"thay troi",
		"oh",
		"oi",
		"a",
		"wow",
	],
	suspense: [
		"nguy hiem",
		"so",
		"cam giac",
		"bi an",
		"hoi hop",
		"can than",
		"lo lang",
		"khan cap",
	],
	romantic: [
		"yeu",
		"em yeu",
		"anh yeu",
		"tinh yeu",
		"trai tim",
		"hen ho",
		"lang man",
		"nho em",
		"nho anh",
	],
	question: [],
	exclaim: [],
	neutral: [],
};

/** Negation words — flip happy/laugh/romantic to sad. */
export const NEGATION_WORDS = ["khong", "chang", "chua", "khong phai"];
