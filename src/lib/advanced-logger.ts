/**
 * Advanced Logger and Monitor
 * 
 * Système de monitoring et logging avancé
 * Logs structurés avec niveaux, catégories et métriques
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  metadata: LogMetadata;
}

export interface LogMetadata {
  source: string;
  userId?: string;
  sessionId?: string;
  tags: string[];
  duration?: number;
}

export interface LogFilter {
  level?: LogLevel;
  category?: string;
  source?: string;
  startTime?: number;
  endTime?: number;
  tags?: string[];
}

export interface LogStats {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByCategory: Record<string, number>;
  logsBySource: Record<string, number>;
  averageDuration: number;
  errorRate: number;
}

export interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  action: "log" | "notify" | "block";
  enabled: boolean;
}

/**
 * Logger avancé
 */
export class AdvancedLogger {
  private logs: LogEntry[];
  private metrics: MetricData[];
  private alertRules: AlertRule[];
  private maxLogs: number;
  private persistToDisk: boolean;
  
  constructor(persistToDisk: boolean = true) {
    this.logs = [];
    this.metrics = [];
    this.alertRules = [];
    this.maxLogs = 10000;
    this.persistToDisk = persistToDisk;
    
    if (this.persistToDisk) {
      this.loadFromDisk();
    }
  }
  
