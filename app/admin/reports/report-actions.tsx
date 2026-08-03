'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';

async function updateReportStatus(reportId: string, status: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('incident_reports')
    .update({ status })
    .eq('id', reportId);
  if (error) throw error;
}

async function deleteIncident(incidentId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', incidentId);
  if (error) throw error;
}

export function ReportActions({
  reportId,
  incidentId,
}: {
  reportId: string;
  incidentId: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleStatus = async (status: string) => {
    setBusy(true);
    try {
      await updateReportStatus(reportId, status);
      router.refresh();
    } catch (err) {
      const e = err as { message?: string };
      alert(e?.message || 'Failed to update report.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteIncident = async () => {
    if (
      !confirm(
        '⚠️ Permanently delete this incident and all its photos, comments, and reports? This cannot be undone.',
      )
    )
      return;
    setBusy(true);
    try {
      await deleteIncident(incidentId);
      await updateReportStatus(reportId, 'actioned');
      router.refresh();
    } catch (err) {
      const e = err as { message?: string };
      alert(e?.message || 'Failed to delete incident.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      <button
        onClick={() => handleStatus('dismissed')}
        disabled={busy}
        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
      >
        {busy ? '…' : 'Dismiss'}
      </button>
      <button
        onClick={() => handleStatus('actioned')}
        disabled={busy}
        className="text-xs px-2 py-1 bg-green-200 text-green-800 rounded hover:bg-green-300 disabled:opacity-50"
      >
        {busy ? '…' : '✓ Actioned'}
      </button>
      <button
        onClick={handleDeleteIncident}
        disabled={busy}
        className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded hover:bg-red-300 disabled:opacity-50"
      >
        {busy ? '…' : '🗑 Delete Incident'}
      </button>
    </div>
  );
}
