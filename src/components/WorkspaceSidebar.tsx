import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Crosshair,
  Eye,
  EyeOff,
  FlaskConical,
  Globe,
  History,
  Layers3,
  Link2,
  Map,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Star,
  Trash2,
  WandSparkles,
  TreePine,
  Leaf,
  Waves,
  Mountain,
  Flame,
  Zap,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Info,
  MessageSquare,
  Database,
  Network,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/src/lib/utils";

import { ChatConversation, LayerContextScope } from "../lib/chat-history";
import {
  ALL_DATA_SOURCES,
  CARTOGRAPHIC_CATALOG,
  RemoteServiceConfig,
  RemoteServiceType,
  SUPPORTED_REMOTE_SERVICE_TYPES,
} from "../lib/catalog";
import { DATA_SOURCE_CATEGORIES } from "../lib/additional-sources";
import { LayerSummary, setProjectCrs } from "../lib/qgis";
import {
  type CadastreParcelSearchOptions,
  type CopernicusSearchResult,
  type CopernicusSearchResultItem,
  type GeoApiCommuneSearchOptions,
  type NasaCatalogSearchResult,
  type NasaCatalogSearchResultItem,
  type OverpassSearchOptions,
  OVERPASS_ENDPOINTS,
  searchOfficialSources,
} from "../lib/official-sources";
import PerformancePanel from "./PerformancePanel";
import { useFavoriteLayersStore } from "../stores/useFavoriteLayersStore";

interface WorkspaceSidebarProps {
  activeConversationId: string | null;
  conversations: ChatConversation[];
  isOpen: boolean;
  isRefreshingLayers: boolean;
  layerContextById: Record<string, LayerContextScope>;
  layers: LayerSummary[];
  selectedLayerIds: string[];
  onApplyParcelStylePreset: (layerId: string, presetId?: string) => void | Promise<void>;
  onLoadOfficialSource: (sourceId: string) => void | Promise<void>;
  onAddRemoteService: (config: RemoteServiceConfig) => void | Promise<void>;
  onAddRasterFile: (filePath: string, layerName?: string) => void | Promise<void>;
  onMergeRasterBands: (
    layerIds: string[],
    outputName: string,
    outputPath?: string,
  ) => void | Promise<void>;
  onCalculateMnh: (
    mnsLayerId: string,
    mntLayerId: string,
    outputName: string,
    outputPath?: string,
    clampNegative?: boolean,
  ) => void | Promise<void>;
  onCalculateRasterFormula: (
    layerIds: string[],
    formula: string,
    outputName: string,
    outputPath?: string,
  ) => void | Promise<void>;
  onCreateInventoryGrid: (
    layerId: string,
    cellWidth: number,
    cellHeight: number,
    gridName: string,
    centroidsName: string,
    clipToSource?: boolean,
  ) => void | Promise<void>;
  onCreateConversation: () => void | Promise<void>;
  onDeleteConversation: (conversationId: string) => void;
  onInspectLayer: (layerId: string) => void | Promise<void>;
  onSearchCadastreParcels: (
    options: CadastreParcelSearchOptions,
  ) => void | Promise<void>;
  onSearchGeoApiCommunes: (
    options: GeoApiCommuneSearchOptions,
  ) => void | Promise<void>;
  onSearchCopernicusProducts: (options: {
    collection?: string;
    nameContains?: string;
    limit?: number;
  }) => Promise<CopernicusSearchResult>;
  onSearchNasaCatalog: (options: {
    collection: string;
    bbox?: string;
    limit?: number;
  }) => Promise<NasaCatalogSearchResult>;
  onSearchOverpassFeatures: (
    options: OverpassSearchOptions,
  ) => void | Promise<void>;
  onPickRasterFile?: () => Promise<string | null>;
  onRefreshLayers: () => void | Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onSetLayerLabels: (
    layerId: string,
    fieldName?: string,
    enabled?: boolean,
  ) => void | Promise<void>;
  onSetLayerContextScope: (
    layerId: string,
    scope: LayerContextScope,
  ) => void | Promise<void>;
  onSetLayerOpacity: (layerId: string, opacity: number) => void | Promise<void>;
  onSetLayerVisibility: (layerId: string, visible: boolean) => void | Promise<void>;
  onToggleLayerSelection: (layerId: string) => void;
  onToggleOpen: () => void;
  onZoomToLayer: (layerId: string) => void | Promise<void>;
}

type SidebarTab = "history" | "layers" | "services";

interface CustomServiceDraft {
  name: string;
  serviceType: RemoteServiceType;
  url: string;
  layerName: string;
  style: string;
  format: string;
  crs: string;
  tileMatrixSet: string;
  version: string;
}

const DEFAULT_SERVICE_DRAFT: CustomServiceDraft = {
  name: "",
  serviceType: "WMS",
  url: "",
  layerName: "",
  style: "",
  format: "image/png",
  crs: "EPSG:3857",
  tileMatrixSet: "PM",
  version: "2.0.0",
};

const DEFAULT_CADASTRE_DRAFT: CadastreParcelSearchOptions = {
  codeInsee: "",
  section: "",
  numero: "",
  sourceIgn: "PCI",
  addToMap: true,
  layerName: "",
};

