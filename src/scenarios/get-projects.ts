import "dotenv/config";
import {
	createAccessToken,
	extractProjectIdsFromAccessToken,
} from "../api/auth.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseBaseScenarioConfig } from "../lib/config.js";

async function main(): Promise<void> {
	const config = parseBaseScenarioConfig();

	console.log("Generating assertion token from PRIVATE_KEY/PUBLIC_KEY...");
	const assertionToken = await generateAssertionToken({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		publicKey: config.publicKey,
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

	const projectIds = extractProjectIdsFromAccessToken(token.access_token);
	console.log(JSON.stringify({ project_ids: projectIds }, null, 2));
}

main().catch((error: unknown) => {
	console.error(
		`Error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
