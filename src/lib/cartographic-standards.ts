/**
 * Cartographic Standards Database - Core French Standards
 * 
 * Base de données des normes cartographiques professionnelles françaises principales
 * pour la cartographie forestière, topographique et environnementale.
 * 
 * Normes incluses :
 * - ONF (Office National des Forêts)
 * - CNPF (Centre National de la Propriété Forestière)
 * - PSG (Plan Simple de Gestion)
 * - IGN (Institut National de l'Information Géographique et Forestière)
 * - IFN (Inventaire Forestier National)
 */

export interface CartographicStandard {
  id: string;
  name: string;
  organization: string;
  description: string;
  version: string;
  domain: "forestry" | "urban" | "agriculture" | "environment" | "topography" | "geology" | "hydrology" | "energy";
  subdomain?: string;
  country: string;
  language: string;
  layerTypes: LayerType[];
  symbologyRules: SymbologyRule[];
  layoutRules: LayoutRule;
  colorPalettes: ColorPalette[];
  scaleRanges: ScaleRange[];
  metadata: StandardMetadata;
}

export interface LayerType {
  id: string;
  name: string;
  geometryType: "point" | "line" | "polygon" | "raster";
  standardId: string;
  requiredFields: FieldDefinition[];
  optionalFields: FieldDefinition[];
  scaleRange: ScaleRange;
}

export interface FieldDefinition {
  name: string;
  type: "string" | "integer" | "float" | "boolean" | "date";
  description: string;
  required: boolean;
  enum?: string[];
  min?: number;
  max?: number;
}

export interface ScaleRange {
  minScale: number;
  maxScale: number;
  recommendedScale: number;
  description: string;
}

export interface SymbologyRule {
  layerTypeId: string;
  rendererType: "single_symbol" | "categorized" | "graduated" | "rule_based";
  classificationField?: string;
  categories?: Category[];
  ranges?: Range[];
  rules?: Rule[];
  labelSettings?: LabelSettings;
}

export interface Category {
  value: string | number;
  label: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  symbol: string;
  opacity?: number;
}

export interface Range {
  min: number;
  max: number;
  label: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  symbol: string;
  opacity?: number;
}

export interface Rule {
  id: string;
  filter: string;
  label: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  symbol: string;
  minScale?: number;
  maxScale?: number;
  opacity?: number;
}

export interface LabelSettings {
  enabled: boolean;
  field: string;
  fontSize: number;
  color: string;
  bufferEnabled: boolean;
  bufferSize: number;
  bufferColor: string;
}

export interface LayoutRule {
  pageSizes: PageSize[];
  orientations: Orientation[];
  mandatoryElements: LayoutElement[];
  optionalElements: LayoutElement[];
  margin: Margin;
}

export interface PageSize {
  size: "A4" | "A3" | "A2";
  width: number;
  height: number;
  unit: "mm";
}

export interface Orientation {
  orientation: "portrait" | "landscape";
  default: boolean;
}