function formatConversationTimestamp(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function SidebarSection({
  title,
  description,
  accentClassName,
  children,
}: {
  title: string;
  description?: string;
  accentClassName: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-4">
      <div className="mb-3">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.22em]", accentClassName)}>
          {title}
        </p>
        {description ? <p className="mt-1 text-xs text-gray-600 dark:text-white/45">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CollapsibleSection({
  title,
  description,
  accentClassName,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  accentClassName: string;
  icon: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <span className={cn("shrink-0", accentClassName)}>{icon}</span>
        <div className="flex-1">
          <span className={cn("block text-xs font-semibold uppercase tracking-[0.22em]", accentClassName)}>
            {title}
          </span>
          {description && <p className="mt-0.5 text-[10px] text-gray-700 dark:text-gray-300/35">{description}</p>}
        </div>
        <ChevronDown
          size={14}
          className={cn("shrink-0 text-gray-700 dark:text-gray-300/30 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && <div className="border-t border-gray-300 dark:border-gray-800 p-4 pt-3">{children}</div>}
    </section>
  );
}

const COMMON_CRS = [
  { code: "EPSG:2154", label: "RGF93 / Lambert-93 (France)" },
  { code: "EPSG:4326", label: "WGS 84 (lat/lon)" },
  { code: "EPSG:3857", label: "Web Mercator" },
  { code: "EPSG:32630", label: "UTM zone 30N" },
  { code: "EPSG:32631", label: "UTM zone 31N" },
  { code: "EPSG:32632", label: "UTM zone 32N" },
  { code: "EPSG:3035", label: "ETRS89-LAEA (Europe)" },
  { code: "EPSG:27572", label: "NTF Lambert II étendu" },
];

export default function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const {
    activeConversationId,
    conversations,
    isOpen,
    isRefreshingLayers,
    layerContextById,
    layers,
    selectedLayerIds,
    onApplyParcelStylePreset,
    onLoadOfficialSource,
    onAddRemoteService,
    onAddRasterFile,
    onMergeRasterBands,
    onCalculateMnh,
    onCalculateRasterFormula,
    onCreateInventoryGrid,
    onCreateConversation,
    onDeleteConversation,
    onInspectLayer,
    onSearchCadastreParcels,
    onSearchCopernicusProducts,
    onSearchGeoApiCommunes,
    onSearchNasaCatalog,
    onSearchOverpassFeatures,
    onPickRasterFile,
    onRefreshLayers,
    onSelectConversation,
    onSetLayerLabels,
    onSetLayerContextScope,
    onSetLayerOpacity,
    onSetLayerVisibility,
    onToggleLayerSelection,
    onToggleOpen,
    onZoomToLayer,
  } = props;

  const [activeTab, setActiveTab] = useState<SidebarTab>("history");
  const [conversationQuery, setConversationQuery] = useState("");
  const [layerQuery, setLayerQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState(CARTOGRAPHIC_CATALOG[0]?.id || "");
  const [selectedCrs, setSelectedCrs] = useState("EPSG:2154");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    base: true,
    forestry: true,
    topographic: false,
    satellite: false,
    environmental: false,
    administrative: false,
    geology: false,
    infrastructure: false,
    urban: false,
    soil: false,
    demography: false,
  });
  const [opacityDrafts, setOpacityDrafts] = useState<Record<string, number>>({});
  const [serviceDraft, setServiceDraft] =
    useState<CustomServiceDraft>(DEFAULT_SERVICE_DRAFT);
  const [cadastreDraft, setCadastreDraft] =
    useState<CadastreParcelSearchOptions>(DEFAULT_CADASTRE_DRAFT);
  const [communeSearchName, setCommuneSearchName] = useState("");
  const [copernicusCollection, setCopernicusCollection] = useState("SENTINEL-2");
  const [copernicusNameContains, setCopernicusNameContains] = useState("");
  const [copernicusLimit, setCopernicusLimit] = useState("5");
  const [copernicusResults, setCopernicusResults] = useState<
    CopernicusSearchResultItem[]
  >([]);
  const [nasaCollection, setNasaCollection] = useState("HLSS30.v2.0");
  const [nasaBbox, setNasaBbox] = useState("");
  const [nasaLimit, setNasaLimit] = useState("5");
  const [nasaResults, setNasaResults] = useState<NasaCatalogSearchResultItem[]>([]);
  const [overpassEndpoint, setOverpassEndpoint] = useState<string>(
    OVERPASS_ENDPOINTS[0],
  );
  const [overpassQuery, setOverpassQuery] = useState(
    "[out:json][timeout:25];node(48.85,2.34,48.86,2.35)[amenity=drinking_water];out body;",
  );
  const [overpassLayerName, setOverpassLayerName] = useState("OSM_query");
  const [rasterPath, setRasterPath] = useState("");
  const [rasterName, setRasterName] = useState("");
  const [formulaLayerIds, setFormulaLayerIds] = useState<string[]>([]);
  const [rasterFormula, setRasterFormula] = useState("A");
  const [rasterFormulaOutputName, setRasterFormulaOutputName] = useState("Raster_calc");
  const [rasterFormulaOutputPath, setRasterFormulaOutputPath] = useState("");
  const [mergeLayerIds, setMergeLayerIds] = useState<string[]>([]);
  const [mergeOutputName, setMergeOutputName] = useState("Fusion_biannuelle");
  const [mergeOutputPath, setMergeOutputPath] = useState("");
  const [mnsLayerId, setMnsLayerId] = useState("");
  const [mntLayerId, setMntLayerId] = useState("");
  const [mnhOutputName, setMnhOutputName] = useState("MNH");
  const [mnhOutputPath, setMnhOutputPath] = useState("");
  const [clampNegativeMnh, setClampNegativeMnh] = useState(true);
  const [inventoryLayerId, setInventoryLayerId] = useState("");
  const [inventoryCellWidth, setInventoryCellWidth] = useState("250");
  const [inventoryCellHeight, setInventoryCellHeight] = useState("250");
  const [inventoryGridName, setInventoryGridName] = useState("Grille_inventaire");
  const [inventoryCentroidsName, setInventoryCentroidsName] = useState(
    "Grille_inventaire_centroides",
  );
  const [inventoryClipToSource, setInventoryClipToSource] = useState(true);

  const toggleFavorite = useFavoriteLayersStore((s) => s.toggleFavorite);
  const isFavorite = useFavoriteLayersStore((s) => s.isFavorite);

  useEffect(() => {
    setOpacityDrafts((current) => {
      const next = { ...current };
      for (const layer of layers) {
        next[layer.id] = Math.round(layer.opacity * 100);
      }
      return next;
    });
  }, [layers]);

  const filteredLayers = useMemo(() => {
    const query = layerQuery.trim().toLowerCase();
    if (!query) {
      return layers;
    }

    return layers.filter((layer) =>
      [layer.name, layer.type, layer.geometryType, layer.crs, layer.provider]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [layerQuery, layers]);

  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      [conversation.title, conversation.mode]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [conversationQuery, conversations]);

  const filteredSources = useMemo(() => {
    const q = serviceQuery.toLowerCase().trim();
    if (!q) {
      // Si pas de recherche, retourner les catégories non filtrées
      return DATA_SOURCE_CATEGORIES as any;
    }
    
    // Si recherche, filtrer les sources dans chaque catégorie
    const filteredCategories: any = {};
    Object.entries(DATA_SOURCE_CATEGORIES).forEach(([key, category]) => {
      const filteredSources = category.sources.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.provider?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q),
      );
      if (filteredSources.length > 0) {
        filteredCategories[key] = { ...category, sources: filteredSources };
      }
    });
    return filteredCategories;
  }, [serviceQuery]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const rasterLayers = useMemo(
    () => layers.filter((layer) => layer.type.toLowerCase() === "raster"),
    [layers],
  );
  const polygonLayers = useMemo(
    () =>
      layers.filter(
        (layer) =>
          layer.type.toLowerCase() === "vector" &&
          layer.geometryType.toLowerCase().includes("polygon"),
      ),
    [layers],
  );

  useEffect(() => {
    if (!mnsLayerId && rasterLayers[0]) {
      setMnsLayerId(rasterLayers[0].id);
    }
    if (!mntLayerId && rasterLayers[1]) {
      setMntLayerId(rasterLayers[1].id);
    } else if (!mntLayerId && rasterLayers[0]) {
      setMntLayerId(rasterLayers[0].id);
    }
    setFormulaLayerIds((current) =>
      current.filter((layerId) => rasterLayers.some((layer) => layer.id === layerId)),
    );
    setMergeLayerIds((current) =>
      current.filter((layerId) => rasterLayers.some((layer) => layer.id === layerId)),
    );
  }, [mntLayerId, mnsLayerId, rasterLayers]);

  useEffect(() => {
    if (!inventoryLayerId && polygonLayers[0]) {
      setInventoryLayerId(polygonLayers[0].id);
      const safeName = polygonLayers[0].name.replace(/\s+/g, "_");
      setInventoryGridName(`${safeName}_grille_inventaire`);
      setInventoryCentroidsName(`${safeName}_centroides`);
      return;
    }

    if (inventoryLayerId && !polygonLayers.some((layer) => layer.id === inventoryLayerId)) {
      const fallback = polygonLayers[0];
      setInventoryLayerId(fallback?.id || "");
      if (fallback) {
        const safeName = fallback.name.replace(/\s+/g, "_");
        setInventoryGridName(`${safeName}_grille_inventaire`);
        setInventoryCentroidsName(`${safeName}_centroides`);
      }
    }
  }, [inventoryLayerId, polygonLayers]);

  const submitCustomService = async () => {
    if (!serviceDraft.name.trim() || !serviceDraft.url.trim()) {
      toast.error("Nom et URL du service requis.");
      return;
    }

    await onAddRemoteService({
      ...serviceDraft,
      name: serviceDraft.name.trim(),
      url: serviceDraft.url.trim(),
      layerName: serviceDraft.layerName.trim() || undefined,
      style: serviceDraft.style.trim() || undefined,
      format: serviceDraft.format.trim() || undefined,
      crs: serviceDraft.crs.trim() || undefined,
      tileMatrixSet: serviceDraft.tileMatrixSet.trim() || undefined,
      version: serviceDraft.version.trim() || undefined,
    });
  };

  const submitCadastreSearch = async () => {
    if (!cadastreDraft.codeInsee?.trim()) {
      toast.error("Le code INSEE est requis pour le cadastre.");
      return;
    }

    await onSearchCadastreParcels({
      ...cadastreDraft,
      codeInsee: cadastreDraft.codeInsee.trim(),
      section: cadastreDraft.section?.trim() || undefined,
      numero: cadastreDraft.numero?.trim() || undefined,
      layerName: cadastreDraft.layerName?.trim() || undefined,
      sourceIgn: cadastreDraft.sourceIgn === "BDP" ? "BDP" : "PCI",
      addToMap: true,
    });
  };

  const submitCommuneSearch = async () => {
    if (!communeSearchName.trim()) {
      toast.error("Saisis un nom de commune.");
      return;
    }

    await onSearchGeoApiCommunes({
      name: communeSearchName.trim(),
      addToMap: true,
      layerName: `Communes_${communeSearchName.trim().replace(/\s+/g, "_")}`,
    });
  };

  const submitCopernicusSearch = async () => {
    const result = await onSearchCopernicusProducts({
      collection: copernicusCollection.trim() || undefined,
      nameContains: copernicusNameContains.trim() || undefined,
      limit: Math.max(1, Math.min(Number(copernicusLimit) || 5, 20)),
    });
    setCopernicusResults(result.items);
  };

  const submitNasaSearch = async () => {
    if (!nasaCollection.trim()) {
      toast.error("La collection NASA est requise.");
      return;
    }

    const result = await onSearchNasaCatalog({
      collection: nasaCollection.trim(),
      bbox: nasaBbox.trim() || undefined,
      limit: Math.max(1, Math.min(Number(nasaLimit) || 5, 20)),
    });
    setNasaResults(result.items);
  };

  const submitOverpassSearch = async () => {
    if (!overpassQuery.trim()) {
      toast.error("La requete Overpass est requise.");
      return;
    }

    await onSearchOverpassFeatures({
      endpoint: overpassEndpoint,
      query: overpassQuery.trim(),
      addToMap: true,
      layerName: overpassLayerName.trim() || "OSM_query",
    });
  };

  const submitRasterFile = async () => {
    if (!rasterPath.trim()) {
      toast.error("Chemin raster requis.");
      return;
    }
    await onAddRasterFile(rasterPath.trim(), rasterName.trim() || undefined);
  };

  const submitRasterFormula = async () => {
    if (formulaLayerIds.length === 0) {
      toast.error("Choisissez au moins un raster.");
      return;
    }
    if (!rasterFormula.trim()) {
      toast.error("La formule raster est requise.");
      return;
    }
    await onCalculateRasterFormula(
      formulaLayerIds,
      rasterFormula.trim(),
      rasterFormulaOutputName.trim() || "Raster_calc",
      rasterFormulaOutputPath.trim() || undefined,
    );
  };

  const submitRasterMerge = async () => {
    if (mergeLayerIds.length < 2) {
      toast.error("Choisissez au moins deux rasters à fusionner.");
      return;
    }

    await onMergeRasterBands(
      mergeLayerIds,
      mergeOutputName.trim() || "Fusion_biannuelle",
      mergeOutputPath.trim() || undefined,
    );
  };

  const submitMnh = async () => {
    if (!mnsLayerId || !mntLayerId) {
      toast.error("Choisissez un MNS et un MNT.");
      return;
    }
    await onCalculateMnh(
      mnsLayerId,
      mntLayerId,
      mnhOutputName.trim() || "MNH",
      mnhOutputPath.trim() || undefined,
      clampNegativeMnh,
    );
  };

  const submitInventoryGrid = async () => {
    if (!inventoryLayerId) {
      toast.error("Choisissez une couche d'emprise polygonale.");
      return;
    }

    const cellWidth = Number(inventoryCellWidth.replace(",", "."));
    const cellHeight = Number(inventoryCellHeight.replace(",", "."));
    if (!Number.isFinite(cellWidth) || cellWidth <= 0) {
      toast.error("La largeur de maille doit être positive.");
      return;
    }
    if (!Number.isFinite(cellHeight) || cellHeight <= 0) {
      toast.error("La hauteur de maille doit être positive.");
      return;
    }

    await onCreateInventoryGrid(
      inventoryLayerId,
      cellWidth,
      cellHeight,
      inventoryGridName.trim() || "Grille_inventaire",
      inventoryCentroidsName.trim() || "Grille_inventaire_centroides",
      inventoryClipToSource,
    );
  };

  const openRasterPicker = async () => {
    if (!onPickRasterFile) {
      toast.error("Sélecteur de fichiers indisponible.");
      return;
    }
    const picked = await onPickRasterFile();
    if (picked) {
      setRasterPath(picked);
      if (!rasterName.trim()) {
        const parts = picked.split(/[\\/]/);
        const filename = parts[parts.length - 1] || picked;
        setRasterName(filename.replace(/\.[^.]+$/, ""));
      }
    }
  };

  const renderHistoryTab = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-300/30"
          size={15}
        />
        <input
          value={conversationQuery}
          onChange={(event) => setConversationQuery(event.target.value)}
          placeholder="Chercher une discussion..."
          className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 py-2.5 pl-10 pr-3 text-sm text-gray-800 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-blue-500/50 dark:focus:border-blue-500/50"
        />
      </div>
      
      {filteredConversations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 text-sm text-gray-600 dark:text-gray-400">
          {conversations.length === 0 ? "Aucune discussion enregistrée." : "Aucune discussion ne correspond à la recherche."}
        </div>
      ) : (
        filteredConversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId;
          return (
            <div
              key={conversation.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectConversation(conversation.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectConversation(conversation.id); }}
              className={cn(
                "w-full cursor-pointer rounded-3xl border p-4 text-left transition-all",
                isActive
                  ? "border-blue-500/35 bg-blue-500/12"
                  : "border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {conversation.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/45">
                    {conversation.mode === "plan" ? "Plan guidé" : "Conversation"} ·{" "}
                    {conversation.messages.length} message(s)
                  </p>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteConversation(conversation.id);
                  }}
                  className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 p-2 text-gray-600 dark:text-gray-400 transition-all hover:text-red-500"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-700 dark:text-gray-300/40">
                <span>{formatConversationTimestamp(conversation.updatedAt)}</span>
                <span>{conversation.selectedLayerIds.length} couche(s) liées</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderLayersTab = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-300/30"
          size={15}
        />
        <input
          value={layerQuery}
          onChange={(event) => setLayerQuery(event.target.value)}
          placeholder="Chercher une couche, un CRS, un provider"
          className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 py-2.5 pl-10 pr-3 text-sm text-gray-800 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-emerald-500/50 dark:focus:border-emerald-500/50"
        />
      </div>

      {filteredLayers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 text-sm text-gray-600 dark:text-gray-400">
          Aucune couche ne correspond à la recherche.
        </div>
      ) : (
        filteredLayers.map((layer) => {
          const isSelected = selectedLayerIds.includes(layer.id);
          const scope = layerContextById[layer.id] || "layer";
          const opacityValue = opacityDrafts[layer.id] ?? Math.round(layer.opacity * 100);
          return (
            <div key={layer.id} className="rounded-3xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleLayerSelection(layer.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                        isSelected
                          ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-200"
                          : "border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-white/45",
                      )}
                    >
                      {isSelected ? "Contexte" : "Ignorée"}
                    </button>
                    <span className="rounded-full border border-gray-300 dark:border-gray-800 px-2.5 py-1 text-[11px] text-gray-600 dark:text-white/45">
                      {layer.type}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-gray-700 dark:text-gray-300">{layer.name}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-white/45">
                    {layer.geometryType} · {layer.crs || "CRS inconnu"} · {layer.provider || "provider inconnu"}
                  </p>
                  <p className="mt-1 text-xs text-gray-700 dark:text-gray-300/35">
                    {layer.featureCount ?? "n/a"} entité(s) · {layer.selectedFeatureCount} sélectionnée(s)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleFavorite(layer.id)}
                    className={cn(
                      "rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 p-2 transition-all",
                      isFavorite(layer.id)
                        ? "text-amber-400 hover:text-amber-300"
                        : "text-gray-700 dark:text-gray-300/30 hover:text-amber-400/70",
                    )}
                    title={isFavorite(layer.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                  >
                    <Star size={15} className={isFavorite(layer.id) ? "fill-current" : ""} />
                  </button>
                  <button
                    onClick={() => void onInspectLayer(layer.id)}
                    className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 p-2 text-gray-700 dark:text-gray-300/50 transition-all hover:text-white"
                    title="Diagnostic"
                  >
                    <FlaskConical size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => void onSetLayerVisibility(layer.id, !layer.visible)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300/75 transition-all hover:text-white"
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  {layer.visible ? "Visible" : "Masquée"}
                </button>
                <button
                  onClick={() => void onZoomToLayer(layer.id)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300/75 transition-all hover:text-white"
                >
                  <Crosshair size={14} />
                  Zoom
                </button>
              </div>

              {layer.type.toLowerCase() === "vector" ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void onApplyParcelStylePreset(layer.id, "cadastre")}
                    className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300/75 transition-all hover:text-white"
                  >
                    Style parcelle
                  </button>
                  <button
                    onClick={() => void onSetLayerLabels(layer.id, "", true)}
                    className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300/75 transition-all hover:text-white"
                  >
                    Etiquettes
                  </button>
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => void onSetLayerContextScope(layer.id, "layer")}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs font-medium transition-all",
                    scope === "layer"
                      ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-100"
                      : "border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300/50 hover:text-white",
                  )}
                >
                  Couche entière
                </button>
                <button
                  onClick={() => void onSetLayerContextScope(layer.id, "selection")}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs font-medium transition-all",
                    scope === "selection"
                      ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-100"
                      : "border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300/50 hover:text-white",
                  )}
                >
                  Sélection active
                </button>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-gray-600 dark:text-white/45">
                  <span>Opacité</span>
                  <span>{opacityValue}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacityValue}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setOpacityDrafts((current) => ({ ...current, [layer.id]: value }));
                  }}
                  onMouseUp={() =>
                    void onSetLayerOpacity(layer.id, (opacityDrafts[layer.id] ?? opacityValue) / 100)
                  }
                  onTouchEnd={() =>
                    void onSetLayerOpacity(layer.id, (opacityDrafts[layer.id] ?? opacityValue) / 100)
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-300 dark:bg-gray-700 accent-emerald-400"
                />
              </div>

              {layer.subsetString ? (
                <div className="mt-3 rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-[11px] text-gray-600 dark:text-white/45">
                  Filtre: {layer.subsetString}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleAddCatalogSource = async () => {
    const item = CARTOGRAPHIC_CATALOG.find((c) => c.id === selectedCatalogId);
    if (!item) return;
    await onAddRemoteService(item);
  };

  const handleSetProjectCrs = async () => {
    const result = await setProjectCrs(selectedCrs);
    if (result) {
      toast.success(`Projection changée en ${selectedCrs}`);
    } else {
      toast.error("Impossible de changer la projection (QGIS non connecté ?).");
    }
  };

  const renderServicesTab = () => (
    <div className="space-y-4">
      {/* ── Sources officielles ── */}
      <CollapsibleSection
        title="Sources officielles"
        accentClassName="text-emerald-300/80"
        icon={<TreePine size={14} />}
        isOpen={expandedSections["sources"] ?? true}
        onToggle={() => toggleSection("sources")}
      >
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-300/30" size={14} />
          <input
            value={serviceQuery}
            onChange={(e) => setServiceQuery(e.target.value)}
            placeholder="Rechercher une source (forêt, RUM, géologie...)"
            className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/28 focus:border-emerald-500/40"
          />
        </div>
        <div className="space-y-3">
          {Object.entries(filteredSources).map(([categoryId, category]: [string, any]) => (
            <div key={categoryId} className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
              <button
                onClick={() => toggleCategory(categoryId)}
                className="flex w-full items-center justify-between rounded-t-2xl px-3 py-2.5 text-left transition-all hover:bg-gray-100 dark:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${expandedCategories[categoryId] ? 'rotate-180' : ''}`}
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{category.name}</span>
                  <span className="text-[10px] text-gray-700 dark:text-gray-300/40">({category.sources.length})</span>
                </div>
              </button>
              {expandedCategories[categoryId] && (
                <div className="space-y-2 p-3 pt-1">
                  <p className="text-[11px] text-gray-700 dark:text-gray-300/40 italic">{category.description}</p>
                  {category.sources.map((source: any) => (
                    <div key={source.id} className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                          {source.serviceType}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">{source.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-gray-700 dark:text-gray-300/40">{source.provider} — {source.description}</p>
                      <button
                        onClick={() => void onAddRemoteService(source)}
                        className="mt-2 rounded-xl border border-emerald-500/25 bg-emerald-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-emerald-500/18"
                      >
                        Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Inventaire forestier ── */}
      <CollapsibleSection
        title="Inventaire forestier"
        description="Créez une grille d'inventaire et ses centroïdes pour des relevés terrain"
        accentClassName="text-emerald-300/80"
        icon={<Crosshair size={14} />}
        isOpen={expandedSections["inventory"] ?? false}
        onToggle={() => toggleSection("inventory")}
      >
        {polygonLayers.length === 0 ? (
          <p className="text-xs text-gray-700 dark:text-gray-300/40">Chargez d'abord une couche polygonale (ex: parcelles, forêt).</p>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Générez une grille régulière et ses centroïdes pour des relevés de terrain forestier</p>
            <select value={inventoryLayerId} onChange={(e) => { const id = e.target.value; setInventoryLayerId(id); const l = polygonLayers.find((x) => x.id === id); if (l) { const s = l.name.replace(/\s+/g, "_"); setInventoryGridName(`${s}_grille`); setInventoryCentroidsName(`${s}_centroides`); } }} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-emerald-500/40">
              {polygonLayers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={inventoryCellWidth} onChange={(e) => setInventoryCellWidth(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-emerald-500/40" placeholder="Largeur (m)" />
              <input value={inventoryCellHeight} onChange={(e) => setInventoryCellHeight(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-emerald-500/40" placeholder="Hauteur (m)" />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300/65"><input type="checkbox" checked={inventoryClipToSource} onChange={(e) => setInventoryClipToSource(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-400" /> Découper à l'emprise de la couche</label>
            <button onClick={() => void submitInventoryGrid()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-emerald-500/18"><Crosshair size={15} /> Créer grille + centroïdes</button>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Fonds de carte ── */}
      <SidebarSection
        title="Fonds de carte"
        description="Ajoutez un fond de carte pour navigation et contexte."
        accentClassName="text-cyan-300/80"
      >
        <div className="space-y-3">
          <select
            value={selectedCatalogId}
            onChange={(e) => setSelectedCatalogId(e.target.value)}
            className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-cyan-500/40"
          >
            {CARTOGRAPHIC_CATALOG.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.provider}
              </option>
            ))}
          </select>
          {(() => {
            const sel = CARTOGRAPHIC_CATALOG.find((c) => c.id === selectedCatalogId);
            return sel ? (
              <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-600 dark:text-white/45">
                <span className="mr-2 inline-block rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                  {sel.serviceType}
                </span>
                {sel.description}
              </div>
            ) : null;
          })()}
          <button
            onClick={() => void handleAddCatalogSource()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-cyan-500/18"
          >
            <Map size={15} />
            Ajouter à la carte
          </button>
        </div>
      </SidebarSection>

      {/* ── Cadastre ── */}
      <SidebarSection
        title="Cadastre"
        description="Chargez les parcelles cadastrales d'une commune."
        accentClassName="text-emerald-300/80"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-300/30" size={14} />
            <input
              value={communeSearchName}
              onChange={(e) => setCommuneSearchName(e.target.value)}
              placeholder="Nom de commune (ex: Rennes, Paris...)"
              className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-3 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/28 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
            {communeSearchName && (
              <button
                onClick={() => setCommuneSearchName("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 dark:text-gray-300/30 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <CheckCircle2 size={14} />
              </button>
            )}
          </div>
          
          {/* Action Cards */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void submitCommuneSearch()}
              className="group relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/12 px-3 py-3 text-left transition-all hover:bg-emerald-500/18 hover:shadow-lg hover:shadow-emerald-500/10"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-emerald-500/20 via-transparent to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <div className="relative flex flex-col items-center gap-1.5">
                <Map size={20} className="text-emerald-300" />
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Contours</span>
                <span className="text-[9px] text-gray-700 dark:text-gray-300/50">Limites communales</span>
              </div>
            </button>
            <button
              onClick={() => void submitCadastreSearch()}
              className="group relative overflow-hidden rounded-2xl border border-orange-500/25 bg-orange-500/12 px-3 py-3 text-left transition-all hover:bg-orange-500/18 hover:shadow-lg hover:shadow-orange-500/10"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-orange-500/20 via-transparent to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <div className="relative flex flex-col items-center gap-1.5">
                <MapPin size={20} className="text-orange-300" />
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Parcelles</span>
                <span className="text-[9px] text-gray-700 dark:text-gray-300/50">Cadastre complet</span>
              </div>
            </button>
          </div>

          {/* Info Tip */}
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-2.5">
            <Info size={12} className="mt-0.5 shrink-0 text-emerald-300" />
            <p className="text-[10px] text-gray-700 dark:text-gray-300/50 leading-relaxed">
              Les parcelles seront chargées avec le style par défaut et la carte sera centrée dessus automatiquement.
            </p>
          </div>
        </div>
      </SidebarSection>

      {/* ── Images satellites ── */}
      <CollapsibleSection
        title="Images satellites"
        description="Cherchez des images Sentinel-2 (Copernicus) ou Landsat (NASA)"
        accentClassName="text-sky-300/80"
        icon={<Globe size={14} />}
        isOpen={expandedSections["satellite"] ?? false}
        onToggle={() => toggleSection("satellite")}
      >
        <div className="space-y-4">
          {/* Copernicus */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/70">Copernicus Sentinel-2</p>
            <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Images haute résolution (10m) pour l'Europe et le monde</p>
            <input value={copernicusCollection} onChange={(e) => setCopernicusCollection(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-sky-500/40" placeholder="Collection (ex: SENTINEL-2)" />
            <div className="grid grid-cols-2 gap-2">
              <input value={copernicusLimit} onChange={(e) => setCopernicusLimit(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-sky-500/40" placeholder="Résultats (5)" />
              <input value={copernicusNameContains} onChange={(e) => setCopernicusNameContains(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-sky-500/40" placeholder="Filtre nom" />
            </div>
            <button onClick={() => void submitCopernicusSearch()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-sky-500/18"><Search size={15} /> Chercher Sentinel-2</button>
            {copernicusResults.length > 0 && (
              <div className="space-y-2">{copernicusResults.map((item) => (<div key={item.id} className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300/55"><p className="truncate font-medium text-gray-700 dark:text-gray-300">{item.name || item.id}</p><p className="text-gray-700 dark:text-gray-300/35">{item.online ? "En ligne" : "Hors ligne"} · {item.publicationDate || "n/a"}</p></div>))}</div>
            )}
          </div>

          {/* NASA */}
          <div className="border-t border-gray-300 dark:border-gray-700 pt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300/70">NASA Landsat</p>
            <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Images Landsat 8/9 pour le monde entier</p>
            <input value={nasaCollection} onChange={(e) => setNasaCollection(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-indigo-500/40" placeholder="Collection (ex: HLSS30.v2.0)" />
            <div className="grid grid-cols-2 gap-2">
              <input value={nasaLimit} onChange={(e) => setNasaLimit(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-indigo-500/40" placeholder="Résultats (5)" />
              <input value={nasaBbox} onChange={(e) => setNasaBbox(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-indigo-500/40" placeholder="BBOX WGS84" />
            </div>
            <button onClick={() => void submitNasaSearch()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/25 bg-indigo-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-indigo-500/18"><Search size={15} /> Chercher Landsat</button>
            {nasaResults.length > 0 && (
              <div className="space-y-2">{nasaResults.map((item) => (<div key={item.id} className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300/55"><p className="truncate font-medium text-gray-700 dark:text-gray-300">{item.id}</p><p className="text-gray-700 dark:text-gray-300/35">{item.datetime || "n/a"}</p></div>))}</div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Calculs raster ── */}
      <CollapsibleSection
        title="Calculs raster"
        description="Fusionnez des images, calculez des indices (NDVI), créez des MNH"
        accentClassName="text-rose-300/80"
        icon={<WandSparkles size={14} />}
        isOpen={expandedSections["raster-tools"] ?? false}
        onToggle={() => toggleSection("raster-tools")}
      >
        <div className="space-y-4">
          {rasterLayers.length === 0 ? (
            <p className="text-xs text-gray-700 dark:text-gray-300/40">Chargez d'abord des rasters pour activer les outils.</p>
          ) : (
            <>
              {/* Fusion multi-bandes */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300/70">Fusion multi-bandes</p>
                <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Combinez plusieurs rasters en une seule image multi-bandes (ex: NDVI bi-annuel)</p>
                {rasterLayers.map((layer) => { const checked = mergeLayerIds.includes(layer.id); return (
                  <label key={layer.id} className={cn("flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition-all", checked ? "border-rose-500/30 bg-rose-500/12 text-gray-700 dark:text-gray-300" : "border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300/65")}>
                    <span className="min-w-0 truncate">{checked ? `B${mergeLayerIds.indexOf(layer.id) + 1}` : "•"} {layer.name}</span>
                    <input type="checkbox" checked={checked} onChange={(e) => setMergeLayerIds((c) => e.target.checked ? [...c, layer.id] : c.filter((x) => x !== layer.id))} className="h-4 w-4 accent-rose-400" />
                  </label>
                ); })}
                <input value={mergeOutputName} onChange={(e) => setMergeOutputName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-rose-500/40" placeholder="Nom de sortie" />
                <button onClick={() => void submitRasterMerge()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/12 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-rose-500/18"><Layers3 size={14} /> Fusionner</button>
              </div>

              {/* Calcul raster */}
              <div className="space-y-2 border-t border-gray-300 dark:border-gray-700 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/70">Calculateur raster</p>
                <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Appliquez des formules mathématiques (ex: NDVI = (NIR - Red) / (NIR + Red))</p>
                {rasterLayers.map((layer) => { const checked = formulaLayerIds.includes(layer.id); const alias = checked ? String.fromCharCode(65 + formulaLayerIds.indexOf(layer.id)) : "•"; return (
                  <label key={layer.id} className={cn("flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition-all", checked ? "border-fuchsia-500/30 bg-fuchsia-500/12 text-gray-700 dark:text-gray-300" : "border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300/65")}>
                    <span className="min-w-0 truncate">{alias} {layer.name}</span>
                    <input type="checkbox" checked={checked} onChange={(e) => { setFormulaLayerIds((c) => { if (e.target.checked) { if (c.length >= 6) { toast.error("Max 6 rasters."); return c; } return [...c, layer.id]; } return c.filter((x) => x !== layer.id); }); }} className="h-4 w-4 accent-fuchsia-400" />
                  </label>
                ); })}
                <input value={rasterFormula} onChange={(e) => setRasterFormula(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-fuchsia-500/40" placeholder="(A-B)*(A>B)" />
                <input value={rasterFormulaOutputName} onChange={(e) => setRasterFormulaOutputName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-fuchsia-500/40" placeholder="Nom de sortie" />
                <button onClick={() => void submitRasterFormula()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/12 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-fuchsia-500/18"><Sparkles size={14} /> Calculer</button>
              </div>

              {/* MNH */}
              {rasterLayers.length >= 2 && (
                <div className="space-y-2 border-t border-gray-300 dark:border-gray-700 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/70">MNH (MNS − MNT)</p>
                  <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Modèle Numérique de Hauteur = Modèle Numérique de Surface - Modèle Numérique de Terrain</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={mnsLayerId} onChange={(e) => setMnsLayerId(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500/40">
                      {rasterLayers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                    </select>
                    <select value={mntLayerId} onChange={(e) => setMntLayerId(e.target.value)} className="rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500/40">
                      {rasterLayers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                    </select>
                  </div>
                  <input value={mnhOutputName} onChange={(e) => setMnhOutputName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-violet-500/40" placeholder="MNH" />
                  <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300/65"><input type="checkbox" checked={clampNegativeMnh} onChange={(e) => setClampNegativeMnh(e.target.checked)} className="h-3.5 w-3.5 accent-violet-400" /> Tronquer négatifs à 0</label>
                  <button onClick={() => void submitMnh()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/12 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-violet-500/18"><WandSparkles size={14} /> Calculer MNH</button>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* ── OpenStreetMap ── */}
      <CollapsibleSection
        title="OpenStreetMap"
        description="Extrayez des données OSM (bâtiments, routes, eau...) avec Overpass"
        accentClassName="text-orange-300/80"
        icon={<Link2 size={14} />}
        isOpen={expandedSections["overpass"] ?? false}
        onToggle={() => toggleSection("overpass")}
      >
        <div className="space-y-3">
          <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Overpass QL est un langage de requête pour extraire des données OpenStreetMap</p>
          <select value={overpassEndpoint} onChange={(e) => setOverpassEndpoint(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500/40">
            {OVERPASS_ENDPOINTS.map((ep) => (<option key={ep} value={ep}>{ep}</option>))}
          </select>
          <textarea value={overpassQuery} onChange={(e) => setOverpassQuery(e.target.value)} rows={4} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-orange-500/40" placeholder="[out:json];
area[name='Rennes']->.searchArea;
(
  way[highway](area.searchArea);
);
out geom;" />
          <input value={overpassLayerName} onChange={(e) => setOverpassLayerName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-orange-500/40" placeholder="Nom de la couche (ex: Routes_Rennes)" />
          <button onClick={() => void submitOverpassSearch()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-500/25 bg-orange-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-orange-500/18"><Plus size={15} /> Extraire données OSM</button>
        </div>
      </CollapsibleSection>

      {/* ── Service personnalisé ── */}
      <CollapsibleSection
        title="Service personnalisé"
        description="Ajoutez votre propre serveur WMS, WMTS, WFS ou WCS"
        accentClassName="text-cyan-300/80"
        icon={<Server size={14} />}
        isOpen={expandedSections["custom"] ?? false}
        onToggle={() => toggleSection("custom")}
      >
        <div className="space-y-3">
          <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Connectez un serveur cartographique externe (WMS, WMTS, WFS, WCS, ArcGIS)</p>
          <input value={serviceDraft.name} onChange={(e) => setServiceDraft((c) => ({ ...c, name: e.target.value }))} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-cyan-500/40" placeholder="Nom du service" />
          <select value={serviceDraft.serviceType} onChange={(e) => setServiceDraft((c) => ({ ...c, serviceType: e.target.value as RemoteServiceType }))} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-cyan-500/40">
            {SUPPORTED_REMOTE_SERVICE_TYPES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
          </select>
          <input value={serviceDraft.url} onChange={(e) => setServiceDraft((c) => ({ ...c, url: e.target.value }))} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-cyan-500/40" placeholder="URL du serveur (https://...)" />
          <input value={serviceDraft.layerName} onChange={(e) => setServiceDraft((c) => ({ ...c, layerName: e.target.value }))} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-cyan-500/40" placeholder="Nom de la couche (optionnel)" />
          <input value={serviceDraft.crs} onChange={(e) => setServiceDraft((c) => ({ ...c, crs: e.target.value }))} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-cyan-500/40" placeholder="CRS (ex: EPSG:3857)" />
          <button onClick={() => void submitCustomService()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-cyan-500/18"><Link2 size={15} /> Ajouter le service</button>
        </div>
      </CollapsibleSection>

      {/* ── Fichiers locaux ── */}
      <CollapsibleSection
        title="Fichiers locaux"
        description="Chargez des fichiers GeoTIFF ou autres rasters depuis votre ordinateur"
        accentClassName="text-amber-300/80"
        icon={<Layers3 size={14} />}
        isOpen={expandedSections["raster"] ?? false}
        onToggle={() => toggleSection("raster")}
      >
        <div className="space-y-3">
          <p className="text-[10px] text-gray-700 dark:text-gray-300/35">Chargez des images raster (GeoTIFF, PNG, JPG...) pour analyse</p>
          <div className="flex gap-2">
            <input value={rasterPath} onChange={(e) => setRasterPath(e.target.value)} className="min-w-0 flex-1 rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-amber-500/40" placeholder="Chemin du fichier (ex: C:\donnees\mnt.tif)" />
            {onPickRasterFile && <button onClick={() => void openRasterPicker()} className="shrink-0 rounded-2xl border border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300/75 transition-all hover:text-white">Parcourir</button>}
          </div>
          <input value={rasterName} onChange={(e) => setRasterName(e.target.value)} className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-amber-500/40" placeholder="Nom dans QGIS" />
          <button onClick={() => void submitRasterFile()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-amber-500/18"><Plus size={15} /> Charger le fichier</button>
        </div>
      </CollapsibleSection>

      {/* ── Projection du projet ── */}
      <SidebarSection
        title="Projection du projet"
        description="Changez le CRS du projet QGIS."
        accentClassName="text-violet-300/80"
      >
        <div className="space-y-3">
          <select
            value={selectedCrs}
            onChange={(e) => setSelectedCrs(e.target.value)}
            className="w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500/40"
          >
            {COMMON_CRS.map((crs) => (
              <option key={crs.code} value={crs.code}>
                {crs.code} — {crs.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void handleSetProjectCrs()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/12 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:bg-violet-500/18"
          >
            <Globe size={15} />
            Appliquer la projection
          </button>
        </div>
      </SidebarSection>

      {/* ── Performance ── */}
      <CollapsibleSection
        title="Performance"
        description="Temps de réponse LLM et QGIS"
        accentClassName="text-amber-300/80"
        icon={<WandSparkles size={14} />}
        isOpen={expandedSections["performance"] ?? false}
        onToggle={() => toggleSection("performance")}
      >
        <PerformancePanel />
      </CollapsibleSection>
    </div>
  );

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-gray-300 dark:border-gray-800 bg-white dark:bg-[#101113]/95 backdrop-blur-xl transition-[width] duration-300",
        isOpen ? "w-[396px]" : "w-[100px]",
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-300 dark:border-gray-700 px-4 py-3.5">
        {isOpen ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-700 dark:text-gray-300/30">
              GeoSylva
            </p>
            <h2 className="mt-0.5 text-[13px] font-semibold text-gray-700 dark:text-gray-300/80">
              Workspace QGIS
            </h2>
          </div>
        ) : (
          <div className="mx-auto rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-2 text-gray-700 dark:text-gray-300/70">
            <Layers3 size={16} />
          </div>
        )}
        {/* Sidebar toggle button désactivé */}
        {/* <button
          onClick={onToggleOpen}
          className={cn(
            "rounded-2xl border p-2.5 transition-all duration-300",
            isOpen
              ? "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300/50 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white hover:scale-105"
              : "border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-gray-700 dark:text-gray-300/70 hover:from-white/[0.12] hover:to-white/[0.04] hover:text-white hover:shadow-lg hover:shadow-white/10"
          )}
        >
          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button> */}
      </div>

      <div className={cn("flex gap-1.5 px-4 py-3", !isOpen && "flex-col px-3 gap-3")}>
        {[
          { id: "history" as SidebarTab, label: "Historique", Icon: MessageSquare, active: "border-blue-500/30 bg-blue-500/10 text-gray-700 dark:text-gray-300 shadow-sm shadow-blue-500/5" },
          { id: "layers" as SidebarTab, label: "Couches", Icon: Database, active: "border-emerald-500/30 bg-emerald-500/10 text-gray-700 dark:text-gray-300 shadow-sm shadow-emerald-500/5" },
          { id: "services" as SidebarTab, label: "Services", Icon: Network, active: "border-cyan-500/30 bg-cyan-500/10 text-gray-700 dark:text-gray-300 shadow-sm shadow-cyan-500/5" },
        ].map(({ id, label, Icon, active }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-all relative overflow-hidden",
              activeTab === id
                ? active
                : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-white/45 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-white/70",
            )}
            title={label}
          >
            <Icon size={cn(isOpen ? 15 : 22)} className={cn(!isOpen && "text-gray-700 dark:text-gray-300/80")} />
            {isOpen ? <span>{label}</span> : null}
          </button>
        ))}
      </div>

      <div className={cn("px-4", !isOpen && "px-3")}>
        {activeTab === "history" ? (
          <button
            onClick={() => void onCreateConversation()}
            className={cn(
              "flex items-center justify-center rounded-2xl border transition-all",
              "border-blue-500/30 bg-blue-500/12 text-blue-100 hover:bg-blue-500/18 hover:shadow-lg hover:shadow-blue-500/20",
              !isOpen ? "h-16 w-16" : "w-full gap-2 px-3 py-3 text-sm font-semibold",
            )}
          >
            <Plus size={cn(isOpen ? 16 : 24)} />
          </button>
        ) : activeTab === "layers" ? (
          <button
            onClick={() => void onRefreshLayers()}
            className={cn(
              "flex items-center justify-center rounded-2xl border transition-all",
              "border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/16 hover:shadow-lg hover:shadow-emerald-500/20",
              !isOpen ? "h-16 w-16" : "w-full gap-2 px-3 py-3 text-sm font-semibold",
            )}
          >
            <RefreshCw size={cn(isOpen ? 16 : 24)} className={cn(isRefreshingLayers && "animate-spin")} />
          </button>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl border",
              "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
              !isOpen ? "h-16 w-16" : "w-full gap-2 px-3 py-3 text-sm font-semibold",
            )}
          >
            <Link2 size={cn(isOpen ? 16 : 24)} />
          </div>
        )}
      </div>

      {!isOpen ? (
        <div className="mt-4 flex flex-1 flex-col items-center gap-3 px-3">
          {activeTab === "history"
            ? conversations.slice(0, 6).map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    "h-16 w-16 rounded-2xl border transition-all relative overflow-hidden",
                    conversation.id === activeConversationId
                      ? "border-blue-500/40 bg-blue-500/18 text-gray-700 dark:text-gray-300 shadow-lg shadow-blue-500/20"
                      : "border-gray-300 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300/60 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white hover:scale-105",
                  )}
                  title={conversation.title}
                >
                  <MessageSquare size={24} className="text-gray-700 dark:text-gray-300/80" />
                </button>
              ))
            : activeTab === "layers"
              ? layers.slice(0, 6).map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => onToggleLayerSelection(layer.id)}
                    className={cn(
                      "h-16 w-16 rounded-2xl border transition-all relative overflow-hidden",
                      selectedLayerIds.includes(layer.id)
                        ? "border-emerald-500/40 bg-emerald-500/18 text-gray-700 dark:text-gray-300 shadow-lg shadow-emerald-500/20"
                        : "border-gray-300 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300/60 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-white hover:scale-105",
                    )}
                    title={layer.name}
                  >
                    <Database size={24} className="text-gray-700 dark:text-gray-300/80" />
                  </button>
                ))
              : SUPPORTED_REMOTE_SERVICE_TYPES.slice(0, 6).map((service) => (
                  <div
                    key={service.id}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-gray-700 dark:text-gray-300 shadow-lg shadow-cyan-500/10"
                    title={service.description}
                  >
                    <Network size={24} className="text-gray-700 dark:text-gray-300/80" />
                  </div>
                ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
          {activeTab === "history"
            ? renderHistoryTab()
            : activeTab === "layers"
              ? renderLayersTab()
              : renderServicesTab()}
        </div>
      )}
    </aside>
  );
}
