import "dotenv/config";
import express, { type Request, type Response } from "express";
import { emitUrgentDeficiencyEvent, registerTasks } from "../tasks/index.js";

type WebhookPayload = Record<string, unknown>;

const app = express();
const port = Number(process.env.WEBHOOK_PORT || 8787);

app.use(express.json());
registerTasks();

function acknowledgeWebhook(
	res: Response,
	type: string,
	payload: WebhookPayload,
): void {
	console.log(`[webhook:${type}] payload=${JSON.stringify(payload)}`);
	res.status(202).json({
		ok: true,
		received: true,
		type,
	});
}

function handlePingWebhook(req: Request, res: Response): void {
	const payload = (req.body || {}) as WebhookPayload;
	acknowledgeWebhook(res, "ping", payload);
}

function handleProjectReportAvailableWebhook(
	req: Request,
	res: Response,
): void {
	const payload = (req.body || {}) as WebhookPayload;
	acknowledgeWebhook(res, "project-report-available", payload);
}

function handleProjectArchivedWebhook(req: Request, res: Response): void {
	const payload = (req.body || {}) as WebhookPayload;
	acknowledgeWebhook(res, "project-archived", payload);
}

function handleUrgentDeficiencyWebhook(req: Request, res: Response): void {
	const payload = (req.body || {}) as WebhookPayload;
	acknowledgeWebhook(res, "urgent-deficiency", payload);
	emitUrgentDeficiencyEvent(payload);
}

app.get("/health", (_req, res) => {
	res.json({ ok: true, service: "webhook-receiver" });
});

app.post("/ping", handlePingWebhook);
app.post("/project-report-available", handleProjectReportAvailableWebhook);
app.post("/project-archived", handleProjectArchivedWebhook);
app.post("/urgent-deficiency", handleUrgentDeficiencyWebhook);

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
