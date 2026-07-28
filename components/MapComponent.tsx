'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface MapComponentProps {
  incidents?: Incident[];
  center?: [number, number];
}

export default function MapComponent({
  incidents = [],
  center = [-25.8242, 27.6774],
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Init the map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView(center, 13);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = null;
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
      const pos: L.LatLngExpression = [
        incident.location.lat,
        incident.location.lng,
      ];
      const popup = `
        <div style="min-width:160px">
          <strong>${incident.type || incident.title || 'Incident'}</strong>
          ${incident.description ? `<p style="margin:4px 0 0">${incident.description}</p>` : ''}
        </div>`;
      L.marker(pos).addTo(group).bindPopup(popup);
    });

    // Pan to the latest incident if there is one
    if (incidents.length > 0) {
      const last = incidents[incidents.length - 1];
      if (last.location) {
        mapInstanceRef.current?.panTo([last.location.lat, last.location.lng]);
      }
    }
  }, [incidents]);

  return (
    <div
      ref={mapRef}
      style={{ height: '500px', width: '100%', borderRadius: '8px' }}
    />
  );
}
