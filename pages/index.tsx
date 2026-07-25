// pages/index.tsx
import '../styles/globals.css';
import { useEffect, useState } from 'react';

const Home = () => {
  const [incidents, setIncidents] = useState<IncidentsTableRow[]>([]);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const incidentsData = await getIncidents();
        setIncidents(incidentsData);
      } catch (error) {
        console.error('Error fetching incidents:', error);
      }
    };

    fetchIncidents();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1>Welcome to TCIMS</h1>
      <p>This is a basic layout for your project.</p>
      <ul>
        {incidents.map((incident) => (
          <li key={incident.id}>
            {incident.type}: {incident.description}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Home;
