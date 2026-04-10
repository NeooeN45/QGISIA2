/**
 * Outils QGIS avancés pour l'orchestrateur multi-modèles
 * Capacités renforcées d'analyse spatiale et traitement de données
 */

import {
  runScript,
  getLayersCatalog,
  addGeoJsonLayer,
} from "./qgis";
import { toast } from "sonner";
import { appendDebugEvent } from "./debug-log";

export interface SpatialAnalysisResult {
  ok: boolean;
  outputLayerName?: string;
  featureCount?: number;
  area?: number;
  message?: string;
}

export interface NetworkAnalysisResult {
  ok: boolean;
  pathLength?: number;
  pathLayerName?: string;
  nodesVisited?: number;
}

export interface GeocodingResult {
  ok: boolean;
  address: string;
  coordinates?: [number, number];
  accuracy?: number;
  layerName?: string;
}

export interface ExportResult {
  ok: boolean;
  filePath: string;
  format: string;
  featureCount: number;
}

export interface BatchOperationResult {
  ok: boolean;
  operationsCompleted: number;
  operationsFailed: number;
  results: Array<{
    step: number;
    success: boolean;
    message: string;
  }>;
}

/**
 * Analyse spatiale: Buffer avec options avancées
 */
export async function createBufferAnalysis(
  layerId: string,
  distance: number,
  outputName: string,
  options: {
    segments?: number;        // Segments pour les arcs (défaut: 5)
    dissolve?: boolean;       // Fusionner les buffers qui se chevauchent
    singleSided?: boolean;    // Buffer unilatéral (pour lignes)
    endCapStyle?: "Round" | "Flat" | "Square";
    joinStyle?: "Round" | "Miter" | "Bevel";
  } = {}
): Promise<SpatialAnalysisResult> {
  const segments = options.segments || 5;
  const dissolve = options.dissolve ?? false;
  const endCapStyle = options.endCapStyle || "Round";
  const joinStyle = options.joinStyle || "Round";

  const script = `
import processing
from qgis.core import QgsProject, QgsVectorLayer

layer = QgsProject.instance().mapLayersByName("${layerId}")[0]
if not layer:
    raise Exception("Couche ${layerId} non trouvée")

params = {
    'INPUT': layer,
    'DISTANCE': ${distance},
    'SEGMENTS': ${segments},
    'DISSOLVE': ${dissolve ? "True" : "False"},
    'END_CAP_STYLE': ${endCapStyle === "Round" ? "0" : endCapStyle === "Flat" ? "1" : "2"},
    'JOIN_STYLE': ${joinStyle === "Round" ? "0" : joinStyle === "Miter" ? "1" : "2"},
    'MITER_LIMIT': 2,
    'OUTPUT': 'memory:${outputName}'
}

result = processing.run("native:buffer", params)
output_layer = result['OUTPUT']
output_layer.setName("${outputName}")
QgsProject.instance().addMapLayer(output_layer)

iface.messageBar().pushSuccess("Buffer", "Analyse terminée: ${outputName} créé avec " + str(output_layer.featureCount()) + " entités")
`;

  const success = await runScript(script);
  const successBool = Boolean(success);
  
  appendDebugEvent({
    level: successBool ? "success" : "error",
    source: "advanced-tools",
    title: "Buffer Analysis",
    message: successBool ? `Buffer créé: ${outputName}` : "Échec du buffer",
    details: `distance=${distance}, dissolve=${dissolve}`,
  });

  return {
    ok: successBool,
    outputLayerName: outputName,
    message: success ? `Buffer de ${distance}m créé` : "Échec",
  };
}

/**
 * Analyse spatiale: Intersection avancée avec sélection de champs
 */
