import type { EmotionTag, MatchedCue } from "../types";
import type { ClassifiedCue } from "../types";
import { EMOTION_KEYWORDS, NEGATION_WORDS } from "./keywords-vi";

/**
 * Strip Vietnamese diacritics and lowercase. Keeps spaces and `?!.`.
 * Used for keyword matching only — display text keeps full diacritics.
 */
export function tokenizeVietnamese({ text }: { text: string }): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/đ/g, "d")
		.replace(/[^a-z0-9 ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** True when `keyword` (already normalized) appears as a whole-word match in `normalized`. */
function containsWord({
	normalized,
	keyword,
}: {
	normalized: string;
	keyword: string;
}): boolean {
	const padded = ` ${normalized} `;
	return padded.includes(` ${keyword} `);
}

function hasNegationNear({
	normalized,
	keywordIndex,
}: {
	normalized: string;
	keywordIndex: number;
}): boolean {
	const window = normalized.slice(Math.max(0, keywordIndex - 30), keywordIndex);
	for (const neg of NEGATION_WORDS) {
		if (window.includes(neg)) return true;
	}
	return false;
}

/**
 * Classify a single line of Vietnamese text into emotion tags.
 * Rules:
 *   1. Keyword match per category (whole-word, diacritic-insensitive)
 *   2. Negation flip: `không + happy/laugh/romantic` → demote to `sad`
 *   3. Punctuation: `?` → adds `question`; `!` → adds `exclaim`; `...` → adds `suspense`
 *   4. Empty → `neutral`
 */
export function classifyCue({ text }: { text: string }): EmotionTag[] {
	const normalized = tokenizeVietnamese({ text });
	const tags = new Set<EmotionTag>();
	let flippedToSad = false;

	for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as [
		EmotionTag,
		string[],
	][]) {
		for (const keyword of keywords) {
			if (!containsWord({ normalized, keyword })) continue;
			const idx = normalized.indexOf(keyword);
			const negated =
				(emotion === "happy" ||
					emotion === "laugh" ||
					emotion === "romantic") &&
				hasNegationNear({ normalized, keywordIndex: idx });
			if (negated) {
				flippedToSad = true;
				continue;
			}
			tags.add(emotion);
		}
	}

	if (flippedToSad) tags.add("sad");

	if (text.includes("?")) tags.add("question");
	if (text.includes("!")) tags.add("exclaim");
	if (text.includes("...") || text.includes("…")) tags.add("suspense");

	if (tags.size === 0) tags.add("neutral");
	return [...tags];
}

export function classifyAllCues({
	cues,
}: {
	cues: MatchedCue[];
}): ClassifiedCue[] {
	return cues.map((cue) => ({
		...cue,
		emotions: classifyCue({ text: cue.text }),
	}));
}
