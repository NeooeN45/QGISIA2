/**
 * QGIS Layout/Composer Functions
 * 
 * Fonctions de mise en page QGIS avancées
 * Gère les opérations sur les mises en page QGIS (Layout/Composer)
 */

import { runScriptDetailed } from "./qgis";

export interface LayoutItem {
  id: string;
  type: "map" | "legend" | "scalebar" | "northarrow" | "label" | "picture" | "shape";
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, any>;
}

export interface LayoutExportOptions {
  format: "pdf" | "png" | "svg" | "jpg" | "tiff";
  resolution: number; // DPI
  quality: number; // 1-100
  exportMetadata: boolean;
}

export interface LayoutExportResult {
  success: boolean;
  filePath: string;
  size: number;
  duration: number;
  error?: string;
}

/**
 * Gestionnaire de mise en page QGIS
 */
export class QGISLayoutManager {
  /**
   * Crée une nouvelle mise en page
   */
  async createLayout(name: string, pageSize: string = "A4"): Promise<{ success: boolean; layoutId?: string; error?: string }> {
    console.log(`🗺️  Création de mise en page: ${name}`);
    
    const script = `
from qgis.core import QgsProject, QgsPrintLayout, QgsLayoutItemPage
from qgis.PyQt.QtCore import QSizeF

project = QgsProject.instance()
layout = QgsPrintLayout(project)
layout.initializeDefaults()

# Configurer la page
page = QgsLayoutItemPage(layout)
page.setPageSize('${pageSize}')
layout.pageCollection().addPage(page)

layout.setName('${name}')
project.layoutManager().addLayout(layout)

print(f"Layout créé: {layout.name()}")
print(f"Layout ID: {layout.id()}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        error: result.message || "Échec de la création de la mise en page",
      };
    }
    
    // Parser l'ID du layout depuis le résultat
    const layoutId = result.message?.match(/Layout ID: ([^\\s]+)/)?.[1] || "unknown";
    
    console.log(`   ✅ Mise en page créée`);
    return { success: true, layoutId };
  }
  
  /**
   * Ajoute une carte à la mise en page
   */
  async addMapToLayout(
    layoutName: string,
    layerName: string,
    position: { x: number; y: number },
    size: { width: number; height: number }
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`📍 Ajout de carte: ${layerName} à ${layoutName}`);
    
    const script = `
from qgis.core import QgsProject, QgsLayoutItemMap
from qgis.PyQt.QtCore import QRectF

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: {layoutName}")

# Créer l'item carte
map_item = QgsLayoutItemMap(layout)
map_item.attemptMove(QRectF(${position.x}, ${position.y}, ${size.width}, ${size.height}))

# Définir la couche
layer = project.mapLayersByName('${layerName}')[0]
map_item.setLayers([layer])
map_item.setExtent(layer.extent())

layout.addItem(map_item)
map_item.refresh()

print(f"Carte ajoutée: {layerName}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        error: result.message || "Échec de l'ajout de la carte",
      };
    }
    
