import { normalizeApiClientError } from "../api/http-client.js";
import { parseBaseScenarioConfig } from "../lib/config.js";
import {
	createTokenSession,
	formatElapsedMinutesSeconds,
	getRequiredNonNegativeInteger,
	TOKEN_REFRESH_BUFFER_MS,
} from "./utils.js";

type ProjectReportAvailablePayload = Record<string, unknown>;

interface DefectItem {
	image_id: number;
	image_object_id: number;
	image_object_type_id: number;
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

export async function runProjectReportAvailableTask(
	payload: ProjectReportAvailablePayload,
): Promise<void> {
	const startMs = Date.now();

	try {
		const projectId = getRequiredNonNegativeInteger(payload, "project_id");

		const config = parseBaseScenarioConfig();
		let tokenSession = await createTokenSession({
			baseUrl: config.baseUrl,
			tenantId: config.tenantId,
			apiKey: config.apiKey,
			origin: config.origin,
			publicKey: config.publicKey,
			privateKey: config.privateKey,
		});

		console.log(
			`[task:project-report-available] started payload=${JSON.stringify(
				payload,
			)}`,
		);
		console.log(
			`[task:project-report-available] fetching defects for project_id=${projectId}`,
		);

		const defectsResponse = await tokenSession.http
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
			if (Date.now() >= tokenSession.expiresAtMs - TOKEN_REFRESH_BUFFER_MS) {
				console.log(
					`[task:project-report-available] refreshing access token before defect_index=${index}`,
				);
				tokenSession = await createTokenSession({
					baseUrl: config.baseUrl,
					tenantId: config.tenantId,
					apiKey: config.apiKey,
					origin: config.origin,
					publicKey: config.publicKey,
					privateKey: config.privateKey,
				});
			}

			const { image_id, image_object_id, image_object_type_id } =
				parseDefectItem(defectItem);

			const [imageResponse, imageObjectResponse, imageObjectTypeResponse] =
				await Promise.all([
					tokenSession.http
						.get<Record<string, unknown>>(
							`/projects/${projectId}/images/${image_id}`,
						)
						.catch((error: unknown) => {
							throw normalizeApiClientError(error, "Image fetch");
						}),
					tokenSession.http
						.get<Record<string, unknown>>(
							`/projects/${projectId}/image_objects/${image_object_id}`,
						)
						.catch((error: unknown) => {
							throw normalizeApiClientError(error, "Image object fetch");
						}),
					tokenSession.http
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
				`[task:project-report-available] resolved defect_index=${index}`,
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
