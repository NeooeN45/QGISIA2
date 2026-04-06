/**
 * Cartographic Standards Database - Additional French Standards
 * 
 * Normes cartographiques supplémentaires françaises
 * 
 * Normes incluses :
 * - BRGM (Bureau de Recherches Géologiques et Minières)
 * - INRAE (Institut National de Recherche pour l'Agriculture, l'Alimentation et l'Environnement)
 * - CEREMA (Centre d'études et d'expertise sur les risques, l'environnement, la mobilité et l'aménagement)
 * - DREAL (Directions Régionales de l'Environnement, de l'Aménagement et du Logement)
 * - ADEME (Agence de l'Environnement et de la Maîtrise de l'Énergie)
 * - OFB (Office Français de la Biodiversité)
 */

import { CartographicStandard } from "./cartographic-standards";

// BRGM Standard
export const BRGM_STANDARD: CartographicStandard = {
  id: "brgm-2024",
  name: "Norme BRGM - Cartographie Géologique",
  organization: "BRGM",
  description: "Standard de cartographie géologique pour les sols et sous-sols",
  version: "2024",
  domain: "geology",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "brgm_sol",
      name: "Types de sols",
      geometryType: "polygon",
      standardId: "brgm-2024",
      requiredFields: [
        { name: "id_sol", type: "string", description: "Identifiant unique", required: true },
        { name: "type_sol", type: "string", description: "Type de sol", required: true },
        { name: "texture", type: "string", description: "Texture", required: true },
      ],
      optionalFields: [
        { name: "profondeur", type: "float", description: "Profondeur en cm", required: false, min: 0 },
        { name: "ph", type: "float", description: "pH", required: false },
      ],
      scaleRange: {
        minScale: 1000,
        maxScale: 100000,
        recommendedScale: 10000,
        description: "Échelle géologique",
      },
    },
    {
      id: "brgm_aquifere",
      name: "Aquifères",
      geometryType: "polygon",
      standardId: "brgm-2024",
      requiredFields: [
        { name: "id_aquifere", type: "string", description: "Identifiant unique", required: true },
        { name: "type_aquifere", type: "string", description: "Type d'aquifère", required: true },
      ],
      optionalFields: [
        { name: "profondeur_nappe", type: "float", description: "Profondeur nappe en m", required: false, min: 0 },
      ],
      scaleRange: {
        minScale: 5000,
        maxScale: 500000,
        recommendedScale: 50000,
        description: "Échelle hydrogéologique",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "brgm_sol",
      rendererType: "categorized",
      classificationField: "type_sol",
      categories: [
        { value: "argile", label: "Argile", color: "#8B4513", strokeColor: "#5D3A1A", strokeWidth: 0.5, symbol: "solid", opacity: 0.8 },
        { value: "limon", label: "Limon", color: "#D2B48C", strokeColor: "#A0826D", strokeWidth: 0.5, symbol: "solid", opacity: 0.8 },
        { value: "sable", label: "Sable", color: "#F4A460", strokeColor: "#CD853F", strokeWidth: 0.5, symbol: "stipple", opacity: 0.8 },
        { value: "calcaire", label: "Calcaire", color: "#E6E6FA", strokeColor: "#B8B8D1", strokeWidth: 0.5, symbol: "diagonal_hatch", opacity: 0.8 },
        { value: "humus", label: "Humus", color: "#2E8B57", strokeColor: "#1B5E3A", strokeWidth: 0.5, symbol: "cross_hatch", opacity: 0.8 },
      ],
      labelSettings: {
        enabled: true,
        field: "type_sol",
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
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "brgm_geology",
      name: "Palette géologique BRGM",
      description: "Couleurs standard BRGM pour la géologie",
      colors: ["#8B4513", "#D2B48C", "#F4A460", "#E6E6FA", "#2E8B57"],
      useCases: ["sols", "aquiferes", "geologie"],
      colorBlindSafe: true,
      printSafe: true,
      source: "BRGM",
      year: 2024,
    },
  ],
  scaleRanges: [
    { minScale: 1000, maxScale: 100000, recommendedScale: 10000, description: "Échelle géologique" },
  ],
  metadata: {
    officialUrl: "https://www.brgm.fr/",
    referenceDocument: "Spécifications BRGM 2024",
    lastUpdated: "2024-02-01",
    createdBy: "BRGM",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["geologie", "sol", "aquifere", "france", "brgm"],
    region: "France",
  },
};

