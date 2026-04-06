import {
  type RemoteServiceConfig,
  getCatalogItemById,
} from "./catalog";
import { addCatalogService, addGeoJsonLayer, addRemoteService } from "./qgis";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type OfficialSourceMode =
  | "catalog-service"
  | "remote-service"
  | "api-search"
  | "catalog-search";

export interface OfficialSourceEntry {
  id: string;
  name: string;
  provider: string;
  mode: OfficialSourceMode;
  description: string;
  protocols: string[];
  tags: string[];
  documentationUrl: string;
  catalogItemId?: string;
  remoteServiceConfig?: RemoteServiceConfig;
}

export interface OfficialSourceLoadResult {
  ok: boolean;
  sourceId: string;
  name: string;
  mode: OfficialSourceMode;
  status: string;
  documentationUrl: string;
}

export interface CadastreParcelSearchOptions {
  codeInsee: string;
  section?: string;
  numero?: string;
  codeArr?: string;
  comAbs?: string;
  sourceIgn?: "PCI" | "BDP";
  limit?: number;
  addToMap?: boolean;
  layerName?: string;
}

export interface GeoApiCommuneSearchOptions {
  name: string;
  limit?: number;
  addToMap?: boolean;
  layerName?: string;
}

export interface OverpassSearchOptions {
  query: string;
  endpoint?: string;
  addToMap?: boolean;
  layerName?: string;
}

export interface CopernicusSearchOptions {
  collection?: string;
  nameContains?: string;
  limit?: number;
}

export interface NasaCatalogSearchOptions {
  collection: string;
  bbox?: string | [number, number, number, number];
  limit?: number;
}

export interface CopernicusSearchResultItem {
  id: string;
  name: string;
  online: boolean;
  collection: string;
  s3Path: string;
  publicationDate: string;
  startDate: string;
  endDate: string;
}

export interface CopernicusSearchResult {
  ok: boolean;
  count: number;
  items: CopernicusSearchResultItem[];
  summary: string;
}

export interface NasaCatalogSearchResultItem {
  id: string;
  collection: string;
  bbox: number[];
  datetime: string;
  assetKeys: string[];
}

export interface NasaCatalogSearchResult {
  ok: boolean;
  count: number;
  matched: number | null;
  items: NasaCatalogSearchResultItem[];
  summary: string;
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: Array<Record<string, JsonValue>>;
  [key: string]: JsonValue;
}

interface GeoApiCommuneRecord {
  nom?: string;
  code?: string;
  population?: number;
  centre?: {
    type?: string;
    coordinates?: number[];
  };
  contour?: Record<string, JsonValue>;
}

interface OverpassElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  nodes?: number[];
  geometry?: Array<{
    lat: number;
    lon: number;
  }>;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface CopernicusProduct {
  Id?: string;
  Name?: string;
  Online?: boolean;
  S3Path?: string;
  OriginDate?: string;
  PublicationDate?: string;
  ModificationDate?: string;
  Footprint?: string | null;
  GeoFootprint?: JsonValue;
  Collection?: {
    Name?: string;
  };
  ContentDate?: {
    Start?: string;
    End?: string;
  };
}

interface CopernicusODataResponse {
  value?: CopernicusProduct[];
}

interface NasaStacFeature {
  id?: string;
  collection?: string;
  bbox?: number[];
  properties?: Record<string, JsonValue>;
  assets?: Record<
    string,
    {
      href?: string;
      title?: string;
      type?: string;
    }
  >;
}

interface NasaStacResponse {
  features?: NasaStacFeature[];
  context?: {
    returned?: number;
    matched?: number;
  };
}

export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

