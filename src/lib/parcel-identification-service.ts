/**
 * Parcel Identification Service
 * 
 * Système d'identification de parcelles via flux de cartes
 * Identifie les parcelles forestières via WFS/WMS et autres flux géographiques
 */

import { runScriptDetailed } from "./qgis";

export interface ParcelIdentificationResult {
  success: boolean;
  parcels: IdentifiedParcel[];
  source: string;
  queryTime: number;
  error?: string;
}

export interface IdentifiedParcel {
  id: string;
  code: string;
  name: string;
  surface: number;
  essence: string;
  age: number;
  volume: number;
  ownership: string;
  geometry: any;
  attributes: Record<string, any>;
  confidence: number;
}

export interface IdentificationCriteria {
  forestName: string;
  parcelIds?: string[];
  parcelCodes?: string[];
  surfaceRange?: { min: number; max: number };
  essence?: string;
  ageRange?: { min: number; max: number };
  volumeRange?: { min: number; max: number };
  ownership?: string;
  bounds?: { xmin: number; ymin: number; xmax: number; ymax: number };
}

export interface MapServiceConfig {
  type: "WFS" | "WMS" | "WMTS" | "ArcGISREST" | "GeoJSON" | "PostGIS";
  url: string;
  layer?: string;
  version?: string;
  crs?: string;
  apiKey?: string;
  authentication?: { username: string; password: string };
}

/**
 * Service d'identification de parcelles
 */
export class ParcelIdentificationService {
  private mapServices: Map<string, MapServiceConfig>;
  private cache: Map<string, ParcelIdentificationResult>;
  
  constructor() {
    this.mapServices = new Map();
    this.cache = new Map();
    this.initializeMapServices();
  }
  
  /**
   * Initialise les services de cartes
   */
  private initializeMapServices(): void {
    // Service WFS IGN
    this.mapServices.set("IGN_WFS", {
      type: "WFS",
      url: "https://wxs.ign.fr/ortho/geoportail/wfs",
      layer: "FORET",
      version: "2.0.0",
      crs: "EPSG:2154",
    });
    
    // Service WFS ONF
    this.mapServices.set("ONF_WFS", {
      type: "WFS",
      url: "https://geoservices.onf.fr/wfs",
      layer: "PARCELLES_FORESTIERES",
      version: "2.0.0",
      crs: "EPSG:2154",
    });
    
    // Service GEOFONCIER
    this.mapServices.set("GEOFONCIER", {
      type: "WFS",
      url: "https://geoservices.geofoncier.fr/wfs",
      layer: "PARCELLES",
      version: "2.0.0",
      crs: "EPSG:2154",
    });
    
    // Service ArcGIS REST
    this.mapServices.set("ArcGIS_ONF", {
      type: "ArcGISREST",
      url: "https://services.arcgis.com/onf/arcgis/rest/services",
      layer: "Forets",
    });
  }
  
