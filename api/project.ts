import type { Project } from "../src/lib/types.js";
import { ensureOk } from "./utils.js";

export async function fetchProject(input: {
	baseUrl: string;
	tenantId: string;
	projectId: number;
	apiKey: string;
	accessToken: string;
}): Promise<Project> {
	const url = `${input.baseUrl}/tenant/${encodeURIComponent(
		input.tenantId,
	)}/projects/${input.projectId}`;

	const response = await fetch(url, {
		method: "GET",
		headers: {
			"x-api-key": input.apiKey,
			Authorization: `Bearer ${input.accessToken}`,
		},
	});

	await ensureOk(response, "Project fetch");
	return (await response.json()) as Project;
}
