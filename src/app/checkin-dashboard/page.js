'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function CheckInDashboardPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastPollRef = useRef(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = async () => {
    try {
      const event = JSON.parse(localStorage.getItem('cm_event') || 'null');
      const leadsUrl = event ? `/api/leads?event_id=${event.id}` : '/api/leads';
      const [leadsRes, intRes] = await Promise.all([
        fetch(leadsUrl, { headers }),
        fetch('/api/interactions', { headers }),
      ]);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.customers || []);
      }
      if (intRes.ok) {
        const data = await intRes.json();
        setInteractions(data.interactions || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Poll interactions every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/interactions', { headers });
        if (res.ok) {
          const data = await res.json();
          setInteractions(data.interactions || []);
        }
        // Also refresh leads to pick up status changes
        const event = JSON.parse(localStorage.getItem('cm_event') || 'null');
        const leadsUrl = event ? `/api/leads?event_id=${event.id}` : '/api/leads';
        const leadsRes = await fetch(leadsUrl, { headers });
        if (leadsRes.ok) {
          const data = await leadsRes.json();
          setLeads(data.customers || []);
        }
      } catch (err) { console.error(err); }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const event = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cm_event') || 'null') : null;

  // Compute stats
  const accepted = leads.filter(l => l.status === 'accepted' || l.status === 'attended');
  const checkedIn = leads.filter(l => l.status === 'attended');
  const pending = leads.filter(l => l.status === 'accepted');
  const totalExpected = accepted.length;
  const checkedInCount = checkedIn.length;
  const pendingCount = pending.length;
  const pct = totalExpected > 0 ? Math.round((checkedInCount / totalExpected) * 100) : 0;

  // Recent check-ins from interactions (qr_scan type)
  const recentCheckIns = interactions
    .filter(i => i.interaction_type === 'qr_scan')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Check-In Live</h1>
            {event && <p className="text-sm text-gray-500">Event: {event.name}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-500">Live — updates every 10s</span>
          </div>
        </div>

        {!event && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
            No event selected. Select an event from the Dashboard to filter check-ins.
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Expected</p>
                <p className="text-3xl font-bold text-gray-900">{totalExpected}</p>
                <p className="text-xs text-gray-400 mt-1">Accepted RSVPs</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Checked In</p>
                <p className="text-3xl font-bold text-green-600">{checkedInCount}</p>
                <p className="text-xs text-gray-400 mt-1">Attended</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
                <p className="text-xs text-gray-400 mt-1">Not yet arrived</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Check-In Progress</p>
                <p className="text-sm font-bold text-indigo-600">{pct}%</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-indigo-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{checkedInCount} of {totalExpected} checked in</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Check-Ins */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-700">Recent Check-Ins</h2>
                </div>
                {recentCheckIns.length === 0 ? (
                  <p className="p-6 text-center text-gray-400 text-sm">No check-ins yet</p>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {recentCheckIns.map(ci => (
                      <div key={ci.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{ci.customer_name}</p>
                          <p className="text-xs text-gray-400">Scanned by {ci.sales_rep_name || 'System'}</p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(ci.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Expected but Not Arrived */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-700">Expected — Not Yet Arrived</h2>
                </div>
                {pending.length === 0 ? (
                  <p className="p-6 text-center text-gray-400 text-sm">All expected guests have arrived!</p>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {pending.map(lead => (
                      <div key={lead.id} className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{lead.full_name}</p>
                        <p className="text-xs text-gray-400">
                          {lead.company_name}{lead.company_name && lead.email ? ' · ' : ''}{lead.email}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
