/**
 * DossierPanel — Dossiers territoriaux 1-clic.
 *
 * IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI)
 * Superviseur : Claude Code 4.8 — Camil | 2026-06-08
 * Review obligatoire avant merge dans main.
 */
import { useState, useCallback, useEffect } from "react";
import {
  FolderOpen,
  Building2,
  Trees,
  Droplets,
  MapPinned,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DossierMeta {
  id: string;
  name: string;
  description?: string;
  steps: number;
}

interface RunDossierResult {
  ok: boolean;
  steps_done?: number;
  total?: number;
  layers?: string[];
  error?: string;
}

type DossierStatus = "idle" | "loading" | "success" | "error";

const BRIDGE_URL = "http://localhost:8157";

// ── Helpers visuels ───────────────────────────────────────────────────────────

function dossierIcon(id: string): React.ReactNode {
  if (id.includes("urban"))  return <Building2  size={14} className="text-blue-500 dark:text-blue-400" />;
  if (id.includes("foret"))  return <Trees       size={14} className="text-emerald-500 dark:text-emerald-400" />;
  if (id.includes("risque")) return <Droplets    size={14} className="text-amber-500 dark:text-amber-400" />;
  if (id.includes("envir"))  return <MapPinned   size={14} className="text-cyan-500 dark:text-cyan-400" />;
  return <FolderOpen size={14} className="text-gray-400 dark:text-white/40" />;
}

function dossierAccent(id: string): { card: string; action: string; header: string } {
  if (id.includes("urban"))  return {
    card:   "border-blue-500/25 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/[0.04]",
    action: "border-blue-500/35 bg-gradient-to-r from-blue-600/15 to-blue-500/10 text-blue-600 dark:text-blue-300 hover:from-blue-600/22 hover:to-blue-500/15",
    header: "text-blue-600 dark:text-blue-400",
  };
  if (id.includes("foret"))  return {
    card:   "border-emerald-500/25 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.04]",
    action: "border-emerald-500/35 bg-gradient-to-r from-emerald-600/15 to-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:from-emerald-600/22 hover:to-emerald-500/15",
    header: "text-emerald-600 dark:text-emerald-400",
  };
  if (id.includes("risque")) return {
    card:   "border-amber-500/25 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/[0.04]",
    action: "border-amber-500/35 bg-gradient-to-r from-amber-600/15 to-amber-500/10 text-amber-600 dark:text-amber-300 hover:from-amber-600/22 hover:to-amber-500/15",
    header: "text-amber-600 dark:text-amber-400",
  };
  if (id.includes("envir"))  return {
    card:   "border-cyan-500/25 dark:border-cyan-500/20 bg-cyan-50/40 dark:bg-cyan-500/[0.04]",
    action: "border-cyan-500/35 bg-gradient-to-r from-cyan-600/15 to-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:from-cyan-600/22 hover:to-cyan-500/15",
    header: "text-cyan-600 dark:text-cyan-400",
  };
  return {
    card:   "border-gray-200 dark:border-white/[0.08] bg-gray-50/40 dark:bg-white/[0.02]",
    action: "border-gray-300 dark:border-white/20 bg-gray-100/80 dark:bg-white/[0.06] text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/[0.08]",
    header: "text-gray-500 dark:text-white/50",
  };
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchDossiers(): Promise<DossierMeta[]> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/listDossiers`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { dossiers?: DossierMeta[] };
  return data.dossiers ?? [];
}

async function runDossier(dossierId: string): Promise<RunDossierResult> {
  const res = await fetch(`${BRIDGE_URL}/api/qgis/runDossier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dossierId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<RunDossierResult>;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export interface DossierPanelProps {
  onDossierRun?: (dossierId: string, result: RunDossierResult) => void;
}

export default function DossierPanel({ onDossierRun }: DossierPanelProps) {
  const [dossiers, setDossiers] = useState<DossierMeta[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runState, setRunState] = useState<Record<string, DossierStatus>>({});
  const [runResults, setRunResults] = useState<Record<string, RunDossierResult>>({});

  const loadDossiers = useCallback(async () => {
    setIsFetching(true);
    try {
      const data = await fetchDossiers();
      setDossiers(data);
    } catch (e) {
      toast.error(`Dossiers : ${e instanceof Error ? e.message : "Erreur réseau"}`);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => { void loadDossiers(); }, [loadDossiers]);

  const handleRun = useCallback(async (dossier: DossierMeta) => {
    setRunState((s) => ({ ...s, [dossier.id]: "loading" }));
    try {
      const result = await runDossier(dossier.id);
      const nextStatus: DossierStatus = result.ok ? "success" : "error";
      setRunState((s) => ({ ...s, [dossier.id]: nextStatus }));
      setRunResults((s) => ({ ...s, [dossier.id]: result }));

      if (result.ok) {
        toast.success(`Dossier "${dossier.name}" déroulé (${result.steps_done ?? "?"}/${result.total ?? "?"} étapes)`);
        onDossierRun?.(dossier.id, result);
      } else {
        toast.error(result.error ?? "Erreur lors du dossier");
      }
    } catch (e) {
      setRunState((s) => ({ ...s, [dossier.id]: "error" }));
      toast.error(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }, [onDossierRun]);

  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FolderOpen size={15} className="text-amber-500 dark:text-amber-400 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
          Dossiers 1-clic
        </span>
        <span
          title="Implémenté par Devin CLI — superviseur Claude Code 4.8"
          className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-violet-500/[0.12] text-violet-500 dark:text-violet-300 border border-violet-500/20"
        >
          ⚡ Devin
        </span>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed">
        Chaque dossier charge automatiquement un pack de couches + symbologies institutionnelles.
      </p>

      {/* Skeleton */}
      {isFetching && (
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-14 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      )}

      {/* Vide */}
      {!isFetching && dossiers.length === 0 && (
        <p className="text-[11px] text-gray-400 dark:text-white/25 text-center py-6">
          Aucun dossier disponible (connexion QGIS requise)
        </p>
      )}

      {/* Liste */}
      <div className="flex flex-col gap-1.5">
        {dossiers.map((d) => {
          const status = runState[d.id] ?? "idle";
          const result = runResults[d.id];
          const isExpanded = expanded === d.id;
          const accent = dossierAccent(d.id);

          return (
            <div
              key={d.id}
              className={cn("rounded-2xl border transition-colors overflow-hidden shadow-sm", accent.card)}
            >
              {/* Card header */}
              <button
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                onClick={() => setExpanded(isExpanded ? null : d.id)}
              >
                {dossierIcon(d.id)}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[12px] font-semibold truncate", accent.header)}>{d.name}</p>
                  {d.description && (
                    <p className="text-[10px] text-gray-400 dark:text-white/35 truncate mt-0.5">{d.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {status === "success" && (
                    <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" />
                  )}
                  {status === "error" && (
                    <AlertCircle size={12} className="text-red-400" />
                  )}
                  <span className="text-[9px] text-gray-400 dark:text-white/25">{d.steps} ét.</span>
                  {isExpanded
                    ? <ChevronDown size={12} className="text-gray-400 dark:text-white/30" />
                    : <ChevronRight size={12} className="text-gray-400 dark:text-white/30" />
                  }
                </div>
              </button>

              {/* Accordion */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-white/[0.05] px-3 pb-3 pt-2.5 flex flex-col gap-2">
                  {/* Résultat */}
                  {status === "success" && result && (
                    <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={11} />
                      {result.steps_done ?? "?"}/{result.total ?? d.steps} étapes
                      {result.layers && result.layers.length > 0 && (
                        <span className="text-emerald-500/70 dark:text-emerald-300/60">
                          · {result.layers.length} couche{result.layers.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => void handleRun(d)}
                    disabled={status === "loading"}
                    className={cn(
                      "flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl border text-[11px] font-semibold transition-all disabled:opacity-50",
                      accent.action,
                    )}
                  >
                    {status === "loading" ? (
                      <><Loader2 size={11} className="animate-spin" />Déroulement…</>
                    ) : status === "success" ? (
                      <><RefreshCw size={11} />Recharger</>
                    ) : (
                      <>Dérouler "{d.name}"</>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rafraîchir */}
      {!isFetching && (
        <button
          onClick={() => void loadDossiers()}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.02] text-[10px] text-gray-500 dark:text-white/35 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors mt-auto"
        >
          <RefreshCw size={10} />
          Rafraîchir la liste
        </button>
      )}
    </div>
  );
}
