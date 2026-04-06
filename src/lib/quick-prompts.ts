import type { LucideIcon } from "lucide-react";

export interface QuickPrompt {
  id: string;
  title: string;
  description: string;
  iconName: string;
  prompt: string;
  category: "analysis" | "data" | "visualization" | "export" | "general";
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "forest-analysis",
    title: "Analyse forestière",
    description: "Analyser les peuplements forestiers et essences",
    iconName: "Layers",
    prompt: "Analyse les peuplements forestiers de la zone d'étude. Donne-moi les types d'essences présentes, leur répartition, et les surfaces par type de peuplement.",
    category: "analysis",
  },
  {
    id: "ndvi-analysis",
    title: "Santé forestière NDVI",
    description: "Analyser la santé des arbres avec NDVI",
    iconName: "Globe",
    prompt: "Charge le NDVI Sentinel-2 et analyse la santé de la forêt. Identifie les zones de stress hydrique, les zones saines, et les zones nécessitant une attention particulière.",
    category: "analysis",
  },
  {
    id: "soil-rum-analysis",
    title: "Analyse sol RUM",
    description: "Analyser la Réserve Utile Maximale des sols",
    iconName: "BarChart3",
    prompt: "Charge la Réserve Utile Maximale des sols (RUM) et analyse la capacité de rétention en eau. Identifie les zones favorables à la plantation et les zones à risque de sécheresse.",
    category: "analysis",
  },
  {
    id: "inventory-grid",
    title: "Grille d'inventaire",
    description: "Créer une grille d'inventaire forestier",
    iconName: "BarChart3",
    prompt: "Crée une grille d'inventaire forestier de 250m x 250m sur la couche forestière sélectionnée, avec centroïdes pour les relevés terrain.",
    category: "data",
  },
  {
    id: "geology-analysis",
    title: "Analyse géologique",
    description: "Analyser la carte géologique BRGM",
    iconName: "Search",
    prompt: "Charge la carte géologique BRGM et analyse le sous-sol de la zone d'étude. Identifie les types de roches, les zones sismiques, et les mines/carrières.",
    category: "analysis",
  },
  {
    id: "topography-analysis",
    title: "Analyse topographique",
    description: "Analyser le SCAN25 et MNT IGN",
    iconName: "Globe",
    prompt: "Charge le SCAN25 IGN et le MNT pour analyser la topographie. Identifie les pentes, l'exposition, et les zones favorables à l'exploitation forestière.",
    category: "analysis",
  },
  {
    id: "export-forest-stats",
    title: "Export forestier",
    description: "Exporter les statistiques forestières en CSV",
    iconName: "FileText",
    prompt: "Exporte les statistiques des peuplements forestiers dans un fichier CSV avec les essences, surfaces, et données de structure.",
    category: "export",
  },
  {
    id: "forest-fire-risk",
    title: "Risque feu forestier",
    description: "Analyser le risque de feu avec MODIS",
    iconName: "Zap",
    prompt: "Charge le détecteur de feu MODIS et analyse les zones à risque d'incendie forestier dans la zone d'étude.",
    category: "analysis",
  },
];
