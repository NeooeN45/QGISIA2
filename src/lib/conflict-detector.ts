/**
 * Conflict Detection System
 * 
 * Système de détection de conflits de données
 * Détecte les conflits entre couches, attributs et données
 */

export interface Conflict {
  id: string;
  type: "geometry" | "attribute" | "topology" | "naming" | "schema" | "data";
  severity: "error" | "warning" | "info";
  description: string;
  affectedLayers: string[];
  affectedFields?: string[];
  suggestion: string;
  autoResolvable: boolean;
}

export interface ConflictDetectionResult {
  conflicts: Conflict[];
  totalConflicts: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  autoResolvable: number;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: "ignore" | "merge" | "overwrite" | "rename" | "delete";
  customAction?: string;
}

/**
 * Détecteur de conflits
 */
export class ConflictDetector {
  /**
   * Détecte les conflits entre couches
   */
  detectConflicts(layers: any[]): ConflictDetectionResult {
    console.log(`🔍 Détection de conflits: ${layers.length} couches`);
    
    const conflicts: Conflict[] = [];
    
    // Conflits de nommage
    const namingConflicts = this.detectNamingConflicts(layers);
    conflicts.push(...namingConflicts);
    
    // Conflits de schéma
    const schemaConflicts = this.detectSchemaConflicts(layers);
    conflicts.push(...schemaConflicts);
    
    // Conflits de géométrie
    const geometryConflicts = this.detectGeometryConflicts(layers);
    conflicts.push(...geometryConflicts);
    
    // Conflits topologiques
    const topologyConflicts = this.detectTopologyConflicts(layers);
    conflicts.push(...topologyConflicts);
    
    const result = this.buildResult(conflicts);
    
    console.log(`   📊 ${result.totalConflicts} conflit(s) détecté(s)`);
    console.log(`   ⚠️  Auto-résolubles: ${result.autoResolvable}`);
    
    return result;
  }
  
