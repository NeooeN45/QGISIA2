/**
 * Download and Archive Extraction Manager
 * 
 * Système de téléchargement et extraction d'archives
 * Gère le téléchargement de fichiers et l'extraction d'archives (ZIP, etc.)
 */

import { FileManager } from "./file-manager";
import { ErrorManager, RetryConfig } from "./error-manager";

export interface DownloadOptions {
  destinationPath: string;
  overwrite?: boolean;
  progressCallback?: (progress: DownloadProgress) => void;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface DownloadProgress {
  url: string;
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  eta: number; // estimated time remaining in seconds
}

export interface DownloadResult {
  success: boolean;
  url: string;
  localPath: string;
  size: number;
  duration: number;
  error?: string;
}

export interface ExtractionOptions {
  destinationPath: string;
  overwrite?: boolean;
  progressCallback?: (progress: ExtractionProgress) => void;
}

export interface ExtractionProgress {
  archivePath: string;
  extractedFiles: number;
  totalFiles: number;
  percentage: number;
  currentFile: string;
}

export interface ExtractionResult {
  success: boolean;
  archivePath: string;
  destinationPath: string;
  extractedFiles: string[];
  size: number;
  duration: number;
  error?: string;
}

/**
 * Gestionnaire de téléchargement et extraction
 */
export class DownloadManager {
  private fileManager: FileManager;
  private errorManager: ErrorManager;
  private activeDownloads: Map<string, AbortController>;
  
  constructor(fileManager?: FileManager) {
    this.fileManager = fileManager || new FileManager();
    this.errorManager = new ErrorManager();
    this.activeDownloads = new Map();
  }
  
  /**
   * Télécharge un fichier
   */
  async downloadFile(
    url: string,
    options: DownloadOptions
  ): Promise<DownloadResult> {
    const startTime = Date.now();
    console.log(`📥 Téléchargement: ${url}`);
    console.log(`   Destination: ${options.destinationPath}`);
    
    try {
      // Créer un AbortController pour annuler le téléchargement
      const abortController = new AbortController();
      this.activeDownloads.set(url, abortController);
      
      // Configurer la stratégie de retry
      const retryConfig: RetryConfig = {
        operation: async () => {
          // Simulation - à remplacer par l'implémentation réelle
          // Dans une implémentation réelle, on utiliserait fetch ou le bridge QGIS
          await this.simulateDownload(url, options);
          return { success: true };
        },
        strategy: this.errorManager.createStrategy({
          maxRetries: 3,
          backoffStrategy: "exponential",
          initialDelay: 1000,
          maxDelay: 30000,
        }),
        context: {
          operationName: "download",
          operationId: url,
          metadata: { url, destination: options.destinationPath },
          startTime,
        },
      };
      
      const retryResult = await this.errorManager.executeWithRetry(retryConfig);
      
      if (!retryResult.success) {
        throw new Error(retryResult.error?.message || "Échec du téléchargement");
      }
      
      const duration = Date.now() - startTime;
      const size = await this.getFileSize(options.destinationPath);
      
      console.log(`   ✅ Téléchargement réussi: ${size} octets en ${duration}ms`);
      
      return {
        success: true,
        url,
        localPath: options.destinationPath,
        size,
        duration,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`   ❌ Erreur de téléchargement: ${errorMessage}`);
      
      return {
        success: false,
        url,
        localPath: options.destinationPath,
        size: 0,
        duration,
        error: errorMessage,
      };
    } finally {
      this.activeDownloads.delete(url);
    }
  }
  
  /**
   * Annule un téléchargement en cours
   */
  cancelDownload(url: string): boolean {
    const abortController = this.activeDownloads.get(url);
    if (abortController) {
      abortController.abort();
      this.activeDownloads.delete(url);
      console.log(`🛑 Téléchargement annulé: ${url}`);
      return true;
    }
    return false;
  }
  
