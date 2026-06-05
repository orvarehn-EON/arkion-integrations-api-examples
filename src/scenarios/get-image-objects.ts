import "dotenv/config";
import { createAccessToken } from "../api/auth.js";
import {
	createApiHttpClient,
	normalizeApiClientError,
} from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseProjectImageScenarioConfig } from "../lib/config.js";

async function main(): Promise<void> {
	const config = parseProjectImageScenarioConfig(
		process.argv,
		"get-image-objects",
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
		`Token created (type=${token.token_type}, expires_in=${token.expires_in}s). Fetching image objects...`,
	);

	const http = createApiHttpClient({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		apiKey: config.apiKey,
		accessToken: token.access_token,
	});

	const imageObjects = await http
		.get<Record<string, unknown>>(
			`/projects/${config.projectId}/images/${config.imageId}/image_objects`,
		)
		.then((response) => response.data)
		.catch((error: unknown) => {
			throw normalizeApiClientError(error, "Image objects fetch");
		});

	console.log("Image objects fetched successfully.");
	console.log(JSON.stringify(imageObjects, null, 2));
}

main().catch((error: unknown) => {
	console.error(
		`Error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
