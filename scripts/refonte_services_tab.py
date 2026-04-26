"""
Refonte onglet Services — manipulation atomique de WorkspaceSidebar.tsx :
1. Supprime "Sources officielles" CollapsibleSection
2. Supprime "Fonds de carte" SidebarSection
3. Supprime "Service personnalisé" CollapsibleSection
4. Renomme `const renderServicesTab = () => (` -> `const renderToolsSubTab = () => (`
5. Insère les nouveaux helpers + nouveau renderServicesTab dispatcher avant renderToolsSubTab
"""
from pathlib import Path
import sys

FILE = Path("src/components/WorkspaceSidebar.tsx")

NEW_RENDERERS = '''  // ─────────────────────────────────────────────────────────────────────────
  // SERVICES TAB — Premium UI: Catalogue / Favoris / Outils / Custom
  // ─────────────────────────────────────────────────────────────────────────

  const renderServiceCard = (source: import("../lib/catalog").CatalogItem) => {
    const isFav = favoriteServiceIds.includes(source.id);
    const isLoading = addingServiceId === source.id;
    const typeBadge = SERVICE_TYPE_BADGE[source.serviceType] ?? "border-gray-500/30 bg-gray-500/10 text-gray-700";
    return (
      <div
        key={source.id}
        className="group relative flex flex-col rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.025] p-3 transition-all duration-200 hover:border-cyan-400/40 dark:hover:border-cyan-500/30 hover:shadow-md hover:shadow-cyan-500/10"
      >
        <div className="flex items-start gap-2 mb-2">
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", typeBadge)}>
              {source.serviceType}
            </span>
            {source.reliable ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-green-700 dark:text-green-300" title="Source vérifiée fiable">
                <ShieldCheck size={9} />Fiable
              </span>
            ) : (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300" title="Beta — non testée">
                β Beta
              </span>
            )}
            {source.requiresKey && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300" title="Clé API requise">
                🔑
              </span>
            )}
          </div>
          <button
            onClick={() => toggleFavoriteService(source.id)}
            className={cn(
              "shrink-0 rounded-lg p-1 transition-all",
              isFav ? "text-amber-400" : "text-gray-300 dark:text-white/20 hover:text-amber-400",
            )}
            title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Star size={12} className={isFav ? "fill-current" : ""} />
          </button>
        </div>
        <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 leading-tight mb-0.5 line-clamp-2">
          {source.name}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/35 mb-2">
          {source.provider}
        </p>
        {source.description ? (
          <p className="text-[11px] text-gray-600 dark:text-white/45 line-clamp-2 mb-2.5 flex-1">
            {source.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <button
          onClick={() => void handleAddServiceCard(source)}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/12 to-cyan-600/8 px-2 py-1.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300 transition-all hover:from-cyan-500/22 hover:to-cyan-600/15 hover:shadow-md hover:shadow-cyan-500/15 disabled:opacity-50 disabled:cursor-wait"
        >
          {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          {isLoading ? "Chargement..." : "Ajouter à la carte"}
        </button>
      </div>
    );
  };

  const renderCatalogSubTab = () => {
    const totalVisible = filteredServiceSources.length;
    const totalAll = allServiceSourcesFlat.length;
    const reliableCount = allServiceSourcesFlat.filter(({ source }) => source.reliable).length;
    const filterChips: Array<{ id: ServiceTypeFilter; label: string }> = [
      { id: "all", label: "Tous" },
      { id: "WMS", label: "WMS" },
      { id: "WMTS", label: "WMTS" },
      { id: "WFS", label: "WFS" },
      { id: "XYZ", label: "XYZ" },
    ];
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30" size={14} />
          <input
            value={serviceQuery}
            onChange={(e) => setServiceQuery(e.target.value)}
            placeholder="Rechercher (nom, fournisseur, thème...)"
            className="w-full rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03] py-2 pl-9 pr-9 text-[13px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-cyan-400/50 focus:bg-white dark:focus:bg-white/[0.05]"
          />
          {serviceQuery && (
            <button
              onClick={() => setServiceQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter size={11} className="shrink-0 text-gray-400 dark:text-white/30" />
          {filterChips.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setServiceTypeFilter(id)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                serviceTypeFilter === id
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                  : "border-gray-200 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-white/40 hover:border-cyan-400/30 hover:text-cyan-600 dark:hover:text-cyan-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-gray-600 dark:text-white/55">
            <input
              type="checkbox"
              checked={reliableOnly}
              onChange={(e) => setReliableOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-green-500"
            />
            <ShieldCheck size={12} className="text-green-500" />
            Sources fiables uniquement
          </label>
          <span className="text-[10px] tabular-nums text-gray-400 dark:text-white/30">
            {totalVisible} / {reliableOnly ? reliableCount : totalAll}
          </span>
        </div>

        {totalVisible === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.01] p-6 text-center">
            <BookOpen size={22} className="mx-auto mb-2 text-gray-300 dark:text-white/20" />
            <p className="text-[12px] text-gray-400 dark:text-white/30">Aucun résultat</p>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-white/25">
              Essaie de désactiver « Fiables uniquement » ou modifier ta recherche.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(filteredByCategory).map(([catKey, cat]) => {
              const meta = CATEGORY_META[catKey] ?? { icon: <Database size={13} />, tone: "text-gray-500", ring: "ring-gray-500/20" };
              const isCollapsed = collapsedCatalogCategories[catKey];
              return (
                <div key={catKey} className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.015] overflow-hidden">
                  <button
                    onClick={() => toggleCatalogCategory(catKey)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left transition-all hover:bg-gray-100/50 dark:hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg ring-1", meta.tone, meta.ring)}>
                        {meta.icon}
                      </span>
                      <div>
                        <p className="text-[11.5px] font-bold text-gray-700 dark:text-gray-200">{cat.name}</p>
                        <p className="text-[9px] text-gray-400 dark:text-white/30">{cat.sources.length} source{cat.sources.length > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <ChevronDown size={13} className={cn("text-gray-400 dark:text-white/30 transition-transform", isCollapsed ? "" : "rotate-180")} />
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-2 gap-2 border-t border-gray-200 dark:border-white/[0.05] p-2">
                      {cat.sources.map((s) => renderServiceCard(s))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFavoritesSubTab = () => {
    if (favoriteSources.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.01] p-8 text-center">
          <Star size={26} className="mx-auto mb-3 text-gray-300 dark:text-white/20" />
          <p className="text-[13px] font-semibold text-gray-500 dark:text-white/40">Aucun favori</p>
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/30 leading-relaxed">
            Clique sur l'étoile d'une source<br />pour l'ajouter à tes favoris.
          </p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        {favoriteSources.map((s) => renderServiceCard(s))}
      </div>
    );
  };

  const renderCustomSubTab = () => (
    <div className="space-y-3">
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 to-cyan-600/4 p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
            <Server size={15} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100">Service personnalisé</p>
            <p className="mt-0.5 text-[10.5px] text-gray-500 dark:text-white/45 leading-relaxed">
              Connecte un serveur WMS, WMTS, WFS, WCS ou ArcGIS REST.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">Nom *</span>
          <input
            value={serviceDraft.name}
            onChange={(e) => setServiceDraft((c) => ({ ...c, name: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-cyan-400/50"
            placeholder="Ex : Mon serveur WMS"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">Type de service</span>
          <select
            value={serviceDraft.serviceType}
            onChange={(e) => setServiceDraft((c) => ({ ...c, serviceType: e.target.value as RemoteServiceType }))}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none focus:border-cyan-400/50"
          >
            {SUPPORTED_REMOTE_SERVICE_TYPES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">URL *</span>
          <input
            value={serviceDraft.url}
            onChange={(e) => setServiceDraft((c) => ({ ...c, url: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 font-mono text-[12px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-cyan-400/50"
            placeholder="https://..."
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">Couche (optionnel)</span>
          <input
            value={serviceDraft.layerName}
            onChange={(e) => setServiceDraft((c) => ({ ...c, layerName: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/25 focus:border-cyan-400/50"
            placeholder="Ex : workspace:layer"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">CRS</span>
            <input
              value={serviceDraft.crs}
              onChange={(e) => setServiceDraft((c) => ({ ...c, crs: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none focus:border-cyan-400/50"
              placeholder="EPSG:3857"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white/40">Format</span>
            <input
              value={serviceDraft.format}
              onChange={(e) => setServiceDraft((c) => ({ ...c, format: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 outline-none focus:border-cyan-400/50"
              placeholder="image/png"
            />
          </label>
        </div>

        <button
          onClick={() => void submitCustomService()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/15 to-cyan-600/10 px-3 py-2.5 text-[13px] font-bold text-cyan-700 dark:text-cyan-300 transition-all hover:from-cyan-500/25 hover:to-cyan-600/18 hover:shadow-lg hover:shadow-cyan-500/15"
        >
          <Link2 size={14} />
          Ajouter le service
        </button>
      </div>
    </div>
  );

  const renderServicesTab = () => {
    const subTabs: Array<{ id: ServicesSubTab; label: string; icon: ReactNode; badge?: number }> = [
      { id: "catalog", label: "Catalogue", icon: <BookOpen size={12} /> },
      { id: "favorites", label: "Favoris", icon: <Star size={12} />, badge: favoriteServiceIds.length },
      { id: "tools", label: "Outils", icon: <Wrench size={12} /> },
      { id: "custom", label: "Custom", icon: <Server size={12} /> },
    ];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-100/60 dark:bg-white/[0.02] p-1">
          {subTabs.map(({ id, label, icon, badge }) => (
            <button
              key={id}
              onClick={() => setServicesSubTab(id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-bold transition-all",
                servicesSubTab === id
                  ? "bg-white dark:bg-white/[0.08] text-cyan-600 dark:text-cyan-300 shadow-sm"
                  : "text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60",
              )}
            >
              <span className="flex items-center gap-1">
                {icon}
                {label}
              </span>
              {badge != null && badge > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-bold tabular-nums",
                  servicesSubTab === id ? "bg-cyan-500 text-white" : "bg-gray-300 dark:bg-white/15 text-gray-600 dark:text-white/60",
                )}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {servicesSubTab === "catalog" && renderCatalogSubTab()}
        {servicesSubTab === "favorites" && renderFavoritesSubTab()}
        {servicesSubTab === "tools" && renderToolsSubTab()}
        {servicesSubTab === "custom" && renderCustomSubTab()}
      </div>
    );
  };

'''


