'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ events: 0, leads: 0, invited: 0, attended: 0, pipeline: null, scoreDistribution: null });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myLeadsCount, setMyLeadsCount] = useState(0);
  const [taskSummary, setTaskSummary] = useState({ pending: 0, overdue: 0 });
  const [recentInteractions, setRecentInteractions] = useState([]);
  const [teamActivity, setTeamActivity] = useState([]);
  const [teamTaskCount, setTeamTaskCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  const role = user?.role;

  useEffect(() => {
    // Restore selected event from localStorage
    const saved = localStorage.getItem('cm_event');
    if (saved) setSelectedEvent(JSON.parse(saved));
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('cm_token');
    const authHeaders = { Authorization: `Bearer ${token}` };

    try {
      const fetches = [
        fetch('/api/events', { headers: authHeaders }),
        fetch('/api/reports/stats', { headers: authHeaders }),
      ];

      // Sales reps & supervisors: fetch tasks
      if (role === 'sales_rep' || role === 'supervisor') {
        fetches.push(fetch('/api/tasks', { headers: authHeaders }));
      }

      // Sales reps: fetch interactions and leads
      if (role === 'sales_rep') {
        fetches.push(fetch('/api/interactions', { headers: authHeaders }));
        fetches.push(fetch('/api/leads', { headers: authHeaders }));
      }

      // Supervisors: fetch interactions for team activity
      if (role === 'supervisor') {
        fetches.push(fetch('/api/interactions', { headers: authHeaders }));
      }

      // Admins: fetch users for system health + tasks
      if (role === 'admin') {
        fetches.push(fetch('/api/settings/users', { headers: authHeaders }));
        fetches.push(fetch('/api/tasks', { headers: authHeaders }));
      }

      const results = await Promise.all(fetches);

      // Events (index 0)
      if (results[0].ok) {
        const evData = await results[0].json();
        const evList = evData.events || [];
        setEvents(evList);

        // Auto-select if only one event and none currently selected
        const saved = localStorage.getItem('cm_event');
        if (!saved && evList.length === 1) {
          setSelectedEvent(evList[0]);
          localStorage.setItem('cm_event', JSON.stringify(evList[0]));
        }
      }

      // Stats (index 1)
      if (results[1].ok) {
        const stData = await results[1].json();
        setStats(stData);
      }

      let fetchIdx = 2;

      if (role === 'sales_rep') {
        // Tasks (index 2)
        if (results[fetchIdx]?.ok) {
          const taskData = await results[fetchIdx].json();
          const tasks = taskData.tasks || [];
          const myTasks = tasks.filter(t => t.assigned_to === user?.id);
          const now = new Date();
          const pending = myTasks.filter(t => t.status !== 'completed' && t.status !== 'done').length;
          const overdue = myTasks.filter(t => t.status !== 'completed' && t.status !== 'done' && t.due_date && new Date(t.due_date) < now).length;
          setTaskSummary({ pending, overdue });
        }
        fetchIdx++;

        // Interactions (index 3)
        if (results[fetchIdx]?.ok) {
          const intData = await results[fetchIdx].json();
          const interactions = intData.interactions || [];
          const mine = interactions
            .filter(i => i.user_id === user?.id || i.added_by_user_id === user?.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
          setRecentInteractions(mine);
        }
        fetchIdx++;

        // Leads (index 4)
        if (results[fetchIdx]?.ok) {
          const leadData = await results[fetchIdx].json();
          setMyLeadsCount((leadData.customers || []).length);
        }
        fetchIdx++;
      }

      if (role === 'supervisor') {
        // Tasks (index 2)
        if (results[fetchIdx]?.ok) {
          const taskData = await results[fetchIdx].json();
          const tasks = taskData.tasks || [];
          const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'done').length;
          setTeamTaskCount(pending);
        }
        fetchIdx++;

        // Interactions (index 3)
        if (results[fetchIdx]?.ok) {
          const intData = await results[fetchIdx].json();
          const interactions = intData.interactions || [];
          // Build team activity: group by user, find most recent
          const byUser = {};
          interactions.forEach(i => {
            const name = i.added_by_name || i.user_name || 'Unknown';
            if (!byUser[name] || new Date(i.created_at) > new Date(byUser[name].created_at)) {
              byUser[name] = i;
            }
          });
          const activity = Object.entries(byUser)
            .map(([name, i]) => ({ name, last_activity: i.created_at, type: i.type || i.interaction_type || 'interaction' }))
            .sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity))
            .slice(0, 10);
          setTeamActivity(activity);
        }
        fetchIdx++;
      }

      if (role === 'admin') {
        // Users (index 2)
        if (results[fetchIdx]?.ok) {
          const userData = await results[fetchIdx].json();
          setTotalUsers((userData.users || []).length);
        }
        fetchIdx++;

        // Tasks (index 3)
        if (results[fetchIdx]?.ok) {
          const taskData = await results[fetchIdx].json();
          const tasks = taskData.tasks || [];
          const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'done').length;
          setTeamTaskCount(pending);
        }
        fetchIdx++;
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
        {selectedEvent ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full shrink-0"></span>
              <div>
                <p className="text-sm font-semibold text-indigo-600">{selectedEvent.name}</p>
                <p className="text-xs text-gray-500">
                  {selectedEvent.event_date} at {selectedEvent.event_time} — {selectedEvent.location}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedEvent(null); localStorage.removeItem('cm_event'); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Change Event
            </button>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-6">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 mb-3">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-indigo-800">Select an Event to Get Started</h2>
              <p className="text-sm text-indigo-600 mt-1">
                Choose an event below to filter leads, invitations, and check-ins.
              </p>
            </div>
            {events.length === 0 ? (
              <p className="text-center text-sm text-gray-500">
                {user?.role === 'admin' ? 'No events yet. Create one in the Events tab.' : 'No active events available.'}
              </p>
            ) : (
              <div className="grid gap-2 max-w-lg mx-auto">
                {events.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => selectEvent(ev)}
                    className="text-left p-4 bg-white border-2 border-indigo-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800 group-hover:text-indigo-600">{ev.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ev.event_date} at {ev.event_time} — {ev.location}</p>
                      </div>
                      <span className="text-indigo-400 group-hover:text-indigo-600 text-lg">→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Active Events', value: stats.events, color: 'indigo' },
            { label: 'Total Leads', value: stats.leads, color: 'blue' },
            { label: 'Invited', value: stats.invited, color: 'amber' },
            { label: 'Accepted', value: stats.pipeline?.accepted || 0, color: 'green' },
            { label: 'Attended', value: stats.attended, color: 'purple' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-3xl font-bold text-${s.color}-600 mt-1`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Pipeline Funnel — visible to all roles (server-scoped by org) */}
        {stats.pipeline && stats.pipeline.total > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {role === 'sales_rep' || role === 'supervisor' ? 'Event Overview' : 'Sales Pipeline'}
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Possible', count: stats.pipeline.possible, color: 'bg-blue-500' },
                { label: 'Approved to Invite', count: stats.pipeline.approved || 0, color: 'bg-teal-500' },
                { label: 'Invited', count: stats.pipeline.invited, color: 'bg-amber-500' },
                { label: 'Accepted', count: stats.pipeline.accepted, color: 'bg-green-500' },
                { label: 'Declined', count: stats.pipeline.declined, color: 'bg-red-400' },
                { label: 'Attended', count: stats.pipeline.attended, color: 'bg-purple-500' },
              ].map((stage, i, arr) => {
                const pct = stats.pipeline.total > 0 ? Math.round((stage.count / stats.pipeline.total) * 100) : 0;
                const prev = i > 0 && i !== 3 ? arr[i - 1].count : null;
                const convRate = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
                return (
                  <div key={stage.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{stage.label}</span>
                      <span className="text-gray-500">
                        {stage.count} ({pct}%)
                        {convRate !== null && <span className="ml-2 text-xs text-gray-400">({convRate}% from prev)</span>}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-5">
                      <div className={`${stage.color} h-5 rounded-full transition-all`} style={{ width: `${Math.max(pct, 1)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sales Rep: My Leads, My Tasks, Recent Interactions */}
        {role === 'sales_rep' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">My Leads</h2>
                <p className="text-3xl font-bold text-blue-600">{myLeadsCount}</p>
                <p className="text-xs text-gray-400 mt-1">Leads in your organization</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">My Tasks</h2>
                <p className="text-3xl font-bold text-indigo-600">{taskSummary.pending}</p>
                <p className="text-xs text-gray-400 mt-1">Pending tasks</p>
                {taskSummary.overdue > 0 && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{taskSummary.overdue} overdue</p>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">My Recent Interactions</h2>
                {recentInteractions.length === 0 ? (
                  <p className="text-sm text-gray-400">No recent interactions</p>
                ) : (
                  <div className="space-y-2">
                    {recentInteractions.map((i, idx) => (
                      <div key={i.id || idx} className="text-xs">
                        <p className="text-gray-700 font-medium truncate">{i.customer_name || i.contact_name || 'Unknown'}</p>
                        <p className="text-gray-400">{i.type || i.interaction_type || 'Note'} — {new Date(i.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Supervisor: Pipeline Funnel + Team Activity + Team Tasks */}
        {role === 'supervisor' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Team Pending Tasks</h2>
                <p className="text-3xl font-bold text-amber-600">{teamTaskCount}</p>
                <p className="text-xs text-gray-400 mt-1">Tasks across team</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Team Activity</h2>
                {teamActivity.length === 0 ? (
                  <p className="text-sm text-gray-400">No recent team activity</p>
                ) : (
                  <div className="space-y-2">
                    {teamActivity.map((a, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 font-medium">{a.name}</span>
                        <span className="text-gray-400">{new Date(a.last_activity).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </>
        )}

        {/* Admin: Everything — Pipeline, Scores, System Health */}
        {role === 'admin' && (
          <>
            {/* System Health */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Total Users</h2>
                <p className="text-3xl font-bold text-indigo-600">{totalUsers}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Total Events</h2>
                <p className="text-3xl font-bold text-blue-600">{events.length}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Pending Tasks</h2>
                <p className="text-3xl font-bold text-amber-600">{teamTaskCount}</p>
                <p className="text-xs text-gray-400 mt-1">Across all users</p>
              </div>
            </div>

            {/* Score Distribution — admin */}
            {stats.scoreDistribution && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Lead Temperature</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{stats.scoreDistribution.hot}</p>
                    <p className="text-sm text-red-500 font-medium">Hot</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{stats.scoreDistribution.warm}</p>
                    <p className="text-sm text-amber-500 font-medium">Warm</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{stats.scoreDistribution.cold}</p>
                    <p className="text-sm text-blue-500 font-medium">Cold</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
