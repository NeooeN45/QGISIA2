import { useMemo } from "react";

/**
 * Données cartographiques parsées depuis un bloc <map-data> dans un message LLM.
 *
 * Le format attendu dans le message :
 *   <map-data>{"center":[48.8566,2.3522],"zoom":15,"title":"Paris","geojson":{...}}</map-data>
 */
export interface InlineMapProps {
  /** [lat, lng] */
  center: [number, number];
  /** Niveau de zoom Leaflet — défaut 15 */
  zoom?: number;
  /** Bounding-box WGS84 [minLon, minLat, maxLon, maxLat] — surcharge le zoom si fourni */
  bbox?: [number, number, number, number];
  /** GeoJSON brut (FeatureCollection, Feature, Geometry…) */
  geojson?: object;
  /** Libellé affiché en badge sur la carte (ex: "Parcelle BD-42-123") */
  title?: string;
  /** Adresse lisible affichée sous le titre */
  address?: string;
  /** Hauteur du composant en pixels — défaut 280 */
  height?: number;
}

interface UseMapDataResult {
  /** Contenu nettoyé sans les balises <map-data> */
  cleanContent: string;
  /** Liste ordonnée des cartes à rendre */
  mapDataList: InlineMapProps[];
}

const MAP_DATA_REGEX = /<map-data>([\s\S]*?)<\/map-data>/g;

const DEFAULT_CENTER: [number, number] = [46.6034, 1.8883]; // centre de la France

function isValidCenter(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [lat, lng] = value as unknown[];
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function isValidBbox(value: unknown): value is [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) return false;
  return (value as unknown[]).every((v) => typeof v === "number");
}

function parseMapDataBlock(raw: string): InlineMapProps | null {
  try {
    const parsed: unknown = JSON.parse(raw.trim());

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const center = isValidCenter(obj.center) ? obj.center : DEFAULT_CENTER;
    const zoom = typeof obj.zoom === "number" ? obj.zoom : 15;
    const bbox = isValidBbox(obj.bbox) ? obj.bbox : undefined;
    const geojson =
      obj.geojson && typeof obj.geojson === "object" ? (obj.geojson as object) : undefined;
    const title = typeof obj.title === "string" ? obj.title : undefined;
    const address = typeof obj.address === "string" ? obj.address : undefined;
    const height = typeof obj.height === "number" && obj.height > 0 ? obj.height : undefined;

    return { center, zoom, bbox, geojson, title, address, height };
  } catch (err) {
    // JSON invalide — log en dev pour faciliter le débogage
    if (import.meta.env.DEV) {
      console.warn("[useMapData] Bloc <map-data> invalide :", err);
    }
    return null;
  }
}

/**
 * Parse tous les blocs <map-data>…</map-data> dans un contenu de message.
 *
 * Retourne le contenu nettoyé (sans les balises) et la liste des données de
 * cartes prêtes à être passées au composant InlineMap.
 *
 * Garanti stable en référence tant que `content` ne change pas.
 */
export function useMapData(content: string): UseMapDataResult {
  return useMemo(() => {
    const mapDataList: InlineMapProps[] = [];

    const cleanContent = content.replace(MAP_DATA_REGEX, (_match, rawJson: string) => {
      const parsed = parseMapDataBlock(rawJson);
      if (parsed !== null) {
        mapDataList.push(parsed);
      }
      // Remplace la balise par une sentinelle positionnelle vide
      return "";
    });

    return { cleanContent: cleanContent.trim(), mapDataList };
  }, [content]);
}
