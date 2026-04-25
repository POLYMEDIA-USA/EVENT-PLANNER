'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

const STATUS_LABELS = {
  pending: 'Pending Send',
  invited: 'Invited',
  confirmed: 'Confirmed',
  declined: 'Declined',
  present: 'Present',
};

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-700',
  invited: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  present: 'bg-indigo-100 text-indigo-700',
};

export default function TeamPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('invite'); // 'invite' | 'attending'
  const [attendance, setAttendance] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [previewEmail, setPreviewEmail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');

  // Column sort
  const [sortCol, setSortCol] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  // Email panel
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailKind, setEmailKind] = useState('invite');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [senderName, setSenderName] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const canManage = user?.role === 'admin' || user?.role === 'supervisor';

  useEffect(() => {
    const ev = JSON.parse(localStorage.getItem('cm_event') || 'null');
    setEvent(ev);
    if (ev) fetchData(ev.id);
    else setLoading(false);
    fetchTemplates();
  }, []);

  useEffect(() => {
    // Default sender_name to the current admin's full name
    if (!senderName && user?.full_name) setSenderName(user.full_name);
  }, [user, senderName]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/email/templates', { headers });
      if (res.ok) setTemplates((await res.json()).templates || []);
    } catch (err) { console.error(err); }
  };

  const fetchData = async (eventId) => {
    setLoading(true);
    try {
      const [attRes, logRes] = await Promise.all([
        fetch(`/api/team/attendance?event_id=${eventId}`, { headers }),
        fetch('/api/email/log', { headers }),
      ]);
      if (attRes.ok) {
        const data = await attRes.json();
        setAttendance(data.attendance || []);
        setCandidates(data.candidates || []);
      }
      if (logRes.ok) {
        const data = await logRes.json();
        setEmailLogs(data.emails || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const filteredCandidates = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.organization_name || '').toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const filteredAttendance = useMemo(() => {
    let list = attendance;
    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase();
      list = list.filter(a =>
        (a.user_full_name || '').toLowerCase().includes(q) ||
        (a.user_email || '').toLowerCase().includes(q) ||
        (a.user_organization_name || '').toLowerCase().includes(q)
      );
    }
    if (!sortCol) return list;
    const fieldMap = {
      name: 'user_full_name',
      role: 'user_role',
      org: 'user_organization_name',
      status: 'status',
      rsvp: 'rsvp_sent_at',
      checkin: 'checkin_at',
    };
    const field = fieldMap[sortCol] || sortCol;
    return [...list].sort((a, b) => {
      const va = (a[field] || '').toString().toLowerCase();
      const vb = (b[field] || '').toString().toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [attendance, nameSearch, sortCol, sortAsc]);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };
  const sortArrow = (col) => sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';

  // Email history per recipient — match by email address since team logs have empty customer_id.
  // Returns the most-recent send timestamp per type label so the row badges show one chip per kind.
  const getEmailTypesForUser = (email) => {
    if (!email) return [];
    const lower = email.toLowerCase();
    const matches = emailLogs.filter(e => (e.to || '').toLowerCase() === lower && e.status === 'sent');
    const byLabel = {};
    matches.forEach(e => {
      // team_template:<name> is treated per-template-name; everything else uses its bare type
      const label = (e.type || '').startsWith('team_template:')
        ? e.type.slice('team_template:'.length)
        : (e.type || '').replace(/^team_/, '');
      if (!byLabel[label] || new Date(e.created_at) > new Date(byLabel[label].created_at)) {
        byLabel[label] = e;
      }
    });
    return Object.entries(byLabel).map(([label, log]) => ({ label, log }));
  };

  const openEmailPreview = async (logId) => {
    if (!logId) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/email/log?email_id=${logId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPreviewEmail(data.email);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to load email');
      }
    } catch (err) { alert('Network: ' + err.message); }
    setPreviewLoading(false);
  };

  const emailTypeColors = {
    invite: 'bg-blue-100 text-blue-700',
    confirmation: 'bg-green-100 text-green-700',
    custom: 'bg-gray-100 text-gray-700',
  };

  // Build invite records (stores them with status='pending' and rsvp_token; no email sent yet)
  const createInvites = async () => {
    if (!event || selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/team/attendance', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'invite', event_id: event.id, user_ids: [...selected] }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Added ${data.created} to the invite list${data.skipped ? ` (${data.skipped} already existed)` : ''}.`);
        setSelected(new Set());
        await fetchData(event.id);
        setTab('attending');
      } else alert(data.error || 'Failed');
    } catch (err) { alert('Network: ' + err.message); }
    setBusy(false);
  };

  const sendEmail = async () => {
    const attIds = [...selected];
    if (attIds.length === 0) { alert('Select at least one team member.'); return; }
    if (emailKind === 'custom' && (!customSubject.trim() || !customBody.trim())) {
      alert('Custom subject and body are required.');
      return;
    }
    if (emailKind === 'template' && !selectedTemplateId) {
      alert('Pick a template first.');
      return;
    }
    if (!confirm(`Send ${emailKind} email to ${attIds.length} team member${attIds.length !== 1 ? 's' : ''}?`)) return;
    setBusy(true);
    try {
      const body = {
        kind: emailKind,
        attendance_ids: attIds,
        sender_name: senderName,
      };
      if (emailKind === 'custom') body.custom_message = { subject: customSubject, body: customBody };
      if (emailKind === 'template') body.template_id = selectedTemplateId;
      const res = await fetch('/api/team/send', {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      const data = await res.json();
      alert(data.message || data.error);
      if (res.ok) {
        setSelected(new Set());
        setShowEmailPanel(false);
        await fetchData(event.id);
      }
    } catch (err) { alert('Network: ' + err.message); }
    setBusy(false);
  };

  const sendBulkSmsInvites = async (attIds) => {
    if (attIds.length === 0) return;
    if (!confirm(`Send SMS invitation to ${attIds.length} team member${attIds.length !== 1 ? 's' : ''}? Requires phone numbers on their user records.`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/team/sms', {
        method: 'POST', headers,
        body: JSON.stringify({ attendance_ids: attIds }),
      });
      const data = await res.json();
      alert(data.message || data.error);
      if (data.errors && data.errors.length) console.warn('SMS errors:', data.errors);
      if (res.ok) await fetchData(event.id);
    } catch (err) { alert('Network: ' + err.message); }
    setBusy(false);
  };

  const sendConfirmation = async (attId, userName, wasPrevSent) => {
    const prompt = wasPrevSent
      ? `${userName} already received a confirmation. Resend it now? QR code will be included.`
      : `Send confirmation email with QR code to ${userName}?`;
    if (!confirm(prompt)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/team/send', {
        method: 'POST', headers,
        body: JSON.stringify({ kind: 'confirmation', attendance_ids: [attId] }),
      });
      const data = await res.json();
      alert(data.message || data.error);
      if (res.ok) await fetchData(event.id);
    } catch (err) { alert('Network: ' + err.message); }
    setBusy(false);
  };

  const markStatus = async (attId, newStatus) => {
    setBusy(true);
    try {
      const res = await fetch('/api/team/attendance', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'mark', attendance_id: attId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Failed');
      else await fetchData(event.id);
    } catch (err) { alert('Network: ' + err.message); }
    setBusy(false);
  };

  const removeFromList = async (attId, userName) => {
    if (!confirm(`Remove ${userName} from this event's team list?`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/team/attendance', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'delete', attendance_id: attId }),
      });
      if (res.ok) await fetchData(event.id);
    } catch (err) { alert('Network: ' + err.message); }
    setBusy(false);
  };

  // Quick-select helpers for the Attending tab
  const selectByStatus = (status) => {
    const match = filteredAttendance.filter(a => a.status === status).map(a => a.id);
    setSelected(new Set(match));
  };
  const selectAllAttending = () => {
    const allIds = filteredAttendance.map(a => a.id);
    const allSel = allIds.length > 0 && allIds.every(id => selected.has(id));
    setSelected(allSel ? new Set() : new Set(allIds));
  };

  if (!canManage) {
    return <AppShell><div className="p-8 text-center text-gray-400">Admin / Supervisor only</div></AppShell>;
  }

  if (!event) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto p-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
            <p className="text-amber-800 font-medium">No event selected.</p>
            <p className="text-amber-600 text-sm mt-1">Pick an event from the Dashboard to manage team attendance for it.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const pendingIds = attendance.filter(a => a.status === 'pending').map(a => a.id);
  const invitedIds = attendance.filter(a => a.status === 'invited').map(a => a.id);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Attendance</h1>
            <p className="text-sm text-gray-500">Event: <span className="font-medium text-indigo-600">{event.name}</span></p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => { setTab('invite'); setSelected(new Set()); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'invite' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Invite to Work ({candidates.length})
          </button>
          <button onClick={() => { setTab('attending'); setSelected(new Set()); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${tab === 'attending' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Attending ({attendance.length})
          </button>
        </div>

        {tab === 'invite' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">{selected.size} selected of {filteredCandidates.length} candidates</p>
                <p className="text-xs text-gray-400">Adds them to this event's team list. You can send email/SMS invites from the Attending tab.</p>
              </div>
              <button onClick={createInvites} disabled={busy || selected.size === 0}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0">
                Add to Team List ({selected.size})
              </button>
            </div>
            <div className="p-3 border-b border-gray-200">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or org..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {loading ? <p className="p-6 text-center text-gray-400 text-sm">Loading...</p>
                : filteredCandidates.length === 0 ? <p className="p-6 text-center text-gray-400 text-sm">No candidates — every user is already on the team list for this event.</p>
                : filteredCandidates.map(u => (
                  <label key={u.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${selected.has(u.id) ? 'bg-indigo-50' : ''}`}>
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)}
                      className="rounded border-gray-300 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email} · {u.organization_name || '(no org)'}</p>
                    </div>
                    <span className="text-xs text-gray-400 capitalize shrink-0">{(u.role || '').replace('_', ' ')}</span>
                  </label>
                ))}
            </div>
          </div>
        )}

        {tab === 'attending' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <p className="text-sm font-medium text-gray-700">{selected.size} selected</p>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={selectAllAttending} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Select All</button>
                    <button onClick={() => selectByStatus('pending')} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Pending Send</button>
                    <button onClick={() => selectByStatus('invited')} className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100">Invited</button>
                    <button onClick={() => selectByStatus('confirmed')} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">Confirmed</button>
                    <button onClick={() => selectByStatus('declined')} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">Declined</button>
                    <button onClick={() => selectByStatus('present')} className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100">Present</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowEmailPanel(!showEmailPanel)} disabled={busy || selected.size === 0}
                    className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {showEmailPanel ? 'Hide Email Panel' : 'Send Email'}
                  </button>
                  <button onClick={() => sendBulkSmsInvites([...selected])} disabled={busy || selected.size === 0}
                    className="px-3 py-2 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    Send SMS Invite
                  </button>
                </div>
              </div>
              <input type="text" value={nameSearch} onChange={(e) => setNameSearch(e.target.value)}
                placeholder="Search team list..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />

              {/* Email panel */}
              {showEmailPanel && selected.size > 0 && (
                <div className="border-t border-gray-200 pt-4 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Type</label>
                      <div className="space-y-2">
                        {[
                          { value: 'invite', label: 'Built-in Invite', desc: '"Will you be working this event?" with RSVP buttons' },
                          { value: 'confirmation', label: 'Confirmation', desc: 'Send the QR check-in code (only meaningful for confirmed staff)' },
                          { value: 'template', label: 'From Template', desc: 'Send using a saved email template' },
                          { value: 'custom', label: 'Custom Message', desc: 'Write a custom subject and body' },
                        ].map(t => (
                          <label key={t.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            emailKind === t.value ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                            <input type="radio" name="teamEmailKind" value={t.value}
                              checked={emailKind === t.value} onChange={() => setEmailKind(t.value)}
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
                      <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                        <p className="text-sm"><span className="text-gray-500">Recipients:</span> <span className="font-medium">{selected.size}</span> team member{selected.size !== 1 ? 's' : ''}</p>
                        <p className="text-sm"><span className="text-gray-500">Email type:</span> <span className="font-medium capitalize">{emailKind}</span></p>
                      </div>

                      {emailKind === 'template' && (
                        <div className="mt-3">
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
                            Merge fields: &#123;&#123;recipient_name&#125;&#125; (or &#123;&#123;lead_name&#125;&#125;), &#123;&#123;event_name&#125;&#125;, &#123;&#123;event_date&#125;&#125;, &#123;&#123;event_time&#125;&#125;, &#123;&#123;event_location&#125;&#125;, &#123;&#123;company_name&#125;&#125;, &#123;&#123;rsvp_link&#125;&#125;, &#123;&#123;sender_name&#125;&#125;.
                          </p>
                        </div>
                      )}

                      {emailKind === 'custom' && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                            <input type="text" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)}
                              placeholder="Email subject..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
                            <textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)} rows={5}
                              placeholder="Your message to the team..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                          </div>
                        </div>
                      )}

                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Signature</label>
                        <textarea value={senderName} onChange={(e) => setSenderName(e.target.value)} rows={3}
                          placeholder={`Dave Engelke\nCEO, VerifyAi`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                        <p className="text-[11px] text-gray-400 mt-1">
                          Renders as <em>Regards,</em> + these lines at the bottom. Multi-line OK.
                        </p>
                      </div>

                      <button onClick={sendEmail} disabled={busy
                          || (emailKind === 'custom' && (!customSubject || !customBody))
                          || (emailKind === 'template' && !selectedTemplateId)}
                        className="mt-3 w-full py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">
                        {busy ? 'Sending...' : `Send ${emailKind} to ${selected.size} team member${selected.size !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left w-8"></th>
                      <th onClick={() => handleSort('name')} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">Name{sortArrow('name')}</th>
                      <th onClick={() => handleSort('role')} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">Role / Org{sortArrow('role')}</th>
                      <th onClick={() => handleSort('status')} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">Status{sortArrow('status')}</th>
                      <th onClick={() => handleSort('rsvp')} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">RSVP{sortArrow('rsvp')}</th>
                      <th onClick={() => handleSort('checkin')} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-indigo-600 select-none">Check-In{sortArrow('checkin')}</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Emails Sent</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                      : filteredAttendance.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No team members yet — add them on the "Invite to Work" tab.</td></tr>
                      : filteredAttendance.map(a => (
                        <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 ${selected.has(a.id) ? 'bg-indigo-50' : ''}`}>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="rounded border-gray-300" />
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800">{a.user_full_name}</p>
                            <p className="text-xs text-gray-400">{a.user_email}</p>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            <span className="capitalize">{(a.user_role || '').replace('_', ' ')}</span>
                            {a.user_organization_name && <p className="text-gray-400">{a.user_organization_name}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>
                              {STATUS_LABELS[a.status] || a.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {a.rsvp_sent_at && <span title={`Sent ${new Date(a.rsvp_sent_at).toLocaleString()}${a.invited_via ? ` via ${a.invited_via}` : ''}`}>Sent {a.invited_via ? `(${a.invited_via})` : ''}</span>}
                            {a.rsvp_responded_at && <p className="text-gray-400">Replied {new Date(a.rsvp_responded_at).toLocaleDateString()}</p>}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {a.qr_code_data && <p className="font-mono font-bold text-gray-700">{a.qr_code_data}</p>}
                            {a.checkin_at && <p className="text-indigo-600 font-medium">Present @ {new Date(a.checkin_at).toLocaleTimeString()}</p>}
                          </td>
                          <td className="px-3 py-2">
                            {(() => {
                              const sent = getEmailTypesForUser(a.user_email);
                              if (sent.length === 0) return <span className="text-xs text-gray-300">None</span>;
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {sent.map(({ label, log }) => (
                                    <button key={label} onClick={() => openEmailPreview(log.id)}
                                      className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-medium hover:ring-2 hover:ring-indigo-300 transition ${emailTypeColors[label] || 'bg-gray-100 text-gray-700'}`}
                                      title={`Click to view · Sent ${new Date(log.created_at).toLocaleString()}`}>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <div className="inline-flex flex-wrap gap-1 justify-end">
                              {a.status === 'confirmed' && (
                                <button onClick={() => sendConfirmation(a.id, a.user_full_name, !!a.confirmation_sent_at)} disabled={busy}
                                  className="px-2 py-1 text-[11px] rounded bg-green-600 text-white hover:bg-green-700">
                                  ↻ {a.confirmation_sent_at ? 'Resend' : 'Send'} Confirm
                                </button>
                              )}
                              {a.status !== 'present' && (
                                <button onClick={() => markStatus(a.id, 'present')} disabled={busy}
                                  className="px-2 py-1 text-[11px] rounded bg-indigo-600 text-white hover:bg-indigo-700" title="Mark present without a QR scan">
                                  Mark Present
                                </button>
                              )}
                              {a.status !== 'confirmed' && a.status !== 'present' && (
                                <button onClick={() => markStatus(a.id, 'confirmed')} disabled={busy}
                                  className="px-2 py-1 text-[11px] rounded bg-gray-100 text-gray-700 hover:bg-gray-200" title="Mark confirmed without an RSVP">
                                  ✓ Confirm
                                </button>
                              )}
                              {a.status !== 'declined' && a.status !== 'present' && (
                                <button onClick={() => markStatus(a.id, 'declined')} disabled={busy}
                                  className="px-2 py-1 text-[11px] rounded bg-gray-100 text-gray-700 hover:bg-gray-200" title="Mark declined">
                                  ✕ Decline
                                </button>
                              )}
                              <button onClick={() => removeFromList(a.id, a.user_full_name)} disabled={busy}
                                className="px-2 py-1 text-[11px] rounded bg-red-50 text-red-600 hover:bg-red-100">
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {loading ? <p className="p-6 text-center text-gray-400">Loading...</p>
                  : filteredAttendance.length === 0 ? <p className="p-6 text-center text-gray-400">No team members yet.</p>
                  : filteredAttendance.map(a => (
                    <div key={a.id} className={`p-4 ${selected.has(a.id) ? 'bg-indigo-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900 truncate">{a.user_full_name}</p>
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ml-2 ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">{a.user_email}</p>
                          {a.qr_code_data && <p className="text-xs font-mono font-bold text-gray-700 mt-1">QR: {a.qr_code_data}</p>}
                          {(() => {
                            const sent = getEmailTypesForUser(a.user_email);
                            if (sent.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {sent.map(({ label, log }) => (
                                  <button key={label} onClick={() => openEmailPreview(log.id)}
                                    className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-medium ${emailTypeColors[label] || 'bg-gray-100 text-gray-700'}`}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {a.status === 'confirmed' && (
                              <button onClick={() => sendConfirmation(a.id, a.user_full_name, !!a.confirmation_sent_at)} disabled={busy}
                                className="px-2 py-1 text-[11px] rounded bg-green-600 text-white">↻ {a.confirmation_sent_at ? 'Resend' : 'Send'} Confirm</button>
                            )}
                            {a.status !== 'present' && (
                              <button onClick={() => markStatus(a.id, 'present')} disabled={busy}
                                className="px-2 py-1 text-[11px] rounded bg-indigo-600 text-white">Mark Present</button>
                            )}
                            {a.status !== 'confirmed' && a.status !== 'present' && (
                              <button onClick={() => markStatus(a.id, 'confirmed')} disabled={busy}
                                className="px-2 py-1 text-[11px] rounded bg-gray-100 text-gray-700">✓ Confirm</button>
                            )}
                            <button onClick={() => removeFromList(a.id, a.user_full_name)} disabled={busy}
                              className="px-2 py-1 text-[11px] rounded bg-red-50 text-red-600">Remove</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        {/* Email preview modal — same inert pattern as the Invited tab */}
        {previewEmail && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPreviewEmail(null)}>
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{previewEmail.subject}</h3>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                    <div><span className="text-gray-400">From:</span> {previewEmail.from}</div>
                    <div><span className="text-gray-400">To:</span> {previewEmail.to}</div>
                    <div><span className="text-gray-400">Type:</span> {previewEmail.type}</div>
                    <div><span className="text-gray-400">Sent:</span> {new Date(previewEmail.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <button onClick={() => setPreviewEmail(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0">✕</button>
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
