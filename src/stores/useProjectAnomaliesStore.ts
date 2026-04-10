/**
 * Store pour la détection d'anomalies dans le projet QGIS
 * Analyse proactive du projet pour identifier les problèmes potentiels
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AnomalySeverity = "info" | "low" | "medium" | "high" | "critical";
export type AnomalyType = 
  | "missing-crs"
  | "crs-mismatch"
  | "duplicate-layer"
  | "invalid-geometry"
  | "missing-fields"
  | "performance-issue"
  | "data-quality"
  | "missing-source"
  | "broken-path"
  | "large-file"
  | "memory-heavy"
  | "reprojection-needed";

export interface ProjectAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  layerName?: string;
  suggestion: string;
  autoFixable: boolean;
  autoFixAction?: string;
  detectedAt: number;
  resolvedAt?: number;
  ignored: boolean;
}

interface ProjectAnomaliesState {
  anomalies: ProjectAnomaly[];
  isScanning: boolean;
  lastScanAt?: number;
  scanCount: number;
  autoScanEnabled: boolean;
  
  // Actions
  scanProject: (layers: LayerInfo[]) => void;
  resolveAnomaly: (id: string) => void;
  ignoreAnomaly: (id: string) => void;
  unignoreAnomaly: (id: string) => void;
  autoFix: (id: string) => Promise<boolean>;
  clearAnomalies: () => void;
  getActiveAnomalies: () => ProjectAnomaly[];
  getAnomaliesBySeverity: (severity: AnomalySeverity) => ProjectAnomaly[];
  getAnomaliesByLayer: (layerName: string) => ProjectAnomaly[];
  toggleAutoScan: () => void;
  exportAnomalies: () => string;
}

export interface LayerInfo {
  name: string;
  id: string;
  crs?: string;
  featureCount?: number;
  fileSize?: number;
  source?: string;
  isValid?: boolean;
  geometryType?: string;
  fieldNames?: string[];
  hasMissingFields?: boolean;
  isVisible?: boolean;
}

const ANOMALY_PATTERNS: { 
  type: AnomalyType; 
  severity: AnomalySeverity;
  title: string;
  description: (layer: LayerInfo) => string;
  suggestion: string;
  autoFixable: boolean;
  autoFixAction?: string;
  check: (layer: LayerInfo, allLayers: LayerInfo[]) => boolean;
}[] = [
  {
    type: "missing-crs",
    severity: "critical",
    title: "CRS non défini",
    description: (layer) => `La couche "${layer.name}" n'a pas de système de coordonnées défini.`,
    suggestion: "Définir le CRS (EPSG:2154 recommandé pour la France)",
    autoFixable: false,
    check: (layer) => !layer.crs || layer.crs === "",
  },
  {
    type: "crs-mismatch",
    severity: "high",
    title: "CRS incompatible",
    description: (layer) => `La couche "${layer.name}" utilise un CRS différent du projet.`,
    suggestion: "Reprojeter la couche en EPSG:2154 (Lambert 93)",
    autoFixable: true,
    autoFixAction: "reproject",
    check: (layer, allLayers) => {
      const projectCRS = "EPSG:2154"; // Supposons L93 par défaut
      return !!layer.crs && layer.crs !== projectCRS;
    },
  },
  {
    type: "duplicate-layer",
    severity: "medium",
    title: "Couche dupliquée",
    description: (layer) => `Le nom "${layer.name}" existe plusieurs fois dans le projet.`,
    suggestion: "Renommer les couches pour avoir des noms uniques",
    autoFixable: false,
    check: (layer, allLayers) => {
      const duplicates = allLayers.filter(l => l.name === layer.name);
      return duplicates.length > 1;
    },
  },
  {
    type: "invalid-geometry",
    severity: "high",
    title: "Géométries invalides",
    description: (layer) => `La couche "${layer.name}" contient des géométries invalides.`,
    suggestion: "Réparer les géométries avec l'outil 'Réparer les géométries'",
    autoFixable: true,
    autoFixAction: "repairGeometry",
    check: (layer) => layer.isValid === false,
  },
  {
    type: "missing-source",
    severity: "critical",
    title: "Source manquante",
    description: (layer) => `La source de la couche "${layer.name}" est introuvable.`,
    suggestion: "Vérifier le chemin du fichier ou recharger la couche",
    autoFixable: false,
    check: (layer) => !layer.source || layer.source === "",
  },
  {
    type: "broken-path",
    severity: "high",
    title: "Chemin de fichier cassé",
    description: (layer) => `Le fichier source de "${layer.name}" n'existe plus à l'emplacement indiqué.`,
    suggestion: "Relocaliser le fichier ou supprimer la couche",
    autoFixable: false,
    check: (layer) => {
      // Simuler la vérification du chemin
      return false; // Nécessiterait une vraie vérification côté QGIS
    },
  },
  {
    type: "large-file",
    severity: "medium",
    title: "Fichier volumineux",
    description: (layer) => `La couche "${layer.name}" (${(layer.fileSize! / 1024 / 1024).toFixed(1)} Mo) peut ralentir le projet.`,
    suggestion: "Créer un index spatial ou simplifier la géométrie",
    autoFixable: false,
    check: (layer) => (layer.fileSize || 0) > 100 * 1024 * 1024, // 100MB
  },
  {
    type: "performance-issue",
    severity: "low",
    title: "Problème de performance",
    description: (layer) => `La couche "${layer.name}" a ${layer.featureCount} entités sans index spatial.`,
    suggestion: "Créer un index spatial pour accélérer les requêtes",
    autoFixable: true,
    autoFixAction: "createSpatialIndex",
    check: (layer) => (layer.featureCount || 0) > 10000,
  },
  {
    type: "reprojection-needed",
    severity: "low",
    title: "Reprojection nécessaire",
    description: (layer) => `La couche "${layer.name}" utilise le CRS ${layer.crs}.`,
    suggestion: "Reprojeter en EPSG:2154 pour une meilleure compatibilité",
    autoFixable: true,
    autoFixAction: "reproject",
    check: (layer) => {
      const nonStandardCRS = ["EPSG:4326", "EPSG:3857"];
      return !!layer.crs && !layer.crs.includes("2154") && !nonStandardCRS.includes(layer.crs);
    },
  },
];

export const useProjectAnomaliesStore = create<ProjectAnomaliesState>()(
  persist(
    (set, get) => ({
      anomalies: [],
      isScanning: false,
      lastScanAt: undefined,
      scanCount: 0,
      autoScanEnabled: true,

      scanProject: (layers) => {
        set({ isScanning: true });
        
        const detectedAnomalies: ProjectAnomaly[] = [];
        
        layers.forEach(layer => {
          ANOMALY_PATTERNS.forEach(pattern => {
            if (pattern.check(layer, layers)) {
              const id = `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              detectedAnomalies.push({
                id,
                type: pattern.type,
                severity: pattern.severity,
                title: pattern.title,
                description: pattern.description(layer),
                layerName: layer.name,
                suggestion: pattern.suggestion,
                autoFixable: pattern.autoFixable,
                autoFixAction: pattern.autoFixAction,
                detectedAt: Date.now(),
                ignored: false,
              });
            }
          });
        });

        // Vérifier les conflits entre couches (CRS différents)
        const crses = layers.map(l => l.crs).filter(Boolean);
        const uniqueCRSs = [...new Set(crses)];
        if (uniqueCRSs.length > 1) {
          detectedAnomalies.push({
            id: `anomaly_${Date.now()}_crs_mismatch`,
            type: "crs-mismatch",
            severity: "medium",
            title: "Projets multi-CRS",
            description: `Le projet utilise ${uniqueCRSs.length} systèmes de coordonnées différents: ${uniqueCRSs.join(", ")}.`,
            suggestion: "Unifier les couches en un seul CRS (EPSG:2154 recommandé)",
            autoFixable: false,
            detectedAt: Date.now(),
            ignored: false,
          });
        }

        set(state => ({
          anomalies: [...detectedAnomalies, ...state.anomalies.filter(a => !detectedAnomalies.find(d => d.type === a.type && d.layerName === a.layerName))].slice(0, 100),
          isScanning: false,
          lastScanAt: Date.now(),
          scanCount: state.scanCount + 1,
        }));
      },

      resolveAnomaly: (id) => {
        set(state => ({
          anomalies: state.anomalies.map(a =>
            a.id === id ? { ...a, resolvedAt: Date.now() } : a
          ),
        }));
      },

      ignoreAnomaly: (id) => {
        set(state => ({
          anomalies: state.anomalies.map(a =>
            a.id === id ? { ...a, ignored: true } : a
          ),
        }));
      },

      unignoreAnomaly: (id) => {
        set(state => ({
          anomalies: state.anomalies.map(a =>
            a.id === id ? { ...a, ignored: false } : a
          ),
        }));
      },

      autoFix: async (id) => {
        const anomaly = get().anomalies.find(a => a.id === id);
        if (!anomaly || !anomaly.autoFixable) return false;

        // Simuler l'exécution de l'auto-fix
        // Dans une vraie implémentation, cela appellerait PyQGIS
        await new Promise(resolve => setTimeout(resolve, 1000));

        set(state => ({
          anomalies: state.anomalies.map(a =>
            a.id === id ? { ...a, resolvedAt: Date.now() } : a
          ),
        }));

        return true;
      },

      clearAnomalies: () => {
        set({ anomalies: [] });
      },

      getActiveAnomalies: () => {
        return get().anomalies.filter(a => !a.resolvedAt && !a.ignored);
      },

      getAnomaliesBySeverity: (severity) => {
        return get().anomalies.filter(a => a.severity === severity && !a.resolvedAt && !a.ignored);
      },

      getAnomaliesByLayer: (layerName) => {
        return get().anomalies.filter(a => a.layerName === layerName && !a.resolvedAt);
      },

      toggleAutoScan: () => {
        set(state => ({ autoScanEnabled: !state.autoScanEnabled }));
      },

      exportAnomalies: () => {
        const { anomalies, scanCount, lastScanAt } = get();
        const data = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          scanCount,
          lastScanAt,
          anomalies: anomalies.filter(a => !a.resolvedAt),
        };
        return JSON.stringify(data, null, 2);
      },
    }),
    {
      name: "qgisai-project-anomalies",
      partialize: (state) => ({
        anomalies: state.anomalies,
        autoScanEnabled: state.autoScanEnabled,
        scanCount: state.scanCount,
      }),
    }
  )
);
