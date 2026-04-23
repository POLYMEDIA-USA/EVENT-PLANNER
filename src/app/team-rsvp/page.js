'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function TeamRSVPInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const initialAction = searchParams.get('action'); // hint from email link

  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedAction, setSelectedAction] = useState(initialAction === 'decline' ? 'decline' : 'accept');

  useEffect(() => {
    if (!token) { setError('Missing RSVP token.'); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/team/rsvp?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) setError(data.error || 'Invalid link');
        else setInfo(data);
      } catch (err) { setError('Connection error'); }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/team/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: selectedAction }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed');
      else setResult(data);
    } catch (err) { setError('Connection error'); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Logo" className="h-12 mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-indigo-600">FunnelFlow</h1>
          <p className="text-gray-500 mt-1">Team RSVP</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8">
          {loading && <p className="text-center text-gray-400">Loading…</p>}
          {error && !loading && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}
          {info && !result && !error && (
            <>
              <h2 className="text-xl font-semibold text-gray-900">Hi {info.user_name},</h2>
              <p className="text-sm text-gray-600 mt-2">Are you working this event?</p>
              <div className="my-4 p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold text-gray-900">{info.event_name}</p>
                <p className="text-sm text-gray-600">{info.event_date} at {info.event_time}</p>
                <p className="text-sm text-gray-600">{info.event_location}</p>
              </div>
              {info.already_responded ? (
                <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-lg">
                  You already responded — status: <strong>{info.status}</strong>. Contact your admin if this needs to change.
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${selectedAction === 'accept' ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                      <input type="radio" name="action" checked={selectedAction === 'accept'} onChange={() => setSelectedAction('accept')} />
                      <span className="text-sm font-medium text-green-700">Yes, I'll be there</span>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${selectedAction === 'decline' ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                      <input type="radio" name="action" checked={selectedAction === 'decline'} onChange={() => setSelectedAction('decline')} />
                      <span className="text-sm font-medium text-red-700">No, I can't make it</span>
                    </label>
                  </div>
                  <button onClick={submit} disabled={submitting}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {submitting ? 'Submitting…' : 'Confirm Response'}
                  </button>
                </>
              )}
            </>
          )}
          {result && (
            <div className="text-center">
              {result.status === 'confirmed' ? (
                <>
                  <h2 className="text-xl font-bold text-green-600">Thanks — you're confirmed!</h2>
                  <p className="text-sm text-gray-500 mt-2">An admin will send you a confirmation email with your check-in QR code.</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-red-600">Noted — we've recorded your decline.</h2>
                  <p className="text-sm text-gray-500 mt-2">Thanks for letting us know.</p>
                </>
              )}
              {result.already_responded && (
                <p className="text-xs text-gray-400 mt-3">(Response already on file — not changed.)</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamRSVPPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <TeamRSVPInner />
    </Suspense>
  );
}
