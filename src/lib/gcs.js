import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'event-planner-bucket';

// ── In-memory cache with TTL ──────────────────────────────────────────────────
// Eliminates redundant GCS reads within the same time window.
// Every successful read is cached; every write invalidates the cache for that file.
const CACHE_TTL_MS = 5000; // 5 seconds
const cache = new Map(); // filename → { data, ts }

// Dedup in-flight reads so concurrent calls for the same file share one download
const inflight = new Map(); // filename → Promise

function getCached(filename) {
  const entry = cache.get(filename);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  return undefined;
}

function setCache(filename, data) {
  cache.set(filename, { data, ts: Date.now() });
}

function invalidateCache(filename) {
  cache.delete(filename);
}

// Data files matching the schema:
// organizations.json, users.json, events.json, customers.json,
// event_assignments.json, interactions.json, settings.json

async function readJSON(filename) {
  // Return from cache if fresh
  const cached = getCached(filename);
  if (cached !== undefined) return cached;

  // Dedup: if another caller is already fetching this file, piggyback on that promise
  if (inflight.has(filename)) return inflight.get(filename);

  const promise = (async () => {
    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const file = bucket.file(filename);
      const [exists] = await file.exists();
      if (!exists) {
        const empty = filename === 'settings.json' ? {} : [];
        setCache(filename, empty);
        return empty;
      }
      const [content] = await file.download();
      const data = JSON.parse(content.toString());
      setCache(filename, data);
      return data;
    } catch (err) {
      console.error(`Error reading ${filename}:`, err);
      return filename === 'settings.json' ? {} : [];
    } finally {
      inflight.delete(filename);
    }
  })();

  inflight.set(filename, promise);
  return promise;
}

async function writeJSON(filename, data) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(filename);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
    });
    // Update cache with the data we just wrote so subsequent reads are instant
    setCache(filename, data);
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    invalidateCache(filename);
    return false;
  }
}

async function listFiles() {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const [files] = await bucket.getFiles();
    return files.map(file => file.name);
  } catch (err) {
    console.error('Error listing files:', err);
    return [];
  }
}

async function readText(filename) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(filename);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [content] = await file.download();
    return content.toString();
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return null;
  }
}

export async function getOrganizations() { return readJSON('organizations.json'); }
export async function saveOrganizations(data) { return writeJSON('organizations.json', data); }

export async function getUsers() { return readJSON('users.json'); }
export async function saveUsers(data) { return writeJSON('users.json', data); }

export async function getEvents() { return readJSON('events.json'); }
export async function saveEvents(data) { return writeJSON('events.json', data); }

export async function getCustomers() { return readJSON('customers.json'); }
export async function saveCustomers(data) { return writeJSON('customers.json', data); }

export async function getEventAssignments() { return readJSON('event_assignments.json'); }
export async function saveEventAssignments(data) { return writeJSON('event_assignments.json', data); }

export async function getInteractions() { return readJSON('interactions.json'); }
export async function saveInteractions(data) { return writeJSON('interactions.json', data); }

export async function getSettings() { return readJSON('settings.json'); }
export async function saveSettings(data) { return writeJSON('settings.json', data); }

export async function getEmailLogs() { return readJSON('email_logs.json'); }
export async function saveEmailLogs(data) { return writeJSON('email_logs.json', data); }

export async function getTasks() { return readJSON('tasks.json'); }
export async function saveTasks(data) { return writeJSON('tasks.json', data); }

export async function getAuditLog() { return readJSON('audit_log.json'); }
export async function saveAuditLog(data) { return writeJSON('audit_log.json', data); }

export async function getEmailTemplates() { return readJSON('email_templates.json'); }
export async function saveEmailTemplates(data) { return writeJSON('email_templates.json', data); }

export async function getTeamAttendance() { return readJSON('user_event_attendance.json'); }
export async function saveTeamAttendance(data) { return writeJSON('user_event_attendance.json', data); }

export { readJSON, writeJSON, listFiles, readText };
