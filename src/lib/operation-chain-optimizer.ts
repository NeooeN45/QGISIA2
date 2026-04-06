/**
 * Intelligent Operation Chaining System
 * 
 * Système de chaînage intelligent des opérations
 * Orchestre les opérations de manière optimale en fonction du contexte
 */

export interface Operation {
  id: string;
  type: OperationType;
  description: string;
  inputRequirements: InputRequirement[];
  outputArtifacts: string[];
  estimatedCost: number; // en "unités" de coût
  estimatedBenefit: number; // en "unités" de bénéfice
  dependencies: string[];
  parallelizable: boolean;
  priority: number;
}

export type OperationType =
  | "load_data"
  | "filter_data"
  | "transform_data"
  | "join_data"
  | "calculate_field"
  | "geoprocess"
  | "style_layer"
  | "create_layout"
  | "export_map"
  | "validate";

export interface InputRequirement {
  type: "layer" | "field" | "artifact" | "parameter";
  name: string;
  optional: boolean;
}

export interface ChainPlan {
  operations: Operation[];
  executionOrder: string[];
  parallelGroups: string[][];
  totalCost: number;
  totalBenefit: number;
  efficiency: number; // bénéfice/coût
}

export interface ChainContext {
  availableLayers: string[];
  availableFields: Record<string, string[]>;
  availableArtifacts: string[];
  systemResources: SystemResources;
  userPreferences: UserPreferences;
}

export interface SystemResources {
  availableMemory: number; // en MB
  availableDiskSpace: number; // en MB
  maxConcurrentOperations: number;
  estimatedProcessingTime: number; // en secondes
}

export interface UserPreferences {
  prioritizeSpeed: boolean;
  prioritizeQuality: boolean;
  prioritizeMemory: boolean;
  preferredOutputFormat: string;
}

/**
 * Optimiseur de chaînage d'opérations
 */
export class OperationChainOptimizer {
  private operationRegistry: Map<string, Operation>;
  
  constructor() {
    this.operationRegistry = new Map();
    this.initializeRegistry();
  }
  
  /**
   * Optimise le chaînage d'opérations
   */
  optimizeChain(
    requestedOperations: Operation[],
    context: ChainContext
  ): ChainPlan {
    console.log("🔗 Optimisation du chaînage d'opérations...");
    
    // 1. Filtrer les opérations non disponibles
    const availableOps = this.filterAvailableOperations(requestedOperations, context);
    
    // 2. Identifier les dépendances
    const withDependencies = this.addImplicitDependencies(availableOps);
    
    // 3. Optimiser l'ordre d'exécution
    const orderedOps = this.optimizeExecutionOrder(withDependencies, context);
    
    // 4. Identifier les groupes parallélisables
    const parallelGroups = this.identifyParallelGroups(orderedOps, context);
    
    // 5. Calculer les coûts et bénéfices
    const metrics = this.calculateMetrics(orderedOps);
    
    const plan: ChainPlan = {
      operations: orderedOps,
      executionOrder: orderedOps.map(op => op.id),
      parallelGroups,
      totalCost: metrics.totalCost,
      totalBenefit: metrics.totalBenefit,
      efficiency: metrics.efficiency,
    };
    
    console.log(`📊 Plan optimisé:`);
    console.log(`   Opérations: ${orderedOps.length}`);
    console.log(`   Coût total: ${metrics.totalCost}`);
    console.log(`   Bénéfice total: ${metrics.totalBenefit}`);
    console.log(`   Efficacité: ${metrics.efficiency.toFixed(2)}`);
    console.log(`   Groupes parallèles: ${parallelGroups.length}`);
    
    return plan;
  }
  