export const OFFICIAL_SOURCE_REGISTRY: OfficialSourceEntry[] = [
  {
    id: "geopf-plan-ign",
    name: "Plan IGN V2",
    provider: "IGN / cartes.gouv.fr",
    mode: "catalog-search",
    description:
      "Fond de carte officiel de la Geoplateforme, directement integrable dans QGIS.",
    protocols: ["WMTS"],
    tags: ["ign", "geoplateforme", "plan", "france", "fond de carte"],
    documentationUrl:
      "https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/api-de-diffusion/qgis/",
  },
  {
    id: "geopf-ortho",
    name: "Orthophotos nationales",
    provider: "IGN / cartes.gouv.fr",
    mode: "catalog-service",
    description:
      "Orthophotographies nationales de la Geoplateforme en WMS, utiles pour verification et interpretation.",
    protocols: ["WMS"],
    tags: ["ign", "ortho", "imagerie", "france", "geoplateforme"],
    documentationUrl:
      "https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/api-de-diffusion/qgis/",
    catalogItemId: "geopf-wms-raster",
  },
  {
    id: "apicarto-cadastre",
    name: "API Carto Cadastre",
    provider: "IGN",
    mode: "api-search",
    description:
      "Recherche officielle des parcelles, sections, feuilles et localisants cadastraux au format GeoJSON.",
    protocols: ["REST", "GeoJSON"],
    tags: ["cadastre", "parcelles", "ign", "apicarto", "geojson"],
    documentationUrl: "https://apicarto.ign.fr/api/doc/cadastre",
  },
  {
    id: "apicarto-admin",
    name: "API Carto Limites administratives",
    provider: "IGN",
    mode: "api-search",
    description:
      "Communes, departements et regions officiels a partir d'un point ou d'une geometrie.",
    protocols: ["REST", "GeoJSON"],
    tags: ["communes", "departements", "regions", "ign", "apicarto"],
    documentationUrl: "https://apicarto.ign.fr/api/doc/limites-administratives",
  },
  {
    id: "apicarto-wfs-geoportail",
    name: "API Carto WFS Geoplateforme",
    provider: "IGN",
    mode: "api-search",
    description:
      "Interrogation spatiale officielle de toutes les couches WFS exposees par la Geoplateforme.",
    protocols: ["REST", "WFS"],
    tags: ["wfs", "geoplateforme", "intersection", "ign", "bdtopo"],
    documentationUrl: "https://apicarto.ign.fr/api/doc/wfs-geoportail",
  },
  {
    id: "geo-api-gouv-communes",
    name: "geo.api.gouv.fr Communes",
    provider: "DINUM / api.gouv.fr",
    mode: "api-search",
    description:
      "Recherche officielle des communes avec contours et metadonnees administratives.",
    protocols: ["REST", "JSON"],
    tags: ["communes", "administratif", "etat", "france", "contours"],
    documentationUrl: "https://geo.api.gouv.fr",
  },
  {
    id: "overpass-api",
    name: "Overpass API",
    provider: "OpenStreetMap",
    mode: "api-search",
    description:
      "Requetes OSM fines pour POI, reseaux et objets thematiques a partir d'Overpass QL.",
    protocols: ["REST", "Overpass QL", "OSM JSON"],
    tags: ["osm", "overpass", "poi", "reseaux", "openstreetmap"],
    documentationUrl: "https://wiki.openstreetmap.org/wiki/Overpass_introduction",
  },
  {
    id: "nasa-gibs-wms",
    name: "NASA GIBS True Color",
    provider: "NASA Earthdata",
    mode: "catalog-service",
    description:
      "Imagerie mondiale quasi temps reel de NASA GIBS, directement utilisable en fond raster.",
    protocols: ["WMS"],
    tags: ["nasa", "gibs", "imagerie", "earthdata", "wms"],
    documentationUrl:
      "https://www.earthdata.nasa.gov/data/tools/global-imagery-browse-services-gibs",
    catalogItemId: "nasa-gibs-wms",
  },
  {
    id: "nasa-gibs-wmts",
    name: "NASA GIBS WMTS",
    provider: "NASA Earthdata",
    mode: "catalog-search",
    description:
      "Version WMTS officielle de NASA GIBS pour fonds performants en tuiles.",
    protocols: ["WMTS"],
    tags: ["nasa", "gibs", "wmts", "earth observation"],
    documentationUrl:
      "https://www.earthdata.nasa.gov/data/tools/global-imagery-browse-services-gibs",
  },
  {
    id: "copernicus-odata",
    name: "Copernicus Data Space OData",
    provider: "Copernicus",
    mode: "catalog-search",
    description:
      "Catalogue officiel pour rechercher les produits Copernicus avant telechargement ou traitement.",
    protocols: ["OData", "REST"],
    tags: ["copernicus", "sentinel", "odata", "catalogue", "eo"],
    documentationUrl: "https://documentation.dataspace.copernicus.eu/APIs.html",
  },
  {
    id: "copernicus-stac",
    name: "Copernicus STAC",
    provider: "Copernicus",
    mode: "catalog-search",
    description:
      "Interface STAC officielle du catalogue Copernicus Data Space.",
    protocols: ["STAC", "REST"],
    tags: ["copernicus", "stac", "sentinel", "catalogue", "eo"],
    documentationUrl: "https://documentation.dataspace.copernicus.eu/APIs.html",
  },
  {
    id: "nasa-cmr-stac",
    name: "NASA CMR STAC",
    provider: "NASA Earthdata",
    mode: "catalog-search",
    description:
      "Recherche STAC officielle Earthdata/CMR pour collections et scenes EO.",
    protocols: ["STAC", "REST"],
    tags: ["nasa", "cmr", "stac", "earthdata", "eo"],
    documentationUrl: "https://cmr.earthdata.nasa.gov/stac/docs/index.html",
  },
];

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildQueryUrl(baseUrl: string, params: Record<string, string | number | undefined>) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Echec HTTP ${response.status} sur ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildFeatureCollection(
  features: Array<Record<string, JsonValue>>,
): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features,
  };
}

