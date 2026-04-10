/**
 * Système de templates de scripts PyQGIS réutilisables
 * Permet de créer, sauvegarder et réutiliser des scripts paramétrables
 */

import { z } from "zod";

// Schémas de validation
export const TemplateParameterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["layer", "number", "text", "choice", "boolean", "file", "directory"]),
  required: z.boolean().default(true),
  defaultValue: z.any().optional(),
  options: z.array(z.string()).optional(), // Pour les choix
  min: z.number().optional(), // Pour les nombres
  max: z.number().optional(),
  step: z.number().optional(),
});

export const ScriptTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    "forest",
    "analysis",
    "processing",
    "data_management",
    "visualization",
    "export",
    "import",
    "custom",
  ]),
  tags: z.array(z.string()).default([]),
  author: z.string().optional(),
  version: z.string().default("1.0"),
  createdAt: z.number(),
  updatedAt: z.number(),
  parameters: z.array(TemplateParameterSchema),
  code: z.string(), // Template avec placeholders {{paramId}}
  previewCode: z.string().optional(), // Code d'aperçu
  exampleUsage: z.string().optional(),
  requiresConfirmation: z.boolean().default(true),
  estimatedDuration: z.string().optional(), // "rapide", "moyen", "long"
});

export type TemplateParameter = z.infer<typeof TemplateParameterSchema>;
export type ScriptTemplate = z.infer<typeof ScriptTemplateSchema>;

