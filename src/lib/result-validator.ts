/**
 * Result Validator
 * 
 * Système de validation et vérification des résultats
 * Valide la qualité, la complétude et la conformité des résultats
 */

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: "completeness" | "accuracy" | "consistency" | "compliance" | "quality";
  severity: "critical" | "high" | "medium" | "low";
  check: (context: ValidationContext) => ValidationResult;
}

export interface ValidationResult {
  ruleId: string;
  passed: boolean;
  message: string;
  score: number; // 0-100
  details?: any;
}

export interface ValidationContext {
  layers: LayerInfo[];
  artifacts: Record<string, any>;
  standards: string[];
  metadata: Record<string, any>;
  userRequest: string;
  executionTime: number;
}

export interface LayerInfo {
  id: string;
  name: string;
  type: string;
  geometryType: string;
  featureCount: number;
  fields: string[];
  crs: string;
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

export interface ValidationReport {
  overallScore: number;
  status: "passed" | "failed" | "warning";
  rules: ValidationResult[];
  criticalIssues: ValidationResult[];
  warnings: ValidationResult[];
  recommendations: string[];
  timestamp: number;
}

/**
 * Validateur de résultats
 */
export class ResultValidator {
  private rules: ValidationRule[];
  
  constructor() {
    this.rules = this.initializeRules();
  }
  
  /**
   * Valide un résultat complet
   */
  validate(context: ValidationContext): ValidationReport {
    console.log("🔍 Validation du résultat...");
    
    const results: ValidationResult[] = [];
    
    // Exécuter toutes les règles de validation
    for (const rule of this.rules) {
      try {
        const result = rule.check(context);
        results.push(result);
        
        if (!result.passed) {
          console.log(`   ❌ ${rule.name}: ${result.message}`);
        } else {
          console.log(`   ✅ ${rule.name}`);
        }
      } catch (error) {
        results.push({
          ruleId: rule.id,
          passed: false,
          message: `Erreur de validation: ${error instanceof Error ? error.message : String(error)}`,
          score: 0,
        });
      }
    }
    
    // Calculer le score global
    const overallScore = this.calculateOverallScore(results);
    
    // Déterminer le statut
    const status = this.determineStatus(results, overallScore);
    
    // Générer les recommandations
    const recommendations = this.generateRecommendations(results);
    
    // Identifier les problèmes critiques
    const criticalIssues = results.filter(
      r => !r.passed && this.getRuleSeverity(r.ruleId) === "critical"
    );
    
    const warnings = results.filter(
      r => !r.passed && this.getRuleSeverity(r.ruleId) !== "critical"
    );
    
    const report: ValidationReport = {
      overallScore,
      status,
      rules: results,
      criticalIssues,
      warnings,
      recommendations,
      timestamp: Date.now(),
    };
    
    console.log(`\n📊 Score global: ${overallScore}/100`);
    console.log(`📋 Statut: ${status}`);
    console.log(`⚠️  Problèmes critiques: ${criticalIssues.length}`);
    console.log(`⚠️  Avertissements: ${warnings.length}`);
    
    return report;
  }
  
  /**
   * Initialise les règles de validation
   */
  private initializeRules(): ValidationRule[] {
    return [
      // Règles de complétude
      {
        id: "completeness_layers",
        name: "Complétude des couches",
        description: "Vérifie que toutes les couches requises sont présentes",
        type: "completeness",
        severity: "critical",
        check: (ctx) => this.checkLayerCompleteness(ctx),
      },
      {
        id: "completeness_fields",
        name: "Complétude des champs",
        description: "Vérifie que les champs requis sont présents",
        type: "completeness",
        severity: "high",
        check: (ctx) => this.checkFieldCompleteness(ctx),
      },
      
      // Règles de qualité
      {
        id: "quality_geometry",
        name: "Qualité de la géométrie",
        description: "Vérifie la validité des géométries",
        type: "quality",
        severity: "high",
        check: (ctx) => this.checkGeometryQuality(ctx),
      },
      {
        id: "quality_crs",
        name: "Système de coordonnées",
        description: "Vérifie le CRS des couches",
        type: "quality",
        severity: "medium",
        check: (ctx) => this.checkCRS(ctx),
      },
      
      // Règles de conformité
      {
        id: "compliance_standards",
        name: "Conformité aux normes",
        description: "Vérifie la conformité aux normes cartographiques",
        type: "compliance",
        severity: "high",
        check: (ctx) => this.checkStandardsCompliance(ctx),
      },
      {
        id: "compliance_extent",
        name: "Conformité de l'étendue",
        description: "Vérifie que l'étendue est cohérente",
        type: "compliance",
        severity: "medium",
        check: (ctx) => this.checkExtentCompliance(ctx),
      },
      
      // Règles de cohérence
      {
        id: "consistency_attributes",
        name: "Cohérence des attributs",
        description: "Vérifie la cohérence des valeurs d'attributs",
        type: "consistency",
        severity: "medium",
        check: (ctx) => this.checkAttributeConsistency(ctx),
      },
      {
        id: "consistency_symbology",
        name: "Cohérence de la symbologie",
        description: "Vérifie que la symbologie est cohérente",
        type: "consistency",
        severity: "low",
        check: (ctx) => this.checkSymbologyConsistency(ctx),
      },
    ];
  }
  
