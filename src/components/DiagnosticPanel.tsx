/**
 * DiagnosticPanel — Calcul d'indices spectraux, détection de changement,
 * stats zonales et classification thématique.
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil | 2026-06-08
 * Review obligatoire avant merge dans main.
 */
import { useState, useCallback } from "react";
import {
  Activity,
  BarChart3,
  GitCompareArrows,
  Layers,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

type LoadStatus = "idle" | "loading" | "success" | "error";

const BRIDGE_URL = "http://localhost:8157";

interface IndexMeta {
  id: string;
  label: string;
  description: string;
  rampFrom: string;
  rampTo: string;
}

const SPECTRAL_INDICES: IndexMeta[] = [
  { id: "ndvi",   label: "NDVI",   description: "Végétation (NIR-RED)",           rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "ndwi",   label: "NDWI",   description: "Eau (GREEN-NIR)",                rampFrom: "#d73027", rampTo: "#4575b4" },
  { id: "ndbi",   label: "NDBI",   description: "Bâti (SWIR-NIR)",                rampFrom: "#ffffbf", rampTo: "#fc8d59" },
  { id: "nbr",    label: "NBR",    description: "Brûlé (NIR-SWIR)",               rampFrom: "#fee08b", rampTo: "#d73027" },
  { id: "evi",    label: "EVI",    description: "Végétation amélioré",            rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "savi",   label: "SAVI",   description: "Végétation (sol ajusté)",        rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "msavi2", label: "MSAVI2", description: "Végétation (sol modifié)",       rampFrom: "#d73027", rampTo: "#1a9850" },
  { id: "ndmi",   label: "NDMI",   description: "Humidité (NIR-SWIR)",            rampFrom: "#fc8d59", rampTo: "#4575b4" },
  { id: "bsi",    label: "BSI",    description: "Sol nu (SWIR+RED/NIR+BLUE)",     rampFrom: "#ffffbf", rampTo: "#d73027" },
];

const CLASSIFY_SCHEMES = [
  { id: "ndvi_vegetation", label: "Végétation (NDVI)" },
  { id: "nbr_severity",    label: "Sévérité incendie (NBR)" },
  { id: "slope_classes",   label: "Classes de pente" },
  { id: "change_severity", label: "Changement (dNDVI)" },
];

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiPost(endpoint: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Erreur inconnue");
}

// ── Composant ─────────────────────────────────────────────────────────────────

export interface DiagnosticPanelProps {
  onResult?: (type: string, detail: string) => void;
}

export default function DiagnosticPanel({ onResult }: DiagnosticPanelProps) {
  // Indice spectral
  const [selectedIndex, setSelectedIndex] = useState("ndvi");
  const [indexRasterId, setIndexRasterId] = useState("");
  const [indexStatus, setIndexStatus] = useState<LoadStatus>("idle");

  // Détection de changement
  const [raster1Id, setRaster1Id] = useState("");
  const [raster2Id, setRaster2Id] = useState("");
  const [changeStatus, setChangeStatus] = useState<LoadStatus>("idle");

  // Stats zonales
  const [statsRasterId, setStatsRasterId] = useState("");
  const [statsVectorId, setStatsVectorId] = useState("");
  const [statType, setStatType] = useState("mean");
  const [statsStatus, setStatsStatus] = useState<LoadStatus>("idle");

  // Classification
  const [classRasterId, setClassRasterId] = useState("");
  const [classScheme, setClassScheme] = useState("ndvi_vegetation");
  const [classStatus, setClassStatus] = useState<LoadStatus>("idle");

  const indexMeta = SPECTRAL_INDICES.find((i) => i.id === selectedIndex);

  const handleComputeIndex = useCallback(async () => {
    if (!indexRasterId.trim()) { toast.warning("ID raster requis"); return; }
    setIndexStatus("loading");
    try {
      await apiPost("/api/qgis/computeSpectralIndex", {
        rasterId: indexRasterId, index: selectedIndex,
        outputPath: `/tmp/${selectedIndex}_result.tif`,
      });
      setIndexStatus("success");
      toast.success(`${selectedIndex.toUpperCase()} calculé`);
      onResult?.(selectedIndex, indexRasterId);
    } catch (e) {
      setIndexStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur calcul");
    }
  }, [indexRasterId, selectedIndex, onResult]);

  const handleChange = useCallback(async () => {
    if (!raster1Id.trim() || !raster2Id.trim()) { toast.warning("Deux rasters requis"); return; }
    setChangeStatus("loading");
    try {
      await apiPost("/api/qgis/computeRasterDifference", {
        raster1Id, raster2Id, outputPath: "/tmp/change_result.tif",
      });
      setChangeStatus("success");
      toast.success("Détection de changement calculée");
      onResult?.("change", `${raster1Id} → ${raster2Id}`);
    } catch (e) {
      setChangeStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur différence");
    }
  }, [raster1Id, raster2Id, onResult]);

  const handleZonalStats = useCallback(async () => {
    if (!statsRasterId.trim() || !statsVectorId.trim()) { toast.warning("Raster + vecteur requis"); return; }
    setStatsStatus("loading");
    try {
      await apiPost("/api/qgis/zonalStatistics", {
        rasterId: statsRasterId, vectorId: statsVectorId, stat: statType,
      });
      setStatsStatus("success");
      toast.success(`Stats zonales (${statType}) calculées`);
      onResult?.("zonal_stats", statsRasterId);
    } catch (e) {
      setStatsStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur stats");
    }
  }, [statsRasterId, statsVectorId, statType, onResult]);

  const handleClassify = useCallback(async () => {
    if (!classRasterId.trim()) { toast.warning("ID raster requis"); return; }
    setClassStatus("loading");
    try {
      await apiPost("/api/qgis/classifyRaster", {
        rasterId: classRasterId, scheme: classScheme,
        outputPath: `/tmp/${classScheme}_result.tif`,
      });
      setClassStatus("success");
      toast.success("Classification terminée");
      onResult?.("classify", classScheme);
    } catch (e) {
      setClassStatus("error");
      toast.error(e instanceof Error ? e.message : "Erreur classification");
    }
  }, [classRasterId, classScheme, onResult]);

  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity size={15} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
          Diagnostic satellite
        </span>
        <span
          title="Implémenté par Devin CLI — superviseur Claude Code 4.8"
          className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-violet-500/[0.12] text-violet-500 dark:text-violet-300 border border-violet-500/20"
        >
          ⚡ Devin
        </span>
      </div>

      {/* ── Indice spectral ───────────────────────────────────────────────── */}
      <DiagSection icon={<BarChart3 size={13} className="text-emerald-500 dark:text-emerald-400" />} title="Indice spectral">
        <div className="grid grid-cols-3 gap-1">
          {SPECTRAL_INDICES.map((idx) => (
            <button
              key={idx.id}
              onClick={() => setSelectedIndex(idx.id)}
              title={idx.description}
              className={cn(
                "relative flex flex-col items-start rounded-xl border px-2 py-1.5 text-[10px] font-semibold transition-all overflow-hidden",
                selectedIndex === idx.id
                  ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/12 to-emerald-600/6 text-emerald-600 dark:text-emerald-300"
                  : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
              )}
            >
              <span className="font-mono font-bold">{idx.label}</span>
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
                style={{ background: `linear-gradient(to right, ${idx.rampFrom}, ${idx.rampTo})` }}
              />
            </button>
          ))}
        </div>
        {indexMeta && (
          <p className="text-[10px] text-gray-400 dark:text-white/30 mt-1">{indexMeta.description}</p>
        )}
        <TextInput
          placeholder="ID du raster (ex: Sentinel_B04_B08)"
          value={indexRasterId}
          onChange={setIndexRasterId}
          focusColor="emerald"
        />
        <ActionButton
          status={indexStatus}
          idle={`Calculer ${selectedIndex.toUpperCase()}`}
          loading="Calcul en cours…"
          success="Indice calculé"
          color="emerald"
          onClick={() => void handleComputeIndex()}
        />
      </DiagSection>

      {/* ── Détection de changement ───────────────────────────────────────── */}
      <DiagSection icon={<GitCompareArrows size={13} className="text-amber-500 dark:text-amber-400" />} title="Détection de changement">
        <div className="flex gap-2">
          <TextInput placeholder="Raster t1 (avant)" value={raster1Id} onChange={setRaster1Id} focusColor="amber" />
          <TextInput placeholder="Raster t2 (après)" value={raster2Id} onChange={setRaster2Id} focusColor="amber" />
        </div>
        <ActionButton
          status={changeStatus}
          idle="Calculer t2 − t1"
          loading="Différence…"
          success="Changement calculé"
          color="amber"
          onClick={() => void handleChange()}
        />
      </DiagSection>

      {/* ── Stats zonales ─────────────────────────────────────────────────── */}
      <DiagSection icon={<Layers size={13} className="text-cyan-500 dark:text-cyan-400" />} title="Stats zonales">
        <div className="flex gap-2">
          <TextInput placeholder="Raster (ex: NDVI)" value={statsRasterId} onChange={setStatsRasterId} focusColor="cyan" />
          <TextInput placeholder="Vecteur (parcelles)" value={statsVectorId} onChange={setStatsVectorId} focusColor="cyan" />
        </div>
        <select
          className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-700 dark:text-white/60 focus:outline-none focus:border-cyan-500/50 transition-colors"
          value={statType}
          onChange={(e) => setStatType(e.target.value)}
        >
          {["mean", "min", "max", "count", "sum", "stdev"].map((s) => (
            <option key={s} value={s} className="bg-white dark:bg-gray-900">{s}</option>
          ))}
        </select>
        <ActionButton
          status={statsStatus}
          idle={`Calculer ${statType} par zone`}
          loading="Stats en cours…"
          success="Stats calculées"
          color="cyan"
          onClick={() => void handleZonalStats()}
        />
      </DiagSection>

      {/* ── Classification thématique ─────────────────────────────────────── */}
      <DiagSection icon={<BarChart3 size={13} className="text-violet-500 dark:text-violet-400" />} title="Classification thématique">
        <TextInput
          placeholder="ID du raster à classifier"
          value={classRasterId}
          onChange={setClassRasterId}
          focusColor="violet"
        />
        <select
          className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-700 dark:text-white/60 focus:outline-none focus:border-violet-500/50 transition-colors"
          value={classScheme}
          onChange={(e) => setClassScheme(e.target.value)}
        >
          {CLASSIFY_SCHEMES.map((s) => (
            <option key={s.id} value={s.id} className="bg-white dark:bg-gray-900">{s.label}</option>
          ))}
        </select>
        <ActionButton
          status={classStatus}
          idle="Classifier"
          loading="Classification…"
          success="Classifié"
          color="violet"
          onClick={() => void handleClassify()}
        />
      </DiagSection>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function DiagSection({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] p-3 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500 dark:text-white/50">{title}</p>
      </div>
      {children}
    </section>
  );
}

const FOCUS_COLORS: Record<string, string> = {
  emerald: "focus:border-emerald-500/50",
  amber:   "focus:border-amber-500/50",
  cyan:    "focus:border-cyan-500/50",
  violet:  "focus:border-violet-500/50",
};

function TextInput({
  placeholder, value, onChange, focusColor,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  focusColor: string;
}) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-1.5 text-[11px] text-gray-800 dark:text-white/75 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none transition-colors",
        FOCUS_COLORS[focusColor] ?? "focus:border-blue-500/50",
      )}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const COLOR_VARIANTS: Record<string, { base: string; success: string }> = {
  emerald: {
    base:    "border-emerald-500/35 bg-gradient-to-r from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:from-emerald-600/22 hover:to-emerald-500/15 hover:shadow-sm hover:shadow-emerald-500/20",
    success: "border-emerald-500/35 bg-gradient-to-r from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  amber: {
    base:    "border-amber-500/35 bg-gradient-to-r from-amber-600/15 to-amber-500/10 text-amber-600 dark:text-amber-300 hover:from-amber-600/22 hover:to-amber-500/15 hover:shadow-sm hover:shadow-amber-500/20",
    success: "border-amber-500/35 bg-gradient-to-r from-amber-600/15 to-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  cyan: {
    base:    "border-cyan-500/35 bg-gradient-to-r from-cyan-600/15 to-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:from-cyan-600/22 hover:to-cyan-500/15 hover:shadow-sm hover:shadow-cyan-500/20",
    success: "border-cyan-500/35 bg-gradient-to-r from-cyan-600/15 to-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  },
  violet: {
    base:    "border-violet-500/35 bg-gradient-to-r from-violet-600/15 to-violet-500/10 text-violet-600 dark:text-violet-300 hover:from-violet-600/22 hover:to-violet-500/15 hover:shadow-sm hover:shadow-violet-500/20",
    success: "border-violet-500/35 bg-gradient-to-r from-violet-600/15 to-violet-500/10 text-violet-600 dark:text-violet-300",
  },
};

function ActionButton({
  status, idle, loading, success, color, onClick,
}: {
  status: LoadStatus;
  idle: string;
  loading: string;
  success: string;
  color: keyof typeof COLOR_VARIANTS;
  onClick: () => void;
}) {
  const variant = COLOR_VARIANTS[color] ?? COLOR_VARIANTS.emerald;
  return (
    <button
      onClick={onClick}
      disabled={status === "loading"}
      className={cn(
        "flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl border text-[11px] font-semibold transition-all disabled:opacity-50",
        status === "success" ? variant.success : variant.base,
      )}
    >
      {status === "loading" ? (
        <><Loader2 size={11} className="animate-spin" />{loading}</>
      ) : status === "success" ? (
        <><CheckCircle2 size={11} />{success}</>
      ) : status === "error" ? (
        <><AlertCircle size={11} />Réessayer</>
      ) : (
        idle
      )}
    </button>
  );
}
