/**
 * DataPanel — Catalogue de données + Sentinel-2 STAC.
 *
 * Redesign UX 2026-06-08 :
 *  - Sélecteur de bandes visuel (coches avec nom complet)
 *  - Bbox : bouton "Emprise du projet" plutôt que coordonnées manuelles
 *  - États complets (loading skeleton, erreur inline, succès)
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil
 */
import { useState, useCallback, useEffect } from "react";
import {
  Globe,
  Satellite,
  Search,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  RefreshCw,
  Info,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataSource {
  id: string;
  name: string;
  category: string;
  coverage?: string;
  provider?: string;
}

type LoadStatus = "idle" | "loading" | "success" | "error";

const BRIDGE_URL = "http://localhost:8157";

// ── Constantes visuelles ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  basemap:        "border-cyan-500/30    bg-cyan-500/[0.08]    text-cyan-600    dark:text-cyan-300",
  satellite:      "border-violet-500/30  bg-violet-500/[0.08]  text-violet-600  dark:text-violet-300",
  france:         "border-blue-500/30    bg-blue-500/[0.08]    text-blue-600    dark:text-blue-300",
  relief:         "border-amber-500/30   bg-amber-500/[0.08]   text-amber-600   dark:text-amber-300",
  occupation_sol: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300",
  labels:         "border-gray-400/30    bg-gray-400/[0.06]    text-gray-500    dark:text-gray-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  basemap: "Fond", satellite: "Satellite", france: "France",
  relief: "Relief", occupation_sol: "Occupation", labels: "Labels",
};

/** Bandes Sentinel-2 — nom humain + couleur visuelle */
const SENTINEL_BANDS = [
  { id: "B02", label: "Bleu",      description: "Bleu visible",       color: "#4fc3f7" },
  { id: "B03", label: "Vert",      description: "Vert visible",       color: "#81c784" },
  { id: "B04", label: "Rouge",     description: "Rouge visible",      color: "#e57373" },
  { id: "B08", label: "NIR",       description: "Proche infrarouge",  color: "#9575cd" },
  { id: "B11", label: "SWIR1",     description: "Infrarouge ondes courtes 1", color: "#ff8a65" },
  { id: "B12", label: "SWIR2",     description: "Infrarouge ondes courtes 2", color: "#ffb74d" },
];

/** Périodes prédéfinies */
const PERIOD_PRESETS = [
  { label: "Été 2024",     value: "2024-06-01/2024-08-31" },
  { label: "Printemps 24", value: "2024-03-01/2024-05-31" },
  { label: "Automne 24",   value: "2024-09-01/2024-11-30" },
  { label: "Hiver 23/24",  value: "2023-12-01/2024-02-28" },
  { label: "Personnalisé", value: "custom" },
];

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchSources(category?: string): Promise<DataSource[]> {
  const url = new URL(`${BRIDGE_URL}/api/qgis/listDataSources`);
  if (category) url.searchParams.set("category", category);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { sources?: DataSource[] };
  return data.sources ?? [];
}

async function loadSource(sourceId: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/addDataSource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Erreur inconnue");
}

