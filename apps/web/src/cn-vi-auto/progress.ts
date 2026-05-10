import type { PipelineProgress, PipelineStage } from "./types";

type Listener = (progress: PipelineProgress) => void;

export interface PipelineEmitter {
	on(listener: Listener): () => void;
	emit(progress: PipelineProgress): void;
	stage(stage: PipelineStage, message?: string): void;
	progress(args: {
		stage: PipelineStage;
		current: number;
		total: number;
		message?: string;
	}): void;
}

export function createPipelineEmitter(): PipelineEmitter {
	const listeners = new Set<Listener>();

	function emit(progress: PipelineProgress) {
		for (const l of listeners) l(progress);
	}

	return {
		on(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		emit,
		stage(stage, message) {
			emit({ stage, current: 0, total: 1, message });
		},
		progress({ stage, current, total, message }) {
			emit({ stage, current, total, message });
		},
	};
}
