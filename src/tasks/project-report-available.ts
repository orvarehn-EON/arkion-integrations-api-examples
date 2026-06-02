import { createAccessToken } from "../api/auth.js";
import {
	createApiHttpClient,
	normalizeApiClientError,
} from "../api/http-client.js";
import { generateAssertionToken } from "../lib/assertion-token.js";
import { parseBaseScenarioConfig } from "../lib/config.js";

type ProjectReportAvailablePayload = Record<string, unknown>;

interface DefectItem {
	image_id: number;
	image_object_id: number;
	image_object_type_id: number;
}

function getRequiredProjectId(payload: ProjectReportAvailablePayload): number {
	const raw = payload.project_id;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(
			`Payload field project_id must be a non-negative integer. Received: ${String(
				raw,
			)}`,
		);
	}
	return parsed;
}

function parseDefectItem(raw: unknown): DefectItem {
	const input = (raw || {}) as Record<string, unknown>;
	const imageId = Number(input.image_id);
	const imageObjectId = Number(input.image_object_id);
	const imageObjectTypeId = Number(input.image_object_type_id);

	if (
		!Number.isInteger(imageId) ||
		imageId < 0 ||
		!Number.isInteger(imageObjectId) ||
		imageObjectId < 0 ||
		!Number.isInteger(imageObjectTypeId) ||
		imageObjectTypeId < 0
	) {
		throw new Error(
			`Invalid defect item: ${JSON.stringify(
				raw,
			)}. Expected non-negative integers for image_id, image_object_id, and image_object_type_id.`,
		);
	}

	return {
		image_id: imageId,
		image_object_id: imageObjectId,
		image_object_type_id: imageObjectTypeId,
	};
}

function formatElapsedMinutesSeconds(elapsedMs: number): string {
	const totalSeconds = Math.floor(elapsedMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m ${seconds}s`;
}

export async function runProjectReportAvailableTask(
	payload: ProjectReportAvailablePayload,
): Promise<void> {
	const startMs = Date.now();

	try {
		const projectId = getRequiredProjectId(payload);

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
			`[task:project-report-available] started payload=${JSON.stringify(
				payload,
			)}`,
		);
		console.log(
			`[task:project-report-available] fetching defects for project_id=${projectId}`,
		);

		const defectsResponse = await http
			.get<unknown[]>(`/projects/${projectId}/defects`)
			.catch((error: unknown) => {
				throw normalizeApiClientError(error, "Defects fetch");
			});

		console.log(
			`[task:project-report-available] defects fetched count=${defectsResponse.data.length}`,
		);

		if (defectsResponse.data.length === 0) {
			console.log(
				"[task:project-report-available] no defects returned; nothing to resolve",
			);
			const elapsedMs = Date.now() - startMs;
			console.log(
				`[task:project-report-available] completed duration=${formatElapsedMinutesSeconds(
					elapsedMs,
				)}`,
			);
			return;
		}

		const resolvedDefects: Array<Record<string, unknown>> = [];

		for (const [index, defectItem] of defectsResponse.data.entries()) {
			const { image_id, image_object_id, image_object_type_id } =
				parseDefectItem(defectItem);

			const [imageResponse, imageObjectResponse, imageObjectTypeResponse] =
				await Promise.all([
					http
						.get<Record<string, unknown>>(
							`/projects/${projectId}/images/${image_id}`,
						)
						.catch((error: unknown) => {
							throw normalizeApiClientError(error, "Image fetch");
						}),
					http
						.get<Record<string, unknown>>(
							`/projects/${projectId}/image_objects/${image_object_id}`,
						)
						.catch((error: unknown) => {
							throw normalizeApiClientError(error, "Image object fetch");
						}),
					http
						.get<Record<string, unknown>>(
							`/projects/${projectId}/image_object_types/${image_object_type_id}`,
						)
						.catch((error: unknown) => {
							throw normalizeApiClientError(error, "Image object type fetch");
						}),
				]);

			const data = {
				ids: { image_id, image_object_id, image_object_type_id },
				image: imageResponse.data,
				image_object: imageObjectResponse.data,
				image_object_type: imageObjectTypeResponse.data,
			};

			console.log(
				`[task:project-report-available] resolved defect_index=${index}. ${JSON.stringify(
					data,
				)}`,
			);

			resolvedDefects.push(data);
		}

		console.log(
			`[task:project-report-available] resolved_defects_count=${resolvedDefects.length}`,
		);
		const elapsedMs = Date.now() - startMs;
		console.log(
			`[task:project-report-available] completed duration=${formatElapsedMinutesSeconds(
				elapsedMs,
			)}`,
		);
	} catch (error: unknown) {
		const elapsedMs = Date.now() - startMs;
		console.error(
			`[task:project-report-available] failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		console.error(
			`[task:project-report-available] failed duration=${formatElapsedMinutesSeconds(
				elapsedMs,
			)}`,
		);
	}
}
