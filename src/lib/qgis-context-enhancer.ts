/**
 * Amélioration de la compréhension contextuelle de QGIS pour le LLM
 * Fournit une description riche et structurée du contexte du projet
 */

import {
  getLayersCatalog,
  getSystemSpecs,
  getLayerDiagnostics,
  isQgisAvailable,
} from "./qgis";
import type { RemoteServiceConfig } from "./catalog";

export interface RichQgisContext {
  project: {
    name: string;
    crs: string;
    crsDescription: string;
    totalLayers: number;
    visibleLayers: number;
    hasUnsavedChanges?: boolean;
  };
  layers: {
    vector: RichLayerInfo[];
    raster: RichLayerInfo[];
    total: number;
  };
  spatial: {
    extent: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
      center: [number, number];
    } | null;
    scale: number | null;
    visibleExtent: string | null;
  };
  data: {
    totalFeatures: number;
    totalVertices: number;
    estimatedSize: string;
  };
  system: {
    platform: string;
    qgisVersion?: string;
    availableMemory?: string;
  };
  analysis: {
    dominantGeometryType: string | null;
    has3DData: boolean;
    hasTimeData: boolean;
    hasNetworkData: boolean;
    dataCompleteness: number; // 0-100%
  };
}

export interface RichLayerInfo {
  id: string;
  name: string;
  type: "vector" | "raster";
  geometryType?: string;
  crs: string;
  featureCount: number;
  visible: boolean;
  opacity: number;
  selected?: boolean;
  selectedFeatureCount?: number;
  // Analyse enrichie
  fieldCount?: number;
  attributeCompleteness?: number; // % de champs remplis
  spatialValidity?: number; // % de géométries valides
  hasZ?: boolean;
  hasM?: boolean;
  bounds?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  // Relations
  relatedLayers?: string[];
  // Style
  hasStyle: boolean;
  styleType?: string;
}

/**
 * Génère un contexte QGIS enrichi pour le LLM
 */