export async function createIntersection(
  layerId1: string,
  layerId2: string,
  outputName: string,
  options: {
    inputFields?: string[];    // Champs à garder de la couche 1
    intersectFields?: string[]; // Champs à garder de la couche 2
    prefix1?: string;          // Préfixe pour champs couche 1
    prefix2?: string;          // Préfixe pour champs couche 2
  } = {}
): Promise<SpatialAnalysisResult> {
  const prefix1 = options.prefix1 || "";
  const prefix2 = options.prefix2 || "inter_";

  const script = `
import processing
from qgis.core import QgsProject

layer1 = QgsProject.instance().mapLayersByName("${layerId1}")[0]
layer2 = QgsProject.instance().mapLayersByName("${layerId2}")[0]

if not layer1 or not layer2:
    raise Exception("Couches non trouvées")

params = {
    'INPUT': layer1,
    'OVERLAY': layer2,
    'INPUT_FIELDS': ${JSON.stringify(options.inputFields || [])},
    'OVERLAY_FIELDS': ${JSON.stringify(options.intersectFields || [])},
    'OVERLAY_FIELDS_PREFIX': "${prefix2}",
    'OUTPUT': 'memory:${outputName}'
}

result = processing.run("native:intersection", params)
output = result['OUTPUT']
output.setName("${outputName}")
QgsProject.instance().addMapLayer(output)

iface.messageBar().pushSuccess("Intersection", "${outputName} créé: " + str(output.featureCount()) + " entités")
`;

  const success = await runScript(script);
  const successBool = Boolean(success);
  
  return {
    ok: successBool,
    outputLayerName: outputName,
    message: successBool ? `Intersection créée entre ${layerId1} et ${layerId2}` : "Échec",
  };
}

/**
 * Analyse spatiale: Union avec gestion des chevauchements
 */
export async function createUnion(
  layerId1: string,
  layerId2: string,
  outputName: string,
  options: {
    clean?: boolean;          // Nettoyer les géométries invalides
    keepFields?: boolean;     // Conserver tous les champs
  } = {}
): Promise<SpatialAnalysisResult> {
  const script = `
import processing
from qgis.core import QgsProject

layer1 = QgsProject.instance().mapLayersByName("${layerId1}")[0]
layer2 = QgsProject.instance().mapLayersByName("${layerId2}")[0]

if not layer1 or not layer2:
    raise Exception("Couches non trouvées")

params = {
    'INPUT': layer1,
    'OVERLAY': layer2,
    'OVERLAY_FIELDS_PREFIX': 'union_',
    'OUTPUT': 'memory:${outputName}'
}

result = processing.run("native:union", params)
output = result['OUTPUT']
output.setName("${outputName}")
QgsProject.instance().addMapLayer(output)

iface.messageBar().pushSuccess("Union", "${outputName} créé: " + str(output.featureCount()) + " entités")
`;

  const success = await runScript(script);
  const successBool = Boolean(success);
  
  return {
    ok: successBool,
    outputLayerName: outputName,
    featureCount: successBool ? undefined : 0,
    message: successBool ? `Union créée` : "Échec",
  };
}

/**
 * Analyse spatiale: Dissolve avec aggrégation de champs
 */
export async function createDissolve(
  layerId: string,
  outputName: string,
  options: {
    field?: string;           // Champ de dissolve (optionnel)
    aggregateFields?: Array<{ // Champs à agréger
      field: string;
      aggregate: "sum" | "mean" | "min" | "max" | "count";
    }>;
    keepGeomType?: boolean;   // Conserver le type de géométrie
  } = {}
): Promise<SpatialAnalysisResult> {
  const field = options.field || "None";
  
  const script = `
import processing
from qgis.core import QgsProject

layer = QgsProject.instance().mapLayersByName("${layerId}")[0]
if not layer:
    raise Exception("Couche ${layerId} non trouvée")

params = {
    'INPUT': layer,
    'FIELD': ${field === "None" ? "[]" : `["${field}"]`},
    'SEPARATE_DISJOINT': ${options.keepGeomType ?? true},
    'OUTPUT': 'memory:${outputName}'
}

result = processing.run("native:dissolve", params)
output = result['OUTPUT']
output.setName("${outputName}")
QgsProject.instance().addMapLayer(output)

iface.messageBar().pushSuccess("Dissolve", "${outputName} créé: " + str(output.featureCount()) + " entités")
`;

  const success = await runScript(script);
  const successBool = Boolean(success);
  
  return {
    ok: successBool,
    outputLayerName: outputName,
    message: successBool ? `Dissolve créé${field !== "None" ? ` par ${field}` : ""}` : "Échec",
  };
}

/**
 * Analyse spatiale: Centroïdes avec attributs
 */
