/**
 * File Manager - Implementation Réelle
 * 
 * Gestion des fichiers via le bridge QGIS
 * Utilise les fonctions réelles du bridge QGIS
 */

import { pickQgisFile, runScriptDetailed, isQgisAvailable } from "./qgis";

export interface FileOperationResult {
  success: boolean;
  path: string;
  size?: number;
  error?: string;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  lastModified: number;
  encoding?: string;
}

export interface ReadOptions {
  encoding?: string;
}

export interface WriteOptions {
  encoding?: string;
  overwrite?: boolean;
}

export interface DirectoryListing {
  path: string;
  files: FileMetadata[];
  directories: string[];
}

/**
 * Gestionnaire de fichiers utilisant le bridge QGIS
 */
export class FileManager {
  private basePath: string;
  
  constructor(basePath: string = "") {
    this.basePath = basePath;
  }
  
  /**
   * Vérifie si le bridge QGIS est disponible
   */
  isAvailable(): boolean {
    return isQgisAvailable();
  }
  
  /**
   * Ouvre un sélecteur de fichier via QGIS
   */
  async selectFile(filter: string = "", title: string = "Choisir un fichier"): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error("Bridge QGIS non disponible");
    }
    
    const filePath = await pickQgisFile(filter, title);
    return filePath;
  }
  
  /**
   * Lit un fichier via QGIS
   */
  async readFile(
    path: string,
    options: ReadOptions = {}
  ): Promise<FileOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        path,
        error: "Bridge QGIS non disponible",
      };
    }
    
    const fullPath = this.resolvePath(path);
    const encoding = options.encoding || "utf-8";
    
    const script = `
import os

file_path = "${fullPath}"
encoding = "${encoding}"

try:
    with open(file_path, 'r', encoding=encoding) as f:
        content = f.read()
    print(f"file_content:{content}")
    print(f"file_size:{os.path.getsize(file_path)}")
except Exception as e:
    print(f"error:{str(e)}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        success: false,
        path: fullPath,
        error: result.message || "Erreur de lecture",
      };
    }
    
    const contentMatch = result.message?.match(/file_content:(.*)/s);
    const sizeMatch = result.message?.match(/file_size:(\d+)/);
    
    const content = contentMatch ? contentMatch[1] : "";
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
    
    return {
      success: true,
      path: fullPath,
      size,
      metadata: {
        name: path.split("/").pop() || "",
        extension: path.split(".").pop() || "",
        mimeType: this.getMimeType(path),
        size,
        lastModified: Date.now(),
        encoding,
      },
    };
  }
  
  /**
   * Écrit un fichier via QGIS
   */
  async writeFile(
    path: string,
    content: string,
    options: WriteOptions = {}
  ): Promise<FileOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        path,
        error: "Bridge QGIS non disponible",
      };
    }
    
    const fullPath = this.resolvePath(path);
    const encoding = options.encoding || "utf-8";
    const overwrite = options.overwrite !== false;
    
    const script = `
import os

file_path = "${fullPath}"
content = """${content}"""
encoding = "${encoding}"
overwrite = ${overwrite ? "True" : "False"}

try:
    if os.path.exists(file_path) and not overwrite:
        print("error:Le fichier existe déjà et overwrite=False")
    else:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding=encoding) as f:
            f.write(content)
        size = os.path.getsize(file_path)
        print(f"success:Écriture réussie")
        print(f"file_size:{size}")
except Exception as e:
    print(f"error:{str(e)}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      const errorMatch = result.message?.match(/error:(.*)/);
      return {
        success: false,
        path: fullPath,
        error: errorMatch ? errorMatch[1] : result.message || "Erreur d'écriture",
      };
    }
    
    const sizeMatch = result.message?.match(/file_size:(\d+)/);
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
    
    return {
      success: true,
      path: fullPath,
      size,
      metadata: {
        name: path.split("/").pop() || "",
        extension: path.split(".").pop() || "",
        mimeType: this.getMimeType(path),
        size,
        lastModified: Date.now(),
        encoding,
      },
    };
  }
  
  
  /**
   * Supprime un fichier via QGIS
   */
  async deleteFile(path: string): Promise<FileOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        path,
        error: "Bridge QGIS non disponible",
      };
    }
    
    const fullPath = this.resolvePath(path);
    
    const script = `
import os

file_path = "${fullPath}"

try:
    if os.path.exists(file_path):
        os.remove(file_path)
        print("success:Suppression réussie")
    else:
        print("error:Le fichier n'existe pas")
except Exception as e:
    print(f"error:{str(e)}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      const errorMatch = result.message?.match(/error:(.*)/);
      return {
        success: false,
        path: fullPath,
        error: errorMatch ? errorMatch[1] : result.message || "Erreur de suppression",
      };
    }
    
    return {
      success: true,
      path: fullPath,
    };
  }
  
  /**
   * Liste un répertoire via QGIS
   */
  async listDirectory(path: string): Promise<DirectoryListing> {
    if (!this.isAvailable()) {
      return {
        path,
        files: [],
        directories: [],
      };
    }
    
    const fullPath = this.resolvePath(path);
    
    const script = `
import os

path = "${fullPath}"