  /**
   * Filtre les opérations disponibles
   */
  private filterAvailableOperations(
    operations: Operation[],
    context: ChainContext
  ): Operation[] {
    return operations.filter(op => {
      // Vérifier les ressources système
      if (op.estimatedCost > context.systemResources.availableMemory) {
        console.log(`   ⚠️  Opération ${op.id} rejetée: mémoire insuffisante`);
        return false;
      }
      
      // Vérifier les dépendances d'entrée
      for (const req of op.inputRequirements) {
        if (!req.optional) {
          if (req.type === "layer" && !context.availableLayers.includes(req.name)) {
            console.log(`   ⚠️  Opération ${op.id} rejetée: couche ${req.name} non disponible`);
            return false;
          }
          if (req.type === "artifact" && !context.availableArtifacts.includes(req.name)) {
            console.log(`   ⚠️  Opération ${op.id} rejetée: artifact ${req.name} non disponible`);
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  /**
   * Ajoute les dépendances implicites
   */
  private addImplicitDependencies(operations: Operation[]): Operation[] {
    const opMap = new Map(operations.map(op => [op.id, op]));
    
    for (const op of operations) {
      // Dépendances implicites basées sur le type
      if (op.type === "style_layer") {
        // Le style nécessite que la couche soit chargée
        const loadOp = operations.find(o => o.type === "load_data");
        if (loadOp && !op.dependencies.includes(loadOp.id)) {
          op.dependencies.push(loadOp.id);
        }
      }
      
      if (op.type === "create_layout") {
        // La mise en page nécessite des couches stylisées
        const styleOp = operations.find(o => o.type === "style_layer");
        if (styleOp && !op.dependencies.includes(styleOp.id)) {
          op.dependencies.push(styleOp.id);
        }
      }
      
      if (op.type === "export_map") {
        // L'export nécessite une mise en page
        const layoutOp = operations.find(o => o.type === "create_layout");
        if (layoutOp && !op.dependencies.includes(layoutOp.id)) {
          op.dependencies.push(layoutOp.id);
        }
      }
      
      if (op.type === "calculate_field") {
        // Le calcul nécessite que les données soient chargées
        const loadOp = operations.find(o => o.type === "load_data");
        if (loadOp && !op.dependencies.includes(loadOp.id)) {
          op.dependencies.push(loadOp.id);
        }
      }
    }
    
    return operations;
  }
  
  /**
   * Optimise l'ordre d'exécution
   */
  private optimizeExecutionOrder(
    operations: Operation[],
    context: ChainContext
  ): Operation[] {
    const ordered: Operation[] = [];
    const remaining = [...operations];
    const processed = new Set<string>();
    
    while (remaining.length > 0) {
      // Trouver les opérations prêtes (dépendances satisfaites)
      const ready = remaining.filter(op =>
        op.dependencies.every(dep => processed.has(dep))
      );
      
      if (ready.length === 0) {
        // Cycle de dépendances, prendre la priorité la plus haute
        const next = remaining.sort((a, b) => b.priority - a.priority)[0];
        ordered.push(next);
        processed.add(next.id);
        const index = remaining.indexOf(next);
        remaining.splice(index, 1);
        continue;
      }
      
      // Trier par priorité
      ready.sort((a, b) => b.priority - a.priority);
      
      // Ajouter les opérations prêtes
      for (const op of ready) {
        ordered.push(op);
        processed.add(op.id);
        const index = remaining.indexOf(op);
        remaining.splice(index, 1);
      }
    }
    
    return ordered;
  }
  
  /**
   * Identifie les groupes d'opérations parallélisables
   */
  private identifyParallelGroups(
    operations: Operation[],
    context: ChainContext
  ): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    
    // Groupe 1: Opérations sans dépendances qui sont parallélisables
    const group1 = operations.filter(op =>
      op.dependencies.length === 0 &&
      op.parallelizable &&
      !processed.has(op.id)
    );
    
    if (group1.length > 1) {
      groups.push(group1.map(op => op.id));
      group1.forEach(op => processed.add(op.id));
    }
    
    // Groupe 2: Opérations avec les mêmes dépendances qui sont parallélisables
    const depGroups = new Map<string, Operation[]>();
    
    for (const op of operations) {
      if (processed.has(op.id)) continue;
      if (!op.parallelizable) continue;
      
      const depKey = op.dependencies.sort().join(",");
      if (!depGroups.has(depKey)) {
        depGroups.set(depKey, []);
      }
      depGroups.get(depKey)!.push(op);
    }
    
    for (const [depKey, ops] of depGroups) {
      if (ops.length > 1) {
        groups.push(ops.map(op => op.id));
        ops.forEach(op => processed.add(op.id));
      }
    }
    
    return groups;
  }
  
  /**
   * Calcule les métriques du plan
   */
  private calculateMetrics(operations: Operation[]): {
    totalCost: number;
    totalBenefit: number;
    efficiency: number;
  } {
    const totalCost = operations.reduce((sum, op) => sum + op.estimatedCost, 0);
    const totalBenefit = operations.reduce((sum, op) => sum + op.estimatedBenefit, 0);
    const efficiency = totalCost > 0 ? totalBenefit / totalCost : 0;
    
    return { totalCost, totalBenefit, efficiency };
  }
  
  /**
   * Initialise le registre d'opérations
   */
  private initializeRegistry(): void {
    const operations: Operation[] = [
      {
        id: "load_data",
        type: "load_data",
        description: "Charger des données géospatiales",
        inputRequirements: [{ type: "artifact", name: "data_source", optional: false }],
        outputArtifacts: ["loaded_layer"],
        estimatedCost: 10,
        estimatedBenefit: 50,
        dependencies: [],
        parallelizable: true,
        priority: 10,
      },
      {
        id: "filter_data",
        type: "filter_data",
        description: "Filtrer les données",
        inputRequirements: [
          { type: "layer", name: "*", optional: false },
          { type: "parameter", name: "filter_expression", optional: false },
        ],
        outputArtifacts: ["filtered_layer"],
        estimatedCost: 5,
        estimatedBenefit: 30,
        dependencies: [],
        parallelizable: true,
        priority: 8,
      },
      {
        id: "transform_data",
        type: "transform_data",
        description: "Transformer les données",
        inputRequirements: [{ type: "layer", name: "*", optional: false }],
        outputArtifacts: ["transformed_layer"],
        estimatedCost: 8,
        estimatedBenefit: 40,
        dependencies: [],
        parallelizable: true,
        priority: 7,
      },
      {
        id: "join_data",
        type: "join_data",
        description: "Joindre des données",
        inputRequirements: [
          { type: "layer", name: "layer1", optional: false },
          { type: "layer", name: "layer2", optional: false },
        ],
        outputArtifacts: ["joined_layer"],
        estimatedCost: 15,
        estimatedBenefit: 45,
        dependencies: [],
        parallelizable: false,
        priority: 6,
      },
      {
        id: "calculate_field",
        type: "calculate_field",
        description: "Calculer un nouveau champ",
        inputRequirements: [
          { type: "layer", name: "*", optional: false },
          { type: "parameter", name: "expression", optional: false },
        ],
        outputArtifacts: ["calculated_field"],
        estimatedCost: 7,
        estimatedBenefit: 35,
        dependencies: [],
        parallelizable: true,
        priority: 5,
      },
      {
        id: "geoprocess",
        type: "geoprocess",
        description: "Opération de géotraitement",
        inputRequirements: [
          { type: "layer", name: "*", optional: false },
          { type: "parameter", name: "operation_type", optional: false },
        ],
        outputArtifacts: ["geoprocessed_layer"],
        estimatedCost: 20,
        estimatedBenefit: 60,
        dependencies: [],
        parallelizable: false,
        priority: 4,
      },
      {
        id: "style_layer",
        type: "style_layer",
        description: "Appliquer un style à une couche",
        inputRequirements: [
          { type: "layer", name: "*", optional: false },
          { type: "artifact", name: "style_definition", optional: false },
        ],
        outputArtifacts: ["styled_layer"],
        estimatedCost: 12,
        estimatedBenefit: 55,
        dependencies: [],
        parallelizable: true,
        priority: 3,
      },
      {
        id: "create_layout",
        type: "create_layout",
        description: "Créer une mise en page",
        inputRequirements: [
          { type: "artifact", name: "styled_layers", optional: false },
          { type: "parameter", name: "layout_template", optional: true },
        ],
        outputArtifacts: ["map_layout"],
        estimatedCost: 18,
        estimatedBenefit: 70,
        dependencies: [],
        parallelizable: false,
        priority: 2,
      },
      {
        id: "export_map",
        type: "export_map",
        description: "Exporter la carte",
        inputRequirements: [
          { type: "artifact", name: "map_layout", optional: false },
          { type: "parameter", name: "output_format", optional: false },
        ],
        outputArtifacts: ["exported_file"],
        estimatedCost: 10,
        estimatedBenefit: 80,
        dependencies: [],
        parallelizable: false,
        priority: 1,
      },
      {
        id: "validate",
        type: "validate",
        description: "Valider le résultat",
        inputRequirements: [{ type: "artifact", name: "result", optional: false }],
        outputArtifacts: ["validation_report"],
        estimatedCost: 5,
        estimatedBenefit: 40,
        dependencies: [],
        parallelizable: true,
        priority: 0,
      },
    ];
    
    for (const op of operations) {
      this.operationRegistry.set(op.id, op);
    }
  }
  
  /**
   * Crée une opération personnalisée
   */
  createCustomOperation(operation: Operation): void {
    this.operationRegistry.set(operation.id, operation);
  }
  
  /**
   * Retourne une opération par ID
   */
  getOperation(id: string): Operation | undefined {
    return this.operationRegistry.get(id);
  }
  
  /**
   * Retourne toutes les opérations
   */
  getAllOperations(): Operation[] {
    return Array.from(this.operationRegistry.values());
  }
}

/**
 * Helper pour créer un optimiseur
 */
export function createChainOptimizer(): OperationChainOptimizer {
  return new OperationChainOptimizer();
}
