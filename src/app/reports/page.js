'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function ReportsPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [custRes, intRes] = await Promise.all([
        fetch('/api/leads', { headers }),
        fetch('/api/interactions', { headers }),
      ]);
      if (custRes.ok) setCustomers((await custRes.json()).customers || []);
      if (intRes.ok) setInteractions((await intRes.json()).interactions || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const filtered = customers.filter(c => filter === 'all' || c.status === filter);

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortBy] || '';
    const bVal = b[sortBy] || '';
    return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  // Stats by organization
  const orgStats = {};
  customers.forEach(c => {
    const org = c.organization_name || 'Unknown';
    if (!orgStats[org]) orgStats[org] = { total: 0, invited: 0, attended: 0, interactions: 0 };
    orgStats[org].total++;
    if (['invited', 'accepted'].includes(c.status)) orgStats[org].invited++;
    if (c.status === 'attended') orgStats[org].attended++;
  });
  interactions.forEach(i => {
    const customer = customers.find(c => c.id === i.customer_id);
    const org = customer?.organization_name || 'Unknown';
    if (orgStats[org]) orgStats[org].interactions++;
  });

  const statusColors = {
    possible: 'bg-blue-100 text-blue-700',
    invited: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    attended: 'bg-purple-100 text-purple-700',
  };

  if (user?.role !== 'admin') {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin access required</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

        {/* Org Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(orgStats).map(([org, stats]) => (
            <div key={org} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-2">{org}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Leads:</span> <span className="font-medium">{stats.total}</span></div>
                <div><span className="text-gray-500">Invited:</span> <span className="font-medium">{stats.invited}</span></div>
                <div><span className="text-gray-500">Attended:</span> <span className="font-medium">{stats.attended}</span></div>
                <div><span className="text-gray-500">Interactions:</span> <span className="font-medium">{stats.interactions}</span></div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {['all', 'possible', 'invited', 'accepted', 'declined', 'attended'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? customers.length : customers.filter(c => c.status === f).length})
            </button>
          ))}
        </div>

        {/* Master Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    { key: 'full_name', label: 'Name' },
                    { key: 'company_name', label: 'Org' },
                    { key: 'email', label: 'Email' },
                    { key: 'status', label: 'Status' },
                    { key: 'organization_name', label: 'Sales Org' },
                    { key: 'created_at', label: 'Added' },
                  ].map(col => (
                    <th key={col.key} onClick={() => toggleSort(col.key)}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700">
                      {col.label} {sortBy === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
                ) : sorted.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.company_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[c.status] || 'bg-gray-100'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.organization_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
