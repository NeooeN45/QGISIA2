/**
 * Forest Management Document Retriever
 * 
 * Système de récupération de documents d'aménagement forestier
 * Télécharge et analyse les documents d'aménagement officiels (PSG, aménagements, etc.)
 */

import { FileManager } from "./file-manager";
import { DownloadManager } from "./download-manager";
import { runScriptDetailed } from "./qgis";

export interface ForestDocument {
  id: string;
  forestName: string;
  documentType: "PSG" | "amenagement" | "plan_simple" | "charte_forestiere";
  year: number;
  source: string;
  downloadUrl: string;
  localPath: string;
  metadata: DocumentMetadata;
  parcelData: ParcelData[];
}

export interface DocumentMetadata {
  author: string;
  region: string;
  department: string;
  surfaceTotal: number;
  parcelCount: number;
  lastUpdated: Date;
  validityPeriod: { start: Date; end: Date };
}

export interface ParcelData {
  id: string;
  name: string;
  surface: number;
  essence: string;
  age: number;
  volume: number;
  ownership: string;
  managementRegime: string;
  coordinates: { x: number; y: number; crs: string }[];
  attributes: Record<string, any>;
}

export interface DocumentRetrievalOptions {
  forestName: string;
  department?: string;
  year?: number;
  documentType?: string;
  includeParcels: boolean;
}

/**
 * Récupérateur de documents d'aménagement forestier
 */
export class ForestDocumentRetriever {
  private fileManager: FileManager;
  private downloadManager: DownloadManager;
  private officialSources: Map<string, string>;
  
  constructor() {
    this.fileManager = new FileManager();
    this.downloadManager = new DownloadManager();
    this.initializeOfficialSources();
  }
  
  /**
   * Initialise les sources officielles
   */
  private initializeOfficialSources(): void {
    this.officialSources = new Map([
      ["ONF", "https://donnees.onf.fr/"],
      ["IGN", "https://geoservices.ign.fr/"],
      ["GEOFONCIER", "https://www.geofoncier.fr/"],
      ["BDFORET", "https://geobretagne.fr/"],
      ["CRPF", "https://www.crpf.fr/"],
    ]);
  }
  
  /**
   * Recherche un document d'aménagement
   */
  async searchDocument(options: DocumentRetrievalOptions): Promise<ForestDocument | null> {
    console.log(`🔍 Recherche document: ${options.forestName}`);
    
    // 1. Rechercher dans les sources officielles
    const searchResults = await this.searchOfficialSources(options);
    
    if (searchResults.length === 0) {
      console.log(`   ❌ Aucun document trouvé`);
      return null;
    }
    
    // 2. Sélectionner le meilleur document
    const bestDocument = this.selectBestDocument(searchResults, options);
    
    console.log(`   ✅ Document trouvé: ${bestDocument.id}`);
    return bestDocument;
  }
  
  /**
   * Recherche dans les sources officielles
   */
  private async searchOfficialSources(options: DocumentRetrievalOptions): Promise<ForestDocument[]> {
    const documents: ForestDocument[] = [];
    
    // Recherche ONF
    const onfDocument = await this.searchONF(options);
    if (onfDocument) documents.push(onfDocument);
    
    // Recherche IGN
    const ignDocument = await this.searchIGN(options);
    if (ignDocument) documents.push(ignDocument);
    
    // Recherche GEOFONCIER
    const geofoncierDocument = await this.searchGeofoncier(options);
    if (geofoncierDocument) documents.push(geofoncierDocument);
    
    return documents;
  }
  
  /**
   * Recherche dans la base ONF
   */
  private async searchONF(options: DocumentRetrievalOptions): Promise<ForestDocument | null> {
    console.log(`   🔍 Recherche ONF...`);
    
    // Simulation - à implémenter avec l'API réelle ONF
    const forestName = options.forestName.toLowerCase();
    
    // Base de données simulée
    const onfDatabase: Record<string, ForestDocument> = {
      "compiègne": {
        id: "onf_psg_compiègne_2024",
        forestName: "Forêt de Compiègne",
        documentType: "PSG",
        year: 2024,
        source: "ONF",
        downloadUrl: "https://donnees.onf.fr/psg/compiègne_2024.zip",
        localPath: "",
        metadata: {
          author: "ONF Picardie",
          region: "Hauts-de-France",
          department: "Oise",
          surfaceTotal: 14500,
          parcelCount: 234,
          lastUpdated: new Date("2024-03-15"),
          validityPeriod: { start: new Date("2024-01-01"), end: new Date("2034-01-01") },
        },
        parcelData: [],
      },
    };
    
    const document = onfDatabase[forestName];
    if (document) {
      console.log(`   ✅ Document ONF trouvé`);
      return document;
    }
    
    return null;
  }
  
