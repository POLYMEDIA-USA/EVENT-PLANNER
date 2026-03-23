import crypto from 'crypto';

export async function logAudit({ user_id, user_name, action, entity_type, entity_id, details }) {
  const { getAuditLog, saveAuditLog } = await import('./gcs');
  const log = await getAuditLog();
  log.push({
    id: crypto.randomUUID(),
    user_id,
    user_name,
    action,
    entity_type,
    entity_id,
    details,
    created_at: new Date().toISOString(),
  });
  // Keep last 1000 entries
  if (log.length > 1000) log.splice(0, log.length - 1000);
  await saveAuditLog(log);
}
