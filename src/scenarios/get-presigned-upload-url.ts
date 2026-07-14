import "dotenv/config";
import { createAccessToken } from "../api/auth.js";
import {
	createApiHttpClient,
	normalizeApiClientError,
} from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parsePresignedUploadUrlScenarioConfig } from "../lib/config.js";

async function main(): Promise<void> {
	const config = parsePresignedUploadUrlScenarioConfig(
		process.argv,
		"get-presigned-upload-url",
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
		`Token created (type=${token.token_type}, expires_in=${token.expires_in}s). Fetching presigned upload URL...`,
	);

	const http = createApiHttpClient({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		apiKey: config.apiKey,
		accessToken: token.access_token,
	});

	const presignedUploadUrl = await http
		.get<Record<string, unknown>>(
			`/projects/${config.projectId}/upload/presigned_upload_url`,
			{
				params: {
					filename: config.filename,
					flight_id: config.flightId,
				},
			},
		)
		.then((response) => response.data)
		.catch((error: unknown) => {
			throw normalizeApiClientError(error, "Presigned upload URL fetch");
		});

	console.log("Presigned upload URL fetched successfully.");
	console.log(JSON.stringify(presignedUploadUrl, null, 2));
}

main().catch((error: unknown) => {
	console.error(
		`Error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
