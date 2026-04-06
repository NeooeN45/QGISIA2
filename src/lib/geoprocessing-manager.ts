/**
 * Advanced Geoprocessing Manager
 * 
 * Gestionnaire de géotraitement avancé
 * Fonctions de géotraitement: buffer, intersection, union, etc.
 */

import { runScriptDetailed } from "./qgis";

export interface GeoprocessingResult {
  success: boolean;
  outputLayerId?: string;
  featureCount?: number;
  duration: number;
  error?: string;
}

export interface BufferOptions {
  distance: number;
  segments: number;
  dissolve: boolean;
  endCapStyle: "round" | "square" | "flat";
  joinStyle: "round" | "miter" | "bevel";
}

export interface IntersectionOptions {
  outputType: "input" | "intersection";
  keepAttributes: boolean;
}

export interface UnionOptions {
  dissolve: boolean;
  keepAttributes: boolean;
}

/**
 * Gestionnaire de géotraitement
 */
export class GeoprocessingManager {
  /**
   * Crée un buffer autour d'une couche
   */
  async createBuffer(
    layerId: string,
    outputLayerName: string,
    options: BufferOptions
  ): Promise<GeoprocessingResult> {
    console.log(`🔵 Création de buffer: ${layerId}`);
    console.log(`   Distance: ${options.distance}`);
    console.log(`   Dissolve: ${options.dissolve}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject, QgsVectorLayer
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: {layerId}")

# Paramètres du buffer
params = {
    'INPUT': '${layerId}',
    'DISTANCE': ${options.distance},
    'SEGMENTS': ${options.segments},
    'DISSOLVE': ${options.dissolve},
    'END_CAP_STYLE': ${options.endCapStyle === 'round' ? 0 : options.endCapStyle === 'square' ? 1 : 2},
    'JOIN_STYLE': ${options.joinStyle === 'round' ? 0 : options.joinStyle === 'miter' ? 1 : 2},
    'MITER_LIMIT': 2,
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:buffer", params, context, feedback)
buffer_layer = result['OUTPUT']

buffer_layer.setName('${outputLayerName}')
project.addMapLayer(buffer_layer)

print(f"Buffer créé: {buffer_layer.name()}")
print(f"Features: {buffer_layer.featureCount()}")
print(f"Layer ID: {buffer_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de la création du buffer",
      };
    }
    
    // Parser les résultats
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Buffer créé: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Calcule l'intersection de deux couches
   */
  async intersectLayers(
    layer1Id: string,
    layer2Id: string,
    outputLayerName: string,
    options: IntersectionOptions = { outputType: "intersection", keepAttributes: true }
  ): Promise<GeoprocessingResult> {
    console.log(`⚡ Intersection: ${layer1Id} + ${layer2Id}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres de l'intersection
params = {
    'INPUT': '${layer1Id}',
    'OVERLAY': '${layer2Id}',
    'OUTPUT': 'memory:',
    'OUTPUT_FIELDS': ${options.keepAttributes !== false}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:intersection", params, context, feedback)
intersection_layer = result['OUTPUT']

intersection_layer.setName('${outputLayerName}')
project.addMapLayer(intersection_layer)

print(f"Intersection créée: {intersection_layer.name()}")
print(f"Features: {intersection_layer.featureCount()}")
print(f"Layer ID: {intersection_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de l'intersection",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Intersection créée: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Fusionne plusieurs couches
   */
  async unionLayers(
    layerIds: string[],
    outputLayerName: string,
    options: UnionOptions = { dissolve: false, keepAttributes: true }
  ): Promise<GeoprocessingResult> {
    console.log(`🔗 Union: ${layerIds.join(" + ")}`);
    
    const startTime = Date.now();
    
    // Pour l'union, on fait une union successive
    let currentLayerId = layerIds[0];
    
    for (let i = 1; i < layerIds.length; i++) {
      const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres de l'union
params = {
    'INPUT': '${currentLayerId}',
    'OVERLAY': '${layerIds[i]}',
    'OUTPUT': 'memory:',
    'OUTPUT_FIELDS': ${options.keepAttributes !== false}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:union", params, context, feedback)
union_layer = result['OUTPUT']

union_layer.setName('${outputLayerName}_temp_${i}')
project.addMapLayer(union_layer)

print(f"Union partielle créée: {union_layer.name()}")
print(f"Features: {union_layer.featureCount()}")
print(f"Layer ID: {union_layer.id()}")
`;
      
      const result = await runScriptDetailed(script);
      
      if (!result?.ok) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: result.message || "Échec de l'union",
        };
      }
      
      currentLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1] || currentLayerId;
    }
    
    // Dissolve si demandé
    if (options.dissolve) {
      const dissolveResult = await this.dissolveLayer(currentLayerId, outputLayerName);
      return dissolveResult;
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ Union créée en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId: currentLayerId,
      duration,
    };
  }
  
  /**
   * Dissout une couche (fusionne les entités adjacentes)
   */
  async dissolveLayer(
    layerId: string,
    outputLayerName: string,
    dissolveField?: string
  ): Promise<GeoprocessingResult> {
    console.log(`🫧 Dissolve: ${layerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres du dissolve
params = {
    'INPUT': '${layerId}',
    'OUTPUT': 'memory:',
    ${dissolveField ? `'FIELD': '${dissolveField}',` : ""}
    'MULTI': False
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:dissolve", params, context, feedback)
dissolved_layer = result['OUTPUT']

dissolved_layer.setName('${outputLayerName}')
project.addMapLayer(dissolved_layer)

print(f"Dissolve créé: {dissolved_layer.name()}")
print(f"Features: {dissolved_layer.featureCount()}")
print(f"Layer ID: {dissolved_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du dissolve",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Dissolve créé: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Clip une couche par une autre
   */
  async clipLayer(
    inputLayerId: string,
    clipLayerId: string,
    outputLayerName: string
  ): Promise<GeoprocessingResult> {
    console.log(`✂️  Clip: ${inputLayerId} par ${clipLayerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres du clip
params = {
    'INPUT': '${inputLayerId}',
    'OVERLAY': '${clipLayerId}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:clip", params, context, feedback)
clipped_layer = result['OUTPUT']

clipped_layer.setName('${outputLayerName}')
project.addMapLayer(clipped_layer)

print(f"Clip créé: {clipped_layer.name()}")
print(f"Features: {clipped_layer.featureCount()}")
print(f"Layer ID: {clipped_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du clip",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Clip créé: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Fusionne des couches (merge)
   */
  async mergeLayers(
    layerIds: string[],
    outputLayerName: string
  ): Promise<GeoprocessingResult> {
    console.log(`🔀 Merge: ${layerIds.join(", ")}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres du merge
params = {
    'LAYERS': [${layerIds.map(id => `'${id}'`).join(", ")}],
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:mergevectorlayers", params, context, feedback)
merged_layer = result['OUTPUT']

merged_layer.setName('${outputLayerName}')
project.addMapLayer(merged_layer)

print(f"Merge créé: {merged_layer.name()}")
print(f"Features: {merged_layer.featureCount()}")
print(f"Layer ID: {merged_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du merge",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Merge créé: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
}

/**
 * Helper pour créer un gestionnaire de géotraitement
 */
export function createGeoprocessingManager(): GeoprocessingManager {
  return new GeoprocessingManager();
}
