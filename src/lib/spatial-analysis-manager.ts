/**
 * Spatial Analysis Manager
 * 
 * Gestionnaire d'analyse spatiale
 * Fonctions d'analyse spatiale: centroïdes, buffers, Voronoï, etc.
 */

import { runScriptDetailed } from "./qgis";
import { GeoprocessingManager, BufferOptions } from "./geoprocessing-manager";

export interface SpatialAnalysisResult {
  success: boolean;
  outputLayerId?: string;
  featureCount?: number;
  statistics?: Record<string, number>;
  duration: number;
  error?: string;
}

export interface CentroidOptions {
  keepAttributes: boolean;
}

export interface VoronoiOptions {
  bufferRegion: number;
  tolerance: number;
}

/**
 * Gestionnaire d'analyse spatiale
 */
export class SpatialAnalysisManager {
  private geoprocessingManager: GeoprocessingManager;
  
  constructor() {
    this.geoprocessingManager = new GeoprocessingManager();
  }
  
  /**
   * Calcule les centroïdes des polygones
   */
  async calculateCentroids(
    layerId: string,
    outputLayerName: string,
    options: CentroidOptions = { keepAttributes: true }
  ): Promise<SpatialAnalysisResult> {
    console.log(`🎯 Calcul des centroïdes: ${layerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres des centroïdes
params = {
    'INPUT': '${layerId}',
    'OUTPUT': 'memory:',
    'ALL_PARTS': False
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:centroids", params, context, feedback)
centroid_layer = result['OUTPUT']

centroid_layer.setName('${outputLayerName}')
project.addMapLayer(centroid_layer)

print(f"Centroïdes créés: {centroid_layer.name()}")
print(f"Features: {centroid_layer.featureCount()}")
print(f"Layer ID: {centroid_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du calcul des centroïdes",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Centroïdes créés: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Crée un diagramme de Voronoï
   */
  async createVoronoi(
    layerId: string,
    outputLayerName: string,
    options: VoronoiOptions = { bufferRegion: 0, tolerance: 0 }
  ): Promise<SpatialAnalysisResult> {
    console.log(`🔷 Diagramme de Voronoï: ${layerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres du Voronoï
params = {
    'INPUT': '${layerId}',
    'OUTPUT': 'memory:',
    'BUFFER_REGION': ${options.bufferRegion || 0},
    'TOLERANCE': ${options.tolerance || 0}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("qgis:voronoipolygons", params, context, feedback)
voronoi_layer = result['OUTPUT']

voronoi_layer.setName('${outputLayerName}')
project.addMapLayer(voronoi_layer)

print(f"Voronoi créé: {voronoi_layer.name()}")
print(f"Features: {voronoi_layer.featureCount()}")
print(f"Layer ID: {voronoi_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de la création du Voronoï",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Voronoï créé: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Calcule la surface des polygones
   */
  async calculateArea(
    layerId: string,
    fieldName: string = "area"
  ): Promise<SpatialAnalysisResult> {
    console.log(`📐 Calcul de la surface: ${layerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres du calcul de surface
params = {
    'INPUT': '${layerId}',
    'AREA_FIELD': '${fieldName}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("qgis:fieldcalculator", params, context, feedback)
area_layer = result['OUTPUT']

project.addMapLayer(area_layer)

# Calculer les statistiques
total_area = 0
for feature in area_layer.getFeatures():
    total_area += feature['${fieldName}']

print(f"Surface calculée: {total_area}")
print(f"Layer ID: {area_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du calcul de surface",
      };
    }
    
    const totalArea = parseFloat(result.message?.match(/Surface calculée: ([\d.]+)/)?.[1] || "0");
    
    console.log(`   ✅ Surface calculée: ${totalArea} en ${duration}ms`);
    
    return {
      success: true,
      statistics: { totalArea },
      duration,
    };
  }
  
  /**
   * Calcule la longueur des lignes
   */
  async calculateLength(
    layerId: string,
    fieldName: string = "length"
  ): Promise<SpatialAnalysisResult> {
    console.log(`📏 Calcul de la longueur: ${layerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres du calcul de longueur
params = {
    'INPUT': '${layerId}',
    'LENGTH_FIELD': '${fieldName}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("qgis:fieldcalculator", params, context, feedback)
length_layer = result['OUTPUT']

project.addMapLayer(length_layer)

# Calculer les statistiques
total_length = 0
for feature in length_layer.getFeatures():
    total_length += feature['${fieldName}']

print(f"Longueur calculée: {total_length}")
print(f"Layer ID: {length_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du calcul de longueur",
      };
    }
    
    const totalLength = parseFloat(result.message?.match(/Longueur calculée: ([\d.]+)/)?.[1] || "0");
    
    console.log(`   ✅ Longueur calculée: ${totalLength} en ${duration}ms`);
    
    return {
      success: true,
      statistics: { totalLength },
      duration,
    };
  }
  
  /**
   * Compte les points dans des polygones
   */
  async countPointsInPolygons(
    pointsLayerId: string,
    polygonsLayerId: string,
    outputLayerName: string
  ): Promise<SpatialAnalysisResult> {
    console.log(`🔢 Comptage de points: ${pointsLayerId} dans ${polygonsLayerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres du comptage
params = {
    'POINTS': '${pointsLayerId}',
    'POLYGONS': '${polygonsLayerId}',
    'OUTPUT_FIELD': 'count',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("qgis:countpointsinpolygon", params, context, feedback)
count_layer = result['OUTPUT']

count_layer.setName('${outputLayerName}')
project.addMapLayer(count_layer)

print(f"Comptage effectué: {count_layer.name()}")
print(f"Features: {count_layer.featureCount()}")
print(f"Layer ID: {count_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du comptage",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Comptage effectué: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Crée des points réguliers sur une grille
   */
  async createRegularPoints(
    extentLayerId: string,
    outputLayerName: string,
    spacing: number,
    count: number
  ): Promise<SpatialAnalysisResult> {
    console.log(`📍 Création de points réguliers`);
    console.log(`   Espacement: ${spacing}`);
    console.log(`   Nombre: ${count}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres des points réguliers
params = {
    'EXTENT': '${extentLayerId}',
    'SPACING': ${spacing},
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("qgis:createpointsalonglines", params, context, feedback)
points_layer = result['OUTPUT']

points_layer.setName('${outputLayerName}')
project.addMapLayer(points_layer)

print(f"Points créés: {points_layer.name()}")
print(f"Features: {points_layer.featureCount()}")
print(f"Layer ID: {points_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de la création des points",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Points créés: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Crée une grille de polygones
   */
  async createGrid(
    extentLayerId: string,
    outputLayerName: string,
    horizontalSpacing: number,
    verticalSpacing: number
  ): Promise<SpatialAnalysisResult> {
    console.log(`🔲 Création de grille`);
    console.log(`   Espacement H: ${horizontalSpacing}`);
    console.log(`   Espacement V: ${verticalSpacing}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres de la grille
params = {
    'EXTENT': '${extentLayerId}',
    'HSPACING': ${horizontalSpacing},
    'VSPACING': ${verticalSpacing},
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("qgis:creategrid", params, context, feedback)
grid_layer = result['OUTPUT']

grid_layer.setName('${outputLayerName}')
project.addMapLayer(grid_layer)

print(f"Grille créée: {grid_layer.name()}")
print(f"Features: {grid_layer.featureCount()}")
print(f"Layer ID: {grid_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de la création de la grille",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Grille créée: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
  
  /**
   * Détermine la plus proche voisine (nearest neighbor)
   */
  async nearestNeighbor(
    inputLayerId: string,
    targetLayerId: string,
    outputLayerName: string,
    maxDistance: number
  ): Promise<SpatialAnalysisResult> {
    console.log(`🎯 Plus proche voisine: ${inputLayerId} -> ${targetLayerId}`);
    console.log(`   Distance max: ${maxDistance}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres de la plus proche voisine
params = {
    'INPUT': '${inputLayerId}',
    'TARGET': '${targetLayerId}',
    'OUTPUT': 'memory:',
    'MAX_DISTANCE': ${maxDistance}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("qgis:nearestneighbour", params, context, feedback)
nn_layer = result['OUTPUT']

nn_layer.setName('${outputLayerName}')
project.addMapLayer(nn_layer)

print(f"Plus proche voisine effectuée: {nn_layer.name()}")
print(f"Features: {nn_layer.featureCount()}")
print(f"Layer ID: {nn_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de la plus proche voisine",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Plus proche voisine effectuée: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      featureCount,
      duration,
    };
  }
}

/**
 * Helper pour créer un gestionnaire d'analyse spatiale
 */
export function createSpatialAnalysisManager(): SpatialAnalysisManager {
  return new SpatialAnalysisManager();
}
