import {
  CallableTool,
  createPartFromFunctionResponse,
  FunctionCall,
  FunctionDeclaration,
  GenerateContentConfig,
  GoogleGenAI,
  Tool,
  Type,
} from "@google/genai";

import {
  createInventoryGrid,
  filterLayer,
  getLayerDiagnostics,
  getLayerFields,
  getLayersCatalog,
  getLayerStatistics,
  getLayersList,
  isQgisAvailable,
  mergeRasterBands,
  reprojectLayer,
  runScript,
  setLayerOpacity,
  setLayerVisibility,
  zoomToLayer,
} from "./qgis";
import {
  AppSettings,
  DEFAULT_GOOGLE_MODEL,
  getConfiguredGeminiApiKey,
} from "./settings";

const FALLBACK_MODEL = DEFAULT_GOOGLE_MODEL;

const SYSTEM_INSTRUCTION = `Tu es "GeoAI QGIS", un assistant expert en SIG et en automatisation PyQGIS.

Tu aides l'utilisateur à travailler directement dans QGIS, en français, avec des réponses concises et techniquement précises.

Règles de travail :
- Si l'utilisateur demande une action directe sur son projet QGIS, utilise l'outil le plus spécifique disponible.
- Pour une image bi-annuelle NDVI/CRswir, privilégie 'mergeRasterBands' avant tout script Python.
- Pour une grille d'inventaire avec centroïdes, privilégie 'createInventoryGrid' avant tout script Python.
- Si l'action ne peut pas être réalisée par un outil spécifique, génère un script PyQGIS clair et utilise 'runScript'.
- N'invente jamais l'état du projet. Utilise 'getLayersCatalog', 'getLayerDiagnostics', 'getLayersList', 'getLayerFields' ou 'getLayerStatistics' quand l'information est nécessaire.
- Pour une reprojection, demande ou utilise un code EPSG explicite.
- Quand un outil renvoie une erreur ou indique que QGIS n'est pas disponible, explique le problème et propose la prochaine étape.
- Quand tu fournis du code PyQGIS, garde des commentaires utiles, vérifie les préconditions et évite les scripts destructifs.`;

const DECLARATIONS = {
  getLayersList: {
    name: "getLayersList",
    description: "Retourner la liste des couches actuellement chargées dans le projet QGIS.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  } satisfies FunctionDeclaration,
  getLayersCatalog: {
    name: "getLayersCatalog",
    description:
      "Retourner le catalogue détaillé des couches QGIS avec visibilité, opacité, CRS et nombre d'entités.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  } satisfies FunctionDeclaration,
  getLayerFields: {
    name: "getLayerFields",
    description: "Retourner les champs attributaires d'une couche vectorielle.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche.",
        },
      },
      required: ["layerId"],
    },
  } satisfies FunctionDeclaration,
  getLayerDiagnostics: {
    name: "getLayerDiagnostics",
    description:
      "Retourner un diagnostic synthétique d'une couche avec alertes, emprise et qualité des champs.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche.",
        },
      },
      required: ["layerId"],
    },
  } satisfies FunctionDeclaration,
  filterLayer: {
    name: "filterLayer",
    description: "Appliquer un filtre QGIS à une couche.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche.",
        },
        subsetString: {
          type: Type.STRING,
          description: "Expression de filtre QGIS ou SQL.",
        },
      },
      required: ["layerId", "subsetString"],
    },
  } satisfies FunctionDeclaration,
  setLayerVisibility: {
    name: "setLayerVisibility",
    description: "Afficher ou masquer une couche dans le panneau de couches QGIS.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche.",
        },
        visible: {
          type: Type.BOOLEAN,
          description: "true pour afficher la couche, false pour la masquer.",
        },
      },
      required: ["layerId", "visible"],
    },
  } satisfies FunctionDeclaration,
  setLayerOpacity: {
    name: "setLayerOpacity",
    description: "Modifier l'opacité d'une couche entre 0 et 1.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche.",
        },
        opacity: {
          type: Type.NUMBER,
          description: "Opacité cible entre 0 et 1.",
        },
      },
      required: ["layerId", "opacity"],
    },
  } satisfies FunctionDeclaration,
  zoomToLayer: {
    name: "zoomToLayer",
    description: "Cadrer la vue QGIS sur une couche.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche.",
        },
      },
      required: ["layerId"],
    },
  } satisfies FunctionDeclaration,
  getLayerStatistics: {
    name: "getLayerStatistics",
    description: "Calculer des statistiques descriptives sur un champ numérique d'une couche.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche.",
        },
        field: {
          type: Type.STRING,
          description: "Nom du champ numérique.",
        },
      },
      required: ["layerId", "field"],
    },
  } satisfies FunctionDeclaration,
  reprojectLayer: {
    name: "reprojectLayer",
    description: "Reprojeter une couche vectorielle vers un autre CRS et ajouter la sortie au projet.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche source.",
        },
        targetCrs: {
          type: Type.STRING,
          description: "Code CRS cible, par exemple 'EPSG:4326'.",
        },
      },
      required: ["layerId", "targetCrs"],
    },
  } satisfies FunctionDeclaration,
  mergeRasterBands: {
    name: "mergeRasterBands",
    description:
      "Fusionner plusieurs rasters déjà chargés en un raster multi-bandes, utile pour des composites bi-annuels NDVI ou CRswir.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerIds: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: "Liste ordonnée des rasters à empiler.",
        },
        outputName: {
          type: Type.STRING,
          description: "Nom de la couche raster de sortie.",
        },
        outputPath: {
          type: Type.STRING,
          description: "Chemin absolu optionnel vers un GeoTIFF de sortie.",
        },
      },
      required: ["layerIds", "outputName"],
    },
  } satisfies FunctionDeclaration,
  createInventoryGrid: {
    name: "createInventoryGrid",
    description:
      "Créer une grille d'inventaire sur une couche polygonale et générer aussi les centroïdes des mailles.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layerId: {
          type: Type.STRING,
          description: "Nom ou identifiant de la couche polygonale source.",
        },
        cellWidth: {
          type: Type.NUMBER,
          description: "Largeur de maille dans l'unité du CRS.",
        },
        cellHeight: {
          type: Type.NUMBER,
          description: "Hauteur de maille dans l'unité du CRS.",
        },
        gridName: {
          type: Type.STRING,
          description: "Nom de la grille de sortie.",
        },
        centroidsName: {
          type: Type.STRING,
          description: "Nom de la couche de centroïdes.",
        },
        clipToSource: {
          type: Type.BOOLEAN,
          description: "true pour découper la grille à l'emprise source.",
        },
      },
      required: ["layerId", "cellWidth", "cellHeight", "gridName", "centroidsName"],
    },
  } satisfies FunctionDeclaration,
  runScript: {
    name: "runScript",
    description: "Exécuter un script Python PyQGIS validé par l'utilisateur dans QGIS.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        script: {
          type: Type.STRING,
          description: "Code Python PyQGIS à exécuter.",
        },
      },
      required: ["script"],
    },
  } satisfies FunctionDeclaration,
};

