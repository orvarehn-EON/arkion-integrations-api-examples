import axios, { AxiosError } from "axios";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

interface UploadFileScenarioConfig {
	signedUrl: string;
	filePath: string;
}

function parseRequiredString(raw: string | undefined, argumentName: string): string {
	if (!raw || raw.trim().length === 0) {
		throw new Error(`Invalid ${argumentName}: value must not be empty.`);
	}
	return raw.trim();
}

function parseUploadFileScenarioConfig(argv: string[]): UploadFileScenarioConfig {
	const signedUrl = parseRequiredString(argv[2], "signed_url");
	const filePath = parseRequiredString(argv[3], "file_path");

	try {
		new URL(signedUrl);
	} catch {
		throw new Error("Invalid signed_url: expected a valid absolute URL.");
	}

	return {
		signedUrl,
		filePath,
	};
}

function normalizeUploadError(error: unknown, context: string): Error {
	if (error instanceof AxiosError) {
		const status = error.response?.status;
		const statusText = error.response?.statusText;
		const payload =
			error.response?.data === undefined
				? "No response payload."
				: JSON.stringify(error.response.data);

		return new Error(
			`${context} failed (${status || "unknown"} ${
				statusText || ""
			}). Details: ${payload}`,
		);
	}

	return error instanceof Error ? error : new Error(String(error));
}

async function main(): Promise<void> {
	const config = parseUploadFileScenarioConfig(process.argv);

	const fileInfo = await stat(config.filePath).catch((error: unknown) => {
		throw new Error(
			`Unable to read file metadata for ${config.filePath}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	});

	if (!fileInfo.isFile()) {
		throw new Error(`Invalid file_path: ${config.filePath} is not a file.`);
	}

	console.log(
		`Reading ${basename(config.filePath)} (${fileInfo.size} bytes) from disk...`,
	);
	const fileContent = await readFile(config.filePath).catch((error: unknown) => {
		throw new Error(
			`Unable to read file ${config.filePath}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	});

	console.log("Uploading file to signed URL...");
	const uploadResponse = await axios
		.put(config.signedUrl, fileContent, {
			headers: {
				"Content-Length": String(fileContent.byteLength),
			},
			maxBodyLength: Number.POSITIVE_INFINITY,
		})
		.then((response) => ({
			status: response.status,
			statusText: response.statusText,
			data: response.data,
		}))
		.catch((error: unknown) => {
			throw normalizeUploadError(error, "File upload");
		});

	console.log("File uploaded successfully.");
	console.log("Upload response:");
	console.log(
		JSON.stringify(
			{
				status: uploadResponse.status,
				status_text: uploadResponse.statusText,
				body:
					uploadResponse.data === undefined ? null : uploadResponse.data,
			},
			null,
			2,
		),
	);
}

main().catch((error: unknown) => {
	console.error(
		`Error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
});
