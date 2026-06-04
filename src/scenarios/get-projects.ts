import "dotenv/config";
import { createAccessToken } from "../api/auth.js";
import {
	createApiHttpClient,
	normalizeApiClientError,
} from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseBaseScenarioConfig } from "../lib/config.js";

function parseOptionalStatusName(argv: string[]): string | undefined {
	const rawStatusName = argv[2]?.trim();
	if (!rawStatusName) {
		return undefined;
	}
	return rawStatusName;
}

async function main(): Promise<void> {
	const config = parseBaseScenarioConfig();
	const statusName = parseOptionalStatusName(process.argv);

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

	const http = createApiHttpClient({
		baseUrl: config.baseUrl,
		tenantId: config.tenantId,
		apiKey: config.apiKey,
		accessToken: token.access_token,
	});

	console.log(
		`Fetching projects${
			statusName ? ` with status_name=${statusName}` : ""
		}...`,
	);

	const projects = await http
		.get<unknown[]>("/projects", {
			params: statusName ? { status_name: statusName } : undefined,
		})
		.then((response) => response.data)
		.catch((error: unknown) => {
			throw normalizeApiClientError(error, "Projects fetch");
		});

	console.log(JSON.stringify(projects, null, 2));
}

main().catch((error: unknown) => {
	console.error(
		`Error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
