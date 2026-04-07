import { Loader2, X } from "lucide-react";
import { motion } from "motion/react";

import { LayerDiagnostics } from "../lib/qgis";

interface LayerDiagnosticsModalProps {
  diagnostics: LayerDiagnostics | null;
  isLoading: boolean;
  layerName: string;
  onClose: () => void;
}

export default function LayerDiagnosticsModal({
  diagnostics,
  isLoading,
  layerName,
  onClose,
}: LayerDiagnosticsModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 20 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17181a] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Diagnostic de couche</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-white/45">{layerName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 dark:text-white/45 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 chat-scrollbar">
          {isLoading ? (
            <div className="flex items-center gap-3 rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5 text-gray-500 dark:text-white/65">
              <Loader2 size={18} className="animate-spin" />
              Diagnostic en cours...
            </div>
          ) : diagnostics ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-white/35">Type</p>
                  <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-white">
                    {[diagnostics.layerType, diagnostics.geometryType]
                      .filter(Boolean)
                      .join(" · ") || "Inconnu"}
                  </p>
                </div>
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-white/35">CRS</p>
                  <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-white">
                    {diagnostics.crs || "Inconnu"}
                  </p>
                </div>
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-white/35">Entités</p>
                  <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-white">
                    {diagnostics.featureCount ?? "?"} total
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-white/45">
                    {diagnostics.selectedFeatureCount} sélectionnée(s)
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/8 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/60">
                    Géométries invalides
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white">
                    {diagnostics.invalidGeometryCount}
                  </p>
                </div>
                <div className="rounded-3xl border border-orange-500/20 bg-orange-500/8 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-orange-600 dark:text-orange-100/60">
                    Géométries vides
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white">
                    {diagnostics.emptyGeometryCount}
                  </p>
                </div>
                <div className="rounded-3xl border border-blue-500/20 bg-blue-500/8 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-blue-600 dark:text-blue-100/60">
                    Échantillon
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white">
                    {diagnostics.sampledFeatureCount}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-white/45">
                    {diagnostics.isSampled ? "Diagnostic partiel" : "Diagnostic complet"}
                  </p>
                </div>
              </div>

              {diagnostics.warnings.length > 0 && (
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/8 p-5">
                  <p className="text-sm font-semibold text-amber-800 dark:text-white">Alertes</p>
                  <ul className="mt-3 space-y-2 text-sm text-amber-700 dark:text-amber-100/80">
                    {diagnostics.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {diagnostics.extent && (
                <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">Emprise</p>
                  <div className="mt-3 grid gap-3 text-sm text-gray-600 dark:text-white/70 md:grid-cols-2">
                    <div>xMin: {diagnostics.extent.xmin.toFixed(3)}</div>
                    <div>yMin: {diagnostics.extent.ymin.toFixed(3)}</div>
                    <div>xMax: {diagnostics.extent.xmax.toFixed(3)}</div>
                    <div>yMax: {diagnostics.extent.ymax.toFixed(3)}</div>
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Qualité des champs</p>
                <div className="mt-4 space-y-3">
                  {diagnostics.fieldDiagnostics.slice(0, 12).map((field) => (
                    <div
                      key={field.name}
                      className="rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-black/15 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{field.name}</p>
                          <p className="text-xs text-gray-500 dark:text-white/45">{field.type}</p>
                        </div>
                        <div className="text-right text-xs text-gray-500 dark:text-white/55">
                          <div>{field.nullCount} null(s)</div>
                          <div>{Math.round(field.fillRate * 100)}% remplis</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5 text-gray-500 dark:text-white/60">
              Aucun diagnostic disponible pour cette couche.
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
