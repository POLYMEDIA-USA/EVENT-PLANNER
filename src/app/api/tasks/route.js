export const dynamic = 'force-dynamic';

import { userMatchesToken } from '@/lib/auth';
import { getUsers, getTasks, saveTasks } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

async function authenticate(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const users = await getUsers();
  return users.find(u => userMatchesToken(u, token)) || null;
}

/** Check if a user is assigned to a task (supports both old single and new multi format) */
function isAssigned(task, userId) {
  if (Array.isArray(task.assigned_to_ids)) {
    return task.assigned_to_ids.includes(userId);
  }
  return task.assigned_to_id === userId;
}

export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assigned_to');
    const customerId = searchParams.get('customer_id');

    let tasks = await getTasks();
    const now = new Date();

    // Mark overdue tasks
    tasks = tasks.map(t => {
      const isOverdue = t.status !== 'completed' && t.due_date && new Date(t.due_date) < now;
      return { ...t, is_overdue: isOverdue };
    });

    if (assignedTo) {
      tasks = tasks.filter(t => isAssigned(t, assignedTo));
    }
    if (customerId) {
      tasks = tasks.filter(t => t.customer_id === customerId);
    }

    // Non-admin/supervisor only see their own tasks
    if (user.role !== 'admin' && user.role !== 'supervisor') {
      tasks = tasks.filter(t => isAssigned(t, user.id));
    }

    return Response.json({ tasks: tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
  } catch (err) {
    console.error('Tasks GET error:', err);
    return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { customer_id, customer_name, assigned_to_ids, assigned_to_names,
            assigned_to_id, assigned_to_name,
            event_id, title, description, due_date, priority } = await request.json();

    if (!title) {
      return Response.json({ error: 'Title is required' }, { status: 400 });
    }

    // Support both old single and new multi format
    const finalIds = assigned_to_ids || (assigned_to_id ? [assigned_to_id] : []);
    const finalNames = assigned_to_names || (assigned_to_name ? [assigned_to_name] : []);

    const tasks = await getTasks();
    const task = {
      id: uuidv4(),
      customer_id: customer_id || '',
      customer_name: customer_name || '',
      assigned_to_ids: finalIds,
      assigned_to_names: finalNames,
      // Keep legacy fields for backward compat display
      assigned_to_id: finalIds[0] || '',
      assigned_to_name: finalNames[0] || '',
      event_id: event_id || '',
      title,
      description: description || '',
      due_date: due_date || '',
      priority: priority || 'medium',
      status: 'pending',
      created_by_id: user.id,
      created_by_name: user.full_name,
      created_at: new Date().toISOString(),
    };

    tasks.push(task);
    await saveTasks(tasks);

    return Response.json({ task });
  } catch (err) {
    console.error('Tasks POST error:', err);
    return Response.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, ...updates } = await request.json();
    const tasks = await getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return Response.json({ error: 'Task not found' }, { status: 404 });

    // Non-admin/supervisor can only update tasks assigned to them
    if (user.role !== 'admin' && user.role !== 'supervisor' && !isAssigned(tasks[idx], user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { created_by_id, created_by_name, created_at, ...safeUpdates } = updates;

    // If multi-assign fields are being updated, also update legacy single fields
    if (safeUpdates.assigned_to_ids) {
      safeUpdates.assigned_to_id = safeUpdates.assigned_to_ids[0] || '';
      safeUpdates.assigned_to_name = (safeUpdates.assigned_to_names || [])[0] || '';
    }

    if (safeUpdates.status === 'completed') {
      safeUpdates.completed_at = new Date().toISOString();
    }
    if (safeUpdates.status === 'pending') {
      safeUpdates.completed_at = '';
    }
    tasks[idx] = { ...tasks[idx], ...safeUpdates, updated_at: new Date().toISOString() };
    await saveTasks(tasks);

    return Response.json({ task: tasks[idx] });
  } catch (err) {
    console.error('Tasks PUT error:', err);
    return Response.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await request.json();
    let tasks = await getTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

    if (user.role !== 'admin' && user.role !== 'supervisor' && !isAssigned(task, user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    tasks = tasks.filter(t => t.id !== id);
    await saveTasks(tasks);

    return Response.json({ success: true });
  } catch (err) {
    console.error('Tasks DELETE error:', err);
    return Response.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
