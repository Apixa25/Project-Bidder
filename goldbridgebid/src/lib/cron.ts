import { createHash, timingSafeEqual } from "node:crypto";

export function getCronSecret() {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    throw new Error("Missing CRON_SECRET.");
  }

  return secret;
}

function matchesSecret(provided: string | null, expected: string) {
  if (!provided) return false;
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export function isAuthorizedCronRequest(request: Request) {
  const expectedSecret = getCronSecret();
  const authorizationHeader = request.headers.get("authorization");
  const bearerToken = authorizationHeader?.replace(/^Bearer\s+/i, "") || null;
  const explicitHeaderSecret = request.headers.get("x-cron-secret");

  return (
    matchesSecret(bearerToken, expectedSecret) ||
    matchesSecret(explicitHeaderSecret, expectedSecret)
  );
}