export interface LayoutElement {
  id: string;
  type: "map" | "legend" | "scalebar" | "northarrow" | "title" | "source";
  mandatory: boolean;
  position: ElementPosition;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: "topleft" | "topright" | "bottomleft" | "bottomright" | "center";
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ColorPalette {
  id: string;
  name: string;
  description: string;
  colors: string[];
  useCases: string[];
  colorBlindSafe: boolean;
  printSafe: boolean;
  source: string;
  year: number;
}

export interface StandardMetadata {
  officialUrl?: string;
  referenceDocument?: string;
  lastUpdated: string;
  createdBy: string;
  mandatoryElements: string[];
  optionalElements: string[];
  tags: string[];
  region?: string;
}

// ONF Standard
export const ONF_STANDARD: CartographicStandard = {
  id: "onf-2024",
  name: "Norme ONF - Cartographie Forestière Publique",
  organization: "ONF",
  description: "Standard de cartographie pour la gestion forestière publique",
  version: "2024",
  domain: "forestry",
  subdomain: "gestion_publique",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "onf_peuplement",
      name: "Peuplements forestiers",
      geometryType: "polygon",
      standardId: "onf-2024",
      requiredFields: [
        { name: "id_peuplement", type: "string", description: "Identifiant unique", required: true },
        { name: "essence", type: "string", description: "Essence dominante", required: true },
        { name: "classe_age", type: "string", description: "Classe d'âge", required: true },
        { name: "densite", type: "float", description: "Densité (tiges/ha)", required: true, min: 0 },
      ],
      optionalFields: [
        { name: "volume", type: "float", description: "Volume en m³/ha", required: false, min: 0 },
        { name: "regime", type: "string", description: "Régime", required: false },
      ],
      scaleRange: {
        minScale: 500,
        maxScale: 25000,
        recommendedScale: 2000,
        description: "Échelle optimale pour les peuplements",
      },
    },
    {
      id: "onf_limites",
      name: "Limites forestières",
      geometryType: "line",
      standardId: "onf-2024",
      requiredFields: [
        { name: "id_limite", type: "string", description: "Identifiant unique", required: true },
        { name: "type_limite", type: "string", description: "Type de limite", required: true },
      ],
      optionalFields: [
        { name: "proprietaire", type: "string", description: "Propriétaire", required: false },
      ],
      scaleRange: {
        minScale: 500,
        maxScale: 50000,
        recommendedScale: 2000,
        description: "Échelle optimale pour les limites",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "onf_peuplement",
      rendererType: "categorized",
      classificationField: "essence",
      categories: [
        { value: "chene", label: "Chênaie", color: "#2E8B57", strokeColor: "#1B5E3A", strokeWidth: 0.5, symbol: "diagonal_hatch", opacity: 0.8 },
        { value: "hetre", label: "Hêtraie", color: "#3CB371", strokeColor: "#228B22", strokeWidth: 0.5, symbol: "cross_hatch", opacity: 0.8 },
        { value: "sapin", label: "Sapinière", color: "#006400", strokeColor: "#004d00", strokeWidth: 0.5, symbol: "vertical_hatch", opacity: 0.8 },
        { value: "epicea", label: "Épicéa", color: "#004d00", strokeColor: "#003300", strokeWidth: 0.5, symbol: "vertical_hatch", opacity: 0.8 },
        { value: "pin_sylvestre", label: "Pin sylvestre", color: "#556B2F", strokeColor: "#3D4C21", strokeWidth: 0.5, symbol: "vertical_hatch", opacity: 0.8 },
        { value: "melange", label: "Mélange", color: "#66CDAA", strokeColor: "#2E8B57", strokeWidth: 0.5, symbol: "stipple", opacity: 0.8 },
      ],
      labelSettings: {
        enabled: true,
        field: "essence",
        fontSize: 10,
        color: "#000000",
        bufferEnabled: true,
        bufferSize: 1,
        bufferColor: "#FFFFFF",
      },
    },
  ],
  layoutRules: {
    pageSizes: [
      { size: "A4", width: 210, height: 297, unit: "mm" },
      { size: "A3", width: 297, height: 420, unit: "mm" },
    ],
    orientations: [
      { orientation: "portrait", default: true },
      { orientation: "landscape", default: false },
    ],
    mandatoryElements: [
      { id: "map", type: "map", mandatory: true, position: { x: 15, y: 40, width: 180, height: 200, anchor: "topleft" } },
      { id: "legend", type: "legend", mandatory: true, position: { x: 200, y: 40, width: 85, height: 150, anchor: "topleft" } },
      { id: "scalebar", type: "scalebar", mandatory: true, position: { x: 15, y: 250, width: 120, height: 15, anchor: "topleft" } },
      { id: "title", type: "title", mandatory: true, position: { x: 15, y: 15, width: 270, height: 20, anchor: "topleft" } },
      { id: "source", type: "source", mandatory: true, position: { x: 15, y: 275, width: 270, height: 10, anchor: "topleft" } },
    ],
    optionalElements: [
      { id: "northarrow", type: "northarrow", mandatory: false, position: { x: 270, y: 195, width: 25, height: 25, anchor: "topleft" } },
      { id: "subtitle", type: "title", mandatory: false, position: { x: 15, y: 30, width: 270, height: 8, anchor: "topleft" } },
    ],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "onf_forest",
      name: "Palette forestière ONF",
      description: "Couleurs standard ONF pour les peuplements",
      colors: ["#2E8B57", "#3CB371", "#006400", "#004d00", "#556B2F", "#66CDAA"],
      useCases: ["peuplements", "vegetation"],
      colorBlindSafe: true,
      printSafe: true,
      source: "ONF",
      year: 2024,
    },
  ],
  scaleRanges: [
    { minScale: 500, maxScale: 1000, recommendedScale: 500, description: "Échelle détaillée" },
    { minScale: 1000, maxScale: 5000, recommendedScale: 2000, description: "Échelle standard" },
    { minScale: 5000, maxScale: 25000, recommendedScale: 10000, description: "Échelle d'aménagement" },
  ],
  metadata: {
    officialUrl: "https://www.onf.fr/",
    referenceDocument: "Guide ONF de cartographie forestière 2024",
    lastUpdated: "2024-01-15",
    createdBy: "ONF",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow", "subtitle"],
    tags: ["foret", "amenagement", "peuplement", "france", "domaniale"],
    region: "France",
  },
};

