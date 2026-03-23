'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';
import FileImportWizard from '@/components/FileImportWizard';

const SOURCE_OPTIONS = ['Manual', 'File Import', 'Referral', 'Website', 'Social Media', 'Trade Show', 'Other'];

export default function LeadsPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState({ full_name: '', title: '', company_name: '', email: '', phone: '', alt_email: '', assigned_rep_id: '', notes: '', source: 'Manual' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [expandedNotes, setExpandedNotes] = useState({});

  // Bulk action state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkRepId, setBulkRepId] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Duplicates state
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState({ exact: [], possible: [] });
  const [dupLoading, setDupLoading] = useState(false);
  const [mergeSelections, setMergeSelections] = useState({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchLeads(); fetchUsers(); }, []);

  const fetchLeads = async () => {
    try {
      const event = JSON.parse(localStorage.getItem('cm_event') || 'null');
      const url = event ? `/api/leads?event_id=${event.id}` : '/api/leads';
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/settings/users', { headers });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const event = JSON.parse(localStorage.getItem('cm_event') || 'null');

    // Build assigned rep display fields from selected user
    const repUser = allUsers.find(u => u.id === form.assigned_rep_id);
    const submitData = {
      ...form,
      assigned_rep_name: repUser ? repUser.full_name : '',
      assigned_rep_org: repUser ? repUser.organization_name : '',
    };

    if (editingLead) {
      const res = await fetch('/api/leads', {
        method: 'PUT', headers, body: JSON.stringify({ id: editingLead.id, ...submitData }),
      });
      if (res.ok) { resetForm(); fetchLeads(); }
    } else {
      const body = { ...submitData };
      if (event) body.event_id = event.id;
      const res = await fetch('/api/leads', { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) { resetForm(); fetchLeads(); }
    }
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setForm({
      full_name: lead.full_name, title: lead.title, company_name: lead.company_name,
      email: lead.email, phone: lead.phone, alt_email: lead.alt_email,
      assigned_rep_id: lead.assigned_rep_id || '',
      notes: lead.notes || '',
      source: lead.source || 'Manual',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await fetch('/api/leads', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    fetchLeads();
  };

  const resetForm = () => {
    setForm({ full_name: '', title: '', company_name: '', email: '', phone: '', alt_email: '', assigned_rep_id: '', notes: '', source: 'Manual' });
    setEditingLead(null);
    setShowForm(false);
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const toggleNotes = (id) => setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = customers.filter(c =>
    !search || [c.full_name, c.company_name, c.email, c.input_by, c.assigned_rep_name, c.source].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const event = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cm_event') || 'null') : null;

  const sourceLabel = (s) => {
    if (!s) return '-';
    return s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Bulk selection helpers
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const bulkChangeStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkProcessing(true);
    for (const id of selectedIds) {
      await fetch('/api/leads', {
        method: 'PUT', headers, body: JSON.stringify({ id, status: bulkStatus }),
      });
    }
    setBulkStatus('');
    setSelectedIds(new Set());
    setBulkProcessing(false);
    fetchLeads();
  };

  const bulkAssignRep = async () => {
    if (!bulkRepId || selectedIds.size === 0) return;
    setBulkProcessing(true);
    const repUser = allUsers.find(u => u.id === bulkRepId);
    for (const id of selectedIds) {
      await fetch('/api/leads', {
        method: 'PUT', headers, body: JSON.stringify({
          id,
          assigned_rep_id: bulkRepId,
          assigned_rep_name: repUser?.full_name || '',
          assigned_rep_org: repUser?.organization_name || '',
        }),
      });
    }
    setBulkRepId('');
    setSelectedIds(new Set());
    setBulkProcessing(false);
    fetchLeads();
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected lead(s)?`)) return;
    setBulkProcessing(true);
    for (const id of selectedIds) {
      await fetch('/api/leads', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    }
    setSelectedIds(new Set());
    setBulkProcessing(false);
    fetchLeads();
  };

  // Duplicates helpers
  const fetchDuplicates = async () => {
    setDupLoading(true);
    try {
      const res = await fetch('/api/leads/duplicates', { headers });
      if (res.ok) {
        const data = await res.json();
        setDuplicates(data);
        const selections = {};
        [...(data.exact || []), ...(data.possible || [])].forEach((group, i) => {
          if (group.length > 0) selections[i] = group[0].id;
        });
        setMergeSelections(selections);
      }
    } catch (err) { console.error(err); }
    setDupLoading(false);
    setShowDuplicates(true);
  };

  const handleMerge = async (groupIndex, group) => {
    const keepId = mergeSelections[groupIndex];
    if (!keepId) return;
    const mergeIds = group.filter(c => c.id !== keepId).map(c => c.id);
    if (mergeIds.length === 0) return;
    if (!confirm(`Merge ${mergeIds.length} duplicate(s) into the selected lead?`)) return;

    const res = await fetch('/api/leads/duplicates', {
      method: 'POST', headers, body: JSON.stringify({ keep_id: keepId, merge_ids: mergeIds }),
    });
    if (res.ok) {
      fetchDuplicates();
      fetchLeads();
    }
  };

  const allGroups = [...(duplicates.exact || []), ...(duplicates.possible || [])];
  const exactCount = (duplicates.exact || []).length;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            {event && <p className="text-sm text-gray-500">Event: {event.name}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {(user?.role === 'admin' || user?.role === 'supervisor') && (
              <button
                onClick={fetchDuplicates}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
              >
                Find Duplicates
              </button>
            )}
            <button
              onClick={() => setShowImportWizard(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
            >
              Import from File
            </button>
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              {showForm ? 'Cancel' : 'Add Lead'}
            </button>
          </div>
        </div>

        {!event && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
            No event selected. Leads will show across all events. Select an event from the Dashboard to filter.
          </div>
        )}

        {/* Duplicates Section */}
        {showDuplicates && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Duplicate Leads</h2>
              <button onClick={() => setShowDuplicates(false)} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
            </div>
            {dupLoading ? (
              <p className="text-center text-gray-400 py-4">Scanning for duplicates...</p>
            ) : allGroups.length === 0 ? (
              <p className="text-center text-gray-400 py-4">No duplicates found.</p>
            ) : (
              <div className="space-y-6">
                {allGroups.map((group, groupIdx) => (
                  <div key={groupIdx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        groupIdx < exactCount ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {groupIdx < exactCount ? 'Exact Match (Email)' : 'Possible Match (Name + Company)'}
                      </span>
                      <button
                        onClick={() => handleMerge(groupIdx, group)}
                        className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                      >
                        Merge Selected
                      </button>
                    </div>
                    <div className="space-y-2">
                      {group.map(c => (
                        <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                          mergeSelections[groupIdx] === c.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 hover:bg-gray-50'
                        }`}>
                          <input
                            type="radio"
                            name={`dup-group-${groupIdx}`}
                            checked={mergeSelections[groupIdx] === c.id}
                            onChange={() => setMergeSelections({ ...mergeSelections, [groupIdx]: c.id })}
                            className="text-indigo-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                            <p className="text-xs text-gray-500">{c.email} {c.company_name ? `- ${c.company_name}` : ''}</p>
                          </div>
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                            { possible: 'bg-blue-100 text-blue-700', invited: 'bg-amber-100 text-amber-700',
                              accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700',
                              attended: 'bg-purple-100 text-purple-700' }[c.status] || 'bg-gray-100 text-gray-600'
                          }`}>
                            {c.status}
                          </span>
                          {mergeSelections[groupIdx] === c.id && (
                            <span className="text-xs font-medium text-indigo-600">KEEP</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={form.full_name} onChange={set('full_name')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={set('title')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                <input type="text" value={form.company_name} onChange={set('company_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={set('email')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alt Email</label>
                <input type="email" value={form.alt_email} onChange={set('alt_email')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Rep</label>
                <select value={form.assigned_rep_id} onChange={set('assigned_rep_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="">-- Select Rep --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.organization_name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select value={form.source} onChange={set('source')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                  {SOURCE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2}
                  placeholder="Internal notes about this lead..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                  {editingLead ? 'Update' : 'Add'} Lead
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-indigo-700">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2">
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-lg text-xs">
                <option value="">Change Status...</option>
                {['possible', 'invited', 'accepted', 'declined', 'attended'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {bulkStatus && (
                <button onClick={bulkChangeStatus} disabled={bulkProcessing}
                  className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  Apply
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select value={bulkRepId} onChange={(e) => setBulkRepId(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-lg text-xs">
                <option value="">Assign Rep...</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
              {bulkRepId && (
                <button onClick={bulkAssignRep} disabled={bulkProcessing}
                  className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  Apply
                </button>
              )}
            </div>
            <button onClick={bulkDelete} disabled={bulkProcessing}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50">
              Delete Selected
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300 ml-auto">
              Deselect All
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Input By</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Assigned Rep</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">No leads yet. Click &quot;Add Lead&quot; to get started.</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 ${selectedIds.has(c.id) ? 'bg-indigo-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-800">{c.full_name}</div>
                      {c.notes && (
                        <button onClick={() => toggleNotes(c.id)} className="text-xs text-indigo-500 hover:text-indigo-700 mt-0.5">
                          {expandedNotes[c.id] ? 'Hide notes' : 'Show notes'}
                        </button>
                      )}
                      {expandedNotes[c.id] && c.notes && (
                        <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded">{c.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.company_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        { possible: 'bg-blue-100 text-blue-700', invited: 'bg-amber-100 text-amber-700',
                          accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700',
                          attended: 'bg-purple-100 text-purple-700' }[c.status] || 'bg-gray-100 text-gray-600'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-bold ${
                        c.lead_score_label === 'hot' ? 'bg-red-100 text-red-700' :
                        c.lead_score_label === 'warm' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {c.lead_score || 0} {c.lead_score_label || 'cold'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{sourceLabel(c.source)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div>{c.input_by || c.added_by_name || '-'}</div>
                      {c.input_by_org && <div className="text-gray-400">{c.input_by_org}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div>{c.assigned_rep_name || '-'}</div>
                      {c.assigned_rep_org && <div className="text-gray-400">{c.assigned_rep_org}</div>}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => handleEdit(c)} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {loading ? (
              <p className="p-6 text-center text-gray-400">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-gray-400">No leads yet. Click &quot;Add Lead&quot; to get started.</p>
            ) : (
              <>
                <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-500">Select All</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {filtered.map(c => (
                    <div key={c.id} className={`p-4 space-y-2 ${selectedIds.has(c.id) ? 'bg-indigo-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.full_name}</p>
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                              { possible: 'bg-blue-100 text-blue-700', invited: 'bg-amber-100 text-amber-700',
                                accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700',
                                attended: 'bg-purple-100 text-purple-700' }[c.status] || 'bg-gray-100 text-gray-600'
                            }`}>
                              {c.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      {(c.title || c.company_name) && (
                        <p className="text-xs text-gray-500 truncate ml-7">
                          {c.title}{c.title && c.company_name ? ' · ' : ''}{c.company_name}
                        </p>
                      )}
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs ml-7">
                        {c.email && <div className="col-span-2"><dt className="text-gray-400 inline">Email:</dt> <dd className="text-gray-700 inline truncate">{c.email}</dd></div>}
                        {c.phone && <div><dt className="text-gray-400 inline">Phone:</dt> <dd className="text-gray-700 inline">{c.phone}</dd></div>}
                        <div><dt className="text-gray-400 inline">Score:</dt> <dd className="inline"><span className={`inline-block px-2 py-0.5 text-xs rounded-full font-bold ${c.lead_score_label === 'hot' ? 'bg-red-100 text-red-700' : c.lead_score_label === 'warm' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{c.lead_score || 0} {c.lead_score_label || 'cold'}</span></dd></div>
                        <div><dt className="text-gray-400 inline">Source:</dt> <dd className="text-gray-700 inline">{sourceLabel(c.source)}</dd></div>
                        <div><dt className="text-gray-400 inline">Input By:</dt> <dd className="text-gray-700 inline">{c.input_by || c.added_by_name || '-'}</dd></div>
                        <div><dt className="text-gray-400 inline">Rep:</dt> <dd className="text-gray-700 inline">{c.assigned_rep_name || '-'}</dd></div>
                      </dl>
                      {c.notes && (
                        <div className="ml-7">
                          <button onClick={() => toggleNotes(c.id)} className="text-xs text-indigo-500 hover:text-indigo-700">
                            {expandedNotes[c.id] ? 'Hide notes' : 'Show notes'}
                          </button>
                          {expandedNotes[c.id] && (
                            <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded">{c.notes}</p>
                          )}
                        </div>
                      )}
                      <div className="flex gap-4 pt-1 ml-7">
                        <button onClick={() => handleEdit(c)} className="text-xs text-indigo-600 font-medium">Edit</button>
                        <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 font-medium">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <FileImportWizard
          isOpen={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onImport={fetchLeads}
        />
      </div>
    </AppShell>
  );
}
