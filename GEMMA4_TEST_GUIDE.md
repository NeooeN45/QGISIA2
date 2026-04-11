# Guide de Test : Comparer les Versions de Gemma 4

## 🎯 Objectif
Trouver la meilleure version de Gemma 4 pour QGISAI+ en testant la qualité et la performance.

## 📋 Versions à Tester

| Version | Taille | RAM Min | Vitesse | Qualité | Idéal Pour |
|---------|--------|---------|---------|---------|------------|
| **gemma4:4b** | ~2.5GB | 6GB | ⚡ Très rapide | ⭐⭐⭐⭐ Bonne | Machines modestes, réponses rapides |
| **gemma4:9b** | ~5.5GB | 12GB | ⚡ Rapide | ⭐⭐⭐⭐⭐ Excellente | Compromis idéal qualité/vitesse |
| **gemma4:12b** | ~7.5GB | 16GB | 🚀 Modérée | ⭐⭐⭐⭐⭐⭐ Supérieure | Meilleure qualité, machines puissantes |
| **gemma4:27b** | ~17GB | 32GB | 🐢 Lente | ⭐⭐⭐⭐⭐⭐⭐ Maximale | Qualité maximale, stations de travail |

## 🧪 Scénarios de Test

### Test 1 : Question Simple QGIS
**Prompt** : "Comment ajouter une couche vectorielle dans QGIS ?"

**Critères d'évaluation** :
- [ ] Réponse correcte et complète
- [ ] Temps de réponse
- [ ] Clarté des explications
- [ ] Précision technique

### Test 2 : Code PyQGIS
**Prompt** : "Écris un script PyQGIS pour créer une couche de points avec 5 entités aléatoires dans l'emprise de la carte"

**Critères d'évaluation** :
- [ ] Code fonctionnel
- [ ] Syntaxe correcte
- [ ] Commentaires explicatifs
- [ ] Bonnes pratiques

### Test 3 : Analyse Complexe
**Prompt** : "Explique-moi la différence entre les systèmes de coordonnées projetées et géographiques, et quand utiliser chacun dans un projet SIG forestier"

**Critères d'évaluation** :
- [ ] Compréhension du contexte
- [ ] Explications claires
- [ ] Exemples pertinents
- [ ] Réponse structurée

### Test 4 : Instructions Multi-étapes
**Prompt** : "Je veux analyser la pente d'un MNT, la classer en 5 catégories, et créer un histogramme de distribution. Donne-moi la procédure complète"

**Critères d'évaluation** :
- [ ] Étapes logiques
- [ ] Outils QGIS corrects
- [ ] Paramètres précis
- [ ] Résultat attendu décrit

### Test 5 : Analyse d'Image (si multimodal activé)
**Prompt** : [Capture d'écran d'une carte QGIS] "Analyse cette carte et suggère des améliorations"

**Critères d'évaluation** :
- [ ] Compréhension visuelle
- [ ] Suggestions pertinentes
- [ ] Explications détaillées

## 📊 Grille d'Évaluation

Pour chaque version et chaque test, note de 1 à 5 :

| Critère | Description | Note |
|---------|-------------|------|
| **Qualité** | Précision et pertinence | 1-5 |
| **Vitesse** | Temps de réponse | 1-5 |
| **Clarté** | Facilité de compréhension | 1-5 |
| **Code** | Qualité du code (si applicable) | 1-5 |

## 🏆 Score Total

Pour chaque version, calcule le score total :
```
Score = (Qualité × 2) + Vitesse + (Clarté × 1.5) + (Code × 2)
```

La version avec le score le plus élevé sera la meilleure pour ton usage.

## 📈 Interprétation des Résultats

### Si gemma4:4b gagne
✅ **Parfait pour** : Ordinateurs portables, réponses rapides, tâches simples
⚠️ **Limites** : Complexité limitée, pas de tâches très avancées

### Si gemma4:9b gagne
✅ **Parfait pour** : Compromis idéal, usage quotidien professionnel
⚠️ **Limites** : Très rarement - c'est le "sweet spot"

### Si gemma4:12b gagne
✅ **Parfait pour** : Utilisation intensive, code complexe, analyse approfondie
⚠️ **Limites** : Nécessite une machine puissante (16GB+ RAM)

### Si gemma4:27b gagne
✅ **Parfait pour** : Qualité maximale, stations de travail haut de gamme
⚠️ **Limites** : Très lent, consommateur de ressources, overkill pour la plupart

## 🗑️ Nettoyage Après Test

Une fois le gagnant identifié, supprime les autres versions pour libérer de l'espace :

```powershell
# Dans PowerShell, exécutez :
ollama rm gemma4:4b    # Si 9b, 12b ou 27b gagne
ollama rm gemma4:9b    # Si 12b ou 27b gagne  
ollama rm gemma4:12b   # Si 27b gagne
ollama rm gemma4:27b   # Si 4b, 9b ou 12b gagne

# Supprimer aussi les autres gros modèles si présents
ollama rm mixtral:8x7b       # 47GB
ollama rm llama3.1:70b      # 40GB+
ollama rm qwen2.5:72b       # 40GB+
```

## ⚙️ Configuration Optimale Recommandée

Après avoir choisi la version gagnante, configure-la par défaut dans le plugin :

**Settings → Modèles Locaux → Sélectionner le gagnant**

Paramètres recommandés :
```yaml
temperature: 0.7      # Créatif mais cohérent
topP: 0.95           # Bonne diversité
maxTokens: 8192       # Réponses complètes
repeatPenalty: 1.1    # Évite répétitions
numGpu: -1           # Auto-détection GPU
```

## 📝 Formulaire de Test

Copie ce tableau pour noter tes résultats :

| Test | 4b | 9b | 12b | 27b |
|------|----|----|-----|-----|
| 1. Simple QGIS | Q:_, V:_, C:_, Code:_ | ... | ... | ... |
| 2. Code PyQGIS | Q:_, V:_, C:_, Code:_ | ... | ... | ... |
| 3. Analyse Complexe | Q:_, V:_, C:_, Code:_ | ... | ... | ... |
| 4. Multi-étapes | Q:_, V:_, C:_, Code:_ | ... | ... | ... |
| **SCORE TOTAL** | | | | |

**Gagnant** : _______________

---

💡 **Astuce** : La version 9B est généralement le meilleur compromis pour la plupart des utilisateurs.