// CNPF Standard
export const CNPF_STANDARD: CartographicStandard = {
  id: "cnpf-2024",
  name: "Norme CNPF - Cartographie Forestière Privée",
  organization: "CNPF",
  description: "Standard de cartographie pour les propriétaires forestiers privés",
  version: "2024",
  domain: "forestry",
  subdomain: "foret_privee",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "cnpf_peuplements",
      name: "Peuplements forestiers",
      geometryType: "polygon",
      standardId: "cnpf-2024",
      requiredFields: [
        { name: "id_peuplement", type: "string", description: "Identifiant unique", required: true },
        { name: "essence", type: "string", description: "Essence dominante", required: true },
        { name: "classe_age", type: "string", description: "Classe d'âge", required: true },
        { name: "densite", type: "float", description: "Densité (tiges/ha)", required: true, min: 0 },
      ],
      optionalFields: [
        { name: "volume", type: "float", description: "Volume en m³/ha", required: false, min: 0 },
        { name: "regime", type: "string", description: "Régime", required: false },
      ],
      scaleRange: {
        minScale: 500,
        maxScale: 25000,
        recommendedScale: 2000,
        description: "Échelle CNPF",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "cnpf_peuplements",
      rendererType: "categorized",
      classificationField: "essence",
      categories: [
        { value: "chene", label: "Chênaie", color: "#228B22", strokeColor: "#006400", strokeWidth: 0.5, symbol: "diagonal_hatch", opacity: 0.8 },
        { value: "hetre", label: "Hêtraie", color: "#32CD32", strokeColor: "#228B22", strokeWidth: 0.5, symbol: "cross_hatch", opacity: 0.8 },
        { value: "resineux", label: "Résineux", color: "#006400", strokeColor: "#004d00", strokeWidth: 0.5, symbol: "vertical_hatch", opacity: 0.8 },
        { value: "feuillus_tendre", label: "Feuillus tendres", color: "#90EE90", strokeColor: "#228B22", strokeWidth: 0.5, symbol: "solid", opacity: 0.8 },
        { value: "melange", label: "Mélange", color: "#66CDAA", strokeColor: "#006400", strokeWidth: 0.5, symbol: "stipple", opacity: 0.8 },
      ],
      labelSettings: {
        enabled: true,
        field: "essence",
        fontSize: 10,
        color: "#000000",
        bufferEnabled: true,
        bufferSize: 1,
        bufferColor: "#FFFFFF",
      },
    },
  ],
  layoutRules: {
    pageSizes: [{ size: "A4", width: 210, height: 297, unit: "mm" }],
    orientations: [{ orientation: "portrait", default: true }],
    mandatoryElements: [
      { id: "map", type: "map", mandatory: true, position: { x: 15, y: 40, width: 180, height: 200, anchor: "topleft" } },
      { id: "legend", type: "legend", mandatory: true, position: { x: 200, y: 40, width: 85, height: 150, anchor: "topleft" } },
      { id: "scalebar", type: "scalebar", mandatory: true, position: { x: 15, y: 250, width: 120, height: 15, anchor: "topleft" } },
      { id: "title", type: "title", mandatory: true, position: { x: 15, y: 15, width: 270, height: 20, anchor: "topleft" } },
      { id: "source", type: "source", mandatory: true, position: { x: 15, y: 275, width: 270, height: 10, anchor: "topleft" } },
    ],
    optionalElements: [
      { id: "northarrow", type: "northarrow", mandatory: false, position: { x: 270, y: 195, width: 25, height: 25, anchor: "topleft" } },
    ],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "cnpf_forest",
      name: "Palette forestière CNPF",
      description: "Couleurs standard CNPF",
      colors: ["#228B22", "#32CD32", "#006400", "#90EE90", "#66CDAA"],
      useCases: ["peuplements", "vegetation"],
      colorBlindSafe: true,
      printSafe: true,
      source: "CNPF",
      year: 2024,
    },
  ],
  scaleRanges: [
    { minScale: 500, maxScale: 25000, recommendedScale: 2000, description: "Échelle CNPF" },
  ],
  metadata: {
    officialUrl: "https://www.cnpf.fr/",
    referenceDocument: "Guide CNPF de cartographie forestière 2024",
    lastUpdated: "2024-01-01",
    createdBy: "CNPF",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["foret", "prive", "peuplement", "france"],
    region: "France",
  },
};

