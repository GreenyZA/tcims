'use client';

import '../styles/globals.css';
import { useEffect, useState, useCallback } from 'react';
import IncidentForm from '../components/IncidentForm';
import { getIncidents } from '../lib/utils';
import type { Incident } from '../lib/types';
import dynamic from 'next/dynamic';

// Dynamic import - This prevents Leaflet from running on the server
const MapComponent = dynamic(() => import('../components/MapComponent'), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-gray-100 flex items-center justify-center rounded-lg">Loading map...</div>,
});

const HOME_CENTER: [number, number] = [-25.8242, 27.6774];

const Home = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number }>({
    lat: HOME_CENTER[0],
    lng: HOME_CENTER[1],
  });

  const refresh = useCallback(async () => {
    try {
      const data = await getIncidents();
      setIncidents(data);
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">TCIMS</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Report New Incident</h2>
          <IncidentForm
            onCreated={refresh}
            location={draftLocation}
            onLocationChange={setDraftLocation}
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Live Map</h2>
          <MapComponent
            incidents={incidents}
            center={HOME_CENTER}
            draftLocation={draftLocation}
            onMapClick={(lat, lng) => setDraftLocation({ lat, lng })}
          />
        </div>
      </div>

      {/* Incidents List */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Recent Incidents</h2>
        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : incidents.length === 0 ? (
          <p className="text-gray-600">No incidents reported yet.</p>
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <div key={incident.id} className="p-4 border rounded-lg bg-white shadow text-gray-900">
                <strong>{incident.title || incident.type || 'No Title'}</strong>
                {incident.description && <p className="mt-1">{incident.description}</p>}
                {incident.location && (
                  <p className="text-sm text-gray-600">
                    📍 {incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
