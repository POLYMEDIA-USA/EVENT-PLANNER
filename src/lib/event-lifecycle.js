/**
 * Auto-migrate `in_the_room` leads to `attended` once their event has closed.
 *
 * Why this exists: when a lead is QR-scanned at the door, we set status
 * to `in_the_room` (a transient "currently here" state) instead of
 * `attended` (the final, historical state). After the event ends we want
 * the status to settle to `attended` so reports, post-event exports, and
 * the org-tree rollup behave the same as before this feature.
 *
 * Trigger: lazy. Callers (admin/supervisor-facing report and dashboard
 * endpoints) invoke this at the top of their handler. Idempotent — safe
 * to call multiple times.
 *
 * Closure rule: an event is "closed" when its `event_date` is strictly
 * before today (server-local). We don't have an explicit `event_end_time`
 * yet, so end-of-day-of-event is the cutoff. A lead is mapped to an event
 * via event_assignments.json — if any of the lead's assigned events has
 * a closed date, the lead is migrated.
 */

import { getCustomers, saveCustomers, getEvents, getEventAssignments } from './gcs';

function todayDateStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function isPastEventDate(eventDate) {
  if (!eventDate) return false;
  return eventDate < todayDateStr();
}

/**
 * Returns the number of leads that were migrated. Persists customers.json
 * only if anything changed.
 */
export async function migrateInTheRoomToAttended() {
  try {
    const [customers, events, assignments] = await Promise.all([
      getCustomers(), getEvents(), getEventAssignments(),
    ]);

    const eventClosed = new Map();
    events.forEach(e => eventClosed.set(e.id, isPastEventDate(e.event_date)));
    const closedEventIds = new Set([...eventClosed.entries()].filter(([, closed]) => closed).map(([id]) => id));
    if (closedEventIds.size === 0) return 0;

    // Map each customer_id to the set of event_ids they're attached to
    const customerEvents = new Map();
    assignments.forEach(a => {
      if (!a?.customer_id || !a?.event_id) return;
      if (!customerEvents.has(a.customer_id)) customerEvents.set(a.customer_id, new Set());
      customerEvents.get(a.customer_id).add(a.event_id);
    });

    let migrated = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      if (c.status !== 'in_the_room') continue;
      const myEventIds = customerEvents.get(c.id);
      if (!myEventIds) continue;
      // Migrate if ANY of this lead's events is closed
      let anyClosed = false;
      for (const eid of myEventIds) {
        if (closedEventIds.has(eid)) { anyClosed = true; break; }
      }
      if (!anyClosed) continue;
      c.status = 'attended';
      c.updated_at = now;
      customers[i] = c;
      migrated++;
    }

    if (migrated > 0) await saveCustomers(customers);
    return migrated;
  } catch (err) {
    console.error('migrateInTheRoomToAttended error:', err);
    return 0;
  }
}
