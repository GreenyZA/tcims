// components/IncidentForm.tsx
import { useState } from 'react';
import { createIncident } from '../lib/utils';

const IncidentForm = () => {
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number }>({ lat: 51.505, lng: -0.09 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createIncident({ type, description, location, anonymous: true });
      alert('Incident created successfully!');
      setType('');
      setDescription('');
      setLocation({ lat: 51.505, lng: -0.09 });
    } catch (error) {
      console.error('Error creating incident:', error);
      alert('Failed to create incident.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
      <div>
        <label htmlFor="type">Type:</label>
        <input
          id="type"
          type="text"
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
          className="border p-2 rounded"
        />
      </div>
      <div>
        <label htmlFor="description">Description:</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="border p-2 rounded"
        ></textarea>
      </div>
      <div>
        <label htmlFor="location-lat">Latitude:</label>
        <input
          id="location-lat"
          type="number"
          value={location.lat}
          onChange={(e) => setLocation({ ...location, lat: parseFloat(e.target.value) })}
          required
          className="border p-2 rounded"
        />
      </div>
      <div>
        <label htmlFor="location-lng">Longitude:</label>
        <input
          id="location-lng"
          type="number"
          value={location.lng}
          onChange={(e) => setLocation({ ...location, lng: parseFloat(e.target.value) })}
          required
          className="border p-2 rounded"
        />
      </div>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit
      </button>
    </form>
  );
};

export default IncidentForm;
