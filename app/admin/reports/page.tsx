import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import { isEmergencyCategory, getCategory } from '../../../lib/categories';
import { SignupModeToggle } from './signup-mode-toggle';
import { ReportActions } from './report-actions';

// Type for the normalized report data returned by loadReports().
type AdminReport = {
  id: string;
  incident_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter: { username?: string | null; display_name?: string | null } | null;
  incident: {
    id: string;
    type: string;
    title?: string | null;
    description?: string | null;
    photos?: string[];
    location: { type: string; coordinates: [number, number] };
    is_priority?: boolean;
    is_poi?: boolean;
    is_reported?: boolean;
    created_at?: string;
    user_id?: string | null;
  };
};

// Server-side: fetch reports with incident + reporter details for context.
async function loadReports(): Promise<{ reports: AdminReport[]; signupMode: 'open' | 'admin_only' }> {
  const supabase = await createClient();

  // Verify the current user is an admin first.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect('/');
  }

  // Fetch the current signup mode.
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'signup_mode')
    .single();
  const signupMode = config?.value === 'admin_only' ? 'admin_only' : 'open';

  // Fetch all reports with incident + reporter details.
  const { data: reports, error } = await supabase
    .from('incident_reports')
    .select(`
      id,
      incident_id,
      reason,
      status,
      created_at,
      reporter:profiles!reporter_id ( username, display_name ),
      incident:incidents!inner (
        id, type, title, description, photos,
        location, is_priority, is_poi, is_reported, created_at,
        user_id
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Supabase returns joined tables as arrays even for to-one relations.
  // Normalize to single objects for the template.
  const normalized = (reports ?? []).map(
    (r: Record<string, unknown>): AdminReport => ({
      id: r.id as string,
      incident_id: r.incident_id as string,
      reason: r.reason as string,
      status: r.status as string,
      created_at: r.created_at as string,
      reporter: Array.isArray(r.reporter) ? (r.reporter[0] as AdminReport['reporter']) : (r.reporter as AdminReport['reporter']),
      incident: Array.isArray(r.incident) ? (r.incident[0] as AdminReport['incident']) : (r.incident as AdminReport['incident']),
    }),
  );

  return { reports: normalized, signupMode };
}

// Format coordinates for display (lng, lat from PostGIS → lat, lng for humans).
function formatLocation(loc: { coordinates: [number, number] }): string {
  if (!loc?.coordinates) return 'unknown';
  const [lng, lat] = loc.coordinates;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Status badge colors.
const STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-800',
  reviewed: 'bg-blue-100 text-blue-800',
  actioned: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-800',
} as const;

export default async function AdminReportsPage() {
  const { reports, signupMode } = await loadReports();

  return (
    <div className="min-h-screen p-6 bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to map
          </Link>
        </div>

        {/* Signup mode toggle */}
        <div className="bg-white border rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Registration Access</h2>
          <p className="text-sm text-gray-600 mb-3">
            Current: <strong>{signupMode}</strong>
          </p>
          <SignupModeToggle currentMode={signupMode} />
        </div>

        {/* Incident reports */}
        <h2 className="text-xl font-semibold mb-4">Incident Reports</h2>
        {reports.length === 0 ? (
          <p className="text-gray-600">No reports filed.</p>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const cat = getCategory(report.incident?.type);
              const reporterName =
                report.reporter?.display_name ||
                report.reporter?.username ||
                '(unknown)';

              return (
                <div
                  key={report.id}
                  className="bg-white border rounded-lg shadow p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.label || report.incident?.type}
                        </span>
                        {report.incident?.is_priority && (
                          <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">
                            PRIORITY
                          </span>
                        )}
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            STATUS_COLORS[report.status as keyof typeof STATUS_COLORS] ||
                            STATUS_COLORS.open
                          }`}
                        >
                          {report.status}
                        </span>
                      </div>

                      <h3 className="font-semibold text-lg">
                        {report.incident?.title ||
                          cat.label ||
                          report.incident?.type ||
                          'Untitled Incident'}
                      </h3>

                      {report.incident?.description && (
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                          {report.incident.description}
                        </p>
                      )}

                      {report.incident?.photos &&
                        report.incident.photos.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {report.incident.photos.map((photo: string, i: number) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={photo}
                                alt={`incident photo ${i + 1}`}
                                className="h-16 w-16 object-cover rounded border"
                              />
                            ))}
                          </div>
                        )}

                      <div className="text-xs text-gray-500 mt-3 space-y-0.5">
                        <p> 📍 {formatLocation(report.incident.location)}</p>
                        <p>
                          📅 Reported:{' '}
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                        <p>
                          {isEmergencyCategory(report.incident?.type)
                            ? '🚨 Emergency category'
                            : report.incident?.is_reported
                              ? '🚩 Reported'
                              : ''}
                        </p>
                        <p> 🙋 Reporter: {reporterName}</p>
                        <p> 📝 Reason: {report.reason}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex justify-end">
                    <ReportActions
                      reportId={report.id}
                      incidentId={report.incident.id}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