function buildCadastreLayerName(options: CadastreParcelSearchOptions): string {
  const suffix = [options.codeInsee, options.section, options.numero]
    .filter(Boolean)
    .join("_");
  return options.layerName?.trim() || `Parcelles_${suffix || "cadastre"}`;
}

function geometryToFeature(
  geometry: Record<string, JsonValue> | null | undefined,
  properties: Record<string, JsonValue>,
  id: string,
): Record<string, JsonValue> | null {
  if (!geometry || typeof geometry !== "object") {
    return null;
  }

  return {
    type: "Feature",
    id,
    properties,
    geometry,
  };
}

function parseBbox(value?: string | [number, number, number, number]) {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value) && value.length === 4 && value.every((entry) => Number.isFinite(entry))) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = value
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry));
    if (parsed.length === 4) {
      return parsed as [number, number, number, number];
    }
  }

  return undefined;
}

function overpassElementsToGeoJson(elements: OverpassElement[]): GeoJsonFeatureCollection {
  const nodeMap = new Map<number, [number, number]>();
  for (const element of elements) {
    if (element.type === "node" && typeof element.lon === "number" && typeof element.lat === "number") {
      nodeMap.set(element.id, [element.lon, element.lat]);
    }
  }

  const features: Array<Record<string, JsonValue>> = [];
  for (const element of elements) {
    const baseProperties: Record<string, JsonValue> = {
      osm_id: element.id,
      osm_type: element.type,
      ...(element.tags || {}),
    };

    if (element.type === "node" && typeof element.lon === "number" && typeof element.lat === "number") {
      features.push({
        type: "Feature",
        id: `${element.type}/${element.id}`,
        properties: baseProperties,
        geometry: {
          type: "Point",
          coordinates: [element.lon, element.lat],
        },
      });
      continue;
    }

    const coordinates =
      Array.isArray(element.geometry) && element.geometry.length > 0
        ? element.geometry
            .filter(
              (entry): entry is { lat: number; lon: number } =>
                typeof entry?.lat === "number" && typeof entry?.lon === "number",
            )
            .map((entry) => [entry.lon, entry.lat] as [number, number])
        : Array.isArray(element.nodes)
          ? element.nodes
              .map((nodeId) => nodeMap.get(nodeId))
              .filter((entry): entry is [number, number] => Array.isArray(entry))
          : [];

    if (coordinates.length < 2) {
      continue;
    }

    const isClosed =
      coordinates.length >= 4 &&
      coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
      coordinates[0][1] === coordinates[coordinates.length - 1][1];

    features.push({
      type: "Feature",
      id: `${element.type}/${element.id}`,
      properties: baseProperties,
      geometry: isClosed
        ? {
            type: "Polygon",
            coordinates: [coordinates],
          }
        : {
            type: "LineString",
            coordinates,
          },
    });
  }

  return buildFeatureCollection(features);
}

