import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { readJSON, writeJSON } from '../../../../lib/gcs';
import { verifyToken } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const action = formData.get('action') || 'preview';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    let data = [];

    if (fileName.endsWith('.csv')) {
      const csvText = await file.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      data = parsed.data;
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      // Convert to objects if first row is headers
      if (data.length > 0) {
        const headers = data[0];
        data = data.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            obj[header] = row[i] || '';
          });
          return obj;
        });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use CSV or XLSX.' }, { status: 400 });
    }

    if (action === 'import') {
      // Import the data
      const customers = await readJSON('customers.json') || [];
      const organizations = await readJSON('organizations.json') || [];
      const eventId = formData.get('event_id');
      const columnMapping = JSON.parse(formData.get('column_mapping') || '{}');
      const selectedRows = JSON.parse(formData.get('selected_rows') || '[]');

      let imported = 0;
      let skipped = 0;
      const errors = [];
      const assignments = eventId ? (await readJSON('event_assignments.json') || []) : [];

      for (const rowIndex of selectedRows) {
        const row = data[rowIndex];
        if (!row) continue;

        // Build full_name from one or more columns
        let fullName = '';
        if (columnMapping.full_name_columns && Array.isArray(columnMapping.full_name_columns)) {
          fullName = columnMapping.full_name_columns
            .map(col => (row[col] || '').toString().trim())
            .filter(Boolean)
            .join(' ');
        } else if (columnMapping.full_name) {
          fullName = row[columnMapping.full_name] || '';
        }

        const lead = {
          id: crypto.randomUUID(),
          full_name: fullName.trim(),
          email: (row[columnMapping.email] || '').toString().trim().toLowerCase(),
          title: columnMapping.title ? (row[columnMapping.title] || '').toString().trim() : '',
          company_name: columnMapping.company_name ? (row[columnMapping.company_name] || '').toString().trim() : '',
          phone: columnMapping.phone ? (row[columnMapping.phone] || '').toString().trim() : '',
          alt_email: columnMapping.alt_email ? (row[columnMapping.alt_email] || '').toString().trim() : '',
          status: 'possible',
          input_by: user.full_name,
          input_by_org: user.organization_name,
          assigned_rep_id: '',
          assigned_rep_name: '',
          assigned_rep_org: '',
          organization_id: user.organization_id,
          added_by_user_id: user.id,
          added_by_name: user.full_name,
          notes: '',
          source: 'File Import',
          created_at: new Date().toISOString(),
        };

        // Validate required fields (only name + email)
        if (!lead.full_name || !lead.email) {
          errors.push({ row: rowIndex + 1, error: 'Missing required fields: name or email' });
          skipped++;
          continue;
        }

        // Check for duplicate email
        if (customers.some(c => c.email === lead.email)) {
          errors.push({ row: rowIndex + 1, error: 'Duplicate email' });
          skipped++;
          continue;
        }

        customers.push(lead);

        // If event_id provided, add to event_assignments
        if (eventId) {
          assignments.push({ event_id: eventId, customer_id: lead.id });
        }

        imported++;
      }

      await writeJSON('customers.json', customers);
      if (eventId && assignments.length > 0) {
        await writeJSON('event_assignments.json', assignments);
      }

      return NextResponse.json({
        imported,
        skipped,
        errors,
        message: `Imported ${imported} leads, skipped ${skipped}`,
      });
    } else {
      // Preview mode
      return NextResponse.json({
        data,
        columns: data.length > 0 ? Object.keys(data[0]) : [],
        rowCount: data.length,
      });
    }
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}