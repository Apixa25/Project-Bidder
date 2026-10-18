import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron";

describe("isAuthorizedCronRequest", () => {
  it("accepts a matching bearer token or x-cron-secret", () => {
    process.env.CRON_SECRET = "test-secret-value";

    expect(
      isAuthorizedCronRequest(
        new Request("http://localhost/api/cron", {
          headers: { authorization: "Bearer test-secret-value" },
        })
      )
    ).toBe(true);

    expect(
      isAuthorizedCronRequest(
        new Request("http://localhost/api/cron", {
          headers: { "x-cron-secret": "test-secret-value" },
        })
      )
    ).toBe(true);
  });

  it("rejects a missing or wrong secret", () => {
    process.env.CRON_SECRET = "test-secret-value";

    expect(
      isAuthorizedCronRequest(new Request("http://localhost/api/cron"))
    ).toBe(false);

    expect(
      isAuthorizedCronRequest(
        new Request("http://localhost/api/cron", {
          headers: { authorization: "Bearer wrong-secret" },
        })
      )
    ).toBe(false);
  });
});
