import "dotenv/config";
import { createAccessToken } from "../../api/auth.js";
import { fetchProject } from "../../api/project.js";
import { renderApiError } from "../../api/utils.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseScenarioConfig } from "../lib/config.js";

async function main(): Promise<void> {
	const config = parseScenarioConfig(process.argv);

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

	console.log(
		`Token created (type=${token.token_type}, expires_in=${token.expires_in}s). Fetching project...`,
	);

	const project = await fetchProject({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		projectId: config.projectId,
		apiKey: config.apiKey,
		accessToken: token.access_token,
	});

	console.log("Project fetched successfully.");
	console.log(JSON.stringify(project, null, 2));
}

main().catch((error: unknown) => {
	console.error(`Error: ${renderApiError(error)}`);
	process.exitCode = 1;
});
