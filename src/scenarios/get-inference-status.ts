import "dotenv/config";
import { createAccessToken } from "../api/auth.js";
import {
	createApiHttpClient,
	normalizeApiClientError,
} from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseStartImportScenarioConfig } from "../lib/config.js";

async function main(): Promise<void> {
	const config = parseStartImportScenarioConfig(
		process.argv,
		"get-inference-status",
	);

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
		`Token created (type=${token.token_type}, expires_in=${token.expires_in}s). Fetching inference status...`,
	);

	const http = createApiHttpClient({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		apiKey: config.apiKey,
		accessToken: token.access_token,
	});

	const response = await http
		.get<Record<string, unknown>>(
			`/projects/${config.projectId}/upload/inference_status`,
			{
				params: { flight_id: config.flightId },
			},
		)
		.then((statusResponse) => statusResponse.data)
		.catch((error: unknown) => {
			throw normalizeApiClientError(error, "Inference status fetch");
		});

	console.log("Inference status fetched successfully.");
	console.log(JSON.stringify(response, null, 2));
}

main().catch((error: unknown) => {
	console.error(
		`Error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
