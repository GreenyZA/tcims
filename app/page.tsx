'use client';

import '../styles/globals.css';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import IncidentForm from '../components/IncidentForm';
import { getIncidents, uploadIncidentPhoto, addIncidentPhoto, setIncidentPoi, addIncidentComment, getIncidentComments, reportIncidentRemoval, getAllIncidentComments } from '../lib/utils';
import { isEmergencyCategory } from '../lib/categories';
import { getMyProperties, createProperty, type Property } from '../lib/properties';
import { createClient } from '../lib/supabase/client';
import type { Incident, IncidentComment } from '../lib/types';
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
  // ---- Right-click pin context menu + action modals ----
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [messageFor, setMessageFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [commentsByIncident, setCommentsByIncident] = useState<
    Record<string, IncidentComment[]>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Close the right-click menu when clicking/tapping outside it.
  // (Right-clicking the menu itself is NOT treated as a close; the opening
  // right-click can never close it because we only listen for mousedown.)
  useEffect(() => {
    if (!menu) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [menu]);

  const openMenu = useCallback((id: string, x: number, y: number) => {
    setMenu({ id, x, y });
  }, []);

  const togglePoi = async (id: string, current: boolean) => {
    setMenu(null);
    setActionBusy(true);
    setActionError(null);
    try {
      await setIncidentPoi(id, !current);
      await refresh();
    } catch (err) {
      const e = err as { message?: string };
      setActionError(e?.message || 'Failed to update pin.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleUploadClick = (id: string) => {
    setMenu(null);
    setUploadFor(id);
    // Defer so the hidden input is mounted before we click it.
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = uploadFor;
    e.target.value = '';
    if (!file || !id) return;
    setUploadFor(null);
    setActionBusy(true);
    setActionError(null);
    try {
      const url = await uploadIncidentPhoto(id, file);
      await addIncidentPhoto(id, url);
      await refresh();
    } catch (err) {
      const er = err as { message?: string };
      setActionError(er?.message || 'Failed to upload photo.');
    } finally {
      setActionBusy(false);
    }
  };

  const openMessage = async (id: string) => {
    setMenu(null);
    setMessageFor(id);
    try {
      const cs = await getIncidentComments(id);
      setCommentsByIncident((prev) => ({ ...prev, [id]: cs }));
    } catch {
      /* ignore read errors */
    }
  };

  const submitMessage = async (body: string) => {
    if (!messageFor || !body.trim()) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await addIncidentComment(messageFor, body.trim());
      const cs = await getIncidentComments(messageFor);
      setCommentsByIncident((prev) => ({ ...prev, [messageFor]: cs }));
      await refresh();
    } catch (err) {
      const e = err as { message?: string };
      setActionError(e?.message || 'Failed to post message.');
    } finally {
      setActionBusy(false);
    }
  };

  const submitReport = async () => {
    if (!reportFor || !reportReason.trim()) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await reportIncidentRemoval(reportFor, reportReason.trim());
      setReportFor(null);
      setReportReason('');
      await refresh();
    } catch (err) {
      const e = err as { message?: string };
      setActionError(e?.message || 'Failed to submit report.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const refresh = useCallback(async () => {
    try {
      const data = await getIncidents();
      // Attach the most recent message to each pin so the map can show a
      // "has message" flag + hover preview. Comments are publicly readable.
      let messages: Record<string, string> = {};
      try {
        messages = await getAllIncidentComments();
      } catch {
        /* ignore — flags just won't show */
      }
      // Priority incidents (inside a claimed property OR an always-TOP-priority
      // emergency category such as Fire / Health / Police) bubble to the top.
      data.sort(
        (a, b) =>
          Number(b.is_priority || isEmergencyCategory(b.type)) -
          Number(a.is_priority || isEmergencyCategory(a.type)),
      );
      setIncidents(
        data.map((inc) => ({
          ...inc,
          // Effective priority: DB flag OR an emergency category.
          is_priority: Boolean(inc.is_priority || isEmergencyCategory(inc.type)),
          lastMessage: messages[String(inc.id)] ?? null,
        })),
      );
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
            onIncidentContextMenu={openMenu}
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
              <div
                key={incident.id}
                className={
                  incident.is_priority
                    ? 'p-4 border-2 border-red-500 rounded-lg bg-white shadow text-gray-900'
                    : 'p-4 border rounded-lg bg-white shadow text-gray-900'
                }
              >
                <div className="flex items-center gap-2">
                  <strong>{incident.title || incident.type || 'No Title'}</strong>
                  {incident.is_priority && (
                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                      PRIORITY
                    </span>
                  )}
                  {incident.is_poi && (
                    <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                      POI
                    </span>
                  )}
                  {incident.is_reported && (
                    <span className="bg-gray-900 text-white text-xs font-bold px-2 py-0.5 rounded">
                      💀 REPORTED
                    </span>
                  )}
                  {incident.photos && incident.photos.length > 0 && (
                    <span title="Has photo" className="text-sm">📷</span>
                  )}
                  {incident.lastMessage && (
                    <span title="Has message" className="text-sm">💬</span>
                  )}
                </div>
                {incident.description && <p className="mt-1">{incident.description}</p>}
                {incident.location && (
                  <p className="text-sm text-gray-600">
                    📍 {incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}
                  </p>
                )}
                {incident.photos && incident.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {incident.photos.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={`incident ${incident.id} photo ${i + 1}`}
                        className="h-20 w-20 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Right-click pin context menu */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-[10000] bg-white border border-gray-300 rounded shadow-lg text-sm text-gray-900 min-w-[180px]"
          style={{ top: menu.y, left: menu.x }}
        >
          <button
            type="button"
            className="block w-full text-left px-3 py-2 hover:bg-gray-100"
            onClick={() => handleUploadClick(menu.id)}
          >
            📷 Upload image
          </button>
          <button
            type="button"
            className="block w-full text-left px-3 py-2 hover:bg-gray-100"
            onClick={() => openMessage(menu.id)}
          >
            💬 Leave a message
          </button>
          <button
            type="button"
            className="block w-full text-left px-3 py-2 hover:bg-gray-100"
            onClick={() => {
              const inc = incidents.find((i) => String(i.id) === menu.id);
              togglePoi(menu.id, Boolean(inc?.is_poi));
            }}
          >
            ⭐ Mark as point of interest
          </button>
          <button
            type="button"
            className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-red-600"
            onClick={() => {
              setMenu(null);
              setReportFor(menu.id);
            }}
          >
            🚩 Report for removal
          </button>
        </div>
      )}

      {/* Leave a message modal */}
      {messageFor && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={() => setMessageFor(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-gray-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Message on pin</h3>
            {(commentsByIncident[messageFor] ?? []).length > 0 && (
              <ul className="mb-3 space-y-2 max-h-40 overflow-y-auto">
                {(commentsByIncident[messageFor] ?? []).map((c) => (
                  <li key={c.id} className="text-sm border-b pb-1">
                    {c.body}
                  </li>
                ))}
              </ul>
            )}
            <textarea
              className="w-full border border-gray-300 rounded p-2"
              rows={3}
              placeholder="Write a message…"
              id="msg-body"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 rounded bg-gray-200" onClick={() => setMessageFor(null)}>
                Close
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
                disabled={actionBusy}
                onClick={() => {
                  const el = document.getElementById('msg-body') as HTMLTextAreaElement | null;
                  const body = el?.value ?? '';
                  submitMessage(body);
                  if (el) el.value = '';
                }}
              >
                {actionBusy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report for removal modal */}
      {reportFor && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={() => setReportFor(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-gray-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Report pin for removal</h3>
            <textarea
              className="w-full border border-gray-300 rounded p-2"
              rows={3}
              placeholder="Reason for removal…"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 rounded bg-gray-200" onClick={() => setReportFor(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
                disabled={actionBusy || !reportReason.trim()}
                onClick={submitReport}
              >
                {actionBusy ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <p className="text-sm text-red-600 mt-3">{actionError}</p>
      )}
    </div>
  );
};

export default Home;