// PSG Standard
export const PSG_STANDARD: CartographicStandard = {
  id: "psg-2023",
  name: "Norme PSG - Plan Simple de Gestion",
  organization: "CRPF",
  description: "Standard de cartographie pour les Plans Simples de Gestion",
  version: "2023",
  domain: "forestry",
  subdomain: "psg",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "psg_unites_gestion",
      name: "Unités de gestion",
      geometryType: "polygon",
      standardId: "psg-2023",
      requiredFields: [
        { name: "id_unite", type: "string", description: "Identifiant unique", required: true },
        { name: "type_gestion", type: "string", description: "Type de gestion", required: true },
        { name: "periode", type: "string", description: "Période", required: true },
      ],
      optionalFields: [
        { name: "objectif", type: "string", description: "Objectif", required: false },
      ],
      scaleRange: {
        minScale: 500,
        maxScale: 25000,
        recommendedScale: 2000,
        description: "Échelle PSG",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "psg_unites_gestion",
      rendererType: "categorized",
      classificationField: "type_gestion",
      categories: [
        { value: "regeneration", label: "Régénération", color: "#90EE90", strokeColor: "#228B22", strokeWidth: 1, symbol: "diagonal_hatch", opacity: 0.8 },
        { value: "entretien", label: "Entretien", color: "#FFD700", strokeColor: "#DAA520", strokeWidth: 1, symbol: "stipple", opacity: 0.8 },
        { value: "amelioration", label: "Amélioration", color: "#FFA500", strokeColor: "#FF8C00", strokeWidth: 1, symbol: "cross_hatch", opacity: 0.8 },
        { value: "exploitation", label: "Exploitation", color: "#FF6347", strokeColor: "#DC143C", strokeWidth: 1, symbol: "solid", opacity: 0.8 },
        { value: "protection", label: "Protection", color: "#4169E1", strokeColor: "#0000CD", strokeWidth: 1, symbol: "vertical_hatch", opacity: 0.8 },
      ],
      labelSettings: {
        enabled: true,
        field: "id_unite",
        fontSize: 12,
        color: "#000000",
        bufferEnabled: true,
        bufferSize: 2,
        bufferColor: "#FFFFFF",
      },
    },
  ],
  layoutRules: {
    pageSizes: [{ size: "A4", width: 210, height: 297, unit: "mm" }],
    orientations: [{ orientation: "portrait", default: true }],
    mandatoryElements: [
      { id: "map", type: "map", mandatory: true, position: { x: 15, y: 40, width: 180, height: 200, anchor: "topleft" } },
      { id: "legend", type: "legend", mandatory: true, position: { x: 200, y: 40, width: 85, height: 150, anchor: "topleft" } },
      { id: "scalebar", type: "scalebar", mandatory: true, position: { x: 15, y: 250, width: 120, height: 15, anchor: "topleft" } },
      { id: "title", type: "title", mandatory: true, position: { x: 15, y: 15, width: 270, height: 20, anchor: "topleft" } },
      { id: "subtitle", type: "title", mandatory: true, position: { x: 15, y: 30, width: 270, height: 8, anchor: "topleft" } },
      { id: "source", type: "source", mandatory: true, position: { x: 15, y: 275, width: 270, height: 10, anchor: "topleft" } },
    ],
    optionalElements: [
      { id: "northarrow", type: "northarrow", mandatory: false, position: { x: 270, y: 195, width: 25, height: 25, anchor: "topleft" } },
    ],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "psg_gestion",
      name: "Palette de gestion PSG",
      description: "Couleurs pour les types de gestion",
      colors: ["#90EE90", "#FFD700", "#FFA500", "#FF6347", "#4169E1"],
      useCases: ["unites_gestion", "interventions"],
      colorBlindSafe: true,
      printSafe: true,
      source: "CRPF",
      year: 2023,
    },
  ],
  scaleRanges: [
    { minScale: 500, maxScale: 25000, recommendedScale: 2000, description: "Échelle PSG" },
  ],
  metadata: {
    officialUrl: "https://www.crpf.fr/",
    referenceDocument: "Guide PSG 2023 - CRPF",
    lastUpdated: "2023-06-01",
    createdBy: "CRPF",
    mandatoryElements: ["title", "subtitle", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["psg", "gestion", "foret_prive", "france"],
    region: "France",
  },
};