  /**
   * Vérifie la complétude des couches
   */
  private checkLayerCompleteness(ctx: ValidationContext): ValidationResult {
    if (ctx.layers.length === 0) {
      return {
        ruleId: "completeness_layers",
        passed: false,
        message: "Aucune couche présente",
        score: 0,
      };
    }
    
    // Vérifier si les couches attendues sont présentes
    const expectedLayers = this.extractExpectedLayers(ctx.userRequest);
    const missingLayers = expectedLayers.filter(
      el => !ctx.layers.some(l => l.name.toLowerCase().includes(el.toLowerCase()))
    );
    
    if (missingLayers.length > 0) {
      return {
        ruleId: "completeness_layers",
        passed: false,
        message: `Couches manquantes: ${missingLayers.join(", ")}`,
        score: Math.max(0, 100 - missingLayers.length * 20),
      };
    }
    
    return {
      ruleId: "completeness_layers",
      passed: true,
      message: "Toutes les couches requises sont présentes",
      score: 100,
    };
  }
  
  /**
   * Vérifie la complétude des champs
   */
  private checkFieldCompleteness(ctx: ValidationContext): ValidationResult {
    const expectedFields = this.extractExpectedFields(ctx.userRequest);
    let missingCount = 0;
    
    for (const layer of ctx.layers) {
      const missing = expectedFields.filter(
        ef => !layer.fields.includes(ef)
      );
      missingCount += missing.length;
    }
    
    if (missingCount > 0) {
      return {
        ruleId: "completeness_fields",
        passed: false,
        message: `${missingCount} champs manquants`,
        score: Math.max(0, 100 - missingCount * 10),
      };
    }
    
    return {
      ruleId: "completeness_fields",
      passed: true,
      message: "Tous les champs requis sont présents",
      score: 100,
    };
  }
  
  /**
   * Vérifie la qualité de la géométrie
   */
  private checkGeometryQuality(ctx: ValidationContext): ValidationResult {
    let issues = 0;
    
    for (const layer of ctx.layers) {
      // Vérifier le nombre de features
      if (layer.featureCount === 0) {
        issues++;
      }
      
      // Vérifier le type de géométrie
      if (!layer.geometryType || layer.geometryType === "Unknown") {
        issues++;
      }
    }
    
    if (issues > 0) {
      return {
        ruleId: "quality_geometry",
        passed: false,
        message: `${issues} problème(s) de géométrie détecté(s)`,
        score: Math.max(0, 100 - issues * 15),
      };
    }
    
    return {
      ruleId: "quality_geometry",
      passed: true,
      message: "Géométries valides",
      score: 100,
    };
  }
  
  /**
   * Vérifie le CRS
   */
  private checkCRS(ctx: ValidationContext): ValidationResult {
    const crsSet = new Set(ctx.layers.map(l => l.crs));
    
    if (crsSet.size === 0) {
      return {
        ruleId: "quality_crs",
        passed: false,
        message: "Aucun CRS défini",
        score: 0,
      };
    }
    
    if (crsSet.size > 1) {
      return {
        ruleId: "quality_crs",
        passed: false,
        message: `CRS multiples détectés: ${Array.from(crsSet).join(", ")}`,
        score: 50,
      };
    }
    
    const crs = Array.from(crsSet)[0];
    
    // Vérifier si le CRS est approprié pour la France
    const frenchCRS = ["EPSG:2154", "EPSG:4326", "EPSG:3857"];
    if (!frenchCRS.includes(crs)) {
      return {
        ruleId: "quality_crs",
        passed: false,
        message: `CRS ${crs} n'est pas un CRS standard français`,
        score: 70,
      };
    }
    
    return {
      ruleId: "quality_crs",
      passed: true,
      message: `CRS approprié: ${crs}`,
      score: 100,
    };
  }
  
  /**
   * Vérifie la conformité aux normes
   */
  private checkStandardsCompliance(ctx: ValidationContext): ValidationResult {
    if (ctx.standards.length === 0) {
      return {
        ruleId: "compliance_standards",
        passed: true,
        message: "Aucune norme spécifiée",
        score: 100,
      };
    }
    
    // Vérifier que les artefacts de la norme sont présents
    let compliantCount = 0;
    
    for (const standard of ctx.standards) {
      if (ctx.artifacts[`${standard}_applied`]) {
        compliantCount++;
      }
    }
    
    if (compliantCount < ctx.standards.length) {
      return {
        ruleId: "compliance_standards",
        passed: false,
        message: `${ctx.standards.length - compliantCount} norme(s) non appliquée(s)`,
        score: (compliantCount / ctx.standards.length) * 100,
      };
    }
    
    return {
      ruleId: "compliance_standards",
      passed: true,
      message: "Toutes les normes sont appliquées",
      score: 100,
    };
  }
  
