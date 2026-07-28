'use client';

import '../styles/globals.css';
import { useEffect, useState } from 'react';
import IncidentForm from '../components/IncidentForm';
import dynamic from 'next/dynamic';

// Dynamic import - This prevents Leaflet from running on the server
const MapComponent = dynamic(() => import('../components/MapComponent'), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-gray-100 flex items-center justify-center rounded-lg">Loading map...</div>,
});

type IncidentsTableRow = {
  id: number | string;
  title?: string;
  description?: string;
  location?: string;
  created_at?: string;
};

const Home = () => {
  const [incidents, setIncidents] = useState<IncidentsTableRow[]>([]);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const incidentsData = await getIncidents();
        setIncidents(incidentsData);
      } catch (error) {
        console.error('Failed to fetch incidents:', error);
      }
    };

    fetchIncidents();
  }, []);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">TCIMS</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Report New Incident</h2>
          <IncidentForm />
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Live Map</h2>
          <MapComponent />
        </div>
      </div>

      {/* Incidents List */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">Recent Incidents</h2>
        <div className="space-y-4">
          {incidents.map((incident) => (
            <div key={incident.id} className="p-4 border rounded-lg bg-white shadow">
              <strong>{incident.title || 'No Title'}</strong>
              {incident.description && <p className="mt-1">{incident.description}</p>}
              {incident.location && <p className="text-sm text-gray-600">📍 {incident.location}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;

const getIncidents = async (): Promise<IncidentsTableRow[]> => {
  return [];
};