// IGN Standard
export const IGN_STANDARD: CartographicStandard = {
  id: "ign-2024",
  name: "Norme IGN - Cartographie Topographique",
  organization: "IGN",
  description: "Standard de cartographie topographique IGN",
  version: "2024",
  domain: "topography",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "ign_bati",
      name: "Bâti",
      geometryType: "polygon",
      standardId: "ign-2024",
      requiredFields: [
        { name: "id_bati", type: "string", description: "Identifiant", required: true },
        { name: "type_bati", type: "string", description: "Type de bâti", required: true },
      ],
      optionalFields: [
        { name: "hauteur", type: "float", description: "Hauteur en mètres", required: false, min: 0 },
      ],
      scaleRange: {
        minScale: 100,
        maxScale: 50000,
        recommendedScale: 1000,
        description: "Échelle topographique",
      },
    },
    {
      id: "ign_routes",
      name: "Réseau routier",
      geometryType: "line",
      standardId: "ign-2024",
      requiredFields: [
        { name: "id_route", type: "string", description: "Identifiant", required: true },
        { name: "importance", type: "string", description: "Importance", required: true },
      ],
      optionalFields: [
        { name: "largeur", type: "float", description: "Largeur en mètres", required: false, min: 0 },
      ],
      scaleRange: {
        minScale: 100,
        maxScale: 50000,
        recommendedScale: 1000,
        description: "Échelle topographique",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "ign_bati",
      rendererType: "categorized",
      classificationField: "type_bati",
      categories: [
        { value: "habitation", label: "Habitation", color: "#FFB6C1", strokeColor: "#C71585", strokeWidth: 0.3, symbol: "solid", opacity: 0.8 },
        { value: "industriel", label: "Industriel", color: "#A9A9A9", strokeColor: "#696969", strokeWidth: 0.3, symbol: "diagonal_hatch", opacity: 0.8 },
        { value: "commercial", label: "Commercial", color: "#FFA07A", strokeColor: "#CD5C5C", strokeWidth: 0.3, symbol: "stipple", opacity: 0.8 },
      ],
    },
    {
      layerTypeId: "ign_routes",
      rendererType: "categorized",
      classificationField: "importance",
      categories: [
        { value: "autoroute", label: "Autoroute", color: "#FF0000", strokeColor: "#FF0000", strokeWidth: 3, symbol: "solid", opacity: 1 },
        { value: "nationale", label: "Route nationale", color: "#FFA500", strokeColor: "#FFA500", strokeWidth: 2.5, symbol: "solid", opacity: 1 },
        { value: "departementale", label: "Route départementale", color: "#FFFF00", strokeColor: "#FFFF00", strokeWidth: 2, symbol: "solid", opacity: 1 },
        { value: "communale", label: "Route communale", color: "#FFFFFF", strokeColor: "#FFFFFF", strokeWidth: 1.5, symbol: "solid", opacity: 1 },
      ],
    },
  ],
  layoutRules: {
    pageSizes: [{ size: "A4", width: 210, height: 297, unit: "mm" }],
    orientations: [{ orientation: "landscape", default: true }],
    mandatoryElements: [
      { id: "map", type: "map", mandatory: true, position: { x: 20, y: 20, width: 250, height: 170, anchor: "topleft" } },
      { id: "legend", type: "legend", mandatory: true, position: { x: 275, y: 20, width: 60, height: 150, anchor: "topleft" } },
      { id: "scalebar", type: "scalebar", mandatory: true, position: { x: 20, y: 200, width: 150, height: 12, anchor: "topleft" } },
      { id: "northarrow", type: "northarrow", mandatory: true, position: { x: 270, y: 175, width: 30, height: 30, anchor: "topleft" } },
      { id: "title", type: "title", mandatory: true, position: { x: 20, y: 5, width: 315, height: 12, anchor: "topleft" } },
      { id: "source", type: "source", mandatory: true, position: { x: 20, y: 220, width: 315, height: 8, anchor: "topleft" } },
    ],
    optionalElements: [
      { id: "subtitle", type: "title", mandatory: false, position: { x: 20, y: 12, width: 315, height: 6, anchor: "topleft" } },
    ],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "ign_topo",
      name: "Palette topographique IGN",
      description: "Couleurs standard IGN",
      colors: ["#FFB6C1", "#A9A9A9", "#FFA07A", "#FF0000", "#FFA500", "#FFFF00", "#FFFFFF"],
      useCases: ["bati", "routes", "hydrographie"],
      colorBlindSafe: true,
      printSafe: true,
      source: "IGN",
      year: 2024,
    },
  ],
  scaleRanges: [
    { minScale: 100, maxScale: 50000, recommendedScale: 1000, description: "Échelle topographique IGN" },
  ],
  metadata: {
    officialUrl: "https://www.ign.fr/",
    referenceDocument: "Spécifications IGN 2024",
    lastUpdated: "2024-03-01",
    createdBy: "IGN",
    mandatoryElements: ["title", "legend", "scalebar", "northarrow", "source"],
    optionalElements: ["subtitle"],
    tags: ["topographie", "bati", "routes", "france", "ign"],
    region: "France",
  },
};