// INRAE Standard
export const INRAE_STANDARD: CartographicStandard = {
  id: "inrae-2023",
  name: "Norme INRAE - Cartographie Agricole et Environnementale",
  organization: "INRAE",
  description: "Standard de cartographie pour l'agriculture et l'environnement",
  version: "2023",
  domain: "agriculture",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "inrae_culture",
      name: "Types de cultures",
      geometryType: "polygon",
      standardId: "inrae-2023",
      requiredFields: [
        { name: "id_culture", type: "string", description: "Identifiant unique", required: true },
        { name: "type_culture", type: "string", description: "Type de culture", required: true },
      ],
      optionalFields: [
        { name: "variete", type: "string", description: "Variété", required: false },
        { name: "rendement", type: "float", description: "Rendement", required: false, min: 0 },
      ],
      scaleRange: {
        minScale: 500,
        maxScale: 50000,
        recommendedScale: 5000,
        description: "Échelle agricole",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "inrae_culture",
      rendererType: "categorized",
      classificationField: "type_culture",
      categories: [
        { value: "ble", label: "Blé", color: "#F5DEB3", strokeColor: "#D2B48C", strokeWidth: 0.5, symbol: "solid", opacity: 0.8 },
        { value: "mais", label: "Maïs", color: "#FFD700", strokeColor: "#DAA520", strokeWidth: 0.5, symbol: "solid", opacity: 0.8 },
        { value: "colza", label: "Colza", color: "#FFA500", strokeColor: "#FF8C00", strokeWidth: 0.5, symbol: "solid", opacity: 0.8 },
        { value: "tournesol", label: "Tournesol", color: "#FF6347", strokeColor: "#DC143C", strokeWidth: 0.5, symbol: "solid", opacity: 0.8 },
        { value: "vigne", label: "Vigne", color: "#800080", strokeColor: "#600060", strokeWidth: 0.5, symbol: "diagonal_hatch", opacity: 0.8 },
        { value: "prairie", label: "Prairie", color: "#90EE90", strokeColor: "#228B22", strokeWidth: 0.5, symbol: "stipple", opacity: 0.8 },
      ],
      labelSettings: {
        enabled: true,
        field: "type_culture",
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
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "inrae_agriculture",
      name: "Palette agricole INRAE",
      description: "Couleurs standard INRAE pour l'agriculture",
      colors: ["#F5DEB3", "#FFD700", "#FFA500", "#FF6347", "#800080", "#90EE90"],
      useCases: ["cultures", "agriculture", "environnement"],
      colorBlindSafe: true,
      printSafe: true,
      source: "INRAE",
      year: 2023,
    },
  ],
  scaleRanges: [
    { minScale: 500, maxScale: 50000, recommendedScale: 5000, description: "Échelle agricole" },
  ],
  metadata: {
    officialUrl: "https://www.inrae.fr/",
    referenceDocument: "Spécifications INRAE 2023",
    lastUpdated: "2023-05-01",
    createdBy: "INRAE",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["agriculture", "culture", "environnement", "france", "inrae"],
    region: "France",
  },
};