    console.log(`   ✅ Carte ajoutée`);
    return { success: true };
  }
  
  /**
   * Ajoute une légende à la mise en page
   */
  async addLegendToLayout(
    layoutName: string,
    position: { x: number; y: number },
    size: { width: number; height: number },
    title?: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`📋 Ajout de légende à ${layoutName}`);
    
    const script = `
from qgis.core import QgsProject, QgsLayoutItemLegend
from qgis.PyQt.QtCore import QRectF

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: {layoutName}")

# Créer l'item légende
legend_item = QgsLayoutItemLegend(layout)
legend_item.attemptMove(QRectF(${position.x}, ${position.y}, ${size.width}, ${size.height}))

${title ? `legend_item.setTitle('${title}')` : ""}

layout.addItem(legend_item)

print(f"Légende ajoutée")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        error: result.message || "Échec de l'ajout de la légende",
      };
    }
    
    console.log(`   ✅ Légende ajoutée`);
    return { success: true };
  }
  
  /**
   * Ajoute une échelle à la mise en page
   */
  async addScaleBarToLayout(
    layoutName: string,
    mapId: string,
    position: { x: number; y: number },
    size: { width: number; height: number }
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`📏 Ajout d'échelle à ${layoutName}`);
    
    const script = `
from qgis.core import QgsProject, QgsLayoutItemScaleBar
from qgis.PyQt.QtCore import QRectF

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: {layoutName}")

# Créer l'item échelle
scalebar_item = QgsLayoutItemScaleBar(layout)
scalebar_item.attemptMove(QRectF(${position.x}, ${position.y}, ${size.width}, ${size.height}))

# Lier à la carte
map_item = layout.itemById('${mapId}')
if map_item:
    scalebar_item.setLinkedMap(map_item)

layout.addItem(scalebar_item)

print(f"Échelle ajoutée")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        error: result.message || "Échec de l'ajout de l'échelle",
      };
    }
    
    console.log(`   ✅ Échelle ajoutée`);
    return { success: true };
  }
  
  /**
   * Ajoute une flèche du nord à la mise en page
   */
  async addNorthArrowToLayout(
    layoutName: string,
    position: { x: number; y: number },
    size: { width: number; height: number }
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`🧭 Ajout de flèche du nord à ${layoutName}`);
    
    const script = `
from qgis.core import QgsProject, QgsLayoutItemPicture
from qgis.PyQt.QtCore import QRectF

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: {layoutName}")

# Créer l'item image
northarrow_item = QgsLayoutItemPicture(layout)
northarrow_item.attemptMove(QRectF(${position.x}, ${position.y}, ${size.width}, ${size.height}))

# Charger l'image de la flèche du nord (chemin par défaut QGIS)
from qgis.core import QgsApplication
northarrow_path = QgsApplication.svgIconPath() + "/north_arrows/NorthArrow_01.svg"
northarrow_item.setPath(northarrow_path)

layout.addItem(northarrow_item)

print(f"Flèche du nord ajoutée")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        error: result.message || "Échec de l'ajout de la flèche du nord",
      };
    }
    
    console.log(`   ✅ Flèche du nord ajoutée`);
    return { success: true };
  }
  
  /**
   * Ajoute un label à la mise en page
   */
  async addLabelToLayout(
    layoutName: string,
    text: string,
    position: { x: number; y: number },
    size: { width: number; height: number },
    fontSize: number = 12,
    bold: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`📝 Ajout de label à ${layoutName}`);
    
    const script = `
from qgis.core import QgsProject, QgsLayoutItemLabel
from qgis.PyQt.QtCore import QRectF
from qgis.PyQt.QtGui import QColor, QFont

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: {layoutName}")

# Créer l'item label
label_item = QgsLayoutItemLabel(layout)
label_item.attemptMove(QRectF(${position.x}, ${position.y}, ${size.width}, ${size.height}))
label_item.setText('${text}')

# Configurer le style
font = QFont()
font.setPointSize(${fontSize})
${bold ? "font.setBold(True)" : ""}
label_item.setFont(font)
label_item.setFontColor(QColor("#000000"))

layout.addItem(label_item)

print(f"Label ajouté: ${text}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        error: result.message || "Échec de l'ajout du label",
      };
    }
    
    console.log(`   ✅ Label ajouté`);
    return { success: true };
  }
  
  /**
   * Exporte la mise en page
   */
  async exportLayout(
    layoutName: string,
    outputPath: string,
    options: LayoutExportOptions
  ): Promise<LayoutExportResult> {
    console.log(`📤 Export de mise en page: ${layoutName}`);
    console.log(`   Format: ${options.format}`);
    console.log(`   Résolution: ${options.resolution} DPI`);
    
    const startTime = Date.now();
    
    let script = `
from qgis.core import QgsProject
from qgis.PyQt.QtCore import QSize

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: {layoutName}")

`;
    
    // Export selon le format
    switch (options.format) {
      case "pdf":
        script += `
from qgis.core import QgsLayoutExporter

exporter = QgsLayoutExporter(layout)
settings = exporter.PdfExportSettings()
settings.resolution = ${options.resolution}
settings.writeMetadata = ${options.exportMetadata}

