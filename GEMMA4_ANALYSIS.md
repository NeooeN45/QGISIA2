# Analyse : Gemma 4 et Problème d'Installation

## 🔍 Diagnostic du Problème d'Installation

### Problème Identifié
Le code d'installation (`pullOllamaModel` dans `ollama-auto-detect.ts`) ne vérifie **PAS** si Ollama est démarré avant de tenter le téléchargement. Il fait directement un `fetch()` vers `localhost:11434` qui va échouer silencieusement si Ollama n'est pas lancé.

### Localisation du Code Problématique
```typescript
// ollama-auto-detect.ts ligne 390-405
export async function pullOllamaModel(
  modelName: string,
  onProgress: (progress: PullProgress) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("http://localhost:11434/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, stream: true }),
      signal,
    });
    // ...
  }
}
```

## 🎯 Analyse de Gemma 4 comme Meilleur Modèle

### Pourquoi Gemma 4 est Idéal pour le Plugin

| Critère | Gemma 4 | Autres Modèles |
|---------|---------|------------------|
| **Taille optimale** | 4B, 9B, 12B, 27B | Mixtral 8x7B = 47GB, Llama 70B = 40GB+ |
| **Multimodal natif** | ✅ Images + texte | ❌ La plupart sont texte seul |
| **Code Python** | Excellente capacité | Variable |
| **Français** | Très bon | Dépend du modèle |
| **Licence** | Open (Google) | Mixte |
| **Contexte** | Jusqu'à 128K tokens | Souvent 8K-32K |

### Recommandation de la Variante "E"

La variante "E" mentionnée correspond probablement à :
- **`gemma4:4b`** - Version standard (recommandée pour QGIS)
- **`gemma4:9b`** - Meure performance
- **`gemma4:12b`** - Excellent compromis
- **`gemma4:27b`** - Maximum de qualité (nécessite 32GB+ RAM)

**⚠️ Erreur courante** : Le nom exact sur Ollama est `gemma4` (pas `gemma-4` ou `gemma_4`).

## 🔧 Corrections Nécessaires

### 1. Vérification Ollama avant Installation
Ajouter un check avant le `pull`:

```typescript
// Avant le fetch dans pullOllamaModel
const isOllamaRunning = await detectOllama();
if (!isOllamaRunning) {
  return { 
    success: false, 
    error: "Ollama n'est pas démarré. Veuillez lancer Ollama d'abord." 
  };
}
```

### 2. Meilleure Gestion d'Erreurs
Le code actuel retourne juste `success: false` sans explication. Il faut:
- Afficher l'erreur HTTP exacte
- Proposer des solutions (démarrer Ollama, vérifier le nom)
- Logger pour débogage

### 3. Timeout Amélioré
Le stream de téléchargement peut durer longtemps. Ajouter un timeout configurable:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000); // 30 min
```

## 📊 Configuration Optimale Recommandée pour Gemma 4

```typescript
// Paramètres recommandés dans settings.ts
const GEMMA4_OPTIMAL_SETTINGS = {
  model: "gemma4:4b",  // ou 9b/12b selon RAM
  temperature: 0.7,     // Créatif mais cohérent
  topP: 0.95,          // Diversité conservée
  maxTokens: 8192,     // Réponses complètes
  repeatPenalty: 1.1,  // Évite répétitions
  numGpu: -1,          // Auto-détection GPU
  numCtx: 8192,        // Contexte étendu
};
```

## 🚀 Actions à Prendre

1. **Corriger la vérification Ollama** avant installation
2. **Ajouter Gemma 4:4b comme modèle par défaut** recommandé
3. **Améliorer les messages d'erreur** d'installation
4. **Tester le flux complet** avec Gemma 4

## 📝 Notes sur la "Variante E"

Si "E" fait référence à une version spécifique:
- Vérifier le nom exact sur https://ollama.com/library/gemma4
- Les variantes officielles sont : `4b`, `9b`, `12b`, `27b`
- Chaque variante a des sous-variants quantisés (`q4_0`, `q5_0`, etc.)

**À vérifier** : Demander à l'utilisateur le nom exact de la variante "E" ou vérifier s'il s'agit d'une confusion avec `gemma4:4b-it` (version instruct).
