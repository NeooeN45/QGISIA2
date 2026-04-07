import { Code2, Copy, Info, Sparkles, X } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

interface PluginSetupModalProps {
  onClose: () => void;
  pluginPackageLayout: string;
}

export default function PluginSetupModal({ onClose, pluginPackageLayout }: PluginSetupModalProps) {
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
        className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-gray-200 dark:border-[#333537] bg-white dark:bg-[#1a1a1b] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#333537] bg-gradient-to-r from-blue-600/10 to-transparent p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
              <Code2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Installation du plugin QGIS</h3>
              <p className="text-xs text-gray-500 dark:text-[#8e918f]">
                Connectez cette interface à votre session QGIS.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 dark:text-[#8e918f] transition-colors hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6 chat-scrollbar">
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-400">
              <Sparkles size={16} />
              Comment ça marche ?
            </h4>
            <p className="text-sm leading-relaxed text-gray-900 dark:text-white">
              Le plugin QGIS est inclus dans ce projet. Le build web est généré dans
              <code className="mx-1 rounded bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 text-xs text-gray-700 dark:text-gray-200">
                qgis_plugin/web
              </code>
              puis chargé localement dans QGIS ou dans le navigateur selon le runtime
              disponible.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Structure attendue du plugin</h4>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(pluginPackageLayout);
                  toast.success("Structure copiée");
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-400 transition-colors hover:text-blue-300"
              >
                <Copy size={14} />
                Copier
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-[#333537] bg-gray-100 dark:bg-[#0a0a0a] p-4 font-mono text-xs text-blue-700 dark:text-blue-300/80">
              <pre>{pluginPackageLayout}</pre>
            </div>
          </div>

          <div className="flex gap-4 rounded-3xl border border-blue-500/20 bg-blue-600/10 p-4">
            <Info className="shrink-0 text-blue-400" size={20} />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-100">Étapes d'installation</p>
              <p className="text-xs leading-relaxed text-blue-700/80 dark:text-blue-200/75">
                1. Exécutez <code>npm install</code> puis <code>npm run build</code>. 2.
                Copiez le dossier <code>qgis_plugin</code> dans votre répertoire de plugins
                QGIS. 3. Activez ensuite <strong>GeoAI Assistant</strong> dans le
                gestionnaire d'extensions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 dark:border-[#333537] bg-white dark:bg-[#1a1a1b] p-6">
          <button
            onClick={onClose}
            className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition-all hover:bg-blue-500"
          >
            J'ai compris
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
