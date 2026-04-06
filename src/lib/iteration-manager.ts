/**
 * Iteration and Improvement System
 * 
 * Système d'itération et amélioration du résultat
 * Permet d'itérer sur les résultats pour les améliorer progressivement
 */

import { ResultValidator, ValidationReport } from "./result-validator";

export interface IterationConfig {
  maxIterations: number;
  improvementThreshold: number; // Score minimum pour considérer comme amélioration
  stopOnConvergence: boolean;
  convergenceThreshold: number; // Différence de score entre itérations
  feedbackSource: "user" | "automatic" | "hybrid";
}

export interface IterationResult {
  iteration: number;
  result: any;
  score: number;
  validationReport: ValidationReport;
  improvements: string[];
  issues: string[];
  converged: boolean;
}

export interface ImprovementSuggestion {
  type: "symbology" | "layout" | "data" | "scale" | "extent" | "general";
  description: string;
  priority: "high" | "medium" | "low";
  action: string;
  expectedImpact: number; // 0-100
}

export interface IterationSession {
  sessionId: string;
  initialRequest: string;
  iterations: IterationResult[];
  finalResult: any;
  finalScore: number;
  totalDuration: number;
  converged: boolean;
  iterationCount: number;
}

/**
 * Gestionnaire d'itération
 */
export class IterationManager {
  private validator: ResultValidator;
  private config: IterationConfig;
  private sessions: Map<string, IterationSession>;
  
  constructor(config?: Partial<IterationConfig>) {
    this.validator = new ResultValidator();
    this.config = {
      maxIterations: 5,
      improvementThreshold: 5,
      stopOnConvergence: true,
      convergenceThreshold: 2,
      feedbackSource: "hybrid",
      ...config,
    };
    this.sessions = new Map();
  }
  
  /**
   * Lance une session d'itération
   */
  async iterate(
    initialRequest: string,
    executeOperation: (request: string) => Promise<any>,
    context: any
  ): Promise<IterationSession> {
    const sessionId = `session_${Date.now()}`;
    console.log(`🔄 Session d'itération: ${sessionId}`);
    console.log(`   Requête initiale: ${initialRequest}`);
    console.log(`   Max itérations: ${this.config.maxIterations}`);
    
    const iterations: IterationResult[] = [];
    let currentResult = null;
    let currentScore = 0;
    let previousScore = 0;
    let converged = false;
    let iterationCount = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < this.config.maxIterations; i++) {
      iterationCount++;
      
      console.log(`\n📍 Itération ${i + 1}/${this.config.maxIterations}`);
      
      // Exécuter l'opération
      const result = await executeOperation(initialRequest);
      currentResult = result;
      
      // Valider le résultat
      const validationContext = this.buildValidationContext(result, context);
      const validationReport = this.validator.validate(validationContext);
      currentScore = validationReport.overallScore;
      
      // Analyser les améliorations possibles
      const suggestions = this.generateImprovementSuggestions(validationReport);
      
      console.log(`   Score: ${currentScore}/100`);
      console.log(`   Statut: ${validationReport.status}`);
      console.log(`   Problèmes: ${validationReport.warnings.length}`);
      
      const iterationResult: IterationResult = {
        iteration: i + 1,
        result: currentResult,
        score: currentScore,
        validationReport,
        improvements: suggestions.map(s => s.description),
        issues: validationReport.warnings.map(w => w.message),
        converged: false,
      };
      
      iterations.push(iterationResult);
      
      // Vérifier la convergence
      if (this.config.stopOnConvergence) {
        const scoreDiff = Math.abs(currentScore - previousScore);
        if (scoreDiff < this.config.convergenceThreshold && i > 0) {
          console.log(`   ✅ Convergence atteinte (différence: ${scoreDiff.toFixed(2)})`);
          converged = true;
          iterationResult.converged = true;
          break;
        }
      }
      
      // Vérifier si le score est suffisant
      if (currentScore >= 95) {
        console.log(`   ✅ Score cible atteint (${currentScore})`);
        break;
      }
      
      previousScore = currentScore;
      
      // Générer la nouvelle requête avec les améliorations
      if (suggestions.length > 0) {
        initialRequest = this.generateImprovedRequest(initialRequest, suggestions);
        console.log(`   📝 Requête améliorée générée`);
      } else {
        console.log(`   ⚠️  Aucune amélioration suggérée`);
        break;
      }
    }
    
    const duration = Date.now() - startTime;
    
    const session: IterationSession = {
      sessionId,
      initialRequest,
      iterations,
      finalResult: currentResult,
      finalScore: currentScore,
      totalDuration: duration,
      converged,
      iterationCount,
    };
    
    this.sessions.set(sessionId, session);
    
    console.log(`\n📊 Session terminée:`);
    console.log(`   Score final: ${currentScore}/100`);
    console.log(`   Itérations: ${iterationCount}`);
    console.log(`   Durée: ${duration}ms`);
    console.log(`   Convergé: ${converged}`);
    
