"""
Patch WorkspaceSidebar.tsx — ajoute le 4e onglet Outils (Devin CLI 2026-06-08).
"""
import pathlib

ROOT = pathlib.Path(__file__).parent.parent
SIDEBAR = ROOT / "src" / "components" / "WorkspaceSidebar.tsx"

c = SIDEBAR.read_text(encoding="utf-8")

# ── 1. Lucide icons ───────────────────────────────────────────────────────────
OLD1 = '  ShieldCheck,\n} from "lucide-react";'
NEW1 = '  ShieldCheck,\n  Activity,\n  FolderOpen,\n} from "lucide-react";'
assert OLD1 in c, "ICON IMPORT not found"
c = c.replace(OLD1, NEW1, 1)
print("1. Lucide icons OK")

# ── 2. SidebarTab type ────────────────────────────────────────────────────────
OLD2 = 'type SidebarTab = "history" | "layers" | "services";'
NEW2 = 'type SidebarTab = "history" | "layers" | "services" | "tools";'
assert OLD2 in c, "SidebarTab type not found"
c = c.replace(OLD2, NEW2, 1)
print("2. SidebarTab OK")

# ── 3. Props interface : ajouter onSendMessage + onRefreshLayers ──────────────
OLD3 = '  onToggleOpen: () => void;\n  onZoomToLayer: (layerId: string) => void | Promise<void>;\n}'
NEW3 = ('  onToggleOpen: () => void;\n  onZoomToLayer: (layerId: string) => void | Promise<void>;\n'
        '  onSendMessage?: (message: string) => void;\n}')
assert OLD3 in c, "Props not found"
c = c.replace(OLD3, NEW3, 1)
print("3. Props OK")

# ── 4. Destructuring : ajouter onSendMessage ─────────────────────────────────
OLD4 = ('    onToggleOpen,\n    onZoomToLayer,\n  } = props;')
NEW4 = ('    onToggleOpen,\n    onZoomToLayer,\n    onSendMessage,\n  } = props;')
assert OLD4 in c, "Destructuring not found"
c = c.replace(OLD4, NEW4, 1)
print("4. Destructuring OK")

# ── 5. État ToolsSubTab ───────────────────────────────────────────────────────
OLD5 = '  const [servicesSubTab, setServicesSubTab] = useState<ServicesSubTab>("catalog");'
NEW5 = ('  const [servicesSubTab, setServicesSubTab] = useState<ServicesSubTab>("catalog");\n'
        '  const [toolsSubTab, setToolsSubTab] = useState<"data" | "diagnostic" | "dossiers">("data");')
assert OLD5 in c, "ServicesSubTab state not found"
c = c.replace(OLD5, NEW5, 1)
print("5. toolsSubTab state OK")

# ── 6. renderToolsTab function (avant le return) ──────────────────────────────
OLD6 = '  return (\n    <aside'
NEW6 = r"""  // ── Onglet Outils (panneaux Devin) ──────────────────────────────────────────
  // IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI) — Superviseur : Claude Code 4.8 — 2026-06-08
  function renderToolsTab() {
    return (
      <div className="flex flex-col gap-3">
        {/* Sous-onglets */}
        <div className="flex gap-1.5">
          {(["data", "diagnostic", "dossiers"] as const).map((tab) => {
            const meta = {
              data: { label: "Données", icon: <Globe size={12} />, active: "border-cyan-500/40 bg-cyan-500/12 text-cyan-600 dark:text-cyan-300" },
              diagnostic: { label: "Diagnostic", icon: <Activity size={12} />, active: "border-emerald-500/40 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
              dossiers: { label: "Dossiers", icon: <FolderOpen size={12} />, active: "border-amber-500/40 bg-amber-500/12 text-amber-600 dark:text-amber-300" },
            }[tab];
            return (
              <button
                key={tab}
                onClick={() => setToolsSubTab(tab)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-all",
                  toolsSubTab === tab
                    ? meta.active
                    : "border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/35 hover:bg-gray-100 dark:hover:bg-white/[0.06]",
                )}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Panneau actif */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] overflow-hidden min-h-[400px]">
          <Suspense fallback={<div className="flex items-center justify-center h-32 text-xs text-gray-400 dark:text-white/30 gap-2"><Loader2 size={14} className="animate-spin" />Chargement…</div>}>
            {toolsSubTab === "data" && (
              <DataPanel
                onSourceLoaded={(sourceId) => {
                  void onRefreshLayers();
                  if (onSendMessage) {
                    onSendMessage(`La source "${sourceId}" vient d'être chargée. Analyse les nouvelles couches disponibles et propose une étude adaptée.`);
                  }
                }}
              />
            )}
            {toolsSubTab === "diagnostic" && (
              <DiagnosticPanel
                onResult={(type, detail) => {
                  if (onSendMessage) {
                    onSendMessage(`Calcul ${type.toUpperCase()} terminé sur "${detail}". Analyse le résultat et propose une interprétation cartographique.`);
                  }
                }}
              />
            )}
            {toolsSubTab === "dossiers" && (
              <DossierPanel
                onDossierRun={(dossierId, result) => {
                  void onRefreshLayers();
                  if (onSendMessage) {
                    const layers = result.layers?.join(", ") || "couches chargées";
                    onSendMessage(`Dossier "${dossierId}" déroulé : ${result.steps_done ?? "?"}/${result.total ?? "?"} étapes. Couches : ${layers}. Lance une analyse territoriale sur ces données.`);
                  }
                }}
              />
            )}
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <aside"""
assert OLD6 in c, "Return/aside not found"
c = c.replace(OLD6, NEW6, 1)
print("6. renderToolsTab function OK")

