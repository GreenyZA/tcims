'use client';

import '../styles/globals.css';
import { useEffect, useState, useCallback } from 'react';
import IncidentForm from '../components/IncidentForm';
import AuthPortal from '../components/AuthPortal';
import { getIncidents } from '../lib/utils';
import { getMyProperties, createProperty, type Property } from '../lib/properties';
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
  const [claimMode, setClaimMode] = useState(false);
  const [myProperties, setMyProperties] = useState<Property[]>([]);
  const [propertyName, setPropertyName] = useState('');
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [propertyBusy, setPropertyBusy] = useState(false);

  const loadProperties = useCallback(async () => {
    try {
      const props = await getMyProperties();
      setMyProperties(props);
    } catch {
      // Not authed or table missing — silently skip; claim UI stays dormant.
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const handlePolygonDrawn = async (polygon: GeoJSON.Polygon) => {
    setPropertyError(null);
    const name = propertyName.trim();
    if (!name) {
      setPropertyError('Enter a name for your plot before drawing, or after — try again.');
      return;
    }
    setPropertyBusy(true);
    try {
      await createProperty({ name, geometry: polygon });
      setPropertyName('');
      setClaimMode(false);
      await loadProperties();
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : 'Failed to save plot.');
    } finally {
      setPropertyBusy(false);
    }
  };

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
            claimMode={claimMode}
            properties={myProperties.map((p) => ({
              id: p.id,
              name: p.name,
              geometry: p.geometry,
            }))}
            onPolygonDrawn={handlePolygonDrawn}
          />
        </div>
      </div>

      {/* Land-owner property claims */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">My Land</h2>
        <p className="text-sm text-gray-600 mb-3">
          Claim a plot to get priority notifications for incidents inside it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setClaimMode((v) => !v)}
            disabled={propertyBusy}
            className={
              claimMode
                ? 'bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50'
                : 'bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50'
            }
          >
            {propertyBusy ? 'Saving…' : claimMode ? 'Cancel claim' : 'Claim a plot'}
          </button>
          <input
            type="text"
            placeholder="Plot name (e.g. Boekenhout Farm)"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            className="border border-gray-300 p-2 rounded bg-white text-gray-900"
          />
        </div>
        {claimMode && (
          <p className="text-sm text-blue-600 mt-2">
            Draw a polygon on the map to mark your property boundary.
          </p>
        )}
        {propertyError && <p className="text-sm text-red-600 mt-2">{propertyError}</p>}
        {myProperties.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-gray-800">
            {myProperties.map((p) => (
              <li key={p.id}>• {p.name}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Account / Auth */}
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

      {/* Account / Auth */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Account</h2>
        <AuthPortal />
      </div>
    </div>
  );
};

export default Home;