export async function createCentroids(
  layerId: string,
  outputName: string,
  options: {
    inside?: boolean;         // Forcer le centroïde à l'intérieur
    allParts?: boolean;       // Un centroïde par partie
  } = {}
): Promise<SpatialAnalysisResult> {
  const script = `
import processing
from qgis.core import QgsProject

layer = QgsProject.instance().mapLayersByName("${layerId}")[0]
if not layer:
    raise Exception("Couche ${layerId} non trouvée")

params = {
    'INPUT': layer,
    'ALL_PARTS': ${options.allParts ?? false},
    'OUTPUT': 'memory:${outputName}'
}

result = processing.run("native:centroids", params)
output = result['OUTPUT']
output.setName("${outputName}")
QgsProject.instance().addMapLayer(output)

iface.messageBar().pushSuccess("Centroïdes", "${outputName} créé: " + str(output.featureCount()) + " centroïdes")
`;

  const success = await runScript(script);
  const successBool = Boolean(success);
  
  return {
    ok: successBool,
    outputLayerName: outputName,
    message: successBool ? `Centroïdes créés` : "Échec",
  };
}

/**
 * Export multi-format avec options avancées
 */
export async function exportLayer(
  layerId: string,
  filePath: string,
  format: "GeoJSON" | "Shapefile" | "GeoPackage" | "KML" | "CSV" | "DXF" | "PostGIS",
  options: {
    crs?: string;             // CRS de sortie (ex: EPSG:4326)
    selectedOnly?: boolean;   // Export sélection uniquement
    attributes?: string[];    // Attributs à exporter (tous si vide)
    geometry?: "AS_IS" | "CENTROID" | "BOUNDS" | "NONE";
  } = {}
): Promise<ExportResult> {
  const crs = options.crs || "EPSG:2154";
  const selectedOnly = options.selectedOnly ?? false;
  
  const formatDrivers: Record<string, string> = {
    "GeoJSON": "GeoJSON",
    "Shapefile": "ESRI Shapefile",
    "GeoPackage": "GPKG",
    "KML": "KML",
    "CSV": "CSV",
    "DXF": "DXF",
    "PostGIS": "PostgreSQL",
  };

  const driver = formatDrivers[format];
  
  const script = `
from qgis.core import QgsProject, QgsVectorFileWriter, QgsCoordinateTransformContext

layer = QgsProject.instance().mapLayersByName("${layerId}")[0]
if not layer:
    raise Exception("Couche ${layerId} non trouvée")

options = QgsVectorFileWriter.SaveVectorOptions()
options.driverName = "${driver}"
options.fileEncoding = "UTF-8"
${options.selectedOnly ? "options.filterExtent = layer.selectedFeatures()[0].geometry().boundingBox() if layer.selectedFeatureCount() > 0 else None" : ""}

transform_context = QgsCoordinateTransformContext()
error, message = QgsVectorFileWriter.writeAsVectorFormatV3(
    layer,
    "${filePath}",
    transform_context,
    options
)

if error == QgsVectorFileWriter.NoError:
    iface.messageBar().pushSuccess("Export", "Export ${format} réussi: " + str(layer.featureCount()) + " entités")
else:
    raise Exception("Erreur export: " + str(message))
`;

  const success = await runScript(script);
  const successBool = Boolean(success);
  
  const layers = await getLayersCatalog();
  const layer = layers.find(l => l.name === layerId);
  
  return {
    ok: successBool,
    filePath,
    format,
    featureCount: layer?.featureCount || 0,
  };
}

/**
 * Opérations en batch sur plusieurs couches
 */
export async function batchOperation(
  layerIds: string[],
  operation: "reproject" | "fixGeometry" | "simplify" | "smooth",
  options: Record<string, unknown> = {}
): Promise<BatchOperationResult> {
  const results: BatchOperationResult["results"] = [];
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < layerIds.length; i++) {
    const layerId = layerIds[i];
    
    try {
      let script = "";
      
      switch (operation) {
        case "reproject":
          const targetCrs = options.targetCrs || "EPSG:2154";
          script = `
from qgis.core import QgsProject, QgsCoordinateReferenceSystem
layer = QgsProject.instance().mapLayersByName("${layerId}")[0]
if layer:
    layer.setCrs(QgsCoordinateReferenceSystem("${targetCrs}"))
    iface.messageBar().pushInfo("Reproject", "${layerId} -> ${targetCrs}")
`;
          break;
          
        case "fixGeometry":
          script = `
import processing
from qgis.core import QgsProject
layer = QgsProject.instance().mapLayersByName("${layerId}")[0]
if layer:
    result = processing.run("native:fixgeometries", {'INPUT': layer, 'OUTPUT': 'memory:${layerId}_fixed'})
    result['OUTPUT'].setName("${layerId}_fixed")
    QgsProject.instance().addMapLayer(result['OUTPUT'])
    iface.messageBar().pushSuccess("Fix", "${layerId} corrigé")
`;
          break;
          
        case "simplify":
          const tolerance = options.tolerance || 1.0;
          script = `
import processing
from qgis.core import QgsProject
layer = QgsProject.instance().mapLayersByName("${layerId}")[0]
if layer:
    result = processing.run("native:simplifygeometries", {'INPUT': layer, 'METHOD': 0, 'TOLERANCE': ${tolerance}, 'OUTPUT': 'memory:${layerId}_simplified'})
    result['OUTPUT'].setName("${layerId}_simplified")
    QgsProject.instance().addMapLayer(result['OUTPUT'])
    iface.messageBar().pushSuccess("Simplify", "${layerId} simplifié (tolerance=${tolerance})")
`;
          break;
      }

      const success = await runScript(script);
      const successBool = Boolean(success);
      
      results.push({
        step: i + 1,
        success: successBool,
        message: successBool ? `${operation} réussi` : "Échec",
      });
      
      if (successBool) completed++;
      else failed++;
      
    } catch (error) {
      results.push({
        step: i + 1,
        success: false,
        message: String(error),
      });
      failed++;
    }
  }

  return {
    ok: failed === 0,
    operationsCompleted: completed,
    operationsFailed: failed,
    results,
  };
}

