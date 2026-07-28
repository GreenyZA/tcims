// components/IncidentForm.tsx
import { useState } from 'react';
import { createIncident } from '../lib/utils';
import { CATEGORIES, type CategoryId } from '../lib/categories';

const HOME_LOCATION = { lat: -25.8242, lng: 27.6774 };

const IncidentForm = ({
  onCreated,
  location = HOME_LOCATION,
  onLocationChange,
}: {
  onCreated?: () => void;
  location?: { lat: number; lng: number };
  onLocationChange?: (loc: { lat: number; lng: number }) => void;
}) => {
  const [type, setType] = useState<CategoryId>(CATEGORIES[0].id);
  const [description, setDescription] = useState('');

  const setLatLng = (lat: number, lng: number) => {
    onLocationChange?.({ lat, lng });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createIncident({ type, description, location, anonymous: true });
      alert('Incident created successfully!');
      setType(CATEGORIES[0].id);
      setDescription('');
      onLocationChange?.(HOME_LOCATION);
      onCreated?.();
    } catch (error) {
      console.error('Error creating incident:', error);
      alert('Failed to create incident.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
      <div>
        <label htmlFor="type">Category:</label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as CategoryId)}
          required
          className="border border-gray-300 p-2 rounded w-full bg-white text-gray-900"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="description">Description:</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="border border-gray-300 p-2 rounded w-full bg-white text-gray-900"
        ></textarea>
      </div>
      <div>
        <label htmlFor="location-lat">Latitude:</label>
        <input
          id="location-lat"
          type="number"
          value={location.lat}
          onChange={(e) => setLatLng(parseFloat(e.target.value), location.lng)}
          required
          className="border border-gray-300 p-2 rounded w-full bg-white text-gray-900"
        />
      </div>
      <div>
        <label htmlFor="location-lng">Longitude:</label>
        <input
          id="location-lng"
          type="number"
          value={location.lng}
          onChange={(e) => setLatLng(location.lat, parseFloat(e.target.value))}
          required
          className="border border-gray-300 p-2 rounded w-full bg-white text-gray-900"
        />
      </div>
      <p className="text-xs text-gray-500">Tip: click the map to drop the pin exactly where the incident is.</p>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit
      </button>
    </form>
  );
};

export default IncidentForm;