// CEREMA Standard
export const CEREMA_STANDARD: CartographicStandard = {
  id: "cerema-2024",
  name: "Norme CEREMA - Aménagement et Risques",
  organization: "CEREMA",
  description: "Standard de cartographie pour l'aménagement et les risques",
  version: "2024",
  domain: "urban",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "cerema_zone_urban",
      name: "Zones urbaines",
      geometryType: "polygon",
      standardId: "cerema-2024",
      requiredFields: [
        { name: "id_zone", type: "string", description: "Identifiant unique", required: true },
        { name: "type_zone", type: "string", description: "Type de zone", required: true },
      ],
      optionalFields: [
        { name: "densite", type: "float", description: "Densité hab/ha", required: false, min: 0 },
      ],
      scaleRange: {
        minScale: 200,
        maxScale: 25000,
        recommendedScale: 1000,
        description: "Échelle urbaine",
      },
    },
    {
      id: "cerema_risque",
      name: "Zones de risque",
      geometryType: "polygon",
      standardId: "cerema-2024",
      requiredFields: [
        { name: "id_risque", type: "string", description: "Identifiant unique", required: true },
        { name: "type_risque", type: "string", description: "Type de risque", required: true },
        { name: "niveau", type: "string", description: "Niveau de risque", required: true },
      ],
      optionalFields: [],
      scaleRange: {
        minScale: 500,
        maxScale: 50000,
        recommendedScale: 5000,
        description: "Échelle risque",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "cerema_zone_urban",
      rendererType: "categorized",
      classificationField: "type_zone",
      categories: [
        { value: "residentiel", label: "Résidentiel", color: "#87CEEB", strokeColor: "#4682B4", strokeWidth: 0.5, symbol: "solid", opacity: 0.8 },
        { value: "commercial", label: "Commercial", color: "#FFA07A", strokeColor: "#CD5C5C", strokeWidth: 0.5, symbol: "diagonal_hatch", opacity: 0.8 },
        { value: "industriel", label: "Industriel", color: "#A9A9A9", strokeColor: "#696969", strokeWidth: 0.5, symbol: "cross_hatch", opacity: 0.8 },
        { value: "equipement", label: "Équipement", color: "#98FB98", strokeColor: "#3CB371", strokeWidth: 0.5, symbol: "stipple", opacity: 0.8 },
      ],
      labelSettings: {
        enabled: true,
        field: "type_zone",
        fontSize: 10,
        color: "#000000",
        bufferEnabled: true,
        bufferSize: 1,
        bufferColor: "#FFFFFF",
      },
    },
    {
      layerTypeId: "cerema_risque",
      rendererType: "categorized",
      classificationField: "niveau",
      categories: [
        { value: "faible", label: "Risque faible", color: "#90EE90", strokeColor: "#228B22", strokeWidth: 1, symbol: "solid", opacity: 0.6 },
        { value: "moyen", label: "Risque moyen", color: "#FFD700", strokeColor: "#DAA520", strokeWidth: 1, symbol: "diagonal_hatch", opacity: 0.6 },
        { value: "fort", label: "Risque fort", color: "#FF6347", strokeColor: "#DC143C", strokeWidth: 1, symbol: "cross_hatch", opacity: 0.6 },
        { value: "tres_fort", label: "Risque très fort", color: "#FF0000", strokeColor: "#8B0000", strokeWidth: 1.5, symbol: "solid", opacity: 0.8 },
      ],
      labelSettings: {
        enabled: true,
        field: "type_risque",
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
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "cerema_urban",
      name: "Palette urbaine CEREMA",
      description: "Couleurs standard CEREMA pour l'urbanisme",
      colors: ["#87CEEB", "#FFA07A", "#A9A9A9", "#98FB98"],
      useCases: ["zones_urban", "amenagement", "risque"],
      colorBlindSafe: true,
      printSafe: true,
      source: "CEREMA",
      year: 2024,
    },
  ],
  scaleRanges: [
    { minScale: 200, maxScale: 25000, recommendedScale: 1000, description: "Échelle urbaine" },
  ],
  metadata: {
    officialUrl: "https://www.cerema.fr/",
    referenceDocument: "Spécifications CEREMA 2024",
    lastUpdated: "2024-01-01",
    createdBy: "CEREMA",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["urbanisme", "amenagement", "risque", "france", "cerema"],
    region: "France",
  },
};

// DREAL Standard
export const DREAL_STANDARD: CartographicStandard = {
  id: "dreal-2023",
  name: "Norme DREAL - Environnement et Aménagement",
  organization: "DREAL",
  description: "Standard de cartographie pour l'environnement et l'aménagement régional",
  version: "2023",
  domain: "environment",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "dreal_zone_protegee",
      name: "Zones protégées",
      geometryType: "polygon",
      standardId: "dreal-2023",
      requiredFields: [
        { name: "id_zone", type: "string", description: "Identifiant unique", required: true },
        { name: "type_protection", type: "string", description: "Type de protection", required: true },
      ],
      optionalFields: [],
      scaleRange: {
        minScale: 500,
        maxScale: 100000,
        recommendedScale: 10000,
        description: "Échelle environnementale",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "dreal_zone_protegee",
      rendererType: "categorized",
      classificationField: "type_protection",
      categories: [
        { value: "natura_2000", label: "Natura 2000", color: "#32CD32", strokeColor: "#228B22", strokeWidth: 1, symbol: "diagonal_hatch", opacity: 0.7 },
        { value: "znieff", label: "ZNIEFF", color: "#006400", strokeColor: "#004d00", strokeWidth: 1, symbol: "cross_hatch", opacity: 0.7 },
        { value: "reserve_naturelle", label: "Réserve naturelle", color: "#228B22", strokeColor: "#1B5E3A", strokeWidth: 1.5, symbol: "solid", opacity: 0.8 },
        { value: "parc_national", label: "Parc national", color: "#006400", strokeColor: "#003300", strokeWidth: 2, symbol: "solid", opacity: 0.9 },
      ],
      labelSettings: {
        enabled: true,
        field: "type_protection",
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
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "dreal_environment",
      name: "Palette environnement DREAL",
      description: "Couleurs standard DREAL pour l'environnement",
      colors: ["#32CD32", "#006400", "#228B22"],
      useCases: ["zones_protegees", "environnement", "biodiversite"],
      colorBlindSafe: true,
      printSafe: true,
      source: "DREAL",
      year: 2023,
    },
  ],
  scaleRanges: [
    { minScale: 500, maxScale: 100000, recommendedScale: 10000, description: "Échelle environnementale" },
  ],
  metadata: {
    officialUrl: "https://www.dreal.fr/",
    referenceDocument: "Spécifications DREAL 2023",
    lastUpdated: "2023-04-01",
    createdBy: "DREAL",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["environnement", "protection", "biodiversite", "france", "dreal"],
    region: "France",
  },
};

