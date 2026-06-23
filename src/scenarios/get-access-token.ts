import "dotenv/config";
import { createAccessToken } from "../api/auth.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseBaseScenarioConfig } from "../lib/config.js";

async function main(): Promise<void> {
	const config = parseBaseScenarioConfig();

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
		JSON.stringify(
			{
				access_token: token.access_token,
				token_type: token.token_type,
				expires_in: token.expires_in,
			},
			null,
			2,
		),
	);
}

main().catch((error: unknown) => {
	if (error instanceof Error) {
		console.error(`Error: ${error.message}`);
		if (error.stack) {
			console.error(`Stack: ${error.stack}`);
		}
		if (error.cause) {
			console.error(`Cause: ${error.cause}`);
		}
	} else {
		console.error(`Error: ${String(error)}`);
	}
	process.exitCode = 1;
});
