/**
 * Service health pre-checks — vérifie la reachability d'un service distant
 * (WMS/WMTS/WFS/WCS/XYZ/TMS/ArcGIS) avant de demander à QGIS de l'ajouter.
 *
 * Limitations: la plupart des serveurs GIS publics ne servent pas de headers
 * CORS. Le browser ne peut donc pas lire le body de la réponse cross-origin.
 * On utilise `mode: 'no-cors'` qui retourne une réponse opaque : on peut au
 * moins distinguer "réseau OK" de "réseau KO" (TypeError sur fetch).
 * QGIS ne souffre pas de CORS côté client, donc une réponse opaque suffit.
 */

import type { CatalogItem, RemoteServiceType } from "./catalog";

const DEFAULT_TIMEOUT_MS = 6000;

export type HealthCheckReason =
  | "ok"
  | "timeout"
  | "network"
  | "requires-key"
  | "invalid-url"
  | "skipped";

export interface HealthCheckResult {
  ok: boolean;
  reason: HealthCheckReason;
  message: string;
  durationMs: number;
}

/**
 * Construit l'URL de probe selon le type de service.
 * Pour WMS/WMTS/WFS/WCS on demande GetCapabilities.
 * Pour XYZ/TMS on tente un tile sample (z=0,x=0,y=0).
 * Pour ArcGIS on demande f=json sur l'endpoint racine.
 */
function buildProbeUrl(item: { url: string; serviceType: RemoteServiceType }): string {
  const base = item.url.trim();
  switch (item.serviceType) {
    case "WMS":
      return appendQuery(base, { SERVICE: "WMS", REQUEST: "GetCapabilities" });
    case "WMTS":
      return appendQuery(base, { SERVICE: "WMTS", REQUEST: "GetCapabilities" });
    case "WFS":
      return appendQuery(base, { SERVICE: "WFS", REQUEST: "GetCapabilities" });
    case "WCS":
      return appendQuery(base, { SERVICE: "WCS", REQUEST: "GetCapabilities" });
    case "XYZ":
    case "TMS":
      return base
        .replace(/\{z\}/g, "0")
        .replace(/\{x\}/g, "0")
        .replace(/\{y\}/g, "0")
        .replace(/\{s\}/g, "a")
        .replace(/\{r\}/g, "")
        .replace(/\{-y\}/g, "0");
    case "ArcGISMapServer":
    case "ArcGISFeatureServer":
      return appendQuery(base, { f: "json" });
    default:
      return base;
  }
}

function appendQuery(url: string, params: Record<string, string>): string {
  const sep = url.includes("?") ? "&" : "?";
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${url}${sep}${qs}`;
}

/**
 * Vérifie qu'un service est joignable. Ne lit pas le contenu (CORS).
 * Retourne ok=true si la requête réseau aboutit (status quelconque),
 * ok=false si timeout ou network error.
 */
export async function checkServiceHealth(
  item: CatalogItem,
  options: { apiKey?: string; timeoutMs?: number } = {},
): Promise<HealthCheckResult> {
  const start = performance.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Validation locale: clé API requise mais absente → bloque tôt
  if (item.requiresKey && !options.apiKey) {
    return {
      ok: false,
      reason: "requires-key",
      message: `Clé API requise pour ${item.provider ?? item.name}. Configure-la dans les paramètres.`,
      durationMs: 0,
    };
  }

  let probeUrl: string;
  try {
    probeUrl = buildProbeUrl(item);
    new URL(probeUrl);
  } catch {
    return {
      ok: false,
      reason: "invalid-url",
      message: `URL invalide : ${item.url}`,
      durationMs: performance.now() - start,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(probeUrl, {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal,
      // pas de cache pour avoir un vrai signal réseau
      cache: "no-store",
      // referrerPolicy par défaut, certaines instances IGN exigent un Referer
    });
    clearTimeout(timer);
    return {
      ok: true,
      reason: "ok",
      message: "Service joignable",
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    if (isAbort) {
      return {
        ok: false,
        reason: "timeout",
        message: `Timeout après ${timeoutMs}ms — le serveur ne répond pas.`,
        durationMs: timeoutMs,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: "network",
      message: `Service injoignable (${msg}). Vérifie l'URL ou ta connexion.`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}
