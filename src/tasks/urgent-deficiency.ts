import { createAccessToken } from "../api/auth.js";
import {
	createApiHttpClient,
	normalizeApiClientError,
} from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseBaseScenarioConfig } from "../lib/config.js";

type UrgentDeficiencyPayload = Record<string, unknown>;

function getRequiredId(
	payload: UrgentDeficiencyPayload,
	fieldName: "project_id" | "image_object_id" | "image_object_type_id",
): number {
	const raw = payload[fieldName];
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(
			`Payload field ${fieldName} must be a non-negative integer. Received: ${String(
				raw,
			)}`,
		);
	}
	return parsed;
}

export async function runUrgentDeficiencyTask(
	payload: UrgentDeficiencyPayload,
): Promise<void> {
	try {
		const projectId = getRequiredId(payload, "project_id");
		const imageObjectId = getRequiredId(payload, "image_object_id");
		const imageObjectTypeId = getRequiredId(payload, "image_object_type_id");

		const config = parseBaseScenarioConfig();
		const assertionToken = await generateAssertionToken({
			baseUrl: config.baseUrl,
			tenantId: config.tenantId,
			publicKey: config.publicKey,
			privateKey: config.privateKey,
		});

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
			`[task:urgent-deficiency] started payload=${JSON.stringify(payload)}`,
		);

		const [imageObjectResponse, imageObjectTypeResponse] = await Promise.all([
			http
				.get<Record<string, unknown>>(
					`/projects/${projectId}/image_objects/${imageObjectId}`,
				)
				.catch((error: unknown) => {
					throw normalizeApiClientError(error, "Image object fetch");
				}),
			http
				.get<Record<string, unknown>>(
					`/projects/${projectId}/image_object_types/${imageObjectTypeId}`,
				)
				.catch((error: unknown) => {
					throw normalizeApiClientError(error, "Image object type fetch");
				}),
		]);

		const imageObject = imageObjectResponse.data;
		const imageObjectType = imageObjectTypeResponse.data;

		console.log(
			`[task:urgent-deficiency] image_object_type=${JSON.stringify(
				imageObjectType,
			)}`,
		);
		console.log(
			`[task:urgent-deficiency] image_object=${JSON.stringify(imageObject)}`,
		);

		console.log("[task:urgent-deficiency] completed");
	} catch (error: unknown) {
		console.error(
			`[task:urgent-deficiency] failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}
