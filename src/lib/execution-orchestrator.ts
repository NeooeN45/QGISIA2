/**
 * Execution Orchestrator
 * 
 * Orchestrateur d'exécution des plans multi-étapes
 * Gère l'exécution séquentielle des tâches avec validation et retry
 */

import { Task, ExecutionPlan, RollbackStep } from "./task-decomposer";

export interface ExecutionContext {
  planId: string;
  currentTaskIndex: number;
  results: Map<string, TaskResult>;
  artifacts: Map<string, any>;
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed" | "rolled_back";
  checkpointsPassed: string[];
  errors: string[];
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output: any;
  error?: string;
  duration: number;
  timestamp: number;
  retryCount: number;
}

export interface ExecutionOptions {
  enableCheckpoints: boolean;
  enableRollback: boolean;
  maxConcurrentTasks: number;
  timeoutPerTask: number; // en secondes
  stopOnError: boolean;
}

export interface ExecutionReport {
  planId: string;
  userRequest: string;
  status: string;
  totalDuration: number;
  tasksExecuted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  checkpointsPassed: string[];
  artifacts: Record<string, any>;
  errors: string[];
  rollbackExecuted: boolean;
}

/**
 * Orchestrateur d'exécution
 */
export class ExecutionOrchestrator {
  private context: ExecutionContext | null = null;
  private options: ExecutionOptions;
  
  constructor(options: Partial<ExecutionOptions> = {}) {
    this.options = {
      enableCheckpoints: true,
      enableRollback: true,
      maxConcurrentTasks: 1,
      timeoutPerTask: 300, // 5 minutes par tâche
      stopOnError: true,
      ...options,
    };
  }
  
  /**
   * Exécute un plan d'exécution
   */
  async executePlan(plan: ExecutionPlan): Promise<ExecutionReport> {
    this.context = {
      planId: plan.id,
      currentTaskIndex: 0,
      results: new Map(),
      artifacts: new Map(),
      startTime: Date.now(),
      status: "running",
      checkpointsPassed: [],
      errors: [],
    };
    
    console.log(`🚀 Exécution du plan ${plan.id}: "${plan.userRequest}"`);
    console.log(`📋 ${plan.tasks.length} tâches à exécuter`);
    console.log(`⏱️  Durée estimée: ${plan.estimatedTotalDuration} minutes`);
    console.log(`⚠️  Niveau de risque: ${plan.riskLevel}`);
    
    try {
      // Exécuter les tâches séquentiellement
      for (let i = 0; i < plan.tasks.length; i++) {
        this.context.currentTaskIndex = i;
        const task = plan.tasks[i];
        
        console.log(`\n📝 Tâche ${i + 1}/${plan.tasks.length}: ${task.description}`);
        console.log(`   Type: ${task.type}`);
        console.log(`   Outils requis: ${task.requiredTools.join(", ")}`);
        
        // Vérifier les dépendances
        if (!this.checkDependencies(task, plan)) {
          throw new Error(`Dépendances non satisfaites pour la tâche ${task.id}`);
        }
        
        // Exécuter la tâche
        const result = await this.executeTask(task);
        this.context.results.set(task.id, result);
        
        if (!result.success) {
          this.context.errors.push(`Échec de la tâche ${task.id}: ${result.error}`);
          
          // Retry si possible
          if (result.retryCount < task.maxRetries) {
            console.log(`🔄 Retry ${result.retryCount + 1}/${task.maxRetries}...`);
            const retryResult = await this.executeTask(task);
            this.context.results.set(task.id, retryResult);
            
            if (!retryResult.success) {
              if (this.options.stopOnError) {
                throw new Error(`Échec après ${task.maxRetries} retries pour la tâche ${task.id}`);
              }
            }
          } else if (this.options.stopOnError) {
            throw new Error(`Échec de la tâche ${task.id}: ${result.error}`);
          }
        }
        
        // Checkpoint si activé
        if (this.options.enableCheckpoints) {
          const checkpoint = plan.checkpoints[i];
          if (checkpoint) {
            this.context.checkpointsPassed.push(checkpoint);
            console.log(`✅ Checkpoint passé: ${checkpoint}`);
          }
        }
      }
      
      // Marquer comme complété
      this.context.status = "completed";
      this.context.endTime = Date.now();
      
      console.log(`\n✅ Plan exécuté avec succès en ${this.getDuration()} secondes`);
      
    } catch (error) {
      this.context.status = "failed";
      this.context.endTime = Date.now();
      this.context.errors.push(error instanceof Error ? error.message : String(error));
      
      console.error(`\n❌ Échec de l'exécution: ${error}`);
      
      // Rollback si activé
      if (this.options.enableRollback) {
        console.log("🔄 Exécution du rollback...");
        await this.rollback(plan);
      }
    }
    
    return this.generateReport(plan);
  }
  
  /**
   * Exécute une tâche individuelle
   */
  private async executeTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    let retryCount = 0;
    
