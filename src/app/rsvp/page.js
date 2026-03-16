'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function RSVPContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const action = searchParams.get('action');

    if (!token || !action) {
      setError('Invalid RSVP link');
      setLoading(false);
      return;
    }

    fetch(`/api/rsvp?token=${token}&action=${action}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setResult(data);
      })
      .catch(() => setError('Something went wrong'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        {result.status === 'accepted' ? (
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
