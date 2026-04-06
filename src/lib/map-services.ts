/**
 * Catalogue de flux de fonds de carte dynamiques
 * Inspiré du système de QGIS avec support WMS, WMTS, XYZ et autres
 */

export interface MapService {
  id: string;
  name: string;
  provider: string;
  type: "wms" | "wmts" | "xyz" | "tms" | "arcgis";
  url: string;
  description?: string;
  attribution?: string;
  layers?: MapLayer[];
  requiresAuth?: boolean;
  apiKey?: string;
}

export interface MapLayer {
  id: string;
  name: string;
  title: string;
  abstract?: string;
  crs?: string[];
  bbox?: [number, number, number, number];
  minZoom?: number;
  maxZoom?: number;
  format?: string;
  styles?: MapStyle[];
}

export interface MapStyle {
  name: string;
  title: string;
  legendUrl?: string;
}

/**
 * Flux de fonds de carte populaires
 */
export const BASE_MAP_SERVICES: MapService[] = [
  // OpenStreetMap
  {
    id: "osm-standard",
    name: "OpenStreetMap Standard",
    provider: "OpenStreetMap",
    type: "xyz",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    description: "Carte routière standard OpenStreetMap",
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "osm-hot",
    name: "OpenStreetMap HOT",
    provider: "OpenStreetMap",
    type: "xyz",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    description: "Carte OpenStreetMap pour les missions humanitaires",
    attribution: "© OpenStreetMap contributors, HOT",
  },
  
  // Cartes IGN (France)
  {
    id: "ign-plan",
    name: "IGN Plan",
    provider: "IGN",
    type: "wmts",
    url: "https://wxs.ign.fr/ortho/geoportail/wmts",
    description: "Plan IGN de France",
    attribution: "© IGN",
    requiresAuth: true,
    apiKey: "choisirgeoportail",
  },
  {
    id: "ign-satellite",
    name: "IGN Satellite",
    provider: "IGN",
    type: "wmts",
    url: "https://wxs.ign.fr/ortho/geoportail/wmts",
    description: "Images satellite IGN",
    attribution: "© IGN",
    requiresAuth: true,
    apiKey: "choisirgeoportail",
  },
  
  // Stamen
  {
    id: "stamen-toner",
    name: "Stamen Toner",
    provider: "Stamen",
    type: "xyz",
    url: "https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.png",
    description: "Carte en noir et blanc haute résolution",
    attribution: "Map tiles by Stamen Design, CC BY 3.0",
  },
  {
    id: "stamen-terrain",
    name: "Stamen Terrain",
    provider: "Stamen",
    type: "xyz",
    url: "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png",
    description: "Carte topographique avec relief",
    attribution: "Map tiles by Stamen Design, CC BY 3.0",
  },
  
  // ESRI
  {
    id: "esri-world-imagery",
    name: "ESRI World Imagery",
    provider: "ESRI",
    type: "xyz",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    description: "Images satellite haute résolution mondiale",
    attribution: "© ESRI",
  },
  {
    id: "esri-world-street",
    name: "ESRI World Street",
    provider: "ESRI",
    type: "xyz",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    description: "Carte routière mondiale ESRI",
    attribution: "© ESRI",
  },
  
  // CartoDB
  {
    id: "cartodb-dark",
    name: "CartoDB Dark",
    provider: "CartoDB",
    type: "xyz",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    description: "Fond sombre minimaliste",
    attribution: "© CartoDB",
  },
  {
    id: "cartodb-light",
    name: "CartoDB Light",
    provider: "CartoDB",
    type: "xyz",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    description: "Fond clair minimaliste",
    attribution: "© CartoDB",
  },
  
  // Google (requiert API key)
  {
    id: "google-satellite",
    name: "Google Satellite",
    provider: "Google",
    type: "xyz",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    description: "Images satellite Google",
    attribution: "© Google",
    requiresAuth: true,
  },
  {
    id: "google-terrain",
    name: "Google Terrain",
    provider: "Google",
    type: "xyz",
    url: "https://mt1.google.com/vt/lyrs=t&x={x}&y={y}&z={z}",
    description: "Carte topographique Google",
    attribution: "© Google",
    requiresAuth: true,
  },
  
  // Thunderforest
  {
    id: "thunderforest-outdoors",
    name: "Thunderforest Outdoors",
    provider: "Thunderforest",
    type: "xyz",
    url: "https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png",
    description: "Carte pour activités de plein air",
    attribution: "© Thunderforest",
    requiresAuth: true,
  },
  {
    id: "thunderforest-transport",
    name: "Thunderforest Transport",
    provider: "Thunderforest",
    type: "xyz",
    url: "https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png",
    description: "Carte des transports",
    attribution: "© Thunderforest",
    requiresAuth: true,
  },
];

/**
 * Catégories de services
 */
export const SERVICE_CATEGORIES = {
  standard: "Cartes standard",
  satellite: "Images satellite",
  topographic: "Cartes topographiques",
  thematic: "Cartes thématiques",
  dark: "Fonds sombres",
  light: "Fonds clairs",
};

/**
 * Fonction pour récupérer les couches disponibles depuis un service WMS/WMTS
 */
export async function fetchWMSCapabilities(url: string): Promise<MapLayer[]> {
  try {
    const capabilitiesUrl = url.includes("?") 
      ? `${url}&service=WMS&request=GetCapabilities`
      : `${url}?service=WMS&request=GetCapabilities`;
    
    const response = await fetch(capabilitiesUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch capabilities: ${response.statusText}`);
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    
    const layers: MapLayer[] = [];
    const layerElements = xmlDoc.getElementsByTagName("Layer");
    
    // Skip the root Layer element
    for (let i = 1; i < layerElements.length; i++) {
      const layerEl = layerElements[i];
      const name = layerEl.getElementsByTagName("Name")[0]?.textContent || "";
      const title = layerEl.getElementsByTagName("Title")[0]?.textContent || name;
      const abstract = layerEl.getElementsByTagName("Abstract")[0]?.textContent || "";
      
      layers.push({
        id: name,
        name,
        title,
        abstract,
      });
    }
    
    return layers;
  } catch (error) {
    console.error("Error fetching WMS capabilities:", error);
    return [];
  }
}

/**
 * Fonction pour construire l'URL d'une couche WMS
 */
export function buildWMSLayerUrl(
  service: MapService,
  layer: MapLayer,
  bbox: [number, number, number, number],
  width: number = 256,
  height: number = 256,
  crs: string = "EPSG:3857",
  format: string = "image/png"
): string {
  const params = new URLSearchParams({
    service: "WMS",
    request: "GetMap",
    layers: layer.name,
    bbox: bbox.join(","),
    width: width.toString(),
    height: height.toString(),
    crs,
    format,
  });
  
  return `${service.url}?${params.toString()}`;
}

/**
 * Fonction pour substituer les templates XYZ
 */
export function buildXYZTileUrl(url: string, x: number, y: number, z: number): string {
  return url
    .replace("{x}", x.toString())
    .replace("{y}", y.toString())
    .replace("{z}", z.toString())
    .replace("{s}", ["a", "b", "c"][Math.floor(Math.random() * 3)])
    .replace("{r}", "@2x");
}
