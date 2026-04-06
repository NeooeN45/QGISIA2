/**
 * Automatic Map Creation System
 * 
 * Système de création de cartes automatiques
 * Crée des cartes complètes automatiquement à partir de demandes
 */

import { CartographicStandard } from "./cartographic-standards";
import { matchStandard } from "./standard-matcher";
import { applyStandardSymbology } from "./symbology-applier";
import { LayoutCreator } from "./layout-creator";
import { QGISLayoutManager } from "./qgis-layout-manager";
import { ExportPrintManager } from "./export-print-manager";
import { GeoprocessingManager } from "./geoprocessing-manager";
import { SpatialAnalysisManager } from "./spatial-analysis-manager";
import { AttributeManager } from "./attribute-manager";

export interface AutoMapCreationRequest {
  title: string;
  description: string;
  layers: string[];
  extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
  scale?: number;
  standardId?: string;
  outputFormat?: "pdf" | "png" | "svg";
  outputPath?: string;
  options?: AutoMapOptions;
}

export interface AutoMapOptions {
  includeLegend: boolean;
  includeScaleBar: boolean;
  includeNorthArrow: boolean;
  includeGrid: boolean;
  includeCoordinates: boolean;
  customLayout?: boolean;
  templateId?: string;
}

export interface AutoMapResult {
  success: boolean;
  mapId: string;
  layoutId?: string;
  outputPath?: string;
  steps: string[];
  duration: number;
  error?: string;
}

/**
 * Créateur de cartes automatiques
 */
export class AutoMapCreator {
  private layoutCreator: LayoutCreator;
  private layoutManager: QGISLayoutManager;
  private exportManager: ExportPrintManager;
  private geoprocessingManager: GeoprocessingManager;
  private spatialAnalysisManager: SpatialAnalysisManager;
  private attributeManager: AttributeManager;
  
  constructor() {
    this.layoutCreator = new LayoutCreator();
    this.layoutManager = new QGISLayoutManager();
    this.exportManager = new ExportPrintManager();
    this.geoprocessingManager = new GeoprocessingManager();
    this.spatialAnalysisManager = new SpatialAnalysisManager();
    this.attributeManager = new AttributeManager();
  }
  
