/**
 * PDF Export and Print Manager
 * 
 * Gestionnaire d'export PDF et impression
 * Fonctions avancées pour l'export et l'impression de cartes
 */

import { QGISLayoutManager } from "./qgis-layout-manager";
import { FileManager } from "./file-manager";
import { runScriptDetailed } from "./qgis";

export interface ExportOptions {
  format: "pdf" | "png" | "svg" | "jpg" | "tiff";
  resolution: number; // DPI
  quality: number; // 1-100 pour JPEG
  colorMode: "rgb" | "cmyk";
  compression: boolean;
  metadata: boolean;
  georef: boolean;
  geotiff: boolean;
}

export interface PrintOptions {
  printerName?: string;
  copies: number;
  color: boolean;
  duplex: "simplex" | "duplex_long" | "duplex_short";
  paperSize?: string;
}

export interface ExportResult {
  success: boolean;
  filePath: string;
  size: number;
  pages: number;
  duration: number;
  error?: string;
}

export interface PrintResult {
  success: boolean;
  printerName: string;
  copies: number;
  duration: number;
  error?: string;
}

/**
 * Gestionnaire d'export et impression
 */
export class ExportPrintManager {
  private layoutManager: QGISLayoutManager;
  private fileManager: FileManager;
  
  constructor() {
    this.layoutManager = new QGISLayoutManager();
    this.fileManager = new FileManager();
  }
  
  /**
   * Exporte une carte en PDF
   */
  async exportToPDF(
    layoutName: string,
    outputPath: string,
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    console.log(`📄 Export PDF: ${layoutName} -> ${outputPath}`);
    
    const exportOptions = {
      format: "pdf" as const,
      resolution: options.resolution || 300,
      quality: options.quality || 90,
      colorMode: options.colorMode || "rgb",
      compression: options.compression !== false,
      metadata: options.metadata !== false,
      georef: options.georef || false,
      geotiff: false,
    };
    
    return this.exportLayout(layoutName, outputPath, exportOptions);
  }
  
  /**
   * Exporte une carte en image
   */
  async exportToImage(
    layoutName: string,
    outputPath: string,
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    console.log(`🖼️  Export image: ${layoutName} -> ${outputPath}`);
    
    const exportOptions = {
      format: options.format || "png" as "pdf" | "png" | "svg" | "jpg" | "tiff",
      resolution: options.resolution || 300,
      quality: options.quality || 90,
      colorMode: options.colorMode || "rgb",
      compression: options.compression !== false,
      metadata: options.metadata !== false,
      georef: options.georef || false,
      geotiff: options.geotiff || false,
    };
    
    return this.exportLayout(layoutName, outputPath, exportOptions);
  }
  
  /**
   * Exporte une carte en GeoTIFF
   */
  async exportToGeoTIFF(
    layoutName: string,
    outputPath: string,
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    console.log(`🗺️  Export GeoTIFF: ${layoutName} -> ${outputPath}`);
    
    const exportOptions = {
      format: "tiff" as const,
      resolution: options.resolution || 300,
      quality: options.quality || 90,
      colorMode: options.colorMode || "rgb",
      compression: options.compression !== false,
      metadata: options.metadata !== false,
      georef: true,
      geotiff: true,
    };
    
    return this.exportLayout(layoutName, outputPath, exportOptions);
  }
  
