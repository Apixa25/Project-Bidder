export function getCronSecret() {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    throw new Error("Missing CRON_SECRET.");
  }

  return secret;
}

export function isAuthorizedCronRequest(request: Request) {
  const expectedSecret = getCronSecret();
  const authorizationHeader = request.headers.get("authorization");
  const bearerToken = authorizationHeader?.replace(/^Bearer\s+/i, "") || null;
  const explicitHeaderSecret = request.headers.get("x-cron-secret");

  return (
    bearerToken === expectedSecret || explicitHeaderSecret === expectedSecret
  );
}