export function getOfficialSourceById(sourceId: string): OfficialSourceEntry | null {
  return OFFICIAL_SOURCE_REGISTRY.find((source) => source.id === sourceId) || null;
}

export function searchOfficialSources(query: string): OfficialSourceEntry[] {
  const normalizedQuery = normalizeSearchValue(query.trim());
  if (!normalizedQuery) {
    return OFFICIAL_SOURCE_REGISTRY;
  }

  return OFFICIAL_SOURCE_REGISTRY.filter((source) =>
    [
      source.name,
      source.provider,
      source.description,
      source.mode,
      ...source.protocols,
      ...source.tags,
    ]
      .map(normalizeSearchValue)
      .join(" ")
      .includes(normalizedQuery),
  );
}

export async function loadOfficialSource(
  sourceId: string,
): Promise<OfficialSourceLoadResult> {
  const source = getOfficialSourceById(sourceId);
  if (!source) {
    throw new Error(`Source officielle inconnue: ${sourceId}`);
  }

  if (source.catalogItemId) {
    const status = await addCatalogService(source.catalogItemId);
    return {
      ok: Boolean(status),
      sourceId,
      name: source.name,
      mode: source.mode,
      status: status || "Service catalogue non charge.",
      documentationUrl: source.documentationUrl,
    };
  }

  if (source.remoteServiceConfig) {
    const status = await addRemoteService(source.remoteServiceConfig);
    return {
      ok: Boolean(status),
      sourceId,
      name: source.name,
      mode: source.mode,
      status: status || "Service distant non charge.",
      documentationUrl: source.documentationUrl,
    };
  }

  return {
    ok: true,
    sourceId,
    name: source.name,
    mode: source.mode,
    status: "Source documentaire/API disponible pour le LLM et les formulaires Services.",
    documentationUrl: source.documentationUrl,
  };
}

export async function searchCadastreParcels(options: CadastreParcelSearchOptions) {
  const codeInsee = options.codeInsee.trim();
  if (!codeInsee) {
    throw new Error("Le code INSEE est requis pour interroger le cadastre.");
  }

  const geojson = await fetchJson<GeoJsonFeatureCollection>(
    buildQueryUrl("https://apicarto.ign.fr/api/cadastre/parcelle", {
      code_insee: codeInsee,
      section: options.section?.trim(),
      numero: options.numero?.trim(),
      code_arr: options.codeArr?.trim(),
      com_abs: options.comAbs?.trim(),
      source_ign: options.sourceIgn || "PCI",
      _limit: options.limit || 50,
    }),
  );

  const featureCount = Array.isArray(geojson.features) ? geojson.features.length : 0;
  const layerName = buildCadastreLayerName(options);
  const status =
    options.addToMap && featureCount > 0
      ? await addGeoJsonLayer(JSON.stringify(geojson), layerName)
      : null;

  return {
    ok: true,
    featureCount,
    geojson,
    layerName,
    status,
    summary:
      featureCount > 0
        ? `${featureCount} parcelle(s) cadastrale(s) trouvee(s).`
        : "Aucune parcelle cadastrale trouvee.",
  };
}

export async function searchGeoApiCommunes(options: GeoApiCommuneSearchOptions) {
  const name = options.name.trim();
  if (!name) {
    throw new Error("Le nom de commune est requis.");
  }

  const records = await fetchJson<GeoApiCommuneRecord[]>(
    buildQueryUrl("https://geo.api.gouv.fr/communes", {
      nom: name,
      fields: "nom,code,population,centre,contour",
      format: "json",
      geometry: "contour",
      boost: "population",
      limit: options.limit || 10,
    }),
  );

  const features = records
    .map((record) =>
      geometryToFeature(
        (record.contour || null) as Record<string, JsonValue> | null,
        {
          nom: record.nom || "",
          code: record.code || "",
          population: record.population ?? null,
        },
        record.code || record.nom || "commune",
      ),
    )
    .filter((entry): entry is Record<string, JsonValue> => entry !== null);

  const geojson = buildFeatureCollection(features);
  const layerName = options.layerName?.trim() || `Communes_${name.replace(/\s+/g, "_")}`;
  const status =
    options.addToMap && features.length > 0
      ? await addGeoJsonLayer(JSON.stringify(geojson), layerName)
      : null;

  return {
    ok: true,
    count: records.length,
    geojson,
    communes: records.map((record) => ({
      nom: record.nom || "",
      code: record.code || "",
      population: record.population ?? null,
    })),
    layerName,
    status,
    summary:
      records.length > 0
        ? `${records.length} commune(s) trouvee(s) sur geo.api.gouv.fr.`
        : "Aucune commune trouvee.",
  };
}

