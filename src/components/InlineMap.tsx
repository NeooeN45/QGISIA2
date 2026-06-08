/**
 * InlineMap — mini-carte Leaflet affichée inline dans les bulles de chat.
 *
 * Importé en lazy depuis MessageBubble pour éviter d'alourdir le bundle initial.
 * Le CSS Leaflet est importé ici pour ne pas polluer le scope global au démarrage.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Satellite, Map as MapIcon, Navigation } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { InlineMapProps } from "@/src/hooks/useMapData";

// Fix icône Leaflet en environnement Vite
const DEFAULT_MARKER_ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DEFAULT_MARKER_ICON;

// ─── Constantes ────────────────────────────────────────────────────────────────

const DEFAULT_HEIGHT_PX = 280;
const MIN_HEIGHT_PX = 160;
const MAX_HEIGHT_PX = 600;

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

const GEOJSON_STYLE: L.PathOptions = {
  color: "#3b82f6",
  weight: 2,
  opacity: 0.9,
  fillColor: "#3b82f6",
  fillOpacity: 0.18,
};

// ─── Sous-composants internes ───────────────────────────────────────────────────

interface BboxFitterProps {
  bbox: [number, number, number, number];
}

/** Ajuste le viewport sur la bbox après montage. */
function BboxFitter({ bbox }: BboxFitterProps) {
  const map = useMap();
  useEffect(() => {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    map.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [12, 12] },
    );
  }, [map, bbox]);
  return null;
}

interface TileLayerSwitcherProps {
  isSatellite: boolean;
}

/** Affiche le bon fond de carte selon le mode. */
function TileLayerSwitcher({ isSatellite }: TileLayerSwitcherProps) {
  return isSatellite ? (
    <TileLayer attribution={SATELLITE_ATTRIBUTION} url={SATELLITE_TILE_URL} />
  ) : (
    <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
  );
}

// ─── Composant principal ────────────────────────────────────────────────────────

