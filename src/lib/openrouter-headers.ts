import type { AppSettings } from "./settings";

export function buildOpenRouterHeaders(
  apiKey: string,
  settings: Pick<AppSettings, "openrouterAppName" | "openrouterReferer">,
): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const referer =
    settings.openrouterReferer ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  if (settings.openrouterAppName) {
    headers["X-OpenRouter-Title"] = settings.openrouterAppName;
    headers["X-Title"] = settings.openrouterAppName;
  }

  return headers;
}