  /**
   * Extrait une archive
   */
  async extractArchive(
    archivePath: string,
    options: ExtractionOptions
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    console.log(`📦 Extraction: ${archivePath}`);
    console.log(`   Destination: ${options.destinationPath}`);
    
    try {
      // Vérifier que l'archive existe
      const exists = await this.fileManager.fileExists(archivePath);
      if (!exists) {
        throw new Error(`Archive non trouvée: ${archivePath}`);
      }
      
      // Créer le répertoire de destination
      await this.fileManager.createDirectory(options.destinationPath);
      
      // Simulation - à remplacer par l'implémentation réelle
      // Dans une implémentation réelle, on utiliserait le bridge QGIS
      // ou une bibliothèque JavaScript pour extraire les archives
      const extractedFiles = await this.simulateExtraction(archivePath, options);
      
      const duration = Date.now() - startTime;
      const size = await this.getArchiveSize(archivePath);
      
      console.log(`   ✅ Extraction réussie: ${extractedFiles.length} fichiers en ${duration}ms`);
      
      return {
        success: true,
        archivePath,
        destinationPath: options.destinationPath,
        extractedFiles,
        size,
        duration,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`   ❌ Erreur d'extraction: ${errorMessage}`);
      
      return {
        success: false,
        archivePath,
        destinationPath: options.destinationPath,
        extractedFiles: [],
        size: 0,
        duration,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Télécharge et extrait une archive
   */
  async downloadAndExtract(
    url: string,
    downloadOptions: DownloadOptions,
    extractOptions?: ExtractionOptions
  ): Promise<{
    downloadResult: DownloadResult;
    extractionResult?: ExtractionResult;
  }> {
    console.log(`🔄 Téléchargement et extraction: ${url}`);
    
    // Télécharger l'archive
    const downloadResult = await this.downloadFile(url, downloadOptions);
    
    if (!downloadResult.success) {
      return { downloadResult };
    }
    
    // Extraire si c'est une archive
    if (this.isArchive(downloadResult.localPath)) {
      const extractionOptions = extractOptions || {
        destinationPath: downloadOptions.destinationPath.replace(/\.[^.]+$/, ""),
      };
      
      const extractionResult = await this.extractArchive(
        downloadResult.localPath,
        extractionOptions
      );
      
      return { downloadResult, extractionResult };
    }
    
    return { downloadResult };
  }
  
  /**
   * Télécharge plusieurs fichiers en parallèle
   */
  async downloadMultiple(
    urls: string[],
    options: DownloadOptions,
    maxConcurrency: number = 3
  ): Promise<DownloadResult[]> {
    console.log(`📥 Téléchargement multiple: ${urls.length} fichiers`);
    
    const results: DownloadResult[] = [];
    const executing: Promise<DownloadResult>[] = [];
    
    for (const url of urls) {
      const destinationPath = this.generateDestinationPath(url, options.destinationPath);
      const downloadOptions = { ...options, destinationPath };
      
      const promise = this.downloadFile(url, downloadOptions);
      executing.push(promise);
      
      // Limiter la concurrence
      if (executing.length >= maxConcurrency) {
        const result = await Promise.race(executing);
        results.push(result);
        const index = executing.findIndex(p => p === promise);
        executing.splice(index, 1);
      }
    }
    
    // Attendre les téléchargements restants
    const remainingResults = await Promise.all(executing);
    results.push(...remainingResults);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Résultat: ${successCount}/${results.length} téléchargements réussis`);
    
    return results;
  }
  
  /**
   * Vérifie si un fichier est une archive
   */
  private isArchive(path: string): boolean {
    const extension = path.split(".").pop()?.toLowerCase();
    const archiveExtensions = ["zip", "tar", "gz", "rar", "7z"];
    return archiveExtensions.includes(extension || "");
  }
  
  /**
   * Génère un chemin de destination pour un téléchargement
   */
  private generateDestinationPath(url: string, basePath: string): string {
    const fileName = url.split("/").pop() || "download";
    return `${basePath}/${fileName}`;
  }
  
  /**
   * Simulation de téléchargement
   */
  private async simulateDownload(url: string, options: DownloadOptions): Promise<void> {
    // Simulation - à remplacer par l'implémentation réelle
    const size = Math.floor(Math.random() * 10000000) + 1000000; // 1-10 MB
    const duration = Math.floor(size / 100000); // 10-100ms
    
    if (options.progressCallback) {
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        options.progressCallback({
          url,
          downloadedBytes: (size / steps) * i,
          totalBytes: size,
          percentage: (i / steps) * 100,
          speed: size / duration,
          eta: duration * (1 - i / steps) / 1000,
        });
        await this.delay(duration / steps);
      }
    } else {
      await this.delay(duration);
    }
  }
  
  /**
   * Simulation d'extraction
   */
  private async simulateExtraction(
    archivePath: string,
    options: ExtractionOptions
  ): Promise<string[]> {
    // Simulation - à remplacer par l'implémentation réelle
    const fileCount = Math.floor(Math.random() * 20) + 5;
    const duration = 500;
    
    const files: string[] = [];
    for (let i = 0; i < fileCount; i++) {
      files.push(`file_${i + 1}.dat`);
    }
    
    if (options.progressCallback) {
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        options.progressCallback({
          archivePath,
          extractedFiles: Math.floor((fileCount / steps) * i),
          totalFiles: fileCount,
          percentage: (i / steps) * 100,
          currentFile: files[Math.min(i, files.length - 1)],
        });
        await this.delay(duration / steps);
      }
    } else {
      await this.delay(duration);
    }
    
    return files;
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
  
  /**
   * Obtient la taille d'une archive
   */
  private async getArchiveSize(path: string): Promise<number> {
    return this.getFileSize(path);
  }
  
  /**
   * Délai pour simulation
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Annule tous les téléchargements en cours
   */
  cancelAllDownloads(): void {
    console.log(`🛑 Annulation de tous les téléchargements`);
    for (const [url, controller] of this.activeDownloads) {
      controller.abort();
    }
    this.activeDownloads.clear();
  }
  
  /**
   * Retourne le nombre de téléchargements actifs
   */
  getActiveDownloadsCount(): number {
    return this.activeDownloads.size;
  }
}

/**
 * Helper pour créer un gestionnaire de téléchargement
 */
export function createDownloadManager(fileManager?: FileManager): DownloadManager {
  return new DownloadManager(fileManager);
}
