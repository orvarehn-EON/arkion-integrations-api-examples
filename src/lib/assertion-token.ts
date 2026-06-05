import { SignJWT, importPKCS8 } from "jose";

export async function generateAssertionToken(input: {
	privateKey: string;
}): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const signingKey = await importPKCS8(input.privateKey, "RS256");

	// Skip setting payload and audience since the API does not require them for the assertion token

	return new SignJWT()
		.setProtectedHeader({ alg: "RS256", typ: "JWT" })
		.setIssuedAt(now)
		.setSubject("customer-service")
		.setIssuer("customer-service")
		.setExpirationTime(now + 5 * 60)
		.sign(signingKey);
}
