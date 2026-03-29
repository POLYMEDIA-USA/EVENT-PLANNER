'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function RSVPContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token || !action) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-4xl mb-4">!</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid RSVP Link</h1>
          <p className="text-gray-500">This link appears to be incomplete.</p>
        </div>
      </div>
    );
  }

  const confirmRSVP = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-4xl mb-4">!</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">RSVP Error</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Result screen — after user confirms
  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          {result.already_responded ? (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 text-2xl font-bold">&#8505;</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Responded</h1>
              <p className="text-gray-500">
                Thank you, {result.customer_name}! You have already responded to this invitation.
                Your current status is: <span className="font-semibold capitalize">{result.status}</span>
              </p>
              {result.qr_code_data && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Your check-in QR code:</p>
                  <div className="bg-white p-4 rounded border inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.qr_code_data)}`}
                      alt="QR Code"
                      className="mx-auto"
                    />
                  </div>
                  <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Manual check-in code:</p>
                    <p className="font-mono text-sm font-bold text-gray-800 break-all select-all">{result.qr_code_data}</p>
                  </div>
                </div>
              )}
            </>
          ) : result.status === 'accepted' ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 text-2xl font-bold">&#10003;</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re In!</h1>
              <p className="text-gray-500 mb-4">Thank you, {result.customer_name}! We look forward to seeing you.</p>
              {result.qr_code_data && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Your check-in QR code:</p>
                  <div className="bg-white p-4 rounded border inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.qr_code_data)}`}
                      alt="QR Code"
                      className="mx-auto"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Show this at the event for check-in</p>
                  <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Manual check-in code:</p>
                    <p className="font-mono text-sm font-bold text-gray-800 break-all select-all">{result.qr_code_data}</p>
                  </div>
                </div>
              )}
              {result.event_id && (
                <div className="mt-4">
                  <a
                    href={`/api/events/ical?event_id=${result.event_id}`}
                    className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                  >
                    &#128197; Add to Calendar
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">&#10007;</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">RSVP Declined</h1>
              <p className="text-gray-500">Thank you for letting us know, {result.customer_name}. Maybe next time!</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Confirmation screen — user must click to confirm (blocks email scanners)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        {action === 'accept' ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-3xl">&#127881;</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Accept Invitation</h1>
            <p className="text-gray-500 mb-6">Click below to confirm your attendance. You&apos;ll receive a QR code for check-in.</p>
            <button
              onClick={confirmRSVP}
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-lg"
            >
              {loading ? 'Confirming...' : 'Yes, I\'ll Attend'}
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-gray-400 text-3xl">&#128075;</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Decline Invitation</h1>
            <p className="text-gray-500 mb-6">Click below to let us know you can&apos;t make it.</p>
            <button
              onClick={confirmRSVP}
              disabled={loading}
              className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-lg"
            >
              {loading ? 'Confirming...' : 'Decline Invitation'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function RSVPPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <RSVPContent />
    </Suspense>
  );
}
