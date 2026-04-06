/**
 * Auto-Repair System for PyQGIS Scripts
 * 
 * Système d'auto-réparation des scripts PyQGIS
 * Analyse les erreurs et génère des corrections automatiques
 */

import { runScriptDetailed } from "./qgis";

export interface RepairResult {
  success: boolean;
  originalScript: string;
  repairedScript: string;
  error: string;
  repairType: RepairType;
  confidence: number;
  attempts: number;
}

export type RepairType =
  | "syntax_fix"
  | "import_fix"
  | "api_fix"
  | "variable_fix"
  | "logic_fix"
  | "layer_fix"
  | "field_fix"
  | "renderer_fix"
  | "unknown";

export interface ScriptDiagnostic {
  hasSyntaxError: boolean;
  missingImports: string[];
  deprecatedAPI: string[];
  undefinedVariables: string[];
  potentialErrors: string[];
  suggestions: string[];
}

/**
 * Réparateur de scripts PyQGIS
 */
export class PyQGISAutoRepair {
  private maxAttempts: number;
  private repairHistory: Map<string, RepairResult[]>;
  
  constructor(maxAttempts: number = 3) {
    this.maxAttempts = maxAttempts;
    this.repairHistory = new Map();
  }
  
  /**
   * Répare un script PyQGIS avec erreur
   */
  async repairScript(
    script: string,
    error: string,
    context?: string
  ): Promise<RepairResult> {
    console.log("🔧 Tentative de réparation du script PyQGIS");
    console.log(`   Erreur: ${error}`);
    
    let currentScript = script;
    let attempts = 0;
    let lastError = error;
    
    for (let i = 0; i < this.maxAttempts; i++) {
      attempts++;
      
      // Analyser l'erreur
      const diagnostic = this.analyzeError(lastError, currentScript, context);
      
      // Générer la réparation
      const repair = this.generateRepair(currentScript, diagnostic);
      
      if (!repair) {
        console.log(`   ❌ Impossible de générer une réparation`);
        break;
      }
      
      console.log(`   🔄 Tentative ${attempts}: ${repair.repairType}`);
      console.log(`   📝 Modification: ${repair.description}`);
      
      // Appliquer la réparation
      currentScript = this.applyRepair(currentScript, repair);
      
      // Tester le script réparé
      const testResult = await runScriptDetailed(currentScript);
      
      if (testResult?.ok) {
        console.log(`   ✅ Réparation réussie !`);
        
        const result: RepairResult = {
          success: true,
          originalScript: script,
          repairedScript: currentScript,
          error: "",
          repairType: repair.repairType,
          confidence: repair.confidence,
          attempts,
        };
        
        this.saveRepairHistory(script, result);
        return result;
      } else {
        lastError = testResult?.message || "Erreur inconnue";
        console.log(`   ⚠️  Réparation échouée: ${lastError}`);
      }
    }
    
    console.log(`   ❌ Échec après ${attempts} tentatives`);
    
    const result: RepairResult = {
      success: false,
      originalScript: script,
      repairedScript: currentScript,
      error: lastError,
      repairType: "unknown",
      confidence: 0,
      attempts,
    };
    
    this.saveRepairHistory(script, result);
    return result;
  }
  
  /**
   * Analyse une erreur
   */
  private analyzeError(error: string, script: string, context?: string): ScriptDiagnostic {
    const diagnostic: ScriptDiagnostic = {
      hasSyntaxError: false,
      missingImports: [],
      deprecatedAPI: [],
      undefinedVariables: [],
      potentialErrors: [],
      suggestions: [],
    };
    
    const errorLower = error.toLowerCase();
    
    // Erreurs de syntaxe
    if (errorLower.includes("syntaxerror") || errorLower.includes("syntax error")) {
      diagnostic.hasSyntaxError = true;
      diagnostic.suggestions.push("Vérifier la syntaxe Python");
    }
    
    // Imports manquants
    if (errorLower.includes("nameerror") || errorLower.includes("not defined")) {
      const match = error.match(/name '(\w+)' is not defined/i);
      if (match) {
        diagnostic.undefinedVariables.push(match[1]);
        diagnostic.suggestions.push(`Importer ou définir: ${match[1]}`);
      }
    }
    
    // API QGIS dépréciée
    if (errorLower.includes("attributeerror")) {
      diagnostic.deprecatedAPI.push("Vérifier l'API QGIS");
      diagnostic.suggestions.push("Vérifier les méthodes de l'objet");
    }
    
    // Erreurs de couches
    if (errorLower.includes("layer") || errorLower.includes("couche")) {
      diagnostic.potentialErrors.push("Erreur liée aux couches");
      diagnostic.suggestions.push("Vérifier que la couche existe dans le projet");
    }
    
    // Erreurs de champs
    if (errorLower.includes("field") || errorLower.includes("champ") || errorLower.includes("index")) {
      diagnostic.potentialErrors.push("Erreur liée aux champs");
      diagnostic.suggestions.push("Vérifier que le champ existe dans la couche");
    }
    
    return diagnostic;
  }
  
