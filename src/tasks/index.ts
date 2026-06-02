import { EventEmitter } from "node:events";
import { runUrgentDeficiencyTask } from "./urgent-deficiency.js";

type UrgentDeficiencyPayload = Record<string, unknown>;

const taskEvents = new EventEmitter();
const URGENT_DEFICIENCY_EVENT = "urgent-deficiency.received";

let areTasksRegistered = false;

export function registerTasks(): void {
	if (areTasksRegistered) {
		return;
	}
	areTasksRegistered = true;

	taskEvents.on(URGENT_DEFICIENCY_EVENT, (payload: UrgentDeficiencyPayload) => {
		// Keep webhook response fast by scheduling task work in the background.
		setImmediate(() => {
			void runUrgentDeficiencyTask(payload);
		});
	});
}

export function emitUrgentDeficiencyEvent(
	payload: UrgentDeficiencyPayload,
): void {
	taskEvents.emit(URGENT_DEFICIENCY_EVENT, payload);
}
