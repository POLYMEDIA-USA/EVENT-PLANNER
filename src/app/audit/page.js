'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function AuditPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [search, setSearch] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchAuditLog(); }, []);

  const fetchAuditLog = async () => {
    try {
      const res = await fetch('/api/audit?limit=500', { headers });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const uniqueActions = [...new Set(entries.map(e => e.action))].sort();
  const uniqueUsers = [...new Set(entries.map(e => e.user_name).filter(Boolean))].sort();

  const filtered = entries.filter(e => {
    if (filterAction && e.action !== filterAction) return false;
    if (filterUser && e.user_name !== filterUser) return false;
    if (search) {
      const s = search.toLowerCase();
      return [e.action, e.user_name, e.entity_type, e.entity_id, e.details]
        .some(f => f?.toLowerCase().includes(s));
    }
    return true;
  });

  if (user?.role !== 'admin') {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin access required</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-gray-500 text-sm">Track all system changes</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Search audit log..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Actions</option>
              {uniqueActions.map(a => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Users</option>
              {uniqueUsers.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400 mt-2">{filtered.length} entries</p>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entity Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entity ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit entries found</td></tr>
                ) : filtered.map(e => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{e.user_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        e.action.includes('created') ? 'bg-green-100 text-green-700' :
                        e.action.includes('updated') ? 'bg-blue-100 text-blue-700' :
                        e.action.includes('deleted') ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {e.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{e.entity_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[120px]">{e.entity_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[300px]">{e.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <p className="p-6 text-center text-gray-400">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-gray-400">No audit entries found</p>
          ) : filtered.map(e => (
            <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                  e.action.includes('created') ? 'bg-green-100 text-green-700' :
                  e.action.includes('updated') ? 'bg-blue-100 text-blue-700' :
                  e.action.includes('deleted') ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {e.action.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><dt className="text-gray-400 inline">User:</dt> <dd className="text-gray-700 inline">{e.user_name}</dd></div>
                <div><dt className="text-gray-400 inline">Type:</dt> <dd className="text-gray-700 inline capitalize">{e.entity_type}</dd></div>
                <div className="col-span-2"><dt className="text-gray-400 inline">ID:</dt> <dd className="text-gray-700 inline font-mono truncate">{e.entity_id}</dd></div>
                {e.details && <div className="col-span-2"><dt className="text-gray-400 inline">Details:</dt> <dd className="text-gray-700 inline">{e.details}</dd></div>}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
