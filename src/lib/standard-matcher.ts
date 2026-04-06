/**
 * Standard Matcher Engine
 * 
 * Moteur de matching entre la demande utilisateur et les normes cartographiques
 * Utilise le LLM pour analyser la demande et sélectionner les normes les plus appropriées
 */

import { CartographicStandard, ALL_STANDARDS } from "./cartographic-standards-international";

export interface StandardMatch {
  standard: CartographicStandard;
  confidence: number;
  reasons: string[];
  conflicts?: string[];
  layerTypeMatches: LayerTypeMatch[];
}

export interface LayerTypeMatch {
  layerTypeId: string;
  layerTypeName: string;
  matchConfidence: number;
  reasons: string[];
}

export interface UserRequestAnalysis {
  domain: string[];
  keywords: string[];
  explicitStandards: string[];
  explicitOrganizations: string[];
  layerTypes: string[];
  outputFormat: string;
  scale: string;
  region?: string;
  context: string[];
}

export interface MatchingResult {
  matches: StandardMatch[];
  selectedStandards: CartographicStandard[];
  combinedStandard?: CombinedStandard;
  warnings: string[];
  analysis: UserRequestAnalysis;
}

export interface CombinedStandard {
  id: string;
  name: string;
  description: string;
  baseStandards: string[];
  layerMappings: LayerMapping[];
  layoutRules: any;
  conflicts: string[];
}

export interface LayerMapping {
  layerId: string;
  standardId: string;
  layerTypeId: string;
  priority: number;
}

/**
 * Analyse la demande de l'utilisateur pour extraire les informations pertinentes
 */
export async function analyzeRequest(userRequest: string): Promise<UserRequestAnalysis> {
  // Utiliser le LLM pour analyser la demande
  const prompt = `Analyse cette demande de cartographie et extrait les informations suivantes en JSON:

Demande: "${userRequest}"

Extrait:
1. domain: Liste des domaines concernés (forestry, urban, agriculture, environment, topography, geology, hydrology, energy)
2. keywords: Mots-clés pertinents (ex: peuplement, PSG, CNPF, forêt, carte, layout, etc.)
3. explicitStandards: Normes explicitement mentionnées (ex: PSG, CNPF, ONF, IGN, IFN, etc.)
4. explicitOrganizations: Organisations explicitement mentionnées (ex: ONF, CNPF, CRPF, IGN, BRGM, etc.)
5. layerTypes: Types de couches demandés (ex: peuplements, limites, routes, bati, etc.)
6. outputFormat: Format de sortie demandé (ex: PDF, image, etc.)
7. scale: Échelle mentionnée (ex: 1/2000, détaillée, etc.)
8. region: Région mentionnée (ex: France, Europe, etc.)
9. context: Contexte de la demande (ex: gestion, inventaire, aménagement, etc.)

Réponds uniquement en JSON valide sans markdown.`;

  try {
    // Pour l'instant, on utilise une analyse simple basée sur les mots-clés
    // Dans une implémentation complète, on utiliserait le LLM
    return simpleRequestAnalysis(userRequest);
  } catch (error) {
    console.error("Error analyzing request:", error);
    return simpleRequestAnalysis(userRequest);
  }
}

/**
 * Analyse simple basée sur les mots-clés (fallback)
 */
