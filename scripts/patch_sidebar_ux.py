"""
Patch WorkspaceSidebar.tsx — UX améliorée :
1. Overpass : textarea cachée derrière toggle "Mode avancé"
2. Copernicus : supprimer le champ Collection (pré-rempli/caché)
3. NASA : remplacer le champ BBOX brut par bouton "Emprise du projet"
4. Onglet Outils : scroll unique sans sous-onglets + passer layers aux panneaux

IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI) — Superviseur : Claude Code 4.8 — 2026-06-08
"""
import pathlib

path = pathlib.Path("src/components/WorkspaceSidebar.tsx")
c = path.read_text(encoding="utf-8")

# ─────────────────────────────────────────────────────────────────────────────
# 1. Ajouter l'état overpassAdvanced dans les états de la sidebar
# ─────────────────────────────────────────────────────────────────────────────
OLD1 = ("  const [toolsSubTab, setToolsSubTab] = useState<\"data\" | \"diagnostic\" | \"dossiers\">(\"data\");")
NEW1 = ("  const [toolsSubTab, setToolsSubTab] = useState<\"data\" | \"diagnostic\" | \"dossiers\">(\"data\");\n"
        "  const [overpassAdvanced, setOverpassAdvanced] = useState(false);\n"
        "  const [nasaBboxLoading, setNasaBboxLoading] = useState(false);\n"
        "  const [copBboxLoading, setCopBboxLoading] = useState(false);")
assert OLD1 in c, "toolsSubTab state not found"
c = c.replace(OLD1, NEW1, 1)
print("1. overpassAdvanced state OK")

# ─────────────────────────────────────────────────────────────────────────────
# 2. Remplacer la section Overpass (textarea cachée par toggle avancé)
# ─────────────────────────────────────────────────────────────────────────────
OLD2 = (
    "          <select value={overpassEndpoint} onChange={(e) => setOverpassEndpoint(e.target.value)} className=\"w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500/40\">\n"
    "            {OVERPASS_ENDPOINTS.map((ep) => (<option key={ep} value={ep}>{ep}</option>))}\n"
    "          </select>\n"
    "          <textarea value={overpassQuery} onChange={(e) => setOverpassQuery(e.target.value)} rows={4} className=\"w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-orange-500/40\" placeholder=\"[out:json];\narea[name='Rennes']->.searchArea;\n(\n  way[highway](area.searchArea);\n);\nout geom;\" />\n"
    "          <input value={overpassLayerName} onChange={(e) => setOverpassLayerName(e.target.value)} className=\"w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-orange-500/40\" placeholder=\"Nom de la couche (ex: Routes_Rennes)\" />"
)
NEW2 = (
    "          {/* Nom de couche — auto-rempli par les templates */}\n"
    "          <div className=\"flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] px-3 py-2\">\n"
    "            <span className=\"text-[10px] text-gray-400 dark:text-white/30 shrink-0\">Couche :</span>\n"
    "            <input\n"
    "              value={overpassLayerName}\n"
    "              onChange={(e) => setOverpassLayerName(e.target.value)}\n"
    "              className=\"flex-1 min-w-0 bg-transparent text-[12px] text-gray-700 dark:text-white/70 outline-none placeholder:text-gray-400 dark:placeholder:text-white/25\"\n"
    "              placeholder=\"Nom de la couche\"\n"
    "            />\n"
    "          </div>\n"
    "\n"
    "          {/* Mode avancé — toggle */}\n"
    "          <button\n"
    "            onClick={() => setOverpassAdvanced((v) => !v)}\n"
    "            className=\"flex items-center gap-1.5 self-start text-[10px] text-orange-600 dark:text-orange-400/70 hover:text-orange-700 dark:hover:text-orange-300 transition-colors\"\n"
    "          >\n"
    "            <ChevronDown size={11} className={cn(\"transition-transform\", overpassAdvanced && \"rotate-180\")} />\n"
    "            {overpassAdvanced ? \"Masquer la requête\" : \"Mode avancé (éditer la requête)\"}\n"
    "          </button>\n"
    "\n"
    "          {overpassAdvanced && (\n"
    "            <div className=\"flex flex-col gap-2\">\n"
    "              <select value={overpassEndpoint} onChange={(e) => setOverpassEndpoint(e.target.value)} className=\"w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500/40\">\n"
    "                {OVERPASS_ENDPOINTS.map((ep) => (<option key={ep} value={ep}>{ep}</option>))}\n"
    "              </select>\n"
    "              <textarea\n"
    "                value={overpassQuery}\n"
    "                onChange={(e) => setOverpassQuery(e.target.value)}\n"
    "                rows={5}\n"
    "                className=\"w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500/40\"\n"
    "              />\n"
    "            </div>\n"
    "          )}"
)
assert OLD2 in c, "Overpass textarea section not found"
c = c.replace(OLD2, NEW2, 1)
print("2. Overpass advanced toggle OK")

