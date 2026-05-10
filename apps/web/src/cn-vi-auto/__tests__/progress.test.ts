import { describe, expect, test } from "bun:test";
import { createPipelineEmitter } from "../progress";
import type { PipelineProgress } from "../types";

describe("PipelineEmitter", () => {
	test("on/emit delivers events to listener", () => {
		const e = createPipelineEmitter();
		const events: PipelineProgress[] = [];
		e.on((p) => events.push(p));
		e.stage("ocr", "starting");
		expect(events).toHaveLength(1);
		expect(events[0]!.stage).toBe("ocr");
		expect(events[0]!.message).toBe("starting");
	});

	test("returned unsubscribe stops further deliveries", () => {
		const e = createPipelineEmitter();
		const events: PipelineProgress[] = [];
		const off = e.on((p) => events.push(p));
		e.stage("ocr");
		off();
		e.stage("matching");
		expect(events).toHaveLength(1);
	});

	test("progress() carries current/total", () => {
		const e = createPipelineEmitter();
		const events: PipelineProgress[] = [];
		e.on((p) => events.push(p));
		e.progress({ stage: "generating-tts", current: 3, total: 10 });
		expect(events[0]!.current).toBe(3);
		expect(events[0]!.total).toBe(10);
	});
});