  /**
   * Crée une carte automatiquement
   */
  async createAutoMap(request: AutoMapCreationRequest): Promise<AutoMapResult> {
    console.log(`🗺️  Création de carte automatique: ${request.title}`);
    
    const startTime = Date.now();
    const steps: string[] = [];
    let mapId = "";
    let layoutId: string | undefined;
    let outputPath: string | undefined;
    
    try {
      // Étape 1: Sélectionner la norme appropriée
      steps.push("Sélection de la norme cartographique");
      let standardId = request.standardId;
      
      if (!standardId) {
        const matchResult = await matchStandard(request.description);
        if (matchResult.selectedStandards.length > 0) {
          standardId = matchResult.selectedStandards[0].id;
          console.log(`   Norme sélectionnée: ${standardId}`);
        }
      }
      
      // Étape 2: Charger et styller les couches
      steps.push("Chargement et stylage des couches");
      // Note: La symbologie sera appliquée par l'utilisateur ou via le bridge QGIS
      
      mapId = `map_${Date.now()}`;
      steps.push("Couches prêtes");
      
      // Étape 3: Créer la mise en page
      steps.push("Création de la mise en page");
      const templateId = request.options?.templateId || "minimal";
      const layoutResult = await this.layoutCreator.createLayout(templateId, {
        layoutName: `${request.title.replace(/\s+/g, "_")}_layout`,
        title: request.title,
        subtitle: request.description,
        mapLayer: request.layers[0],
      });
      
      if (!layoutResult.success) {
        throw new Error(layoutResult.error || "Échec de la création de la mise en page");
      }
      
      layoutId = layoutResult.layoutId;
      console.log(`   Mise en page créée: ${layoutId}`);
      
      // Étape 4: Ajouter les éléments de mise en page
      steps.push("Ajout des éléments de mise en page");
      const options = request.options || {
        includeLegend: true,
        includeScaleBar: true,
        includeNorthArrow: true,
        includeGrid: false,
        includeCoordinates: false,
      };
      
      if (options.includeLegend) {
        await this.layoutManager.addLegendToLayout(layoutResult.layoutName!, { x: 20, y: 50 }, { width: 60, height: 120 });
        steps.push("Légende ajoutée");
      }
      
      if (options.includeScaleBar) {
        await this.layoutManager.addScaleBarToLayout(layoutResult.layoutName!, "map", { x: 20, y: 200 }, { width: 100, height: 15 });
        steps.push("Échelle ajoutée");
      }
      
      if (options.includeNorthArrow) {
        await this.layoutManager.addNorthArrowToLayout(layoutResult.layoutName!, { x: 270, y: 155 }, { width: 25, height: 25 });
        steps.push("Flèche du nord ajoutée");
      }
      
      // Étape 5: Exporter la carte
      if (request.outputFormat && request.outputPath) {
        steps.push("Export de la carte");
        const exportResult = await this.exportManager.exportToImage(
          layoutResult.layoutName!,
          request.outputPath,
          { format: request.outputFormat, resolution: 300 }
        );
        
        if (!exportResult.success) {
          throw new Error(exportResult.error || "Échec de l'export");
        }
        
        outputPath = exportResult.filePath;
        console.log(`   Carte exportée: ${outputPath}`);
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Carte créée avec succès en ${duration}ms`);
      
      return {
        success: true,
        mapId,
        layoutId,
        outputPath,
        steps,
        duration,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`   ❌ Erreur de création: ${errorMessage}`);
      
      return {
        success: false,
        mapId: "",
        steps,
        duration,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Crée une carte forestière automatiquement
   */
  async createForestMap(
    forestName: string,
    layers: string[],
    options: Partial<AutoMapOptions> = {}
  ): Promise<AutoMapResult> {
    console.log(`🌲 Création de carte forestière: ${forestName}`);
    
    return this.createAutoMap({
      title: `Carte Forestière - ${forestName}`,
      description: `Plan de gestion forestière pour ${forestName}`,
      layers,
      standardId: "onf-2024",
      outputFormat: "pdf",
      outputPath: `/output/foret_${forestName.replace(/\s+/g, "_")}.pdf`,
      options: {
        includeLegend: true,
        includeScaleBar: true,
        includeNorthArrow: true,
        includeGrid: true,
        includeCoordinates: true,
        templateId: "onf_standard",
        ...options,
      },
    });
  }
  
  /**
   * Crée une carte topographique automatiquement
   */
  async createTopographicMap(
    areaName: string,
    layers: string[],
    options: Partial<AutoMapOptions> = {}
  ): Promise<AutoMapResult> {
    console.log(`🏔️  Création de carte topographique: ${areaName}`);
    
    return this.createAutoMap({
      title: `Carte Topographique - ${areaName}`,
      description: `Carte topographique de ${areaName}`,
      layers,
      standardId: "ign-2024",
      outputFormat: "pdf",
      outputPath: `/output/topo_${areaName.replace(/\s+/g, "_")}.pdf`,
      options: {
        includeLegend: true,
        includeScaleBar: true,
        includeNorthArrow: true,
        includeGrid: true,
        includeCoordinates: true,
        templateId: "ign_standard",
        ...options,
      },
    });
  }
  
  /**
   * Crée une carte de PSG automatiquement
   */
  async createPSGMap(
    forestName: string,
    layers: string[],
    options: Partial<AutoMapOptions> = {}
  ): Promise<AutoMapResult> {
    console.log(`📋 Création de carte PSG: ${forestName}`);
    
    return this.createAutoMap({
      title: `PSG - ${forestName}`,
      description: `Plan Simple de Gestion pour ${forestName}`,
      layers,
      standardId: "psg-2023",
      outputFormat: "pdf",
      outputPath: `/output/psg_${forestName.replace(/\s+/g, "_")}.pdf`,
      options: {
        includeLegend: true,
        includeScaleBar: true,
        includeNorthArrow: true,
        includeGrid: false,
        includeCoordinates: false,
        templateId: "psg_standard",
        ...options,
      },
    });
  }
  
  /**
   * Crée une carte d'inventaire automatiquement
   */
  async createInventoryMap(
    inventoryName: string,
    layers: string[],
    options: Partial<AutoMapOptions> = {}
  ): Promise<AutoMapResult> {
    console.log(`📊 Création de carte d'inventaire: ${inventoryName}`);
    
    return this.createAutoMap({
      title: `Inventaire Forestier - ${inventoryName}`,
      description: `Carte d'inventaire forestier pour ${inventoryName}`,
      layers,
      standardId: "ifn-2024",
      outputFormat: "pdf",
      outputPath: `/output/inventory_${inventoryName.replace(/\s+/g, "_")}.pdf`,
      options: {
        includeLegend: true,
        includeScaleBar: true,
        includeNorthArrow: true,
        includeGrid: true,
        includeCoordinates: false,
        templateId: "minimal",
        ...options,
      },
    });
  }
  
  /**
   * Crée une série de cartes automatiquement
   */
  async createMapSeries(
    requests: AutoMapCreationRequest[]
  ): Promise<AutoMapResult[]> {
    console.log(`📚 Création de série de cartes: ${requests.length} carte(s)`);
    
    const results: AutoMapResult[] = [];
    
    for (const request of requests) {
      const result = await this.createAutoMap(request);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`   📊 Résultat: ${successCount}/${requests.length} carte(s) créée(s)`);
    
    return results;
  }
  
  /**
   * Crée un atlas de cartes automatiquement
   */
  async createAtlas(
    baseRequest: AutoMapCreationRequest,
    coverageLayerId: string,
    outputDirectory: string
  ): Promise<AutoMapResult[]> {
    console.log(`🗺️  Création d'atlas`);
    console.log(`   Couche de couverture: ${coverageLayerId}`);
    console.log(`   Répertoire de sortie: ${outputDirectory}`);
    
    // Simulation - à implémenter avec la vraie fonctionnalité d'atlas
    const results: AutoMapResult[] = [];
    
    for (let i = 0; i < 5; i++) {
      const result = await this.createAutoMap({
        ...baseRequest,
        title: `${baseRequest.title} - Page ${i + 1}`,
        outputPath: `${outputDirectory}/atlas_${i + 1}.pdf`,
      });
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`   ✅ Atlas créé: ${successCount} pages`);
    
    return results;
  }
}

/**
 * Helper pour créer un créateur de cartes automatiques
 */
export function createAutoMapCreator(): AutoMapCreator {
  return new AutoMapCreator();
}