function simpleRequestAnalysis(text: string): UserRequestAnalysis {
  const lowerText = text.toLowerCase();
  
  const domain: string[] = [];
  if (lowerText.includes("forêt") || lowerText.includes("forest") || lowerText.includes("peuplement") || lowerText.includes("psg")) {
    domain.push("forestry");
  }
  if (lowerText.includes("urban") || lowerText.includes("ville") || lowerText.includes("bâti")) {
    domain.push("urban");
  }
  if (lowerText.includes("agriculture") || lowerText.includes("culture") || lowerText.includes("prairie")) {
    domain.push("agriculture");
  }
  if (lowerText.includes("environnement") || lowerText.includes("biodiversité") || lowerText.includes("nature")) {
    domain.push("environment");
  }
  if (lowerText.includes("topographie") || lowerText.includes("route") || lowerText.includes("bâtiment")) {
    domain.push("topography");
  }
  if (lowerText.includes("géologie") || lowerText.includes("sol")) {
    domain.push("geology");
  }
  if (lowerText.includes("hydro") || lowerText.includes("eau")) {
    domain.push("hydrology");
  }
  if (lowerText.includes("énergie") || lowerText.includes("éolien") || lowerText.includes("solaire")) {
    domain.push("energy");
  }
  
  const keywords = extractKeywords(text);
  
  const explicitStandards = [];
  const standardKeywords = {
    "psg": "psg-2023",
    "cnpf": "cnpf-2024",
    "onf": "onf-2024",
    "ign": "ign-2024",
    "ifn": "ifn-2022",
    "brgm": "brgm-2024",
    "inrae": "inrae-2023",
    "cerema": "cerema-2024",
    "dreal": "dreal-2023",
    "ademe": "ademe-2023",
    "ofb": "ofb-2024",
    "inspire": "inspire-2024",
    "copernicus": "copernicus-2024",
  };
  
  for (const [keyword, standardId] of Object.entries(standardKeywords)) {
    if (lowerText.includes(keyword)) {
      explicitStandards.push(standardId);
    }
  }
  
  const explicitOrganizations = [];
  const orgKeywords = ["onf", "cnpf", "crpf", "ign", "brgm", "inrae", "cerema", "dreal", "ademe", "ofb"];
  for (const org of orgKeywords) {
    if (lowerText.includes(org)) {
      explicitOrganizations.push(org.toUpperCase());
    }
  }
  
  const layerTypes = [];
  const layerKeywords = {
    "peuplement": "peuplements",
    "limit": "limites",
    "route": "routes",
    "bâti": "bati",
    "culture": "cultures",
    "sol": "sols",
    "aquifère": "aquiferes",
    "zone": "zones",
    "placette": "placettes",
    "éolien": "eolien",
    "solaire": "solaire",
    "espèce": "especes",
  };
  
  for (const [keyword, layerType] of Object.entries(layerKeywords)) {
    if (lowerText.includes(keyword)) {
      layerTypes.push(layerType);
    }
  }
  
  const outputFormat = lowerText.includes("pdf") ? "PDF" : lowerText.includes("image") ? "image" : "";
  const scale = lowerText.includes("1/2000") ? "1/2000" : lowerText.includes("détaillée") ? "détaillée" : "";
  const region = lowerText.includes("france") ? "France" : lowerText.includes("europe") ? "Europe" : undefined;
  
  const context = [];
  if (lowerText.includes("gestion")) context.push("gestion");
  if (lowerText.includes("inventaire")) context.push("inventaire");
  if (lowerText.includes("aménagement")) context.push("amenagement");
  if (lowerText.includes("protection")) context.push("protection");
  
  return {
    domain: domain.length > 0 ? domain : ["topography"],
    keywords,
    explicitStandards,
    explicitOrganizations,
    layerTypes,
    outputFormat,
    scale,
    region,
    context,
  };
}

/**
 * Extrait les mots-clés d'un texte
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "le", "la", "les", "un", "une", "des", "du", "de", "à", "au", "aux", "en", "dans", "sur", "pour",
    "avec", "par", "et", "ou", "mais", "où", "qui", "que", "qu'", "dont", "ce", "cet", "cette", "ces",
    "son", "sa", "ses", "mon", "ma", "mes", "notre", "votre", "leur", "leurs",
    "être", "avoir", "faire", "aller", "venir", "voir", "prendre", "donner", "dire",
    "carte", "cartes", "créer", "créée", "réaliser", "réalisé", "générer", "générée", "produire", "produit",
    "je", "tu", "il", "elle", "nous", "vous", "ils", "elles",
    "très", "plus", "moins", "bien", "mal", "peu", "beaucoup", "trop", "assez",
  ]);
  
  const words = text
    .toLowerCase()
    .replace(/[^\wàâäéèêëïîôùûüÿç]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  return [...new Set(words)];
}

/**
 * Calcule le score de confiance pour une norme donnée
 */
