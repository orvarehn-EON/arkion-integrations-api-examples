import { normalizeApiClientError } from "../api/http-client.js";
import { parseBaseScenarioConfig } from "../lib/config.js";
import {
	createTokenSession,
	formatElapsedMinutesSeconds,
	getRequiredNonNegativeInteger,
	TOKEN_REFRESH_BUFFER_MS,
} from "./utils.js";

type ProjectArchivedPayload = Record<string, unknown>;
const IMAGES_PAGE_LIMIT = 10000;

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

		const allImageIds: unknown[] = [];
		let afterId: number | undefined;

		while (true) {
			if (Date.now() >= tokenSession.expiresAtMs - TOKEN_REFRESH_BUFFER_MS) {
				console.log(
					`[task:project-archived] refreshing access token before images_page_after_id=${String(
						afterId,
					)}`,
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

			const imagesPage = await tokenSession.http
				.get<unknown[]>(`/projects/${projectId}/images`, {
					params: {
						limit: IMAGES_PAGE_LIMIT,
						after_id: afterId,
					},
				})
				.then((response) => response.data)
				.catch((error: unknown) => {
					throw normalizeApiClientError(
						error,
						`Images fetch (limit=${IMAGES_PAGE_LIMIT}, after_id=${String(
							afterId,
						)})`,
					);
				});

			console.log(
				`[task:project-archived] images page fetched after_id=${String(
					afterId,
				)} count=${imagesPage.length}`,
			);

			allImageIds.push(...imagesPage);

			if (imagesPage.length < IMAGES_PAGE_LIMIT) {
				break;
			}
			afterId = Number(imagesPage[imagesPage.length - 1]);
		}

		console.log(
			`[task:project-archived] images fetched count=${allImageIds.length}`,
		);

		if (allImageIds.length === 0) {
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

		for (const [index, imageId] of allImageIds.entries()) {
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

			// Second stage: fetch each image object and image object type by id.
			const [imageObjects, imageObjectTypes] = await Promise.all([
				Promise.all(
					imageObjectsListResponse.data.map((imageObjectId) =>
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
					imageObjectTypesListResponse.data.map((imageObjectTypeId) =>
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
