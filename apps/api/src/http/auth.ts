import type { Settings } from "@opengeni/config";
import type { Context, MiddlewareHandler } from "hono";

const bearerPrefix = "Bearer ";

export function requireAccessKey(settings: Settings): MiddlewareHandler {
  return async (c, next) => {
    if (!settings.authRequired || isAuthExempt(c, settings)) {
      await next();
      return;
    }
    if (isAuthorized(c, settings.accessKey)) {
      await next();
      return;
    }
    return c.json({ error: "unauthorized" }, 401, {
      "www-authenticate": 'Bearer realm="opengeni"',
    });
  };
}

function isAuthExempt(c: Context, settings: Settings): boolean {
  if (c.req.method === "OPTIONS") {
    return true;
  }
  const path = new URL(c.req.url).pathname;
  if (path === "/v1/config/client") {
    return true;
  }
  if (settings.authAllowHealth && path === "/healthz") {
    return true;
  }
  if (settings.authAllowMetrics && path === "/metrics") {
    return true;
  }
  return false;
}

function isAuthorized(c: Context, expected: string | undefined): boolean {
  if (!expected) {
    return false;
  }
  const authorization = c.req.header("authorization");
  const bearer = authorization?.startsWith(bearerPrefix) ? authorization.slice(bearerPrefix.length) : undefined;
  const explicit = c.req.header("x-opengeni-access-key");
  return constantTimeEqual(bearer, expected) || constantTimeEqual(explicit, expected);
}

function constantTimeEqual(actual: string | undefined, expected: string): boolean {
  if (typeof actual !== "string") {
    return false;
  }
  const actualBytes = new TextEncoder().encode(actual);
  const expectedBytes = new TextEncoder().encode(expected);
  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    diff |= actualBytes[index]! ^ expectedBytes[index]!;
  }
  return diff === 0;
}