# ── 7. Tab bar — ajout du 4e onglet ──────────────────────────────────────────
OLD7 = ('          { id: "services" as SidebarTab, label: "Services", Icon: Network, badge: null,\n'
        '            active: "border-cyan-500/40 bg-gradient-to-br from-cyan-500/15 to-cyan-600/8 text-cyan-600 dark:text-cyan-300 shadow-md shadow-cyan-500/10" },\n'
        '        ].map(({ id, label, Icon, badge, active })')
NEW7 = ('          { id: "services" as SidebarTab, label: "Services", Icon: Network, badge: null,\n'
        '            active: "border-cyan-500/40 bg-gradient-to-br from-cyan-500/15 to-cyan-600/8 text-cyan-600 dark:text-cyan-300 shadow-md shadow-cyan-500/10" },\n'
        '          { id: "tools" as SidebarTab, label: "Outils", Icon: WrenchIcon, badge: null,\n'
        '            active: "border-violet-500/40 bg-gradient-to-br from-violet-500/15 to-violet-600/8 text-violet-600 dark:text-violet-300 shadow-md shadow-violet-500/10" },\n'
        '        ].map(({ id, label, Icon, badge, active })')
assert OLD7 in c, "Tab bar not found"
c = c.replace(OLD7, NEW7, 1)
print("7. Tab bar OK")

# ── 8. Action bar sous les onglets — cas tools ────────────────────────────────
OLD8 = ('        ) : (\n'
        '          <div\n'
        '            className={cn(\n'
        '              "flex items-center justify-center rounded-2xl border",\n'
        '              "border-cyan-500/30 bg-gradient-to-r from-cyan-600/12 to-cyan-500/8 text-cyan-600 dark:text-cyan-300",\n'
        '              !isOpen ? "h-12 w-full" : "w-full gap-2 px-4 py-2.5 text-[13px] font-bold",\n'
        '            )}\n'
        '          >\n'
        '            <Link2 size={isOpen ? 15 : 20} />\n'
        '            {isOpen && "Sources connectées"}\n'
        '          </div>\n'
        '        )}')
NEW8 = ('        ) : activeTab === "services" ? (\n'
        '          <div\n'
        '            className={cn(\n'
        '              "flex items-center justify-center rounded-2xl border",\n'
        '              "border-cyan-500/30 bg-gradient-to-r from-cyan-600/12 to-cyan-500/8 text-cyan-600 dark:text-cyan-300",\n'
        '              !isOpen ? "h-12 w-full" : "w-full gap-2 px-4 py-2.5 text-[13px] font-bold",\n'
        '            )}\n'
        '          >\n'
        '            <Link2 size={isOpen ? 15 : 20} />\n'
        '            {isOpen && "Sources connectées"}\n'
        '          </div>\n'
        '        ) : (\n'
        '          <div\n'
        '            className={cn(\n'
        '              "flex items-center justify-center rounded-2xl border",\n'
        '              "border-violet-500/30 bg-gradient-to-r from-violet-600/12 to-violet-500/8 text-violet-600 dark:text-violet-300",\n'
        '              !isOpen ? "h-12 w-full" : "w-full gap-2 px-4 py-2.5 text-[13px] font-bold",\n'
        '            )}\n'
        '          >\n'
        '            <WrenchIcon size={isOpen ? 15 : 20} />\n'
        '            {isOpen && "Données · Diagnostic · Dossiers"}\n'
        '          </div>\n'
        '        )}')
assert OLD8 in c, "Action bar not found"
c = c.replace(OLD8, NEW8, 1)
print("8. Action bar OK")

# ── 9. Zone de rendu collapsed — icône tools ──────────────────────────────────
OLD9 = ('            : activeTab === "layers"\n'
        '              ? layers.slice(0, 6).map((layer) => (')
# On vérifie juste que le pattern est là avant de toucher la zone collapsed
assert OLD9 in c, "Collapsed zone not found"
print("9. Collapsed zone found (not patching, handled by tab render)")

# ── 10. Zone de rendu full — ajouter renderToolsTab() ────────────────────────
OLD10 = ('          {activeTab === "history"\n'
         '            ? renderHistoryTab()\n'
         '            : activeTab === "layers"\n'
         '              ? renderLayersTab()\n'
         '              : renderServicesTab()}')
NEW10 = ('          {activeTab === "history"\n'
         '            ? renderHistoryTab()\n'
         '            : activeTab === "layers"\n'
         '              ? renderLayersTab()\n'
         '              : activeTab === "services"\n'
         '                ? renderServicesTab()\n'
         '                : renderToolsTab()}')
assert OLD10 in c, "Render dispatch not found"
c = c.replace(OLD10, NEW10, 1)
print("10. Render dispatch OK")

SIDEBAR.write_text(c, encoding="utf-8")
print("\nAll patches applied successfully.")
