'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function ReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview'); // 'overview', 'emails'
  const [customers, setCustomers] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailHtml, setEmailHtml] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const previewRef = useRef(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [custRes, intRes, emailRes] = await Promise.all([
        fetch('/api/leads', { headers }),
        fetch('/api/interactions', { headers }),
        fetch('/api/email/log', { headers }),
      ]);
      if (custRes.ok) setCustomers((await custRes.json()).customers || []);
      if (intRes.ok) setInteractions((await intRes.json()).interactions || []);
      if (emailRes.ok) setEmails((await emailRes.json()).emails || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const viewEmail = async (emailId) => {
    const res = await fetch(`/api/email/log?email_id=${emailId}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setSelectedEmail(data.email);
      setEmailHtml(data.email.html_body);
    }
  };

  const printEmail = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>${selectedEmail.subject}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 24px; }
        .meta { color: #6B7280; font-size: 13px; margin: 4px 0; }
        .content { margin-top: 24px; }
        @media print { body { margin: 20px; } }
      </style></head><body>
        <div class="header">
          <h2 style="color:#4F46E5;margin:0;">${selectedEmail.subject}</h2>
          <p class="meta"><strong>From:</strong> ${selectedEmail.from}</p>
          <p class="meta"><strong>To:</strong> ${selectedEmail.to}</p>
          <p class="meta"><strong>Date:</strong> ${new Date(selectedEmail.created_at).toLocaleString()}</p>
          <p class="meta"><strong>Type:</strong> ${selectedEmail.type} (${selectedEmail.direction})</p>
        </div>
        <div class="content">${selectedEmail.html_body}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const filtered = customers.filter(c => filter === 'all' || c.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortBy] || '';
    const bVal = b[sortBy] || '';
    return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });
  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
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

  const filteredEmails = emails.filter(e =>
    !emailFilter || [e.to, e.customer_name, e.subject, e.type].some(f => f?.toLowerCase().includes(emailFilter.toLowerCase()))
  );

  const statusColors = {
    possible: 'bg-blue-100 text-blue-700', invited: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700',
    attended: 'bg-purple-100 text-purple-700',
  };

  if (user?.role !== 'admin') {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin access required</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <div className="flex gap-2">
            <button onClick={() => { setTab('overview'); setSelectedEmail(null); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              Overview
            </button>
            <button onClick={() => { setTab('emails'); setSelectedEmail(null); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'emails' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              Email Log ({emails.length})
            </button>
          </div>
        </div>

        {tab === 'overview' && (
          <>
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
                        { key: 'full_name', label: 'Name' }, { key: 'company_name', label: 'Org' },
                        { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' },
                        { key: 'organization_name', label: 'Sales Org' }, { key: 'created_at', label: 'Added' },
                      ].map(col => (
                        <th key={col.key} onClick={() => toggleSort(col.key)}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700">
                          {col.label} {sortBy === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                        </th>
                      ))}
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Emails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                    ) : sorted.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
                    ) : sorted.map(c => {
                      const emailCount = emails.filter(e => e.customer_id === c.id).length;
                      return (
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
                          <td className="px-4 py-3 text-right">
                            {emailCount > 0 ? (
                              <button onClick={() => { setTab('emails'); setEmailFilter(c.email); }}
                                className="text-xs text-indigo-600 hover:text-indigo-800">
                                {emailCount} email{emailCount !== 1 ? 's' : ''}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'emails' && !selectedEmail && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <input
                type="text" placeholder="Search emails by recipient, name, subject..."
                value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
              {emailFilter && (
                <button onClick={() => setEmailFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">Clear</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Direction</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">To/From</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lead</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmails.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No emails logged yet</td></tr>
                  ) : filteredEmails.map(e => (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                          e.direction === 'outbound' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {e.direction === 'outbound' ? 'Sent' : 'Received'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.direction === 'outbound' ? e.to : e.from}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{e.customer_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{e.subject}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{e.type}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => viewEmail(e.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'emails' && selectedEmail && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Email header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <button onClick={() => setSelectedEmail(null)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                ← Back to email list
              </button>
              <button onClick={printEmail}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                Print / Save as PDF
              </button>
            </div>

            {/* Email metadata */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{selectedEmail.subject}</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">From:</span> <span className="text-gray-800">{selectedEmail.from}</span></div>
                <div><span className="text-gray-500">To:</span> <span className="text-gray-800">{selectedEmail.to}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="text-gray-800">{new Date(selectedEmail.created_at).toLocaleString()}</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="text-gray-800">{selectedEmail.type} ({selectedEmail.direction})</span></div>
                <div><span className="text-gray-500">Lead:</span> <span className="text-gray-800">{selectedEmail.customer_name}</span></div>
                <div><span className="text-gray-500">Event:</span> <span className="text-gray-800">{selectedEmail.event_name}</span></div>
                {selectedEmail.sent_by && <div><span className="text-gray-500">Sent by:</span> <span className="text-gray-800">{selectedEmail.sent_by}</span></div>}
              </div>
            </div>

            {/* Email body rendered as PDF-like preview */}
            <div className="p-6">
              <div
                ref={previewRef}
                className="mx-auto bg-white border border-gray-300 shadow-md rounded-lg p-8"
                style={{ maxWidth: '650px', minHeight: '400px' }}
              >
                <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
