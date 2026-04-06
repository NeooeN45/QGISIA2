/**
 * Geospatial Data Validator
 * 
 * Système de validation de données géospatiales
 * Valide la qualité, la cohérence et la conformité des données géospatiales
 */

import { runScriptDetailed } from "./qgis";

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: ValidationSummary;
}

export interface ValidationIssue {
  type: "geometry" | "topology" | "attributes" | "crs" | "schema" | "data";
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  featureId?: string;
  field?: string;
  suggestion?: string;
}

export interface ValidationSummary {
  totalFeatures: number;
  validFeatures: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  geometryErrors: number;
  topologyErrors: number;
  attributeErrors: number;
  completeness: number; // 0-100
}

export interface ValidationOptions {
  checkGeometry: boolean;
  checkTopology: boolean;
  checkAttributes: boolean;
  checkCRS: boolean;
  checkSchema: boolean;
  strictMode: boolean;
}

/**
 * Validateur de données géospatiales
 */
export class GeospatialValidator {
  private defaultOptions: ValidationOptions = {
    checkGeometry: true,
    checkTopology: true,
    checkAttributes: true,
    checkCRS: true,
    checkSchema: false,
    strictMode: false,
  };
  
  /**
   * Valide une couche
   */
  async validateLayer(
    layerId: string,
    options: Partial<ValidationOptions> = {}
  ): Promise<ValidationResult> {
    console.log(`✅ Validation de la couche: ${layerId}`);
    
    const validationOptions = { ...this.defaultOptions, ...options };
    const issues: ValidationIssue[] = [];
    
    // Vérifier la géométrie
    if (validationOptions.checkGeometry) {
      const geometryIssues = await this.checkGeometry(layerId);
      issues.push(...geometryIssues);
    }
    
    // Vérifier la topologie
    if (validationOptions.checkTopology) {
      const topologyIssues = await this.checkTopology(layerId);
      issues.push(...topologyIssues);
    }
    
    // Vérifier les attributs
    if (validationOptions.checkAttributes) {
      const attributeIssues = await this.checkAttributes(layerId);
      issues.push(...attributeIssues);
    }
    
    // Vérifier le CRS
    if (validationOptions.checkCRS) {
      const crsIssues = await this.checkCRS(layerId);
      issues.push(...crsIssues);
    }
    
    // Vérifier le schéma
    if (validationOptions.checkSchema) {
      const schemaIssues = await this.checkSchema(layerId);
      issues.push(...schemaIssues);
    }
    
    // Calculer le résumé
    const summary = this.calculateSummary(issues);
    
    const isValid = summary.errorCount === 0 || !validationOptions.strictMode;
    
    console.log(`   📊 Résultat: ${summary.validFeatures}/${summary.totalFeatures} features valides`);
    console.log(`   ⚠️  Erreurs: ${summary.errorCount}, Avertissements: ${summary.warningCount}`);
    console.log(`   ✅ Complétude: ${summary.completeness}%`);
    
    return {
      isValid,
      issues,
      summary,
    };
  }
  