function calculateConfidence(analysis: UserRequestAnalysis, standard: CartographicStandard): number {
  let score = 0;
  
  // Domaine match (40%)
  if (analysis.domain.includes(standard.domain)) {
    score += 0.4;
  }
  
  // Explicit standard mention (30%)
  if (analysis.explicitStandards.includes(standard.id)) {
    score += 0.3;
  }
  
  // Explicit organization mention (15%)
  if (analysis.explicitOrganizations.includes(standard.organization)) {
    score += 0.15;
  }
  
  // Keywords match (10%)
  const keywordMatches = analysis.keywords.filter(kw =>
    standard.description.toLowerCase().includes(kw) ||
    standard.name.toLowerCase().includes(kw) ||
    standard.metadata.tags.some(tag => tag.toLowerCase().includes(kw))
  );
  score += (keywordMatches.length / Math.max(analysis.keywords.length, 1)) * 0.1;
  
  // Layer types match (5%)
  const layerTypeMatches = analysis.layerTypes.filter(lt =>
    standard.layerTypes.some(st => st.name.toLowerCase().includes(lt.toLowerCase()))
  );
  score += (layerTypeMatches.length / Math.max(analysis.layerTypes.length, 1)) * 0.05;
  
  return Math.min(score, 1.0);
}

/**
 * Génère les raisons du matching
 */
function generateReasons(analysis: UserRequestAnalysis, standard: CartographicStandard): string[] {
  const reasons: string[] = [];
  
  if (analysis.domain.includes(standard.domain)) {
    reasons.push(`Domaine "${standard.domain}" correspond à la demande`);
  }
  
  if (analysis.explicitStandards.includes(standard.id)) {
    reasons.push(`Norme "${standard.name}" explicitement demandée`);
  }
  
  if (analysis.explicitOrganizations.includes(standard.organization)) {
    reasons.push(`Organisation "${standard.organization}" mentionnée`);
  }
  
  const keywordMatches = analysis.keywords.filter(kw =>
    standard.description.toLowerCase().includes(kw) ||
    standard.name.toLowerCase().includes(kw)
  );
  if (keywordMatches.length > 0) {
    reasons.push(`Mots-clés correspondants: ${keywordMatches.slice(0, 3).join(", ")}`);
  }
  
  const layerTypeMatches = analysis.layerTypes.filter(lt =>
    standard.layerTypes.some(st => st.name.toLowerCase().includes(lt.toLowerCase()))
  );
  if (layerTypeMatches.length > 0) {
    reasons.push(`Types de couches correspondants: ${layerTypeMatches.join(", ")}`);
  }
  
  if (analysis.region && standard.metadata.region === analysis.region) {
    reasons.push(`Région "${standard.metadata.region}" correspond`);
  }
  
  return reasons;
}

/**
 * Détecte les conflits potentiels
 */
function detectConflicts(analysis: UserRequestAnalysis, standard: CartographicStandard): string[] {
  const conflicts: string[] = [];
  
  // Vérifier si les champs requis sont disponibles
  const missingFields = standard.layerTypes
    .filter(lt => analysis.layerTypes.includes(lt.name.toLowerCase()))
    .flatMap(lt => lt.requiredFields)
    .map(f => f.name)
    .filter(field => !analysis.keywords.includes(field.toLowerCase()));
  
  if (missingFields.length > 0) {
    conflicts.push(`Champs requis potentiellement manquants: ${missingFields.slice(0, 3).join(", ")}`);
  }
  
  // Vérifier la compatibilité du format de sortie
  if (analysis.outputFormat && !standard.metadata.mandatoryElements.includes(analysis.outputFormat.toLowerCase())) {
    conflicts.push(`Format de sortie "${analysis.outputFormat}" non standard pour cette norme`);
  }
  
  // Vérifier la compatibilité de l'échelle
  if (analysis.scale) {
    const scaleMatch = standard.scaleRanges.some(sr =>
      analysis.scale.includes(sr.recommendedScale.toString()) ||
      analysis.scale.includes(sr.description.toLowerCase())
    );
    if (!scaleMatch && standard.scaleRanges.length > 0) {
      conflicts.push(`Échelle "${analysis.scale}" peut ne pas être optimale (recommandé: ${standard.scaleRanges[0].recommendedScale})`);
    }
  }
  
  return conflicts;
}