export default function InlineMap({
  center,
  zoom = 15,
  bbox,
  geojson,
  title,
  address,
  height = DEFAULT_HEIGHT_PX,
}: InlineMapProps) {
  const [isSatellite, setIsSatellite] = useState(false);
  const [mapHeight, setMapHeight] = useState(height);
  const resizeDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // ── Resize par drag ──────────────────────────────────────────────────────────
  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    resizeDragRef.current = { startY: e.clientY, startHeight: mapHeight };

    function onMouseMove(ev: MouseEvent) {
      if (!resizeDragRef.current) return;
      const delta = ev.clientY - resizeDragRef.current.startY;
      const next = Math.min(
        MAX_HEIGHT_PX,
        Math.max(MIN_HEIGHT_PX, resizeDragRef.current.startHeight + delta),
      );
      setMapHeight(next);
    }

    function onMouseUp() {
      resizeDragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Cleanup si le composant se démonte pendant le drag
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }

  // ── Commande QGIS zoom ───────────────────────────────────────────────────────
  function handleZoomInQgis() {
    if (typeof window === "undefined" || !window.qgis) return;
    const script = buildZoomScript(center, bbox);
    window.qgis.runScript?.(script);
  }

  const hasQgisBridge = typeof window !== "undefined" && Boolean(window.qgis);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.0, 0, 0.2, 1] }}
      className="my-3 w-full max-w-full overflow-hidden rounded-xl border border-white/10 shadow-lg"
      style={{ userSelect: resizeDragRef.current ? "none" : "auto" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-[#111315] px-3 py-2">
        {/* Badge titre */}
        <div className="flex min-w-0 flex-1 flex-col">
          {title && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin size={12} className="shrink-0 text-blue-400" />
              <span className="truncate text-xs font-semibold text-white/90">{title}</span>
            </div>
          )}
          {address && (
            <span className="ml-[18px] truncate text-[10px] text-white/40">{address}</span>
          )}
          {!title && !address && (
            <div className="flex items-center gap-1.5">
              <MapPin size={12} className="text-blue-400" />
              <span className="text-xs font-semibold text-white/70">Carte</span>
            </div>
          )}
        </div>

        {/* Boutons actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Toggle satellite / OSM */}
          <button
            onClick={() => setIsSatellite((v) => !v)}
            title={isSatellite ? "Passer en vue carte" : "Passer en vue satellite"}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
              isSatellite
                ? "border-blue-500/40 bg-blue-500/20 text-blue-300"
                : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/80",
            )}
          >
            {isSatellite ? <MapIcon size={11} /> : <Satellite size={11} />}
            <span>{isSatellite ? "Carte" : "Satellite"}</span>
          </button>

          {/* Centrer dans QGIS */}
          {hasQgisBridge && (
            <button
              onClick={handleZoomInQgis}
              title="Zoomer sur cette zone dans QGIS"
              className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/50 transition-colors hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-blue-300"
            >
              <Navigation size={11} />
              <span>QGIS</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Carte ──────────────────────────────────────────────────────────── */}
      <div style={{ height: mapHeight }} className="relative w-full">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          zoomControl={true}
          className="h-full w-full"
          // Clé sur le centre + zoom pour forcer un re-mount si les props changent radicalement
          key={`${center[0]}-${center[1]}-${zoom}`}
        >
          <TileLayerSwitcher isSatellite={isSatellite} />

          {bbox && <BboxFitter bbox={bbox} />}

          {geojson && (
            <GeoJSON
              // Forcer le re-render quand le GeoJSON change
              key={JSON.stringify(geojson).slice(0, 64)}
              data={geojson as GeoJSON.GeoJsonObject}
              style={() => GEOJSON_STYLE}
            />
          )}
        </MapContainer>
      </div>

      {/* ── Handle resize ──────────────────────────────────────────────────── */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Glisser pour redimensionner"
        className="flex h-3 w-full cursor-ns-resize items-center justify-center bg-[#111315] hover:bg-[#1a1c1f]"
      >
        <div className="h-[3px] w-10 rounded-full bg-white/15" />
      </div>
    </motion.div>
  );
}

// ─── Utilitaire ────────────────────────────────────────────────────────────────

/**
 * Construit un script PyQGIS minimal pour zoomer la vue QGIS sur le point/bbox.
 * Utilise l'API QgsMapCanvas via iface.mapCanvas().
 */
function buildZoomScript(
  center: [number, number],
  bbox?: [number, number, number, number],
): string {
  if (bbox) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    return [
      "from qgis.core import QgsRectangle, QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsProject",
      `rect_wgs84 = QgsRectangle(${minLon}, ${minLat}, ${maxLon}, ${maxLat})`,
      "crs_wgs84 = QgsCoordinateReferenceSystem('EPSG:4326')",
      "crs_proj = iface.mapCanvas().mapSettings().destinationCrs()",
      "transform = QgsCoordinateTransform(crs_wgs84, crs_proj, QgsProject.instance())",
      "rect_proj = transform.transformBoundingBox(rect_wgs84)",
      "iface.mapCanvas().setExtent(rect_proj)",
      "iface.mapCanvas().refresh()",
    ].join("\n");
  }

  const [lat, lng] = center;
  return [
    "from qgis.core import QgsPointXY, QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsProject",
    `pt_wgs84 = QgsPointXY(${lng}, ${lat})`,
    "crs_wgs84 = QgsCoordinateReferenceSystem('EPSG:4326')",
    "crs_proj = iface.mapCanvas().mapSettings().destinationCrs()",
    "transform = QgsCoordinateTransform(crs_wgs84, crs_proj, QgsProject.instance())",
    "pt_proj = transform.transform(pt_wgs84)",
    "iface.mapCanvas().setCenter(pt_proj)",
    "iface.mapCanvas().zoomScale(5000)",
    "iface.mapCanvas().refresh()",
  ].join("\n");
}
