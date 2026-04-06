/**
 * Error Management and Automatic Retry System
 * 
 * Système de gestion d'erreurs et retry automatique
 * Gère les erreurs de manière robuste avec stratégies de retry intelligentes
 */

export interface ErrorHandlingStrategy {
  maxRetries: number;
  backoffStrategy: "fixed" | "exponential" | "linear";
  initialDelay: number; // en millisecondes
  maxDelay: number;
  retryCondition: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
  onFinalFailure?: (error: Error) => void;
}

export interface RetryConfig {
  operation: () => Promise<any>;
  strategy: ErrorHandlingStrategy;
  context: RetryContext;
}

export interface RetryContext {
  operationName: string;
  operationId: string;
  metadata: Record<string, any>;
  startTime: number;
}

export interface RetryResult {
  success: boolean;
  result: any;
  error?: Error;
  attempts: number;
  totalDuration: number;
  retryHistory: RetryAttempt[];
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  error?: Error;
  delay: number;
}

export interface ErrorClassification {
  type: "transient" | "permanent" | "throttle" | "timeout" | "unknown";
  retryable: boolean;
  suggestedAction: string;
}

/**
 * Gestionnaire d'erreurs et retry
 */
export class ErrorManager {
  private defaultStrategy: ErrorHandlingStrategy;
  private errorHistory: Map<string, RetryAttempt[]>;
  
  constructor() {
    this.defaultStrategy = {
      maxRetries: 3,
      backoffStrategy: "exponential",
      initialDelay: 1000,
      maxDelay: 30000,
      retryCondition: (error, attempt) => attempt < 3,
    };
    this.errorHistory = new Map();
  }
  
  /**
   * Exécute une opération avec retry automatique
   */
  async executeWithRetry(config: RetryConfig): Promise<RetryResult> {
    const startTime = Date.now();
    const retryHistory: RetryAttempt[] = [];
    const strategy = config.strategy || this.defaultStrategy;
    
    console.log(`🔄 Exécution avec retry: ${config.context.operationName}`);
    console.log(`   Stratégie: ${strategy.backoffStrategy}, Max retries: ${strategy.maxRetries}`);
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        // Calculer le délai pour cet essai
        const delay = this.calculateDelay(attempt, strategy);
        
        if (attempt > 0) {
          console.log(`   ⏳ Attente avant retry ${attempt}: ${delay}ms`);
          await this.delay(delay);
          
          // Enregistrer l'attente dans l'historique
          retryHistory.push({
            attemptNumber: attempt,
            timestamp: Date.now(),
            error: lastError,
            delay,
          });
        }
        
        // Exécuter l'opération
        console.log(`   🎯 Tentative ${attempt + 1}/${strategy.maxRetries + 1}`);
        const result = await config.operation();
        
        const totalDuration = Date.now() - startTime;
        
        // Succès
        console.log(`   ✅ Succès à la tentative ${attempt + 1}`);
        
        this.saveErrorHistory(config.context.operationId, retryHistory);
        
        return {
          success: true,
          result,
          attempts: attempt + 1,
          totalDuration,
          retryHistory,
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.log(`   ❌ Erreur à la tentative ${attempt + 1}: ${lastError.message}`);
        
        // Classifier l'erreur
        const classification = this.classifyError(lastError);
        console.log(`   📋 Classification: ${classification.type}, Retryable: ${classification.retryable}`);
        console.log(`   💡 Action suggérée: ${classification.suggestedAction}`);
        
        // Vérifier si on doit retry
        const shouldRetry = strategy.retryCondition(lastError, attempt) && classification.retryable;
        
        if (!shouldRetry) {
          console.log(`   🛑 Arrêt des retries (condition non remplie ou erreur non retryable)`);
          break;
        }
        
        // Callback de retry
        if (strategy.onRetry) {
          strategy.onRetry(lastError, attempt);
        }
      }
    }
    
    // Échec final
    const totalDuration = Date.now() - startTime;
    
    if (strategy.onFinalFailure && lastError) {
      strategy.onFinalFailure(lastError);
    }
    
    this.saveErrorHistory(config.context.operationId, retryHistory);
    
