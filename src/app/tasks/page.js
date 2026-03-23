'use client';

import { useState, useEffect } from 'react';
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
    title: '', description: '', customer_id: '', assigned_to_id: '', due_date: '', priority: 'medium',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { fetchTasks(); fetchCustomers(); fetchUsers(); }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks', { headers });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/leads', { headers });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) { console.error(err); }
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
    const customer = customers.find(c => c.id === form.customer_id);
    const assignee = allUsers.find(u => u.id === form.assigned_to_id);
    const body = {
      ...form,
      customer_name: customer?.full_name || '',
      assigned_to_name: assignee?.full_name || '',
    };
    const res = await fetch('/api/tasks', { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) {
      setForm({ title: '', description: '', customer_id: '', assigned_to_id: '', due_date: '', priority: 'medium' });
      setShowForm(false);
      fetchTasks();
    }
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const res = await fetch('/api/tasks', {
      method: 'PUT', headers, body: JSON.stringify({ id: task.id, status: newStatus }),
    });
    if (res.ok) fetchTasks();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    await fetch('/api/tasks', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    fetchTasks();
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const now = new Date();
  const filtered = tasks.filter(t => {
    if (filter === 'my') return t.assigned_to_id === user?.id;
    if (filter === 'overdue') return t.is_overdue;
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                <select value={form.assigned_to_id} onChange={set('assigned_to_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                  <option value="">-- Select Assignee --</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
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
                    {task.assigned_to_name && (
                      <div><span className="text-gray-400">Assigned:</span> {task.assigned_to_name}</div>
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
