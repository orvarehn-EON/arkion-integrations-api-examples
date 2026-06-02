export interface BaseScenarioConfig {
	baseUrl: string;
	tenantId: string;
	apiKey: string;
	origin?: string;
	publicKey: string;
	privateKey: string;
}

export interface ScenarioConfig extends BaseScenarioConfig {
	projectId: number;
}

export interface ScenarioWithImageConfig extends ScenarioConfig {
	imageId: number;
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value || value.trim().length === 0) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function parseNonNegativeInteger(raw: string, argumentName: string): number {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(
			`Invalid ${argumentName}: ${raw}. It must be a non-negative integer.`,
		);
	}
	return parsed;
}

function parseProjectId(raw: string): number {
	return parseNonNegativeInteger(raw, "project_id");
}

function parseImageId(raw: string): number {
	return parseNonNegativeInteger(raw, "image_id");
}

function normalizePem(key: string): string {
	return key.replace(/\\n/g, "\n").trim();
}

export function parseScenarioConfig(argv: string[]): ScenarioConfig {
	return parseProjectScenarioConfig(argv, "get-project");
}

export function parseProjectScenarioConfig(
	argv: string[],
	scenarioName: string,
): ScenarioConfig {
	const rawProjectId = argv[2];

	if (!rawProjectId) {
		throw new Error(
			`Usage: node dist/src/scenarios/${scenarioName}.js <project_id>`,
		);
	}

	return {
		...parseBaseScenarioConfig(),
		projectId: parseProjectId(rawProjectId),
	};
}

export function parseProjectImageScenarioConfig(
	argv: string[],
	scenarioName: string,
): ScenarioWithImageConfig {
	const rawProjectId = argv[2];
	const rawImageId = argv[3];

	if (!rawProjectId || !rawImageId) {
		throw new Error(
			`Usage: node dist/src/scenarios/${scenarioName}.js <project_id> <image_id>`,
		);
	}

	return {
		...parseBaseScenarioConfig(),
		projectId: parseProjectId(rawProjectId),
		imageId: parseImageId(rawImageId),
	};
}

export function parseBaseScenarioConfig(): BaseScenarioConfig {
	const tenantId = requireEnv("TENANT_ID");
	const origin = process.env.INTEGRATIONS_ORIGIN?.trim();

	return {
		baseUrl:
			process.env.INTEGRATIONS_BASE_URL?.trim() ||
			"https://integrations-gateway.dev.arkion.co",
		tenantId,
		apiKey: requireEnv("INTEGRATIONS_API_KEY"),
		origin: origin && origin.length > 0 ? origin : undefined,
		publicKey: normalizePem(requireEnv("PUBLIC_KEY")),
		privateKey: normalizePem(requireEnv("PRIVATE_KEY")),
	};
}
