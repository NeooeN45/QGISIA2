/**
 * Attribute Management Manager
 * 
 * Gestionnaire de gestion des attributs
 * Fonctions de gestion des attributs: calcul de champs, jointures, etc.
 */

import { runScriptDetailed } from "./qgis";

export interface AttributeOperationResult {
  success: boolean;
  outputLayerId?: string;
  affectedFeatures?: number;
  duration: number;
  error?: string;
}

export interface FieldCalculationOptions {
  expression: string;
  outputFieldName: string;
  outputFieldType: "integer" | "decimal" | "text" | "date";
}

export interface JoinOptions {
  joinField: string;
  targetField: string;
  joinType: "left" | "inner" | "outer";
  keepOnlyMatching: boolean;
}

/**
 * Gestionnaire d'attributs
 */
export class AttributeManager {
  /**
   * Calcule un nouveau champ
   */
  async calculateField(
    layerId: string,
    options: FieldCalculationOptions
  ): Promise<AttributeOperationResult> {
    console.log(`🧮 Calcul de champ: ${layerId}`);
    console.log(`   Expression: ${options.expression}`);
    console.log(`   Champ de sortie: ${options.outputFieldName}`);
    
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

# Paramètres du calcul de champ
params = {
    'INPUT': '${layerId}',
    'FIELD_NAME': '${options.outputFieldName}',
    'FIELD_TYPE': ${options.outputFieldType === 'integer' ? 0 : options.outputFieldType === 'decimal' ? 1 : options.outputFieldType === 'text' ? 2 : 3},
    'FORMULA': '${options.expression}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("qgis:fieldcalculator", params, context, feedback)
calculated_layer = result['OUTPUT']

project.addMapLayer(calculated_layer)

print(f"Champ calculé: {calculated_layer.name()}")
print(f"Features: {calculated_layer.featureCount()}")
print(f"Layer ID: {calculated_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du calcul de champ",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Champ calculé: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      affectedFeatures: featureCount,
      duration,
    };
  }
  
  /**
   * Joint deux couches par attribut
   */
  async joinAttributes(
    layer1Id: string,
    layer2Id: string,
    options: JoinOptions
  ): Promise<AttributeOperationResult> {
    console.log(`🔗 Jointure d'attributs: ${layer1Id} + ${layer2Id}`);
    console.log(`   Champ jointure: ${options.joinField}`);
    console.log(`   Type: ${options.joinType}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres de la jointure
params = {
    'INPUT': '${layer1Id}',
    'FIELD': '${options.joinField}',
    'INPUT_2': '${layer2Id}',
    'FIELD_2': '${options.targetField}',
    'OUTPUT': 'memory:',
    'JOIN_TYPE': ${options.joinType === 'left' ? 1 : options.joinType === 'inner' ? 2 : 3},
    'DISCARD_NONMATCHING': ${options.keepOnlyMatching}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:joinattributestable", params, context, feedback)
joined_layer = result['OUTPUT']

project.addMapLayer(joined_layer)

print(f"Jointure effectuée: {joined_layer.name()}")
print(f"Features: {joined_layer.featureCount()}")
print(f"Layer ID: {joined_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de la jointure",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Jointure effectuée: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      affectedFeatures: featureCount,
      duration,
    };
  }
  
  /**
   * Ajoute un champ à une couche
   */
  async addField(
    layerId: string,
    fieldName: string,
    fieldType: "integer" | "decimal" | "text" | "date",
    comment: string = ""
  ): Promise<AttributeOperationResult> {
    console.log(`➕ Ajout de champ: ${fieldName} à ${layerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject, QgsVectorLayer, QgsField
from qgis.PyQt.QtCore import QVariant

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: {layerId}")

# Définir le type de champ
field_type = {
    'integer': QVariant.Int,
    'decimal': QVariant.Double,
    'text': QVariant.String,
    'date': QVariant.Date
}

# Ajouter le champ
provider = layer.dataProvider()
field = QgsField('${fieldName}', field_type['${fieldType}'])
provider.addAttributes([field])
layer.updateFields()

print(f"Champ ajouté: {fieldName}")
print(f"Layer ID: {layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de l'ajout du champ",
      };
    }
    
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Champ ajouté en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      duration,
    };
  }
  
  /**
   * Supprime un champ d'une couche
   */
  async deleteField(
    layerId: string,
    fieldName: string
  ): Promise<AttributeOperationResult> {
    console.log(`🗑️  Suppression de champ: ${fieldName} de ${layerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject, QgsVectorLayer

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: {layerId}")

# Supprimer le champ
provider = layer.dataProvider()
idx = layer.fields().indexFromName('${fieldName}')

if idx == -1:
    raise Exception(f"Champ non trouvé: {fieldName}")

provider.deleteAttributes([idx])
layer.updateFields()

print(f"Champ supprimé: {fieldName}")
print(f"Layer ID: {layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec de la suppression du champ",
      };
    }
    
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Champ supprimé en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      duration,
    };
  }
  
  /**
   * Renomme un champ
   */
  async renameField(
    layerId: string,
    oldFieldName: string,
    newFieldName: string
  ): Promise<AttributeOperationResult> {
    console.log(`✏️  Renommage de champ: ${oldFieldName} -> ${newFieldName}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject, QgsVectorLayer

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: {layerId}")

# Renommer le champ
provider = layer.dataProvider()
idx = layer.fields().indexFromName('${oldFieldName}')

if idx == -1:
    raise Exception(f"Champ non trouvé: {oldFieldName}")

provider.renameAttributes([idx], ['${newFieldName}'])
layer.updateFields()

print(f"Champ renommé: ${oldFieldName} -> ${newFieldName}")
print(f"Layer ID: {layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du renommage",
      };
    }
    
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Champ renommé en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      duration,
    };
  }
  
