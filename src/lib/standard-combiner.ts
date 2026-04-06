/**
 * Standard Combination System
 * 
 * Système de combinaison de plusieurs normes cartographiques
 * Permet de mixer intelligemment plusieurs normes pour un même projet
 */

import { CartographicStandard, SymbologyRule } from "./cartographic-standards";

export interface StandardCombination {
  id: string;
  name: string;
  description: string;
  baseStandards: string[];
  combinationRules: CombinationRule[];
  layerMapping: LayerMapping[];
  conflicts: Conflict[];
  metadata: CombinationMetadata;
}

export interface CombinationRule {
  id: string;
  type: "priority" | "merge" | "override" | "custom";
  description: string;
  standardId: string;
  layerTypeId: string;
  priority: number;
  condition?: string;
}

export interface LayerMapping {
  layerId: string;
  layerTypeId: string;
  standardId: string;
  priority: number;
  overrides?: Partial<SymbologyRule>;
}

export interface Conflict {
  type: "symbology" | "layout" | "metadata" | "scale";
  description: string;
  standards: string[];
  resolution?: "priority" | "merge" | "user_choice";
  resolved: boolean;
}

export interface CombinationMetadata {
  createdAt: number;
  createdBy: string;
  lastModified: number;
  version: string;
  tags: string[];
}

export interface CombinationResult {
  success: boolean;
  combination: StandardCombination;
  warnings: string[];
  conflicts: Conflict[];
  appliedMappings: LayerMapping[];
}

/**
 * Gestionnaire de combinaison de normes
 */
export class StandardCombiner {
  private combinations: Map<string, StandardCombination>;
  private standards: Map<string, CartographicStandard>;
  
  constructor() {
    this.combinations = new Map();
    this.standards = new Map();
  }
  
  /**
   * Enregistre une norme
   */
  registerStandard(standard: CartographicStandard): void {
    this.standards.set(standard.id, standard);
  }
  
  /**
   * Combine plusieurs normes
   */
  combineStandards(
    standardIds: string[],
    options: CombinationOptions
  ): CombinationResult {
    console.log(`🔀 Combinaison de normes: ${standardIds.join(" + ")}`);
    
    // Vérifier que toutes les normes existent
    const missingStandards = standardIds.filter(id => !this.standards.has(id));
    if (missingStandards.length > 0) {
      return {
        success: false,
        combination: this.createEmptyCombination(),
        warnings: [`Normes manquantes: ${missingStandards.join(", ")}`],
        conflicts: [],
        appliedMappings: [],
      };
    }
    
    // Récupérer les normes
    const standards = standardIds.map(id => this.standards.get(id)!);
    
    // Détecter les conflits
    const conflicts = this.detectConflicts(standards);
    
    // Résoudre les conflits
    const resolvedConflicts = this.resolveConflicts(conflicts, options);
    
    // Créer les règles de combinaison
    const combinationRules = this.createCombinationRules(standards, options);
    
    // Créer le mapping des couches
    const layerMapping = this.createLayerMapping(standards, options);
    
    // Générer les warnings
    const warnings = this.generateWarnings(standards, conflicts);
    
    const combination: StandardCombination = {
      id: `combo_${Date.now()}`,
      name: options.name || `Combinaison: ${standards.map(s => s.name).join(" + ")}`,
      description: options.description || `Combinaison de ${standardIds.join(", ")}`,
      baseStandards: standardIds,
      combinationRules,
      layerMapping,
      conflicts: resolvedConflicts,
      metadata: {
        createdAt: Date.now(),
        createdBy: "system",
        lastModified: Date.now(),
        version: "1.0",
        tags: options.tags || [],
      },
    };
    
    this.combinations.set(combination.id, combination);
    
    console.log(`   ✅ Combinaison créée: ${combination.id}`);
    console.log(`   📋 ${layerMapping.length} mappings de couches`);
    console.log(`   ⚠️  ${conflicts.filter(c => !c.resolved).length} conflits non résolus`);
    
    return {
      success: true,
      combination,
      warnings,
      conflicts: resolvedConflicts,
      appliedMappings: layerMapping,
    };
  }
  
