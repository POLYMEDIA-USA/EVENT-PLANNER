'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';
import jsQR from 'jsqr';

export default function ScannerPage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const scanIntervalRef = useRef(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        startScanLoop();
      }
    } catch (err) {
      setError('Camera access denied. Use manual entry below.');
    }
  };

  const startScanLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleQRResult(code.data);
      }
    }, 300);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleQRResult = async (data) => {
    stopCamera();

    const res = await fetch('/api/interactions', {
      method: 'POST', headers,
      body: JSON.stringify({
        qr_data: data,
        interaction_type: 'qr_scan',
        event_id: JSON.parse(localStorage.getItem('cm_event') || '{}').id || '',
        notes: 'Checked in via QR scan',
      }),
    });

    if (res.ok) {
      const iData = await res.json();
      setResult({ success: true, interaction: iData.interaction, customer: iData.customer, qr_data: data });
    } else {
      const err = await res.json();
      setResult({ success: false, error: err.error });
    }
  };

  const handleManualEntry = () => {
    if (!manualCode.trim()) return;
    handleQRResult(manualCode.trim());
  };

  const addNotes = async () => {
    if (!result?.interaction || !notes.trim()) return;

    await fetch('/api/interactions', {
      method: 'POST', headers,
      body: JSON.stringify({
        customer_id: result.interaction.customer_id,
        interaction_type: 'manual_note',
        event_id: result.interaction.event_id,
        notes,
      }),
    });

    setNotes('');
    alert('Notes saved!');
  };

  const searchByName = async () => {
    if (!nameSearch.trim()) return;
    setSearchLoading(true);
    try {
      const event = JSON.parse(localStorage.getItem('cm_event') || 'null');
      const url = event ? `/api/leads?event_id=${event.id}` : '/api/leads';
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        const q = nameSearch.toLowerCase();
        const matches = (data.customers || [])
          .filter(c => ['accepted', 'invited', 'attended'].includes(c.status))
          .filter(c => c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
        setAttendees(matches);
      }
    } catch (err) { console.error(err); }
    setSearchLoading(false);
  };

  const checkInByName = async (customer) => {
    // Manually mark as attended via the interactions API using their QR code or customer_id directly
    const res = await fetch('/api/interactions', {
      method: 'POST', headers,
      body: JSON.stringify({
        customer_id: customer.id,
        interaction_type: 'qr_scan',
        event_id: JSON.parse(localStorage.getItem('cm_event') || '{}').id || '',
        notes: 'Checked in by name search (no QR code)',
        ...(customer.qr_code_data ? { qr_data: customer.qr_code_data } : {}),
      }),
    });
    if (res.ok) {
      const iData = await res.json();
      setResult({ success: true, interaction: iData.interaction, customer: iData.customer || customer });
      setAttendees([]);
      setNameSearch('');
    } else {
      const err = await res.json();
      setResult({ success: false, error: err.error });
    }
  };

  const reset = () => {
    setResult(null);
    setNotes('');
    setManualCode('');
    setNameSearch('');
    setAttendees([]);
    setError('');
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">QR Scanner</h1>

        {!result && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '4/3' }}>
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button onClick={startCamera}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                      Start Scanner
                    </button>
                  </div>
                )}
                {scanning && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-white/50 rounded-lg"></div>
                    </div>
                    <div className="absolute top-4 right-4">
                      <button onClick={stopCamera} className="px-3 py-1 bg-red-600 text-white text-sm rounded">
                        Stop
                      </button>
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-white text-xs bg-black/50 inline-block px-3 py-1 rounded">Point camera at QR code</p>
                    </div>
                  </>
                )}
              </div>

              {error && <p className="text-sm text-amber-600 mb-4">{error}</p>}

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Manual Check-In Code</p>
                <p className="text-xs text-gray-400 mb-2">Enter the check-in code shown on the attendee&apos;s confirmation email or RSVP page.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()}
                    placeholder="e.g. CORPMARKETER:abc123:xyz789"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                  <button onClick={handleManualEntry}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                    Check In
                  </button>
                </div>
              </div>

              {/* Search by Name */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Search by Name</p>
                <p className="text-xs text-gray-400 mb-2">Find an attendee by last name or email if they don&apos;t have a QR code.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchByName()}
                    placeholder="Search by last name or email..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button onClick={searchByName} disabled={searchLoading}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {searchLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {attendees.length > 0 && (
                  <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-b border-gray-200">
                      {attendees.length} match{attendees.length !== 1 ? 'es' : ''} found — tap to check in
                    </div>
                    <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                      {attendees.map(a => (
                        <button key={a.id} onClick={() => checkInByName(a)}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{a.full_name}</p>
                            <p className="text-xs text-gray-500">{a.company_name}{a.company_name && a.email ? ' · ' : ''}{a.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                              a.status === 'attended' ? 'bg-green-100 text-green-700' :
                              a.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{a.status}</span>
                            {a.status !== 'attended' && (
                              <span className="text-indigo-600 text-xs font-medium">Check In →</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {result.success ? (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-green-600 text-2xl font-bold">&#10003;</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Checked In!</h2>
                  {result.customer && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                      <p className="text-lg font-semibold text-gray-900">{result.customer.full_name}</p>
                      {result.customer.title && <p className="text-sm text-indigo-600">{result.customer.title}</p>}
                      {result.customer.company_name && <p className="text-sm text-gray-600">{result.customer.company_name}</p>}
                      {result.customer.organization_name && <p className="text-xs text-gray-400 mt-1">Org: {result.customer.organization_name}</p>}
                    </div>
                  )}
                  {!result.customer && <p className="text-gray-500 mt-1">Guest has been marked as attended</p>}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interaction Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Add notes about this interaction..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button onClick={addNotes} disabled={!notes.trim()}
                    className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    Save Notes
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-600 text-2xl font-bold">&#10007;</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Scan Failed</h2>
                <p className="text-gray-500 mt-1">{result.error}</p>
              </div>
            )}

            <button onClick={reset}
              className="w-full mt-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">
              Scan Another
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
