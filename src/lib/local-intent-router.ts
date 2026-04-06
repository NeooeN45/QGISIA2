import { ConversationMode } from "./chat-history";
import { appendDebugEvent } from "./debug-log";
import {
  loadOfficialSource,
  searchCadastreParcels,
  searchGeoApiCommunes,
} from "./official-sources";
import {
  applyParcelStylePreset,
  createInventoryGrid,
  filterLayer,
  getLayerDiagnostics,
  getLayersCatalog,
  getLayerStatistics,
  mergeRasterBands,
  setLayerLabels,
  zoomToLayer,
} from "./qgis";

interface LocalIntentResult {
  handled: boolean;
  response?: string;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanupPlaceName(value: string): string {
  return value
    .replace(/^(?:la|le|les)\s+/i, "")
    .replace(
      /\s+(?=(?:en cadastre|au cadastre|sur le cadastre|avec le cadastre|et\b|puis\b))/i,
      " ",
    )
    .split(/\s+(?=(?:en cadastre|au cadastre|sur le cadastre|avec le cadastre|et\b|puis\b))/i)[0]
    .replace(
      /\b(en cadastre|au cadastre|sur le cadastre|avec le cadastre|et centre dessus|et centrer dessus|et zoome dessus|et zoom dessus|et centre sur.*|et zoome sur.*|puis.*)$/i,
      "",
    )
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function toDisplayName(value: string): string {
  return value
    .split(/([\s'-]+)/)
    .map((part) => {
      if (/^[\s'-]+$/.test(part)) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

function extractCommuneName(message: string): string | null {
  const patterns = [
    /\bcommune de\s+([a-zà-ÿ' -]+?)(?=\s+(?:en cadastre|au cadastre|sur le cadastre|avec le cadastre|et\b|puis\b)|$)/i,
    /\bville de\s+([a-zà-ÿ' -]+?)(?=\s+(?:en cadastre|au cadastre|sur le cadastre|avec le cadastre|et\b|puis\b)|$)/i,
    /\bcadastre de\s+([a-zà-ÿ' -]+?)(?=\s+(?:et\b|puis\b)|$)/i,
    /\bajoute(?:r)?\s+(?:la\s+commune\s+de\s+|le\s+cadastre\s+de\s+)?([a-zà-ÿ' -]+?)(?=\s+(?:en cadastre|au cadastre|sur le cadastre|avec le cadastre|et\b|puis\b)|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const candidate = cleanupPlaceName(match?.[1] || "");
    if (candidate) {
      return toDisplayName(candidate);
    }
  }

  return null;
}

function wantsCadastre(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("cadastre") ||
    normalized.includes("parcelle") ||
    normalized.includes("parcellaire")
  );
}

function wantsZoom(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("centre") ||
    normalized.includes("centrer") ||
    normalized.includes("zoome") ||
    normalized.includes("zoom")
  );
}

function wantsLabels(message: string): boolean {
  const normalized = normalizeText(message);
  return normalized.includes("etiquet") || normalized.includes("label");
}

function wantsCommuneContours(message: string): boolean {
  const normalized = normalizeText(message);
  return normalized.includes("commune") || normalized.includes("contour");
}

function wantsOrthophoto(message: string): boolean {
  const normalized = normalizeText(message);
  return normalized.includes("orthophoto") || normalized.includes("ortho");
}

function wantsNasaGibs(message: string): boolean {
  const normalized = normalizeText(message);
  return normalized.includes("nasa gibs") || normalized.includes("gibs");
}

function wantsRasterBandMerge(message: string): boolean {
  const normalized = normalizeText(message);
  const indexMentioned =
    normalized.includes("ndvi") ||
    normalized.includes("crswir") ||
    normalized.includes("cr swir") ||
    normalized.includes("cr-swir");
  const years = extractYears(message);
  return (
    normalized.includes("fusion") ||
    normalized.includes("fusionne") ||
    normalized.includes("bi annuel") ||
    normalized.includes("biannuel") ||
    normalized.includes("bi-annuel") ||
    normalized.includes("multibande") ||
    normalized.includes("multi bande") ||
    normalized.includes("empile") ||
    (indexMentioned && years.length >= 2)
  );
}

function wantsLayerList(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    (normalized.includes("liste") && normalized.includes("couche")) ||
    (normalized.includes("combien") && normalized.includes("couche")) ||
    (normalized.includes("quelles") && normalized.includes("couche")) ||
    (normalized.includes("montre") && normalized.includes("couche")) ||
    normalized.includes("couches chargees") ||
    normalized.includes("couches presentes") ||
    normalized.includes("couches du projet")
  );
}

function wantsDiagnostic(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("diagnostic") ||
    normalized.includes("diagnostique") ||
    normalized.includes("qualite de la couche") ||
    normalized.includes("verifie la couche") ||
    normalized.includes("verifier la couche") ||
    normalized.includes("inspecte") ||
    normalized.includes("inspecter") ||
    (normalized.includes("resume") && normalized.includes("couche"))
  );
}

function wantsPlanIgn(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("plan ign") ||
    normalized.includes("fond de plan ign") ||
    normalized.includes("carte ign") ||
    (normalized.includes("fond") && normalized.includes("ign"))
  );
}

function wantsStatistics(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("statistique") ||
    normalized.includes("stats") ||
    (normalized.includes("moyenne") && normalized.includes("champ")) ||
    (normalized.includes("somme") && normalized.includes("champ")) ||
    (normalized.includes("min") && normalized.includes("max") && normalized.includes("champ"))
  );
}

function findMentionedLayer(
  message: string,
  layers: Awaited<ReturnType<typeof getLayersCatalog>>,
): Awaited<ReturnType<typeof getLayersCatalog>>[number] | null {
  const normalizedMessage = normalizeLayerMatchValue(message);
  for (const layer of layers) {
    if (normalizedMessage.includes(normalizeLayerMatchValue(layer.name))) {
      return layer;
    }
  }
  return null;
}

function wantsInventoryGrid(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("dispositif d'inventaire") ||
    normalized.includes("dispositif dinventaire") ||
    normalized.includes("grille d'inventaire") ||
    normalized.includes("grille dinventaire") ||
    normalized.includes("centroide") ||
    normalized.includes("centroides") ||
    normalized.includes("maille")
  );
}

function extractYears(message: string): string[] {
  const matches = message.match(/\b20\d{2}\b/g) || [];
  return [...new Set(matches)];
}

function extractIndexFamily(message: string): "NDVI" | "CRswir" | null {
  const normalized = normalizeText(message);
  if (normalized.includes("ndvi")) {
    return "NDVI";
  }
  if (
    normalized.includes("crswir") ||
    normalized.includes("cr swir") ||
    normalized.includes("cr-swir")
  ) {
    return "CRswir";
  }
  return null;
}

function normalizeLayerMatchValue(value: string): string {
  return normalizeText(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLayerYear(layerName: string): string | null {
  const match = layerName.match(/\b(20\d{2})\b/);
  return match?.[1] || null;
}

function buildCompositeOutputName(indexFamily: "NDVI" | "CRswir", years: string[]): string {
  if (years.length >= 2) {
    return `${indexFamily}_${years[0]}_${years[1]}_biannuel`;
  }
  return `${indexFamily}_biannuel`;
}

function parseNumericToken(value: string): number {
  return Number(value.replace(",", "."));
}

function parseInventoryGridSize(message: string): {
  cellWidth: number;
  cellHeight: number;
} {
  const dimensionMatch = message.match(
    /(\d+(?:[.,]\d+)?)\s*(?:m|metres?|meters?)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:m|metres?|meters?)?/i,
  );
  if (dimensionMatch) {
    return {
      cellWidth: parseNumericToken(dimensionMatch[1]),
      cellHeight: parseNumericToken(dimensionMatch[2]),
    };
  }

  const singleMatch = message.match(
    /\b(?:maille|mailles|grille|carreaux?)\s*(?:de|à|a)?\s*(\d+(?:[.,]\d+)?)\s*(?:m|metres?|meters?)\b/i,
  );
  if (singleMatch) {
    const size = parseNumericToken(singleMatch[1]);
    return { cellWidth: size, cellHeight: size };
  }

  return { cellWidth: 250, cellHeight: 250 };
}

function findRasterLayersForComposite(
  message: string,
  layers: Awaited<ReturnType<typeof getLayersCatalog>>,
  indexFamily: "NDVI" | "CRswir",
  years: string[],
) {
  const normalizedIndex = normalizeLayerMatchValue(indexFamily);
  const rasterLayers = layers.filter(
    (layer) =>
      normalizeText(layer.type) === "raster" &&
      normalizeLayerMatchValue(layer.name).includes(normalizedIndex),
  );

  if (rasterLayers.length === 0) {
    return { selected: [], candidates: [] as string[] };
  }

  if (years.length >= 2) {
    const selected = years
      .map((year) =>
        rasterLayers.find(
          (layer) =>
            normalizeLayerMatchValue(layer.name).includes(normalizedIndex) &&
            normalizeLayerMatchValue(layer.name).includes(year),
        ),
      )
      .filter((layer, index, current): layer is (typeof rasterLayers)[number] =>
        Boolean(layer) && current.findIndex((entry) => entry?.id === layer?.id) === index,
      );

    return {
      selected,
      candidates: rasterLayers.map((layer) => layer.name),
    };
  }

  const selected = [...rasterLayers]
    .sort((left, right) => {
      const leftYear = Number(extractLayerYear(left.name) || "0");
      const rightYear = Number(extractLayerYear(right.name) || "0");
      return leftYear - rightYear || left.name.localeCompare(right.name, "fr");
    })
    .slice(0, 2);

  return {
    selected,
    candidates: rasterLayers.map((layer) => layer.name),
  };
}

function findInventorySourceLayer(
  message: string,
  layers: Awaited<ReturnType<typeof getLayersCatalog>>,
) {
  const normalizedMessage = normalizeLayerMatchValue(message);
  const polygonLayers = layers.filter(
    (layer) =>
      normalizeText(layer.type) === "vector" &&
      normalizeText(layer.geometryType).includes("polygon"),
  );

  if (polygonLayers.length === 0) {
    return null;
  }

  const explicitlyMentioned = polygonLayers.find((layer) =>
    normalizedMessage.includes(normalizeLayerMatchValue(layer.name)),
  );
  if (explicitlyMentioned) {
    return explicitlyMentioned;
  }

  const prioritizedKeywords = ["emprise", "zone", "perimetre", "inventaire", "commune", "cadastre"];
  for (const keyword of prioritizedKeywords) {
    const match = polygonLayers.find((layer) =>
      normalizeLayerMatchValue(layer.name).includes(keyword),
    );
    if (match) {
      return match;
    }
  }

  const selectedLayer = polygonLayers.find((layer) => layer.selectedFeatureCount > 0);
  if (selectedLayer) {
    return selectedLayer;
  }

  return polygonLayers[0];
}

export async function tryHandleLocalIntent(
  message: string,
  conversationMode: ConversationMode,
): Promise<LocalIntentResult> {
  if (conversationMode !== "chat") {
    return { handled: false };
  }

  const communeName = extractCommuneName(message);

  if (communeName && wantsCadastre(message)) {
    const communeLookup = await searchGeoApiCommunes({
      name: communeName,
      limit: 1,
      addToMap: false,
    });
    const commune = communeLookup.communes[0];

    if (!commune?.code) {
      return {
        handled: true,
        response: `Je n'ai pas pu resoudre la commune "${communeName}" via geo.api.gouv.fr, donc je n'ai pas lance le chargement cadastral.`,
      };
    }

    const layerName = `Cadastre_${commune.nom.replace(/\s+/g, "_")}`;
    const cadastre = await searchCadastreParcels({
      codeInsee: commune.code,
      addToMap: true,
      layerName,
      sourceIgn: "PCI",
      limit: 5000,
    });

    if (cadastre.featureCount > 0) {
      await applyParcelStylePreset(layerName, "cadastre");
      if (wantsLabels(message)) {
        await setLayerLabels(layerName, "", true);
      }
      if (wantsZoom(message)) {
        await zoomToLayer(layerName);
      }
    }

    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Workflow cadastral execute",
      message: `Cadastre de ${commune.nom} charge via geo.api.gouv.fr + API Carto.`,
      details: `commune=${commune.nom}\ncode_insee=${commune.code}\nlayer=${layerName}\nfeatureCount=${cadastre.featureCount}\nzoom=${wantsZoom(message)}\nlabels=${wantsLabels(message)}`,
    });

    return {
      handled: true,
      response: [
        `J'ai execute un workflow cadastral structure pour **${commune.nom}**.`,
        `- code INSEE resolu: \`${commune.code}\``,
        `- couche ajoutee: \`${layerName}\``,
        `- parcelles chargees: ${cadastre.featureCount}`,
        "- style parcellaire applique",
        wantsLabels(message) ? "- etiquettes activees" : null,
        wantsZoom(message) ? "- carte centree sur la couche" : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (communeName && wantsCommuneContours(message)) {
    const layerName = `Commune_${communeName.replace(/\s+/g, "_")}`;
    const communeResult = await searchGeoApiCommunes({
      name: communeName,
      limit: 1,
      addToMap: true,
      layerName,
    });

    if (communeResult.count > 0 && wantsZoom(message)) {
      await zoomToLayer(layerName);
    }

    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Workflow commune execute",
      message: `Commune ${communeName} chargee via geo.api.gouv.fr.`,
      details: `layer=${layerName}\ncount=${communeResult.count}\nzoom=${wantsZoom(message)}`,
    });

    return {
      handled: true,
      response: [
        `J'ai charge la commune **${communeName}** depuis **geo.api.gouv.fr**.`,
        `- couche ajoutee: \`${layerName}\``,
        `- resultat(s): ${communeResult.count}`,
        wantsZoom(message) ? "- carte centree sur la couche" : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (wantsOrthophoto(message)) {
    const result = await loadOfficialSource("geopf-ortho");
    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Orthophoto officielle ajoutee",
      message: result.status,
      details: `source=${result.sourceId}`,
    });
    return {
      handled: true,
      response: `J'ai ajoute le flux officiel **${result.name}**.\n\n${result.status}`,
    };
  }

  if (wantsNasaGibs(message)) {
    const result = await loadOfficialSource("nasa-gibs-wms");
    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "NASA GIBS ajoute",
      message: result.status,
      details: `source=${result.sourceId}`,
    });
    return {
      handled: true,
      response: `J'ai ajoute le flux officiel **${result.name}**.\n\n${result.status}`,
    };
  }

  const indexFamily = extractIndexFamily(message);
  if (indexFamily && wantsRasterBandMerge(message)) {
    const years = extractYears(message);
    const layers = await getLayersCatalog();
    const rasterSelection = findRasterLayersForComposite(
      message,
      layers,
      indexFamily,
      years,
    );

    if (rasterSelection.selected.length < 2) {
      return {
        handled: true,
        response: [
          `Je n'ai pas trouvé deux rasters **${indexFamily}** compatibles pour construire l'image bi-annuelle demandée.`,
          rasterSelection.candidates.length > 0
            ? `Rasters candidats détectés : ${rasterSelection.candidates.map((name) => `\`${name}\``).join(", ")}`
            : "Aucun raster candidat correspondant n'est actuellement chargé dans QGIS.",
        ].join("\n"),
      };
    }

    const outputName = buildCompositeOutputName(indexFamily, years);
    const mergeResult = await mergeRasterBands(
      rasterSelection.selected.map((layer) => layer.id),
      outputName,
    );

    if (!mergeResult) {
      return {
        handled: true,
        response: `La fusion multi-bandes **${indexFamily}** a échoué côté QGIS.`,
      };
    }

    if (wantsZoom(message)) {
      await zoomToLayer(mergeResult.outputLayerName);
    }

    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Fusion bi-annuelle executee",
      message: `${indexFamily} fusionne en multi-bandes.`,
      details: `input=${mergeResult.inputLayers.join(", ")}\noutput=${mergeResult.outputLayerName}\noutputPath=${mergeResult.outputPath}`,
    });

    return {
      handled: true,
      response: [
        `J'ai construit l'image bi-annuelle **${indexFamily}** directement dans QGIS.`,
        `- rasters sources : ${mergeResult.inputLayers.map((name) => `\`${name}\``).join(", ")}`,
        `- couche produite : \`${mergeResult.outputLayerName}\``,
        mergeResult.outputPath ? `- fichier : \`${mergeResult.outputPath}\`` : null,
        "- bandes séparées activées",
        wantsZoom(message) ? "- carte centrée sur le composite" : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (wantsLayerList(message)) {
    const layers = await getLayersCatalog();
    if (layers.length === 0) {
      return {
        handled: true,
        response: "Le projet QGIS est actuellement vide : aucune couche n'est chargée.",
      };
    }

    const summary = layers.map((layer, i) => {
      const typeLabel = [layer.type, layer.geometryType].filter(Boolean).join(" / ") || "inconnu";
      const featureInfo = typeof layer.featureCount === "number" ? `${layer.featureCount} entité(s)` : "nb inconnu";
      return `${i + 1}. **${layer.name}** — ${typeLabel} · ${layer.crs || "CRS inconnu"} · ${featureInfo} · ${layer.visible ? "visible" : "masquée"}`;
    });

    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Liste des couches",
      message: `${layers.length} couche(s) listée(s).`,
    });

    return {
      handled: true,
      response: [
        `Le projet QGIS contient **${layers.length} couche(s)** :\n`,
        ...summary,
      ].join("\n"),
    };
  }

  if (wantsDiagnostic(message)) {
    const layers = await getLayersCatalog();
    if (layers.length === 0) {
      return {
        handled: true,
        response: "Aucune couche chargée, impossible de lancer un diagnostic.",
      };
    }

    const targetLayer = findMentionedLayer(message, layers) || layers[0];
    const diag = await getLayerDiagnostics(targetLayer.id);
    if (!diag) {
      return {
        handled: true,
        response: `Le diagnostic de la couche **${targetLayer.name}** n'a pas pu être récupéré.`,
      };
    }

    const warnings = diag.warnings.length > 0
      ? `\n\n**Alertes** :\n${diag.warnings.map((w) => `- ⚠️ ${w}`).join("\n")}`
      : "\n\nAucune alerte détectée.";

    const fieldSummary = diag.fieldDiagnostics.slice(0, 8).map(
      (f) => `- \`${f.name}\` (${f.type}) — remplissage ${Math.round(f.fillRate * 100)}%`,
    );

    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Diagnostic couche",
      message: `Diagnostic de ${targetLayer.name} complété.`,
    });

    return {
      handled: true,
      response: [
        `## Diagnostic de **${targetLayer.name}**`,
        `- Type : ${diag.layerType} / ${diag.geometryType}`,
        `- CRS : ${diag.crs}`,
        `- Entités : ${diag.featureCount ?? "inconnu"} (${diag.sampledFeatureCount} échantillonnées${diag.isSampled ? ", échantillonnage actif" : ""})`,
        `- Géométries invalides : ${diag.invalidGeometryCount}`,
        `- Géométries vides : ${diag.emptyGeometryCount}`,
        diag.subsetString ? `- Filtre actif : \`${diag.subsetString}\`` : null,
        warnings,
        fieldSummary.length > 0 ? `\n**Champs** (${diag.fieldDiagnostics.length} total) :\n${fieldSummary.join("\n")}` : null,
        diag.fieldDiagnostics.length > 8 ? `- ... et ${diag.fieldDiagnostics.length - 8} autres champs` : null,
      ].filter(Boolean).join("\n"),
    };
  }

  if (wantsPlanIgn(message)) {
    const result = await loadOfficialSource("geopf-plan");
    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Plan IGN ajouté",
      message: result.status,
    });
    return {
      handled: true,
      response: `J'ai ajouté le flux officiel **${result.name}**.\n\n${result.status}`,
    };
  }

  if (wantsStatistics(message)) {
    const layers = await getLayersCatalog();
    const targetLayer = findMentionedLayer(message, layers) || layers.find((l) => normalizeText(l.type) === "vector");
    if (!targetLayer) {
      return {
        handled: true,
        response: "Aucune couche vectorielle trouvée pour calculer les statistiques.",
      };
    }

    const fieldMatch = message.match(/champ\s+["'`]?([\w]+)["'`]?/i)
      || message.match(/field\s+["'`]?([\w]+)["'`]?/i);
    const fieldName = fieldMatch?.[1];

    if (!fieldName) {
      return {
        handled: true,
        response: `Précise le champ à analyser. Exemple : "statistiques du champ surface sur ${targetLayer.name}".`,
      };
    }

    const stats = await getLayerStatistics(targetLayer.id, fieldName);
    if (!stats) {
      return {
        handled: true,
        response: `Impossible de calculer les statistiques du champ \`${fieldName}\` sur **${targetLayer.name}**.`,
      };
    }

    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Statistiques calculées",
      message: `Stats de ${fieldName} sur ${targetLayer.name}.`,
    });

    return {
      handled: true,
      response: [
        `## Statistiques de \`${fieldName}\` sur **${targetLayer.name}**`,
        `- Nombre : ${stats.count}`,
        `- Somme : ${stats.sum}`,
        `- Moyenne : ${stats.mean.toFixed(4)}`,
        `- Min : ${stats.min}`,
        `- Max : ${stats.max}`,
        `- Étendue : ${stats.range}`,
        `- Écart-type : ${stats.sampleStandardDeviation.toFixed(4)}`,
      ].join("\n"),
    };
  }

  if (wantsInventoryGrid(message)) {
    const layers = await getLayersCatalog();
    const sourceLayer = findInventorySourceLayer(message, layers);
    if (!sourceLayer) {
      return {
        handled: true,
        response:
          "Je n'ai trouvé aucune couche polygonale exploitable pour créer le dispositif d'inventaire. Charge d'abord une emprise, une commune ou une autre zone polygonale.",
      };
    }

    const { cellWidth, cellHeight } = parseInventoryGridSize(message);
    const safeBaseName = sourceLayer.name.replace(/\s+/g, "_");
    const gridName = `${safeBaseName}_grille_inventaire`;
    const centroidsName = `${safeBaseName}_centroides`;
    const result = await createInventoryGrid(
      sourceLayer.id,
      cellWidth,
      cellHeight,
      gridName,
      centroidsName,
      true,
    );

    if (!result) {
      return {
        handled: true,
        response: "La création de la grille d'inventaire a échoué côté QGIS.",
      };
    }

    if (wantsZoom(message)) {
      await zoomToLayer(result.gridLayerName);
    }

    appendDebugEvent({
      level: "success",
      source: "local-router",
      title: "Dispositif d'inventaire execute",
      message: `Grille et centroides generes a partir de ${result.sourceLayerName}.`,
      details: `grid=${result.gridLayerName}\ncentroids=${result.centroidLayerName}\ncellWidth=${result.cellWidth}\ncellHeight=${result.cellHeight}\nclipped=${result.clipped}`,
    });

    return {
      handled: true,
      response: [
        `J'ai créé le dispositif d'inventaire sur **${result.sourceLayerName}**.`,
        `- grille : \`${result.gridLayerName}\``,
        `- centroides : \`${result.centroidLayerName}\``,
        `- maille : ${result.cellWidth} x ${result.cellHeight} (unités du CRS)`,
        result.clipped ? "- grille découpée à l'emprise source" : "- grille non découpée",
        wantsZoom(message) ? "- carte centrée sur la grille" : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return { handled: false };
}