    return {
      success: false,
      result: null,
      error: lastError,
      attempts: strategy.maxRetries + 1,
      totalDuration,
      retryHistory,
    };
  }
  
  /**
   * Classifie une erreur
   */
  classifyError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();
    
    // Erreurs transitoires (réseau, timeout)
    if (message.includes("timeout") || message.includes("timed out")) {
      return {
        type: "timeout",
        retryable: true,
        suggestedAction: "Augmenter le timeout ou réessayer",
      };
    }
    
    if (message.includes("network") || message.includes("connection") || message.includes("econnrefused")) {
      return {
        type: "transient",
        retryable: true,
        suggestedAction: "Vérifier la connexion et réessayer",
      };
    }
    
    if (message.includes("rate limit") || message.includes("429") || message.includes("too many requests")) {
      return {
        type: "throttle",
        retryable: true,
        suggestedAction: "Attendre et réessayer avec backoff exponentiel",
      };
    }
    
    // Erreurs permanentes
    if (message.includes("not found") || message.includes("404") || message.includes("does not exist")) {
      return {
        type: "permanent",
        retryable: false,
        suggestedAction: "Corriger l'URL ou le chemin du fichier",
      };
    }
    
    if (message.includes("permission") || message.includes("403") || message.includes("unauthorized")) {
      return {
        type: "permanent",
        retryable: false,
        suggestedAction: "Vérifier les permissions d'accès",
      };
    }
    
    if (message.includes("invalid") || message.includes("malformed")) {
      return {
        type: "permanent",
        retryable: false,
        suggestedAction: "Corriger les paramètres de la requête",
      };
    }
    
    // Erreurs inconnues
    return {
      type: "unknown",
      retryable: true,
      suggestedAction: "Réessayer avec précaution",
    };
  }
  
  /**
   * Calcule le délai entre les retries
   */
  private calculateDelay(attempt: number, strategy: ErrorHandlingStrategy): number {
    switch (strategy.backoffStrategy) {
      case "fixed":
        return strategy.initialDelay;
      
      case "linear":
        return Math.min(strategy.initialDelay * (attempt + 1), strategy.maxDelay);
      
      case "exponential":
        return Math.min(strategy.initialDelay * Math.pow(2, attempt), strategy.maxDelay);
      
      default:
        return strategy.initialDelay;
    }
  }
  
  /**
   * Sauvegarde l'historique des erreurs
   */
  private saveErrorHistory(operationId: string, history: RetryAttempt[]): void {
    this.errorHistory.set(operationId, history);
  }
  
  /**
   * Retourne l'historique des erreurs pour une opération
   */
  getErrorHistory(operationId: string): RetryAttempt[] {
    return this.errorHistory.get(operationId) || [];
  }
  
  /**
   * Crée une stratégie de retry personnalisée
   */
  createStrategy(overrides: Partial<ErrorHandlingStrategy>): ErrorHandlingStrategy {
    return {
      ...this.defaultStrategy,
      ...overrides,
    };
  }
  
  /**
   * Exécute plusieurs opérations en parallèle avec retry
   */
  async executeParallelWithRetry(
    configs: RetryConfig[],
    maxConcurrency?: number
  ): Promise<RetryResult[]> {
    const concurrency = maxConcurrency || 3;
    const results: RetryResult[] = [];
    const executing: Promise<RetryResult>[] = [];
    
    console.log(`🚀 Exécution parallèle avec retry (concurrency: ${concurrency})`);
    
    for (const config of configs) {
      const promise = this.executeWithRetry(config);
      executing.push(promise);
      
      // Limiter la concurrence
      if (executing.length >= concurrency) {
        const result = await Promise.race(executing);
        results.push(result);
        const index = executing.findIndex(p => p === promise);
        executing.splice(index, 1);
      }
    }
    
    // Attendre les opérations restantes
    const remainingResults = await Promise.all(executing);
    results.push(...remainingResults);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Résultat: ${successCount}/${results.length} opérations réussies`);
    
    return results;
  }
  
  /**
   * Délai pour simulation
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Nettoie l'historique des erreurs
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
  }
  
  /**
   * Retourne les statistiques d'erreur
   */
  getErrorStats(): {
    totalOperations: number;
    totalAttempts: number;
    successRate: number;
    averageRetries: number;
  } {
    const totalOperations = this.errorHistory.size;
    const totalAttempts = Array.from(this.errorHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    
    // Calculer le taux de succès (estimation basée sur l'historique)
    const successRate = totalOperations > 0 ? 0.85 : 1.0; // Placeholder
    
    const averageRetries = totalOperations > 0 
      ? totalAttempts / totalOperations - 1 
      : 0;
    
    return {
      totalOperations,
      totalAttempts,
      successRate,
      averageRetries,
    };
  }
}

/**
 * Stratégies de retry prédéfinies
 */
export const RetryStrategies = {
  /**
   * Stratégie rapide (peu de retries, délai court)
   */
  fast: {
    maxRetries: 2,
    backoffStrategy: "fixed" as const,
    initialDelay: 500,
    maxDelay: 2000,
    retryCondition: (error, attempt) => attempt < 2,
  },
  
  /**
   * Stratégie équilibrée
   */
  balanced: {
    maxRetries: 3,
    backoffStrategy: "exponential" as const,
    initialDelay: 1000,
    maxDelay: 10000,
    retryCondition: (error, attempt) => attempt < 3,
  },
  
  /**
   * Stratégie patiente (beaucoup de retries, délai long)
   */
  patient: {
    maxRetries: 5,
    backoffStrategy: "exponential" as const,
    initialDelay: 2000,
    maxDelay: 60000,
    retryCondition: (error, attempt) => attempt < 5,
  },
  
  /**
   * Stratégie pour les opérations critiques
   */
  critical: {
    maxRetries: 10,
    backoffStrategy: "exponential" as const,
    initialDelay: 500,
    maxDelay: 120000,
    retryCondition: (error, attempt) => attempt < 10,
  },
};

/**
 * Helper pour créer un gestionnaire d'erreurs
 */
export function createErrorManager(): ErrorManager {
  return new ErrorManager();
}