  /**
   * Liste les champs d'une couche
   */
  async listFields(layerId: string): Promise<{ success: boolean; fields: string[]; error?: string }> {
    console.log(`📋 Liste des champs: ${layerId}`);
    
    const script = `
from qgis.core import QgsProject

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: {layerId}")

for field in layer.fields():
    print(f"Champ: {field.name()} ({field.typeName()})")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        fields: [],
        error: result.message || "Échec de la liste des champs",
      };
    }
    
    // Parser les champs
    const fields = (result.message || "")
      .split("Champ: ")
      .slice(1)
      .map(line => line.split(" (")[0])
      .filter(name => name.length > 0);
    
    console.log(`   ✅ ${fields.length} champ(s) trouvé(s)`);
    
    return { success: true, fields };
  }
  
  /**
   * Calcule les statistiques d'un champ
   */
  async calculateFieldStatistics(
    layerId: string,
    fieldName: string
  ): Promise<{ success: boolean; statistics: Record<string, number>; error?: string }> {
    console.log(`📊 Statistiques du champ: ${fieldName} de ${layerId}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: {layerId}")

# Vérifier que le champ existe
idx = layer.fields().indexFromName('${fieldName}')
if idx == -1:
    raise Exception(f"Champ non trouvé: {fieldName}")

# Calculer les statistiques
values = []
for feature in layer.getFeatures():
    try:
        value = feature['${fieldName}']
        if value is not None:
            values.append(float(value))
    except:
        pass

if not values:
    print("Aucune valeur valide")
else:
    import statistics
    stats = {
        'count': len(values),
        'min': min(values),
        'max': max(values),
        'mean': statistics.mean(values),
        'median': statistics.median(values),
        'stdev': statistics.stdev(values) if len(values) > 1 else 0
    }
    
    for key, value in stats.items():
        print(f"{key}: {value}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        statistics: {},
        error: result.message || "Échec du calcul des statistiques",
      };
    }
    
    // Parser les statistiques
    const statistics: Record<string, number> = {};
    const lines = (result.message || "").split("\n");
    
    for (const line of lines) {
      const match = line.match(/(\w+): ([\d.]+)/);
      if (match) {
        statistics[match[1]] = parseFloat(match[2]);
      }
    }
    
    console.log(`   ✅ Statistiques calculées en ${duration}ms`);
    
    return { success: true, statistics };
  }
  
  /**
   * Filtre les attributs par expression
   */
  async filterByExpression(
    layerId: string,
    expression: string,
    outputLayerName: string
  ): Promise<AttributeOperationResult> {
    console.log(`🔍 Filtrage par expression: ${layerId}`);
    console.log(`   Expression: ${expression}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

# Paramètres du filtre
params = {
    'INPUT': '${layerId}',
    'EXPRESSION': '${expression}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:extractbyexpression", params, context, feedback)
filtered_layer = result['OUTPUT']

filtered_layer.setName('${outputLayerName}')
project.addMapLayer(filtered_layer)

print(f"Filtre appliqué: {filtered_layer.name()}")
print(f"Features: {filtered_layer.featureCount()}")
print(f"Layer ID: {filtered_layer.id()}")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        duration,
        error: result.message || "Échec du filtrage",
      };
    }
    
    const featureCount = parseInt(result.message?.match(/Features: (\d+)/)?.[1] || "0");
    const outputLayerId = result.message?.match(/Layer ID: ([^\s]+)/)?.[1];
    
    console.log(`   ✅ Filtre appliqué: ${featureCount} features en ${duration}ms`);
    
    return {
      success: true,
      outputLayerId,
      affectedFeatures: featureCount,
      duration,
    };
  }
}

/**
 * Helper pour créer un gestionnaire d'attributs
 */
export function createAttributeManager(): AttributeManager {
  return new AttributeManager();
}