function requireString(
  args: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = args[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} est requis.`);
  }

  return value.trim();
}

function requireBoolean(
  args: Record<string, unknown>,
  key: string,
  label: string,
): boolean {
  const value = args[key];

  if (typeof value !== "boolean") {
    throw new Error(`${label} est requis.`);
  }

  return value;
}

function requireNumber(
  args: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = args[key];

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} est requis.`);
  }

  return value;
}

function requireStringArray(
  args: Record<string, unknown>,
  key: string,
  label: string,
): string[] {
  const value = args[key];
  if (!Array.isArray(value)) {
    throw new Error(`${label} est requis.`);
  }

  const normalized = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
  if (normalized.length === 0) {
    throw new Error(`${label} est requis.`);
  }

  return normalized.map((entry) => entry.trim());
}

function ensureQgisAvailable(): void {
  if (!isQgisAvailable()) {
    throw new Error("Le pont QGIS n'est pas disponible dans cette session.");
  }
}

function createQgisTool(
  declaration: FunctionDeclaration,
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
): CallableTool {
  return {
    async tool(): Promise<Tool> {
      return {
        functionDeclarations: [declaration],
      };
    },
    async callTool(functionCalls: FunctionCall[]) {
      const matchingCalls = functionCalls.filter(
        (call) => call.name === declaration.name,
      );

      const parts = [];

      for (const call of matchingCalls) {
        try {
          const response = await execute(call.args || {});
          parts.push(
            createPartFromFunctionResponse(
              call.id || declaration.name,
              declaration.name,
              { ok: true, ...response },
            ),
          );
        } catch (error) {
          parts.push(
            createPartFromFunctionResponse(
              call.id || declaration.name,
              declaration.name,
              {
                ok: false,
                error:
                  error instanceof Error ? error.message : "Erreur inconnue côté QGIS.",
              },
            ),
          );
        }
      }

      return parts;
    },
  };
}

