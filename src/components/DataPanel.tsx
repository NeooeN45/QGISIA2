/**
 * DataPanel — Catalogue de données + Sentinel-2 STAC.
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil | 2026-06-08
 * Review obligatoire avant merge dans main.
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
  const [sentinelBbox, setSentinelBbox] = useState("");
  const [sentinelPeriod, setSentinelPeriod] = useState("2024-06-01/2024-06-30");
  const [sentinelBands, setSentinelBands] = useState("B04,B08");
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

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const handleCategoryChange = useCallback((cat: string | null) => {
    setActiveCategory(cat);
    void fetchCatalog(cat ?? undefined);
  }, [fetchCatalog]);

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
      toast.warning("Emprise requise (ex: 1.2,43.5,1.8,44.0)");
      return;
    }
    setSentinelStatus("loading");
    try {
      await loadSentinelBands(sentinelBbox, sentinelBands, sentinelPeriod);
      setSentinelStatus("success");
      toast.success("Bandes Sentinel-2 chargées");
    } catch (e) {
      setSentinelStatus("error");
      toast.error(`Sentinel : ${e instanceof Error ? e.message : "Erreur"}`);
    }
  }, [sentinelBbox, sentinelBands, sentinelPeriod]);

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
        <span
          title="Implémenté par Devin CLI — superviseur Claude Code 4.8"
          className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-violet-500/[0.12] text-violet-500 dark:text-violet-300 border border-violet-500/20"
        >
          ⚡ Devin
        </span>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35" />
        <input
          className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] pl-7 pr-7 py-1.5 text-[12px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50 dark:focus:border-cyan-500/40 transition-colors"
          placeholder="Rechercher une source…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60"
            onClick={() => setQuery("")}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Filtres catégorie */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => handleCategoryChange(null)}
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
            onClick={() => handleCategoryChange(cat === activeCategory ? null : cat)}
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

      {/* Liste */}
      {filtered.length === 0 && !isFetching ? (
        <p className="text-[11px] text-gray-400 dark:text-white/25 text-center py-6">
          {sources.length === 0 ? "Connexion QGIS requise pour charger le catalogue" : "Aucune source trouvée"}
        </p>
      ) : (
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
                      <MapPin size={8} />
                      {src.coverage}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => void handleLoad(src)}
                disabled={loadingId === src.id || loadedIds.has(src.id)}
                title={loadedIds.has(src.id) ? "Déjà chargée" : "Charger dans QGIS"}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all",
                  loadedIds.has(src.id)
                    ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400"
                    : "border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.04] text-gray-500 dark:text-white/50 opacity-0 group-hover:opacity-100 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-300",
                )}
              >
                {loadingId === src.id ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : loadedIds.has(src.id) ? (
                  <CheckCircle2 size={10} />
                ) : (
                  <Plus size={10} />
                )}
                {loadedIds.has(src.id) ? "Chargée" : "Charger"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Sentinel-2 STAC ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-3.5 shadow-sm mt-1">
        <div className="flex items-center gap-2 mb-2.5">
          <Satellite size={13} className="text-violet-500 dark:text-violet-400 shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-600 dark:text-violet-400">
            Sentinel-2 STAC
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <input
            className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-colors"
            placeholder="Emprise : minlon,minlat,maxlon,maxlat"
            value={sentinelBbox}
            onChange={(e) => setSentinelBbox(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-colors"
              placeholder="Période : 2024-06-01/2024-06-30"
              value={sentinelPeriod}
              onChange={(e) => setSentinelPeriod(e.target.value)}
            />
            <input
              className="w-28 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 transition-colors"
              placeholder="B04,B08"
              value={sentinelBands}
              onChange={(e) => setSentinelBands(e.target.value)}
              title="Bandes séparées par virgule (ex: B04,B08 = RED,NIR)"
            />
          </div>
          <button
            onClick={() => void handleSentinel()}
            disabled={sentinelStatus === "loading"}
            className={cn(
              "flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl border text-[11px] font-semibold transition-all disabled:opacity-50",
              sentinelStatus === "success"
                ? "border-emerald-500/35 bg-gradient-to-r from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "border-violet-500/35 bg-gradient-to-r from-violet-600/15 to-violet-500/10 text-violet-600 dark:text-violet-300 hover:from-violet-600/22 hover:to-violet-500/15",
            )}
          >
            {sentinelStatus === "loading" ? (
              <><Loader2 size={11} className="animate-spin" />Chargement…</>
            ) : sentinelStatus === "success" ? (
              <><CheckCircle2 size={11} />Bandes chargées</>
            ) : sentinelStatus === "error" ? (
              <><AlertCircle size={11} />Réessayer</>
            ) : (
              <><Satellite size={11} />Charger les bandes</>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
