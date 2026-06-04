import "dotenv/config";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
	emitProjectArchivedEvent,
	emitProjectReportAvailableEvent,
	emitUrgentDeficiencyEvent,
	registerTasks,
} from "../tasks/index.js";
import { verifyWebhookToken } from "./webhook-auth.js";

type WebhookPayload = Record<string, unknown>;

const app = express();
const port = Number(process.env.WEBHOOK_PORT || 8787);
const nonNegativeInt = z.coerce.number().int().nonnegative();
const projectScopedPayloadSchema = z.object({
	project_id: nonNegativeInt,
});
const urgentDeficiencyPayloadSchema = z.object({
	project_id: nonNegativeInt,
	image_object_id: nonNegativeInt,
	image_object_type_id: nonNegativeInt,
});

app.use(express.json());
registerTasks();

function parsePayload(req: Request): WebhookPayload {
	return (req.body || {}) as WebhookPayload;
}

function validatePayload<T extends z.ZodTypeAny>(
	res: Response,
	schema: T,
	payload: WebhookPayload,
): z.infer<T> | null {
	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		res.status(400).json({
			error: "Invalid webhook payload.",
			details: parsed.error.issues.map((issue) => ({
				field: issue.path.join("."),
				message: issue.message,
			})),
		});
		return null;
	}

	return parsed.data;
}

app.get("/health", (_req, res) => {
	res.json({ ok: true, service: "webhook-receiver" });
});

app.post("/ping", verifyWebhookToken, (req: Request, res: Response) => {
	console.log(`[webhook:ping] payload=${JSON.stringify(req.body || {})}`);
	res.sendStatus(204);
});
app.post(
	"/project-report-available",
	verifyWebhookToken,
	(req: Request, res: Response) => {
		const payload = parsePayload(req);
		if (!validatePayload(res, projectScopedPayloadSchema, payload)) {
			return;
		}

		console.log(
			`[webhook:project-report-available] payload=${JSON.stringify(payload)}`,
		);
		emitProjectReportAvailableEvent(payload);
		res.sendStatus(204);
	},
);
app.post(
	"/project-archived",
	verifyWebhookToken,
	(req: Request, res: Response) => {
		const payload = parsePayload(req);
		if (!validatePayload(res, projectScopedPayloadSchema, payload)) {
			return;
		}

		console.log(
			`[webhook:project-archived] payload=${JSON.stringify(payload)}`,
		);
		emitProjectArchivedEvent(payload);
		res.sendStatus(204);
	},
);
app.post(
	"/urgent-deficiency",
	verifyWebhookToken,
	(req: Request, res: Response) => {
		const payload = parsePayload(req);
		if (!validatePayload(res, urgentDeficiencyPayloadSchema, payload)) {
			return;
		}

		console.log(
			`[webhook:urgent-deficiency] payload=${JSON.stringify(payload)}`,
		);
		emitUrgentDeficiencyEvent(payload);
		res.sendStatus(204);
	},
);

app.use((_req, res) => {
	res.status(404).json({
		error: "Route not found.",
		available_routes: [
			"GET /health",
			"POST /ping",
			"POST /project-report-available",
			"POST /project-archived",
			"POST /urgent-deficiency",
		],
	});
});

app.listen(port, () => {
	console.log(`Webhook receiver listening on http://localhost:${port}`);
});