try:
    files = []
    directories = []
    
    if os.path.exists(path):
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            if os.path.isfile(item_path):
                stat = os.stat(item_path)
                files.append({
                    "name": item,
                    "extension": item.split(".")[-1] if "." in item else "",
                    "size": stat.st_size,
                    "lastModified": int(stat.st_mtime * 1000)
                })
            elif os.path.isdir(item_path):
                directories.append(item)
    
    print(f"files_count:{len(files)}")
    print(f"dirs_count:{len(directories)}")
    print(f"files_data:{str(files)[:2000]}")
    print(f"dirs_data:{str(directories)[:2000]}")
except Exception as e:
    print(f"error:{str(e)}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return {
        path: fullPath,
        files: [],
        directories: [],
      };
    }
    
    const filesCount = parseInt(result.message?.match(/files_count:(\d+)/)?.[1] || "0");
    const dirsCount = parseInt(result.message?.match(/dirs_count:(\d+)/)?.[1] || "0");
    
    const filesData = result.message?.match(/files_data:(.*)/s)?.[1] || "[]";
    const dirsData = result.message?.match(/dirs_data:(.*)/s)?.[1] || "[]";
    
    let files: FileMetadata[] = [];
    let directories: string[] = [];
    
    try {
      files = JSON.parse(filesData);
      directories = JSON.parse(dirsData);
    } catch {
    }
    
    return {
      path: fullPath,
      files: files.map(f => ({
        name: f.name,
        extension: f.extension,
        mimeType: this.getMimeType(f.name),
        size: f.size,
        lastModified: f.lastModified,
      })),
      directories,
    };
  }
  
  /**
   * Crée un répertoire via QGIS
   */
  async createDirectory(path: string): Promise<FileOperationResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        path,
        error: "Bridge QGIS non disponible",
      };
    }
    
    const fullPath = this.resolvePath(path);
    
    const script = `
import os

dir_path = "${fullPath}"

try:
    os.makedirs(dir_path, exist_ok=True)
    print("success:Répertoire créé")
except Exception as e:
    print(f"error:{str(e)}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      const errorMatch = result.message?.match(/error:(.*)/);
      return {
        success: false,
        path: fullPath,
        error: errorMatch ? errorMatch[1] : result.message || "Erreur de création",
      };
    }
    
    return {
      success: true,
      path: fullPath,
    };
  }
  
  /**
   * Vérifie si un fichier existe via QGIS
   */
  async fileExists(path: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    
    const fullPath = this.resolvePath(path);
    
    const script = `
import os

file_path = "${fullPath}"

try:
    exists = os.path.exists(file_path)
    print(f"exists:{exists}")
except Exception as e:
    print(f"error:{str(e)}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      return false;
    }
    
    const existsMatch = result.message?.match(/exists:(True|False)/);
    return existsMatch ? existsMatch[1] === "True" : false;
  }
  
  /**
   * Obtient les métadonnées d'un fichier via QGIS
   */
  async getFileMetadata(path: string): Promise<FileMetadata> {
    if (!this.isAvailable()) {
      throw new Error("Bridge QGIS non disponible");
    }
    
    const fullPath = this.resolvePath(path);
    
    const script = `
import os

file_path = "${fullPath}"

try:
    stat = os.stat(file_path)
    print(f"size:{stat.st_size}")
    print(f"modified:{int(stat.st_mtime * 1000)}")
except Exception as e:
    print(f"error:{str(e)}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      throw new Error(result.message || "Erreur de lecture des métadonnées");
    }
    
    const size = parseInt(result.message?.match(/size:(\d+)/)?.[1] || "0");
    const modified = parseInt(result.message?.match(/modified:(\d+)/)?.[1] || "0");
    
    return {
      name: path.split("/").pop() || "",
      extension: path.split(".").pop() || "",
      mimeType: this.getMimeType(path),
      size,
      lastModified: modified,
    };
  }
  
  /**
   * Résout le chemin complet
   */
  private resolvePath(path: string): string {
    if (this.basePath && !path.startsWith(this.basePath)) {
      return `${this.basePath}/${path.replace(/^\//, "")}`;
    }
    return path;
  }
  
  /**
   * Déduit le MIME type à partir de l'extension
   */
  private getMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    
    const mimeTypes: Record<string, string> = {
      txt: "text/plain",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
      css: "text/css",
      js: "text/javascript",
      ts: "text/typescript",
      md: "text/markdown",
      csv: "text/csv",
      pdf: "application/pdf",
      zip: "application/zip",
      shp: "application/x-shp",
      shx: "application/x-shx",
      dbf: "application/x-dbf",
      prj: "text/plain",
      gpkg: "application/geopackage+sqlite3",
      geojson: "application/geo+json",
      kml: "application/vnd.google-earth.kml+xml",
      kmz: "application/vnd.google-earth.kmz",
      tif: "image/tiff",
      tiff: "image/tiff",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      svg: "image/svg+xml",
    };
    
    return mimeTypes[ext] || "application/octet-stream";
  }
  
}

/**
 * Helper pour créer un gestionnaire de fichiers
 */
export function createFileManager(basePath?: string): FileManager {
  return new FileManager(basePath);
}
