'use client';

import '../styles/globals.css';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import IncidentForm from '../components/IncidentForm';
import { getIncidents } from '../lib/utils';
import { getMyProperties, createProperty, type Property } from '../lib/properties';
import { createClient } from '../lib/supabase/client';
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
  // Success confirmation shown after a plot is saved.
  const [propertySuccess, setPropertySuccess] = useState<string | null>(null);
  // The finished-but-not-yet-saved draft polygon (set when the user double-clicks).
  const [draftPolygon, setDraftPolygon] = useState<GeoJSON.Polygon | null>(null);

  const clearDraft = () => {
    setDraftPolygon(null);
    setClaimMode(false);
    setPropertyError(null);
    setPropertySuccess(null);
  };

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
    setPropertySuccess(null);
    const name = propertyName.trim();
    if (!name) {
      setPropertyError('Enter a name for your plot before accepting.');
      return;
    }
    setPropertyBusy(true);
    try {
      await createProperty({ name, geometry: polygon });
      setPropertyName('');
      setDraftPolygon(null);
      setClaimMode(false);
      setPropertySuccess(`"${name}" saved as your property.`);
      await loadProperties();
    } catch (err) {
      // Supabase errors are plain objects (not Error instances) — show the
      // real message rather than "[object Object]".
      const e = err as { message?: string };
      setPropertyError(e?.message || 'Failed to save plot.');
    } finally {
      setPropertyBusy(false);
    }
  };

  const router = useRouter();

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
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
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">TCIMS</h1>
        <button
          type="button"
          onClick={handleSignOut}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
        >
          Sign out
        </button>
      </header>

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
            onPolygonDraft={setDraftPolygon}
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
            onClick={() => {
              if (claimMode) {
                clearDraft();
              } else {
                setPropertyError(null);
                setDraftPolygon(null);
                setClaimMode(true);
              }
            }}
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
        {claimMode && !draftPolygon && (
          <p className="text-sm text-blue-600 mt-2">
            Click points on the map to outline your property, then double-click to finish.
          </p>
        )}
        {draftPolygon && (
          <div className="mt-3">
            <p className="text-sm text-gray-700 mb-2">
              Area outlined. Accept to save it as &ldquo;{propertyName || 'your plot'}&rdquo;, or clear to redraw.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handlePolygonDrawn(draftPolygon)}
                disabled={propertyBusy}
                className="bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {propertyBusy ? 'Saving…' : 'Accept'}
              </button>
              <button
                type="button"
                onClick={clearDraft}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        {propertyError && <p className="text-sm text-red-600 mt-2">{propertyError}</p>}
        {propertySuccess && (
          <p className="text-sm text-green-700 mt-2 font-medium">{propertySuccess}</p>
        )}
        {myProperties.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-gray-800">
            {myProperties.map((p) => (
              <li key={p.id}>• {p.name}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent Incidents */}
      <div className="mt-12">
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
