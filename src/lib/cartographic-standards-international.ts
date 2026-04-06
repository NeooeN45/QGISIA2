/**
 * Cartographic Standards Database - International Standards
 * 
 * Normes cartographiques internationales et européennes
 * 
 * Normes incluses :
 * - ISO (International Organization for Standardization)
 * - OGC (Open Geospatial Consortium)
 * - INSPIRE (Infrastructure for Spatial Information in Europe)
 * - Eurostat
 * - EEA (European Environment Agency)
 * - Copernicus
 */

import { CartographicStandard } from "./cartographic-standards";
import { CARTOGRAPHIC_STANDARDS } from "./cartographic-standards";
import { ADDITIONAL_STANDARDS } from "./cartographic-standards-additional";

// Re-export for convenience
export type { CartographicStandard } from "./cartographic-standards";

// ISO 19115 Standard
export const ISO_19115_STANDARD: CartographicStandard = {
  id: "iso-19115-2024",
  name: "Norme ISO 19115 - Métadonnées géographiques",
  organization: "ISO",
  description: "Standard international pour les métadonnées géographiques",
  version: "2024",
  domain: "topography",
  country: "International",
  language: "en",
  layerTypes: [],
  symbologyRules: [],
  layoutRules: {
    pageSizes: [{ size: "A4", width: 210, height: 297, unit: "mm" }],
    orientations: [{ orientation: "portrait", default: true }],
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [],
  scaleRanges: [],
  metadata: {
    officialUrl: "https://www.iso.org/",
    referenceDocument: "ISO 19115:2024",
    lastUpdated: "2024-01-01",
    createdBy: "ISO",
    mandatoryElements: ["title", "abstract", "keywords", "extent"],
    optionalElements: ["contact", "lineage", "quality"],
    tags: ["iso", "metadata", "international", "standard"],
    region: "International",
  },
};

// OGC WMS Standard
export const OGC_WMS_STANDARD: CartographicStandard = {
  id: "ogc-wms-2023",
  name: "Norme OGC WMS - Web Map Service",
  organization: "OGC",
  description: "Standard OGC pour les services de cartes web",
  version: "2023",
  domain: "topography",
  country: "International",
  language: "en",
  layerTypes: [],
  symbologyRules: [],
  layoutRules: {
    pageSizes: [{ size: "A4", width: 210, height: 297, unit: "mm" }],
    orientations: [{ orientation: "portrait", default: true }],
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [],
  scaleRanges: [],
  metadata: {
    officialUrl: "https://www.ogc.org/",
    referenceDocument: "OGC WMS 1.3.0",
    lastUpdated: "2023-01-01",
    createdBy: "OGC",
    mandatoryElements: ["service", "version", "request", "layers"],
    optionalElements: ["styles", "srs", "bbox", "format"],
    tags: ["ogc", "wms", "web", "international"],
    region: "International",
  },
};

// INSPIRE Standard
export const INSPIRE_STANDARD: CartographicStandard = {
  id: "inspire-2024",
  name: "Norme INSPIRE - Infrastructure européenne d'information spatiale",
  organization: "European Union",
  description: "Directive INSPIRE pour les données géographiques européennes",
  version: "2024",
  domain: "topography",
  country: "Europe",
  language: "en",
  layerTypes: [],
  symbologyRules: [],
  layoutRules: {
    pageSizes: [{ size: "A4", width: 210, height: 297, unit: "mm" }],
    orientations: [{ orientation: "portrait", default: true }],
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [],
  scaleRanges: [],
  metadata: {
    officialUrl: "https://inspire.ec.europa.eu/",
    referenceDocument: "Directive INSPIRE 2007/2/EC",
    lastUpdated: "2024-01-01",
    createdBy: "European Union",
    mandatoryElements: ["title", "abstract", "keywords", "contact", "extent"],
    optionalElements: ["lineage", "quality", "conformity"],
    tags: ["inspire", "europe", "metadata", "spatial"],
    region: "Europe",
  },
};

// Copernicus Standard
export const COPERNICUS_STANDARD: CartographicStandard = {
  id: "copernicus-2024",
  name: "Norme Copernicus - Observation de la Terre",
  organization: "European Commission",
  description: "Standard Copernicus pour les données d'observation de la Terre",
  version: "2024",
  domain: "environment",
  country: "Europe",
  language: "en",
  layerTypes: [
    {
      id: "copernicus_ndvi",
      name: "NDVI Sentinel-2",
      geometryType: "raster",
      standardId: "copernicus-2024",
      requiredFields: [
        { name: "date", type: "date", description: "Date d'acquisition", required: true },
        { name: "resolution", type: "integer", description: "Résolution en mètres", required: true },
      ],
      optionalFields: [
        { name: "cloud_cover", type: "float", description: "Couverture nuageuse %", required: false, min: 0, max: 100 },
      ],
      scaleRange: {
        minScale: 1000,
        maxScale: 500000,
        recommendedScale: 10000,
        description: "Échelle satellite",
      },
    },
  ],
  symbologyRules: [],
  layoutRules: {
    pageSizes: [{ size: "A4", width: 210, height: 297, unit: "mm" }],
    orientations: [{ orientation: "portrait", default: true }],
    mandatoryElements: [],
    optionalElements: [],
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  colorPalettes: [
    {
      id: "copernicus_ndvi",
      name: "Palette NDVI Copernicus",
      description: "Couleurs standard pour le NDVI",
      colors: ["#8B4513", "#CD853F", "#F4A460", "#90EE90", "#228B22", "#006400"],
      useCases: ["ndvi", "vegetation", "satellite"],
      colorBlindSafe: true,
      printSafe: true,
      source: "Copernicus",
      year: 2024,
    },
  ],
  scaleRanges: [
    { minScale: 1000, maxScale: 500000, recommendedScale: 10000, description: "Échelle satellite" },
  ],
  metadata: {
    officialUrl: "https://www.copernicus.eu/",
    referenceDocument: "Copernicus Data Specification 2024",
    lastUpdated: "2024-01-01",
    createdBy: "European Commission",
    mandatoryElements: ["title", "date", "resolution", "source"],
    optionalElements: ["cloud_cover", "processing_level"],
    tags: ["copernicus", "sentinel", "ndvi", "satellite", "europe"],
    region: "Europe",
  },
};

// Export all international standards
export const INTERNATIONAL_STANDARDS = [
  ISO_19115_STANDARD,
  OGC_WMS_STANDARD,
  INSPIRE_STANDARD,
  COPERNICUS_STANDARD,
];

// Export all standards combined
export const ALL_STANDARDS = [
  ...CARTOGRAPHIC_STANDARDS,
  ...ADDITIONAL_STANDARDS,
  ...INTERNATIONAL_STANDARDS,
];