  /**
   * Identifie les parcelles selon les critères
   */
  async identifyParcels(criteria: IdentificationCriteria): Promise<ParcelIdentificationResult> {
    console.log(`🔍 Identification de parcelles: ${criteria.forestName}`);
    
    const startTime = Date.now();
    
    try {
      // 1. Générer une clé de cache
      const cacheKey = this.generateCacheKey(criteria);
      
      // 2. Vérifier le cache
      if (this.cache.has(cacheKey)) {
        console.log(`   ✅ Résultat trouvé dans le cache`);
        return this.cache.get(cacheKey)!;
      }
      
      // 3. Interroger les services de cartes
      const results = await this.queryMapServices(criteria);
      
      // 4. Fusionner et dédupliquer les résultats
      const merged = this.mergeResults(results);
      
      // 5. Filtrer selon les critères
      const filtered = this.filterResults(merged, criteria);
      
      // 6. Calculer les scores de confiance
      const scored = this.calculateConfidence(filtered, criteria);
      
      const queryTime = Date.now() - startTime;
      
      const result: ParcelIdentificationResult = {
        success: true,
        parcels: scored,
        source: "multiple",
        queryTime,
      };
      
      // Mettre en cache
      this.cache.set(cacheKey, result);
      
      console.log(`   ✅ ${scored.length} parcelle(s) identifiée(s) en ${queryTime}ms`);
      
      return result;
      
    } catch (error) {
      const queryTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`   ❌ Erreur d'identification: ${errorMessage}`);
      
      return {
        success: false,
        parcels: [],
        source: "error",
        queryTime,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Interroge les services de cartes
   */
  private async queryMapServices(criteria: IdentificationCriteria): Promise<ParcelIdentificationResult[]> {
    const results: ParcelIdentificationResult[] = [];
    
    // Interroger chaque service
    for (const [serviceName, config] of this.mapServices) {
      try {
        const result = await this.queryService(serviceName, config, criteria);
        if (result.success) {
          results.push(result);
        }
      } catch (error) {
        console.log(`   ⚠️  Erreur service ${serviceName}: ${error}`);
      }
    }
    
    return results;
  }
  
  /**
   * Interroge un service spécifique
   */
  private async queryService(
    serviceName: string,
    config: MapServiceConfig,
    criteria: IdentificationCriteria
  ): Promise<ParcelIdentificationResult> {
    console.log(`   🔍 Interrogation service: ${serviceName}`);
    
    const startTime = Date.now();
    
    try {
      let parcels: IdentifiedParcel[] = [];
      
      switch (config.type) {
        case "WFS":
          parcels = await this.queryWFS(config, criteria);
          break;
        case "WMS":
          parcels = await this.queryWMS(config, criteria);
          break;
        case "ArcGISREST":
          parcels = await this.queryArcGISREST(config, criteria);
          break;
        case "GeoJSON":
          parcels = await this.queryGeoJSON(config, criteria);
          break;
        case "PostGIS":
          parcels = await this.queryPostGIS(config, criteria);
          break;
        default:
          throw new Error(`Type de service non supporté: ${config.type}`);
      }
      
      const queryTime = Date.now() - startTime;
      
      return {
        success: true,
        parcels,
        source: serviceName,
        queryTime,
      };
      
    } catch (error) {
      const queryTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        parcels: [],
        source: serviceName,
        queryTime,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Interroge un service WFS
   */
  private async queryWFS(config: MapServiceConfig, criteria: IdentificationCriteria): Promise<IdentifiedParcel[]> {
    console.log(`      🔍 Query WFS: ${config.url}`);
    
    // Construire la requête WFS
    const filter = this.buildWFSFilter(criteria);
    
    const script = `
from qgis.core import QgsProject
from qgis.core import QgsVectorLayer
from qgis.core import QgsProcessingContext
from qgis.core import QgsProcessingFeedback
from qgis import processing

# Ajouter la couche WFS
wfs_url = "${config.url}?service=WFS&version=${config.version}&request=GetFeature&typeName=${config.layer}&outputFormat=geojson"
wfs_layer = QgsVectorLayer(wfs_url, "WFS_Layer", "ogr")

if not wfs_layer.isValid():
    raise Exception("Couche WFS invalide")

# Filtrer selon les critères
${filter ? `# Appliquer le filtre
# (À implémenter avec QgsExpression)` : ""}

# Extraire les parcelles
parcels = []
for feature in wfs_layer.getFeatures():
    parcel = {
        "id": feature["id"] if "id" in feature else "",
        "code": feature["code"] if "code" in feature else "",
        "name": feature["nom"] if "nom" in feature else feature["name"] if "name" in feature else "",
        "surface": float(feature["surface"]) if "surface" in feature else 0.0,
        "essence": feature["essence"] if "essence" in feature else "",
        "age": int(feature["age"]) if "age" in feature else 0,
        "volume": float(feature["volume"]) if "volume" in feature else 0.0,
        "ownership": feature["proprietaire"] if "proprietaire" in feature else feature["owner"] if "owner" in feature else "",
        "geometry": feature.geometry().asWkt(),
        "attributes": dict(feature.attributes())
    }
    parcels.append(parcel)

print(f"parcels_count:{len(parcels)}")
print(f"parcels_data:{str(parcels)[:1000]}")
`;
    
    const result = await runScriptDetailed(script);
    
    if (!result?.ok) {
      throw new Error(result.message || "Échec de la requête WFS");
    }
    
    // Parser le résultat
    const parcelCount = parseInt(result.message?.match(/parcels_count:(\d+)/)?.[1] || "0");
    const parcelsData = result.message?.match(/parcels_data:(.*)/s)?.[1] || "[]";
    
    // Parser les données JSON des parcelles
    let parcels: IdentifiedParcel[] = [];
    try {
      // Les données peuvent être tronquées, on essaie de parser
      const rawData = JSON.parse(parcelsData);
      if (Array.isArray(rawData)) {
        parcels = rawData.map((p: any) => ({
          id: p.id || "",
          code: p.code || "",
          name: p.name || "",
          surface: p.surface || 0,
          essence: p.essence || "",
          age: p.age || 0,
          volume: p.volume || 0,
          ownership: p.ownership || "",
          geometry: p.geometry || null,
          attributes: p.attributes || {},
          confidence: 0.8,
        }));
      }
    } catch (error) {
      // Si le parsing échoue, retourner un tableau vide
      console.warn(`      ⚠️  Erreur de parsing des parcelles: ${error}`);
    }
    
    console.log(`      ✅ ${parcels.length} parcelle(s) trouvée(s)`);
    
    return parcels;
  }
  
  /**
   * Construit un filtre WFS
   */
  private buildWFSFilter(criteria: IdentificationCriteria): string {
    const filters: string[] = [];
    
    if (criteria.parcelIds && criteria.parcelIds.length > 0) {
      filters.push(`id IN (${criteria.parcelIds.map(id => `'${id}'`).join(",")})`);
    }
    
    if (criteria.parcelCodes && criteria.parcelCodes.length > 0) {
      filters.push(`code IN (${criteria.parcelCodes.map(code => `'${code}'`).join(",")})`);
    }
    
    if (criteria.essence) {
      filters.push(`essence = '${criteria.essence}'`);
    }
    
    if (criteria.surfaceRange) {
      filters.push(`surface BETWEEN ${criteria.surfaceRange.min} AND ${criteria.surfaceRange.max}`);
    }
    
    if (criteria.ageRange) {
      filters.push(`age BETWEEN ${criteria.ageRange.min} AND ${criteria.ageRange.max}`);
    }
    
    if (criteria.volumeRange) {
      filters.push(`volume BETWEEN ${criteria.volumeRange.min} AND ${criteria.volumeRange.max}`);
    }
    
    if (criteria.ownership) {
      filters.push(`proprietaire LIKE '%${criteria.ownership}%'`);
    }
    
    return filters.join(" AND ");
  }
  
  /**
   * Interroge un service WMS
   */
  private async queryWMS(config: MapServiceConfig, criteria: IdentificationCriteria): Promise<IdentifiedParcel[]> {
    console.log(`      🔍 Query WMS: ${config.url}`);
    
    // WMS ne permet pas de requêtes d'attributs, seulement de raster
    // À implémenter avec une approche différente
    console.log(`      ⚠️  WMS ne supporte pas les requêtes d'attributs`);
    return [];
  }
  
  /**
   * Interroge un service ArcGIS REST
   */
  private async queryArcGISREST(config: MapServiceConfig, criteria: IdentificationCriteria): Promise<IdentifiedParcel[]> {
    console.log(`      🔍 Query ArcGIS REST: ${config.url}`);
    
    // À implémenter avec l'API ArcGIS REST
    return [];
  }
  
  /**
   * Interroge un service GeoJSON
   */
  private async queryGeoJSON(config: MapServiceConfig, criteria: IdentificationCriteria): Promise<IdentifiedParcel[]> {
    console.log(`      🔍 Query GeoJSON: ${config.url}`);
    
    try {
      const response = await fetch(config.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const geojson = await response.json();
      
      if (!geojson.features || !Array.isArray(geojson.features)) {
        console.warn(`      ⚠️  Format GeoJSON invalide`);
        return [];
      }
      
      // Parser les features GeoJSON
      const parcels: IdentifiedParcel[] = geojson.features.map((feature: any) => {
        const props = feature.properties || {};
        return {
          id: props.id || feature.id || "",
          code: props.code || "",
          name: props.name || props.nom || "",
          surface: props.surface || 0,
          essence: props.essence || "",
          age: props.age || 0,
          volume: props.volume || 0,
          ownership: props.ownership || props.proprietaire || "",
          geometry: feature.geometry || null,
          attributes: props,
          confidence: 0.9,
        };
      });
      
      // Filtrer selon les critères
      const filtered = this.filterParcels(parcels, criteria);
      
      console.log(`      ✅ ${filtered.length} parcelle(s) trouvée(s)`);
      
      return filtered;
      
    } catch (error) {
      console.error(`      ❌ Erreur de requête GeoJSON: ${error}`);
      return [];
    }
  }
  
  /**
   * Filtre les parcelles selon les critères
   */
  private filterParcels(parcels: IdentifiedParcel[], criteria: IdentificationCriteria): IdentifiedParcel[] {
    let filtered = parcels;
    
    // Filtrer par IDs
    if (criteria.parcelIds && criteria.parcelIds.length > 0) {
      filtered = filtered.filter(p => criteria.parcelIds!.includes(p.id));
    }
    
    // Filtrer par codes
    if (criteria.parcelCodes && criteria.parcelCodes.length > 0) {
      filtered = filtered.filter(p => criteria.parcelCodes!.includes(p.code));
    }
    
    // Filtrer par surface
    if (criteria.surfaceRange) {
      filtered = filtered.filter(p => 
        p.surface >= criteria.surfaceRange!.min && 
        p.surface <= criteria.surfaceRange!.max
      );
    }
    
    // Filtrer par essence
    if (criteria.essence) {
      filtered = filtered.filter(p => 
        p.essence.toLowerCase().includes(criteria.essence!.toLowerCase())
      );
    }
    
    // Filtrer par âge
    if (criteria.ageRange) {
      filtered = filtered.filter(p => 
        p.age >= criteria.ageRange!.min && 
        p.age <= criteria.ageRange!.max
      );
    }
    
    // Filtrer par volume
    if (criteria.volumeRange) {
      filtered = filtered.filter(p => 
        p.volume >= criteria.volumeRange!.min && 
        p.volume <= criteria.volumeRange!.max
      );
    }
    
    // Filtrer par propriétaire
    if (criteria.ownership) {
      filtered = filtered.filter(p => 
        p.ownership.toLowerCase().includes(criteria.ownership!.toLowerCase())
      );
    }
    
    return filtered;
  }
  
  /**
   * Interroge une base PostGIS
   */
  private async queryPostGIS(config: MapServiceConfig, criteria: IdentificationCriteria): Promise<IdentifiedParcel[]> {
    console.log(`      🔍 Query PostGIS: ${config.url}`);
    
    // À implémenter avec une connexion PostgreSQL
    return [];
  }
  
  /**
   * Fusionne les résultats de plusieurs services
   */
  private mergeResults(results: ParcelIdentificationResult[]): IdentifiedParcel[] {
    const merged: IdentifiedParcel[] = [];
    const seen = new Set<string>();
    
    for (const result of results) {
      for (const parcel of result.parcels) {
        const key = `${parcel.id}_${parcel.code}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(parcel);
        }
      }
    }
    
    return merged;
  }
  
  /**
   * Filtre les résultats selon les critères
   */
  private filterResults(parcels: IdentifiedParcel[], criteria: IdentificationCriteria): IdentifiedParcel[] {
    return parcels.filter(parcel => {
      let match = true;
      
      if (criteria.parcelIds && !criteria.parcelIds.includes(parcel.id)) match = false;
      if (criteria.parcelCodes && !criteria.parcelCodes.includes(parcel.code)) match = false;
      
      if (criteria.surfaceRange) {
        if (parcel.surface < criteria.surfaceRange.min || parcel.surface > criteria.surfaceRange.max) {
          match = false;
        }
      }
      
      if (criteria.essence && !parcel.essence.toLowerCase().includes(criteria.essence.toLowerCase())) match = false;
      
      if (criteria.ageRange) {
        if (parcel.age < criteria.ageRange.min || parcel.age > criteria.ageRange.max) match = false;
      }
      
      if (criteria.volumeRange) {
        if (parcel.volume < criteria.volumeRange.min || parcel.volume > criteria.volumeRange.max) match = false;
      }
      
      if (criteria.ownership && !parcel.ownership.toLowerCase().includes(criteria.ownership.toLowerCase())) match = false;
      
      if (criteria.bounds) {
        // À implémenter avec vérification géométrique
      }
      
      return match;
    });
  }
  
  /**
   * Calcule les scores de confiance
   */
  private calculateConfidence(parcels: IdentifiedParcel[], criteria: IdentificationCriteria): IdentifiedParcel[] {
    return parcels.map(parcel => {
      let confidence = 0.5; // Score de base
      
      // Correspondance du nom de forêt
      if (parcel.name.toLowerCase().includes(criteria.forestName.toLowerCase())) {
        confidence += 0.2;
      }
      
      // Correspondance des IDs
      if (criteria.parcelIds && criteria.parcelIds.includes(parcel.id)) {
        confidence += 0.3;
      }
      
      // Correspondance des codes
      if (criteria.parcelCodes && criteria.parcelCodes.includes(parcel.code)) {
        confidence += 0.3;
      }
      
      // Données complètes
      if (parcel.surface > 0 && parcel.essence && parcel.age > 0) {
        confidence += 0.1;
      }
      
      return {
        ...parcel,
        confidence: Math.min(confidence, 1.0),
      };
    });
  }
  
  /**
   * Génère une clé de cache
   */
  private generateCacheKey(criteria: IdentificationCriteria): string {
    const parts = [
      criteria.forestName,
      criteria.parcelIds?.join(",") || "",
      criteria.parcelCodes?.join(",") || "",
      criteria.essence || "",
      criteria.ownership || "",
    ];
    
    return parts.filter(p => p).join("|");
  }
  
  /**
   * Vide le cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Ajoute un service de carte personnalisé
   */
  addMapService(name: string, config: MapServiceConfig): void {
    this.mapServices.set(name, config);
  }
  
  /**
   * Supprime un service de carte
   */
  removeMapService(name: string): void {
    this.mapServices.delete(name);
  }
  
  /**
   * Liste les services de carte disponibles
   */
  listMapServices(): Map<string, MapServiceConfig> {
    return new Map(this.mapServices);
  }
}

/**
 * Helper pour créer un service d'identification de parcelles
 */
export function createParcelIdentificationService(): ParcelIdentificationService {
  return new ParcelIdentificationService();
}