def remove_block(content: str, start_marker: str, end_marker: str, label: str) -> str:
    """Remove from start_marker to end_marker (exclusive), keeping end_marker."""
    start = content.find(start_marker)
    if start < 0:
        raise RuntimeError(f"start marker not found for {label}")
    end = content.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"end marker not found for {label}")
    return content[:start] + content[end:]


def main():
    text = FILE.read_text(encoding="utf-8")

    # 1. Remove "Sources officielles" block
    text = remove_block(
        text,
        '      {/* ── Sources officielles ── */}\n',
        '      {/* ── Inventaire forestier ── */}',
        "Sources officielles",
    )

    # 2. Remove "Fonds de carte" block
    text = remove_block(
        text,
        '      {/* ── Fonds de carte ── */}\n',
        '      {/* ── Cadastre ── */}',
        "Fonds de carte",
    )

    # 3. Remove "Service personnalisé" block
    text = remove_block(
        text,
        '      {/* ── Service personnalisé ── */}\n',
        '      {/* ── Fichiers locaux ── */}',
        "Service personnalisé",
    )

    # 4. Rename `const renderServicesTab = () => (` to `const renderToolsSubTab = () => (`
    old_decl = "  const renderServicesTab = () => (\n    <div className=\"space-y-4\">\n      {/* ── Inventaire forestier ── */}"
    new_decl = "  const renderToolsSubTab = () => (\n    <div className=\"space-y-4\">\n      {/* ── Inventaire forestier ── */}"
    if old_decl not in text:
        raise RuntimeError("renderServicesTab anchor not found after deletes")
    text = text.replace(old_decl, NEW_RENDERERS + new_decl, 1)

    FILE.write_text(text, encoding="utf-8")
    print("OK — refonte appliquée")


if __name__ == "__main__":
    main()
