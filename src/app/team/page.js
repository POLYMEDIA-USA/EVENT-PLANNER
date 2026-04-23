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
  const [selected, setSelected] = useState(new Set());
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [nameSearch, setNameSearch] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const canManage = user?.role === 'admin' || user?.role === 'supervisor';

  useEffect(() => {
    const ev = JSON.parse(localStorage.getItem('cm_event') || 'null');
    setEvent(ev);
    if (ev) fetchData(ev.id);
    else setLoading(false);
  }, []);

  const fetchData = async (eventId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/attendance?event_id=${eventId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAttendance(data.attendance || []);
        setCandidates(data.candidates || []);
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
    if (!nameSearch.trim()) return attendance;
    const q = nameSearch.toLowerCase();
    return attendance.filter(a =>
      (a.user_full_name || '').toLowerCase().includes(q) ||
      (a.user_email || '').toLowerCase().includes(q) ||
      (a.user_organization_name || '').toLowerCase().includes(q)
    );
  }, [attendance, nameSearch]);

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

  const sendBulkEmailInvites = async (attIds) => {
    if (attIds.length === 0) return;
    if (!confirm(`Send invitation email to ${attIds.length} team member${attIds.length !== 1 ? 's' : ''}?`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/team/send', {
        method: 'POST', headers,
        body: JSON.stringify({ kind: 'invite', attendance_ids: attIds }),
      });
      const data = await res.json();
      alert(data.message || data.error);
      if (res.ok) await fetchData(event.id);
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
                  <button onClick={() => sendBulkEmailInvites([...selected])} disabled={busy || selected.size === 0}
                    className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    Send Email Invite
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
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left w-8"></th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Role / Org</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">RSVP</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Check-In</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                      : filteredAttendance.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No team members yet — add them on the "Invite to Work" tab.</td></tr>
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
      </div>
    </AppShell>
  );
}
