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

export interface ScenarioWithExtraParameterConfig extends ScenarioConfig {
	extraParameter: number;
}

export interface CreateFlightScenarioConfig extends ScenarioConfig {
	flightFolder: string;
	name: string;
	meta: Record<string, unknown>;
}

export interface PresignedUploadUrlScenarioConfig extends ScenarioConfig {
	filename: string;
	flightId: number;
}

export interface StartImportScenarioConfig extends ScenarioConfig {
	flightId: number;
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

function parseRequiredNumber(raw: string, parameterName: string): number {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(
			`Invalid ${parameterName}: ${raw}. It must be a non-negative integer.`,
		);
	}
	return parsed;
}

function parseRequiredString(raw: string, argumentName: string): string {
	const value = raw.trim();
	if (value.length === 0) {
		throw new Error(`Invalid ${argumentName}: value must not be empty.`);
	}
	return value;
}

function parseJsonObject(
	raw: string,
	argumentName: string,
): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(
			`Invalid ${argumentName}: expected a valid JSON object string.`,
		);
	}

	if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
		throw new Error(
			`Invalid ${argumentName}: expected a JSON object, for example '{"key":{}}'.`,
		);
	}

	return parsed as Record<string, unknown>;
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

export function parseExtraParameterScenarioConfig(
	argv: string[],
	scenarioName: string,
	extraParameterName: string,
): ScenarioWithExtraParameterConfig {
	const rawProjectId = argv[2];
	const rawExtraParameter = argv[3];

	if (!rawProjectId || !rawExtraParameter) {
		throw new Error(
			`Usage: node dist/src/scenarios/${scenarioName}.js <project_id> <${extraParameterName}>`,
		);
	}

	return {
		...parseBaseScenarioConfig(),
		projectId: parseProjectId(rawProjectId),
		extraParameter: parseRequiredNumber(
			rawExtraParameter,
			extraParameterName,
		),
	};
}

export function parseCreateFlightScenarioConfig(
	argv: string[],
	scenarioName: string,
): CreateFlightScenarioConfig {
	const rawProjectId = argv[2];
	const rawFlightFolder = argv[3];
	const rawName = argv[4];
	const rawMeta = argv[5];

	if (!rawProjectId || !rawFlightFolder || !rawName || !rawMeta) {
		throw new Error(
			`Usage: node dist/src/scenarios/${scenarioName}.js <project_id> <flight_folder> <name> <meta_json>`,
		);
	}

	return {
		...parseBaseScenarioConfig(),
		projectId: parseProjectId(rawProjectId),
		flightFolder: parseRequiredString(rawFlightFolder, "flight_folder"),
		name: parseRequiredString(rawName, "name"),
		meta: parseJsonObject(rawMeta, "meta_json"),
	};
}

export function parsePresignedUploadUrlScenarioConfig(
	argv: string[],
	scenarioName: string,
): PresignedUploadUrlScenarioConfig {
	const rawProjectId = argv[2];
	const rawFilename = argv[3];
	const rawFlightId = argv[4];

	if (!rawProjectId || !rawFilename || !rawFlightId) {
		throw new Error(
			`Usage: node dist/src/scenarios/${scenarioName}.js <project_id> <filename> <flight_id>`,
		);
	}

	return {
		...parseBaseScenarioConfig(),
		projectId: parseProjectId(rawProjectId),
		filename: parseRequiredString(rawFilename, "filename"),
		flightId: parseRequiredNumber(rawFlightId, "flight_id"),
	};
}

export function parseStartImportScenarioConfig(
	argv: string[],
	scenarioName: string,
): StartImportScenarioConfig {
	const rawProjectId = argv[2];
	const rawFlightId = argv[3];

	if (!rawProjectId || !rawFlightId) {
		throw new Error(
			`Usage: node dist/src/scenarios/${scenarioName}.js <project_id> <flight_id>`,
		);
	}

	return {
		...parseBaseScenarioConfig(),
		projectId: parseProjectId(rawProjectId),
		flightId: parseRequiredNumber(rawFlightId, "flight_id"),
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
