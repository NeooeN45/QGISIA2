/**
 * Symbology Applier Engine
 * 
 * Moteur d'application des symbologies selon les normes cartographiques
 * Applique automatiquement les styles, labels et rendus aux couches QGIS
 * Utilise runScriptDetailed pour exécuter du code PyQGIS
 */

import { CartographicStandard, SymbologyRule, Category, LabelSettings } from "./cartographic-standards";
import { runScriptDetailed } from "./qgis";

export interface SymbologyApplicationResult {
  success: boolean;
  layerId: string;
  standardId: string;
  appliedRules: string[];
  errors: string[];
  warnings: string[];
}

export interface BatchSymbologyResult {
  results: SymbologyApplicationResult[];
  successCount: number;
  failureCount: number;
  warnings: string[];
}

/**
 * Applique la symbologie d'une norme à une couche
 */
export async function applyStandardSymbology(
  layerId: string,
  layerTypeName: string,
  standard: CartographicStandard
): Promise<SymbologyApplicationResult> {
  const result: SymbologyApplicationResult = {
    success: false,
    layerId,
    standardId: standard.id,
    appliedRules: [],
    errors: [],
    warnings: [],
  };
  
  try {
    // 1. Trouver la règle de symbologie correspondante
    const symbologyRule = standard.symbologyRules.find(
      rule => rule.layerTypeId === layerTypeName
    );
    
    if (!symbologyRule) {
      result.errors.push(`Aucune règle de symbologie trouvée pour le type de couche: ${layerTypeName}`);
      return result;
    }
    
    // 2. Générer et exécuter le script PyQGIS
    const script = generateSymbologyScript(layerId, layerTypeName, standard);
    const executionResult = await runScriptDetailed(script);
    
    if (!executionResult?.ok) {
      result.errors.push(`Échec de l'application de la symbologie: ${executionResult?.message}`);
      return result;
    }
    
    result.appliedRules.push(`Symbologie ${standard.name} appliquée`);
    
    if (symbologyRule.rendererType) {
      result.appliedRules.push(`Rendu: ${symbologyRule.rendererType}`);
    }
    
    if (symbologyRule.labelSettings?.enabled) {
      result.appliedRules.push(`Labels activés (champ: ${symbologyRule.labelSettings.field})`);
    }
    
    result.success = true;
  } catch (error) {
    result.errors.push(`Erreur lors de l'application de la symbologie: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return result;
}

/**
 * Applique la symbologie en lot à plusieurs couches
 */
export async function applyStandardSymbologyBatch(
  layerMappings: Array<{ layerId: string; layerTypeName: string }>,
  standard: CartographicStandard
): Promise<BatchSymbologyResult> {
  const results: SymbologyApplicationResult[] = [];
  const warnings: string[] = [];
  
  for (const mapping of layerMappings) {
    const result = await applyStandardSymbology(mapping.layerId, mapping.layerTypeName, standard);
    results.push(result);
    warnings.push(...result.warnings);
  }
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  return {
    results,
    successCount,
    failureCount,
    warnings,
  };
}

/**
 * Génère un script PyQGIS pour appliquer la symbologie
 */
export function generateSymbologyScript(
  layerId: string,
  layerTypeName: string,
  standard: CartographicStandard
): string {
  const symbologyRule = standard.symbologyRules.find(
    rule => rule.layerTypeId === layerTypeName
  );
  
  if (!symbologyRule) {
    return `# Aucune règle de symbologie trouvée pour ${layerTypeName}\n`;
  }
  
  let script = `# Application de la symbologie ${standard.name} pour ${layerTypeName}\n`;
  script += `# Couche: ${layerId}\n`;
  script += `# Norme: ${standard.id} - ${standard.name}\n\n`;
  
  script += `layer = QgsProject.instance().mapLayersByName('${layerId}')\n`;
  script += `if layer:\n`;
  script += `    layer = layer[0]\n`;
  script += `else:\n`;
  script += `    # Essayer par ID\n`;
  script += `    layer = QgsProject.instance().mapLayer('${layerId}')\n`;
  script += `if not layer:\n`;
  script += `    raise Exception(f"Couche non trouvée: ${layerId}")\n\n`;
  
  // Appliquer le rendu selon le type
  switch (symbologyRule.rendererType) {
    case "categorized":
      script += generateCategorizedScriptPart(layerId, symbologyRule);
      break;
    case "graduated":
      script += generateGraduatedScriptPart(layerId, symbologyRule);
      break;
    case "rule_based":
      script += generateRuleBasedScriptPart(layerId, symbologyRule);
      break;
    case "single_symbol":
      script += generateSingleSymbolScriptPart(layerId, symbologyRule);
      break;
    default:
      script += `# Type de rendu non supporté: ${symbologyRule.rendererType}\n`;
  }
  
  // Appliquer les labels si configurés
  if (symbologyRule.labelSettings?.enabled) {
    script += generateLabelScriptPart(layerId, symbologyRule.labelSettings);
  }
  
  script += `layer.triggerRepaint()\n`;
  
  return script;
}

/**
 * Génère le script pour un rendu catégorisé
 */
function generateCategorizedScriptPart(layerId: string, rule: SymbologyRule): string {
  let script = `# Rendu catégorisé\n`;
  
  if (rule.classificationField) {
    script += `field_name = '${rule.classificationField}'\n`;
    script += `idx = layer.fields().indexFromName(field_name)\n`;
    script += `if idx == -1:\n`;
    script += `    print(f"Attention: Champ {field_name} non trouvé dans la couche")\n\n`;
  }
  
  script += `categories = [\n`;
  
  if (rule.categories) {
    for (const cat of rule.categories) {
      script += `    {'value': '${cat.value}', 'label': '${cat.label}', 'color': '${cat.color}'`;
      if (cat.strokeColor) script += `, 'stroke': '${cat.strokeColor}'`;
      if (cat.strokeWidth) script += `, 'stroke_width': ${cat.strokeWidth}`;
      script += `},\n`;
    }
  }
  
  script += `]\n\n`;
  
  script += `from qgis.core import QgsCategorizedSymbolRenderer, QgsRendererCategory\n`;
  script += `from qgis.PyQt.QtGui import QColor\n\n`;
  
  script += `renderer = QgsCategorizedSymbolRenderer('${rule.classificationField || ''}')\n`;
  script += `for cat in categories:\n`;
  script += `    symbol = QgsMarkerSymbol()\n`;
  script += `    symbol.setColor(QColor(cat['color']))\n`;
  script += `    if 'stroke' in cat:\n`;
  script += `        symbol.symbolLayer(0).setStrokeColor(QColor(cat['stroke']))\n`;
  script += `    if 'stroke_width' in cat:\n`;
  script += `        symbol.symbolLayer(0).setStrokeWidth(cat['stroke_width'])\n`;
  script += `    renderer.addCategory(QgsRendererCategory(cat['value'], symbol, cat['label']))\n\n`;
  
  script += `layer.setRenderer(renderer)\n`;
  
  return script;
}

/**
 * Génère le script pour un rendu gradué
 */
function generateGraduatedScriptPart(layerId: string, rule: SymbologyRule): string {
  let script = `# Rendu gradué\n`;
  
  if (rule.classificationField) {
    script += `field_name = '${rule.classificationField}'\n`;
    script += `idx = layer.fields().indexFromName(field_name)\n`;
    script += `if idx == -1:\n`;
    script += `    print(f"Attention: Champ {field_name} non trouvé dans la couche")\n\n`;
  }
  
  script += `ranges = [\n`;
  
  if (rule.ranges) {
    for (const range of rule.ranges) {
      script += `    {'min': ${range.min}, 'max': ${range.max}, 'label': '${range.label}', 'color': '${range.color}'`;
      if (range.strokeColor) script += `, 'stroke': '${range.strokeColor}'`;
      if (range.strokeWidth) script += `, 'stroke_width': ${range.strokeWidth}`;
      script += `},\n`;
    }
  }
  
  script += `]\n\n`;
  
  script += `from qgis.core import QgsGraduatedSymbolRenderer, QgsRendererRange\n`;
  script += `from qgis.PyQt.QtGui import QColor\n\n`;
  
  script += `renderer = QgsGraduatedSymbolRenderer('${rule.classificationField || ''}')\n`;
  script += `for r in ranges:\n`;
  script += `    symbol = QgsMarkerSymbol()\n`;
  script += `    symbol.setColor(QColor(r['color']))\n`;
  script += `    if 'stroke' in r:\n`;
  script += `        symbol.symbolLayer(0).setStrokeColor(QColor(r['stroke']))\n`;
  script += `    if 'stroke_width' in r:\n`;
  script += `        symbol.symbolLayer(0).setStrokeWidth(r['stroke_width'])\n`;
  script += `    renderer.addClassRange(QgsRendererRange(r['min'], r['max'], symbol, r['label']))\n\n`;
  
  script += `layer.setRenderer(renderer)\n`;
  
  return script;
}

/**
 * Génère le script pour un rendu basé sur des règles
 */
function generateRuleBasedScriptPart(layerId: string, rule: SymbologyRule): string {
  let script = `# Rendu basé sur des règles\n`;
  
  script += `rules = [\n`;
  
  if (rule.rules) {
    for (const r of rule.rules) {
      script += `    {'filter': '${r.filter}', 'label': '${r.label}', 'color': '${r.color}'`;
      if (r.strokeColor) script += `, 'stroke': '${r.strokeColor}'`;
      if (r.strokeWidth) script += `, 'stroke_width': ${r.strokeWidth}`;
      script += `},\n`;
    }
  }
  
  script += `]\n\n`;
  
  script += `from qgis.core import QgsRuleBasedRenderer\n`;
  script += `from qgis.PyQt.QtGui import QColor\n\n`;
  
  script += `root_rule = QgsRuleBasedRenderer.Rule(QgsMarkerSymbol())\n`;
  script += `for r in rules:\n`;
  script += `    symbol = QgsMarkerSymbol()\n`;
  script += `    symbol.setColor(QColor(r['color']))\n`;
  script += `    if 'stroke' in r:\n`;
  script += `        symbol.symbolLayer(0).setStrokeColor(QColor(r['stroke']))\n`;
  script += `    if 'stroke_width' in r:\n`;
  script += `        symbol.symbolLayer(0).setStrokeWidth(r['stroke_width'])\n`;
  script += `    rule = QgsRuleBasedRenderer.Rule(symbol, r['filter'])\n`;
  script += `    rule.setLabel(r['label'])\n`;
  script += `    root_rule.appendChildRule(rule)\n\n`;
  
  script += `renderer = QgsRuleBasedRenderer(root_rule)\n`;
  script += `layer.setRenderer(renderer)\n`;
  
  return script;
}

/**
 * Génère le script pour un rendu symbole unique
 */
function generateSingleSymbolScriptPart(layerId: string, rule: SymbologyRule): string {
  let script = `# Rendu symbole unique\n`;
  
  const color = rule.categories?.[0]?.color || "#000000";
  const strokeColor = rule.categories?.[0]?.strokeColor || "#000000";
  const strokeWidth = rule.categories?.[0]?.strokeWidth || 1;
  
  script += `from qgis.PyQt.QtGui import QColor\n\n`;
  script += `symbol = QgsMarkerSymbol()\n`;
  script += `symbol.setColor(QColor('${color}'))\n`;
  script += `symbol.symbolLayer(0).setStrokeColor(QColor('${strokeColor}'))\n`;
  script += `symbol.symbolLayer(0).setStrokeWidth(${strokeWidth})\n`;
  script += `layer.setRenderer(QgsSingleSymbolRenderer(symbol))\n`;
  
  return script;
}

/**
 * Génère le script pour les labels
 */
function generateLabelScriptPart(layerId: string, settings: LabelSettings): string {
  let script = `# Labels\n`;
  script += `from qgis.core import QgsPalLayerSettings, QgsTextFormat\n`;
  script += `from qgis.PyQt.QtGui import QColor\n\n`;
  
  script += `layer.setLabelsEnabled(${settings.enabled})\n`;
  script += `label_settings = QgsPalLayerSettings()\n`;
  script += `label_settings.fieldName = '${settings.field}'\n`;
  
  script += `text_format = QgsTextFormat()\n`;
  script += `text_format.setSize(${settings.fontSize})\n`;
  script += `text_format.setColor(QColor('${settings.color}'))\n`;
  
  if (settings.bufferEnabled) {
    script += `buffer_settings = text_format.buffer()\n`;
    script += `buffer_settings.setEnabled(True)\n`;
    script += `buffer_settings.setSize(${settings.bufferSize})\n`;
    script += `buffer_settings.setColor(QColor('${settings.bufferColor}'))\n`;
  }
  
  script += `label_settings.setFormat(text_format)\n`;
  script += `layer.setLabeling(label_settings)\n`;
  
  return script;
}