export async function generateRichQgisContext(): Promise<RichQgisContext | null> {
  if (!isQgisAvailable()) {
    return null;
  }

  try {
    const [layers, specs] = await Promise.all([
      getLayersCatalog(),
      getSystemSpecs(),
    ]);

    // Classer les couches
    const vectorLayers = layers.filter(l => l.type?.toLowerCase() === "vector");
    const rasterLayers = layers.filter(l => l.type?.toLowerCase() === "raster");

    // Enrichir les informations des couches vectorielles
    const enrichedVector = await Promise.all(
      vectorLayers.slice(0, 10).map(async layer => {
        try {
          const diag = await getLayerDiagnostics(layer.id);
          return enrichLayerInfo(layer, diag);
        } catch {
          return enrichLayerInfo(layer, null);
        }
      })
    );

    const enrichedRaster = rasterLayers.slice(0, 5).map(layer => 
      enrichLayerInfo(layer, null)
    );

    // Calculer les métriques globales
    const totalFeatures = vectorLayers.reduce((sum, l) => sum + (l.featureCount || 0), 0);
    const visibleLayers = layers.filter(l => l.visible).length;

    // Détecter le type de géométrie dominant
    const geometryCounts: Record<string, number> = {};
    vectorLayers.forEach(l => {
      const geom = l.geometryType || "Unknown";
      geometryCounts[geom] = (geometryCounts[geom] || 0) + (l.featureCount || 0);
    });
    const dominantGeometry = Object.entries(geometryCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    // Vérifier la présence de données 3D, temporelles, réseau
    const has3D = vectorLayers.some(l => 
      l.geometryType?.toLowerCase().includes("25d") ||
      l.geometryType?.toLowerCase().includes("3d") ||
      l.geometryType?.toLowerCase().includes("polyhedron")
    );

    const hasTimeData = vectorLayers.some(l => 
      l.name.toLowerCase().includes("date") ||
      l.name.toLowerCase().includes("temp") ||
      l.name.toLowerCase().includes("temps")
    );

    const hasNetwork = vectorLayers.some(l => 
      l.name.toLowerCase().includes("route") ||
      l.name.toLowerCase().includes("network") ||
      l.name.toLowerCase().includes("reseau") ||
      l.name.toLowerCase().includes("chemin")
    );

    // Calculer la complétude des données (approximation)
    const dataCompleteness = calculateDataCompleteness(enrichedVector);

    return {
      project: {
        name: "Projet QGIS courant",
        crs: "EPSG:2154",
        crsDescription: getCrsDescription("EPSG:2154"),
        totalLayers: layers.length,
        visibleLayers,
      },
      layers: {
        vector: enrichedVector,
        raster: enrichedRaster,
        total: layers.length,
      },
      spatial: {
        extent: null, // À implémenter avec une API bridge dédiée
        scale: null,
        visibleExtent: null,
      },
      data: {
        totalFeatures,
        totalVertices: estimateVertices(vectorLayers),
        estimatedSize: estimateDataSize(layers),
      },
      system: {
        platform: specs.platform || "Windows",
        qgisVersion: "3.x",
        availableMemory: specs.ram_total_gb ? `${specs.ram_total_gb} Go` : undefined,
      },
      analysis: {
        dominantGeometryType: dominantGeometry,
        has3DData: has3D,
        hasTimeData,
        hasNetworkData: hasNetwork,
        dataCompleteness,
      },
    };

  } catch (error) {
    console.error("[ContextEnhancer] Erreur génération contexte:", error);
    return null;
  }
}

/**
 * Enrichit les informations d'une couche avec les données de diagnostic
 */
function enrichLayerInfo(layer: any, diag: any): RichLayerInfo {
  const baseInfo: RichLayerInfo = {
    id: layer.id,
    name: layer.name,
    type: layer.type?.toLowerCase() === "raster" ? "raster" : "vector",
    geometryType: layer.geometryType,
    crs: layer.crs || "Inconnu",
    featureCount: layer.featureCount || 0,
    visible: layer.visible,
    opacity: layer.opacity || 1,
    selected: layer.selected,
    selectedFeatureCount: layer.selectedFeatureCount,
    hasStyle: layer.hasStyle || false,
  };

  if (diag) {
    return {
      ...baseInfo,
      fieldCount: diag.fieldDiagnostics?.length,
      attributeCompleteness: calculateAttributeCompleteness(diag.fieldDiagnostics),
      spatialValidity: calculateSpatialValidity(diag),
      hasZ: diag.hasZValues || false,
      hasM: diag.hasMValues || false,
    };
  }

  return baseInfo;
}

/**
 * Calcule la complétude des attributs
 */
function calculateAttributeCompleteness(fields: any[] | undefined): number {
  if (!fields || fields.length === 0) return 0;
  const avgFillRate = fields.reduce((sum, f) => sum + (f.fillRate || 0), 0) / fields.length;
  return Math.round(avgFillRate * 100);
}

/**
 * Calcule la validité spatiale
 */
function calculateSpatialValidity(diag: any): number {
  if (!diag || !diag.featureCount) return 100;
  const invalid = (diag.invalidGeometryCount || 0) + (diag.emptyGeometryCount || 0);
  return Math.round(((diag.featureCount - invalid) / diag.featureCount) * 100);
}

/**
 * Calcule la complétude globale des données
 */
function calculateDataCompleteness(layers: RichLayerInfo[]): number {
  if (layers.length === 0) return 0;
  const avgCompleteness = layers.reduce((sum, l) => 
    sum + (l.attributeCompleteness || 80), 0
  ) / layers.length;
  return Math.round(avgCompleteness);
}

/**
 * Estime le nombre de vertices
 */
function estimateVertices(layers: any[]): number {
  // Approximation: 10 vertices par entité en moyenne
  const totalFeatures = layers.reduce((sum, l) => sum + (l.featureCount || 0), 0);
  return totalFeatures * 10;
}

/**
 * Estime la taille des données
 */
function estimateDataSize(layers: any[]): string {
  const totalFeatures = layers.reduce((sum, l) => sum + (l.featureCount || 0), 0);
  if (totalFeatures === 0) return "Vide";
  if (totalFeatures < 1000) return "< 1 Mo";
  if (totalFeatures < 10000) return "1-10 Mo";
  if (totalFeatures < 100000) return "10-100 Mo";
  return "> 100 Mo";
}

/**
 * Obtient une description du CRS
 */
function getCrsDescription(crs: string): string {
  const crsDescriptions: Record<string, string> = {
    "EPSG:2154": "RGF93 / Lambert-93 (France métropolitaine)",
    "EPSG:4326": "WGS 84 (GPS mondial)",
    "EPSG:3857": "Web Mercator (Google Maps, OSM)",
    "EPSG:27572": "NTF (Paris) / Lambert zone II (ancien système français)",
    "EPSG:32630": "WGS 84 / UTM zone 30N",
    "EPSG:32631": "WGS 84 / UTM zone 31N",
    "EPSG:32632": "WGS 84 / UTM zone 32N",
  };
  return crsDescriptions[crs] || crs;
}

/**
 * Formate le contexte riche pour l'inclusion dans un prompt LLM
 */
export function formatContextForLLM(context: RichQgisContext | null): string {
  if (!context) {
    return "Contexte QGIS: Non disponible (mode hors ligne ou pont non connecté)";
  }

  const lines: string[] = [
    `## Contexte Projet QGIS`,
    ``,
    `**Configuration**:`,
    `- CRS: ${context.project.crs} (${context.project.crsDescription})`,
    `- Couches: ${context.project.totalLayers} total (${context.project.visibleLayers} visibles)`,
    `- Données: ${context.data.totalFeatures.toLocaleString()} entités, ~${context.data.estimatedSize}`,
    ``,
  ];

  // Couches vectorielles
  if (context.layers.vector.length > 0) {
    lines.push(`**Couches Vectorielles** (${context.layers.vector.length} principales):`);
    context.layers.vector.slice(0, 6).forEach(l => {
      const geom = l.geometryType ? `[${l.geometryType}]` : "";
      const features = l.featureCount ? `${l.featureCount.toLocaleString()} ent.` : "";
      const selected = l.selected ? ` (${l.selectedFeatureCount} sélect.)` : "";
      const visible = l.visible ? "" : " (masquée)";
      lines.push(`- "${l.name}" ${geom} ${features}${selected}${visible}`);
    });
    if (context.layers.vector.length > 6) {
      lines.push(`- ... et ${context.layers.vector.length - 6} autres couches`);
    }
    lines.push("");
  }

  // Couches raster
  if (context.layers.raster.length > 0) {
    lines.push(`**Couches Raster** (${context.layers.raster.length}):`);
    context.layers.raster.slice(0, 3).forEach(l => {
      lines.push(`- "${l.name}"${l.visible ? "" : " (masquée)"}`);
    });
    if (context.layers.raster.length > 3) {
      lines.push(`- ... et ${context.layers.raster.length - 3} autres rasters`);
    }
    lines.push("");
  }

  // Analyse
  lines.push(`**Analyse du projet**:`);
  lines.push(`- Type géométrique dominant: ${context.analysis.dominantGeometryType || "Varié"}`);
  lines.push(`- Complétude des données: ${context.analysis.dataCompleteness}%`);
  if (context.analysis.has3DData) lines.push(`- Contient des données 3D/Z`);
  if (context.analysis.hasTimeData) lines.push(`- Contient des données temporelles`);
  if (context.analysis.hasNetworkData) lines.push(`- Contient des données réseau/routier`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Génère une description ciblée pour une couche spécifique
 */
export async function generateLayerContext(layerId: string): Promise<string> {
  try {
    const diag = await getLayerDiagnostics(layerId);
    if (!diag) return `Couche "${layerId}": diagnostic non disponible`;

    const lines: string[] = [
      `## Détails de la couche "${layerId}"`,
      ``,
      `**Type**: ${diag.layerType} / ${diag.geometryType}`,
      `**CRS**: ${diag.crs}`,
      `**Entités**: ${diag.featureCount?.toLocaleString() || "inconnu"} ` +
        `(${diag.sampledFeatureCount} échantillonnées)`,
      `**Champs**: ${diag.fieldDiagnostics?.length || 0} attributs`,
    ];

    if (diag.invalidGeometryCount > 0) {
      lines.push(`**⚠️ Géométries invalides**: ${diag.invalidGeometryCount}`);
    }
    if (diag.emptyGeometryCount > 0) {
      lines.push(`**⚠️ Géométries vides**: ${diag.emptyGeometryCount}`);
    }

    // Champs principaux
    if (diag.fieldDiagnostics && diag.fieldDiagnostics.length > 0) {
      lines.push("");
      lines.push("**Principaux attributs**:");
      diag.fieldDiagnostics.slice(0, 8).forEach(f => {
        const fill = Math.round((f.fillRate || 0) * 100);
        lines.push(`- \`${f.name}\` (${f.type}) — ${fill}% rempli`);
      });
      if (diag.fieldDiagnostics.length > 8) {
        lines.push(`- ... et ${diag.fieldDiagnostics.length - 8} autres champs`);
      }
    }

    return lines.join("\n");
  } catch {
    return `Couche "${layerId}": erreur lors de la récupération des détails`;
  }
}
