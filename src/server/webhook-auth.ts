import { createPublicKey } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";

const arkionWebhookPublicKey = loadArkionWebhookPublicKey();

function normalizePem(key: string): string {
	const trimmed = key.trim();
	const unquoted =
		trimmed.length >= 2 &&
		((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'")))
			? trimmed.slice(1, -1)
			: trimmed;

	return unquoted
		.replace(/\\r\\n/g, "\n")
		.replace(/\\n/g, "\n")
		.replace(/\r\n/g, "\n")
		.trim();
}

function loadArkionWebhookPublicKey() {
	const rawKey = process.env.ARKION_PUBLIC_KEY;
	if (!rawKey || rawKey.trim().length === 0) {
		throw new Error("Missing required environment variable: ARKION_PUBLIC_KEY");
	}

	const normalized = normalizePem(rawKey);

	try {
		return createPublicKey(normalized);
	} catch {
		throw new Error(
			"Invalid ARKION_PUBLIC_KEY format. Expected a valid PEM public key.",
		);
	}
}

function extractBearerToken(req: Request): string | null {
	const authHeader = req.header("Authorization");
	if (!authHeader) {
		return null;
	}

	const [scheme, token] = authHeader.split(" ");
	if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
		return null;
	}

	return token;
}

export async function verifyWebhookToken(
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	const token = extractBearerToken(req);
	if (!token) {
		res.status(401).json({
			error:
				"Missing or invalid Authorization header. Expected: Bearer <token>",
		});
		return;
	}

	try {
		await jwtVerify(token, arkionWebhookPublicKey);
		next();
	} catch {
		res.status(401).json({ error: "Invalid webhook token." });
	}
}