  /**
   * Génère une réparation
   */
  private generateRepair(
    script: string,
    diagnostic: ScriptDiagnostic
  ): { repairType: RepairType; description: string; confidence: number; apply: (s: string) => string } | null {
    // Réparation des imports manquants
    if (diagnostic.undefinedVariables.length > 0) {
      const missingVar = diagnostic.undefinedVariables[0];
      if (this.isQGISClass(missingVar)) {
        return {
          repairType: "import_fix",
          description: `Ajouter l'import pour ${missingVar}`,
          confidence: 0.8,
          apply: (s) => this.addImport(s, missingVar),
        };
      }
    }
    
    // Réparation des erreurs de couche
    if (diagnostic.potentialErrors.includes("Erreur liée aux couches")) {
      return {
        repairType: "layer_fix",
        description: "Ajouter une vérification de l'existence de la couche",
        confidence: 0.7,
        apply: (s) => this.addLayerCheck(s),
      };
    }
    
    // Réparation des erreurs de champs
    if (diagnostic.potentialErrors.includes("Erreur liée aux champs")) {
      return {
        repairType: "field_fix",
        description: "Ajouter une vérification de l'existence du champ",
        confidence: 0.7,
        apply: (s) => this.addFieldCheck(s),
      };
    }
    
    // Réparation syntaxique simple
    if (diagnostic.hasSyntaxError) {
      return {
        repairType: "syntax_fix",
        description: "Corriger les erreurs de syntaxe courantes",
        confidence: 0.6,
        apply: (s) => this.fixCommonSyntax(s),
      };
    }
    
    return null;
  }
  
  /**
   * Applique une réparation
   */
  private applyRepair(script: string, repair: { apply: (s: string) => string }): string {
    return repair.apply(script);
  }
  
  /**
   * Ajoute un import manquant
   */
  private addImport(script: string, className: string): string {
    const importMap: Record<string, string> = {
      "QgsProject": "from qgis.core import QgsProject",
      "QgsVectorLayer": "from qgis.core import QgsVectorLayer",
      "QgsMarkerSymbol": "from qgis.core import QgsMarkerSymbol",
      "QgsCategorizedSymbolRenderer": "from qgis.core import QgsCategorizedSymbolRenderer",
      "QgsGraduatedSymbolRenderer": "from qgis.core import QgsGraduatedSymbolRenderer",
      "QgsRuleBasedRenderer": "from qgis.core import QgsRuleBasedRenderer",
      "QgsRendererCategory": "from qgis.core import QgsRendererCategory",
      "QgsRendererRange": "from qgis.core import QgsRendererRange",
      "QgsPalLayerSettings": "from qgis.core import QgsPalLayerSettings",
      "QgsTextFormat": "from qgis.core import QgsTextFormat",
      "QColor": "from qgis.PyQt.QtGui import QColor",
      "QgsSingleSymbolRenderer": "from qgis.core import QgsSingleSymbolRenderer",
    };
    
    const importStatement = importMap[className];
    if (!importStatement) return script;
    
    // Vérifier si l'import existe déjà
    if (script.includes(importStatement)) return script;
    
    // Ajouter l'import au début du script
    const lines = script.split("\n");
    const importIndex = lines.findIndex(line => line.startsWith("from qgis") || line.startsWith("import"));
    
    if (importIndex >= 0) {
      lines.splice(importIndex, 0, importStatement);
    } else {
      lines.unshift(importStatement);
    }
    
    return lines.join("\n");
  }
  
  /**
   * Vérifie si une classe est une classe QGIS
   */
  private isQGISClass(name: string): boolean {
    const qgisClasses = [
      "QgsProject", "QgsVectorLayer", "QgsRasterLayer", "QgsMarkerSymbol",
      "QgsLineSymbol", "QgsFillSymbol", "QgsCategorizedSymbolRenderer",
      "QgsGraduatedSymbolRenderer", "QgsRuleBasedRenderer", "QgsRendererCategory",
      "QgsRendererRange", "QgsPalLayerSettings", "QgsTextFormat", "QColor",
      "QgsSingleSymbolRenderer",
    ];
    return qgisClasses.includes(name);
  }
  
