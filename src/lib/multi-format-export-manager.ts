/**
 * Multi-Format Export Manager
 * 
 * Système d'export vers d'autres formats
 * Exporte des couches QGIS vers KML, GeoJSON, Shapefile, etc.
 */

import { runScriptDetailed } from "./qgis";
import { FileManager } from "./file-manager";

export interface ExportFormat {
  name: string;
  extension: string;
  mimeType: string;
  description: string;
  supportsMultipleLayers: boolean;
  preservesAttributes: boolean;
  preservesStyle: boolean;
}

export interface ExportOptions {
  format: ExportFormat;
  outputPath: string;
  crs?: string;
  includeAttributes: boolean;
  includeStyle: boolean;
  compression?: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath: string;
  size: number;
  duration: number;
  format: string;
  error?: string;
}

/**
 * Gestionnaire d'export multi-format
 */
export class MultiFormatExportManager {
  private formats: Map<string, ExportFormat>;
  private fileManager: FileManager;
  
  constructor() {
    this.formats = new Map();
    this.fileManager = new FileManager();
    this.initializeFormats();
  }
  
  /**
   * Exporte une couche vers un format spécifié
   */
  async exportLayer(
    layerId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    console.log(`📤 Export de couche: ${layerId} vers ${options.format.name}`);
    
    const startTime = Date.now();
    
    try {
      let script = "";
      
      switch (options.format.name) {
        case "KML":
          script = this.generateKMLExportScript(layerId, options);
          break;
        case "GeoJSON":
          script = this.generateGeoJSONExportScript(layerId, options);
          break;
        case "Shapefile":
          script = this.generateShapefileExportScript(layerId, options);
          break;
        case "GPX":
          script = this.generateGPXExportScript(layerId, options);
          break;
        case "DXF":
          script = this.generateDXFExportScript(layerId, options);
          break;
        default:
          throw new Error(`Format non supporté: ${options.format.name}`);
      }
      
      const result = await runScriptDetailed(script);
      const duration = Date.now() - startTime;
      
      if (!result?.ok) {
        throw new Error(result.message || "Échec de l'export");
      }
      
      console.log(`   ✅ Export réussi en ${duration}ms`);
      
      // Obtenir la taille réelle du fichier
      let size = 0;
      try {
        const metadata = await this.fileManager.getFileMetadata(options.outputPath);
        size = metadata.size || 0;
      } catch (error) {
        console.warn(`   ⚠️  Impossible d'obtenir la taille du fichier`);
      }
      
      return {
        success: true,
        filePath: options.outputPath,
        size,
        duration,
        format: options.format.name,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`   ❌ Erreur d'export: ${errorMessage}`);
      
      return {
        success: false,
        filePath: options.outputPath,
        size: 0,
        duration,
        format: options.format.name,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Génère le script d'export KML
   */
  private generateKMLExportScript(layerId: string, options: ExportOptions): string {
    return `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

params = {
    'INPUT': '${layerId}',
    'OUTPUT': '${options.outputPath}',
    ${options.includeStyle ? "'STYLE': True," : ""}
    ${options.includeAttributes ? "'INCLUDE_ATTRIBUTES': True," : ""}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:kml", params, context, feedback)

print(f"KML exporté: {options.outputPath}")
`;
  }
  
  /**
   * Génère le script d'export GeoJSON
   */
  private generateGeoJSONExportScript(layerId: string, options: ExportOptions): string {
    return `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

params = {
    'INPUT': '${layerId}',
    'OUTPUT': '${options.outputPath}',
    ${options.includeAttributes ? "'INCLUDE_ATTRIBUTES': True," : ""}
    ${options.crs ? "'OUTPUT_CRS': '${options.crs}'," : ""}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:geojson", params, context, feedback)

print(f"GeoJSON exporté: {options.outputPath}")
`;
  }
  
  /**
   * Génère le script d'export Shapefile
   */
  private generateShapefileExportScript(layerId: string, options: ExportOptions): string {
    return `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

params = {
    'INPUT': '${layerId}',
    'OUTPUT': '${options.outputPath}',
    ${options.includeAttributes ? "'INCLUDE_ATTRIBUTES': True," : ""}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:exportvector", params, context, feedback)

print(f"Shapefile exporté: {options.outputPath}")
`;
  }
  
  /**
   * Génère le script d'export GPX
   */
  private generateGPXExportScript(layerId: string, options: ExportOptions): string {
    return `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

params = {
    'INPUT': '${layerId}',
    'OUTPUT': '${options.outputPath}',
    ${options.includeAttributes ? "'INCLUDE_ATTRIBUTES': True," : ""}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:gpx", params, context, feedback)

print(f"GPX exporté: {options.outputPath}")
`;
  }
  
  /**
   * Génère le script d'export DXF
   */
  private generateDXFExportScript(layerId: string, options: ExportOptions): string {
    return `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

params = {
    'INPUT': '${layerId}',
    'OUTPUT': '${options.outputPath}',
    ${options.crs ? "'OUTPUT_CRS': '${options.crs}'," : ""}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:dxf", params, context, feedback)

print(f"DXF exporté: ${options.outputPath}")
`;
  }
  
  /**
   * Exporte plusieurs couches
   */
  async exportMultipleLayers(
    layerIds: string[],
    format: ExportFormat,
    outputDirectory: string
  ): Promise<ExportResult[]> {
    console.log(`📦 Export multiple: ${layerIds.length} couches vers ${format.name}`);
    
    const results: ExportResult[] = [];
    
    for (const layerId of layerIds) {
      const outputPath = `${outputDirectory}/${layerId}.${format.extension}`;
      const result = await this.exportLayer(layerId, {
        format,
        outputPath,
        includeAttributes: true,
        includeStyle: false,
      });
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`   📊 Résultat: ${successCount}/${layerIds.length} export(s) réussi(s)`);
    
    return results;
  }
  
  /**
   * Initialise les formats supportés
   */
  private initializeFormats(): void {
    this.formats.set("KML", {
      name: "KML",
      extension: "kml",
      mimeType: "application/vnd.google-earth.kml+xml",
      description: "Keyhole Markup Language - Format Google Earth",
      supportsMultipleLayers: false,
      preservesAttributes: true,
      preservesStyle: true,
    });
    
    this.formats.set("GeoJSON", {
      name: "GeoJSON",
      extension: "geojson",
      mimeType: "application/geo+json",
      description: "GeoJSON - Format JSON pour données géospatiales",
      supportsMultipleLayers: false,
      preservesAttributes: true,
      preservesStyle: false,
    });
    
    this.formats.set("Shapefile", {
      name: "Shapefile",
      extension: "shp",
      mimeType: "application/x-shp",
      description: "ESRI Shapefile - Format standard SIG",
      supportsMultipleLayers: false,
      preservesAttributes: true,
      preservesStyle: false,
    });
    
    this.formats.set("GPX", {
      name: "GPX",
      extension: "gpx",
      mimeType: "application/gpx+xml",
      description: "GPX - Format GPS Exchange",
      supportsMultipleLayers: false,
      preservesAttributes: true,
      preservesStyle: false,
    });
    
    this.formats.set("DXF", {
      name: "DXF",
      extension: "dxf",
      mimeType: "application/dxf",
      description: "DXF - Drawing Exchange Format (AutoCAD)",
      supportsMultipleLayers: false,
      preservesAttributes: false,
      preservesStyle: false,
    });
    
    this.formats.set("CSV", {
      name: "CSV",
      extension: "csv",
      mimeType: "text/csv",
      description: "CSV - Comma Separated Values (attributs seulement)",
      supportsMultipleLayers: false,
      preservesAttributes: true,
      preservesStyle: false,
    });
  }
  
  /**
   * Retourne tous les formats supportés
   */
  getSupportedFormats(): ExportFormat[] {
    return Array.from(this.formats.values());
  }
  
  /**
   * Retourne un format par nom
   */
  getFormat(name: string): ExportFormat | undefined {
    return this.formats.get(name);
  }
  
  /**
   * Exporte vers CSV (attributs seulement)
   */
  async exportToCSV(
    layerId: string,
    outputPath: string,
    options: { includeGeometry?: boolean } = {}
  ): Promise<ExportResult> {
    console.log(`📄 Export CSV: ${layerId}`);
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

project = QgsProject.instance()

params = {
    'INPUT': '${layerId}',
    'OUTPUT': '${outputPath}',
    ${options.includeGeometry ? "'GEOMETRY': True," : ""}
}

feedback = QgsProcessingFeedback()
context = QgsProcessingContext()

result = processing.run("native:exportattributes", params, context, feedback)

print(f"CSV exporté: ${outputPath}")
`;
    
    const startTime = Date.now();
    const result = await runScriptDetailed(script);
    const duration = Date.now() - startTime;
    
    if (!result?.ok) {
      return {
        success: false,
        filePath: outputPath,
        size: 0,
        duration,
        format: "CSV",
        error: result.message || "Échec de l'export",
      };
    }
    
    return {
      success: true,
      filePath: outputPath,
      size: 0,
      duration,
      format: "CSV",
    };
  }
}

/**
 * Helper pour créer un gestionnaire d'export multi-format
 */
export function createMultiFormatExportManager(): MultiFormatExportManager {
  return new MultiFormatExportManager();
}
