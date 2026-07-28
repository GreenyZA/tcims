'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { CATEGORIES, getCategory } from '../lib/categories';

// Fix default marker icons (Leaflet's CDN paths break under bundlers)
const iconDefaultProto = L.Icon.Default.prototype as unknown as {
  _getIconUrl?: string | undefined;
};
delete iconDefaultProto._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

type Incident = {
  id: number | string;
  location?: { lat: number; lng: number };
  type?: string;
  title?: string;
  description?: string;
};

// Build a colored pin icon for a given category color.
function makeIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <span style="
        display:block;
        width:18px;height:18px;
        background:${color};
        border:2px solid #ffffff;
        border-radius:50%;
        box-shadow:0 0 0 1px rgba(0,0,0,0.4);
      "></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

// Distinct "you're about to drop a pin here" target icon for the draft location.
function makeDraftIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <span style="
        display:block;
        width:22px;height:22px;
        background:rgba(37,99,235,0.25);
        border:3px solid #2563eb;
        border-radius:50%;
        box-shadow:0 0 0 4px rgba(37,99,235,0.25);
      "></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

// Cache one icon per color so we don't re-create them on every render.
const iconCache = new Map<string, L.DivIcon>();
function iconFor(color: string): L.DivIcon {
  let icon = iconCache.get(color);
  if (!icon) {
    icon = makeIcon(color);
    iconCache.set(color, icon);
  }
  return icon;
}

interface MapComponentProps {
  incidents?: Incident[];
  center?: [number, number];
  // A location the user is choosing for a *new* incident (not yet submitted).
  draftLocation?: { lat: number; lng: number } | null;
  // Called when the user clicks the map (or drags the draft marker).
  onMapClick?: (lat: number, lng: number) => void;
  // Land-owner claim mode: enables the polygon draw control.
  claimMode?: boolean;
  // Existing claimed properties (GeoJSON polygons) to render on the map.
  properties?: Array<{ id: string; name: string; geometry: GeoJSON.Polygon }>;
  // Called when the user finishes drawing a polygon while in claim mode.
  onPolygonDrawn?: (polygon: GeoJSON.Polygon) => void;
}

export default function MapComponent({
  incidents = [],
  center = [-25.8242, 27.6774],
  draftLocation = null,
  onMapClick,
  claimMode = false,
  properties = [],
  onPolygonDrawn,
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const propertyLayerRef = useRef<L.LayerGroup | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  // Keep latest callbacks without forcing the map to re-init.
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  onPolygonDrawnRef.current = onPolygonDrawn;

  // Init the map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView(center, 13);
    mapInstanceRef.current = map;

    // Two base layers: standard street map + satellite imagery.
    const streetLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      },
    );
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      },
    );

    // Default to satellite as requested.
    satelliteLayer.addTo(map);

    L.control
      .layers(
        { 'Street Map': streetLayer, Satellite: satelliteLayer },
        undefined,
        { position: 'topright' },
      )
      .addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);
    propertyLayerRef.current = L.layerGroup().addTo(map);

    // Layer that holds user-drawn shapes (claim mode).
    const drawnItems = new L.FeatureGroup();
    drawnItemsRef.current = drawnItems;
    drawnItems.addTo(map);

    // Draw control — polygon only, for claiming property.
    const drawControl = new L.Control.Draw({
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems, edit: false, remove: true },
    });
    drawControlRef.current = drawControl;
    // Hidden until claim mode is enabled.
    drawControl.remove();
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e: unknown) => {
      const layer = (e as { layer: L.Layer }).layer as L.Polygon;
      drawnItems.addLayer(layer);
      const geojson = layer.toGeoJSON() as GeoJSON.Feature;
      const polygon = geojson.geometry as GeoJSON.Polygon;
      onPolygonDrawnRef.current?.(polygon);
    });

    // Let the user click anywhere on the map to choose where the new pin goes.
    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = null;
        draftLayerRef.current = null;
        propertyLayerRef.current = null;
        drawnItemsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)draw markers whenever the incident list changes
  useEffect(() => {
    const group = markersRef.current;
    if (!group) return;

    group.clearLayers();
    incidents.forEach((incident) => {
      if (!incident.location) return;
      const cat = getCategory(incident.type);
      const pos: L.LatLngExpression = [
        incident.location.lat,
        incident.location.lng,
      ];
      const popup = `
        <div style="min-width:160px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${cat.color};margin-right:6px"></span>
          <strong>${cat.label}</strong>
          ${incident.title ? `<div style="margin-top:2px">${incident.title}</div>` : ''}
          ${incident.description ? `<p style="margin:4px 0 0">${incident.description}</p>` : ''}
        </div>`;
      L.marker(pos, { icon: iconFor(cat.color) }).addTo(group).bindPopup(popup);
    });

    // Pan to the latest incident if there is one
    if (incidents.length > 0) {
      const last = incidents[incidents.length - 1];
      if (last.location) {
        mapInstanceRef.current?.panTo([last.location.lat, last.location.lng]);
      }
    }
  }, [incidents]);

  // Show / move the draft marker for the location currently being chosen.
  useEffect(() => {
    const layer = draftLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!draftLocation) return;

    const marker = L.marker([draftLocation.lat, draftLocation.lng], {
      icon: makeDraftIcon(),
      draggable: true,
    }).addTo(layer);

    // Dragging the draft marker also updates the chosen location.
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onMapClickRef.current?.(p.lat, p.lng);
    });
  }, [draftLocation]);

  // Show/hide the polygon draw control based on claim mode.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const control = drawControlRef.current;
    if (!map || !control) return;
    if (claimMode) {
      control.addTo(map);
    } else {
      control.remove();
    }
  }, [claimMode]);

  // Render existing claimed properties as filled polygons.
  useEffect(() => {
    const layer = propertyLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    properties.forEach((p) => {
      const polygon = L.geoJSON(p.geometry, {
        style: {
          color: '#16a34a',
          weight: 2,
          fillColor: '#16a34a',
          fillOpacity: 0.2,
        },
      }).addTo(layer);
      polygon.bindPopup(`<strong>${p.name}</strong><br/>Claimed property`);
    });
  }, [properties]);

  return (
    <div>
      <div
        ref={mapRef}
        style={{ height: '500px', width: '100%', borderRadius: '8px' }}
      />
      <div className="mt-3 p-3 border rounded-lg bg-white flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-900">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: c.color,
                border: '1px solid rgba(0,0,0,0.4)',
              }}
            />
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
