/**
 * Selective Parcel Extractor
 * 
 * Système d'extraction sélective de parcelles
 * Extrait uniquement les parcelles concernées ou toutes les parcelles avec mise en valeur des concernées
 */

import { runScriptDetailed } from "./qgis";

export interface ExtractionOptions {
  extractMode: "selected_only" | "all_with_highlight" | "all_with_filter";
  highlightStyle: "boundary" | "fill" | "both";
  highlightColor: string;
  highlightOpacity: number;
  boundaryWidth: number;
  createSeparateLayers: boolean;
  preserveAttributes: boolean;
}

export interface ExtractionResult {
  success: boolean;
  extractedLayerId?: string;
  highlightLayerId?: string;
  parcelCount: number;
  selectedParcelCount: number;
  duration: number;
  error?: string;
}

/**
 * Extracteur sélectif de parcelles
 */
export class SelectiveParcelExtractor {
  /**
   * Extrait les parcelles selon les options
   */
  async extractParcels(
    sourceLayerId: string,
    selectedParcelIds: string[],
    options: ExtractionOptions
  ): Promise<ExtractionResult> {
    console.log(`✂️  Extraction de parcelles: ${selectedParcelIds.length} sélectionnée(s)`);
    
    const startTime = Date.now();
    
    try {
      let extractedLayerId: string | undefined;
      let highlightLayerId: string | undefined;
      let parcelCount = 0;
      
      switch (options.extractMode) {
        case "selected_only":
          const result1 = await this.extractSelectedOnly(sourceLayerId, selectedParcelIds, options);
          extractedLayerId = result1.layerId;
          parcelCount = result1.featureCount;
          break;
        case "all_with_highlight":
          const result2 = await this.extractAllWithHighlight(sourceLayerId, selectedParcelIds, options);
          extractedLayerId = result2.layerId;
          parcelCount = result2.featureCount;
          highlightLayerId = await this.createHighlightLayer(sourceLayerId, selectedParcelIds, options);
          break;
        case "all_with_filter":
          const result3 = await this.extractAllWithFilter(sourceLayerId, selectedParcelIds, options);
          extractedLayerId = result3.layerId;
          parcelCount = result3.featureCount;
          break;
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Extraction terminée en ${duration}ms`);
      
      return {
        success: true,
        extractedLayerId,
        highlightLayerId,
        parcelCount,
        selectedParcelCount: selectedParcelIds.length,
        duration,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`   ❌ Erreur d'extraction: ${errorMessage}`);
      
      return {
        success: false,
        parcelCount: 0,
        selectedParcelCount: 0,
        duration,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Extrait uniquement les parcelles sélectionnées
   */
  private async extractSelectedOnly(
    sourceLayerId: string,
    selectedParcelIds: string[],
    options: ExtractionOptions
  ): Promise<{ layerId: string; featureCount: number }> {
    console.log(`   ✂️  Extraction mode: sélection uniquement`);
    
    const parcelIdsString = selectedParcelIds.map(id => `'${id}'`).join(",");
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()
source_layer = project.mapLayer('${sourceLayerId}')

if not source_layer:
    raise Exception("Couche source non trouvée")

# Créer une expression pour filtrer les parcelles sélectionnées
expression = "id IN (${parcelIdsString})"

# Sélectionner les features
source_layer.selectByExpression(expression)

# Extraire les features sélectionnés
params = {
    'INPUT': '${sourceLayerId}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:saveselectedfeatures", params, context, feedback)
extracted_layer = result['OUTPUT']

# Ajouter la couche au projet
extracted_layer.setName("Parcelles_Extracted")
project.addMapLayer(extracted_layer)

print(f"extracted_layer_id:{extracted_layer.id()}")
print(f"feature_count:{extracted_layer.featureCount()}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      throw new Error(result.message || "Échec de l'extraction");
    }
    
    const layerId = result.message?.match(/extracted_layer_id:(.+)/)?.[1] || "";
    const featureCount = parseInt(result.message?.match(/feature_count:(\d+)/)?.[1] || "0");
    
    return { layerId, featureCount };
  }
  
  /**
   * Extrait toutes les parcelles avec mise en valeur
   */
  private async extractAllWithHighlight(
    sourceLayerId: string,
    selectedParcelIds: string[],
    options: ExtractionOptions
  ): Promise<{ layerId: string; featureCount: number }> {
    console.log(`   ✂️  Extraction mode: toutes avec mise en valeur`);
    
    // Copier la couche entière
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()
source_layer = project.mapLayer('${sourceLayerId}')

if not source_layer:
    raise Exception("Couche source non trouvée")

# Copier la couche
params = {
    'INPUT': '${sourceLayerId}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:saveselectedfeatures", params, context, feedback)
# Utiliser copy features à la place
result = processing.run("qgis:fieldcalculator", params, context, feedback)

# Simpler: copy layer
result = processing.run("native:extractbylocation", params, context, feedback)

# Pour l'instant, on utilise une approche simple
# Créer une copie de la couche
copied_layer = source_layer.materialize(QgsFeatureRequest())
copied_layer.setName("Parcelles_Toutes")
project.addMapLayer(copied_layer)

print(f"copied_layer_id:{copied_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      throw new Error(result.message || "Échec de la copie");
    }
    
    const copiedLayerId = result.message?.match(/copied_layer_id:([^\s]+)/)?.[1] || sourceLayerId;
    const featureCount = parseInt(result.message?.match(/feature_count:(\d+)/)?.[1] || "0");
    
    console.log(`   ✅ Couche copiée: ${copiedLayerId}`);
    
    return { layerId: copiedLayerId, featureCount };
  }
  
  /**
   * Crée une couche de mise en valeur
   */
  private async createHighlightLayer(
    sourceLayerId: string,
    selectedParcelIds: string[],
    options: ExtractionOptions
  ): Promise<string> {
    console.log(`   🎨 Création couche de mise en valeur`);
    
    const parcelIdsString = selectedParcelIds.map(id => `'${id}'`).join(",");
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()
source_layer = project.mapLayer('${sourceLayerId}')

if not source_layer:
    raise Exception("Couche source non trouvée")

# Sélectionner les parcelles à mettre en valeur
expression = "id IN (${parcelIdsString})"
source_layer.selectByExpression(expression)

# Créer une couche de mise en valeur
params = {
    'INPUT': '${sourceLayerId}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:saveselectedfeatures", params, context, feedback)
highlight_layer = result['OUTPUT']

# Appliquer le style de mise en valeur
highlight_layer.setName("Parcelles_MiseEnValeur")
project.addMapLayer(highlight_layer)

# Configurer la symbologie
renderer = highlight_layer.renderer()
symbol = renderer.symbol()

# Configurer le style selon les options
symbol.setColor(QColor('${options.highlightColor}'))
symbol.setAlpha(${options.highlightOpacity})

if '${options.highlightStyle}' in ['boundary', 'both']:
    symbol.setStrokeWidth(${options.boundaryWidth})

# Rafraîchir la couche
highlight_layer.triggerRepaint()

print(f"highlight_layer_id:{highlight_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      throw new Error(result.message || "Échec de la création de la couche de mise en valeur");
    }
    
    const highlightLayerId = result.message?.match(/highlight_layer_id:([^\s]+)/)?.[1] || "";
    
    console.log(`   ✅ Couche de mise en valeur créée: ${highlightLayerId}`);
    
    return highlightLayerId;
  }
  
  /**
   * Extrait toutes les parcelles avec filtre
   */
  private async extractAllWithFilter(
    sourceLayerId: string,
    selectedParcelIds: string[],
    options: ExtractionOptions
  ): Promise<{ layerId: string; featureCount: number }> {
    console.log(`   ✂️  Extraction mode: toutes avec filtre`);
    
    const parcelIdsString = selectedParcelIds.map(id => `'${id}'`).join(",");
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()
source_layer = project.mapLayer('${sourceLayerId}')

if not source_layer:
    raise Exception("Couche source non trouvée")

# Ajouter un champ pour indiquer si la parcelle est sélectionnée
params = {
    'INPUT': '${sourceLayerId}',
    'FIELD_NAME': 'is_selected',
    'FIELD_TYPE': 1,  # Integer
    'FIELD_LENGTH': 1,
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:addfieldtoattributestable", params, context, feedback)
layer_with_field = result['OUTPUT']

# Mettre à jour le champ pour les parcelles sélectionnées
expression = "CASE WHEN id IN (${parcelIdsString}) THEN 1 ELSE 0 END"
params = {
    'INPUT': layer_with_field,
    'FIELD_NAME': 'is_selected',
    'EXPRESSION': expression,
    'OUTPUT': 'memory:'
}

result = processing.run("qgis:fieldcalculator", params, context, feedback)
filtered_layer = result['OUTPUT']

filtered_layer.setName("Parcelles_Filtrees")
project.addMapLayer(filtered_layer)

# Appliquer une symbologie catégorisée
# (À implémenter avec la configuration des catégories)

print(f"filtered_layer_id:{filtered_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      throw new Error(result.message || "Échec de l'extraction avec filtre");
    }
    
    const filteredLayerId = result.message?.match(/filtered_layer_id:([^\s]+)/)?.[1] || "";
    const featureCount = parseInt(result.message?.match(/feature_count:(\d+)/)?.[1] || "0");
    
    console.log(`   ✅ Couche filtrée créée: ${filteredLayerId}`);
    
    return { layerId: filteredLayerId, featureCount };
  }
  
  /**
   * Crée des couches multiples pour être sûr de bien faire
   */
  async createMultipleLayers(
    sourceLayerId: string,
    selectedParcelIds: string[],
    options: ExtractionOptions
  ): Promise<string[]> {
    console.log(`📚 Création de couches multiples`);
    
    const layerIds: string[] = [];
    
    // Couche de toutes les parcelles
    const allResult = await this.extractAllWithHighlight(sourceLayerId, selectedParcelIds, options);
    layerIds.push(allResult.layerId);
    
    // Couche des parcelles sélectionnées uniquement
    const selectedResult = await this.extractSelectedOnly(sourceLayerId, selectedParcelIds, options);
    layerIds.push(selectedResult.layerId);
    
    // Couche de mise en valeur
    const highlightLayerId = await this.createHighlightLayer(sourceLayerId, selectedParcelIds, options);
    layerIds.push(highlightLayerId);
    
    console.log(`   ✅ ${layerIds.length} couches créées`);
    
    return layerIds;
  }
}

/**
 * Helper pour créer un extracteur sélectif de parcelles
 */
export function createSelectiveParcelExtractor(): SelectiveParcelExtractor {
  return new SelectiveParcelExtractor();
}