// IFN Standard
export const IFN_STANDARD: CartographicStandard = {
  id: "ifn-2022",
  name: "Norme IFN - Inventaire Forestier National",
  organization: "IGN",
  description: "Standard de cartographie pour l'IFN",
  version: "2022",
  domain: "forestry",
  subdomain: "inventaire",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "ifn_placettes",
      name: "Placettes IFN",
      geometryType: "point",
      standardId: "ifn-2022",
      requiredFields: [
        { name: "id_placette", type: "string", description: "Identifiant", required: true },
        { name: "type_peuplement", type: "string", description: "Type de peuplement", required: true },
      ],
      optionalFields: [
        { name: "volume", type: "float", description: "Volume", required: false, min: 0 },
      ],
      scaleRange: {
        minScale: 1000,
        maxScale: 100000,
        recommendedScale: 10000,
        description: "Échelle IFN",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "ifn_placettes",
      rendererType: "categorized",
      classificationField: "type_peuplement",
      categories: [
        { value: "feuillus", label: "Feuillus", color: "#228B22", strokeColor: "#006400", strokeWidth: 0.5, symbol: "circle", opacity: 1 },
        { value: "coniferes", label: "Conifères", color: "#006400", strokeColor: "#004d00", strokeWidth: 0.5, symbol: "triangle", opacity: 1 },
        { value: "mixte", label: "Mixte", color: "#32CD32", strokeColor: "#228B22", strokeWidth: 0.5, symbol: "square", opacity: 1 },
      ],
      labelSettings: {
        enabled: true,
        field: "id_placette",
        fontSize: 8,
        color: "#000000",
        bufferEnabled: true,
        bufferSize: 1,
        bufferColor: "#FFFFFF",
      },
    },
  ],
  layoutRules: {
    pageSizes: [{ size: "A3", width: 297, height: 420, unit: "mm" }],
    orientations: [{ orientation: "landscape", default: true }],
    mandatoryElements: [
      { id: "map", type: "map", mandatory: true, position: { x: 20, y: 30, width: 380, height: 250, anchor: "topleft" } },
      { id: "legend", type: "legend", mandatory: true, position: { x: 410, y: 30, width: 100, height: 200, anchor: "topleft" } },
      { id: "scalebar", type: "scalebar", mandatory: true, position: { x: 20, y: 290, width: 200, height: 15, anchor: "topleft" } },
      { id: "title", type: "title", mandatory: true, position: { x: 20, y: 10, width: 490, height: 15, anchor: "topleft" } },
      { id: "source", type: "source", mandatory: true, position: { x: 20, y: 310, width: 490, height: 10, anchor: "topleft" } },
    ],
    optionalElements: [
      { id: "northarrow", type: "northarrow", mandatory: false, position: { x: 490, y: 230, width: 30, height: 30, anchor: "topleft" } },
    ],
    margin: { top: 15, right: 15, bottom: 15, left: 15 },
  },
  colorPalettes: [
    {
      id: "ifn_forest",
      name: "Palette IFN",
      description: "Couleurs standard IFN",
      colors: ["#228B22", "#006400", "#32CD32"],
      useCases: ["placettes", "tessons"],
      colorBlindSafe: true,
      printSafe: true,
      source: "IGN",
      year: 2022,
    },
  ],
  scaleRanges: [
    { minScale: 1000, maxScale: 100000, recommendedScale: 10000, description: "Échelle IFN" },
  ],
  metadata: {
    officialUrl: "https://inventaire-forestier.ign.fr/",
    referenceDocument: "Spécifications IFN 2022",
    lastUpdated: "2022-09-01",
    createdBy: "IGN",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["ifn", "inventaire", "placettes", "france"],
    region: "France",
  },
};

// Export all standards
export const CARTOGRAPHIC_STANDARDS = [
  ONF_STANDARD,
  CNPF_STANDARD,
  PSG_STANDARD,
  IGN_STANDARD,
  IFN_STANDARD,
];

// Helper function to get standard by ID
export function getStandardById(id: string): CartographicStandard | undefined {
  return CARTOGRAPHIC_STANDARDS.find(standard => standard.id === id);
}

// Helper function to get standards by domain
export function getStandardsByDomain(domain: string): CartographicStandard[] {
  return CARTOGRAPHIC_STANDARDS.filter(standard => standard.domain === domain);
}

// Helper function to get standards by organization
export function getStandardsByOrganization(organization: string): CartographicStandard[] {
  return CARTOGRAPHIC_STANDARDS.filter(standard => standard.organization === organization);
}

// Helper function to get standards by country
export function getStandardsByCountry(country: string): CartographicStandard[] {
  return CARTOGRAPHIC_STANDARDS.filter(standard => standard.country === country);
}