  /**
   * Vérifie la géométrie
   */
  private async checkGeometry(layerId: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    const script = `
from qgis.core import QgsProject

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: ${layerId}")

# Vérifier les géométries invalides
invalid_count = 0
null_count = 0
for feature in layer.getFeatures():
    geom = feature.geometry()
    if geom is None:
        null_count += 1
    elif not geom.isGeosValid():
        invalid_count += 1

print(f"invalid_geometries:{invalid_count}")
print(f"null_geometries:{null_count}")
print(f"total_features:{layer.featureCount()}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (result?.ok) {
      const invalidCount = parseInt(result.message?.match(/invalid_geometries:(\d+)/)?.[1] || "0");
      const nullCount = parseInt(result.message?.match(/null_geometries:(\d+)/)?.[1] || "0");
      
      if (invalidCount > 0) {
        issues.push({
          type: "geometry",
          severity: "error",
          code: "GEOM_INVALID",
          message: `${invalidCount} géométrie(s) invalide(s) détectée(s)`,
          suggestion: "Utiliser l'outil de réparation de géométrie",
        });
      }
      
      if (nullCount > 0) {
        issues.push({
          type: "geometry",
          severity: "error",
          code: "GEOM_NULL",
          message: `${nullCount} géométrie(s) nulle(s) détectée(s)`,
          suggestion: "Supprimer ou corriger les features sans géométrie",
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Vérifie la topologie
   */
  private async checkTopology(layerId: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: ${layerId}")

# Vérifier les intersections
params = {
    'INPUT': '${layerId}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

# Utiliser check validity pour détecter les problèmes
result = processing.run("native:checkvalidity", params, context, feedback)
valid_layer = result['OUTPUT']

invalid_count = 0
for feature in valid_layer.getFeatures():
    if feature['valid'] == 0:
        invalid_count += 1

print(f"topology_errors:{invalid_count}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (result?.ok) {
      const errorCount = parseInt(result.message?.match(/topology_errors:(\d+)/)?.[1] || "0");
      
      if (errorCount > 0) {
        issues.push({
          type: "topology",
          severity: "warning",
          code: "TOPO_ERROR",
          message: `${errorCount} erreur(s) topologique(s) détectée(s)`,
          suggestion: "Vérifier les intersections et les géométries auto-intersectantes",
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Vérifie les attributs
   */
  private async checkAttributes(layerId: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    const script = `
from qgis.core import QgsProject

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: ${layerId}")

# Vérifier les champs vides
empty_count = 0
null_count = 0
total_fields = len(layer.fields())

for feature in layer.getFeatures():
    for field in layer.fields():
        value = feature[field.name()]
        if value is None or value == '':
            null_count += 1
        elif str(value).strip() == '':
            empty_count += 1

print(f"null_values:{null_count}")
print(f"empty_values:{empty_count}")
print(f"total_fields:{total_fields}")
print(f"total_features:{layer.featureCount()}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (result?.ok) {
      const nullCount = parseInt(result.message?.match(/null_values:(\d+)/)?.[1] || "0");
      const emptyCount = parseInt(result.message?.match(/empty_values:(\d+)/)?.[1] || "0");
      
      if (nullCount > 0) {
        issues.push({
          type: "attributes",
          severity: "warning",
          code: "ATTR_NULL",
          message: `${nullCount} valeur(s) nulle(s) détectée(s)`,
          suggestion: "Vérifier les champs obligatoires",
        });
      }
      
      if (emptyCount > 0) {
        issues.push({
          type: "attributes",
          severity: "info",
          code: "ATTR_EMPTY",
          message: `${emptyCount} valeur(s) vide(s) détectée(s)`,
          suggestion: "Vérifier si les vides sont attendus",
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Vérifie le CRS
   */
  private async checkCRS(layerId: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    const script = `
from qgis.core import QgsProject

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: ${layerId}")

crs = layer.crs()
print(f"crs_authid:{crs.authid()}")
print(f"crs_valid:{crs.isValid()}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (result?.ok) {
      const crsAuthId = result.message?.match(/crs_authid:([^\s]+)/)?.[1] || "";
      const crsValid = result.message?.match(/crs_valid:(true|false)/)?.[1] === "true";
      
      if (!crsValid) {
        issues.push({
          type: "crs",
          severity: "error",
          code: "CRS_INVALID",
          message: `CRS invalide: ${crsAuthId}`,
          suggestion: "Définir un CRS valide pour la couche",
        });
      }
      
      // Vérifier si c'est un CRS français standard
      const frenchCRS = ["EPSG:2154", "EPSG:4326", "EPSG:3857", "EPSG:3945"];
      if (!frenchCRS.includes(crsAuthId)) {
        issues.push({
          type: "crs",
          severity: "warning",
          code: "CRS_NON_STANDARD",
          message: `CRS non standard français: ${crsAuthId}`,
          suggestion: "Considérer l'utilisation d'un CRS standard (Lambert 93, WGS84, etc.)",
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Vérifie le schéma
   */
  private async checkSchema(layerId: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    const script = `
from qgis.core import QgsProject

project = QgsProject.instance()
layer = project.mapLayer('${layerId}')

if not layer:
    raise Exception(f"Couche non trouvée: ${layerId}")

# Vérifier les noms de champs
invalid_names = []
for field in layer.fields():
    name = field.name()
    if not name.replace('_', '').isalnum():
        invalid_names.append(name)

print(f"invalid_field_names:{len(invalid_names)}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (result?.ok) {
      const invalidCount = parseInt(result.message?.match(/invalid_field_names:(\d+)/)?.[1] || "0");
      
      if (invalidCount > 0) {
        issues.push({
          type: "schema",
          severity: "warning",
          code: "SCHEMA_FIELD_NAMES",
          message: `${invalidCount} champ(s) avec nom(s) invalide(s)`,
          suggestion: "Utiliser des noms de champs alphanumériques (lettres, chiffres, underscore)",
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Calcule le résumé de la validation
   */
  private calculateSummary(issues: ValidationIssue[]): ValidationSummary {
    const summary: ValidationSummary = {
      totalFeatures: 0,
      validFeatures: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      geometryErrors: 0,
      topologyErrors: 0,
      attributeErrors: 0,
      completeness: 100,
    };
    
    for (const issue of issues) {
      switch (issue.severity) {
        case "error":
          summary.errorCount++;
          break;
        case "warning":
          summary.warningCount++;
          break;
        case "info":
          summary.infoCount++;
          break;
      }
      
      switch (issue.type) {
        case "geometry":
          summary.geometryErrors++;
          break;
        case "topology":
          summary.topologyErrors++;
          break;
        case "attributes":
          summary.attributeErrors++;
          break;
      }
    }
    
    // Calculer la complétude
    const totalIssues = summary.errorCount + summary.warningCount;
    summary.completeness = Math.max(0, 100 - totalIssues * 5);
    
    return summary;
  }
  
  /**
   * Répare les erreurs détectées
   */
  async repairLayer(
    layerId: string,
    issues: ValidationIssue[]
  ): Promise<{ success: boolean; repaired: number; failed: number }> {
    console.log(`🔧 Réparation de la couche: ${layerId}`);
    
    let repaired = 0;
    let failed = 0;
    
    for (const issue of issues) {
      if (issue.type === "geometry" && issue.code === "GEOM_INVALID") {
        const result = await this.repairGeometries(layerId);
        if (result) {
          repaired++;
        } else {
          failed++;
        }
      }
    }
    
    console.log(`   ✅ Réparé: ${repaired}, Échoué: ${failed}`);
    
    return { success: failed === 0, repaired, failed };
  }
  
  /**
   * Répare les géométries
   */
  private async repairGeometries(layerId: string): Promise<boolean> {
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

params = {
    'INPUT': '${layerId}',
    'OUTPUT': 'memory:'
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:fixgeometries", params, context, feedback)
repaired_layer = result['OUTPUT']

project.addMapLayer(repaired_layer)

print(f"Geometries repaired")
`;
    
    const result = await runScriptDetailed(script);
    return result?.ok || false;
  }
}

/**
 * Helper pour créer un validateur
 */
export function createGeospatialValidator(): GeospatialValidator {
  return new GeospatialValidator();
}
