'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

async function setSignupMode(mode: 'open' | 'admin_only') {
  const { error } = await supabase
    .from('app_config')
    .update({ value: mode })
    .eq('key', 'signup_mode');
  if (error) throw error;
}

export function SignupModeToggle({
  currentMode,
}: {
  currentMode: 'open' | 'admin_only';
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    const newMode: 'open' | 'admin_only' =
      currentMode === 'open' ? 'admin_only' : 'open';
    setBusy(true);
    try {
      await setSignupMode(newMode);
      router.refresh();
    } catch (err) {
      const e = err as { message?: string };
      alert(e?.message || 'Failed to update signup mode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700">
        {currentMode === 'open'
          ? 'Anyone can register'
          : 'Registration closed (admin only)'}
      </span>
      <button
        onClick={handleToggle}
        disabled={busy}
        className={`px-3 py-1 text-xs font-medium rounded text-white transition-colors ${
          currentMode === 'open'
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-green-500 hover:bg-green-600'
        } disabled:opacity-50`}
      >
        {busy
          ? '…'
          : currentMode === 'open'
            ? 'Lock Down'
            : 'Open Registration'}
      </button>
    </div>
  );
}
