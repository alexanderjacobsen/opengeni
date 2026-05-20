import { describe, expect, test } from "bun:test";
import { authHeadersForAccessKey } from "./api";

describe("web API auth helpers", () => {
  test("builds bearer authorization headers from a client-side access key", () => {
    expect(authHeadersForAccessKey(null)).toEqual({});
    expect(authHeadersForAccessKey("secret")).toEqual({ authorization: "Bearer secret" });
  });
});
