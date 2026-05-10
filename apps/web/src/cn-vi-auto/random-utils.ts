export interface SeededRng {
	next(): number;
	int(min: number, max: number): number;
	float(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
	bool(probability: number): boolean;
	fork(salt: number): SeededRng;
}

export function createSeededRng(seed: number): SeededRng {
	let state = seed >>> 0;
	if (state === 0) state = 0x9e3779b9;

	function next(): number {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	function int(min: number, max: number): number {
		return Math.floor(next() * (max - min + 1)) + min;
	}

	function float(min: number, max: number): number {
		return min + next() * (max - min);
	}

	function pick<T>(items: readonly T[]): T {
		if (items.length === 0) {
			throw new Error("Cannot pick from empty array");
		}
		return items[int(0, items.length - 1)] as T;
	}

	function bool(probability: number): boolean {
		return next() < probability;
	}

	function fork(salt: number): SeededRng {
		const childSeed = (state ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
		return createSeededRng(childSeed);
	}

	return { next, int, float, pick, bool, fork };
}

export function randomSeed(): number {
	return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function hashString(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}
