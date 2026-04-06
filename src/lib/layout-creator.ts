/**
 * Layout Creation System
 * 
 * Système de création de mises en page complètes
 * Génère des mises en page QGIS professionnelles conformes aux normes
 */

import { CartographicStandard } from "./cartographic-standards";
import { runScriptDetailed } from "./qgis";

export interface LayoutElement {
  id: string;
  type: "map" | "legend" | "scalebar" | "northarrow" | "title" | "subtitle" | "text" | "image" | "table";
  position: Position;
  size: Size;
  properties: ElementProperties;
  locked?: boolean;
  visible?: boolean;
}

export interface Position {
  x: number; // en mm
  y: number; // en mm
  anchor: "topleft" | "topcenter" | "topright" | "centerleft" | "center" | "centerright" | "bottomleft" | "bottomcenter" | "bottomright";
}

export interface Size {
  width: number; // en mm
  height: number; // en mm
}

export interface ElementProperties {
  [key: string]: any;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  pageSize: PageSize;
  orientation: "portrait" | "landscape";
  margins: Margins;
  elements: LayoutElement[];
  standardId?: string;
}

export interface PageSize {
  size: string; // "A4", "A3", "A2", etc.
  width: number; // en mm
  height: number; // en mm
}

export interface Margins {
  top: number; // en mm
  right: number; // en mm
  bottom: number; // en mm
  left: number; // en mm
}

export interface LayoutCreationResult {
  success: boolean;
  layoutName: string;
  layoutId?: string;
  elements: LayoutElement[];
  error?: string;
}

/**
 * Créateur de mises en page
 */