export async function searchOverpassFeatures(options: OverpassSearchOptions) {
  const query = options.query.trim();
  if (!query) {
    throw new Error("La requete Overpass est requise.");
  }

  const endpoints = options.endpoint
    ? [options.endpoint]
    : [...OVERPASS_ENDPOINTS];

  let lastError = "";
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as OverpassResponse;
      const geojson = overpassElementsToGeoJson(payload.elements || []);
      const layerName =
        options.layerName?.trim() || "Overpass_OSM";
      const status =
        options.addToMap && geojson.features.length > 0
          ? await addGeoJsonLayer(JSON.stringify(geojson), layerName)
          : null;

      return {
        ok: true,
        endpoint,
        count: geojson.features.length,
        geojson,
        layerName,
        status,
        summary:
          geojson.features.length > 0
            ? `${geojson.features.length} objet(s) OSM converti(s) depuis Overpass.`
            : "Aucun objet OSM convertissable n'a ete retourne.",
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Erreur Overpass inconnue.";
    }
  }

  throw new Error(`Tous les endpoints Overpass ont echoue. Derniere erreur: ${lastError}`);
}

export async function searchCopernicusProducts(
  options: CopernicusSearchOptions,
): Promise<CopernicusSearchResult> {
  const top = Math.max(1, Math.min(options.limit || 5, 20));
  const filters: string[] = [];

  if (options.collection?.trim()) {
    filters.push(`Collection/Name eq '${options.collection.trim().replace(/'/g, "''")}'`);
  }
  if (options.nameContains?.trim()) {
    filters.push(`contains(Name,'${options.nameContains.trim().replace(/'/g, "''")}')`);
  }

  const url = buildQueryUrl("https://catalogue.dataspace.copernicus.eu/odata/v1/Products", {
    $top: top,
    $filter: filters.length > 0 ? filters.join(" and ") : undefined,
  });

  const payload = await fetchJson<CopernicusODataResponse>(url);
  const items = (payload.value || []).map((item) => ({
    id: item.Id || "",
    name: item.Name || "",
    online: Boolean(item.Online),
    collection: item.Collection?.Name || options.collection || "",
    s3Path: item.S3Path || "",
    publicationDate: item.PublicationDate || "",
    startDate: item.ContentDate?.Start || "",
    endDate: item.ContentDate?.End || "",
  }));

  return {
    ok: true,
    count: items.length,
    items,
    summary:
      items.length > 0
        ? `${items.length} produit(s) Copernicus trouve(s) dans le catalogue officiel.`
        : "Aucun produit Copernicus trouve.",
  };
}

export async function searchNasaCatalog(
  options: NasaCatalogSearchOptions,
): Promise<NasaCatalogSearchResult> {
  const bbox = parseBbox(options.bbox);
  const payload = await fetchJson<NasaStacResponse>(
    "https://cmr.earthdata.nasa.gov/stac/LPCLOUD/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        collections: [options.collection],
        limit: Math.max(1, Math.min(options.limit || 5, 20)),
        ...(bbox ? { bbox } : {}),
      }),
    },
  );

  const items = (payload.features || []).map((item) => ({
    id: item.id || "",
    collection: item.collection || "",
    bbox: item.bbox || [],
    datetime:
      typeof item.properties?.datetime === "string"
        ? item.properties.datetime
        : "",
    assetKeys: Object.keys(item.assets || {}),
  }));

  return {
    ok: true,
    count: items.length,
    matched: payload.context?.matched ?? null,
    items,
    summary:
      items.length > 0
        ? `${items.length} scene(s) NASA/CMR trouvee(s) dans le catalogue STAC.`
        : "Aucune scene NASA/CMR trouvee pour cette requete.",
  };
}
