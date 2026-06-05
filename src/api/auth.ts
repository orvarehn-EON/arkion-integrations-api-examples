import axios from "axios";
import { decodeJwt } from "jose";
import type { TokenResponse } from "../lib/types.js";
import {
	executeWithUsagePlanRetry,
	normalizeApiClientError,
} from "./http-client.js";

export async function createAccessToken(input: {
	baseUrl: string;
	tenantId: string;
	apiKey: string;
	origin?: string;
	assertionToken: string;
}): Promise<TokenResponse> {
	const headers: Record<string, string> = {
		"x-api-key": input.apiKey,
		"Content-Type": "application/json",
	};

	if (input.origin && input.origin.trim().length > 0) {
		headers.Origin = input.origin;
	}

	try {
		const response = await executeWithUsagePlanRetry({
			context: "Token exchange",
			request: () =>
				axios.post<Partial<TokenResponse>>(
					`${input.baseUrl}/tenant/${encodeURIComponent(
						input.tenantId,
					)}/auth/token`,
					{ token: input.assertionToken },
					{
						headers,
					},
				),
		});

		const parsed = response.data;

		if (!parsed.access_token || !parsed.token_type) {
			throw new Error("Token response is missing required fields.");
		}

		return {
			access_token: parsed.access_token,
			token_type: parsed.token_type,
			expires_in: Number(parsed.expires_in || 0),
		};
	} catch (error: unknown) {
		throw normalizeApiClientError(error, "Token exchange");
	}
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
