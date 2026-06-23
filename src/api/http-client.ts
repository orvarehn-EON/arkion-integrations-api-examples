import axios, {
	AxiosError,
	type AxiosInstance,
	type AxiosRequestConfig,
} from "axios";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";

const MAX_USAGE_PLAN_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 5_000;

const sharedHttpAgent = new HttpAgent({
	keepAlive: true,
});

const sharedHttpsAgent = new HttpsAgent({
	keepAlive: true,
});

type ApiGateway429Kind =
	| "QUOTA_EXCEEDED"
	| "BURST"
	| "THROTTLED"
	| "UNKNOWN_429";

interface ApiGateway429Classification {
	kind: ApiGateway429Kind;
	source: string;
	errorType?: string;
	message?: string;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSingleHeaderValue(value: unknown): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}
	return typeof value === "string" ? value : undefined;
}

function parseRetryAfterMs(value: unknown): number | undefined {
	const raw = toSingleHeaderValue(value);
	if (!raw) {
		return undefined;
	}

	const asSeconds = Number(raw);
	if (Number.isFinite(asSeconds) && asSeconds >= 0) {
		return Math.floor(asSeconds * 1000);
	}

	const asDateMs = Date.parse(raw);
	if (Number.isFinite(asDateMs)) {
		return Math.max(asDateMs - Date.now(), 0);
	}

	return undefined;
}

function computeRetryDelayMs(error: AxiosError, attempt: number): number {
	const retryAfterMs = parseRetryAfterMs(
		error.response?.headers?.["retry-after"],
	);
	if (retryAfterMs !== undefined) {
		return Math.min(retryAfterMs, MAX_RETRY_DELAY_MS);
	}

	const cappedAttempt = Math.min(attempt, 10);
	const exponentialDelay = BASE_RETRY_DELAY_MS * 2 ** (cappedAttempt - 1);
	const jitter = Math.floor(Math.random() * BASE_RETRY_DELAY_MS);
	return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS);
}

function isApiGatewayUsagePlan429(error: unknown): error is AxiosError {
	return error instanceof AxiosError && error.response?.status === 429;
}

function isApiGatewayGatewayTimeout504(error: unknown): error is AxiosError {
	return error instanceof AxiosError && error.response?.status === 504;
}

function extractPayloadMessage(payload: unknown): string | undefined {
	if (!payload || typeof payload !== "object") {
		return undefined;
	}

	const record = payload as Record<string, unknown>;
	const message = record.message;
	return typeof message === "string" ? message : undefined;
}

function extractApiGatewayErrorType(error: AxiosError): string | undefined {
	const rawHeader =
		error.response?.headers?.["x-amzn-errortype"] ??
		error.response?.headers?.["X-Amzn-Errortype"];
	const headerValue = toSingleHeaderValue(rawHeader);
	if (!headerValue) {
		return undefined;
	}

	// AWS often appends metadata after ':'
	return headerValue.split(":")[0]?.trim();
}

function classifyApiGateway429(error: AxiosError): ApiGateway429Classification {
	const payloadMessage = extractPayloadMessage(error.response?.data);
	const messageLower = payloadMessage?.toLowerCase();
	const errorType = extractApiGatewayErrorType(error);
	const errorTypeLower = errorType?.toLowerCase();

	if (
		errorTypeLower?.includes("quota") ||
		messageLower?.includes("quota") ||
		messageLower?.includes("monthly")
	) {
		return {
			kind: "QUOTA_EXCEEDED",
			source: errorType ? "x-amzn-errortype" : "payload.message",
			errorType,
			message: payloadMessage,
		};
	}

	if (messageLower?.includes("burst")) {
		return {
			kind: "BURST",
			source: "payload.message",
			errorType,
			message: payloadMessage,
		};
	}

	if (
		errorTypeLower?.includes("toomanyrequest") ||
		errorTypeLower?.includes("limitexceeded") ||
		messageLower?.includes("too many requests") ||
		messageLower?.includes("throttle") ||
		messageLower?.includes("rate exceeded") ||
		messageLower?.includes("limit exceeded")
	) {
		return {
			kind: "THROTTLED",
			source: errorType ? "x-amzn-errortype" : "payload.message",
			errorType,
			message: payloadMessage,
		};
	}

	return {
		kind: "UNKNOWN_429",
		source: "fallback",
		errorType,
		message: payloadMessage,
	};
}