  /**
   * Ajoute une vérification de l'existence de la couche
   */
  private addLayerCheck(script: string): string {
    // Trouver les références à des couches
    const layerPattern = /mapLayersByName\(['"]([^'"]+)['"]\)/g;
    const matches = script.matchAll(layerPattern);
    
    let modifiedScript = script;
    
    for (const match of matches) {
      const layerName = match[1];
      const checkCode = `
# Vérification de la couche ${layerName}
layer = QgsProject.instance().mapLayersByName('${layerName}')
if not layer:
    print(f"Erreur: Couche '{layerName}' non trouvée")
    print("Couches disponibles:")
    for lyr in QgsProject.instance().mapLayers().values():
        print(f"  - {lyr.name()}")
    raise Exception(f"Couche non trouvée: {layerName}")
layer = layer[0]
`;
      
      // Remplacer la première occurrence
      modifiedScript = modifiedScript.replace(
        `mapLayersByName('${layerName}')`,
        checkCode + "\n    # Couche vérifiée\n    layer"
      );
    }
    
    return modifiedScript;
  }
  
  /**
   * Ajoute une vérification de l'existence du champ
   */
  private addFieldCheck(script: string): string {
    // Trouver les références à des champs
    const fieldPattern = /indexFromName\(['"]([^'"]+)['"]\)/g;
    const matches = script.matchAll(fieldPattern);
    
    let modifiedScript = script;
    
    for (const match of matches) {
      const fieldName = match[1];
      const checkCode = `
# Vérification du champ ${fieldName}
idx = layer.fields().indexFromName('${fieldName}')
if idx == -1:
    print(f"Erreur: Champ '{fieldName}' non trouvé dans la couche")
    print("Champs disponibles:")
    for field in layer.fields():
        print(f"  - {field.name()} ({field.typeName()})")
    raise Exception(f"Champ non trouvé: {fieldName}")
`;
      
      // Ajouter avant l'indexFromName
      modifiedScript = modifiedScript.replace(
        `indexFromName('${fieldName}')`,
        checkCode + "\n    idx = layer.fields().indexFromName('${fieldName}')"
      );
    }
    
    return modifiedScript;
  }
  
  /**
   * Corrige les erreurs de syntaxe courantes
   */
  private fixCommonSyntax(script: string): string {
    let fixed = script;
    
    // Corriger les parenthèses non fermées
    const openParens = (fixed.match(/\(/g) || []).length;
    const closeParens = (fixed.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      fixed += ")".repeat(openParens - closeParens);
    }
    
    // Corriger les crochets non fermés
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      fixed += "]".repeat(openBrackets - closeBrackets);
    }
    
    // Corriger les guillemets non fermés
    const singleQuotes = (fixed.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      fixed += "'";
    }
    
    // Corriger les deux-points manquants dans les boucles
    fixed = fixed.replace(/for\s+(\w+)\s+in\s+(\w+)\s*:/g, "for $1 in $2:");
    
    return fixed;
  }
  
  /**
   * Sauvegarde l'historique des réparations
   */
  private saveRepairHistory(script: string, result: RepairResult): void {
    const hash = this.hashScript(script);
    const history = this.repairHistory.get(hash) || [];
    history.push(result);
    this.repairHistory.set(hash, history);
  }
  
  /**
   * Génère un hash simple du script
   */
  private hashScript(script: string): string {
    let hash = 0;
    for (let i = 0; i < script.length; i++) {
      const char = script.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
  
  /**
   * Retourne l'historique des réparations pour un script
   */
  getRepairHistory(script: string): RepairResult[] {
    const hash = this.hashScript(script);
    return this.repairHistory.get(hash) || [];
  }
  
  /**
   * Diagnostique un script sans l'exécuter
   */
  diagnoseScript(script: string): ScriptDiagnostic {
    const diagnostic: ScriptDiagnostic = {
      hasSyntaxError: false,
      missingImports: [],
      deprecatedAPI: [],
      undefinedVariables: [],
      potentialErrors: [],
      suggestions: [],
    };
    
    // Vérifier les imports QGIS courants
    const commonImports = [
      "QgsProject", "QgsVectorLayer", "QgsMarkerSymbol", "QColor",
      "QgsCategorizedSymbolRenderer", "QgsPalLayerSettings"
    ];
    
    for (const imp of commonImports) {
      if (script.includes(imp) && !script.includes(`import ${imp}`)) {
        diagnostic.missingImports.push(imp);
      }
    }
    
    // Vérifier les patterns à risque
    if (script.includes("mapLayersByName") && !script.includes("if not layer")) {
      diagnostic.potentialErrors.push("Accès à la couche sans vérification");
      diagnostic.suggestions.push("Ajouter une vérification de l'existence de la couche");
    }
    
    if (script.includes("indexFromName") && !script.includes("if idx == -1")) {
      diagnostic.potentialErrors.push("Accès au champ sans vérification");
      diagnostic.suggestions.push("Ajouter une vérification de l'existence du champ");
    }
    
    return diagnostic;
  }
}

/**
 * Helper pour créer un réparateur
 */
export function createAutoRepair(maxAttempts?: number): PyQGISAutoRepair {
  return new PyQGISAutoRepair(maxAttempts);
}
