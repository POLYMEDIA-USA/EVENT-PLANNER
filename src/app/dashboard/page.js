'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ events: 0, leads: 0, invited: 0, attended: 0 });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore selected event from localStorage
    const saved = localStorage.getItem('cm_event');
    if (saved) setSelectedEvent(JSON.parse(saved));
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('cm_token');
    try {
      const [eventsRes, statsRes] = await Promise.all([
        fetch('/api/events', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/reports/stats', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setEvents(evData.events || []);
      }
      if (statsRes.ok) {
        const stData = await statsRes.json();
        setStats(stData);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
    setLoading(false);
  };

  const selectEvent = (event) => {
    setSelectedEvent(event);
    localStorage.setItem('cm_event', JSON.stringify(event));
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm">Welcome back, {user?.full_name}</p>
          </div>
        </div>

        {/* Event Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Event</h2>
          {selectedEvent ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-indigo-600">{selectedEvent.name}</p>
                <p className="text-sm text-gray-500">
                  {selectedEvent.event_date} at {selectedEvent.event_time} — {selectedEvent.location}
                </p>
              </div>
              <button
                onClick={() => { setSelectedEvent(null); localStorage.removeItem('cm_event'); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              {events.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {user?.role === 'admin' ? 'No events yet. Create one in the Events tab.' : 'No active events available.'}
                </p>
              ) : (
                <div className="grid gap-2">
                  {events.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => selectEvent(ev)}
                      className="text-left p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                    >
                      <p className="font-medium text-gray-800">{ev.name}</p>
                      <p className="text-xs text-gray-500">{ev.event_date} at {ev.event_time} — {ev.location}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Events', value: stats.events, color: 'indigo' },
            { label: 'Total Leads', value: stats.leads, color: 'blue' },
            { label: 'Invited', value: stats.invited, color: 'amber' },
            { label: 'Attended', value: stats.attended, color: 'green' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-3xl font-bold text-${s.color}-600 mt-1`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