function isRetryableApiGateway429(kind: ApiGateway429Kind): boolean {
	// Retry only explicitly known transient classes.
	return kind === "BURST" || kind === "THROTTLED";
}

function getRetryableGatewayContext(error: unknown):
	| {
			status: 429 | 504;
			kind: string;
			source: string;
	  }
	| undefined {
	if (isApiGatewayUsagePlan429(error)) {
		const classification = classifyApiGateway429(error);
		if (!isRetryableApiGateway429(classification.kind)) {
			return undefined;
		}

		return {
			status: 429,
			kind: classification.kind,
			source: classification.source,
		};
	}

	if (isApiGatewayGatewayTimeout504(error)) {
		return {
			status: 504,
			kind: "GATEWAY_TIMEOUT",
			source: "status_code",
		};
	}

	return undefined;
}

type RetryableRequestConfig = AxiosRequestConfig & {
	__usagePlanRetryCount?: number;
};

function attachUsagePlanRetryInterceptor(client: AxiosInstance): void {
	client.interceptors.response.use(
		(response) => response,
		async (error: unknown) => {
			const retryContext = getRetryableGatewayContext(error);
			if (!retryContext) {
				if (isApiGatewayUsagePlan429(error)) {
					const classification = classifyApiGateway429(error);
					console.warn(
						`[api-client] 429 received kind=${classification.kind} source=${classification.source}; skipping retry`,
					);
				}
				return Promise.reject(error);
			}

			const axiosError = error as AxiosError;

			const config = axiosError.config as RetryableRequestConfig | undefined;
			if (!config) {
				console.warn(
					`[api-client] ${retryContext.status} received kind=${retryContext.kind} source=${retryContext.source}; retry not possible (missing request config)`,
				);
				return Promise.reject(error);
			}

			const nextRetryCount = (config.__usagePlanRetryCount ?? 0) + 1;
			if (nextRetryCount > MAX_USAGE_PLAN_RETRIES) {
				console.warn(
					`[api-client] ${retryContext.status} received kind=${retryContext.kind} source=${retryContext.source}; retry budget exhausted attempts=${MAX_USAGE_PLAN_RETRIES}`,
				);
				return Promise.reject(error);
			}

			config.__usagePlanRetryCount = nextRetryCount;
			const delayMs = computeRetryDelayMs(axiosError, nextRetryCount);
			console.warn(
				`[api-client] ${retryContext.status} received kind=${retryContext.kind} source=${retryContext.source} retrying request attempt=${nextRetryCount}/${MAX_USAGE_PLAN_RETRIES} delay_ms=${delayMs}`,
			);
			await wait(delayMs);
			return client.request(config);
		},
	);
}

export function createApiHttpClient(input: {
	baseUrl: string;
	tenantId: string;
	apiKey: string;
	accessToken: string;
}): AxiosInstance {
	const client = axios.create({
		baseURL: `${input.baseUrl}/tenant/${encodeURIComponent(input.tenantId)}`,
		headers: {
			"x-api-key": input.apiKey,
			Authorization: `Bearer ${input.accessToken}`,
		},
		httpAgent: sharedHttpAgent,
		httpsAgent: sharedHttpsAgent,
	});

	attachUsagePlanRetryInterceptor(client);

	return client;
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
		const statusHint = (() => {
			if (status !== 429) {
				if (status === 504) {
					return " API Gateway integration timed out or had upstream network issues (504).";
				}
				return "";
			}

			const classification = classifyApiGateway429(error);
			const errorTypePart = classification.errorType
				? `, error_type=${classification.errorType}`
				: "";
			return ` API Gateway usage plan limit hit (kind=${classification.kind}, source=${classification.source}${errorTypePart}).`;
		})();

		// Include axios error details for better diagnostics
		const axiosDetails = (() => {
			const parts: string[] = [];
			if (error.code) parts.push(`code=${error.code}`);
			if (error.message && !error.message.includes("No response payload"))
				parts.push(`message=${error.message}`);
			if (error.request && !error.response) parts.push("no_response_received");
			return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
		})();

		return new Error(
			`${context} failed (${status || "unknown"} ${
				statusText || ""
			}).${statusHint} Details: ${detail}${axiosDetails}`,
		);
	}

	return error instanceof Error ? error : new Error(String(error));
}
