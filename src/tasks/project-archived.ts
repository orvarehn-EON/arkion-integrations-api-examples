import { normalizeApiClientError } from "../api/http-client.js";
import { parseBaseScenarioConfig } from "../lib/config.js";
import {
	createTokenSession,
	formatElapsedMinutesSeconds,
	getRequiredNonNegativeInteger,
	readNonNegativeIntegerFromKeys,
	TOKEN_REFRESH_BUFFER_MS,
} from "./utils.js";

type ProjectArchivedPayload = Record<string, unknown>;

function getImageId(raw: unknown): number {
	const input = (raw || {}) as Record<string, unknown>;
	return readNonNegativeIntegerFromKeys(input, ["image_id", "id"]);
}

function collectIds(rawList: unknown, preferredKey: string): number[] {
	if (!Array.isArray(rawList)) {
		throw new Error("Expected an array response when collecting ids.");
	}

	const ids = rawList.map((entry) => {
		const input = (entry || {}) as Record<string, unknown>;
		return readNonNegativeIntegerFromKeys(input, [preferredKey, "id"]);
	});

	return [...new Set(ids)];
}

export async function runProjectArchivedTask(
	payload: ProjectArchivedPayload,
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
			`[task:project-archived] started payload=${JSON.stringify(payload)}`,
		);
		console.log(
			`[task:project-archived] fetching images for project_id=${projectId}`,
		);

		const imagesResponse = await tokenSession.http
			.get<unknown[]>(`/projects/${projectId}/images`)
			.catch((error: unknown) => {
				throw normalizeApiClientError(error, "Images fetch");
			});

		console.log(
			`[task:project-archived] images fetched count=${imagesResponse.data.length}`,
		);

		if (imagesResponse.data.length === 0) {
			const elapsedMs = Date.now() - startMs;
			console.log(
				"[task:project-archived] no images returned; nothing to resolve",
			);
			console.log(
				`[task:project-archived] completed duration=${formatElapsedMinutesSeconds(
					elapsedMs,
				)}`,
			);
			return;
		}

		const resolvedImages: Array<Record<string, unknown>> = [];

		for (const [index, rawImageId] of imagesResponse.data.entries()) {
			if (Date.now() >= tokenSession.expiresAtMs - TOKEN_REFRESH_BUFFER_MS) {
				console.log(
					`[task:project-archived] refreshing access token before image_index=${index}`,
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

			const imageId = getImageId(rawImageId);

			// First stage: fetch image + image_objects list + image_object_types list.
			const [
				imageResponse,
				imageObjectsListResponse,
				imageObjectTypesListResponse,
			] = await Promise.all([
				tokenSession.http
					.get<Record<string, unknown>>(
						`/projects/${projectId}/images/${imageId}`,
					)
					.catch((error: unknown) => {
						throw normalizeApiClientError(error, "Image detail fetch");
					}),
				tokenSession.http
					.get<unknown[]>(
						`/projects/${projectId}/images/${imageId}/image_objects`,
					)
					.catch((error: unknown) => {
						throw normalizeApiClientError(error, "Image objects list fetch");
					}),
				tokenSession.http
					.get<unknown[]>(
						`/projects/${projectId}/images/${imageId}/image_object_types`,
					)
					.catch((error: unknown) => {
						throw normalizeApiClientError(
							error,
							"Image object types list fetch",
						);
					}),
			]);

			const imageObjectIds = collectIds(
				imageObjectsListResponse.data,
				"image_object_id",
			);
			const imageObjectTypeIds = collectIds(
				imageObjectTypesListResponse.data,
				"image_object_type_id",
			);

			// Second stage: fetch each image object and image object type by id.
			const [imageObjects, imageObjectTypes] = await Promise.all([
				Promise.all(
					imageObjectIds.map((imageObjectId) =>
						tokenSession.http
							.get<Record<string, unknown>>(
								`/projects/${projectId}/image_objects/${imageObjectId}`,
							)
							.then((response) => response.data)
							.catch((error: unknown) => {
								throw normalizeApiClientError(error, "Image object fetch");
							}),
					),
				),
				Promise.all(
					imageObjectTypeIds.map((imageObjectTypeId) =>
						tokenSession.http
							.get<Record<string, unknown>>(
								`/projects/${projectId}/image_object_types/${imageObjectTypeId}`,
							)
							.then((response) => response.data)
							.catch((error: unknown) => {
								throw normalizeApiClientError(error, "Image object type fetch");
							}),
					),
				),
			]);

			resolvedImages.push({
				image_id: imageId,
				image: imageResponse.data,
				image_objects: imageObjects,
				image_object_types: imageObjectTypes,
			});

			console.log(`[task:project-archived] resolved image_index=${index}`);
		}

		console.log(
			`[task:project-archived] resolved_images_count=${resolvedImages.length}`,
		);
		const elapsedMs = Date.now() - startMs;
		console.log(
			`[task:project-archived] completed duration=${formatElapsedMinutesSeconds(
				elapsedMs,
			)}`,
		);
	} catch (error: unknown) {
		const elapsedMs = Date.now() - startMs;
		console.error(
			`[task:project-archived] failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		console.error(
			`[task:project-archived] failed duration=${formatElapsedMinutesSeconds(
				elapsedMs,
			)}`,
		);
	}
}
