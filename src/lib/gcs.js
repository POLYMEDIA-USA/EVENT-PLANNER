import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'event-planner-bucket';

// Data files matching the schema:
// organizations.json, users.json, events.json, customers.json,
// event_assignments.json, interactions.json, settings.json

async function readJSON(filename) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(filename);
    const [exists] = await file.exists();
    if (!exists) return filename === 'settings.json' ? {} : [];
    const [content] = await file.download();
    return JSON.parse(content.toString());
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return filename === 'settings.json' ? {} : [];
  }
}

async function writeJSON(filename, data) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(filename);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
    });
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
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

export { readJSON, writeJSON, listFiles, readText };
