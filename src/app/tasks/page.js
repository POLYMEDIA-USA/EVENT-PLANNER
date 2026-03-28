'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [customers, setCustomers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', customer_id: '', assigned_to_ids: [], due_date: '', priority: 'medium',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [tasksRes, leadsRes, repsRes] = await Promise.all([
        fetch('/api/tasks', { headers }),
        fetch('/api/leads', { headers }),
        fetch('/api/reps', { headers }),
      ]);
      if (tasksRes.ok) setTasks((await tasksRes.json()).tasks || []);
      if (leadsRes.ok) setCustomers((await leadsRes.json()).customers || []);
      if (repsRes.ok) {
        let users = (await repsRes.json()).users || [];
        if (user?.role === 'sales_rep') users = users.filter(u => u.id === user.id);
        setAllUsers(users);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks', { headers });
      if (res.ok) setTasks((await res.json()).tasks || []);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === form.customer_id);
    const assigneeNames = form.assigned_to_ids.map(id => {
      const u = allUsers.find(u => u.id === id);
      return u ? u.full_name : '';
    }).filter(Boolean);
    const body = {
      ...form,
      customer_name: customer?.full_name || '',
      assigned_to_ids: form.assigned_to_ids,
      assigned_to_names: assigneeNames,
    };
    const res = await fetch('/api/tasks', { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) {
      setForm({ title: '', description: '', customer_id: '', assigned_to_ids: [], due_date: '', priority: 'medium' });
      setShowForm(false);
      fetchTasks();
    }
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const res = await fetch('/api/tasks', {
      method: 'PUT', headers, body: JSON.stringify({ id: task.id, status: newStatus }),
    });
    if (res.ok) {
      // Targeted update instead of full refetch
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, is_overdue: newStatus === 'completed' ? false : t.is_overdue } : t));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    const res = await fetch('/api/tasks', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const toggleAssignee = (userId) => {
    setForm(prev => {
      const ids = prev.assigned_to_ids.includes(userId)
        ? prev.assigned_to_ids.filter(id => id !== userId)
        : [...prev.assigned_to_ids, userId];
      return { ...prev, assigned_to_ids: ids };
    });
  };

  /** Get display names for assignees (supports old single + new multi format) */
  const getAssigneeDisplay = (task) => {
    if (Array.isArray(task.assigned_to_names) && task.assigned_to_names.length > 0) {
      return task.assigned_to_names.join(', ');
    }
    return task.assigned_to_name || '';
  };

  const filtered = useMemo(() => tasks.filter(t => {
    if (filter === 'my') {
      if (Array.isArray(t.assigned_to_ids)) return t.assigned_to_ids.includes(user?.id);
      return t.assigned_to_id === user?.id;
    }
    if (filter === 'overdue') return t.is_overdue;
    if (filter === 'completed') return t.status === 'completed';
    return true;
  }), [tasks, filter, user?.id]);

  const priorityColors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-700',
  };

  const statusColors = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-gray-100 text-gray-600',
    overdue: 'bg-red-100 text-red-700',
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Add Task'}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: 'all', label: 'All' },
            { key: 'my', label: 'My Tasks' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'completed', label: 'Completed' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.key === 'overdue' && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                  {tasks.filter(t => t.is_overdue).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Add Task Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Task</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={set('title')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={set('description')} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select value={form.customer_id} onChange={set('customer_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} {c.company_name ? `(${c.company_name})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To {form.assigned_to_ids.length > 0 && <span className="text-indigo-600">({form.assigned_to_ids.length} selected)</span>}
                </label>
                <div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                  {allUsers.length === 0 ? (
                    <p className="text-xs text-gray-400 p-1">No users available</p>
                  ) : allUsers.map(u => (
                    <label key={u.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-gray-50 ${
                      form.assigned_to_ids.includes(u.id) ? 'bg-indigo-50' : ''
                    }`}>
                      <input
                        type="checkbox"
                        checked={form.assigned_to_ids.includes(u.id)}
                        onChange={() => toggleAssignee(u.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700">{u.full_name}</span>
                      <span className="text-xs text-gray-400">({u.organization_name})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input type="date" value={form.due_date} onChange={set('due_date')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={form.priority} onChange={set('priority')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                  Add Task
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Task Cards */}
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-400">
            No tasks found. Click &quot;Add Task&quot; to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(task => {
              const isOverdue = task.is_overdue;
              const assigneeDisplay = getAssigneeDisplay(task);
              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl shadow-sm border p-4 space-y-3 ${
                    isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm font-semibold ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                    </h3>
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${priorityColors[task.priority] || priorityColors.medium}`}>
                      {task.priority}
                    </span>
                  </div>

                  {task.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                  )}

                  <div className="space-y-1 text-xs text-gray-500">
                    {task.customer_name && (
                      <div><span className="text-gray-400">Customer:</span> {task.customer_name}</div>
                    )}
                    {assigneeDisplay && (
                      <div><span className="text-gray-400">Assigned:</span> {assigneeDisplay}</div>
                    )}
                    {task.due_date && (
                      <div className={isOverdue ? 'text-red-600 font-medium' : ''}>
                        <span className="text-gray-400">Due:</span> {task.due_date}
                        {isOverdue && ' (OVERDUE)'}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                      task.status === 'completed' ? statusColors.completed : isOverdue ? statusColors.overdue : statusColors.pending
                    }`}>
                      {task.status === 'completed' ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleStatus(task)}
                        className={`text-xs font-medium ${
                          task.status === 'completed' ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'
                        }`}
                      >
                        {task.status === 'completed' ? 'Reopen' : 'Complete'}
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