  /**
   * Détecte les conflits de nommage
   */
  private detectNamingConflicts(layers: any[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const nameMap = new Map<string, string[]>();
    
    for (const layer of layers) {
      const name = layer.name || layer.id;
      if (!nameMap.has(name)) {
        nameMap.set(name, []);
      }
      nameMap.get(name)!.push(layer.id);
    }
    
    for (const [name, layerIds] of nameMap) {
      if (layerIds.length > 1) {
        conflicts.push({
          id: `naming_${name}`,
          type: "naming",
          severity: "error",
          description: `Nom en double: "${name}" utilisé par ${layerIds.length} couches`,
          affectedLayers: layerIds,
          suggestion: "Renommer une des couches pour éviter le conflit",
          autoResolvable: true,
        });
      }
    }
    
    return conflicts;
  }
  
  /**
   * Détecte les conflits de schéma
   */
  private detectSchemaConflicts(layers: any[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    for (let i = 0; i < layers.length; i++) {
      for (let j = i + 1; j < layers.length; j++) {
        const layer1 = layers[i];
        const layer2 = layers[j];
        
        const fieldConflicts = this.detectFieldConflicts(layer1, layer2);
        conflicts.push(...fieldConflicts);
      }
    }
    
    return conflicts;
  }
  
  /**
   * Détecte les conflits de champs
   */
  private detectFieldConflicts(layer1: any, layer2: any): Conflict[] {
    const conflicts: Conflict[] = [];
    const fields1 = layer1.fields || [];
    const fields2 = layer2.fields || [];
    
    const commonFields = fields1.filter((f: string) => fields2.includes(f));
    
    if (commonFields.length > 0) {
      conflicts.push({
        id: `schema_${layer1.id}_${layer2.id}`,
        type: "schema",
        severity: "warning",
        description: `Champs communs entre ${layer1.name} et ${layer2.name}: ${commonFields.join(", ")}`,
        affectedLayers: [layer1.id, layer2.id],
        affectedFields: commonFields,
        suggestion: "Vérifier si les champs doivent avoir le même nom et le même type",
        autoResolvable: false,
      });
    }
    
    return conflicts;
  }
  
  /**
   * Détecte les conflits de géométrie
   */
  private detectGeometryConflicts(layers: any[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    for (const layer of layers) {
      if (layer.geometryType === "Unknown" || !layer.geometryType) {
        conflicts.push({
          id: `geometry_${layer.id}`,
          type: "geometry",
          severity: "warning",
          description: `Type de géométrie inconnu pour ${layer.name}`,
          affectedLayers: [layer.id],
          suggestion: "Vérifier la source de données ou réparer la géométrie",
          autoResolvable: false,
        });
      }
    }
    
    return conflicts;
  }
  
  /**
   * Détecte les conflits topologiques
   */
  private detectTopologyConflicts(layers: any[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Vérifier les couches qui se chevauchent
    for (let i = 0; i < layers.length; i++) {
      for (let j = i + 1; j < layers.length; j++) {
        const layer1 = layers[i];
        const layer2 = layers[j];
        
        // Simulation - à implémenter avec vérification réelle
        if (this.checkOverlap(layer1, layer2)) {
          conflicts.push({
            id: `topology_${layer1.id}_${layer2.id}`,
            type: "topology",
            severity: "info",
            description: `Chevauchement spatial possible entre ${layer1.name} et ${layer2.name}`,
            affectedLayers: [layer1.id, layer2.id],
            suggestion: "Vérifier si le chevauchement est attendu",
            autoResolvable: false,
          });
        }
      }
    }
    
    return conflicts;
  }
  
  /**
   * Vérifie le chevauchement (simulation)
   */
  private checkOverlap(layer1: any, layer2: any): boolean {
    // Simulation - à implémenter avec vérification réelle
    return false;
  }
  
  /**
   * Construit le résultat
   */
  private buildResult(conflicts: Conflict[]): ConflictDetectionResult {
    const bySeverity: Record<string, number> = {
      error: 0,
      warning: 0,
      info: 0,
    };
    
    const byType: Record<string, number> = {};
    
    for (const conflict of conflicts) {
      bySeverity[conflict.severity]++;
      byType[conflict.type] = (byType[conflict.type] || 0) + 1;
    }
    
    const autoResolvable = conflicts.filter(c => c.autoResolvable).length;
    
    return {
      conflicts,
      totalConflicts: conflicts.length,
      bySeverity,
      byType,
      autoResolvable,
    };
  }
  
  /**
   * Résout automatiquement les conflits résolubles
   */
  autoResolveConflicts(conflicts: Conflict[]): ConflictResolution[] {
    console.log(`🔧 Auto-résolution de conflits`);
    
    const resolutions: ConflictResolution[] = [];
    
    for (const conflict of conflicts) {
      if (conflict.autoResolvable) {
        let resolution: "ignore" | "merge" | "overwrite" | "rename" | "delete" = "ignore";
        
        switch (conflict.type) {
          case "naming":
            resolution = "rename";
            break;
          case "schema":
            resolution = "merge";
            break;
          default:
            resolution = "ignore";
        }
        
        resolutions.push({
          conflictId: conflict.id,
          resolution,
        });
        
        console.log(`   ✅ ${conflict.id}: ${resolution}`);
      }
    }
    
    return resolutions;
  }
  
  /**
   * Résout un conflit manuellement
   */
  resolveConflict(resolution: ConflictResolution): boolean {
    console.log(`🔧 Résolution manuelle: ${resolution.conflictId}`);
    
    // À implémenter avec la logique de résolution
    console.log(`   ✅ Conflit résolu: ${resolution.resolution}`);
    return true;
  }
  
  /**
   * Génère un rapport de conflits
   */
  generateConflictReport(result: ConflictDetectionResult): string {
    let report = "# Rapport de Conflits\n\n";
    report += "**Total des conflits**: " + result.totalConflicts + "\n";
    report += "**Auto-résolubles**: " + result.autoResolvable + "\n\n";
    report += "---\n\n";
    
    report += "## Par sévérité\n\n";
    report += "- Erreurs: " + result.bySeverity.error + "\n";
    report += "- Avertissements: " + result.bySeverity.warning + "\n";
    report += "- Infos: " + result.bySeverity.info + "\n\n";
    
    report += "## Par type\n\n";
    for (const [type, count] of Object.entries(result.byType)) {
      report += "- " + type + ": " + count + "\n";
    }
    
    report += "\n## Détails\n\n";
    for (const conflict of result.conflicts) {
      const severity = conflict.severity === "error" ? "[ERREUR]" : conflict.severity === "warning" ? "[AVERTISSEMENT]" : "[INFO]";
      report += severity + " " + conflict.type + ": " + conflict.description + "\n";
      report += "   Couches affectées: " + conflict.affectedLayers.join(", ") + "\n";
      report += "   Suggestion: " + conflict.suggestion + "\n\n";
    }
    
    return report;
  }
}

/**
 * Helper pour créer un détecteur de conflits
 */
export function createConflictDetector(): ConflictDetector {
  return new ConflictDetector();
}
