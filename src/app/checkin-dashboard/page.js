'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function CheckInDashboardPage() {
  const { user } = useAuth();
  const [myLeads, setMyLeads] = useState([]);
  const [eventLeads, setEventLeads] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [teamAttendance, setTeamAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastPollRef = useRef(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const isAdmin = user?.role === 'admin';
  const canSeeTeam = user?.role === 'admin' || user?.role === 'supervisor';

  const fetchData = async () => {
    try {
      const event = JSON.parse(localStorage.getItem('cm_event') || 'null');
      const myUrl = event ? `/api/leads?event_id=${event.id}` : '/api/leads';
      const eventUrl = event ? `/api/leads?scope=event&event_id=${event.id}` : '/api/leads?scope=event';
      const fetches = [
        fetch(myUrl, { headers }),
        fetch(eventUrl, { headers }),
        fetch('/api/interactions', { headers }),
      ];
      if (canSeeTeam && event) {
        fetches.push(fetch(`/api/team/attendance?event_id=${event.id}`, { headers }));
      }
      const results = await Promise.all(fetches);
      if (results[0].ok) setMyLeads((await results[0].json()).customers || []);
      if (results[1].ok) setEventLeads((await results[1].json()).customers || []);
      if (results[2].ok) setInteractions((await results[2].json()).interactions || []);
      if (results[3]?.ok) setTeamAttendance((await results[3].json()).attendance || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Poll every 30 seconds (parallel fetches)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const event = JSON.parse(localStorage.getItem('cm_event') || 'null');
        const myUrl = event ? `/api/leads?event_id=${event.id}` : '/api/leads';
        const eventUrl = event ? `/api/leads?scope=event&event_id=${event.id}` : '/api/leads?scope=event';
        const fetches = [
          fetch('/api/interactions', { headers }),
          fetch(myUrl, { headers }),
          fetch(eventUrl, { headers }),
        ];
        if (canSeeTeam && event) {
          fetches.push(fetch(`/api/team/attendance?event_id=${event.id}`, { headers }));
        }
        const results = await Promise.all(fetches);
        if (results[0].ok) setInteractions((await results[0].json()).interactions || []);
        if (results[1].ok) setMyLeads((await results[1].json()).customers || []);
        if (results[2].ok) setEventLeads((await results[2].json()).customers || []);
        if (results[3]?.ok) setTeamAttendance((await results[3].json()).attendance || []);
      } catch (err) { console.error(err); }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const event = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cm_event') || 'null') : null;

  const computeStats = (leads) => {
    // "Checked in" includes both in_the_room (live, transient) and attended
    // (settled after the event closes). "Pending" is anyone confirmed RSVP
    // but not yet scanned.
    const accepted = leads.filter(l => l.status === 'accepted' || l.status === 'in_the_room' || l.status === 'attended');
    const checkedIn = leads.filter(l => l.status === 'in_the_room' || l.status === 'attended');
    const pending = leads.filter(l => l.status === 'accepted');
    const totalExpected = accepted.length;
    const pct = totalExpected > 0 ? Math.round((checkedIn.length / totalExpected) * 100) : 0;
    return { accepted, checkedIn, pending, totalExpected, checkedInCount: checkedIn.length, pendingCount: pending.length, pct };
  };

  const eventStats = computeStats(eventLeads);
  const myStats = computeStats(myLeads);

  // Recent check-ins from interactions (qr_scan type) — event-wide view
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
            <span className="text-xs text-gray-500">Live — updates every 30s</span>
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
            {/* ─── Event Progress (shared, event-wide) ─────────────────────── */}
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Event Progress</h2>
              <span className="text-xs text-gray-400">— everyone at this event</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Expected</p>
                <p className="text-3xl font-bold text-gray-900">{eventStats.totalExpected}</p>
                <p className="text-xs text-gray-400 mt-1">Accepted RSVPs</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Checked In</p>
                <p className="text-3xl font-bold text-green-600">{eventStats.checkedInCount}</p>
                <p className="text-xs text-gray-400 mt-1">Attended</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{eventStats.pendingCount}</p>
                <p className="text-xs text-gray-400 mt-1">Not yet arrived</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Check-In Progress</p>
                <p className="text-sm font-bold text-indigo-600">{eventStats.pct}%</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-indigo-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${eventStats.pct}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{eventStats.checkedInCount} of {eventStats.totalExpected} checked in</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-700">Expected — Not Yet Arrived</h2>
                </div>
                {eventStats.pending.length === 0 ? (
                  <p className="p-6 text-center text-gray-400 text-sm">All expected guests have arrived!</p>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {eventStats.pending.map(lead => (
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

            {/* ─── Team at this Event (admin/supervisor only) ──────────────── */}
            {canSeeTeam && teamAttendance.length > 0 && (() => {
              const expected = teamAttendance.filter(a => a.status === 'confirmed' || a.status === 'present');
              const present = teamAttendance.filter(a => a.status === 'present');
              const awaiting = teamAttendance.filter(a => a.status === 'confirmed');
              const invited = teamAttendance.filter(a => a.status === 'invited' || a.status === 'pending');
              const declined = teamAttendance.filter(a => a.status === 'declined');
              const teamPct = expected.length > 0 ? Math.round((present.length / expected.length) * 100) : 0;
              return (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wide">Team at this Event</h2>
                    <span className="text-xs text-gray-400">— staff working the event</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Expected</p>
                      <p className="text-3xl font-bold text-gray-900">{expected.length}</p>
                      <p className="text-xs text-gray-400 mt-1">Confirmed staff</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Present</p>
                      <p className="text-3xl font-bold text-indigo-600">{present.length}</p>
                      <p className="text-xs text-gray-400 mt-1">Scanned in</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Awaiting</p>
                      <p className="text-3xl font-bold text-amber-600">{awaiting.length}</p>
                      <p className="text-xs text-gray-400 mt-1">Confirmed, not yet in</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">No Reply</p>
                      <p className="text-3xl font-bold text-gray-500">{invited.length}</p>
                      <p className="text-xs text-gray-400 mt-1">Invited, pending RSVP</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700">Team Check-In Progress</p>
                      <p className="text-sm font-bold text-teal-600">{teamPct}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div className="bg-teal-600 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${teamPct}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{present.length} of {expected.length} confirmed staff checked in</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200 bg-indigo-50">
                        <h2 className="text-sm font-semibold text-indigo-700">Team — Present ({present.length})</h2>
                      </div>
                      {present.length === 0 ? (
                        <p className="p-6 text-center text-gray-400 text-sm">No team members have checked in yet</p>
                      ) : (
                        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                          {present.map(a => (
                            <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{a.user_full_name}</p>
                                <p className="text-xs text-gray-400">
                                  <span className="capitalize">{(a.user_role || '').replace('_', ' ')}</span>
                                  {a.user_organization_name && ` · ${a.user_organization_name}`}
                                </p>
                              </div>
                              <span className="text-xs text-gray-400">
                                {a.checkin_at ? new Date(a.checkin_at).toLocaleTimeString() : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200 bg-amber-50">
                        <h2 className="text-sm font-semibold text-amber-700">Team — Awaiting ({awaiting.length})</h2>
                      </div>
                      {awaiting.length === 0 ? (
                        <p className="p-6 text-center text-gray-400 text-sm">All confirmed staff have arrived!</p>
                      ) : (
                        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                          {awaiting.map(a => (
                            <div key={a.id} className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-800">{a.user_full_name}</p>
                              <p className="text-xs text-gray-400">
                                <span className="capitalize">{(a.user_role || '').replace('_', ' ')}</span>
                                {a.user_organization_name && ` · ${a.user_organization_name}`}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ─── My Leads at this Event (role-scoped) ────────────────────── */}
            {!isAdmin && (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide">My Leads at this Event</h2>
                  <span className="text-xs text-gray-400">— just the leads you own</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">My Expected</p>
                    <p className="text-3xl font-bold text-gray-900">{myStats.totalExpected}</p>
                    <p className="text-xs text-gray-400 mt-1">Accepted RSVPs</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">My Checked In</p>
                    <p className="text-3xl font-bold text-green-600">{myStats.checkedInCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Attended</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">My Pending</p>
                    <p className="text-3xl font-bold text-amber-600">{myStats.pendingCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Not yet arrived</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 bg-green-50">
                      <h2 className="text-sm font-semibold text-green-700">My Leads — Arrived</h2>
                    </div>
                    {myStats.checkedIn.length === 0 ? (
                      <p className="p-6 text-center text-gray-400 text-sm">None of your leads have arrived yet</p>
                    ) : (
                      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {myStats.checkedIn.map(lead => (
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

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 bg-amber-50">
                      <h2 className="text-sm font-semibold text-amber-700">My Leads — Not Yet Arrived</h2>
                    </div>
                    {myStats.pending.length === 0 ? (
                      <p className="p-6 text-center text-gray-400 text-sm">All your expected leads have arrived!</p>
                    ) : (
                      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {myStats.pending.map(lead => (
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
          </>
        )}
      </div>
    </AppShell>
  );
}
