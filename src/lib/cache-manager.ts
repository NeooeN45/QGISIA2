/**
 * Cache Manager
 * 
 * Système de cache pour les résultats
 * Met en cache les résultats des opérations pour éviter les traitements répétitifs
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // Time to live en millisecondes
  size: number; // Taille en octets
  metadata: CacheMetadata;
}

export interface CacheMetadata {
  operationType: string;
  parameters: Record<string, any>;
  source: string;
  tags: string[];
}

export interface CacheOptions {
  ttl: number; // Time to live en millisecondes
  maxSize: number; // Taille maximale en octets
  maxEntries: number; // Nombre maximum d'entrées
  persistToDisk: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  oldestEntry: number;
  newestEntry: number;
}

/**
 * Gestionnaire de cache
 */
export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private options: CacheOptions;
  private stats: CacheStats;
  
  constructor(options: Partial<CacheOptions> = {}) {
    this.cache = new Map();
    this.options = {
      ttl: options.ttl || 3600000, // 1 heure par défaut
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100 Mo par défaut
      maxEntries: options.maxEntries || 1000,
      persistToDisk: options.persistToDisk || false,
    };
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      entryCount: 0,
      oldestEntry: Date.now(),
      newestEntry: Date.now(),
    };
    
    // Charger depuis le disque si activé
    if (this.options.persistToDisk) {
      this.loadFromDisk();
    }
  }
  
  /**
   * Met en cache une valeur
   */
  set<T>(
    key: string,
    value: T,
    metadata: CacheMetadata,
    ttl?: number
  ): boolean {
    console.log(`💾 Cache set: ${key}`);
    
    // Vérifier si on peut ajouter l'entrée
    const entrySize = this.calculateSize(value);
    
    if (entrySize > this.options.maxSize) {
      console.log(`   ⚠️  Entrée trop grande: ${entrySize} octets`);
      return false;
    }
    
    // Évacuer si nécessaire
    this.evictIfNeeded(entrySize);
    
    // Créer l'entrée
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.options.ttl,
      size: entrySize,
      metadata,
    };
    
    this.cache.set(key, entry);
    this.updateStats();
    
    // Persister sur disque si activé
    if (this.options.persistToDisk) {
      this.saveToDisk();
    }
    
    console.log(`   ✅ Entrée ajoutée: ${entrySize} octets`);
    return true;
  }
  
  /**
   * Récupère une valeur du cache
   */
  get<T>(key: string): T | null {
    console.log(`🔍 Cache get: ${key}`);
    
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      console.log(`   ❌ Cache miss`);
      return null;
    }
    
    // Vérifier si l'entrée est expirée
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      this.updateStats();
      console.log(`   ⚠️  Entrée expirée`);
      return null;
    }
    
    this.stats.hits++;
    this.updateHitRate();
    console.log(`   ✅ Cache hit`);
    
    return entry.value as T;
  }
  
  /**
   * Vérifie si une clé existe dans le cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Supprime une entrée du cache
   */
  delete(key: string): boolean {
    console.log(`🗑️  Cache delete: ${key}`);
    
    const deleted = this.cache.delete(key);
    this.updateStats();
    
    if (deleted) {
      console.log(`   ✅ Entrée supprimée`);
    }
    
    return deleted;
  }
  
  /**
   * Vide tout le cache
   */
  clear(): void {
    console.log(`🧹 Cache clear`);
    
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      entryCount: 0,
      oldestEntry: Date.now(),
      newestEntry: Date.now(),
    };
    
    if (this.options.persistToDisk) {
      this.saveToDisk();
    }
    
    console.log(`   ✅ Cache vidé`);
  }
  
  /**
   * Supprime les entrées expirées
   */
  cleanup(): number {
    console.log(`🧹 Cache cleanup`);
    
    let removed = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    this.updateStats();
    
    if (this.options.persistToDisk) {
      this.saveToDisk();
    }
    
    console.log(`   ✅ ${removed} entrée(s) supprimée(s)`);
    return removed;
  }
  
  /**
   * Évacue des entrées si nécessaire
   */
  private evictIfNeeded(newSize: number): void {
    // Évacuer par taille
    while (this.stats.totalSize + newSize > this.options.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
    
    // Évacuer par nombre d'entrées
    while (this.cache.size >= this.options.maxEntries) {
      this.evictLRU();
    }
  }
  
  /**
   * Évacue l'entrée la moins récemment utilisée (LRU)
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Vérifie si une entrée est expirée
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }
  
  /**
   * Calcule la taille approximative d'une valeur
   */
  private calculateSize(value: any): number {
    try {
      const json = JSON.stringify(value);
      return new Blob([json]).size;
    } catch {
      return 1024; // Valeur par défaut
    }
  }
  
  /**
   * Met à jour les statistiques
   */
  private updateStats(): void {
    this.stats.entryCount = this.cache.size;
    this.stats.totalSize = 0;
    
    let oldest = Date.now();
    let newest = 0;
    
    for (const entry of this.cache.values()) {
      this.stats.totalSize += entry.size;
      if (entry.timestamp < oldest) oldest = entry.timestamp;
      if (entry.timestamp > newest) newest = entry.timestamp;
    }
    
    this.stats.oldestEntry = this.cache.size > 0 ? oldest : Date.now();
    this.stats.newestEntry = this.cache.size > 0 ? newest : Date.now();
  }
  
  /**
   * Met à jour le taux de hits
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
  
  /**
   * Retourne les statistiques du cache
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  /**
   * Sauvegarde le cache sur disque (localStorage)
   */
  private saveToDisk(): void {
    try {
      const cacheData = Array.from(this.cache.entries());
      const serialized = JSON.stringify({
        cache: cacheData,
        stats: this.stats,
        options: this.options,
      });
      
      localStorage.setItem('geosylva_cache', serialized);
      console.log(`💾 Cache sauvegardé dans localStorage (${serialized.length} octets)`);
    } catch (error) {
      console.error(`❌ Erreur de sauvegarde du cache:`, error);
    }
  }
  
  /**
   * Charge le cache depuis disque (localStorage)
   */
  private loadFromDisk(): void {
    try {
      const serialized = localStorage.getItem('geosylva_cache');
      if (!serialized) {
        console.log(`💾 Aucun cache trouvé dans localStorage`);
        return;
      }
      
      const data = JSON.parse(serialized);
      
      // Restaurer le cache
      this.cache = new Map(data.cache);
      
      // Restaurer les stats
      this.stats = data.stats || {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalSize: 0,
        entryCount: 0,
        oldestEntry: Date.now(),
        newestEntry: Date.now(),
      };
      
      // Restaurer les options
      if (data.options) {
        this.options = { ...this.options, ...data.options };
      }
      
      console.log(`💾 Cache chargé depuis localStorage (${this.cache.size} entrées)`);
      
      // Nettoyer les entrées expirées
      this.cleanup();
      
    } catch (error) {
      console.error(`❌ Erreur de chargement du cache:`, error);
      // En cas d'erreur, on continue avec un cache vide
      this.cache = new Map();
    }
  }
  
  /**
   * Génère une clé de cache unique
   */
  generateKey(prefix: string, parameters: Record<string, any>): string {
    const sortedParams = Object.keys(parameters)
      .sort()
      .map(key => `${key}:${parameters[key]}`)
      .join("|");
    
    return `${prefix}:${sortedParams}`;
  }
  
  /**
   * Recherche des entrées par tags
   */
  findByTag(tag: string): string[] {
    const keys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.tags.includes(tag)) {
        keys.push(key);
      }
    }
    
    return keys;
  }
  
  /**
   * Supprime les entrées par tags
   */
  deleteByTag(tag: string): number {
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.tags.includes(tag)) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    this.updateStats();
    return removed;
  }
  
  /**
   * Configure le cache
   */
  configure(options: Partial<CacheOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Helper pour créer un gestionnaire de cache
 */
export function createCacheManager(options?: Partial<CacheOptions>): CacheManager {
  return new CacheManager(options);
}