  /**
   * Recherche dans la base IGN
   */
  private async searchIGN(options: DocumentRetrievalOptions): Promise<ForestDocument | null> {
    console.log(`   🔍 Recherche IGN...`);
    
    // Simulation - à implémenter avec l'API réelle IGN
    return null;
  }
  
  /**
   * Recherche dans GEOFONCIER
   */
  private async searchGeofoncier(options: DocumentRetrievalOptions): Promise<ForestDocument | null> {
    console.log(`   🔍 Recherche GEOFONCIER...`);
    
    // Simulation - à implémenter avec l'API réelle GEOFONCIER
    return null;
  }
  
  /**
   * Sélectionne le meilleur document
   */
  private selectBestDocument(documents: ForestDocument[], options: DocumentRetrievalOptions): ForestDocument {
    // Score chaque document selon les critères
    const scored = documents.map(doc => ({
      document: doc,
      score: this.scoreDocument(doc, options),
    }));
    
    // Retourne le document avec le meilleur score
    scored.sort((a, b) => b.score - a.score);
    return scored[0].document;
  }
  
  /**
   * Score un document selon les critères
   */
  private scoreDocument(document: ForestDocument, options: DocumentRetrievalOptions): number {
    let score = 0;
    
    // Correspondance du nom de forêt
    if (document.forestName.toLowerCase().includes(options.forestName.toLowerCase())) {
      score += 50;
    }
    
    // Correspondance de l'année
    if (options.year && document.year === options.year) {
      score += 30;
    } else if (!options.year && document.year >= 2020) {
      score += 20;
    }
    
    // Correspondance du type de document
    if (options.documentType && document.documentType.toLowerCase().includes(options.documentType.toLowerCase())) {
      score += 20;
    }
    
    // Fraîcheur du document
    const age = Date.now() - document.metadata.lastUpdated.getTime();
    if (age < 365 * 24 * 60 * 60 * 1000) { // Moins d'un an
      score += 15;
    } else if (age < 365 * 3 * 24 * 60 * 60 * 1000) { // Moins de 3 ans
      score += 10;
    }
    
    return score;
  }
  
  /**
   * Télécharge le document
   */
  async downloadDocument(document: ForestDocument): Promise<string> {
    console.log(`📥 Téléchargement document: ${document.id}`);
    
    try {
      const downloadPath = `/tmp/forest_documents/${document.id}.zip`;
      
      const downloadResult = await this.downloadManager.downloadFile(document.downloadUrl, {
        destinationPath: downloadPath,
      });
      
      if (!downloadResult.success) {
        throw new Error(downloadResult.error || "Échec du téléchargement");
      }
      
      // Extraire l'archive
      const extractPath = `/tmp/forest_documents/${document.id}`;
      const extractResult = await this.downloadManager.extractArchive(downloadPath, {
        destinationPath: extractPath,
      });
      
      if (!extractResult.success) {
        throw new Error(extractResult.error || "Échec de l'extraction");
      }
      
      document.localPath = extractPath;
      
      console.log(`   ✅ Document téléchargé: ${extractPath}`);
      return extractPath;
      
    } catch (error) {
      console.log(`   ❌ Erreur de téléchargement: ${error}`);
      throw error;
    }
  }
  
  /**
   * Analyse le document pour extraire les données de parcelles
   */
  async analyzeDocument(document: ForestDocument): Promise<ParcelData[]> {
    console.log(`📊 Analyse document: ${document.id}`);
    
    if (!document.localPath) {
      throw new Error("Document non téléchargé");
    }
    
    // 1. Chercher le fichier de données de parcelles
    const parcelFile = await this.findParcelFile(document.localPath);
    
    if (!parcelFile) {
      console.log(`   ⚠️  Aucun fichier de parcelles trouvé`);
      return [];
    }
    
    // 2. Lire et analyser le fichier
    const parcelData = await this.parseParcelFile(parcelFile);
    
    document.parcelData = parcelData;
    
    console.log(`   ✅ ${parcelData.length} parcelles analysées`);
    return parcelData;
  }
  