  /**
   * Exporte une mise en page
   */
  private async exportLayout(
    layoutName: string,
    outputPath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      // Vérifier que le layout existe
      const layouts = await this.layoutManager.listLayouts();
      if (!layouts.layouts.includes(layoutName)) {
        throw new Error(`Layout non trouvé: ${layoutName}`);
      }
      
      // Créer le répertoire de destination si nécessaire
      const dirPath = outputPath.substring(0, outputPath.lastIndexOf("/"));
      await this.fileManager.createDirectory(dirPath);
      
      // Exporter via le layout manager
      const result = await this.layoutManager.exportLayout(layoutName, outputPath, {
        format: options.format,
        resolution: options.resolution,
        quality: options.quality,
        exportMetadata: options.metadata,
      });
      
      if (!result.success) {
        throw new Error(result.error || "Échec de l'export");
      }
      
      // Obtenir la taille du fichier
      const size = await this.getFileSize(outputPath);
      
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Export réussi: ${size} octets en ${duration}ms`);
      
      return {
        success: true,
        filePath: outputPath,
        size,
        pages: 1,
        duration,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`   ❌ Erreur d'export: ${errorMessage}`);
      
      return {
        success: false,
        filePath: outputPath,
        size: 0,
        pages: 0,
        duration,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Imprime une carte
   */
  async printLayout(
    layoutName: string,
    options: Partial<PrintOptions> = {}
  ): Promise<PrintResult> {
    console.log(`🖨️  Impression: ${layoutName}`);
    
    const startTime = Date.now();
    
    try {
      const printOptions: PrintOptions = {
        copies: options.copies || 1,
        color: options.color !== false,
        duplex: options.duplex || "simplex",
        printerName: options.printerName,
        paperSize: options.paperSize,
      };
      
      const result = await this.layoutManager.printLayout(layoutName, printOptions.printerName);
      
      if (!result.success) {
        throw new Error(result.error || "Échec de l'impression");
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Impression lancée (${printOptions.copies} exemplaire(s)) en ${duration}ms`);
      
      return {
        success: true,
        printerName: printOptions.printerName || "default",
        copies: printOptions.copies,
        duration,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`   ❌ Erreur d'impression: ${errorMessage}`);
      
      return {
        success: false,
        printerName: options.printerName || "default",
        copies: 0,
        duration,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Liste les imprimantes disponibles
   */
  async listPrinters(): Promise<{ success: boolean; printers: string[]; error?: string }> {
    console.log(`🖨️  Liste des imprimantes`);
    
    const script = `
from qgis.core import QgsApplication

printers = []
for printer in QgsApplication.printerList():
    printers.append(printer)

for printer in printers:
    print(f"Imprimante: {printer}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      console.error(`   ❌ Erreur de récupération des imprimantes: ${result.message}`);
      return { success: false, printers: [], error: result.message };
    }
    
    // Parser les imprimantes depuis le message
    const printerLines = result.message?.split("\n").filter((line: string) => line.startsWith("Imprimante:")) || [];
    const printers = printerLines.map((line: string) => line.replace("Imprimante: ", "").trim());
    
    console.log(`   ✅ ${printers.length} imprimante(s) trouvée(s)`);
    
    return { success: true, printers };
  }
  
  /**
   * Exporte en lot plusieurs mises en page
   */
  async exportBatch(
    layouts: Array<{ layoutName: string; outputPath: string }>,
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult[]> {
    console.log(`📦 Export en lot: ${layouts.length} mise(s) en page`);
    
    const results: ExportResult[] = [];
    
    for (const { layoutName, outputPath } of layouts) {
      const result = await this.exportToPDF(layoutName, outputPath, options);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`   📊 Résultat: ${successCount}/${results.length} export(s) réussi(s)`);
    
    return results;
  }
  
  /**
   * Crée un atlas de cartes
   */
  async createAtlas(
    layoutName: string,
    coverageLayer: string,
    outputDirectory: string,
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult[]> {
    console.log(`🗺️  Création d'atlas: ${layoutName}`);
    console.log(`   Couche de couverture: ${coverageLayer}`);
    console.log(`   Répertoire de sortie: ${outputDirectory}`);
    
    const startTime = Date.now();
    
    const script = `
from qgis.core import QgsProject, QgsPrintLayout, QgsLayoutItemMap
from qgis.core import QgsLayoutItemPage, QgsLayoutExporter
from qgis.PyQt.QtCore import QRectF

project = QgsProject.instance()
layout = project.layoutManager().layoutByName('${layoutName}')

if not layout:
    raise Exception(f"Layout non trouvé: ${layoutName}")

# Créer l'atlas
from qgis.core import QgsPrintLayoutAtlas
atlas = QgsLayoutAtlas(layout)

# Définir la couche de couverture
coverage_layer = project.mapLayersByName('${coverageLayer}')[0]
atlas.setCoverageLayer(coverage_layer)

# Configurer les pages
atlas.setPageNameExpression('"Atlas " || @atlas_featurenumber')
atlas.setFilterExpression(None)
atlas.setSortExpression(None)

# Exporter chaque page
exporter = QgsLayoutExporter(layout)
settings = exporter.PdfExportSettings()
settings.resolution = ${options.resolution || 300}

atlas.beginRender()
features = atlas.features()

for i in range(len(features)):
    atlas.refresh()
    output_path = '${outputDirectory}/atlas_' + str(i + 1) + '.pdf'
    exporter.exportToPdf(output_path, settings)
    print(f"Page exportée: {output_path}")

atlas.endRender()

print(f"Atlas créé: {len(features)} pages")
`;
    
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      console.error(`   ❌ Erreur de création de l'atlas: ${result.message}`);
      return [{
        success: false,
        filePath: "",
        size: 0,
        pages: 0,
        duration,
        error: result.message,
      }];
    }
    
    // Parser les résultats depuis le message
    const pageLines = result.message?.split("\n").filter((line: string) => line.startsWith("Page exportée:")) || [];
    const pageCount = parseInt(result.message?.match(/Atlas créé: (\d+) pages/)?.[1] || "0");
    
    const results: ExportResult[] = pageLines.map((line: string) => {
      const filePath = line.replace("Page exportée: ", "").trim();
      return {
        success: true,
        filePath,
        size: 0, // La taille n'est pas retournée par le script
        pages: 1,
        duration: duration / pageCount,
      };
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`   ✅ Atlas créé: ${successCount} pages`);
    
    return results;
  }
  
  /**
   * Obtient la taille d'un fichier
   */
  private async getFileSize(path: string): Promise<number> {
    try {
      const metadata = await this.fileManager.getFileMetadata(path);
      return metadata.size;
    } catch {
      return 0;
    }
  }
}

/**
 * Helper pour créer un gestionnaire d'export
 */
export function createExportPrintManager(): ExportPrintManager {
  return new ExportPrintManager();
}
