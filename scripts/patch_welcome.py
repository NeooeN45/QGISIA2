"""
Patch WelcomeScreen.tsx — ajoute 3 suggestions pour les nouveaux outils Devin.
IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI) — Superviseur : Claude Code 4.8 — 2026-06-08
"""
import pathlib

path = pathlib.Path("src/components/WelcomeScreen.tsx")
c = path.read_text(encoding="utf-8")

# 1. Ajouter TrendingUp dans les imports lucide (déjà Leaf, Map, etc.)
OLD1 = 'import { Database, Image as ImageIcon, Leaf, Map, Plus, Sparkles, TreePine, Waves, Layers as LayersIcon, BarChart3, ChevronDown } from "lucide-react";'
NEW1 = 'import { Database, Image as ImageIcon, Leaf, Map, Plus, Sparkles, TreePine, Waves, Layers as LayersIcon, BarChart3, ChevronDown, TrendingUp, Mic, Wrench } from "lucide-react";'
assert OLD1 in c, "Lucide import not found"
c = c.replace(OLD1, NEW1, 1)
print("1. Lucide imports OK")

# 2. Ajouter 3 suggestions dans baseSuggestions (juste avant le ];)
OLD2 = ('  {\n'
        '    id: "vision-improve",\n'
        '    icon: <Sparkles size={18} className="text-pink-400" />,\n'
        '    text: "Améliorer automatiquement la carte : rendu critiqué par l\'IA vision jusqu\'à la perfection",\n'
        '    accent: "group-hover:border-pink-500/30",\n'
        '  },\n'
        '];')
NEW2 = ('  {\n'
        '    id: "vision-improve",\n'
        '    icon: <Sparkles size={18} className="text-pink-400" />,\n'
        '    text: "Améliorer automatiquement la carte : rendu critiqué par l\'IA vision jusqu\'à la perfection",\n'
        '    accent: "group-hover:border-pink-500/30",\n'
        '  },\n'
        '  // ── Nouveaux outils natifs MCP (Devin CLI 2026-06-08) ──────────────────────\n'
        '  {\n'
        '    id: "predict-trend",\n'
        '    icon: <TrendingUp size={18} className="text-violet-400" />,\n'
        '    text: "Projeter la tendance NDVI des 5 dernières années et anticiper l\'état de la végétation à t+3",\n'
        '    accent: "group-hover:border-violet-500/30",\n'
        '  },\n'
        '  {\n'
        '    id: "voice-intent",\n'
        '    icon: <Mic size={18} className="text-fuchsia-400" />,\n'
        '    text: "Décris ce que tu veux faire en langage naturel — je le traduis en actions cartographiques QGIS",\n'
        '    accent: "group-hover:border-fuchsia-500/30",\n'
        '  },\n'
        '  {\n'
        '    id: "tools-panel",\n'
        '    icon: <Wrench size={18} className="text-amber-400" />,\n'
        '    text: "Ouvre le panneau Outils → Données pour charger Sentinel-2 réel et lancer un diagnostic satellite complet",\n'
        '    accent: "group-hover:border-amber-500/30",\n'
        '  },\n'
        '];')
assert OLD2 in c, "baseSuggestions tail not found"
c = c.replace(OLD2, NEW2, 1)
print("2. baseSuggestions OK")

path.write_text(c, encoding="utf-8")
print("Done.")