// Templates prédéfinis
export const BUILTIN_TEMPLATES: ScriptTemplate[] = [
  // Templates forestiers
  {
    id: "forest-inventory-grid",
    name: "Grille d'inventaire forestier",
    description: "Crée une grille régulière avec placettes d'inventaire et centroïdes pour relevés terrain",
    category: "forest",
    tags: ["inventaire", "forêt", "placettes", "grille"],
    parameters: [
      {
        id: "sourceLayer",
        name: "Couche source",
        description: "Couche polygonale délimitant la zone d'inventaire",
        type: "layer",
        required: true,
      },
      {
        id: "gridSize",
        name: "Taille de la maille",
        description: "Dimension des carrés de la grille (mètres)",
        type: "number",
        required: true,
        defaultValue: 250,
        min: 50,
        max: 1000,
        step: 50,
      },
      {
        id: "plotSize",
        name: "Taille des placettes",
        description: "Rayon des placettes circulaires (mètres)",
        type: "number",
        required: true,
        defaultValue: 15,
        min: 5,
        max: 30,
        step: 1,
      },
      {
        id: "outputGrid",
        name: "Nom grille",
        description: "Nom de la couche grille en sortie",
        type: "text",
        required: true,
        defaultValue: "Grille_Inventaire",
      },
      {
        id: "outputCentroids",
        name: "Nom centroïdes",
        description: "Nom de la couche des centroïdes",
        type: "text",
        required: true,
        defaultValue: "Centroides_Placettes",
      },
    ],
    code: `
from qgis.core import QgsProject, QgsVectorLayer, QgsFeature, QgsGeometry, QgsPointXY
import processing

# Paramètres
source_layer = QgsProject.instance().mapLayersByName("{{sourceLayer}}")[0]
cell_size = {{gridSize}}
plot_radius = {{plotSize}}

# Créer la grille
grid_params = {
    'TYPE': 2,  # Rectangle
    'EXTENT': source_layer.extent(),
    'HSPACING': cell_size,
    'VSPACING': cell_size,
    'CRS': source_layer.crs(),
    'OUTPUT': 'memory:{{outputGrid}}'
}
grid_result = processing.run("native:creategrid", grid_params)
grid_layer = grid_result['OUTPUT']

# Découper la grille selon la zone source
clip_params = {
    'INPUT': grid_layer,
    'OVERLAY': source_layer,
    'OUTPUT': 'memory:{{outputGrid}}_clipped'
}
clipped_grid = processing.run("native:clip", clip_params)['OUTPUT']

# Créer les centroïdes
centroid_params = {
    'INPUT': clipped_grid,
    'ALL_PARTS': False,
    'OUTPUT': 'memory:{{outputCentroids}}'
}
centroids_layer = processing.run("native:centroids", centroid_params)['OUTPUT']

# Ajouter un attribut pour le rayon
centroids_layer.startEditing()
centroids_layer.addAttribute(QgsField("rayon_placette", QVariant.Double))
for feature in centroids_layer.getFeatures():
    feature["rayon_placette"] = plot_radius
    centroids_layer.updateFeature(feature)
centroids_layer.commitChanges()

# Ajouter au projet
QgsProject.instance().addMapLayer(clipped_grid)
QgsProject.instance().addMapLayer(centroids_layer)

print(f"Grille créée: {clipped_grid.featureCount()} mailles")
print(f"Centroïdes créés: {centroids_layer.featureCount()} placettes de {plot_radius}m de rayon")
`,
    exampleUsage: "Crée une grille d'inventaire de 250m avec placettes de 15m de rayon",
    estimatedDuration: "rapide",
  },

  // Templates d'analyse
  {
    id: "buffer-analysis",
    name: "Analyse tampon multi-distances",
    description: "Crée plusieurs zones tampon à différentes distances pour analyse d'impact",
    category: "analysis",
    tags: ["buffer", "tampon", "zones", "impact"],
    parameters: [
      {
        id: "sourceLayer",
        name: "Couche source",
        description: "Couche autour de laquelle créer les tampons",
        type: "layer",
        required: true,
      },
      {
        id: "distances",
        name: "Distances",
        description: "Distances des tampons en mètres (séparées par des virgules)",
        type: "text",
        required: true,
        defaultValue: "100, 250, 500",
      },
      {
        id: "outputPrefix",
        name: "Préfixe de sortie",
        description: "Préfixe pour les couches créées",
        type: "text",
        required: true,
        defaultValue: "Tampon",
      },
    ],
    code: `
from qgis.core import QgsProject, QgsVectorLayer
import processing

source = QgsProject.instance().mapLayersByName("{{sourceLayer}}")[0]
distances = [int(d.strip()) for d in "{{distances}}".split(",")]

for dist in distances:
    params = {
        'INPUT': source,
        'DISTANCE': dist,
        'SEGMENTS': 8,
        'DISSOLVE': False,
        'OUTPUT': f'memory:{{outputPrefix}}_{dist}m'
    }
    result = processing.run("native:buffer", params)
    layer = result['OUTPUT']
    layer.setName(f"{{outputPrefix}}_{dist}m")
    QgsProject.instance().addMapLayer(layer)
    print(f"Tampon {dist}m créé: {layer.featureCount()} entités")
`,
    exampleUsage: "Crée des tampons à 100m, 250m et 500m autour des entités",
    estimatedDuration: "rapide",
  },

  // Templates d'export
  {
    id: "batch-export",
    name: "Export batch multi-formats",
    description: "Exporte toutes les couches visibles dans plusieurs formats simultanément",
    category: "export",
    tags: ["export", "batch", "multi-format", "gpkg", "geojson"],
    parameters: [
      {
        id: "outputDirectory",
        name: "Dossier de sortie",
        description: "Dossier où sauvegarder les fichiers",
        type: "directory",
        required: true,
      },
      {
        id: "formats",
        name: "Formats",
        description: "Formats d'export",
        type: "choice",
        required: true,
        defaultValue: "gpkg",
        options: ["gpkg", "geojson", "shp", "kml", "all"],
      },
      {
        id: "crs",
        name: "Système de coordonnées",
        description: "EPSG code (ex: 2154 pour Lambert 93)",
        type: "text",
        required: true,
        defaultValue: "EPSG:2154",
      },
      {
        id: "onlyVisible",
        name: "Couches visibles uniquement",
        description: "Exporter uniquement les couches actuellement visibles",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
    code: `
from qgis.core import QgsProject, QgsVectorFileWriter, QgsCoordinateReferenceSystem
import os

output_dir = "{{outputDirectory}}"
formats = "{{formats}}"
target_crs = QgsCoordinateReferenceSystem("{{crs}}")
only_visible = {{onlyVisible}}

if formats == "all":
    formats = ["gpkg", "geojson", "shp"]
else:
    formats = [formats]

layers_exported = 0

for layer in QgsProject.instance().mapLayers().values():
    if only_visible and not layer.isVisible():
        continue
    if not layer.type() == QgsMapLayer.VectorLayer:
        continue
    
    for fmt in formats:
        filename = f"{layer.name()}.{fmt}"
        filepath = os.path.join(output_dir, filename)
        
        options = QgsVectorFileWriter.SaveVectorOptions()
        options.driverName = "GPKG" if fmt == "gpkg" else ("GeoJSON" if fmt == "geojson" else "ESRI Shapefile")
        options.ct = QgsCoordinateTransform(layer.crs(), target_crs, QgsProject.instance())
        
        error = QgsVectorFileWriter.writeAsVectorFormat(layer, filepath, options)
        if error[0] == QgsVectorFileWriter.NoError:
            layers_exported += 1
            print(f"Exporté: {filename}")
        else:
            print(f"Erreur export {filename}: {error}")

print(f"\\n{layers_exported} couches exportées dans {len(formats)} format(s)")
`,
    exampleUsage: "Exporte toutes les couches visibles en GeoPackage et GeoJSON en Lambert 93",
    estimatedDuration: "moyen",
    requiresConfirmation: true,
  },

  // Templates de statistiques
  {
    id: "zonal-statistics",
    name: "Statistiques zonales avancées",
    description: "Calcule des statistiques zonales sur un raster pour des zones vectorielles",
    category: "analysis",
    tags: ["statistiques", "zonales", "raster", "analyse"],
    parameters: [
      {
        id: "vectorLayer",
        name: "Couche vectorielle (zones)",
        description: "Couche définissant les zones d'analyse",
        type: "layer",
        required: true,
      },
      {
        id: "rasterLayer",
        name: "Couche raster",
        description: "Couche raster source pour les statistiques",
        type: "layer",
        required: true,
      },
      {
        id: "band",
        name: "Bande",
        description: "Numéro de la bande à analyser",
        type: "number",
        required: true,
        defaultValue: 1,
        min: 1,
        max: 10,
      },
      {
        id: "statistics",
        name: "Statistiques",
        description: "Statistiques à calculer",
        type: "text",
        required: true,
        defaultValue: "mean,std,max,min,count",
      },
    ],
    code: `
from qgis.core import QgsProject, QgsZonalStatistics
import processing

vector = QgsProject.instance().mapLayersByName("{{vectorLayer}}")[0]
raster = QgsProject.instance().mapLayersByName("{{rasterLayer}}")[0]

stats_flags = 0
stats_list = "{{statistics}}".split(",")
for stat in stats_list:
    stat = stat.strip()
    if stat == "mean":
        stats_flags |= QgsZonalStatistics.Mean
    elif stat == "std":
        stats_flags |= QgsZonalStatistics.StdDev
    elif stat == "max":
        stats_flags |= QgsZonalStatistics.Max
    elif stat == "min":
        stats_flags |= QgsZonalStatistics.Min
    elif stat == "count":
        stats_flags |= QgsZonalStatistics.Count
    elif stat == "sum":
        stats_flags |= QgsZonalStatistics.Sum

zonal_stats = QgsZonalStatistics(vector, raster, "_", {{band}}, stats_flags)
zonal_stats.calculateStatistics(None)

print(f"Statistiques zonales calculées: {', '.join(stats_list)}")
print(f"Résultats ajoutés aux attributs de la couche '{vector.name()}'")
`,
    exampleUsage: "Calcule la moyenne, écart-type et max du MNT pour chaque parcelle",
    estimatedDuration: "moyen",
  },

  // Templates NDVI
  {
    id: "ndvi-analysis",
    name: "Analyse NDVI temporelle",
    description: "Compare le NDVI entre deux dates et identifie les zones de changement",
    category: "forest",
    tags: ["ndvi", "temporel", "comparaison", "forêt"],
    parameters: [
      {
        id: "ndviBefore",
        name: "NDVI période 1",
        description: "Couche raster NDVI (période de référence)",
        type: "layer",
        required: true,
      },
      {
        id: "ndviAfter",
        name: "NDVI période 2",
        description: "Couche raster NDVI (période de comparaison)",
        type: "layer",
        required: true,
      },
      {
        id: "threshold",
        name: "Seuil de changement",
        description: "Différence NDVI minimale pour considérer un changement",
        type: "number",
        required: true,
        defaultValue: 0.1,
        min: 0.01,
        max: 0.5,
        step: 0.01,
      },
      {
        id: "outputName",
        name: "Nom de sortie",
        description: "Nom de la couche de différence",
        type: "text",
        required: true,
        defaultValue: "NDVI_Difference",
      },
    ],
    code: `
from qgis.core import QgsProject
import processing
import numpy as np

ndvi1 = QgsProject.instance().mapLayersByName("{{ndviBefore}}")[0]
ndvi2 = QgsProject.instance().mapLayersByName("{{ndviAfter}}")[0]

# Calculer la différence
params = {
    'INPUT_A': ndvi1,
    'BAND_A': 1,
    'INPUT_B': ndvi2,
    'BAND_B': 1,
    'FORMULA': 'A - B',
    'OUTPUT': 'memory:{{outputName}}'
}

diff_layer = processing.run("gdal:rastercalculator", params)['OUTPUT']
diff_layer.setName("{{outputName}}")
QgsProject.instance().addMapLayer(diff_layer)

# Statistiques
stats = diff_layer.dataProvider().bandStatistics(1)
print(f"Différence NDVI calculée")
print(f"Min: {stats.minimumValue:.3f}, Max: {stats.maximumValue:.3f}")
print(f"Moyenne: {stats.mean:.3f}")

# Identifier les zones de changement significatif
threshold = {{threshold}}
print(f"Zones avec changement > {threshold}: à identifier par classification")
`,
    exampleUsage: "Compare le NDVI été 2023 vs été 2024 pour détecter le stress végétal",
    estimatedDuration: "moyen",
  },
];

// Fonctions utilitaires
export const fillTemplate = (template: ScriptTemplate, values: Record<string, any>): string => {
  let filledCode = template.code;
  
  for (const [key, value] of Object.entries(values)) {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    filledCode = filledCode.replace(placeholder, String(value));
  }
  
  return filledCode;
};

export const getTemplatesByCategory = (category: ScriptTemplate["category"]): ScriptTemplate[] => {
  return BUILTIN_TEMPLATES.filter(t => t.category === category);
};

export const searchTemplates = (query: string): ScriptTemplate[] => {
  const queryLower = query.toLowerCase();
  return BUILTIN_TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(queryLower) ||
    t.description.toLowerCase().includes(queryLower) ||
    t.tags.some(tag => tag.toLowerCase().includes(queryLower))
  );
};

export const getTemplateCategories = (): { id: ScriptTemplate["category"]; name: string; icon: string }[] => [
  { id: "forest", name: "Foresterie", icon: "Trees" },
  { id: "analysis", name: "Analyse spatiale", icon: "BarChart3" },
  { id: "processing", name: "Traitement", icon: "Settings" },
  { id: "data_management", name: "Gestion données", icon: "Database" },
  { id: "visualization", name: "Visualisation", icon: "Palette" },
  { id: "export", name: "Export", icon: "Download" },
  { id: "import", name: "Import", icon: "Upload" },
  { id: "custom", name: "Personnalisés", icon: "User" },
];

// Validation des paramètres
export const validateParameter = (param: TemplateParameter, value: any): string | null => {
  if (param.required && (value === undefined || value === null || value === "")) {
    return `Le paramètre "${param.name}" est requis`;
  }
  
  if (param.type === "number" && value !== undefined) {
    const num = Number(value);
    if (isNaN(num)) return `"${param.name}" doit être un nombre`;
    if (param.min !== undefined && num < param.min) return `"${param.name}" doit être ≥ ${param.min}`;
    if (param.max !== undefined && num > param.max) return `"${param.name}" doit être ≤ ${param.max}`;
  }
  
  if (param.type === "choice" && param.options && value) {
    if (!param.options.includes(value)) {
      return `"${param.name}" doit être l'une des options: ${param.options.join(", ")}`;
    }
  }
  
  return null;
};

// Génération de l'aperçu
export const generatePreview = (template: ScriptTemplate, values: Record<string, any>): string => {
  const filled = fillTemplate(template, values);
  // Extraire les 5 premières lignes significatives
  const lines = filled.split("\n").filter(l => l.trim() && !l.startsWith("#"));
  return lines.slice(0, 5).join("\n") + (lines.length > 5 ? "\n..." : "");
};