export class LayoutCreator {
  private templates: Map<string, LayoutTemplate>;
  
  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }
  
  /**
   * Crée une mise en page complète
   */
  async createLayout(
    templateId: string,
    options: LayoutCreationOptions
  ): Promise<LayoutCreationResult> {
    console.log(`🗺️  Création de mise en page: ${templateId}`);
    
    try {
      // Récupérer le template
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template non trouvé: ${templateId}`);
      }
      
      // Personnaliser les éléments selon les options
      const elements = this.customizeElements(template.elements, options);
      
      // Générer le script PyQGIS
      const script = this.generateLayoutScript(template, elements, options);
      
      // Exécuter le script
      const result = await runScriptDetailed(script);
      
      if (!result?.ok) {
        throw new Error(result.message || "Échec de la création de la mise en page");
      }
      
      const layoutName = options.layoutName || `${template.name}_${Date.now()}`;
      
      console.log(`   ✅ Mise en page créée: ${layoutName}`);
      
      return {
        success: true,
        layoutName,
        layoutId: `layout_${Date.now()}`,
        elements,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Erreur de création: ${errorMessage}`);
      
      return {
        success: false,
        layoutName: "",
        elements: [],
        error: errorMessage,
      };
    }
  }
  
  /**
   * Personnalise les éléments selon les options
   */
  private customizeElements(
    elements: LayoutElement[],
    options: LayoutCreationOptions
  ): LayoutElement[] {
    const customized = elements.map(el => ({ ...el }));
    
    for (const element of customized) {
      // Personnaliser le titre
      if (element.type === "title" && options.title) {
        element.properties.text = options.title;
      }
      
      // Personnaliser le sous-titre
      if (element.type === "subtitle" && options.subtitle) {
        element.properties.text = options.subtitle;
      }
      
      // Personnaliser la légende
      if (element.type === "legend" && options.legendLayers) {
        element.properties.layers = options.legendLayers;
      }
      
      // Personnaliser la carte
      if (element.type === "map" && options.mapLayer) {
        element.properties.layer = options.mapLayer;
      }
    }
    
    return customized;
  }
  
  /**
   * Génère le script PyQGIS pour créer la mise en page
   */
  private generateLayoutScript(
    template: LayoutTemplate,
    elements: LayoutElement[],
    options: LayoutCreationOptions
  ): string {
    let script = `# Création de mise en page ${template.name}\n`;
    script += `# Template: ${template.id}\n\n`;
    
    script += `from qgis.core import (\n`;
    script += `    QgsProject, QgsPrintLayout, QgsLayoutItemMap,\n`;
    script += `    QgsLayoutItemLegend, QgsLayoutItemScaleBar,\n`;
    script += `    QgsLayoutItemPicture, QgsLayoutItemLabel,\n`;
    script += `    QgsReadWriteContext, QgsLayoutItemPage\n`;
    script += `)\n`;
    script += `from qgis.PyQt.QtCore import QRectF, QSizeF\n`;
    script += `from qgis.PyQt.QtGui import QColor\n\n`;
    
    const layoutName = options.layoutName || `${template.name}_${Date.now()}`;
    
    script += `# Créer le layout\n`;
    script += `project = QgsProject.instance()\n`;
    script += `layout = QgsPrintLayout(project)\n`;
    script += `layout.initializeDefaults()\n`;
    
    // Configurer la page
    script += `\n# Configurer la page\n`;
    script += `page = QgsLayoutItemPage(layout)\n`;
    script += `page.setPageSize('${template.pageSize.size}')\n`;
    script += `page.setOrientation(QgsLayoutItemPage.${template.orientation.toUpperCase()})\n`;
    script += `layout.pageCollection().addPage(page)\n`;
    
    // Ajouter les éléments
    for (const element of elements) {
      script += this.generateElementScript(element, template.margins);
    }
    
    // Ajouter le layout au projet
    script += `\n# Ajouter le layout au projet\n`;
    script += `project.layoutManager().addLayout(layout)\n`;
    script += `layout.setName('${layoutName}')\n`;
    script += `print(f"Layout créé: {layout.name()}")\n`;
    
    return script;
  }
  
  /**
   * Génère le script pour un élément
   */
  private generateElementScript(element: LayoutElement, margins: Margins): string {
    let script = `\n# ${element.type}: ${element.id}\n`;
    
    switch (element.type) {
      case "map":
        script += this.generateMapScript(element);
        break;
      case "legend":
        script += this.generateLegendScript(element);
        break;
      case "scalebar":
        script += this.generateScalebarScript(element);
        break;
      case "northarrow":
        script += this.generateNorthArrowScript(element);
        break;
      case "title":
      case "subtitle":
      case "text":
        script += this.generateTextScript(element);
        break;
      case "image":
        script += this.generateImageScript(element);
        break;
      default:
        script += `# Type non supporté: ${element.type}\n`;
    }
    
    return script;
  }
  
  /**
   * Génère le script pour une carte
   */
  private generateMapScript(element: LayoutElement): string {
    let script = `map_item = QgsLayoutItemMap(layout)\n`;
    script += `map_item.attemptMove(QRectF(${element.position.x}, ${element.position.y}, ${element.size.width}, ${element.size.height}))\n`;
    
    if (element.properties.layer) {
      script += `map_item.setLayers([QgsProject.instance().mapLayersByName('${element.properties.layer}')[0]])\n`;
    }
    
    if (element.properties.scale) {
      script += `map_item.setScale(${element.properties.scale})\n`;
    }
    
    script += `layout.addItem(map_item)\n`;
    script += `map_item.refresh()\n`;
    
    return script;
  }
  
  /**
   * Génère le script pour une légende
   */
  private generateLegendScript(element: LayoutElement): string {
    let script = `legend_item = QgsLayoutItemLegend(layout)\n`;
    script += `legend_item.attemptMove(QRectF(${element.position.x}, ${element.position.y}, ${element.size.width}, ${element.size.height}))\n`;
    
    if (element.properties.layers) {
      script += `legend_item.setLayers([QgsProject.instance().mapLayersByName(layer)[0] for layer in ${JSON.stringify(element.properties.layers)}])\n`;
    }
    
    if (element.properties.title) {
      script += `legend_item.setTitle('${element.properties.title}')\n`;
    }
    
    script += `layout.addItem(legend_item)\n`;
    
    return script;
  }
  
  /**
   * Génère le script pour une échelle
   */
  private generateScalebarScript(element: LayoutElement): string {
    let script = `scalebar_item = QgsLayoutItemScaleBar(layout)\n`;
    script += `scalebar_item.attemptMove(QRectF(${element.position.x}, ${element.position.y}, ${element.size.width}, ${element.size.height}))\n`;
    
    if (element.properties.mapId) {
      script += `scalebar_item.setLinkedMap(layout.itemById('${element.properties.mapId}'))\n`;
    }
    
    if (element.properties.units) {
      script += `scalebar_item.setUnits(${element.properties.units})\n`;
    }
    
    script += `layout.addItem(scalebar_item)\n`;
    
    return script;
  }
  
  /**
   * Génère le script pour une flèche du nord
   */
  private generateNorthArrowScript(element: LayoutElement): string {
    let script = `northarrow_item = QgsLayoutItemPicture(layout)\n`;
    script += `northarrow_item.attemptMove(QRectF(${element.position.x}, ${element.position.y}, ${element.size.width}, ${element.size.height}))\n`;
    
    if (element.properties.path) {
      script += `northarrow_item.setPath('${element.properties.path}')\n`;
    }
    
    script += `layout.addItem(northarrow_item)\n`;
    
    return script;
  }
  
  /**
   * Génère le script pour un texte
   */
  private generateTextScript(element: LayoutElement): string {
    let script = `text_item = QgsLayoutItemLabel(layout)\n`;
    script += `text_item.attemptMove(QRectF(${element.position.x}, ${element.position.y}, ${element.size.width}, ${element.size.height}))\n`;
    script += `text_item.setText('${element.properties.text || ""}')\n`;
    
    if (element.properties.fontSize) {
      script += `text_item.setFontSize(${element.properties.fontSize})\n`;
    }
    
    if (element.properties.color) {
      script += `text_item.setFontColor(QColor('${element.properties.color}'))\n`;
    }
    
    if (element.properties.bold) {
      script += `text_item.setBold(True)\n`;
    }
    
    script += `layout.addItem(text_item)\n`;
    
    return script;
  }
  
  /**
   * Génère le script pour une image
   */
  private generateImageScript(element: LayoutElement): string {
    let script = `image_item = QgsLayoutItemPicture(layout)\n`;
    script += `image_item.attemptMove(QRectF(${element.position.x}, ${element.position.y}, ${element.size.width}, ${element.size.height}))\n`;
    
    if (element.properties.path) {
      script += `image_item.setPath('${element.properties.path}')\n`;
    }
    
    script += `layout.addItem(image_item)\n`;
    
    return script;
  }
  
  /**
   * Initialise les templates de mise en page
   */
  private initializeTemplates(): void {
    // Template PSG standard
    this.templates.set("psg_standard", {
      id: "psg_standard",
      name: "PSG Standard",
      description: "Mise en page standard pour Plan Simple de Gestion",
      pageSize: { size: "A4", width: 210, height: 297 },
      orientation: "portrait",
      margins: { top: 15, right: 15, bottom: 15, left: 15 },
      standardId: "psg-2023",
      elements: [
        {
          id: "map",
          type: "map",
          position: { x: 15, y: 50, anchor: "topleft" },
          size: { width: 180, height: 180 },
          properties: { scale: 10000 },
        },
        {
          id: "legend",
          type: "legend",
          position: { x: 200, y: 50, anchor: "topleft" },
          size: { width: 85, height: 120 },
          properties: { title: "Légende" },
        },
        {
          id: "scalebar",
          type: "scalebar",
          position: { x: 15, y: 240, anchor: "topleft" },
          size: { width: 100, height: 15 },
          properties: { units: "meters" },
        },
        {
          id: "northarrow",
          type: "northarrow",
          position: { x: 270, y: 175, anchor: "topleft" },
          size: { width: 25, height: 25 },
          properties: {},
        },
        {
          id: "title",
          type: "title",
          position: { x: 15, y: 15, anchor: "topleft" },
          size: { width: 270, height: 20 },
          properties: { text: "Titre", fontSize: 18, bold: true, color: "#000000" },
        },
        {
          id: "subtitle",
          type: "subtitle",
          position: { x: 15, y: 35, anchor: "topleft" },
          size: { width: 270, height: 10 },
          properties: { text: "Sous-titre", fontSize: 12, color: "#333333" },
        },
        {
          id: "source",
          type: "text",
          position: { x: 15, y: 265, anchor: "topleft" },
          size: { width: 270, height: 8 },
          properties: { text: "Source: À compléter", fontSize: 8, color: "#666666" },
        },
      ],
    });
    
    // Template ONF standard
    this.templates.set("onf_standard", {
      id: "onf_standard",
      name: "ONF Standard",
      description: "Mise en page standard pour ONF",
      pageSize: { size: "A3", width: 297, height: 420 },
      orientation: "landscape",
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      standardId: "onf-2024",
      elements: [
        {
          id: "map",
          type: "map",
          position: { x: 20, y: 30, anchor: "topleft" },
          size: { width: 380, height: 250 },
          properties: { scale: 5000 },
        },
        {
          id: "legend",
          type: "legend",
          position: { x: 410, y: 30, anchor: "topleft" },
          size: { width: 100, height: 200 },
          properties: { title: "Légende ONF" },
        },
        {
          id: "scalebar",
          type: "scalebar",
          position: { x: 20, y: 290, anchor: "topleft" },
          size: { width: 150, height: 18 },
          properties: { units: "meters" },
        },
        {
          id: "northarrow",
          type: "northarrow",
          position: { x: 470, y: 235, anchor: "topleft" },
          size: { width: 40, height: 40 },
          properties: {},
        },
        {
          id: "title",
          type: "title",
          position: { x: 20, y: 10, anchor: "topleft" },
          size: { width: 490, height: 15 },
          properties: { text: "Titre", fontSize: 20, bold: true, color: "#000000" },
        },
        {
          id: "source",
          type: "text",
          position: { x: 20, y: 315, anchor: "topleft" },
          size: { width: 490, height: 10 },
          properties: { text: "Source: Office National des Forêts", fontSize: 9, color: "#666666" },
        },
      ],
    });
    
    // Template IGN standard
    this.templates.set("ign_standard", {
      id: "ign_standard",
      name: "IGN Standard",
      description: "Mise en page standard pour IGN",
      pageSize: { size: "A4", width: 210, height: 297 },
      orientation: "landscape",
      margins: { top: 15, right: 15, bottom: 15, left: 15 },
      standardId: "ign-2024",
      elements: [
        {
          id: "map",
          type: "map",
          position: { x: 20, y: 20, anchor: "topleft" },
          size: { width: 250, height: 170 },
          properties: { scale: 20000 },
        },
        {
          id: "legend",
          type: "legend",
          position: { x: 275, y: 20, anchor: "topleft" },
          size: { width: 60, height: 120 },
          properties: { title: "Légende" },
        },
        {
          id: "scalebar",
          type: "scalebar",
          position: { x: 20, y: 200, anchor: "topleft" },
          size: { width: 120, height: 12 },
          properties: { units: "meters" },
        },
        {
          id: "northarrow",
          type: "northarrow",
          position: { x: 275, y: 145, anchor: "topleft" },
          size: { width: 30, height: 30 },
          properties: {},
        },
        {
          id: "title",
          type: "title",
          position: { x: 20, y: 5, anchor: "topleft" },
          size: { width: 315, height: 12 },
          properties: { text: "Titre", fontSize: 16, bold: true, color: "#000000" },
        },
        {
          id: "source",
          type: "text",
          position: { x: 20, y: 220, anchor: "topleft" },
          size: { width: 315, height: 8 },
          properties: { text: "Source: IGN", fontSize: 8, color: "#666666" },
        },
      ],
    });
    
    // Template minimaliste
    this.templates.set("minimal", {
      id: "minimal",
      name: "Minimaliste",
      description: "Mise en page minimaliste",
      pageSize: { size: "A4", width: 210, height: 297 },
      orientation: "portrait",
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      elements: [
        {
          id: "map",
          type: "map",
          position: { x: 10, y: 30, anchor: "topleft" },
          size: { width: 190, height: 240 },
          properties: {},
        },
        {
          id: "title",
          type: "title",
          position: { x: 10, y: 10, anchor: "topleft" },
          size: { width: 190, height: 15 },
          properties: { text: "Titre", fontSize: 14, bold: true, color: "#000000" },
        },
      ],
    });
  }
  
  /**
   * Crée un template personnalisé
   */
  createCustomTemplate(template: LayoutTemplate): void {
    this.templates.set(template.id, template);
  }
  
  /**
   * Retourne tous les templates disponibles
   */
  getAvailableTemplates(): LayoutTemplate[] {
    return Array.from(this.templates.values());
  }
  
  /**
   * Retourne un template par ID
   */
  getTemplate(id: string): LayoutTemplate | undefined {
    return this.templates.get(id);
  }
  
  /**
   * Supprime un template
   */
  removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }
}

export interface LayoutCreationOptions {
  layoutName?: string;
  title?: string;
  subtitle?: string;
  mapLayer?: string;
  legendLayers?: string[];
  outputPath?: string;
}

/**
 * Helper pour créer un créateur de mise en page
 */
export function createLayoutCreator(): LayoutCreator {
  return new LayoutCreator();
}