# ─────────────────────────────────────────────────────────────────────────────
# 3. Copernicus — supprimer le champ Collection (masqué, valeur par défaut)
# ─────────────────────────────────────────────────────────────────────────────
OLD3 = (
    "            <input value={copernicusCollection} onChange={(e) => setCopernicusCollection(e.target.value)} className=\"w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-sky-500/40\" placeholder=\"Collection (ex: SENTINEL-2)\" />\n"
    "            <div className=\"grid grid-cols-2 gap-2\">\n"
    "              <input value={copernicusLimit} onChange={(e) => setCopernicusLimit(e.target.value)} className=\"rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-sky-500/40\" placeholder=\"Résultats (5)\" />\n"
    "              <input value={copernicusNameContains} onChange={(e) => setCopernicusNameContains(e.target.value)} className=\"rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-sky-500/40\" placeholder=\"Filtre nom\" />\n"
    "            </div>"
)
NEW3 = (
    "            {/* Collection masquée — valeur par défaut SENTINEL-2 */}\n"
    "            <input value={copernicusNameContains} onChange={(e) => setCopernicusNameContains(e.target.value)} className=\"w-full rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-gray-100/80 dark:bg-white/[0.03] px-3 py-2 text-[12px] text-gray-700 dark:text-white/70 outline-none placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-sky-500/40 transition-colors\" placeholder=\"Filtrer par nom (optionnel)\" />"
)
assert OLD3 in c, "Copernicus collection input not found"
c = c.replace(OLD3, NEW3, 1)
print("3. Copernicus simplification OK")

# ─────────────────────────────────────────────────────────────────────────────
# 4. NASA — remplacer le champ BBOX brut par bouton "Emprise du projet"
# ─────────────────────────────────────────────────────────────────────────────
OLD4 = (
    "            <input value={nasaCollection} onChange={(e) => setNasaCollection(e.target.value)} className=\"w-full rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-indigo-500/40\" placeholder=\"Collection (ex: HLSS30.v2.0)\" />\n"
    "            <div className=\"grid grid-cols-2 gap-2\">\n"
    "              <input value={nasaLimit} onChange={(e) => setNasaLimit(e.target.value)} className=\"rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-indigo-500/40\" placeholder=\"Résultats (5)\" />\n"
    "              <input value={nasaBbox} onChange={(e) => setNasaBbox(e.target.value)} className=\"rounded-2xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none placeholder:text-gray-700 dark:text-gray-300/20 focus:border-indigo-500/40\" placeholder=\"BBOX WGS84\" />\n"
    "            </div>"
)
NEW4 = (
    "            {/* Bouton emprise — remplace la saisie BBOX manuelle */}\n"
    "            <button\n"
    "              onClick={async () => {\n"
    "                setNasaBboxLoading(true);\n"
    "                try {\n"
    "                  const res = await fetch(\"http://localhost:8157/api/qgis/projectExtent\");\n"
    "                  if (res.ok) {\n"
    "                    const data = await res.json() as { bbox?: string };\n"
    "                    if (data.bbox) { setNasaBbox(data.bbox); toast.success(\"Emprise récupérée\"); }\n"
    "                    else toast.warning(\"Pas de projet QGIS ouvert\");\n"
    "                  }\n"
    "                } catch { toast.error(\"Erreur réseau\"); }\n"
    "                finally { setNasaBboxLoading(false); }\n"
    "              }}\n"
    "              disabled={nasaBboxLoading}\n"
    "              className={cn(\n"
    "                \"flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-[12px] font-semibold transition-all disabled:opacity-50\",\n"
    "                nasaBbox\n"
    "                  ? \"border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400\"\n"
    "                  : \"border-indigo-500/35 bg-gradient-to-r from-indigo-600/15 to-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:from-indigo-600/22\"\n"
    "              )}\n"
    "            >\n"
    "              {nasaBboxLoading ? <><Loader2 size={11} className=\"animate-spin\" />Récupération…</> : nasaBbox ? <><CheckCircle2 size={11} />Emprise définie ✓</> : <><MapPin size={11} />Utiliser l'emprise du projet</>}\n"
    "            </button>"
)
assert OLD4 in c, "NASA bbox input section not found"
c = c.replace(OLD4, NEW4, 1)
print("4. NASA bbox button OK")

