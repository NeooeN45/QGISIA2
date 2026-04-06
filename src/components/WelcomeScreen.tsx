import { Database, Image as ImageIcon, Leaf, Map, Plus, Sparkles, TreePine, Waves, Layers as LayersIcon, BarChart3 } from "lucide-react";
import { motion } from "motion/react";
import QuickPromptsPanel from "./QuickPromptsPanel";
import { useMemo } from "react";

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void;
  layers?: Array<{ name: string; type?: string; geometryType?: string }>;
}

const baseSuggestions = [
  {
    id: "forest",
    icon: <TreePine size={18} className="text-emerald-400" />,
    text: "Ajouter les forêts publiques ONF et les peuplements forestiers IGN pour analyser la zone d'étude",
    accent: "group-hover:border-emerald-500/30",
  },
  {
    id: "topo",
    icon: <Map size={18} className="text-cyan-400" />,
    text: "Charger le SCAN25 IGN et la carte géologique BRGM pour une analyse topographique complète",
    accent: "group-hover:border-cyan-500/30",
  },
  {
    id: "soil",
    icon: <Waves size={18} className="text-blue-400" />,
    text: "Ajouter la Réserve Utile Maximale des sols (RUM) pour évaluer la capacité de rétention en eau",
    accent: "group-hover:border-blue-500/30",
  },
  {
    id: "ndvi",
    icon: <Leaf size={18} className="text-green-400" />,
    text: "Charger le NDVI Sentinel-2 et l'indice de végétation MODIS pour analyser la santé forestière",
    accent: "group-hover:border-green-500/30",
  },
  {
    id: "cadastre",
    icon: <Plus size={18} className="text-orange-400" />,
    text: "Ajouter le cadastre communal, appliquer un style cadastral et centrer la carte",
    accent: "group-hover:border-orange-500/30",
  },
  {
    id: "inventory",
    icon: <ImageIcon size={18} className="text-purple-400" />,
    text: "Créer un dispositif d'inventaire forestier avec grille et centroïdes sur la zone d'étude",
    accent: "group-hover:border-purple-500/30",
  },
  {
    id: "fusion",
    icon: <Sparkles size={18} className="text-pink-400" />,
    text: "Fusionner les rasters NDVI 2023 et 2024 en image bi-annuelle pour analyse temporelle",
    accent: "group-hover:border-pink-500/30",
  },
  {
    id: "compare",
    icon: <Database size={18} className="text-yellow-400" />,
    text: "Comparer les champs de mes couches forestières et détecter les incohérences de structure",
    accent: "group-hover:border-yellow-500/30",
  },
];

