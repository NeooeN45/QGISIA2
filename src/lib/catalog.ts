import { ADDITIONAL_DATA_SOURCES } from "./additional-sources";

export type RemoteServiceType =
  | "WMS"
  | "WMTS"
  | "WFS"
  | "WCS"
  | "XYZ"
  | "TMS"
  | "ArcGISMapServer"
  | "ArcGISFeatureServer";

export interface RemoteServiceConfig {
  name: string;
  serviceType: RemoteServiceType;
  url: string;
  provider?: string;
  description?: string;
  attribution?: string;
  layerName?: string;
  style?: string;
  format?: string;
  crs?: string;
  tileMatrixSet?: string;
  version?: string;
  zMin?: number;
  zMax?: number;
  requiresKey?: boolean;
  reliable?: boolean;
}

export interface CatalogItem extends RemoteServiceConfig {
  id: string;
}

export const SUPPORTED_REMOTE_SERVICE_TYPES: Array<{
  id: RemoteServiceType;
  label: string;
  description: string;
}> = [
  {
    id: "WMS",
    label: "WMS",
    description: "Cartes raster servies par couches et styles.",
  },
  {
    id: "WMTS",
    label: "WMTS",
    description: "Tuiles normalisées haute performance.",
  },
  {
    id: "WFS",
    label: "WFS / OGC API Features",
    description: "Entités vecteur distantes et interrogeables.",
  },
  {
    id: "WCS",
    label: "WCS",
    description: "Couvertures raster distantes.",
  },
  {
    id: "XYZ",
    label: "XYZ",
    description: "Tuiles web simples de fond de carte.",
  },
  {
    id: "TMS",
    label: "TMS",
    description: "Tuiles web au schéma TMS.",
  },
  {
    id: "ArcGISMapServer",
    label: "ArcGIS MapServer",
    description: "Services raster ArcGIS REST.",
  },
  {
    id: "ArcGISFeatureServer",
    label: "ArcGIS FeatureServer",
    description: "Services vecteur ArcGIS REST.",
  },
];

export const CARTOGRAPHIC_CATALOG: CatalogItem[] = [
  {
    id: "geopf-wms-raster",
    name: "Géoplateforme Ortho",
    provider: "IGN",
    serviceType: "WMS",
    url: "https://data.geopf.fr/wms-r",
    description: "Orthophotos nationales IGN via WMS.",
    layerName: "ORTHOIMAGERY.ORTHOPHOTOS",
    format: "image/jpeg",
    crs: "EPSG:3857",
    attribution: "IGN",
  },
  {
    id: "geopf-wmts-planign",
    name: "Plan IGN V2",
    provider: "IGN",
    serviceType: "WMTS",
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetCapabilities",
    description: "Fond plan IGN V2 via WMTS.",
    layerName: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
    tileMatrixSet: "PM",
    style: "normal",
    format: "image/png",
    crs: "EPSG:3857",
    attribution: "IGN",
  },
  {
    id: "mundialis-topo-wms",
    name: "Mundialis Topo (WMS)",
    provider: "Mundialis",
    serviceType: "WMS",
    url: "https://ows.terrestris.de/osm/service",
    description: "Fond topographique WMS public (terrestris/Mundialis).",
    layerName: "OSM-WMS",
    format: "image/png",
    crs: "EPSG:3857",
    attribution: "Mundialis, OpenStreetMap contributors",
    reliable: true,
  },
  {
    id: "osm-standard",
    name: "OpenStreetMap Standard",
    provider: "OSM",
    serviceType: "XYZ",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    description: "Fond OSM standard.",
    zMin: 0,
    zMax: 19,
    attribution: "OpenStreetMap contributors",
  },
  {
    id: "carto-dark",
    name: "Carto Dark Matter",
    provider: "Carto",
    serviceType: "XYZ",
    url: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    description: "Fond sombre pour visualisation analytique.",
    zMin: 0,
    zMax: 20,
    attribution: "OpenStreetMap, CARTO",
    reliable: true,
  },
  {
    id: "esri-world-imagery",
    name: "Esri World Imagery",
    provider: "Esri",
    serviceType: "XYZ",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    description: "Imagerie satellite mondiale (XYZ, fonctionne dans QGIS).",
    zMin: 0,
    zMax: 19,
    attribution: "Esri, Maxar, Earthstar Geographics",
    reliable: true,
  },
  {
    id: "usgs-topo",
    name: "USGS Topo (XYZ)",
    provider: "USGS",
    serviceType: "XYZ",
    url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    description: "Carte topo USGS (XYZ, fonctionne dans QGIS).",
    zMin: 0,
    zMax: 16,
    attribution: "USGS",
    reliable: true,
  },
  {
    id: "nasa-gibs-wms",
    name: "NASA GIBS TrueColor",
    provider: "NASA",
    serviceType: "WMS",
    url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi",
    description: "Imagerie mondiale quasi temps réel.",
    layerName: "MODIS_Terra_CorrectedReflectance_TrueColor",
    format: "image/png",
    crs: "EPSG:3857",
    attribution: "NASA",
  },
  {
    id: "gebco-wms",
    name: "GEBCO Bathymétrie (WMS)",
    provider: "GEBCO",
    serviceType: "WMS",
    url: "https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv",
    description: "Bathymétrie mondiale via WMS GEBCO.",
    layerName: "GEBCO_LATEST",
    format: "image/png",
    crs: "EPSG:4326",
    attribution: "GEBCO",
  },
  {
    id: "geoserver-demo-wfs-countries",
    name: "WFS Countries Demo",
    provider: "GeoServer Demo",
    serviceType: "WFS",
    url: "https://ahocevar.com/geoserver/wfs",
    description: "Pays du monde via WFS, utile pour tester les flux entités distants.",
    layerName: "ne:ne_10m_admin_0_countries",
    version: "2.0.0",
    crs: "EPSG:4326",
    attribution: "GeoServer demo / Natural Earth",
  },
];

export function getCatalogItemById(itemId: string): CatalogItem | null {
  return [...CARTOGRAPHIC_CATALOG, ...ADDITIONAL_DATA_SOURCES].find((item) => item.id === itemId) || null;
}

// Concatène CARTOGRAPHIC_CATALOG + ADDITIONAL_DATA_SOURCES en dédupliquant par ID
// (CARTOGRAPHIC_CATALOG a priorité — ses IDs écrasent les éventuels doublons d'additional-sources)
const _seenIds = new Set(CARTOGRAPHIC_CATALOG.map((s) => s.id));
export const ALL_DATA_SOURCES: CatalogItem[] = [
  ...CARTOGRAPHIC_CATALOG,
  ...ADDITIONAL_DATA_SOURCES.filter((s) => {
    if (_seenIds.has(s.id)) return false;
    _seenIds.add(s.id);
    return true;
  }),
];