exporter.exportToPdf('${outputPath}', settings)
print(f"Export PDF: {outputPath}")
`;
        break;
      
      case "png":
        script += `
from qgis.core import QgsLayoutExporter

exporter = QgsLayoutExporter(layout)
settings = exporter.ImageExportSettings()
settings.resolution = ${options.resolution}

exporter.exportToImage('${outputPath}', settings)
print(f"Export PNG: {outputPath}")
`;
        break;
      
      case "svg":
        script += `
from qgis.core import QgsLayoutExporter

exporter = QgsLayoutExporter(layout)
settings = exporter.SvgExportSettings()
settings.writeMetadata = ${options.exportMetadata}

exporter.exportToSvg('${outputPath}', settings)
print(f"Export SVG: {outputPath}")
`;
        break;
      
      case "jpg":
        script += `
from qgis.core import QgsLayoutExporter

exporter = QgsLayoutExporter(layout)
settings = exporter.ImageExportSettings()
settings.resolution = ${options.resolution}
settings.quality = ${options.quality}

exporter.exportToImage('${outputPath}', settings)
print(f"Export JPG: {outputPath}")
`;
        break;
      
      case "tiff":
        script += `
from qgis.core import QgsLayoutExporter

exporter = QgsLayoutExporter(layout)
settings = exporter.ImageExportSettings()
settings.resolution = ${options.resolution}
settings.quality = ${options.quality}

exporter.exportToImage('${outputPath}', settings)
print(f"Export TIFF: {outputPath}")
`;
        break;
    }
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        filePath: outputPath,
        size: 0,
        duration,
        error: result.message || "Échec de l'export",
      };
    }
    
    console.log(`   ✅ Export réussi en ${duration}ms`);
    
    return {
      success: true,
      filePath: outputPath,
      size: 0, // À implémenter avec une vraie vérification de taille
      duration,
    };
  }
  
  /**
   * Liste toutes les mises en page
   */
  async listLayouts(): Promise<{ success: boolean; layouts: string[]; error?: string }> {
    console.log(`📋 Liste des mises en page`);
    
    const script = `
from qgis.core import QgsProject

project = QgsProject.instance()
layouts = project.layoutManager().layouts()

for layout in layouts:
    print(f"Layout: {layout.name()} (ID: {layout.id()})")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        layouts: [],
        error: result.message || "Échec de la liste des mises en page",
      };
    }
    
    // Parser les noms de layouts depuis le résultat
    const layoutNames = (result.message || "")
      .split("Layout: ")
      .slice(1)
      .map(line => line.split(" (ID:")[0])
      .filter(name => name.length > 0);
    
    console.log(`   ✅ ${layoutNames.length} mise(s) en page trouvée(s)`);
    
    return { success: true, layouts: layoutNames };
  }
  
  /**
   * Supprime une mise en page
   */
  async deleteLayout(layoutName: string): Promise<{ success: boolean; error?: string }> {
    console.log(`🗑️  Suppression de mise en page: ${layoutName}`);
    
    const script = `
from qgis.core import QgsProject

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: {layoutName}")

project.layoutManager().removeLayout(layout)
print(f"Layout supprimé: {layoutName}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        error: result.message || "Échec de la suppression",
      };
    }
    
    console.log(`   ✅ Mise en page supprimée`);
    return { success: true };
  }
  
  /**
   * Imprime la mise en page
   */
  async printLayout(
    layoutName: string,
    printerName?: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`🖨️  Impression de mise en page: ${layoutName}`);
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsLayoutExporter

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: {layoutName}")

exporter = QgsLayoutExporter(layout)
${printerName ? `exporter.print('${printerName}')` : `exporter.print()`}

print(f"Layout imprimé: {layoutName}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        error: result.message || "Échec de l'impression",
      };
    }
    
    console.log(`   ✅ Impression lancée`);
    return { success: true };
  }
}

/**
 * Helper pour créer un gestionnaire de mise en page
 */
export function createQGISLayoutManager(): QGISLayoutManager {
  return new QGISLayoutManager();
}
