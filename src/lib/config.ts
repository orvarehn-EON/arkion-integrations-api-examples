export interface BaseScenarioConfig {
	baseUrl: string;
	tenantId: string;
	apiKey: string;
	origin: string;
	publicKey: string;
	privateKey: string;
}

export interface ScenarioConfig extends BaseScenarioConfig {
	projectId: number;
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value || value.trim().length === 0) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function parseProjectId(raw: string): number {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(
			`Invalid project_id: ${raw}. It must be a non-negative integer.`,
		);
	}
	return parsed;
}

function normalizePem(key: string): string {
	return key.replace(/\\n/g, "\n").trim();
}

export function parseScenarioConfig(argv: string[]): ScenarioConfig {
	const rawProjectId = argv[2];

	if (!rawProjectId) {
		throw new Error(
			"Usage: node dist/src/scenarios/get-project.js <project_id>",
		);
	}

	return {
		...parseBaseScenarioConfig(),
		projectId: parseProjectId(rawProjectId),
	};
}

export function parseBaseScenarioConfig(): BaseScenarioConfig {
	const tenantId = requireEnv("TENANT_ID");

	return {
		baseUrl:
			process.env.INTEGRATIONS_BASE_URL?.trim() ||
			"https://integrations-gateway.dev.arkion.co",
		tenantId,
		apiKey: requireEnv("INTEGRATIONS_API_KEY"),
		origin: requireEnv("INTEGRATIONS_ORIGIN"),
		publicKey: normalizePem(requireEnv("PUBLIC_KEY")),
		privateKey: normalizePem(requireEnv("PRIVATE_KEY")),
	};
}
