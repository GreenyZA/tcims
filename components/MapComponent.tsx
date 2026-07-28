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
  location?: { lat: number; lng: number } | [number, number];
  type?: string;
  title?: string;
};

interface MapComponentProps {
  incidents?: Incident[];
}

export default function MapComponent({ incidents = [] }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([51.505, -0.09], 13); // Default center
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add markers from incidents
    incidents.forEach((incident) => {
      if (incident.location) {
        const pos = Array.isArray(incident.location) 
          ? incident.location 
          : [incident.location.lat, incident.location.lng];

        L.marker(pos as L.LatLngExpression)
          .addTo(map)
          .bindPopup(`<h3>${incident.type || incident.title || 'Incident'}</h3>`);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [incidents]);

  return (
    <div 
      ref={mapRef} 
      style={{ height: '500px', width: '100%', borderRadius: '8px' }}
    />
  );
}