  /**
   * Cherche le fichier de parcelles
   */
  private async findParcelFile(directory: string): Promise<string | null> {
    // Chercher les fichiers courants de parcelles
    const possibleNames = [
      "parcelles.shp",
      "parcelles.geojson",
      "parcelles.gpkg",
      "peuplements.shp",
      "peuplements.geojson",
      "parcelles.csv",
      "data_parcelles.xlsx",
    ];
    
    for (const name of possibleNames) {
      const path = `${directory}/${name}`;
      const exists = await this.fileManager.fileExists(path);
      if (exists) {
        return path;
      }
    }
    
    // Lister tous les fichiers du répertoire
    const listing = await this.fileManager.listDirectory(directory);
    
    // Chercher un fichier contenant "parcel" ou "peuplement"
    for (const file of listing.files) {
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes("parcel") || lowerName.includes("peuplement")) {
        return `${directory}/${file.name}`;
      }
    }
    
    return null;
  }
  
  /**
   * Parse le fichier de parcelles
   */
  private async parseParcelFile(filePath: string): Promise<ParcelData[]> {
    const extension = filePath.split(".").pop()?.toLowerCase();
    
    switch (extension) {
      case "geojson":
        return this.parseGeoJSON(filePath);
      case "shp":
        return this.parseShapefile(filePath);
      case "csv":
        return this.parseCSV(filePath);
      case "xlsx":
        return this.parseExcel(filePath);
      default:
        throw new Error(`Format non supporté: ${extension}`);
    }
  }
  
  /**
   * Parse GeoJSON via QGIS
   */
  private async parseGeoJSON(filePath: string): Promise<ParcelData[]> {
    console.log(`   📄 Parsing GeoJSON: ${filePath}`);
    
    const script = `
from qgis.core import QgsVectorLayer
import json

# Charger le fichier GeoJSON
layer = QgsVectorLayer("${filePath}", "geojson_layer", "ogr")

if not layer.isValid():
    print("error:Invalid GeoJSON file")
    exit(1)

# Extraire les features
parcels = []
for feature in layer.getFeatures():
    parcel = {
        "id": feature["id"] if "id" in feature else "",
        "name": feature["nom"] if "nom" in feature else feature["name"] if "name" in feature else "",
        "surface": float(feature["surface"]) if "surface" in feature else 0.0,
        "essence": feature["essence"] if "essence" in feature else "",
        "age": int(feature["age"]) if "age" in feature else 0,
        "volume": float(feature["volume"]) if "volume" in feature else 0.0,
        "ownership": feature["proprietaire"] if "proprietaire" in feature else feature["owner"] if "owner" in feature else "",
        "managementRegime": feature["regime"] if "regime" in feature else "",
        "geometry": feature.geometry().asWkt(),
        "attributes": dict(feature.attributes())
    }
    parcels.append(parcel)

print(f"parcels_count:{len(parcels)}")
print(f"parcels_data:{str(parcels)[:2000]}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      console.error(`   ❌ Erreur de parsing GeoJSON: ${result.message}`);
      return [];
    }
    
    const parcelCount = parseInt(result.message?.match(/parcels_count:(\d+)/)?.[1] || "0");
    const parcelsData = result.message?.match(/parcels_data:(.*)/s)?.[1] || "[]";
    
    let parcels: ParcelData[] = [];
    try {
      const rawData = JSON.parse(parcelsData);
      if (Array.isArray(rawData)) {
        parcels = rawData.map((p: any) => ({
          id: p.id || "",
          name: p.name || "",
          surface: p.surface || 0,
          essence: p.essence || "",
          age: p.age || 0,
          volume: p.volume || 0,
          ownership: p.ownership || "",
          managementRegime: p.managementRegime || "",
          coordinates: this.extractCoordinates(p.geometry),
          attributes: p.attributes || {},
        }));
      }
    } catch (error) {
      console.warn(`   ⚠️  Erreur de parsing des données: ${error}`);
    }
    
    console.log(`   ✅ ${parcels.length} parcelle(s) parsée(s)`);
    return parcels;
  }
  
  /**
   * Parse Shapefile (simulation)
   */
  private async parseShapefile(filePath: string): Promise<ParcelData[]> {
    // À implémenter avec une bibliothèque comme shapefile-js
    console.log(`   ⚠️  Parsing Shapefile non implémenté`);
    return [];
  }
  
  /**
   * Parse CSV via QGIS
   */
  private async parseCSV(filePath: string): Promise<ParcelData[]> {
    console.log(`   📄 Parsing CSV: ${filePath}`);
    
    const script = `
from qgis.core import QgsVectorLayer
import csv

# Charger le fichier CSV
layer = QgsVectorLayer("${filePath}", "csv_layer", "ogr")

if not layer.isValid():
    print("error:Invalid CSV file")
    exit(1)

# Extraire les features
parcels = []
for feature in layer.getFeatures():
    parcel = {
        "id": feature["id"] if "id" in feature else "",
        "name": feature["nom"] if "nom" in feature else feature["name"] if "name" in feature else "",
        "surface": float(feature["surface"]) if "surface" in feature else 0.0,
        "essence": feature["essence"] if "essence" in feature else "",
        "age": int(feature["age"]) if "age" in feature else 0,
        "volume": float(feature["volume"]) if "volume" in feature else 0.0,
        "ownership": feature["proprietaire"] if "proprietaire" in feature else feature["owner"] if "owner" in feature else "",
        "managementRegime": feature["regime"] if "regime" in feature else "",
        "geometry": "",
        "attributes": dict(feature.attributes())
    }
    parcels.append(parcel)

print(f"parcels_count:{len(parcels)}")
print(f"parcels_data:{str(parcels)[:2000]}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      console.error(`   ❌ Erreur de parsing CSV: ${result.message}`);
      return [];
    }
    
    const parcelCount = parseInt(result.message?.match(/parcels_count:(\d+)/)?.[1] || "0");
    const parcelsData = result.message?.match(/parcels_data:(.*)/s)?.[1] || "[]";
    
    let parcels: ParcelData[] = [];
    try {
      const rawData = JSON.parse(parcelsData);
      if (Array.isArray(rawData)) {
        parcels = rawData.map((p: any) => ({
          id: p.id || "",
          name: p.name || "",
          surface: p.surface || 0,
          essence: p.essence || "",
          age: p.age || 0,
          volume: p.volume || 0,
          ownership: p.ownership || "",
          managementRegime: p.managementRegime || "",
          coordinates: [], // CSV n'a pas de géométrie
          attributes: p.attributes || {},
        }));
      }
    } catch (error) {
      console.warn(`   ⚠️  Erreur de parsing des données: ${error}`);
    }
    
    console.log(`   ✅ ${parcels.length} parcelle(s) parsée(s)`);
    return parcels;
  }
  
  /**
   * Parse Excel (simulation)
   */
  private async parseExcel(filePath: string): Promise<ParcelData[]> {
    // À implémenter avec une bibliothèque comme xlsx
    console.log(`   ⚠️  Parsing Excel non implémenté`);
    return [];
  }
  
  /**
   * Extrait les coordonnées d'une géométrie WKT
   */
  private extractCoordinates(geometry: any): { x: number; y: number; crs: string }[] {
    const coordinates: { x: number; y: number; crs: string }[] = [];
    
    if (!geometry || typeof geometry !== "string") {
      return coordinates;
    }
    
    try {
      // Parser WKT basique pour extraire les coordonnées
      // Format WKT: POINT(x y) ou LINESTRING(x y, x y) ou POLYGON((x y, x y))
      const coordPattern = /(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g;
      const matches = geometry.matchAll(coordPattern);
      
      for (const match of matches) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        if (!isNaN(x) && !isNaN(y)) {
          coordinates.push({ x, y, crs: "EPSG:2154" }); // Supposé Lambert 93 par défaut
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Erreur d'extraction des coordonnées: ${error}`);
    }
    
    return coordinates;
  }
  
  /**
   * Recherche des parcelles par critères
   */
  searchParcels(document: ForestDocument, criteria: Partial<ParcelData>): ParcelData[] {
    const parcels = document.parcelData || [];
    
    return parcels.filter(parcel => {
      let match = true;
      
      if (criteria.id && parcel.id !== criteria.id) match = false;
      if (criteria.name && !parcel.name.toLowerCase().includes(criteria.name.toLowerCase())) match = false;
      if (criteria.essence && !parcel.essence.toLowerCase().includes(criteria.essence.toLowerCase())) match = false;
      if (criteria.age && parcel.age !== criteria.age) match = false;
      if (criteria.volume && parcel.volume !== criteria.volume) match = false;
      if (criteria.ownership && !parcel.ownership.toLowerCase().includes(criteria.ownership.toLowerCase())) match = false;
      
      return match;
    });
  }
  
  /**
   * Retourne les parcelles dans une zone géographique
   */
  getParcelsInArea(document: ForestDocument, bounds: { xmin: number; ymin: number; xmax: number; ymax: number }): ParcelData[] {
    const parcels = document.parcelData || [];
    
    return parcels.filter(parcel => {
      // À implémenter avec une vérification géométrique réelle
      return true;
    });
  }
}

/**
 * Helper pour créer un récupérateur de documents forestiers
 */
export function createForestDocumentRetriever(): ForestDocumentRetriever {
  return new ForestDocumentRetriever();
}
