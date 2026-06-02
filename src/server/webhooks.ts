import "dotenv/config";
import express, { type Request, type Response } from "express";
import { emitUrgentDeficiencyEvent, registerTasks } from "../tasks/index.js";
import { verifyWebhookToken } from "./webhook-auth.js";

type WebhookPayload = Record<string, unknown>;

const app = express();
const port = Number(process.env.WEBHOOK_PORT || 8787);

app.use(express.json());
registerTasks();

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
		console.log(
			`[webhook:project-report-available] payload=${JSON.stringify(
				req.body || {},
			)}`,
		);
		res.sendStatus(204);
	},
);
app.post(
	"/project-archived",
	verifyWebhookToken,
	(req: Request, res: Response) => {
		console.log(
			`[webhook:project-archived] payload=${JSON.stringify(req.body || {})}`,
		);
		res.sendStatus(204);
	},
);
app.post(
	"/urgent-deficiency",
	verifyWebhookToken,
	(req: Request, res: Response) => {
		const payload = (req.body || {}) as WebhookPayload;
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