/**
 * Match les types de couches
 */
function matchLayerTypes(analysis: UserRequestAnalysis, standard: CartographicStandard): LayerTypeMatch[] {
  const matches: LayerTypeMatch[] = [];
  
  for (const layerType of standard.layerTypes) {
    const layerNameLower = layerType.name.toLowerCase();
    
    // Vérifier si le type de couche est mentionné
    const explicitMatch = analysis.layerTypes.some(lt => layerNameLower.includes(lt.toLowerCase()));
    
    // Vérifier si des mots-clés correspondent
    const keywordMatch = analysis.keywords.some(kw => layerNameLower.includes(kw.toLowerCase()));
    
    if (explicitMatch || keywordMatch) {
      const confidence = explicitMatch ? 0.9 : 0.6;
      const reasons = explicitMatch 
        ? [`Type de couche "${layerType.name}" explicitement demandé`]
        : [`Mots-clés correspondent au type "${layerType.name}"`];
      
      matches.push({
        layerTypeId: layerType.id,
        layerTypeName: layerType.name,
        matchConfidence: confidence,
        reasons,
      });
    }
  }
  
  return matches;
}

/**
 * Match les normes avec la demande de l'utilisateur
 */
export async function matchStandard(userRequest: string): Promise<MatchingResult> {
  // 1. Analyser la demande
  const analysis = await analyzeRequest(userRequest);
  
  // 2. Calculer le score pour chaque norme
  const matches: StandardMatch[] = ALL_STANDARDS.map(standard => ({
    standard,
    confidence: calculateConfidence(analysis, standard),
    reasons: generateReasons(analysis, standard),
    conflicts: detectConflicts(analysis, standard),
    layerTypeMatches: matchLayerTypes(analysis, standard),
  }));
  
  // 3. Filtrer et trier par confiance
  const filteredMatches = matches
    .filter(match => match.confidence > 0.2)
    .sort((a, b) => b.confidence - a.confidence);
  
  // 4. Sélectionner les normes
  const selectedStandards = selectStandards(filteredMatches, analysis);
  
  // 5. Si plusieurs normes, les combiner
  let combinedStandard: CombinedStandard | undefined;
  if (selectedStandards.length > 1) {
    combinedStandard = combineStandards(selectedStandards, analysis);
  }
  
  // 6. Générer les warnings
  const warnings = generateWarnings(filteredMatches, analysis);
  
  return {
    matches: filteredMatches,
    selectedStandards,
    combinedStandard,
    warnings,
    analysis,
  };
}

/**
 * Sélectionne les normes à utiliser
 */
function selectStandards(matches: StandardMatch[], analysis: UserRequestAnalysis): CartographicStandard[] {
  // Si des normes sont explicitement demandées, les utiliser
  if (analysis.explicitStandards.length > 0) {
    const explicitMatches = matches.filter(m => analysis.explicitStandards.includes(m.standard.id));
    if (explicitMatches.length > 0) {
      return explicitMatches.map(m => m.standard);
    }
  }
  
  // Sélectionner les normes avec une confiance > 0.5
  const highConfidence = matches.filter(m => m.confidence > 0.5);
  
  if (highConfidence.length === 0) {
    // Prendre la meilleure
    return matches.length > 0 ? [matches[0].standard] : [];
  }
  
  // Vérifier si l'utilisateur veut plusieurs normes
  const multipleKeywords = ["et", "avec", "combine", "plus", "aussi"];
  const wantsMultiple = multipleKeywords.some(kw => analysis.keywords.includes(kw));
  
  if (wantsMultiple) {
    return highConfidence.map(m => m.standard);
  }
  
  return [highConfidence[0].standard];
}

