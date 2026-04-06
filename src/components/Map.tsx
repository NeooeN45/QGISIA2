import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap, WMSTileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

// Fix for default marker icons in Leaflet with React using CDN
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

export interface LayerData {
  id: string;
  name: string;
  type: "vector" | "raster" | "WMS" | "XYZ" | "WMTS";
  visible: boolean;
  data?: any; // GeoJSON object
  url?: string; // For WMS/XYZ
  layers?: string; // For WMS
  attribution?: string;
  style?: any;
  opacity?: number;
}

interface MapProps {
  center: [number, number];
  zoom: number;
  layers: LayerData[];
  onMove?: (center: [number, number], zoom: number) => void;
  isMeasuring?: "distance" | "area" | null;
}

function MapEvents({ onMove }: { onMove?: (center: [number, number], zoom: number) => void }) {
  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      onMove?.([map.getCenter().lat, map.getCenter().lng], map.getZoom());
    },
    zoomend: (e) => {
      const map = e.target;
      onMove?.([map.getCenter().lat, map.getCenter().lng], map.getZoom());
    }
  });
  return null;
}

function MeasurementTool({ mode }: { mode: "distance" | "area" | null }) {
  const map = useMap();
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());

  useEffect(() => {
    map.addLayer(drawnItemsRef.current);

    const onDraw = (e: any) => {
      const layer = e.layer;
      drawnItemsRef.current.addLayer(layer);
      
      if (e.layerType === 'polyline') {
        const latlngs = layer.getLatLngs();
        let distance = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
          distance += latlngs[i].distanceTo(latlngs[i+1]);
        }
        layer.bindTooltip(`Distance: ${(distance / 1000).toFixed(2)} km`, { permanent: true, direction: 'top' }).openTooltip();
      } else if (e.layerType === 'polygon') {
        const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
        layer.bindTooltip(`Surface: ${(area / 1000000).toFixed(2)} km²`, { permanent: true, direction: 'center' }).openTooltip();
      }
    };

    map.on(L.Draw.Event.CREATED, onDraw);

    return () => {
      map.off(L.Draw.Event.CREATED, onDraw);
      map.removeLayer(drawnItemsRef.current);
    };
  }, [map]);

  useEffect(() => {
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
    }

    if (mode) {
      const drawOptions: any = {
        draw: {
          polyline: mode === "distance",
          polygon: mode === "area",
          circle: false,
          rectangle: false,
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnItemsRef.current,
        }
      };

      drawControlRef.current = new L.Control.Draw(drawOptions);
      map.addControl(drawControlRef.current);

      // Programmatically start drawing
      if (mode === "distance") {
        new (L as any).Draw.Polyline(map, drawOptions.draw.polyline).enable();
      } else if (mode === "area") {
        new (L as any).Draw.Polygon(map, drawOptions.draw.polygon).enable();
      }
    }

    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
    };
  }, [map, mode]);

  return null;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function Map({ center, zoom, layers, onMove, isMeasuring }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={center} zoom={zoom} />
        <MapEvents onMove={onMove} />
        <MeasurementTool mode={isMeasuring || null} />
        
        {layers.filter(l => l.visible).map((layer) => {
          if (layer.type === "vector") {
            return (
              <GeoJSON 
                key={layer.id} 
                data={layer.data} 
                style={(feature) => {
                  if (typeof layer.style === 'function') {
                    return layer.style(feature);
                  }
                  
                  // Heatmap simulation
                  if (layer.style && layer.style.rendererType === 'heatmap') {
                    return {
                      fillColor: '#f97316',
                      color: '#fb923c',
                      weight: 0,
                      fillOpacity: 0.4,
                      radius: layer.style.radius || 10
                    };
                  }

                  if (layer.style && layer.style.rendererType === 'categorized') {
                    const attr = layer.style.attribute;
                    const val = feature?.properties?.[attr];
                    const colors = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33'];
                    const color = colors[Math.abs(JSON.stringify(val).length) % colors.length];
                    return { fillColor: color, color: '#333', weight: 1, fillOpacity: 0.7 };
                  }

                  if (layer.style && layer.style.rendererType === 'graduated') {
                    const attr = layer.style.attribute;
                    const val = Number(feature?.properties?.[attr]) || 0;
                    const color = val > 100 ? '#800026' : val > 50 ? '#BD0026' : val > 20 ? '#E31A1C' : val > 10 ? '#FC4E2A' : '#FD8D3C';
                    return { fillColor: color, color: '#333', weight: 1, fillOpacity: (layer.opacity ?? 0.7) };
                  }
                  return layer.style || { color: "#3388ff", weight: 2, opacity: (layer.opacity ?? 1), fillOpacity: (layer.opacity ?? 0.2) };
                }}
                pointToLayer={(feature, latlng) => {
                  if (layer.style && layer.style.rendererType === 'heatmap') {
                    return L.circleMarker(latlng, {
                      radius: layer.style.radius || 10,
                      fillColor: '#f97316',
                      color: '#fb923c',
                      weight: 0,
                      fillOpacity: 0.4
                    });
                  }
                  return L.marker(latlng);
                }}
                onEachFeature={(feature, leafletLayer) => {
                  const props = feature.properties || {};
                  const title = props.name || props.label || layer.name;
                  let content = `<div class="p-2 min-w-[150px]">
                    <h4 class="font-bold text-sm border-b mb-2">${title}</h4>
                    <div class="space-y-1 text-xs">`;
                  
                  Object.entries(props).forEach(([k, v]) => {
                    if (k !== 'name' && k !== 'label') {
                      content += `<div><span class="text-slate-500 font-medium">${k}:</span> ${v}</div>`;
                    }
                  });
                  
                  content += `</div></div>`;
                  leafletLayer.bindPopup(content);
                }}
              />
            );
          } else if (layer.type === "WMS") {
            return (
              <WMSTileLayer
                key={layer.id}
                url={layer.url!}
                layers={layer.layers!}
                format="image/png"
                transparent={true}
                attribution={layer.attribution}
                opacity={layer.opacity ?? 1}
              />
            );
          } else if (layer.type === "XYZ" || layer.type === "WMTS") {
            return (
              <TileLayer
                key={layer.id}
                url={layer.url!}
                attribution={layer.attribution}
                opacity={layer.opacity ?? 1}
              />
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
}