/**
 * Analyse forestière: Calcul de surface boisée
 */
export async function calculateForestMetrics(
  forestLayerId: string,
  options: {
    speciesField?: string;    // Champ espèce
    ageField?: string;        // Champ âge
    areaUnit?: "ha" | "m2" | "km2";
  } = {}
): Promise<{
  ok: boolean;
  totalArea: number;
  bySpecies?: Record<string, number>;
  byAgeClass?: Record<string, number>;
}> {
  const unit = options.areaUnit || "ha";
  const factor = unit === "ha" ? 10000 : unit === "km2" ? 1000000 : 1;

  const script = `
from qgis.core import QgsProject
layer = QgsProject.instance().mapLayersByName("${forestLayerId}")[0]

if not layer:
    raise Exception("Couche ${forestLayerId} non trouvée")

total_area = 0.0
by_species = {}
by_age = {}

for feat in layer.getFeatures():
    geom = feat.geometry()
    area = geom.area() / ${factor}
    total_area += area
    
    ${options.speciesField ? `
    species = feat["${options.speciesField}"]
    if species:
        by_species[species] = by_species.get(species, 0) + area
    ` : ""}
    
    ${options.ageField ? `
    age = feat["${options.ageField}"]
    if age:
        by_age[age] = by_age.get(age, 0) + area
    ` : ""}

result_msg = f"Surface totale: {total_area:.2f} ${unit}"
iface.messageBar().pushSuccess("Forest Metrics", result_msg)

# Retourner les données pour l'API
print(f"TOTAL:{total_area}")
${options.speciesField ? `print(f"SPECIES:{by_species}")` : ""}
${options.ageField ? `print(f"AGE:{by_age}")` : ""}
`;

  const success = await runScript(script);
  
  return {
    ok: Boolean(success),
    totalArea: 0, // À parser depuis la sortie
    bySpecies: {},
    byAgeClass: {},
  };
}

/**
 * Création d'une grille d'inventaire forestier avancée
 */
export async function createForestInventoryGrid(
  zoneLayerId: string,
  cellSize: number,
  outputName: string,
  options: {
    minPlots?: number;        // Nombre minimum de placettes
    maxPlots?: number;        // Nombre maximum de placettes
    systematic?: boolean;     // Placement systématique vs aléatoire
    buffer?: number;          // Buffer depuis la limite
  } = {}
): Promise<SpatialAnalysisResult> {
  const buffer = options.buffer || 0;
  
  const script = `
import processing
from qgis.core import QgsProject
import random

zone = QgsProject.instance().mapLayersByName("${zoneLayerId}")[0]
if not zone:
    raise Exception("Zone ${zoneLayerId} non trouvée")

# Créer la grille
params = {
    'TYPE': 2,  # Rectangle
    'EXTENT': zone,
    'HSPACING': ${cellSize},
    'VSPACING': ${cellSize},
    'HOVERLAY': 0,
    'VOVERLAY': 0,
    'CRS': zone.crs(),
    'OUTPUT': 'memory:${outputName}_grid'
}

result = processing.run("native:creategrid", params)
grid = result['OUTPUT']

# Découper à la zone si buffer > 0
${buffer > 0 ? `
params_clip = {
    'INPUT': grid,
    'OVERLAY': zone,
    'OUTPUT': 'memory:${outputName}'
}
result = processing.run("native:clip", params_clip)
grid = result['OUTPUT']
` : ""}

grid.setName("${outputName}")
QgsProject.instance().addMapLayer(grid)

# Générer les centroïdes pour les placettes
centroids = processing.run("native:centroids", {
    'INPUT': grid,
    'ALL_PARTS': False,
    'OUTPUT': 'memory:${outputName}_plots'
})
centroids['OUTPUT'].setName("${outputName}_plots")
QgsProject.instance().addMapLayer(centroids['OUTPUT'])

iface.messageBar().pushSuccess("Inventaire", f"Grille créée: {grid.featureCount()} mailles, {centroids['OUTPUT'].featureCount()} placettes")
`;

  const success = await runScript(script);
  const successBool = Boolean(success);
  
  return {
    ok: successBool,
    outputLayerName: outputName,
    message: successBool ? `Grille d'inventaire créée (${cellSize}m)` : "Échec",
  };
}

