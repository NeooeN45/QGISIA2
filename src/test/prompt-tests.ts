/**
 * 🧪 Tests de validation des fonctionnalités QGISAI+
 * Liste des scénarios de test pour validation manuelle
 */

export const TEST_SCENARIOS = {
  // Tests de performance serveur
  server: {
    startup: "⏱️ Démarrage serveur: ~900ms (Vite v6.4.1)",
    preview: "✅ Preview navigateur: Instantané après démarrage",
    hotReload: "⚡ Hot reload: ~50-100ms",
  },
  
  // Prompts forestiers
  forest: [
    { input: "inv foret", expected: "Suggestions d'inventaire forestier" },
    { input: "calcul surface bois", expected: "Analyse de surface" },
    { input: "grille 250m", expected: "Template grille forestière" },
    { input: "placettes inventaire", expected: "Suggestions de placettes" },
  ],
  
  // Prompts cadastre
  cadastre: [
    { input: "charg cadastre", expected: "Chargement cadastre" },
    { input: "section cadastrale", expected: "Analyse section" },
    { input: "surface parcelle", expected: "Calcul surface" },
  ],
  
  // Prompts analyse spatiale
  analysis: [
    { input: "buff 100m", expected: "Buffer/tampon" },
    { input: "intersect couches", expected: "Intersection" },
    { input: "reproj L93", expected: "Reprojection" },
  ],
  
  // Prompts mal formulés (robustesse)
  robustness: [
    { input: "calcl surf parcel", expected: "Normalisation: calcul surface parcelle" },
    { input: "buff", expected: "Complétion automatique" },
    { input: "aide", expected: "Mode explication" },
  ],
};

export const UI_TESTS = {
  SmartSuggestionsBar: [
    "✅ S'affiche quand on tape dans le chat",
    "✅ Disparaît après envoi du message",
    "✅ Navigation clavier (↑↓ Enter)",
    "✅ Groupes visibles (Action, Layer, Parameter)",
  ],
  SemanticAutocomplete: [
    "✅ Apparaît sur patterns reconnus (buff, calcul, export)",
    "✅ Tab accepte la suggestion",
    "✅ Style grisé (ghost text) visible",
  ],
  ScriptTemplateModal: [
    "✅ Bouton 📄 ouvre le modal",
    "✅ Catégories cliquables",
    "✅ Paramètres éditables",
    "✅ Bouton Exécuter fonctionne",
  ],
  FeedbackWidget: [
    "✅ Apparaît après réponse assistant",
    "✅ 3 boutons de rating",
    "✅ Formulaire détail pour 'À améliorer'",
  ],
};

// Manuel: Exécuter dans la console du navigateur
export const runManualTests = () => {
  console.log("🧪 Tests QGISAI+");
  console.log("\nScénarios de test:");
  
  Object.entries(TEST_SCENARIOS).forEach(([category, tests]) => {
    console.log(`\n📁 ${category}:`);
    if (Array.isArray(tests)) {
      tests.forEach((t: any) => {
        console.log(`  • "${t.input}" → ${t.expected}`);
      });
    } else {
      Object.entries(tests).forEach(([key, value]) => {
        console.log(`  ${value}`);
      });
    }
  });
  
  console.log("\n✅ Tests UI:");
  Object.entries(UI_TESTS).forEach(([component, tests]) => {
    console.log(`\n${component}:`);
    tests.forEach(t => console.log(`  ${t}`));
  });
};

export default TEST_SCENARIOS;