  /**
   * Détecte les conflits entre normes
   */
  private detectConflicts(standards: CartographicStandard[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Conflits de symbologie pour le même type de couche
    const layerTypeMap = new Map<string, CartographicStandard[]>();
    
    for (const standard of standards) {
      for (const layerType of standard.layerTypes) {
        if (!layerTypeMap.has(layerType.id)) {
          layerTypeMap.set(layerType.id, []);
        }
        layerTypeMap.get(layerType.id)!.push(standard);
      }
    }
    
    for (const [layerTypeId, stds] of layerTypeMap) {
      if (stds.length > 1) {
        conflicts.push({
          type: "symbology",
          description: `Conflit de symbologie pour le type de couche ${layerTypeId}`,
          standards: stds.map(s => s.id),
          resolution: "priority",
          resolved: false,
        });
      }
    }
    
    // Conflits de mise en page
    const layoutConflicts = this.detectLayoutConflicts(standards);
    conflicts.push(...layoutConflicts);
    
    // Conflits d'échelle
    const scaleConflicts = this.detectScaleConflicts(standards);
    conflicts.push(...scaleConflicts);
    
    return conflicts;
  }
  
  /**
   * Détecte les conflits de mise en page
   */
  private detectLayoutConflicts(standards: CartographicStandard[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Vérifier les tailles de page
    const pageSizes = new Set(standards.flatMap(s => s.layoutRules.pageSizes.map(p => p.size)));
    if (pageSizes.size > 1) {
      conflicts.push({
        type: "layout",
        description: `Tailles de page différentes: ${Array.from(pageSizes).join(", ")}`,
        standards: standards.map(s => s.id),
        resolution: "user_choice",
        resolved: false,
      });
    }
    
    // Vérifier les orientations
    const orientations = new Set(standards.flatMap(s => s.layoutRules.orientations.map(o => o.orientation)));
    if (orientations.size > 1) {
      conflicts.push({
        type: "layout",
        description: `Orientations différentes: ${Array.from(orientations).join(", ")}`,
        standards: standards.map(s => s.id),
        resolution: "priority",
        resolved: false,
      });
    }
    
    return conflicts;
  }
  
  /**
   * Détecte les conflits d'échelle
   */
  private detectScaleConflicts(standards: CartographicStandard[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Vérifier les plages d'échelle
    const scaleRanges = standards.flatMap(s => s.scaleRanges);
    
    if (scaleRanges.length > 1) {
      const minScales = scaleRanges.map(sr => sr.minScale);
      const maxScales = scaleRanges.map(sr => sr.maxScale);
      
      if (Math.max(...minScales) - Math.min(...minScales) > 10000) {
        conflicts.push({
          type: "scale",
          description: `Plages d'échelle incompatibles`,
          standards: standards.map(s => s.id),
          resolution: "merge",
          resolved: false,
        });
      }
    }
    
    return conflicts;
  }
  
  /**
   * Résout les conflits
   */
  private resolveConflicts(
    conflicts: Conflict[],
    options: CombinationOptions
  ): Conflict[] {
    const resolved = conflicts.map(conflict => ({ ...conflict }));
    
    for (const conflict of resolved) {
      if (conflict.resolution === "priority") {
        // Résoudre par priorité (première norme gagne)
        conflict.resolved = true;
      } else if (conflict.resolution === "merge") {
        // Résoudre par fusion
        conflict.resolved = true;
      } else if (conflict.resolution === "user_choice") {
        // L'utilisateur doit choisir
        if (options.defaultResolution) {
          conflict.resolved = true;
          conflict.resolution = options.defaultResolution;
        }
      }
    }
    
    return resolved;
  }
  
  /**
   * Crée les règles de combinaison
   */
  private createCombinationRules(
    standards: CartographicStandard[],
    options: CombinationOptions
  ): CombinationRule[] {
    const rules: CombinationRule[] = [];
    
    for (let i = 0; i < standards.length; i++) {
      const standard = standards[i];
      const priority = standards.length - i; // Plus haute pour les premières normes
      
      for (const layerType of standard.layerTypes) {
        rules.push({
          id: `rule_${standard.id}_${layerType.id}`,
          type: options.defaultRuleType || "priority",
          description: `Règle pour ${layerType.name} selon ${standard.name}`,
          standardId: standard.id,
          layerTypeId: layerType.id,
          priority,
        });
      }
    }
    
    return rules;
  }
  
  /**
   * Crée le mapping des couches
   */
  private createLayerMapping(
    standards: CartographicStandard[],
    options: CombinationOptions
  ): LayerMapping[] {
    const mappings: LayerMapping[] = [];
    const mappedLayerTypes = new Set<string>();
    
    for (let i = 0; i < standards.length; i++) {
      const standard = standards[i];
      const priority = standards.length - i;
      
      for (const layerType of standard.layerTypes) {
        // Vérifier si le type de couche est déjà mappé
        if (mappedLayerTypes.has(layerType.id)) {
          // Conflit - ignorer ou appliquer une règle spécifique
          if (options.allowOverwrites) {
            // Écraser le mapping existant
            const existingIndex = mappings.findIndex(m => m.layerTypeId === layerType.id);
            if (existingIndex >= 0) {
              mappings[existingIndex] = {
                layerId: layerType.id,
                layerTypeId: layerType.id,
                standardId: standard.id,
                priority,
              };
            }
          }
        } else {
          // Nouveau mapping
          mappings.push({
            layerId: layerType.id,
            layerTypeId: layerType.id,
            standardId: standard.id,
            priority,
          });
          mappedLayerTypes.add(layerType.id);
        }
      }
    }
    
    // Trier par priorité
    mappings.sort((a, b) => b.priority - a.priority);
    
    return mappings;
  }
  
  /**
   * Génère les warnings
   */
  private generateWarnings(
    standards: CartographicStandard[],
    conflicts: Conflict[]
  ): string[] {
    const warnings: string[] = [];
    
    if (standards.length > 3) {
      warnings.push("Combinaison de nombreuses normes - risque de conflits élevé");
    }
    
    const domainSet = new Set(standards.map(s => s.domain));
    if (domainSet.size > 2) {
      warnings.push("Combinaison de normes de domaines différents");
    }
    
    const unresolvedConflicts = conflicts.filter(c => !c.resolved);
    if (unresolvedConflicts.length > 0) {
      warnings.push(`${unresolvedConflicts.length} conflit(s) non résolu(s)`);
    }
    
    return warnings;
  }
  
  /**
   * Applique une combinaison à une couche
   */
  applyCombination(
    combinationId: string,
    layerId: string
  ): {
    standardId: string;
    symbologyRule?: SymbologyRule;
  } | null {
    const combination = this.combinations.get(combinationId);
    if (!combination) {
      return null;
    }
    
    const mapping = combination.layerMapping.find(m => m.layerId === layerId);
    if (!mapping) {
      return null;
    }
    
    const standard = this.standards.get(mapping.standardId);
    if (!standard) {
      return null;
    }
    
    const symbologyRule = standard.symbologyRules.find(r => r.layerTypeId === mapping.layerTypeId);
    
    return {
      standardId: mapping.standardId,
      symbologyRule,
    };
  }
  
  /**
   * Crée une combinaison vide
   */
  private createEmptyCombination(): StandardCombination {
    return {
      id: "",
      name: "",
      description: "",
      baseStandards: [],
      combinationRules: [],
      layerMapping: [],
      conflicts: [],
      metadata: {
        createdAt: Date.now(),
        createdBy: "system",
        lastModified: Date.now(),
        version: "1.0",
        tags: [],
      },
    };
  }
  
  /**
   * Retourne toutes les combinaisons
   */
  getCombinations(): StandardCombination[] {
    return Array.from(this.combinations.values());
  }
  
  /**
   * Retourne une combinaison par ID
   */
  getCombination(id: string): StandardCombination | undefined {
    return this.combinations.get(id);
  }
  
  /**
   * Supprime une combinaison
   */
  removeCombination(id: string): boolean {
    return this.combinations.delete(id);
  }
  
  /**
   * Met à jour une combinaison
   */
  updateCombination(id: string, updates: Partial<StandardCombination>): boolean {
    const combination = this.combinations.get(id);
    if (!combination) {
      return false;
    }
    
    const updated = { ...combination, ...updates, metadata: { ...combination.metadata, lastModified: Date.now() } };
    this.combinations.set(id, updated);
    return true;
  }
}

export interface CombinationOptions {
  name?: string;
  description?: string;
  tags?: string[];
  defaultRuleType?: "priority" | "merge" | "override" | "custom";
  defaultResolution?: "priority" | "merge" | "user_choice";
  allowOverwrites?: boolean;
}

/**
 * Helper pour créer un combineur de normes
 */
export function createStandardCombiner(): StandardCombiner {
  return new StandardCombiner();
}
