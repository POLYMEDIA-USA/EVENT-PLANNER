'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

const EMAIL_TYPES = [
  { value: 'invitation', label: 'Invitation', desc: 'Initial invite with RSVP buttons' },
  { value: 'reminder', label: 'Reminder', desc: 'Follow-up for those who haven\'t responded' },
  { value: 'confirmation', label: 'Confirmation', desc: 'Confirm attendance with QR code' },
  { value: 'event_update', label: 'Event Update', desc: 'Share updated event details' },
  { value: 'custom', label: 'Custom Message', desc: 'Write a custom email' },
];

export default function InvitedPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [invited, setInvited] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [tab, setTab] = useState('invited'); // 'promote', 'invited'
  const [emailType, setEmailType] = useState('invitation');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, invitedRes, emailRes] = await Promise.all([
        fetch('/api/leads', { headers }),
        fetch('/api/invited', { headers }),
        fetch('/api/email/log', { headers }),
      ]);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads((data.customers || []).filter(c => c.status === 'possible'));
      }
      if (invitedRes.ok) {
        const data = await invitedRes.json();
        setInvited(data.customers || []);
      }
      if (emailRes.ok) {
        const data = await emailRes.json();
        setEmailLogs(data.emails || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  // Get email history for a customer
  const getEmailHistory = (customerId) => {
    return emailLogs.filter(e => e.customer_id === customerId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  // Get email types sent to a customer
  const getEmailTypesSent = (customerId) => {
    const logs = emailLogs.filter(e => e.customer_id === customerId && e.status === 'sent');
    const types = {};
    logs.forEach(e => {
      if (!types[e.type] || new Date(e.created_at) > new Date(types[e.type])) {
        types[e.type] = e.created_at;
      }
    });
    return types;
  };

  // Check how many selected invitees already received this email type
  const getAlreadySentCount = () => {
    let count = 0;
    selected.forEach(id => {
      const types = getEmailTypesSent(id);
      if (types[emailType]) count++;
    });
    return count;
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (tab === 'promote') {
      setSelected(selected.size === leads.length ? new Set() : new Set(leads.map(l => l.id)));
    } else {
      setSelected(selected.size === invited.length ? new Set() : new Set(invited.map(c => c.id)));
    }
  };

  const selectByStatus = (status) => {
    const matching = invited.filter(c => c.status === status).map(c => c.id);
    setSelected(new Set(matching));
  };

  const selectNotSentType = (type) => {
    const notSent = invited.filter(c => {
      const types = getEmailTypesSent(c.id);
      return !types[type];
    }).map(c => c.id);
    setSelected(new Set(notSent));
  };

  const promoteSelected = async () => {
    if (selected.size === 0) return;
    const res = await fetch('/api/invited', {
      method: 'POST', headers,
      body: JSON.stringify({ customer_ids: [...selected] }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Promoted ${data.promoted} leads to Invited status`);
      setSelected(new Set());
      fetchData();
    }
  };

  const sendEmails = async () => {
    if (selected.size === 0) { alert('Select at least one invitee'); return; }
    setSending(true);

    try {
      const body = {
        customer_ids: [...selected],
        email_type: emailType,
      };
      if (emailType === 'custom') {
        body.custom_message = { subject: customSubject, body: customBody };
      }

      const res = await fetch('/api/email/send-invites', {
        method: 'POST', headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSelected(new Set());
        setShowEmailPanel(false);
        fetchData();
      } else {
        alert(data.error || 'Failed to send emails');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
    setSending(false);
  };

  if (user?.role !== 'admin' && user?.role !== 'supervisor') {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin access required</div></AppShell>;
  }

  const statusColors = {
    invited: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    attended: 'bg-purple-100 text-purple-700',
  };

  const emailTypeBadgeColors = {
    invitation: 'bg-blue-100 text-blue-700',
    reminder: 'bg-amber-100 text-amber-700',
    confirmation: 'bg-green-100 text-green-700',
    event_update: 'bg-purple-100 text-purple-700',
    custom: 'bg-gray-100 text-gray-700',
  };

  const alreadySentCount = showEmailPanel ? getAlreadySentCount() : 0;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Invited Customers</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => { setTab('promote'); setSelected(new Set()); setShowEmailPanel(false); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'promote' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Promote Leads ({leads.length})
          </button>
          <button onClick={() => { setTab('invited'); setSelected(new Set()); setShowEmailPanel(false); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'invited' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Invited List ({invited.length})
          </button>
        </div>

        {/* Promote Tab */}
        {tab === 'promote' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">{selected.size} selected</p>
              <button onClick={promoteSelected} disabled={selected.size === 0}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                Promote to Invited
              </button>
            </div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input type="checkbox" checked={selected.size === leads.length && leads.length > 0}
                        onChange={selectAll} className="rounded border-gray-300" />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Added By</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No leads to promote</td></tr>
                  ) : leads.map(l => (
                    <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleSelect(l.id)}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{l.full_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{l.company_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{l.email}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{l.organization_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {leads.length === 0 ? (
                <p className="p-6 text-center text-gray-400">No leads to promote</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
                    <input type="checkbox" checked={selected.size === leads.length && leads.length > 0}
                      onChange={selectAll} className="rounded border-gray-300" />
                    <span className="text-xs text-gray-500">Select all</span>
                  </div>
                  {leads.map(l => (
                    <div key={l.id} className={`p-4 flex items-start gap-3 cursor-pointer ${selected.has(l.id) ? 'bg-indigo-50' : ''}`}
                      onClick={() => toggleSelect(l.id)}>
                      <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)}
                        className="rounded border-gray-300 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{l.full_name}</p>
                        {l.company_name && <p className="text-xs text-gray-500 truncate">{l.company_name}</p>}
                        <p className="text-xs text-gray-400 truncate mt-0.5">{l.email}</p>
                        {l.organization_name && <p className="text-[10px] text-gray-300 mt-0.5">Added by: {l.organization_name}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invited Tab */}
        {tab === 'invited' && (
          <>
            {/* Email Action Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <p className="text-sm font-medium text-gray-700">{selected.size} selected</p>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={selectAll}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                      {selected.size === invited.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button onClick={() => selectByStatus('invited')}
                      className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100">
                      Pending RSVP
                    </button>
                    <button onClick={() => selectByStatus('accepted')}
                      className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">
                      Accepted
                    </button>
                    <button onClick={() => selectNotSentType('invitation')}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                      Not Yet Invited
                    </button>
                    <button onClick={() => selectNotSentType('reminder')}
                      className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100">
                      No Reminder Sent
                    </button>
                  </div>
                </div>
                <button onClick={() => setShowEmailPanel(!showEmailPanel)} disabled={selected.size === 0}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0">
                  {showEmailPanel ? 'Hide Email Panel' : 'Send Email'}
                </button>
              </div>

              {/* Email Send Panel */}
              {showEmailPanel && selected.size > 0 && (
                <div className="border-t border-gray-200 pt-4 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Type</label>
                      <div className="space-y-2">
                        {EMAIL_TYPES.map(t => (
                          <label key={t.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            emailType === t.value ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                            <input type="radio" name="emailType" value={t.value}
                              checked={emailType === t.value} onChange={() => setEmailType(t.value)}
                              className="mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{t.label}</p>
                              <p className="text-xs text-gray-500">{t.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Send Summary</label>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <p className="text-sm"><span className="text-gray-500">Recipients:</span> <span className="font-medium">{selected.size}</span></p>
                        <p className="text-sm"><span className="text-gray-500">Email type:</span> <span className="font-medium capitalize">{emailType.replace('_', ' ')}</span></p>
                        {alreadySentCount > 0 && (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                            {alreadySentCount} of {selected.size} selected invitees have already received a {emailType.replace('_', ' ')} email.
                            They will receive it again.
                          </div>
                        )}
                      </div>

                      {emailType === 'custom' && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                            <input type="text" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)}
                              placeholder="Email subject line..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                            <textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)}
                              rows={4} placeholder="Your message..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                          </div>
                        </div>
                      )}

                      <button onClick={sendEmails} disabled={sending || (emailType === 'custom' && (!customSubject || !customBody))}
                        className="mt-4 w-full py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">
                        {sending ? 'Sending...' : `Send ${emailType.replace('_', ' ')} to ${selected.size} recipient${selected.size !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Invited Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <input type="checkbox" checked={selected.size === invited.length && invited.length > 0}
                          onChange={selectAll} className="rounded border-gray-300" />
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Org</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">RSVP Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Emails Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                    ) : invited.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No invited customers yet. Promote leads first.</td></tr>
                    ) : invited.map(c => {
                      const typesSent = getEmailTypesSent(c.id);
                      const history = getEmailHistory(c.id);
                      return (
                        <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selected.has(c.id) ? 'bg-indigo-50' : ''}`}
                          onClick={() => toggleSelect(c.id)}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-gray-300" />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                            <p className="text-xs text-gray-400">{c.company_name}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{c.organization_name}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {Object.keys(typesSent).length === 0 ? (
                              <span className="text-xs text-gray-300">None</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(typesSent).map(([type, date]) => (
                                  <span key={type} className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-medium ${emailTypeBadgeColors[type] || 'bg-gray-100 text-gray-600'}`}
                                    title={`Sent: ${new Date(date).toLocaleString()}`}>
                                    {type.replace('_', ' ')}
                                  </span>
                                ))}
                                <span className="text-[10px] text-gray-400 ml-1" title="Total emails sent">
                                  ({history.length})
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden">
                {loading ? (
                  <p className="p-6 text-center text-gray-400">Loading...</p>
                ) : invited.length === 0 ? (
                  <p className="p-6 text-center text-gray-400">No invited customers yet. Promote leads first.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
                      <input type="checkbox" checked={selected.size === invited.length && invited.length > 0}
                        onChange={selectAll} className="rounded border-gray-300" />
                      <span className="text-xs text-gray-500">Select all</span>
                    </div>
                    {invited.map(c => {
                      const typesSent = getEmailTypesSent(c.id);
                      const history = getEmailHistory(c.id);
                      return (
                        <div key={c.id} className={`p-4 flex items-start gap-3 cursor-pointer ${selected.has(c.id) ? 'bg-indigo-50' : ''}`}
                          onClick={() => toggleSelect(c.id)}>
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                            className="rounded border-gray-300 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-900 truncate">{c.full_name}</p>
                              <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ml-2 ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                                {c.status}
                              </span>
                            </div>
                            {c.company_name && <p className="text-xs text-gray-500 truncate">{c.company_name}</p>}
                            <p className="text-xs text-gray-400 truncate">{c.email}</p>
                            {c.organization_name && <p className="text-[10px] text-gray-300">Org: {c.organization_name}</p>}
                            {Object.keys(typesSent).length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                                {Object.entries(typesSent).map(([type, date]) => (
                                  <span key={type} className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-medium ${emailTypeBadgeColors[type] || 'bg-gray-100 text-gray-600'}`}>
                                    {type.replace('_', ' ')}
                                  </span>
                                ))}
                                <span className="text-[10px] text-gray-400">({history.length})</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
