import { createAccessToken } from "../api/auth.js";
import { createApiHttpClient } from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";

export interface TaskTokenSession {
	http: ReturnType<typeof createApiHttpClient>;
	expiresAtMs: number;
}

export const TOKEN_REFRESH_BUFFER_MS = 60_000;

export function getRequiredNonNegativeInteger(
	input: unknown,
	fieldNames?: string | string[],
): number {
	if (fieldNames === undefined) {
		const parsed = Number(input);
		if (!Number.isInteger(parsed) || parsed < 0) {
			throw new Error(
				`Expected a non-negative integer. Received: ${String(input)}`,
			);
		}
		return parsed;
	}

	const keys = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
	const record = (input || {}) as Record<string, unknown>;

	for (const key of keys) {
		const parsed = Number(record[key]);
		if (Number.isInteger(parsed) && parsed >= 0) {
			return parsed;
		}
	}

	const rawValues = keys
		.map((key) => `${key}=${String(record[key])}`)
		.join(", ");
	throw new Error(
		`Expected a non-negative integer in one of [${keys.join(
			", ",
		)}]. Received: ${rawValues}`,
	);
}

export function formatElapsedMinutesSeconds(elapsedMs: number): string {
	const totalSeconds = Math.floor(elapsedMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m ${seconds}s`;
}

export async function createTokenSession(input: {
	baseUrl: string;
	tenantId: string;
	apiKey: string;
	origin?: string;
	publicKey: string;
	privateKey: string;
}): Promise<TaskTokenSession> {
	const assertionToken = await generateAssertionToken({
		baseUrl: input.baseUrl,
		tenantId: input.tenantId,
		publicKey: input.publicKey,
		privateKey: input.privateKey,
	});

	const token = await createAccessToken({
		baseUrl: input.baseUrl,
		tenantId: input.tenantId,
		apiKey: input.apiKey,
		origin: input.origin,
		assertionToken,
	});

	const http = createApiHttpClient({
		baseUrl: input.baseUrl,
		tenantId: input.tenantId,
		apiKey: input.apiKey,
		accessToken: token.access_token,
	});

	return {
		http,
		expiresAtMs: Date.now() + Math.max(token.expires_in, 0) * 1000,
	};
}