/**
 * Combine plusieurs normes
 */
function combineStandards(standards: CartographicStandard[], analysis: UserRequestAnalysis): CombinedStandard {
  const combined: CombinedStandard = {
    id: `combined-${Date.now()}`,
    name: `Combinaison: ${standards.map(s => s.name).join(" + ")}`,
    description: `Norme combinée basée sur ${standards.map(s => s.name).join(", ")}`,
    baseStandards: standards.map(s => s.id),
    layerMappings: [],
    layoutRules: mergeLayoutRules(standards, analysis),
    conflicts: [],
  };
  
  // Mapper les types de couches aux normes
  for (const standard of standards) {
    for (const layerType of standard.layerTypes) {
      const existingMapping = combined.layerMappings.find(
        m => m.layerTypeId === layerType.id
      );
      
      if (existingMapping) {
        // Conflit : même type de couche dans plusieurs normes
        combined.conflicts.push(
          `Type de couche "${layerType.name}" défini dans plusieurs normes (${standard.organization})`
        );
      } else {
        combined.layerMappings.push({
          layerId: layerType.id,
          standardId: standard.id,
          layerTypeId: layerType.id,
          priority: standards.indexOf(standard) * 10,
        });
      }
    }
  }
  
  return combined;
}

/**
 * Fusionne les règles de mise en page
 */
function mergeLayoutRules(standards: CartographicStandard[], analysis: UserRequestAnalysis): any {
  // Utiliser les règles de mise en page de la norme la plus confidente
  const priorityStandard = standards[0];
  
  if (!priorityStandard) {
    // Fusionner les règles de toutes les normes
    return {
      pageSizes: [...new Set(standards.flatMap(s => s.layoutRules.pageSizes.map(p => p.size)))],
      orientations: [...new Set(standards.flatMap(s => s.layoutRules.orientations.map(o => o.orientation)))],
      mandatoryElements: [...new Set(standards.flatMap(s => s.layoutRules.mandatoryElements))],
      optionalElements: [...new Set(standards.flatMap(s => s.layoutRules.optionalElements))],
    };
  }
  
  return priorityStandard.layoutRules;
}

/**
 * Génère des warnings
 */
function generateWarnings(matches: StandardMatch[], analysis: UserRequestAnalysis): string[] {
  const warnings: string[] = [];
  
  if (matches.length === 0) {
    warnings.push("Aucune norme cartographique correspondante trouvée");
  }
  
  const highConfidence = matches.filter(m => m.confidence > 0.7);
  if (highConfidence.length === 0 && matches.length > 0) {
    warnings.push("Confiance faible dans les normes sélectionnées");
  }
  
  const conflicts = matches.flatMap(m => m.conflicts || []);
  if (conflicts.length > 0) {
    warnings.push(`Conflits détectés: ${conflicts.slice(0, 3).join(", ")}`);
  }
  
  if (analysis.layerTypes.length > 0) {
    const matchedLayers = matches.flatMap(m => m.layerTypeMatches);
    if (matchedLayers.length < analysis.layerTypes.length) {
      warnings.push("Certains types de couches demandés ne sont pas couverts par les normes");
    }
  }
  
  return warnings;
}

/**
 * Helper function pour obtenir une norme par ID
 */
export function getStandardById(id: string): CartographicStandard | undefined {
  return ALL_STANDARDS.find(standard => standard.id === id);
}

/**
 * Helper function pour obtenir les normes par domaine
 */
export function getStandardsByDomain(domain: string): CartographicStandard[] {
  return ALL_STANDARDS.filter(standard => standard.domain === domain);
}

/**
 * Helper function pour obtenir les normes par organisation
 */
export function getStandardsByOrganization(organization: string): CartographicStandard[] {
  return ALL_STANDARDS.filter(standard => standard.organization === organization);
}