  /**
   * Log un message
   */
  log(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    metadata: Partial<LogMetadata> = {}
  ): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      metadata: {
        source: metadata.source || "unknown",
        userId: metadata.userId,
        sessionId: metadata.sessionId,
        tags: metadata.tags || [],
        duration: metadata.duration,
      },
    };
    
    this.logs.push(entry);
    
    // Limiter le nombre de logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Afficher dans la console
    this.logToConsole(entry);
    
    // Persister si activé
    if (this.persistToDisk) {
      this.saveToDisk();
    }
    
    // Vérifier les alertes
    this.checkAlerts(entry);
  }
  
  /**
   * Log un message de debug
   */
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }
  
  /**
   * Log un message d'info
   */
  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }
  
  /**
   * Log un avertissement
   */
  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }
  
  /**
   * Log une erreur
   */
  error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }
  
  /**
   * Log une erreur critique
   */
  critical(category: string, message: string, data?: any): void {
    this.log(LogLevel.CRITICAL, category, message, data);
  }
  
  /**
   * Log avec durée de performance
   */
  logPerformance(
    category: string,
    operation: string,
    duration: number,
    data?: any
  ): void {
    this.log(LogLevel.INFO, category, `Performance: ${operation}`, data, {
      duration,
      tags: ["performance"],
    });
    
    // Ajouter comme métrique
    this.recordMetric(operation, duration, "ms", { category });
  }
  
  /**
   * Enregistre une métrique
   */
  recordMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {}
  ): void {
    const metric: MetricData = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };
    
    this.metrics.push(metric);
    
    // Limiter le nombre de métriques
    if (this.metrics.length > 5000) {
      this.metrics.shift();
    }
    
    if (this.persistToDisk) {
      this.saveToDisk();
    }
  }
  
  /**
   * Récupère les logs avec filtres
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    let filtered = [...this.logs];
    
    if (filter) {
      if (filter.level !== undefined) {
        filtered = filtered.filter(log => log.level === filter.level);
      }
      
      if (filter.category) {
        filtered = filtered.filter(log => log.category === filter.category);
      }
      
      if (filter.source) {
        filtered = filtered.filter(log => log.metadata.source === filter.source);
      }
      
      if (filter.startTime !== undefined) {
        filtered = filtered.filter(log => log.timestamp >= filter.startTime!);
      }
      
      if (filter.endTime !== undefined) {
        filtered = filtered.filter(log => log.timestamp <= filter.endTime!);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        filtered = filtered.filter(log =>
          filter.tags!.some(tag => log.metadata.tags.includes(tag))
        );
      }
    }
    
    // Trier par timestamp décroissant
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    return filtered;
  }
  
  /**
   * Récupère les statistiques des logs
   */
  getStats(filter?: LogFilter): LogStats {
    const logs = this.getLogs(filter);
    
    const logsByLevel: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.CRITICAL]: 0,
    };
    
    const logsByCategory: Record<string, number> = {};
    const logsBySource: Record<string, number> = {};
    
    let totalDuration = 0;
    let durationCount = 0;
    
    for (const log of logs) {
      logsByLevel[log.level]++;
      logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
      logsBySource[log.metadata.source] = (logsBySource[log.metadata.source] || 0) + 1;
      
      if (log.metadata.duration !== undefined) {
        totalDuration += log.metadata.duration;
        durationCount++;
      }
    }
    
    const errorCount = logsByLevel[LogLevel.ERROR] + logsByLevel[LogLevel.CRITICAL];
    const errorRate = logs.length > 0 ? errorCount / logs.length : 0;
    
    return {
      totalLogs: logs.length,
      logsByLevel,
      logsByCategory,
      logsBySource,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      errorRate,
    };
  }
  
  /**
   * Récupère les métriques
   */
  getMetrics(name?: string, startTime?: number, endTime?: number): MetricData[] {
    let filtered = [...this.metrics];
    
    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }
    
    if (startTime !== undefined) {
      filtered = filtered.filter(m => m.timestamp >= startTime);
    }
    
    if (endTime !== undefined) {
      filtered = filtered.filter(m => m.timestamp <= endTime);
    }
    
    return filtered;
  }
  
  /**
   * Ajoute une règle d'alerte
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }
  
  /**
   * Supprime une règle d'alerte
   */
  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Vérifie les alertes
   */
  private checkAlerts(entry: LogEntry): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;
      
      let triggered = false;
      
      // Vérifier si le niveau dépasse le seuil
      if (rule.condition === "level" && entry.level >= rule.threshold) {
        triggered = true;
      }
      
      // Vérifier si la durée dépasse le seuil
      if (rule.condition === "duration" && entry.metadata.duration && entry.metadata.duration > rule.threshold) {
        triggered = true;
      }
      
      if (triggered) {
        this.log(LogLevel.WARN, "alert", `Alerte déclenchée: ${rule.name}`, { ruleId: rule.id });
        
        // Exécuter l'action
        if (rule.action === "notify") {
          // À implémenter: notification
        } else if (rule.action === "block") {
          // À implémenter: blocage
        }
      }
    }
  }
  
  /**
   * Vide les logs
   */
  clearLogs(): void {
    this.logs = [];
    if (this.persistToDisk) {
      this.saveToDisk();
    }
  }
  
  /**
   * Vide les métriques
   */
  clearMetrics(): void {
    this.metrics = [];
    if (this.persistToDisk) {
      this.saveToDisk();
    }
  }
  
  /**
   * Affiche dans la console
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    
    const prefix = `[${timestamp}] [${levelName}] [${entry.category}]`;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.data);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(prefix, entry.message, entry.data);
        break;
    }
  }
  
  /**
   * Sauvegarde sur disque
   */
  private saveToDisk(): void {
    try {
      const data = {
        logs: this.logs.slice(-1000), // Garder seulement les 1000 derniers
        metrics: this.metrics.slice(-500),
        alertRules: this.alertRules,
      };
      localStorage.setItem("qgis_logger", JSON.stringify(data));
    } catch (error) {
      console.error("Erreur de sauvegarde du logger:", error);
    }
  }
  
  /**
   * Charge depuis disque
   */
  private loadFromDisk(): void {
    try {
      const data = localStorage.getItem("qgis_logger");
      if (data) {
        const parsed = JSON.parse(data);
        this.logs = parsed.logs || [];
        this.metrics = parsed.metrics || [];
        this.alertRules = parsed.alertRules || [];
      }
    } catch (error) {
      console.error("Erreur de chargement du logger:", error);
    }
  }
  
  /**
   * Exporte les logs
   */
  exportLogs(filter?: LogFilter): string {
    const logs = this.getLogs(filter);
    return JSON.stringify(logs, null, 2);
  }
  
  /**
   * Exporte les métriques
   */
  exportMetrics(name?: string, startTime?: number, endTime?: number): string {
    const metrics = this.getMetrics(name, startTime, endTime);
    return JSON.stringify(metrics, null, 2);
  }
}

/**
 * Helper pour créer un logger avancé
 */
export function createAdvancedLogger(persistToDisk?: boolean): AdvancedLogger {
  return new AdvancedLogger(persistToDisk);
}