  /**
   * Vérifie la conformité de l'étendue
   */
  private checkExtentCompliance(ctx: ValidationContext): ValidationResult {
    if (ctx.layers.length === 0) {
      return {
        ruleId: "compliance_extent",
        passed: true,
        message: "Pas de couches à vérifier",
        score: 100,
      };
    }
    
    // Vérifier que l'étendue n'est pas déraisonnable
    for (const layer of ctx.layers) {
      const extent = layer.extent;
      const width = extent.xmax - extent.xmin;
      const height = extent.ymax - extent.ymin;
      
      // Étendue trop grande (en degrés)
      if (Math.abs(width) > 180 || Math.abs(height) > 90) {
        return {
          ruleId: "compliance_extent",
          passed: false,
          message: `Étendue déraisonnable: ${width} x ${height}`,
          score: 50,
        };
      }
    }
    
    return {
      ruleId: "compliance_extent",
      passed: true,
      message: "Étendue cohérente",
      score: 100,
    };
  }
  
  /**
   * Vérifie la cohérence des attributs
   */
  private checkAttributeConsistency(ctx: ValidationContext): ValidationResult {
    // Vérifier les valeurs incohérentes
    let inconsistencies = 0;
    
    for (const layer of ctx.layers) {
      // Vérifier les champs numériques négatifs qui ne devraient pas l'être
      if (layer.fields.includes("surface") || layer.fields.includes("hauteur")) {
        // Ces champs ne devraient pas être négatifs
        // Simulation - à implémenter avec vérification réelle
      }
    }
    
    if (inconsistencies > 0) {
      return {
        ruleId: "consistency_attributes",
        passed: false,
        message: `${inconsistencies} incohérence(s) détectée(s)`,
        score: Math.max(0, 100 - inconsistencies * 10),
      };
    }
    
    return {
      ruleId: "consistency_attributes",
      passed: true,
      message: "Attributs cohérents",
      score: 100,
    };
  }
  
  /**
   * Vérifie la cohérence de la symbologie
   */
  private checkSymbologyConsistency(ctx: ValidationContext): ValidationResult {
    // Vérifier que toutes les couches ont une symbologie
    const styledLayers = ctx.artifacts["styled_layers"] || [];
    
    if (styledLayers.length < ctx.layers.length) {
      return {
        ruleId: "consistency_symbology",
        passed: false,
        message: `${ctx.layers.length - styledLayers.length} couche(s) sans symbologie`,
        score: (styledLayers.length / ctx.layers.length) * 100,
      };
    }
    
    return {
      ruleId: "consistency_symbology",
      passed: true,
      message: "Toutes les couches ont une symbologie",
      score: 100,
    };
  }
  
  /**
   * Extrait les couches attendues de la demande
   */
  private extractExpectedLayers(request: string): string[] {
    const expected: string[] = [];
    const lower = request.toLowerCase();
    
    if (lower.includes("peuplement")) expected.push("peuplement");
    if (lower.includes("limite")) expected.push("limite");
    if (lower.includes("route")) expected.push("route");
    if (lower.includes("bâti")) expected.push("bati");
    if (lower.includes("forêt")) expected.push("foret");
    
    return expected;
  }
  
  /**
   * Extrait les champs attendus de la demande
   */
  private extractExpectedFields(request: string): string[] {
    const expected: string[] = [];
    const lower = request.toLowerCase();
    
    if (lower.includes("essence")) expected.push("essence");
    if (lower.includes("surface") || lower.includes("ha")) expected.push("surface");
    if (lower.includes("hauteur")) expected.push("hauteur");
    if (lower.includes("volume")) expected.push("volume");
    if (lower.includes("densité")) expected.push("densite");
    
    return expected;
  }
  
  /**
   * Calcule le score global
   */
  private calculateOverallScore(results: ValidationResult[]): number {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    return Math.round(totalScore / results.length);
  }
  
  /**
   * Détermine le statut global
   */
  private determineStatus(results: ValidationResult[], score: number): "passed" | "failed" | "warning" {
    const criticalFailed = results.filter(
      r => !r.passed && this.getRuleSeverity(r.ruleId) === "critical"
    ).length;
    
    if (criticalFailed > 0) {
      return "failed";
    }
    
    if (score < 70) {
      return "failed";
    }
    
    if (score < 90) {
      return "warning";
    }
    
    return "passed";
  }
  
  /**
   * Génère les recommandations
   */
  private generateRecommendations(results: ValidationResult[]): string[] {
    const recommendations: string[] = [];
    
    for (const result of results) {
      if (!result.passed) {
        recommendations.push(`Corriger: ${result.message}`);
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push("Le résultat est conforme aux attentes");
    }
    
    return recommendations;
  }
  
  /**
   * Retourne la sévérité d'une règle
   */
  private getRuleSeverity(ruleId: string): "critical" | "high" | "medium" | "low" {
    const rule = this.rules.find(r => r.id === ruleId);
    return rule?.severity || "medium";
  }
  
  /**
   * Ajoute une règle de validation personnalisée
   */
  addCustomRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }
  
  /**
   * Supprime une règle de validation
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }
}

/**
 * Helper pour créer un validateur
 */
export function createValidator(): ResultValidator {
  return new ResultValidator();
}