const getDynamicSuggestions = (layers: Array<{ name: string; type?: string; geometryType?: string }>) => {
  if (!layers || layers.length === 0) {
    return baseSuggestions;
  }

  const layerNames = layers.map(l => l.name.toLowerCase());
  const layerTypes = layers.map(l => (l.type || "").toLowerCase());
  const hasForest = layerNames.some(n => n.includes("forest") || n.includes("forêt") || n.includes("onf") || n.includes("peuplement"));
  const hasRaster = layerTypes.some(t => t.includes("raster"));
  const hasVector = layerTypes.some(t => t.includes("vector"));
  const hasTopo = layerNames.some(n => n.includes("scan") || n.includes("topo") || n.includes("brgm"));
  const hasSoil = layerNames.some(n => n.includes("sol") || n.includes("rum") || n.includes("eau"));
  const hasCadastre = layerNames.some(n => n.includes("cadastre") || n.includes("parcelle"));

  const contextualSuggestions = [];

  // Si des couches forestières sont chargées
  if (hasForest) {
    contextualSuggestions.push({
      id: "forest-ndvi",
      icon: <Leaf size={18} className="text-green-400" />,
      text: "Calculer le NDVI sur les forêts chargées pour analyser la santé de la végétation",
      accent: "group-hover:border-green-500/30",
    });
    contextualSuggestions.push({
      id: "forest-inventory",
      icon: <BarChart3 size={18} className="text-emerald-400" />,
      text: "Créer un inventaire forestier sur la zone des forêts chargées",
      accent: "group-hover:border-emerald-500/30",
    });
  }

  // Si des rasters sont chargés
  if (hasRaster) {
    contextualSuggestions.push({
      id: "raster-calc",
      icon: <Sparkles size={18} className="text-pink-400" />,
      text: "Appliquer un calcul raster sur les couches chargées (NDVI, MNS, formule personnalisée)",
      accent: "group-hover:border-pink-500/30",
    });
    contextualSuggestions.push({
      id: "raster-merge",
      icon: <Database size={18} className="text-purple-400" />,
      text: "Fusionner les bandes des rasters chargés en une image multi-spectrale",
      accent: "group-hover:border-purple-500/30",
    });
  }

  // Si des vecteurs sont chargés
  if (hasVector) {
    contextualSuggestions.push({
      id: "vector-stats",
      icon: <BarChart3 size={18} className="text-blue-400" />,
      text: "Calculer les statistiques des couches vectorielles chargées",
      accent: "group-hover:border-blue-500/30",
    });
    contextualSuggestions.push({
      id: "vector-buffer",
      icon: <Map size={18} className="text-cyan-400" />,
      text: "Créer des zones tampon autour des entités des couches chargées",
      accent: "group-hover:border-cyan-500/30",
    });
  }

  // Si couches topographiques
  if (hasTopo) {
    contextualSuggestions.push({
      id: "topo-analysis",
      icon: <Map size={18} className="text-cyan-400" />,
      text: "Analyser le relief et la topographie des couches chargées",
      accent: "group-hover:border-cyan-500/30",
    });
  }

  // Si couches sols
  if (hasSoil) {
    contextualSuggestions.push({
      id: "soil-analysis",
      icon: <Waves size={18} className="text-blue-400" />,
      text: "Analyser les caractéristiques des sols chargés",
      accent: "group-hover:border-blue-500/30",
    });
  }

  // Si cadastre
  if (hasCadastre) {
    contextualSuggestions.push({
      id: "cadastre-style",
      icon: <Plus size={18} className="text-orange-400" />,
      text: "Appliquer un style cadastral aux parcelles chargées",
      accent: "group-hover:border-orange-500/30",
    });
  }

  // Toujours ajouter des suggestions générales
  contextualSuggestions.push({
    id: "add-layer",
    icon: <LayersIcon size={18} className="text-gray-400" />,
    text: "Ajouter une nouvelle couche de données",
    accent: "group-hover:border-gray-500/30",
  });

  contextualSuggestions.push({
    id: "compare-layers",
    icon: <Database size={18} className="text-yellow-400" />,
    text: "Comparer les champs des couches chargées et détecter les incohérences",
    accent: "group-hover:border-yellow-500/30",
  });

  return contextualSuggestions.slice(0, 8);
};

export default function WelcomeScreen({ onSendMessage, layers = [] }: WelcomeScreenProps) {
  const suggestions = useMemo(() => getDynamicSuggestions(layers), [layers]);
  return (
    <div className="relative flex min-h-full flex-col justify-center overflow-hidden py-12">
      <div className="absolute left-1/4 top-1/4 -z-10 h-72 w-72 rounded-full bg-blue-600/8 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-emerald-600/8 blur-[120px]" />

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.6, ease: "easeOut" }}
        className="max-w-3xl text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-5xl"
      >
        Votre assistant{" "}
        <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-green-600 dark:from-emerald-300 dark:via-cyan-300 dark:to-green-300 bg-clip-text text-transparent">
          forestier IA
        </span>
        {" "}pour QGIS
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.6, ease: "easeOut" }}
        className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600 dark:text-white/45"
      >
        Accédez à 53 sources officielles (forêts, sols, géologie, topographie), analysez vos données forestières et automatisez vos workflows QGIS grâce à l'IA.
      </motion.p>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.07,
              delayChildren: 0.25,
            },
          },
        }}
        className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4"
      >
        {suggestions.map((suggestion) => (
          <motion.button
            key={suggestion.id}
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0 },
            }}
            whileHover={{ scale: 1.01, translateY: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => void onSendMessage(suggestion.text)}
            className={`group relative flex h-36 flex-col justify-between overflow-hidden rounded-3xl border border-gray-200 dark:border-[#333537]/40 bg-gray-50 dark:bg-[#1a1b1c] p-5 text-left shadow-sm dark:shadow-md transition-all hover:bg-gray-100 dark:hover:bg-[#222324] ${suggestion.accent}`}
            aria-label={suggestion.text}
          >
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gray-400/[0.03] dark:via-white/[0.03] to-transparent skew-x-12 transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative z-10 text-[13px] font-medium leading-relaxed text-gray-700 dark:text-white/70 transition-colors group-hover:text-gray-900 dark:group-hover:text-white/90">
              {suggestion.text}
            </span>
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 dark:border-white/8 bg-gray-200 dark:bg-white/[0.04] transition-all group-hover:bg-gray-300 dark:group-hover:bg-white/8">
              {suggestion.icon}
            </div>
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
        className="mt-8"
      >
        <QuickPromptsPanel onSelectPrompt={onSendMessage} />
      </motion.div>
    </div>
  );
}
