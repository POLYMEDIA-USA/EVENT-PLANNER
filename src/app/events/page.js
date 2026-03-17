'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ name: '', event_date: '', event_time: '', location: '', description: '' });
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events', { headers });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingEvent ? 'PUT' : 'POST';
    const body = editingEvent ? { id: editingEvent.id, ...form } : form;

    const res = await fetch('/api/events', { method, headers, body: JSON.stringify(body) });
    if (res.ok) {
      resetForm();
      fetchEvents();
    }
  };

  const handleEdit = (ev) => {
    setEditingEvent(ev);
    setForm({ name: ev.name, event_date: ev.event_date, event_time: ev.event_time, location: ev.location, description: ev.description || '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return;
    await fetch('/api/events', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    fetchEvents();
  };

  const resetForm = () => {
    setForm({ name: '', event_date: '', event_time: '', location: '', description: '' });
    setEditingEvent(null);
    setShowForm(false);
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const isAdmin = user?.role === 'admin';

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              {showForm ? 'Cancel' : 'New Event'}
            </button>
          )}
        </div>

        {showForm && isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{editingEvent ? 'Edit Event' : 'Create Event'}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                <input type="text" value={form.name} onChange={set('name')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={form.location} onChange={set('location')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={form.event_date} onChange={set('event_date')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input type="time" value={form.event_time} onChange={set('event_time')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={set('description')} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                  {editingEvent ? 'Update' : 'Create'} Event
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Event</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  {isAdmin && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : events.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No events yet</td></tr>
                ) : events.map(ev => (
                  <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{ev.name}</p>
                      {ev.description && <p className="text-xs text-gray-400">{ev.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ev.event_date}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ev.event_time}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ev.location}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        ev.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {ev.status || 'active'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => handleEdit(ev)} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                        <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {loading ? (
              <p className="p-6 text-center text-gray-400">Loading...</p>
            ) : events.length === 0 ? (
              <p className="p-6 text-center text-gray-400">No events yet</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {events.map(ev => (
                  <div key={ev.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900 truncate flex-1 mr-2">{ev.name}</p>
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ${
                        ev.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {ev.status || 'active'}
                      </span>
                    </div>
                    {ev.description && <p className="text-xs text-gray-400">{ev.description}</p>}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div><dt className="text-gray-400 inline">Date:</dt> <dd className="text-gray-700 inline">{ev.event_date}</dd></div>
                      <div><dt className="text-gray-400 inline">Time:</dt> <dd className="text-gray-700 inline">{ev.event_time}</dd></div>
                      {ev.location && <div className="col-span-2"><dt className="text-gray-400 inline">Location:</dt> <dd className="text-gray-700 inline">{ev.location}</dd></div>}
                    </dl>
                    {isAdmin && (
                      <div className="flex gap-4 pt-1">
                        <button onClick={() => handleEdit(ev)} className="text-xs text-indigo-600 font-medium">Edit</button>
                        <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-500 font-medium">Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