# ─────────────────────────────────────────────────────────────────────────────
# 5. Onglet Outils — scroll unique sans sous-onglets, passer layers aux panneaux
# ─────────────────────────────────────────────────────────────────────────────
OLD5 = (
    "  // ── Onglet Outils (panneaux Devin) ──────────────────────────────────────────\n"
    "  // IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI) — Superviseur : Claude Code 4.8 — 2026-06-08\n"
    "  function renderToolsTab() {\n"
    "    return (\n"
    "      <div className=\"flex flex-col gap-3\">\n"
    "        {/* Sous-onglets */}\n"
    "        <div className=\"flex gap-1.5\">\n"
    "          {([\"data\", \"diagnostic\", \"dossiers\"] as const).map((tab) => {\n"
    "            const meta = {\n"
    "              data: { label: \"Données\", icon: <Globe size={12} />, active: \"border-cyan-500/40 bg-cyan-500/12 text-cyan-600 dark:text-cyan-300\" },\n"
    "              diagnostic: { label: \"Diagnostic\", icon: <Activity size={12} />, active: \"border-emerald-500/40 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300\" },\n"
    "              dossiers: { label: \"Dossiers\", icon: <FolderOpen size={12} />, active: \"border-amber-500/40 bg-amber-500/12 text-amber-600 dark:text-amber-300\" },\n"
    "            }[tab];\n"
    "            return (\n"
    "              <button\n"
    "                key={tab}\n"
    "                onClick={() => setToolsSubTab(tab)}\n"
    "                className={cn(\n"
    "                  \"flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-all\",\n"
    "                  toolsSubTab === tab\n"
    "                    ? meta.active\n"
    "                    : \"border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.03] text-gray-500 dark:text-white/35 hover:bg-gray-100 dark:hover:bg-white/[0.06]\",\n"
    "                )}\n"
    "              >\n"
    "                {meta.icon}\n"
    "                {meta.label}\n"
    "              </button>\n"
    "            );\n"
    "          })}\n"
    "        </div>\n"
    "\n"
    "        {/* Panneau actif */}\n"
    "        <div className=\"rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/80 dark:bg-white/[0.02] overflow-hidden min-h-[400px]\">\n"
    "          <Suspense fallback={<div className=\"flex items-center justify-center h-32 text-xs text-gray-400 dark:text-white/30 gap-2\"><Loader2 size={14} className=\"animate-spin\" />Chargement…</div>}>\n"
    "            {toolsSubTab === \"data\" && (\n"
    "              <DataPanel\n"
    "                onSourceLoaded={(sourceId) => {\n"
    "                  void onRefreshLayers();\n"
    "                  if (onSendMessage) {\n"
    "                    onSendMessage(`La source \"${sourceId}\" vient d'être chargée. Analyse les nouvelles couches disponibles et propose une étude adaptée.`);\n"
    "                  }\n"
    "                }}\n"
    "              />\n"
    "            )}\n"
    "            {toolsSubTab === \"diagnostic\" && (\n"
    "              <DiagnosticPanel\n"
    "                onResult={(type, detail) => {\n"
    "                  if (onSendMessage) {\n"
    "                    onSendMessage(`Calcul ${type.toUpperCase()} terminé sur \"${detail}\". Analyse le résultat et propose une interprétation cartographique.`);\n"
    "                  }\n"
    "                }}\n"
    "              />\n"
    "            )}\n"
    "            {toolsSubTab === \"dossiers\" && (\n"
    "              <DossierPanel\n"
    "                onDossierRun={(dossierId, result) => {\n"
    "                  void onRefreshLayers();\n"
    "                  if (onSendMessage) {\n"
    "                    const layers = result.layers?.join(\", \") || \"couches chargées\";\n"
    "                    onSendMessage(`Dossier \"${dossierId}\" déroulé : ${result.steps_done ?? \"?\"}/${result.total ?? \"?\"} étapes. Couches : ${layers}. Lance une analyse territoriale sur ces données.`);\n"
    "                  }\n"
    "                }}\n"
    "              />\n"
    "            )}\n"
    "          </Suspense>\n"
    "        </div>\n"
    "      </div>\n"
    "    );\n"
    "  }"
)
NEW5 = (
    "  // ── Onglet Outils (panneaux Devin) — scroll unique ────────────────────────\n"
    "  // IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI) — Superviseur : Claude Code 4.8 — 2026-06-08\n"
    "  // Redesign UX 2026-06-08 : scroll unique, layers passées en prop pour selects auto\n"
    "  function renderToolsTab() {\n"
    "    const layerOptions = layers.map((l) => ({ id: l.id, name: l.name, type: l.type }));\n"
    "    return (\n"
    "      <div className=\"flex flex-col gap-4\">\n"
    "        {/* Label section Données */}\n"
    "        <div className=\"flex items-center gap-2\">\n"
    "          <Globe size={13} className=\"text-cyan-500 dark:text-cyan-400\" />\n"
    "          <span className=\"text-[10px] font-black uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-400\">Sources de données</span>\n"
    "        </div>\n"
    "        <Suspense fallback={<div className=\"flex items-center justify-center h-24 text-xs text-gray-400 dark:text-white/30 gap-2\"><Loader2 size={14} className=\"animate-spin\" />Chargement…</div>}>\n"
    "          <DataPanel\n"
    "            onSourceLoaded={(sourceId) => {\n"
    "              void onRefreshLayers();\n"
    "              if (onSendMessage) onSendMessage(`La source \"${sourceId}\" vient d'être chargée. Analyse les nouvelles couches et propose une étude adaptée.`);\n"
    "            }}\n"
    "          />\n"
    "        </Suspense>\n"
    "\n"
    "        {/* Séparateur */}\n"
    "        <div className=\"h-px bg-gray-200 dark:bg-white/[0.06]\" />\n"
    "\n"
    "        {/* Label section Analyse */}\n"
    "        <div className=\"flex items-center gap-2\">\n"
    "          <Activity size={13} className=\"text-emerald-500 dark:text-emerald-400\" />\n"
    "          <span className=\"text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400\">Analyse satellite</span>\n"
    "        </div>\n"
    "        <Suspense fallback={<div className=\"flex items-center justify-center h-24 text-xs text-gray-400 dark:text-white/30 gap-2\"><Loader2 size={14} className=\"animate-spin\" />Chargement…</div>}>\n"
    "          <DiagnosticPanel\n"
    "            layers={layerOptions}\n"
    "            onResult={(type, detail) => {\n"
    "              if (onSendMessage) onSendMessage(`Calcul ${type.toUpperCase()} terminé sur \"${detail}\". Analyse le résultat et propose une interprétation cartographique.`);\n"
    "            }}\n"
    "          />\n"
    "        </Suspense>\n"
    "\n"
    "        {/* Séparateur */}\n"
    "        <div className=\"h-px bg-gray-200 dark:bg-white/[0.06]\" />\n"
    "\n"
    "        {/* Label section Dossiers */}\n"
    "        <div className=\"flex items-center gap-2\">\n"
    "          <FolderOpen size={13} className=\"text-amber-500 dark:text-amber-400\" />\n"
    "          <span className=\"text-[10px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400\">Dossiers territoriaux</span>\n"
    "        </div>\n"
    "        <Suspense fallback={<div className=\"flex items-center justify-center h-24 text-xs text-gray-400 dark:text-white/30 gap-2\"><Loader2 size={14} className=\"animate-spin\" />Chargement…</div>}>\n"
    "          <DossierPanel\n"
    "            onDossierRun={(dossierId, result) => {\n"
    "              void onRefreshLayers();\n"
    "              if (onSendMessage) {\n"
    "                const layerNames = result.layers?.join(\", \") || \"couches chargées\";\n"
    "                onSendMessage(`Dossier \"${dossierId}\" déroulé : ${result.steps_done ?? \"?\"}/${result.total ?? \"?\"} étapes. Couches : ${layerNames}. Lance une analyse territoriale.`);\n"
    "              }\n"
    "            }}\n"
    "          />\n"
    "        </Suspense>\n"
    "      </div>\n"
    "    );\n"
    "  }"
)
assert OLD5 in c, "renderToolsTab function not found"
c = c.replace(OLD5, NEW5, 1)
print("5. renderToolsTab scroll unique OK")

path.write_text(c, encoding="utf-8")
print("\nAll patches applied.")
