import axios, { AxiosError, type AxiosInstance } from "axios";

export function createApiHttpClient(input: {
	baseUrl: string;
	tenantId: string;
	apiKey: string;
	accessToken: string;
}): AxiosInstance {
	return axios.create({
		baseURL: `${input.baseUrl}/tenant/${encodeURIComponent(input.tenantId)}`,
		headers: {
			"x-api-key": input.apiKey,
			Authorization: `Bearer ${input.accessToken}`,
		},
	});
}

export function normalizeApiClientError(
	error: unknown,
	context: string,
): Error {
	if (error instanceof AxiosError) {
		const status = error.response?.status;
		const statusText = error.response?.statusText;
		const payload = error.response?.data;
		const detail =
			payload === undefined ? "No response payload." : JSON.stringify(payload);
		return new Error(
			`${context} failed (${status || "unknown"} ${
				statusText || ""
			}). Details: ${detail}`,
		);
	}

	return error instanceof Error ? error : new Error(String(error));
}