    return session;
  }
  
  /**
   * Construit le contexte de validation
   */
  private buildValidationContext(result: any, context: any): any {
    // Construire le contexte de validation à partir du résultat
    return {
      layers: result.layers || [],
      artifacts: result.artifacts || {},
      standards: result.standards || [],
      metadata: result.metadata || {},
      userRequest: context.userRequest || "",
      executionTime: context.executionTime || 0,
    };
  }
  
  /**
   * Génère des suggestions d'amélioration
   */
  private generateImprovementSuggestions(report: ValidationReport): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    
    // Analyser les problèmes
    for (const warning of report.warnings) {
      if (warning.ruleId.includes("completeness_layers")) {
        suggestions.push({
          type: "data",
          description: "Ajouter les couches manquantes",
          priority: "high",
          action: "Télécharger ou créer les couches manquantes",
          expectedImpact: 30,
        });
      }
      
      if (warning.ruleId.includes("completeness_fields")) {
        suggestions.push({
          type: "data",
          description: "Ajouter les champs manquants",
          priority: "high",
          action: "Calculer ou joindre les champs manquants",
          expectedImpact: 20,
        });
      }
      
      if (warning.ruleId.includes("quality_geometry")) {
        suggestions.push({
          type: "data",
          description: "Corriger les géométries invalides",
          priority: "high",
          action: "Réparer les géométries invalides",
          expectedImpact: 25,
        });
      }
      
      if (warning.ruleId.includes("quality_crs")) {
        suggestions.push({
          type: "data",
          description: "Corriger le système de coordonnées",
          priority: "medium",
          action: "Reprojeter les couches vers un CRS standard",
          expectedImpact: 15,
        });
      }
      
      if (warning.ruleId.includes("compliance_standards")) {
        suggestions.push({
          type: "symbology",
          description: "Appliquer les normes manquantes",
          priority: "high",
          action: "Appliquer la symbologie des normes non appliquées",
          expectedImpact: 35,
        });
      }
      
      if (warning.ruleId.includes("consistency_symbology")) {
        suggestions.push({
          type: "symbology",
          description: "Appliquer la symbologie aux couches sans style",
          priority: "medium",
          action: "Appliquer une symbologie par défaut",
          expectedImpact: 20,
        });
      }
    }
    
    // Trier par priorité et impact
    suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.expectedImpact - a.expectedImpact;
    });
    
    return suggestions.slice(0, 5); // Limiter à 5 suggestions
  }
  
  /**
   * Génère une requête améliorée
   */
  private generateImprovedRequest(
    originalRequest: string,
    suggestions: ImprovementSuggestion[]
  ): string {
    let improvedRequest = originalRequest;
    
    // Ajouter les instructions d'amélioration
    const improvements = suggestions
      .filter(s => s.priority === "high")
      .map(s => s.action)
      .join(", ");
    
    if (improvements) {
      improvedRequest += `\n\nAméliorations à apporter: ${improvements}`;
    }
    
    return improvedRequest;
  }
  
  /**
   * Retourne une session par ID
   */
  getSession(sessionId: string): IterationSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Retourne toutes les sessions
   */
  getAllSessions(): IterationSession[] {
    return Array.from(this.sessions.values());
  }
  
  /**
   * Supprime une session
   */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
  
  /**
   * Configure le gestionnaire d'itération
   */
  configure(config: Partial<IterationConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Retourne la configuration actuelle
   */
  getConfig(): IterationConfig {
    return { ...this.config };
  }
  
  /**
   * Compare deux résultats d'itération
   */
  compareIterations(iter1: IterationResult, iter2: IterationResult): {
    scoreDiff: number;
    improved: boolean;
    newIssues: string[];
    resolvedIssues: string[];
  } {
    const scoreDiff = iter2.score - iter1.score;
    const improved = scoreDiff > this.config.improvementThreshold;
    
    const newIssues = iter2.issues.filter(i => !iter1.issues.includes(i));
    const resolvedIssues = iter1.issues.filter(i => !iter2.issues.includes(i));
    
    return {
      scoreDiff,
      improved,
      newIssues,
      resolvedIssues,
    };
  }
  
  /**
   * Génère un rapport de session
   */
  generateSessionReport(session: IterationSession): string {
    let report = `# Rapport de Session d'Itération\n\n`;
    report += `**Session ID**: ${session.sessionId}\n`;
    report += `**Requête initiale**: ${session.initialRequest}\n`;
    report += `**Score final**: ${session.finalScore}/100\n`;
    report += `**Itérations**: ${session.iterationCount}\n`;
    report += `**Durée totale**: ${session.totalDuration}ms\n`;
    report += `**Convergé**: ${session.converged ? "Oui" : "Non"}\n\n`;
    
    report += `## Historique des itérations\n\n`;
    for (const iteration of session.iterations) {
      report += `### Itération ${iteration.iteration}\n`;
      report += `- Score: ${iteration.score}/100\n`;
      report += `- Statut: ${iteration.validationReport.status}\n`;
      report += `- Problèmes: ${iteration.issues.length}\n`;
      report += `- Améliorations: ${iteration.improvements.length}\n\n`;
    }
    
    if (session.iterations.length > 1) {
      report += `## Comparaison entre itérations\n\n`;
      for (let i = 1; i < session.iterations.length; i++) {
        const comparison = this.compareIterations(
          session.iterations[i - 1],
          session.iterations[i]
        );
        report += `### Itération ${i} vs ${i + 1}\n`;
        report += `- Différence de score: ${comparison.scoreDiff}\n`;
        report += `- Amélioré: ${comparison.improved ? "Oui" : "Non"}\n`;
        report += `- Nouveaux problèmes: ${comparison.newIssues.length}\n`;
        report += `- Problèmes résolus: ${comparison.resolvedIssues.length}\n\n`;
      }
    }
    
    return report;
  }
}

/**
 * Helper pour créer un gestionnaire d'itération
 */
export function createIterationManager(config?: Partial<IterationConfig>): IterationManager {
  return new IterationManager(config);
}
