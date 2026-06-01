import type { ApiErrorDetail } from "../src/lib/types.js";

export class ApiError extends Error {
	status: number;
	detail: unknown;

	constructor(message: string, status: number, detail: unknown) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.detail = detail;
	}
}

export async function parseJsonOrText(response: Response): Promise<unknown> {
	const contentType = response.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		return response.json();
	}
	const text = await response.text();
	return text.length > 0 ? text : null;
}

export function formatErrorDetails(detail: unknown): string {
	if (!detail) {
		return "No error details were provided.";
	}

	const normalized =
		typeof detail === "object" && detail !== null
			? (detail as { detail?: string | ApiErrorDetail })
			: undefined;

	const inner = normalized?.detail;
	if (typeof inner === "string") {
		return inner;
	}
	if (inner && typeof inner === "object") {
		const info = inner as ApiErrorDetail;
		const codePart = info.code ? `[${info.code}] ` : "";
		const message = info.detail || "Unknown error";
		const action = info.action ? ` Action: ${info.action}` : "";
		return `${codePart}${message}${action}`;
	}

	return JSON.stringify(detail);
}

export async function ensureOk(
	response: Response,
	context: string,
): Promise<void> {
	if (response.ok) {
		return;
	}

	const payload = await parseJsonOrText(response);
	throw new ApiError(
		`${context} failed (${response.status} ${response.statusText})`,
		response.status,
		payload,
	);
}

export function renderApiError(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.status === 401) {
			return `Authentication failed: ${formatErrorDetails(error.detail)}`;
		}
		if (error.status === 403) {
			return `Authorization failed: ${formatErrorDetails(error.detail)}`;
		}
		return `API error: ${error.message}. Details: ${formatErrorDetails(
			error.detail,
		)}`;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
