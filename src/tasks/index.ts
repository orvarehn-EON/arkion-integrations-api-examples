import { EventEmitter } from "node:events";
import { runProjectArchivedTask } from "./project-archived.js";
import { runProjectReportAvailableTask } from "./project-report-available.js";
import { runUrgentDeficiencyTask } from "./urgent-deficiency.js";

type ProjectArchivedPayload = Record<string, unknown>;
type ProjectReportAvailablePayload = Record<string, unknown>;
type UrgentDeficiencyPayload = Record<string, unknown>;

const taskEvents = new EventEmitter();
const PROJECT_ARCHIVED_EVENT = "project-archived.received";
const PROJECT_REPORT_AVAILABLE_EVENT = "project-report-available.received";
const URGENT_DEFICIENCY_EVENT = "urgent-deficiency.received";

let areTasksRegistered = false;

export function registerTasks(): void {
	if (areTasksRegistered) {
		return;
	}
	areTasksRegistered = true;

	taskEvents.on(PROJECT_ARCHIVED_EVENT, (payload: ProjectArchivedPayload) => {
		// Keep webhook response fast by scheduling task work in the background.
		setImmediate(() => {
			void runProjectArchivedTask(payload);
		});
	});

	taskEvents.on(
		PROJECT_REPORT_AVAILABLE_EVENT,
		(payload: ProjectReportAvailablePayload) => {
			// Keep webhook response fast by scheduling task work in the background.
			setImmediate(() => {
				void runProjectReportAvailableTask(payload);
			});
		},
	);

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

export function emitProjectReportAvailableEvent(
	payload: ProjectReportAvailablePayload,
): void {
	taskEvents.emit(PROJECT_REPORT_AVAILABLE_EVENT, payload);
}

export function emitProjectArchivedEvent(
	payload: ProjectArchivedPayload,
): void {
	taskEvents.emit(PROJECT_ARCHIVED_EVENT, payload);
}