// ADEME Standard
export const ADEME_STANDARD: CartographicStandard = {
  id: "ademe-2023",
  name: "Norme ADEME - Énergie et Environnement",
  organization: "ADEME",
  description: "Standard de cartographie pour l'énergie et l'environnement",
  version: "2023",
  domain: "energy",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "ademe_eolien",
      name: "Parcs éoliens",
      geometryType: "point",
      standardId: "ademe-2023",
      requiredFields: [
        { name: "id_eolien", type: "string", description: "Identifiant unique", required: true },
        { name: "puissance", type: "float", description: "Puissance en MW", required: true, min: 0 },
      ],
      optionalFields: [],
      scaleRange: {
        minScale: 1000,
        maxScale: 100000,
        recommendedScale: 10000,
        description: "Échelle énergie",
      },
    },
    {
      id: "ademe_solaire",
      name: "Installations solaires",
      geometryType: "polygon",
      standardId: "ademe-2023",
      requiredFields: [
        { name: "id_solaire", type: "string", description: "Identifiant unique", required: true },
        { name: "puissance", type: "float", description: "Puissance en MWc", required: true, min: 0 },
      ],
      optionalFields: [],
      scaleRange: {
        minScale: 500,
        maxScale: 50000,
        recommendedScale: 5000,
        description: "Échelle énergie",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "ademe_eolien",
      rendererType: "graduated",
      classificationField: "puissance",
      categories: [],
      labelSettings: {
        enabled: true,
        field: "puissance",
        fontSize: 8,
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
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "ademe_energy",
      name: "Palette énergie ADEME",
      description: "Couleurs standard ADEME pour l'énergie",
      colors: ["#87CEEB", "#FFD700", "#32CD32"],
      useCases: ["eolien", "solaire", "energie"],
      colorBlindSafe: true,
      printSafe: true,
      source: "ADEME",
      year: 2023,
    },
  ],
  scaleRanges: [
    { minScale: 500, maxScale: 100000, recommendedScale: 10000, description: "Échelle énergie" },
  ],
  metadata: {
    officialUrl: "https://www.ademe.fr/",
    referenceDocument: "Spécifications ADEME 2023",
    lastUpdated: "2023-06-01",
    createdBy: "ADEME",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["energie", "eolien", "solaire", "environnement", "france", "ademe"],
    region: "France",
  },
};

// OFB Standard
export const OFB_STANDARD: CartographicStandard = {
  id: "ofb-2024",
  name: "Norme OFB - Biodiversité",
  organization: "OFB",
  description: "Standard de cartographie pour la biodiversité",
  version: "2024",
  domain: "environment",
  subdomain: "biodiversite",
  country: "France",
  language: "fr",
  layerTypes: [
    {
      id: "ofb_espece",
      name: "Présence d'espèces",
      geometryType: "point",
      standardId: "ofb-2024",
      requiredFields: [
        { name: "id_observation", type: "string", description: "Identifiant unique", required: true },
        { name: "espece", type: "string", description: "Espèce", required: true },
      ],
      optionalFields: [
        { name: "date_observation", type: "date", description: "Date d'observation", required: false },
      ],
      scaleRange: {
        minScale: 1000,
        maxScale: 100000,
        recommendedScale: 10000,
        description: "Échelle biodiversité",
      },
    },
  ],
  symbologyRules: [
    {
      layerTypeId: "ofb_espece",
      rendererType: "categorized",
      classificationField: "espece",
      categories: [],
      labelSettings: {
        enabled: true,
        field: "espece",
        fontSize: 8,
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
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "ofb_biodiversite",
      name: "Palette biodiversité OFB",
      description: "Couleurs standard OFB pour la biodiversité",
      colors: ["#32CD32", "#228B22", "#006400", "#90EE90"],
      useCases: ["especes", "biodiversite", "environnement"],
      colorBlindSafe: true,
      printSafe: true,
      source: "OFB",
      year: 2024,
    },
  ],
  scaleRanges: [
    { minScale: 1000, maxScale: 100000, recommendedScale: 10000, description: "Échelle biodiversité" },
  ],
  metadata: {
    officialUrl: "https://www.ofb.fr/",
    referenceDocument: "Spécifications OFB 2024",
    lastUpdated: "2024-01-01",
    createdBy: "OFB",
    mandatoryElements: ["title", "legend", "scalebar", "source"],
    optionalElements: ["northarrow"],
    tags: ["biodiversite", "especes", "environnement", "france", "ofb"],
    region: "France",
  },
};

// Export all additional standards
export const ADDITIONAL_STANDARDS = [
  BRGM_STANDARD,
  INRAE_STANDARD,
  CEREMA_STANDARD,
  DREAL_STANDARD,
  ADEME_STANDARD,
  OFB_STANDARD,
];
