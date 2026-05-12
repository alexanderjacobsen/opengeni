import { GitHubAppManifestCreate } from "@opengeni/contracts";
import {
  buildGitHubAppManifest,
  convertGitHubAppManifest,
  createSignedState,
  envLinesFromGitHubManifestConversion,
  GitHubAppApiError,
  GitHubAppConfigurationError,
  githubAppMissingSettings,
  listGitHubAppRepositories,
  organizationAppManifestUrl,
  personalAppManifestUrl,
  verifySignedState,
} from "@opengeni/github";
import type { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ApiRouteDeps } from "../dependencies";

export function registerGitHubRoutes(app: Hono, deps: ApiRouteDeps): void {
  const { settings, githubStateSecret } = deps;

  app.get("/v1/github/app", (c) => {
    const missing = githubAppMissingSettings(settings);
    const slug = settings.githubAppSlug?.trim() || null;
    return c.json({
      configured: missing.length === 0,
      appId: settings.githubAppId ?? null,
      clientId: settings.githubClientId ?? null,
      appSlug: slug,
      installUrl: slug ? `https://github.com/apps/${slug}/installations/new` : null,
      missing,
    });
  });

  app.get("/v1/github/repositories", async (c) => {
    try {
      return c.json({ repositories: await listGitHubAppRepositories(settings) });
    } catch (error) {
      if (error instanceof GitHubAppConfigurationError) {
        throw new HTTPException(409, { message: JSON.stringify({ message: error.message, missing: error.missing }) });
      }
      throw new HTTPException(502, { message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/v1/github/repositories/sync", async (c) => {
    try {
      return c.json({ repositories: await listGitHubAppRepositories(settings) });
    } catch (error) {
      if (error instanceof GitHubAppConfigurationError) {
        throw new HTTPException(409, { message: JSON.stringify({ message: error.message, missing: error.missing }) });
      }
      throw new HTTPException(502, { message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/v1/github/app-manifest", async (c) => {
    const payload = GitHubAppManifestCreate.parse(await c.req.json());
    const baseUrl = (settings.githubAppManifestBaseUrl ?? new URL(c.req.url).origin).replace(/\/+$/, "");
    const state = createSignedState(githubStateSecret);
    const appName = payload.appName?.trim() || "OpenGeni";
    const manifest = buildGitHubAppManifest({
      appName,
      baseUrl,
      public: payload.public,
      includeCiPermissions: payload.includeCiPermissions,
    });
    const organization = payload.organization?.trim();
    return c.json({
      actionUrl: organization ? organizationAppManifestUrl(organization, state) : personalAppManifestUrl(state),
      state,
      manifest,
    });
  });

  app.get("/v1/github/app-manifest/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code) {
      throw new HTTPException(400, { message: "missing GitHub manifest code" });
    }
    if (!state || !verifySignedState(state, githubStateSecret)) {
      throw new HTTPException(400, { message: "invalid or expired GitHub manifest state" });
    }
    try {
      const conversion = await convertGitHubAppManifest(code);
      const envLines = envLinesFromGitHubManifestConversion(conversion);
      const slug = String(conversion.slug ?? "");
      const installUrl = slug ? `https://github.com/apps/${slug}/installations/new` : "";
      return c.html(githubSuccessHtml(envLines, installUrl));
    } catch (error) {
      const message = error instanceof GitHubAppApiError ? error.message : String(error);
      throw new HTTPException(502, { message });
    }
  });
}

function githubSuccessHtml(envLines: string[], installUrl: string): string {
  const envText = envLines.join("\n");
  const escaped = escapeHtml(envText);
  const install = installUrl ? `<a class="button secondary" href="${escapeHtml(installUrl)}">Install on repositories</a>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GitHub App Created</title><style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0d;color:#f4f4f5}main{width:min(760px,calc(100vw - 32px));border:1px solid #27272a;border-radius:8px;padding:28px;background:#111114}h1{margin:0 0 10px;font-size:24px;line-height:1.2}p{margin:0 0 18px;color:#d4d4d8}.env-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:22px 0 8px}.env-header h2{margin:0;font-size:13px;line-height:1.2;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa}pre{white-space:pre-wrap;word-break:break-word;max-height:380px;overflow:auto;background:#09090b;border:1px solid #27272a;border-radius:8px;padding:16px;font-size:13px;line-height:1.5}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.button,button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border-radius:6px;border:1px solid #3f3f46;padding:0 12px;background:#f4f4f5;color:#09090b;font:600 14px system-ui,sans-serif;text-decoration:none;cursor:pointer}.button.secondary{background:transparent;color:#fafafa}.button.secondary:hover,button.secondary:hover{background:#27272a}button:disabled{cursor:not-allowed;opacity:.7}</style></head><body><main><h1>GitHub App created</h1><p>Add these values to .env, then restart API and worker.</p><div class="env-header"><h2>Environment variables</h2><button id="copy-env" type="button">Copy env</button></div><pre id="env-lines">${escaped}</pre><div class="actions">${install}</div><script>(()=>{const button=document.getElementById("copy-env");const env=document.getElementById("env-lines");async function copyText(text){if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return;}const area=document.createElement("textarea");area.value=text;area.setAttribute("readonly","");area.style.position="fixed";area.style.inset="-9999px";document.body.append(area);area.select();document.execCommand("copy");area.remove();}button?.addEventListener("click",async()=>{try{await copyText(env?.textContent||"");button.textContent="Copied";setTimeout(()=>button.textContent="Copy env",1600);}catch{button.textContent="Copy failed";setTimeout(()=>button.textContent="Copy env",2200);}});})();</script></main></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}