function buildQgisTools(): Array<Tool | CallableTool> {
  return [
    createQgisTool(DECLARATIONS.getLayersList, async () => {
      ensureQgisAvailable();
      const layers = await getLayersList();

      return {
        count: layers.length,
        layers,
      };
    }),
    createQgisTool(DECLARATIONS.getLayersCatalog, async () => {
      ensureQgisAvailable();
      const layers = await getLayersCatalog();

      return {
        count: layers.length,
        layers,
      };
    }),
    createQgisTool(DECLARATIONS.getLayerFields, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "Le nom de couche");
      const fields = await getLayerFields(layerId);

      return {
        layerId,
        count: fields.length,
        fields,
      };
    }),
    createQgisTool(DECLARATIONS.getLayerDiagnostics, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "Le nom de couche");
      const diagnostics = await getLayerDiagnostics(layerId);

      if (!diagnostics) {
        throw new Error("Impossible de diagnostiquer cette couche.");
      }

      return diagnostics as unknown as Record<string, unknown>;
    }),
    createQgisTool(DECLARATIONS.filterLayer, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "Le nom de couche");
      const subsetString = requireString(
        args,
        "subsetString",
        "L'expression de filtre",
      );
      const status = await filterLayer(layerId, subsetString);

      return {
        layerId,
        subsetString,
        status: status || "Filtre transmis à QGIS.",
      };
    }),
    createQgisTool(DECLARATIONS.setLayerVisibility, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "Le nom de couche");
      const visible = requireBoolean(args, "visible", "Le booléen de visibilité");
      const status = await setLayerVisibility(layerId, visible);

      return {
        layerId,
        visible,
        status: status || "Visibilité transmise à QGIS.",
      };
    }),
    createQgisTool(DECLARATIONS.setLayerOpacity, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "Le nom de couche");
      const opacity = requireNumber(args, "opacity", "L'opacité");
      const status = await setLayerOpacity(layerId, opacity);

      return {
        layerId,
        opacity,
        status: status || "Opacité transmise à QGIS.",
      };
    }),
    createQgisTool(DECLARATIONS.zoomToLayer, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "Le nom de couche");
      const status = await zoomToLayer(layerId);

      return {
        layerId,
        status: status || "Zoom transmis à QGIS.",
      };
    }),
    createQgisTool(DECLARATIONS.getLayerStatistics, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "Le nom de couche");
      const field = requireString(args, "field", "Le champ");
      const stats = await getLayerStatistics(layerId, field);

      if (!stats) {
        throw new Error("Impossible de calculer les statistiques demandées.");
      }

      return {
        layerId,
        field,
        ...stats,
      };
    }),
    createQgisTool(DECLARATIONS.reprojectLayer, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "Le nom de couche");
      const targetCrs = requireString(args, "targetCrs", "Le CRS cible");
      const outputLayerName = await reprojectLayer(layerId, targetCrs);

      if (!outputLayerName) {
        throw new Error("La reprojection a échoué côté QGIS.");
      }

      return {
        layerId,
        targetCrs,
        outputLayerName,
      };
    }),
    createQgisTool(DECLARATIONS.mergeRasterBands, async (args) => {
      ensureQgisAvailable();
      const layerIds = requireStringArray(args, "layerIds", "La liste de rasters");
      const outputName = requireString(args, "outputName", "Le nom de sortie");
      const outputPath =
        typeof args.outputPath === "string" ? args.outputPath.trim() : "";
      const result = await mergeRasterBands(layerIds, outputName, outputPath);
      if (!result) {
        throw new Error("La fusion multi-bandes a échoué côté QGIS.");
      }

      return result as unknown as Record<string, unknown>;
    }),
    createQgisTool(DECLARATIONS.createInventoryGrid, async (args) => {
      ensureQgisAvailable();
      const layerId = requireString(args, "layerId", "La couche source");
      const cellWidth = requireNumber(args, "cellWidth", "La largeur de maille");
      const cellHeight = requireNumber(args, "cellHeight", "La hauteur de maille");
      const gridName = requireString(args, "gridName", "Le nom de la grille");
      const centroidsName = requireString(
        args,
        "centroidsName",
        "Le nom des centroïdes",
      );
      const clipToSource =
        typeof args.clipToSource === "boolean" ? args.clipToSource : true;
      const result = await createInventoryGrid(
        layerId,
        cellWidth,
        cellHeight,
        gridName,
        centroidsName,
        clipToSource,
      );
      if (!result) {
        throw new Error("La création de la grille d'inventaire a échoué côté QGIS.");
      }

      return result as unknown as Record<string, unknown>;
    }),
    createQgisTool(DECLARATIONS.runScript, async (args) => {
      ensureQgisAvailable();
      const script = requireString(args, "script", "Le script Python");
      const status = await runScript(script);

      return {
        status: status || "Script transmis à QGIS.",
      };
    }),
    { googleSearch: {} },
    { googleMaps: {} },
  ];
}

export function buildGeminiConfig(): GenerateContentConfig {
  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: buildQgisTools(),
    automaticFunctionCalling: {
      maximumRemoteCalls: 6,
    },
    toolConfig: {
      includeServerSideToolInvocations: true,
    },
  };
}

export function getGeminiChat(settings?: AppSettings) {
  const apiKey =
    settings?.googleApiKey || settings?.apiKey || getConfiguredGeminiApiKey() || "";
  const modelName = settings?.googleModel || settings?.model || FALLBACK_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  return ai.chats.create({
    model: modelName,
    config: buildGeminiConfig(),
  });
}
