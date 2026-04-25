'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';
import Pagination, { paginate } from '@/components/Pagination';

const EMAIL_TYPES = [
  { value: 'invitation', label: 'Invitation', desc: 'Initial invite with RSVP buttons' },
  { value: 'reminder', label: 'Reminder', desc: 'Follow-up for those who haven\'t responded' },
  { value: 'confirmation', label: 'Confirmation', desc: 'Confirm attendance with QR code' },
  { value: 'event_update', label: 'Event Update', desc: 'Share updated event details' },
  { value: 'template', label: 'From Template', desc: 'Send using a saved email template' },
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortCol, setSortCol] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [previewEmail, setPreviewEmail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [senderName, setSenderName] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    // Default sender name to the current user's full name on first render
    if (!senderName && user?.full_name) setSenderName(user.full_name);
  }, [user, senderName]);

  const fetchData = async () => {
    try {
      const [leadsRes, invitedRes, emailRes, tplRes] = await Promise.all([
        fetch('/api/leads', { headers }),
        fetch('/api/invited', { headers }),
        fetch('/api/email/log', { headers }),
        fetch('/api/email/templates', { headers }),
      ]);
      if (tplRes.ok) setTemplates((await tplRes.json()).templates || []);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads((data.customers || []).filter(c => c.status === 'approved'));
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

  // Admin override of a lead's status — used during training/roleplay so a dummy
  // lead can be reset back to any stage of the funnel without going through the
  // full email flow. Backend permits 'invited' for admins only; everything else
  // works for any role with edit rights.
  const changeLeadStatus = async (customerId, newStatus) => {
    const res = await fetch('/api/leads', {
      method: 'PUT', headers,
      body: JSON.stringify({ id: customerId, status: newStatus }),
    });
    if (res.ok) {
      fetchData();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to change status');
    }
  };

  // Open the most recent email of a given type for a customer
  const openEmailPreview = async (customerId, type) => {
    const match = emailLogs
      .filter(e => e.customer_id === customerId && e.type === type && e.status === 'sent')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    if (!match) return;
    setPreviewLoading(true);
    setPreviewEmail({ ...match, html_body: '' }); // show header immediately
    try {
      const res = await fetch(`/api/email/log?email_id=${match.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPreviewEmail(data.email);
      }
    } catch (err) { console.error(err); }
    setPreviewLoading(false);
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
      const pool = filteredInvited;
      const allSelected = pool.length > 0 && pool.every(c => selected.has(c.id));
      setSelected(allSelected ? new Set() : new Set(pool.map(c => c.id)));
    }
  };

  const selectByStatus = (status) => {
    const matching = filteredInvited.filter(c => c.status === status).map(c => c.id);
    setSelected(new Set(matching));
  };

  const selectNotSentType = (type) => {
    const notSent = filteredInvited.filter(c => {
      const types = getEmailTypesSent(c.id);
      return !types[type];
    }).map(c => c.id);
    setSelected(new Set(notSent));
  };

  // Send the invitation email directly from the Approved-to-Invite tab.
  // Tokens are generated on the backend automatically and status flips to "invited" on successful send.
  const sendInvitations = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Send invitation email to ${selected.size} lead${selected.size !== 1 ? 's' : ''}? RSVP tokens will be generated automatically.`)) return;
    setSending(true);
    try {
      const res = await fetch('/api/email/send-invites', {
        method: 'POST', headers,
        body: JSON.stringify({ customer_ids: [...selected], email_type: 'invitation' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSelected(new Set());
        fetchData();
      } else {
        alert(data.error || 'Failed to send invitations');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
    setSending(false);
  };

  // Send/resend a single confirmation email to one lead (for recovering lost emails).
  // If a confirmation was already sent, warn the admin but allow the resend.
  const sendConfirmation = async (customer) => {
    const types = getEmailTypesSent(customer.id);
    const prevSent = types['confirmation'];
    const prompt = prevSent
      ? `${customer.full_name} already received a confirmation email on ${new Date(prevSent).toLocaleString()}.\n\nResend it now? The QR check-in code will be included.`
      : `Send confirmation email to ${customer.full_name}? The QR check-in code will be included.`;
    if (!confirm(prompt)) return;
    try {
      const res = await fetch('/api/email/send-invites', {
        method: 'POST', headers,
        body: JSON.stringify({ customer_ids: [customer.id], email_type: 'confirmation' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Confirmation sent.');
        fetchData();
      } else {
        alert(data.error || 'Failed to send confirmation');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  };

  const sendEmails = async () => {
    if (selected.size === 0) { alert('Select at least one invitee'); return; }
    if (emailType === 'template' && !selectedTemplateId) { alert('Pick a template first.'); return; }
    setSending(true);

    try {
      const body = {
        customer_ids: [...selected],
        email_type: emailType,
        sender_name: senderName,
      };
      if (emailType === 'custom') {
        body.custom_message = { subject: customSubject, body: customBody };
      }
      if (emailType === 'template') {
        body.template_id = selectedTemplateId;
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

  const canManage = user?.role === 'admin' || user?.role === 'supervisor';

  const statusColors = {
    approved: 'bg-teal-100 text-teal-700',
    invited: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    attended: 'bg-purple-100 text-purple-700',
  };

  const statusLabel = (s) => {
    if (s === 'approved') return 'Approved to Invite';
    return s;
  };

  // Sort helpers
  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
    setPage(1);
  };
  const sortArrow = (col) => sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';

  const filteredInvited = useMemo(() => {
    if (!searchText.trim()) return invited;
    const q = searchText.toLowerCase().trim();
    return invited.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.company_name || '').toLowerCase().includes(q) ||
      (c.organization_name || '').toLowerCase().includes(q)
    );
  }, [invited, searchText]);

  const sortedInvited = useMemo(() => {
    if (!sortCol) return filteredInvited;
    return [...filteredInvited].sort((a, b) => {
      const fieldMap = { name: 'full_name', email: 'email', org: 'organization_name', status: 'status' };
      const field = fieldMap[sortCol] || sortCol;
      const va = (a[field] || '').toLowerCase(), vb = (b[field] || '').toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredInvited, sortCol, sortAsc]);

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
          {canManage && (
            <button onClick={() => { setTab('promote'); setSelected(new Set()); setShowEmailPanel(false); setPage(1); setSortCol(''); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'promote' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              Approved to Invite ({leads.length})
            </button>
          )}
          <button onClick={() => { setTab('invited'); setSelected(new Set()); setShowEmailPanel(false); setPage(1); setSortCol(''); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'invited' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Invited List ({invited.length})
          </button>
        </div>

        {/* Promote Tab */}
        {tab === 'promote' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm text-gray-500">{selected.size} selected</p>
                <p className="text-xs text-gray-400 mt-0.5">Sending an invitation generates the RSVP token and moves the lead to Invited automatically.</p>
              </div>
              <button onClick={sendInvitations} disabled={selected.size === 0 || sending}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 shrink-0">
                {sending ? 'Sending…' : `Send Invitation Email${selected.size > 0 ? ` (${selected.size})` : ''}`}
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
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No approved leads ready to invite</td></tr>
                  ) : paginate(leads, page, pageSize).map(l => (
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
                <p className="p-6 text-center text-gray-400">No approved leads ready to invite</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
                    <input type="checkbox" checked={selected.size === leads.length && leads.length > 0}
                      onChange={selectAll} className="rounded border-gray-300" />
                    <span className="text-xs text-gray-500">Select all</span>
                  </div>
                  {paginate(leads, page, pageSize).map(l => (
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
            <Pagination totalItems={leads.length} page={page} pageSize={pageSize}
              onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        )}

        {/* Invited Tab */}
        {tab === 'invited' && (
          <>
            {/* Email Action Bar — admin/supervisor only */}
            {canManage && <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <p className="text-sm font-medium text-gray-700">{selected.size} selected</p>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={selectAll}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                      {filteredInvited.length > 0 && filteredInvited.every(c => selected.has(c.id)) ? 'Deselect All' : 'Select All'}
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

                      {emailType === 'template' && (
                        <div className="mt-4">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pick a template</label>
                          {templates.length === 0 ? (
                            <p className="text-xs text-gray-400 p-3 bg-gray-50 rounded-lg">
                              No templates yet. Create one in <span className="font-medium">Settings → Email Templates</span>, then refresh.
                            </p>
                          ) : (
                            <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                              <option value="">— choose a template —</option>
                              {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          )}
                          <p className="text-[11px] text-gray-400 mt-1">
                            Merge fields replaced automatically: &#123;&#123;lead_name&#125;&#125;, &#123;&#123;event_name&#125;&#125;, &#123;&#123;event_date&#125;&#125;, &#123;&#123;event_time&#125;&#125;, &#123;&#123;event_location&#125;&#125;, &#123;&#123;company_name&#125;&#125;, &#123;&#123;rsvp_link&#125;&#125;. Event details block + Accept/Decline buttons are auto-appended.
                          </p>
                        </div>
                      )}

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

                      <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Signature (how you'll be signed in the email)</label>
                        <textarea value={senderName} onChange={(e) => setSenderName(e.target.value)}
                          rows={3}
                          placeholder={`Dave Engelke\nCEO, VerifyAi`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                        <p className="text-[11px] text-gray-400 mt-1">
                          Renders as <em>Regards,</em> followed by these lines at the bottom of the email. Multi-line OK (name on one line, title on another, etc.). Also available as <code>&#123;&#123;sender_name&#125;&#125;</code> in templates.
                        </p>
                      </div>

                      <button onClick={sendEmails} disabled={sending
                          || (emailType === 'custom' && (!customSubject || !customBody))
                          || (emailType === 'template' && !selectedTemplateId)}
                        className="mt-4 w-full py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">
                        {sending ? 'Sending...' : `Send ${emailType.replace('_', ' ')} to ${selected.size} recipient${selected.size !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>}

            {/* Search */}
            <div className="mb-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
                placeholder="Search by name, email, or org..."
                className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              {searchText && (
                <button onClick={() => { setSearchText(''); setPage(1); }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Invited Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {canManage && <th className="px-4 py-3 text-left w-10">
                        <input type="checkbox" checked={filteredInvited.length > 0 && filteredInvited.every(c => selected.has(c.id))}
                          onChange={selectAll} className="rounded border-gray-300" />
                      </th>}
                      <th onClick={() => handleSort('name')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">Name{sortArrow('name')}</th>
                      <th onClick={() => handleSort('email')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">Email{sortArrow('email')}</th>
                      <th onClick={() => handleSort('org')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">Org{sortArrow('org')}</th>
                      <th onClick={() => handleSort('status')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">RSVP Status{sortArrow('status')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Emails Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                    ) : invited.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No invited customers yet. Approve leads and send an invitation email first.</td></tr>
                    ) : paginate(sortedInvited, page, pageSize).map(c => {
                      const typesSent = getEmailTypesSent(c.id);
                      const history = getEmailHistory(c.id);
                      return (
                        <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selected.has(c.id) ? 'bg-indigo-50' : ''}`}
                          onClick={() => toggleSelect(c.id)}>
                          {canManage && <td className="px-4 py-3">
                            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-gray-300" />
                          </td>}
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                            <p className="text-xs text-gray-400">{c.company_name}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{c.organization_name}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {user?.role === 'admin' ? (
                              <select
                                value={c.status}
                                onChange={(e) => changeLeadStatus(c.id, e.target.value)}
                                title="Admin override — change status for training/roleplay"
                                className={`text-xs rounded-full font-medium border-0 cursor-pointer focus:ring-2 focus:ring-indigo-300 px-2 py-0.5 ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}
                              >
                                <option value="possible">Possible</option>
                                <option value="approved">Approved to Invite</option>
                                <option value="invited">Invited</option>
                                <option value="accepted">Accepted</option>
                                <option value="declined">Declined</option>
                                <option value="attended">Attended</option>
                              </select>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                                {statusLabel(c.status)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center flex-wrap gap-1">
                              {Object.keys(typesSent).length === 0 ? (
                                <span className="text-xs text-gray-300">None</span>
                              ) : (
                                <>
                                  {Object.entries(typesSent).map(([type, date]) => (
                                    <button key={type} onClick={(e) => { e.stopPropagation(); openEmailPreview(c.id, type); }}
                                      className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-medium hover:ring-2 hover:ring-indigo-300 transition ${emailTypeBadgeColors[type] || 'bg-gray-100 text-gray-600'}`}
                                      title={`Click to view · Sent ${new Date(date).toLocaleString()}`}>
                                      {type.replace('_', ' ')}
                                    </button>
                                  ))}
                                  <span className="text-[10px] text-gray-400 ml-1" title="Total emails sent">
                                    ({history.length})
                                  </span>
                                </>
                              )}
                              {canManage && (c.status === 'accepted' || c.status === 'attended') && (
                                <button onClick={(e) => { e.stopPropagation(); sendConfirmation(c); }}
                                  className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded font-medium bg-green-600 text-white hover:bg-green-700"
                                  title={typesSent['confirmation'] ? `Resend confirmation (previously sent ${new Date(typesSent['confirmation']).toLocaleString()})` : 'Send confirmation email with QR code'}>
                                  ↻ {typesSent['confirmation'] ? 'Resend' : 'Send'} Confirm
                                </button>
                              )}
                            </div>
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
                  <p className="p-6 text-center text-gray-400">No invited customers yet. Approve leads and send an invitation email first.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {canManage && <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
                      <input type="checkbox" checked={filteredInvited.length > 0 && filteredInvited.every(c => selected.has(c.id))}
                        onChange={selectAll} className="rounded border-gray-300" />
                      <span className="text-xs text-gray-500">Select all{searchText ? ` (${filteredInvited.length} filtered)` : ''}</span>
                    </div>}
                    {paginate(sortedInvited, page, pageSize).map(c => {
                      const typesSent = getEmailTypesSent(c.id);
                      const history = getEmailHistory(c.id);
                      return (
                        <div key={c.id} className={`p-4 flex items-start gap-3 ${canManage ? 'cursor-pointer' : ''} ${selected.has(c.id) ? 'bg-indigo-50' : ''}`}
                          onClick={() => canManage && toggleSelect(c.id)}>
                          {canManage && <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                            className="rounded border-gray-300 mt-0.5 shrink-0" />}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-900 truncate">{c.full_name}</p>
                              {user?.role === 'admin' ? (
                                <select
                                  value={c.status}
                                  onChange={(e) => changeLeadStatus(c.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`text-xs rounded-full font-medium border-0 cursor-pointer focus:ring-2 focus:ring-indigo-300 px-2 py-0.5 shrink-0 ml-2 ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}
                                >
                                  <option value="possible">possible</option>
                                  <option value="approved">approved</option>
                                  <option value="invited">invited</option>
                                  <option value="accepted">accepted</option>
                                  <option value="declined">declined</option>
                                  <option value="attended">attended</option>
                                </select>
                              ) : (
                                <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ml-2 ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {c.status}
                                </span>
                              )}
                            </div>
                            {c.company_name && <p className="text-xs text-gray-500 truncate">{c.company_name}</p>}
                            <p className="text-xs text-gray-400 truncate">{c.email}</p>
                            {c.organization_name && <p className="text-[10px] text-gray-300">Org: {c.organization_name}</p>}
                            <div className="flex flex-wrap items-center gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                              {Object.entries(typesSent).map(([type, date]) => (
                                <button key={type} onClick={(e) => { e.stopPropagation(); openEmailPreview(c.id, type); }}
                                  className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-medium active:ring-2 active:ring-indigo-300 transition ${emailTypeBadgeColors[type] || 'bg-gray-100 text-gray-600'}`}>
                                  {type.replace('_', ' ')}
                                </button>
                              ))}
                              {Object.keys(typesSent).length > 0 && <span className="text-[10px] text-gray-400">({history.length})</span>}
                              {canManage && (c.status === 'accepted' || c.status === 'attended') && (
                                <button onClick={(e) => { e.stopPropagation(); sendConfirmation(c); }}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded font-medium bg-green-600 text-white">
                                  ↻ {typesSent['confirmation'] ? 'Resend' : 'Send'} Confirm
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <Pagination totalItems={sortedInvited.length} page={page} pageSize={pageSize}
                onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          </>
        )}

        {/* Email Preview Modal */}
        {previewEmail && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPreviewEmail(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{previewEmail.subject}</h3>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                    <div><span className="text-gray-400">From:</span> {previewEmail.from}</div>
                    <div><span className="text-gray-400">To:</span> {previewEmail.to}</div>
                    <div><span className="text-gray-400">Type:</span> {previewEmail.type?.replace('_', ' ')}</div>
                    <div><span className="text-gray-400">Sent:</span> {new Date(previewEmail.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <button onClick={() => setPreviewEmail(null)}
                  className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0">
                  ✕
                </button>
              </div>
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 text-center">
                Preview only — links and buttons in this email are disabled.
              </div>
              <div className="flex-1 overflow-y-auto p-5 bg-gray-100">
                {previewLoading ? (
                  <p className="text-center text-gray-400 text-sm py-12">Loading email…</p>
                ) : previewEmail.html_body ? (
                  <div className="email-preview-inert mx-auto bg-white border border-gray-300 shadow-sm rounded-lg p-6" style={{ maxWidth: '650px' }}>
                    <div dangerouslySetInnerHTML={{ __html: previewEmail.html_body }} />
                  </div>
                ) : (
                  <p className="text-center text-gray-400 text-sm py-12">No body content</p>
                )}
              </div>
              <style jsx>{`
                .email-preview-inert :global(a),
                .email-preview-inert :global(button),
                .email-preview-inert :global(input),
                .email-preview-inert :global(form) {
                  pointer-events: none !important;
                  cursor: default !important;
                }
              `}</style>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
