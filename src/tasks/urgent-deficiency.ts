import { normalizeApiClientError } from "../api/http-client.js";
import { parseBaseScenarioConfig } from "../lib/config.js";
import { createTokenSession, getRequiredNonNegativeInteger } from "./utils.js";

type UrgentDeficiencyPayload = Record<string, unknown>;

export async function runUrgentDeficiencyTask(
	payload: UrgentDeficiencyPayload,
): Promise<void> {
	try {
		const projectId = getRequiredNonNegativeInteger(payload, "project_id");
		const imageObjectId = getRequiredNonNegativeInteger(
			payload,
			"image_object_id",
		);
		const imageObjectTypeId = getRequiredNonNegativeInteger(
			payload,
			"image_object_type_id",
		);

		const config = parseBaseScenarioConfig();
		const tokenSession = await createTokenSession({
			baseUrl: config.baseUrl,
			tenantId: config.tenantId,
			apiKey: config.apiKey,
			origin: config.origin,
			publicKey: config.publicKey,
			privateKey: config.privateKey,
		});

		console.log(
			`[task:urgent-deficiency] started payload=${JSON.stringify(payload)}`,
		);

		const [imageObjectResponse, imageObjectTypeResponse] = await Promise.all([
			tokenSession.http
				.get<Record<string, unknown>>(
					`/projects/${projectId}/image_objects/${imageObjectId}`,
				)
				.catch((error: unknown) => {
					throw normalizeApiClientError(error, "Image object fetch");
				}),
			tokenSession.http
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