    try {
      // Timeout handling
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout après ${this.options.timeoutPerTask}s`)), this.options.timeoutPerTask * 1000);
      });
      
      // Exécuter selon le type de tâche
      const executionPromise = this.executeTaskByType(task);
      
      const output = await Promise.race([executionPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      
      return {
        taskId: task.id,
        success: true,
        output,
        duration,
        timestamp: Date.now(),
        retryCount,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        taskId: task.id,
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        duration,
        timestamp: Date.now(),
        retryCount,
      };
    }
  }
  
  /**
   * Exécute une tâche selon son type
   */
  private async executeTaskByType(task: Task): Promise<any> {
    switch (task.type) {
      case "data_acquisition":
        return this.executeDataAcquisition(task);
      case "data_processing":
        return this.executeDataProcessing(task);
      case "symbology":
        return this.executeSymbology(task);
      case "layout":
        return this.executeLayout(task);
      case "export":
        return this.executeExport(task);
      case "validation":
        return this.executeValidation(task);
      case "geoprocessing":
        return this.executeGeoprocessing(task);
      case "spatial_analysis":
        return this.executeSpatialAnalysis(task);
      case "attribute_management":
        return this.executeAttributeManagement(task);
      case "file_operation":
        return this.executeFileOperation(task);
      default:
        throw new Error(`Type de tâche non supporté: ${task.type}`);
    }
  }
  
  private async executeDataAcquisition(task: Task): Promise<any> {
    // Simulation - à remplacer par l'implémentation réelle
    console.log(`   📥 Acquisition de données: ${task.parameters.source}`);
    await this.delay(1000); // Simulation
    return { source: task.parameters.source, format: "geojson", records: 100 };
  }
  
  private async executeDataProcessing(task: Task): Promise<any> {
    console.log(`   ⚙️  Traitement des données`);
    await this.delay(800); // Simulation
    return { processed: true, features: 100 };
  }
  
  private async executeSymbology(task: Task): Promise<any> {
    console.log(`   🎨 Application de la symbologie`);
    await this.delay(1200); // Simulation
    return { styled: true, standard: task.parameters.standards };
  }
  
  private async executeLayout(task: Task): Promise<any> {
    console.log(`   🗺️  Création de la mise en page`);
    await this.delay(1500); // Simulation
    return { layout: "created", format: task.parameters.format };
  }
  
  private async executeExport(task: Task): Promise<any> {
    console.log(`   📤 Export en ${task.parameters.format}`);
    await this.delay(1000); // Simulation
    return { exported: true, path: `/output/map.${task.parameters.format}` };
  }
  
  private async executeValidation(task: Task): Promise<any> {
    console.log(`   ✅ Validation`);
    await this.delay(500); // Simulation
    return { valid: true, checks: task.parameters.checks };
  }
  
  private async executeGeoprocessing(task: Task): Promise<any> {
    console.log(`   🔧 Géotraitement: ${task.parameters.action}`);
    await this.delay(2000); // Simulation
    return { processed: true, action: task.parameters.action };
  }
  
  private async executeSpatialAnalysis(task: Task): Promise<any> {
    console.log(`   📊 Analyse spatiale`);
    await this.delay(1500); // Simulation
    return { analyzed: true };
  }
  
  private async executeAttributeManagement(task: Task): Promise<any> {
    console.log(`   📝 Gestion des attributs`);
    await this.delay(800); // Simulation
    return { attributes: "managed" };
  }
  
  private async executeFileOperation(task: Task): Promise<any> {
    console.log(`   📁 Opération fichier`);
    await this.delay(500); // Simulation
    return { operation: "completed" };
  }
  
  /**
   * Vérifie les dépendances d'une tâche
   */
  private checkDependencies(task: Task, plan: ExecutionPlan): boolean {
    for (const depId of task.dependencies) {
      const depResult = this.context?.results.get(depId);
      if (!depResult || !depResult.success) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Exécute le rollback
   */
  private async rollback(plan: ExecutionPlan): Promise<void> {
    if (!this.context) return;
    
    console.log("🔄 Exécution du plan de rollback...");
    
    for (const step of plan.rollbackPlan) {
      console.log(`   ↩️  ${step.description}`);
      await this.executeRollbackStep(step);
    }
    
    this.context.status = "rolled_back";
    console.log("✅ Rollback terminé");
  }
  
  private async executeRollbackStep(step: RollbackStep): Promise<void> {
    // Simulation - à remplacer par l'implémentation réelle
    await this.delay(300);
  }
  
  /**
   * Génère le rapport d'exécution
   */
  private generateReport(plan: ExecutionPlan): ExecutionReport {
    if (!this.context) {
      throw new Error("Contexte d'exécution non disponible");
    }
    
    const tasksSucceeded = Array.from(this.context.results.values()).filter(r => r.success).length;
    const tasksFailed = Array.from(this.context.results.values()).filter(r => !r.success).length;
    
    return {
      planId: this.context.planId,
      userRequest: plan.userRequest,
      status: this.context.status,
      totalDuration: this.getDuration(),
      tasksExecuted: this.context.results.size,
      tasksSucceeded,
      tasksFailed,
      checkpointsPassed: this.context.checkpointsPassed,
      artifacts: Object.fromEntries(this.context.artifacts),
      errors: this.context.errors,
      rollbackExecuted: this.context.status === "rolled_back",
    };
  }
  
  /**
   * Retourne la durée d'exécution en secondes
   */
  private getDuration(): number {
    if (!this.context) return 0;
    const endTime = this.context.endTime || Date.now();
    return Math.round((endTime - this.context.startTime) / 1000);
  }
  
  /**
   * Délai pour simulation
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Annule l'exécution en cours
   */
  cancel(): void {
    if (this.context) {
      this.context.status = "failed";
      this.context.endTime = Date.now();
      this.context.errors.push("Exécution annulée par l'utilisateur");
    }
  }
  
  /**
   * Retourne le contexte d'exécution actuel
   */
  getContext(): ExecutionContext | null {
    return this.context;
  }
}

/**
 * Helper pour créer un orchestrateur avec les options par défaut
 */
export function createOrchestrator(options?: Partial<ExecutionOptions>): ExecutionOrchestrator {
  return new ExecutionOrchestrator(options);
}
