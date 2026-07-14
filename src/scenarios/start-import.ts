import "dotenv/config";
import { createAccessToken } from "../api/auth.js";
import {
	createApiHttpClient,
	normalizeApiClientError,
} from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseStartImportScenarioConfig } from "../lib/config.js";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 120;

interface InferenceStatusResponse {
	status?: unknown;
	[key: string]: unknown;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
	const config = parseStartImportScenarioConfig(process.argv, "start-import");

	console.log("Generating assertion token from PRIVATE_KEY/PUBLIC_KEY...");
	const assertionToken = await generateAssertionToken({
		privateKey: config.privateKey,
	});

	console.log("Creating access token...");
	const token = await createAccessToken({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		apiKey: config.apiKey,
		origin: config.origin,
		assertionToken,
	});

	console.log(
		`Token created (type=${token.token_type}, expires_in=${token.expires_in}s). Starting import...`,
	);

	const http = createApiHttpClient({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		apiKey: config.apiKey,
		accessToken: token.access_token,
	});

	const startImportResponse = await http
		.post<Record<string, unknown>>(
			`/projects/${config.projectId}/upload/start_import`,
			{
				flight_id: config.flightId,
			},
		)
		.then((response) => response.data)
		.catch((error: unknown) => {
			throw normalizeApiClientError(error, "Import start");
		});

	console.log("Import start response:");
	console.log(JSON.stringify(startImportResponse, null, 2));
	console.log("Import started. Polling inference status...");

	for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
		const response = await http
			.get<InferenceStatusResponse>(
				`/projects/${config.projectId}/upload/inference_status`,
				{
					params: { flight_id: config.flightId },
				},
			)
			.then((statusResponse) => statusResponse.data)
			.catch((error: unknown) => {
				throw normalizeApiClientError(error, "Inference status fetch");
			});

		const rawStatus = response.status;
		if (typeof rawStatus !== "string") {
			throw new Error(
				`Inference status response is missing a string "status": ${JSON.stringify(
					response,
				)}`,
			);
		}

		const normalizedStatus = rawStatus.trim().toLowerCase();
		console.log(`Poll ${attempt}/${MAX_POLL_ATTEMPTS}: status=${rawStatus}`);

		if (normalizedStatus !== "pending") {
			console.log("Inference finished.");
			console.log(JSON.stringify(response, null, 2));

			if (normalizedStatus === "failed" || normalizedStatus === "error") {
				throw new Error(`Import finished with status=${rawStatus}.`);
			}

			return;
		}

		if (attempt < MAX_POLL_ATTEMPTS) {
			await wait(POLL_INTERVAL_MS);
		}
	}

	throw new Error(
		`Inference status stayed pending after ${MAX_POLL_ATTEMPTS} polls (${(
			(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) /
			1000
		).toFixed(0)}s).`,
	);
}

main().catch((error: unknown) => {
	console.error(
		`Error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