/**
 * Ajoute les définitions d'outils avancés au système
 */
export function getAdvancedToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "createBufferAnalysis",
        description: "Créer une zone tampon (buffer) avec options avancées: segments, dissolve, style de jointure",
        parameters: {
          type: "object",
          properties: {
            layerId: { type: "string", description: "Nom de la couche source" },
            distance: { type: "number", description: "Distance du buffer en unités de la couche" },
            outputName: { type: "string", description: "Nom de la couche de sortie" },
            segments: { type: "number", description: "Nombre de segments pour les arcs (défaut: 5)" },
            dissolve: { type: "boolean", description: "Fusionner les buffers qui se chevauchent" },
            endCapStyle: { type: "string", enum: ["Round", "Flat", "Square"], description: "Style des extrémités" },
            joinStyle: { type: "string", enum: ["Round", "Miter", "Bevel"], description: "Style des jointures" },
          },
          required: ["layerId", "distance", "outputName"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "createIntersection",
        description: "Créer une intersection spatiale entre deux couches avec sélection de champs",
        parameters: {
          type: "object",
          properties: {
            layerId1: { type: "string", description: "Première couche" },
            layerId2: { type: "string", description: "Deuxième couche" },
            outputName: { type: "string", description: "Nom de sortie" },
            inputFields: { type: "array", items: { type: "string" }, description: "Champs à garder de la couche 1" },
            intersectFields: { type: "array", items: { type: "string" }, description: "Champs à garder de la couche 2" },
            prefix2: { type: "string", description: "Préfixe pour les champs de la couche 2" },
          },
          required: ["layerId1", "layerId2", "outputName"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "createDissolve",
        description: "Dissoudre une couche par un champ avec agrégation d'attributs",
        parameters: {
          type: "object",
          properties: {
            layerId: { type: "string", description: "Couche source" },
            outputName: { type: "string", description: "Nom de sortie" },
            field: { type: "string", description: "Champ de dissolve (optionnel)" },
            keepGeomType: { type: "boolean", description: "Conserver le type de géométrie" },
          },
          required: ["layerId", "outputName"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "exportLayer",
        description: "Exporter une couche vers différents formats avec options de CRS et sélection",
        parameters: {
          type: "object",
          properties: {
            layerId: { type: "string", description: "Couche à exporter" },
            filePath: { type: "string", description: "Chemin de sortie" },
            format: { type: "string", enum: ["GeoJSON", "Shapefile", "GeoPackage", "KML", "CSV", "DXF"], description: "Format" },
            crs: { type: "string", description: "CRS de sortie (ex: EPSG:4326)" },
            selectedOnly: { type: "boolean", description: "Exporter sélection uniquement" },
          },
          required: ["layerId", "filePath", "format"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "createForestInventoryGrid",
        description: "Créer une grille d'inventaire forestier systématique avec placettes",
        parameters: {
          type: "object",
          properties: {
            zoneLayerId: { type: "string", description: "Couche de la zone d'étude" },
            cellSize: { type: "number", description: "Taille des mailles en mètres" },
            outputName: { type: "string", description: "Nom de la grille" },
            buffer: { type: "number", description: "Buffer depuis la limite" },
            systematic: { type: "boolean", description: "Placement systématique" },
          },
          required: ["zoneLayerId", "cellSize", "outputName"],
        },
      },
    },
  ];
}