async function fetchProjectExtent(): Promise<string | null> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/qgis/projectExtent`);
    if (!res.ok) return null;
    const data = await res.json() as { bbox?: string };
    return data.bbox ?? null;
  } catch {
    return null;
  }
}

async function loadSentinelBands(bbox: string, bands: string, period: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/loadSatelliteBands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bbox, bands, datetime: period }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Erreur inconnue");
}

// ── Composant ─────────────────────────────────────────────────────────────────

export interface DataPanelProps {
  initialSources?: DataSource[];
  onSourceLoaded?: (sourceId: string) => void;
}

export default function DataPanel({ initialSources, onSourceLoaded }: DataPanelProps) {
  const [sources, setSources] = useState<DataSource[]>(initialSources ?? []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  // Sentinel-2
  const [selectedBands, setSelectedBands] = useState<string[]>(["B04", "B08"]);
  const [periodPreset, setPeriodPreset] = useState("2024-06-01/2024-08-31");
  const [customPeriod, setCustomPeriod] = useState("");
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [sentinelBbox, setSentinelBbox] = useState("");
  const [bboxLoading, setBboxLoading] = useState(false);
  const [sentinelStatus, setSentinelStatus] = useState<LoadStatus>("idle");

  const categories = Array.from(new Set(sources.map((s) => s.category))).sort();

  const fetchCatalog = useCallback(async (cat?: string) => {
    setIsFetching(true);
    try {
      const data = await fetchSources(cat);
      setSources(data);
    } catch (e) {
      toast.error(`Catalogue : ${e instanceof Error ? e.message : "Erreur réseau"}`);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => { void fetchCatalog(); }, [fetchCatalog]);

  const handleUseProjectExtent = useCallback(async () => {
    setBboxLoading(true);
    try {
      const bbox = await fetchProjectExtent();
      if (bbox) {
        setSentinelBbox(bbox);
        toast.success("Emprise du projet récupérée");
      } else {
        toast.warning("Pas de projet QGIS ouvert");
      }
    } finally {
      setBboxLoading(false);
    }
  }, []);

  const toggleBand = useCallback((bandId: string) => {
    setSelectedBands((prev) => {
      if (prev.includes(bandId)) {
        if (prev.length === 1) return prev; // garder au moins 1
        return prev.filter((b) => b !== bandId);
      }
      return [...prev, bandId];
    });
    setSentinelStatus("idle");
  }, []);

  const handlePeriodPreset = useCallback((value: string) => {
    if (value === "custom") {
      setIsCustomPeriod(true);
    } else {
      setIsCustomPeriod(false);
      setPeriodPreset(value);
    }
    setSentinelStatus("idle");
  }, []);

  const handleLoad = useCallback(async (src: DataSource) => {
    setLoadingId(src.id);
    try {
      await loadSource(src.id);
      setLoadedIds((prev) => new Set([...prev, src.id]));
      toast.success(`"${src.name}" chargée dans QGIS`);
      onSourceLoaded?.(src.id);
    } catch (e) {
      toast.error(`Chargement échoué : ${e instanceof Error ? e.message : "Erreur"}`);
    } finally {
      setLoadingId(null);
    }
  }, [onSourceLoaded]);

  const handleSentinel = useCallback(async () => {
    if (!sentinelBbox.trim()) {
      toast.warning("Clique sur « Emprise du projet » d'abord");
      return;
    }
    if (selectedBands.length === 0) {
      toast.warning("Sélectionne au moins une bande");
      return;
    }
    const period = isCustomPeriod ? customPeriod : periodPreset;
    if (!period.trim()) {
      toast.warning("Sélectionne une période");
      return;
    }
    setSentinelStatus("loading");
    try {
      await loadSentinelBands(sentinelBbox, selectedBands.join(","), period);
      setSentinelStatus("success");
      toast.success(`${selectedBands.length} bande(s) Sentinel-2 chargées`);
    } catch (e) {
      setSentinelStatus("error");
      toast.error(`Sentinel : ${e instanceof Error ? e.message : "Erreur"}`);
    }
  }, [sentinelBbox, selectedBands, isCustomPeriod, customPeriod, periodPreset]);

  const filtered = sources.filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.provider?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div className="flex flex-col gap-3.5 p-3.5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Globe size={15} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-400">
          Catalogue de données
        </span>
        <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-violet-500/[0.12] text-violet-500 dark:text-violet-300 border border-violet-500/20">
          ⚡ Devin
        </span>
      </div>

      {/* Recherche + filtres */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 pointer-events-none" />
        <input
          className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] pl-7 pr-7 py-1.5 text-[12px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50 dark:focus:border-cyan-500/40 transition-colors"
          placeholder="Rechercher un fond de carte, satellite…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60" onClick={() => setQuery("")}>
            <X size={11} />
          </button>
        )}
      </div>

      {/* Filtres catégorie */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => { setActiveCategory(null); void fetchCatalog(); }}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-lg border transition-colors",
            activeCategory === null
              ? "border-cyan-500/40 bg-cyan-500/[0.12] text-cyan-600 dark:text-cyan-300"
              : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
          )}
        >
          Tout
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              const next = cat === activeCategory ? null : cat;
              setActiveCategory(next);
              void fetchCatalog(next ?? undefined);
            }}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-lg border transition-colors",
              activeCategory === cat
                ? (CATEGORY_COLORS[cat] ?? "border-white/20 bg-white/10 text-white")
                : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
            )}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
        <button
          onClick={() => void fetchCatalog(activeCategory ?? undefined)}
          disabled={isFetching}
          className="ml-auto text-[10px] px-2 py-0.5 rounded-lg border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          {isFetching ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
        </button>
      </div>

      {/* Skeleton de chargement */}
      {isFetching && (
        <div className="flex flex-col gap-1">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      )}

      {/* Liste vide */}
      {!isFetching && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Globe size={24} className="text-gray-300 dark:text-white/15" />
          <p className="text-[11px] text-gray-400 dark:text-white/25">
            {sources.length === 0
              ? "Lance QGIS et le plugin pour voir le catalogue"
              : "Aucune source trouvée"}
          </p>
        </div>
      )}

      {/* Liste */}
      {!isFetching && filtered.length > 0 && (
        <div className="flex flex-col gap-1">
          {filtered.map((src) => (
            <div
              key={src.id}
              className="group flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] px-2.5 py-2 hover:border-gray-300 dark:hover:border-white/[0.1] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-gray-800 dark:text-white/80 truncate">{src.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md border", CATEGORY_COLORS[src.category] ?? "border-white/10 bg-white/5 text-white/40")}>
                    {CATEGORY_LABELS[src.category] ?? src.category}
                  </span>
                  {src.coverage && (
                    <span className="text-[9px] text-gray-400 dark:text-white/25 flex items-center gap-0.5">
                      <MapPin size={8} />{src.coverage}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => void handleLoad(src)}
                disabled={loadingId === src.id || loadedIds.has(src.id)}
                title={loadedIds.has(src.id) ? "Déjà chargée" : "Charger dans QGIS"}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border transition-all font-medium",
                  loadedIds.has(src.id)
                    ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400"
                    : "border-transparent bg-transparent text-transparent group-hover:border-gray-200 dark:group-hover:border-white/[0.08] group-hover:bg-gray-100/80 dark:group-hover:bg-white/[0.04] group-hover:text-gray-500 dark:group-hover:text-white/50 hover:!border-cyan-500/40 hover:!text-cyan-600 dark:hover:!text-cyan-300",
                )}
              >
                {loadingId === src.id ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : loadedIds.has(src.id) ? (
                  <><CheckCircle2 size={10} />Chargée</>
                ) : (
                  <><Plus size={10} />Charger</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Sentinel-2 ─────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-3.5 shadow-sm flex flex-col gap-3 mt-1">
        <div className="flex items-center gap-2">
          <Satellite size={13} className="text-violet-500 dark:text-violet-400 shrink-0" />
          <p className="text-[11px] font-bold text-gray-700 dark:text-white/70">Images Sentinel-2</p>
          <span className="ml-auto text-[9px] text-gray-400 dark:text-white/25">Gratuit · 10m</span>
        </div>

        {/* Zone — Emprise auto */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-[0.15em]">Zone</p>
          <button
            onClick={() => void handleUseProjectExtent()}
            disabled={bboxLoading}
            className={cn(
              "flex items-center justify-center gap-1.5 w-full rounded-xl border py-2 text-[12px] font-semibold transition-all",
              sentinelBbox
                ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400"
                : "border-violet-500/35 bg-gradient-to-r from-violet-600/15 to-violet-500/10 text-violet-600 dark:text-violet-300 hover:from-violet-600/22",
            )}
          >
            {bboxLoading
              ? <><Loader2 size={11} className="animate-spin" />Récupération…</>
              : sentinelBbox
              ? <><CheckCircle2 size={11} />Emprise définie ✓</>
              : <><MapPin size={11} />Utiliser l'emprise du projet QGIS</>
            }
          </button>
          {sentinelBbox && (
            <button
              onClick={() => { setSentinelBbox(""); setSentinelStatus("idle"); }}
              className="self-end text-[10px] text-gray-400 dark:text-white/25 hover:text-gray-600 dark:hover:text-white/50 transition-colors"
            >
              Effacer l'emprise
            </button>
          )}
        </div>

        {/* Période */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-[0.15em] flex items-center gap-1">
            <Calendar size={10} />Période
          </p>
          <div className="grid grid-cols-2 gap-1">
            {PERIOD_PRESETS.map((p) => {
              const isActive = isCustomPeriod ? p.value === "custom" : p.value === periodPreset;
              return (
                <button
                  key={p.value}
                  onClick={() => handlePeriodPreset(p.value)}
                  className={cn(
                    "text-[11px] px-2 py-1.5 rounded-lg border text-left transition-all",
                    isActive
                      ? "border-violet-500/40 bg-violet-500/[0.1] text-violet-700 dark:text-violet-300 font-semibold"
                      : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {isCustomPeriod && (
            <input
              className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-colors"
              placeholder="2024-01-01/2024-12-31"
              value={customPeriod}
              onChange={(e) => { setCustomPeriod(e.target.value); setSentinelStatus("idle"); }}
            />
          )}
        </div>

        {/* Bandes */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-[0.15em]">
            Bandes à télécharger
          </p>
          <div className="grid grid-cols-3 gap-1">
            {SENTINEL_BANDS.map((band) => {
              const selected = selectedBands.includes(band.id);
              return (
                <button
                  key={band.id}
                  onClick={() => toggleBand(band.id)}
                  className={cn(
                    "flex flex-col items-start rounded-xl border px-2 py-1.5 transition-all text-left overflow-hidden relative",
                    selected
                      ? "border-violet-500/40 bg-violet-500/[0.08] text-violet-700 dark:text-violet-300"
                      : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <div
                      className="w-2 h-2 rounded-full shrink-0 opacity-80"
                      style={{ backgroundColor: band.color }}
                    />
                    <span className="text-[11px] font-bold font-mono">{band.id}</span>
                    {selected && <CheckCircle2 size={9} className="ml-auto text-violet-500 dark:text-violet-400" />}
                  </div>
                  <span className="text-[9px] text-gray-400 dark:text-white/25 mt-0.5">{band.label}</span>
                  {selected && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
                      style={{ backgroundColor: band.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] px-2.5 py-2">
            <Info size={11} className="text-violet-400 shrink-0" />
            <p className="text-[10px] text-violet-600/70 dark:text-violet-400/60">
              {selectedBands.length === 0
                ? "Sélectionne au moins une bande"
                : `${selectedBands.length} bande(s) : ${selectedBands.join(", ")} · Recommandé : B04 + B08 pour NDVI`}
            </p>
          </div>
        </div>

        {/* Bouton charger */}
        <button
          onClick={() => void handleSentinel()}
          disabled={sentinelStatus === "loading" || !sentinelBbox || selectedBands.length === 0}
          className={cn(
            "flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
            sentinelStatus === "success"
              ? "border-emerald-500/35 bg-gradient-to-r from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "border-violet-500/35 bg-gradient-to-r from-violet-600/15 to-violet-500/10 text-violet-600 dark:text-violet-300 hover:from-violet-600/22",
          )}
        >
          {sentinelStatus === "loading" ? (
            <><Loader2 size={11} className="animate-spin" />Téléchargement…</>
          ) : sentinelStatus === "success" ? (
            <><CheckCircle2 size={11} />Images chargées dans QGIS</>
          ) : sentinelStatus === "error" ? (
            <><AlertCircle size={11} />Réessayer</>
          ) : (
            <><Satellite size={11} />Charger {selectedBands.length > 0 ? `(${selectedBands.length} bande${selectedBands.length > 1 ? "s" : ""})` : "les bandes"}</>
          )}
        </button>
      </section>
    </div>
  );
}
