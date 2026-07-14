import "dotenv/config";
import { createAccessToken } from "../api/auth.js";
import {
	createApiHttpClient,
	normalizeApiClientError,
} from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseCreateFlightScenarioConfig } from "../lib/config.js";

function formatTodayDate(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

async function main(): Promise<void> {
	const config = parseCreateFlightScenarioConfig(process.argv, "create-flight");

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
		`Token created (type=${token.token_type}, expires_in=${token.expires_in}s). Creating flight...`,
	);

	const http = createApiHttpClient({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		apiKey: config.apiKey,
		accessToken: token.access_token,
	});

	const flight = await http
		.post<Record<string, unknown>>(`/projects/${config.projectId}/flights`, {
			date: formatTodayDate(),
			flight_folder: config.flightFolder,
			name: config.name,
			meta: config.meta,
		})
		.then((response) => response.data)
		.catch((error: unknown) => {
			throw normalizeApiClientError(error, "Flight creation");
		});

	console.log("Flight created successfully.");
	console.log(JSON.stringify(flight, null, 2));
}

main().catch((error: unknown) => {
	console.error(
		`Error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
