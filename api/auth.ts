import type { TokenResponse } from "../src/lib/types.js";
import { decodeJwt } from "jose";
import { ensureOk } from "./utils.js";

export async function createAccessToken(input: {
	baseUrl: string;
	tenantId: string;
	apiKey: string;
	origin: string;
	assertionToken: string;
}): Promise<TokenResponse> {
	const url = `${input.baseUrl}/tenant/${encodeURIComponent(
		input.tenantId,
	)}/auth/token`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"x-api-key": input.apiKey,
			Origin: input.origin,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ token: input.assertionToken }),
	});

	await ensureOk(response, "Token exchange");
	const parsed = (await response.json()) as Partial<TokenResponse>;

	if (!parsed.access_token || !parsed.token_type) {
		throw new Error("Token response is missing required fields.");
	}

	return {
		access_token: parsed.access_token,
		token_type: parsed.token_type,
		expires_in: Number(parsed.expires_in || 0),
	};
}

export function extractProjectIdsFromAccessToken(
	accessToken: string,
): number[] {
	const payload = decodeJwt(accessToken) as {
		scopes?: { project_ids?: unknown };
	};

	const rawProjectIds = payload.scopes?.project_ids;
	if (!Array.isArray(rawProjectIds)) {
		throw new Error(
			"Access token does not contain scopes.project_ids as an array.",
		);
	}

	const projectIds = rawProjectIds.map((value) => Number(value));
	if (projectIds.some((value) => !Number.isInteger(value) || value < 0)) {
		throw new Error("Access token scopes.project_ids contains invalid values.");
	}

	return projectIds;
}
