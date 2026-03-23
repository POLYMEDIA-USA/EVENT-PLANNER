'use client';

import { useState, useEffect, useRef } from 'react';

export default function FileImportWizard({ isOpen, onClose, onImport }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [nameColumns, setNameColumns] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState([]);
  const fileInputRef = useRef();

  const token = typeof window !== 'undefined' ? localStorage.getItem('cm_token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) fetchEvents();
  }, [isOpen]);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events', { headers: { ...headers, 'Content-Type': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const active = (data.events || []).filter(e => e.status === 'active' || e.status === 'upcoming' || !e.status);
        setEvents(active);
      }
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setPreviewData(data.data);
        setColumns(data.columns);
        setSelectedRows(data.data.map((_, i) => i));
        setStep('mapping');
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Upload failed');
    }
    setLoading(false);
  };

  const addNameColumn = (col) => {
    if (col && !nameColumns.includes(col)) {
      setNameColumns([...nameColumns, col]);
    }
  };

  const removeNameColumn = (col) => {
    setNameColumns(nameColumns.filter(c => c !== col));
  };

  const handleImport = async () => {
    if (nameColumns.length === 0 || !columnMapping.email) {
      alert('Please map at least Name column(s) and Email');
      return;
    }
    if (!eventId) {
      alert('Please select an event');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('action', 'import');
    formData.append('column_mapping', JSON.stringify({ ...columnMapping, full_name_columns: nameColumns }));
    formData.append('selected_rows', JSON.stringify(selectedRows));
    formData.append('event_id', eventId);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        onImport();
        handleClose();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Import failed');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setPreviewData([]);
    setColumns([]);
    setColumnMapping({});
    setNameColumns([]);
    setSelectedRows([]);
    setFilterText('');
    setSortColumn('');
    setSortDirection('asc');
    setEventId('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const filteredData = previewData.filter((row, i) =>
    selectedRows.includes(i) &&
    (!filterText || Object.values(row).some(val => val?.toString().toLowerCase().includes(filterText.toLowerCase())))
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn] || '';
    const bVal = b[sortColumn] || '';
    if (sortDirection === 'asc') return aVal.localeCompare(bVal);
    return bVal.localeCompare(aVal);
  });

  const toggleRowSelection = (index) => {
    setSelectedRows(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const selectAllRows = () => {
    const allIndices = previewData.map((_, i) => i);
    setSelectedRows(selectedRows.length === previewData.length ? [] : allIndices);
  };

  const deleteRow = (index) => {
    setSelectedRows(prev => prev.filter(i => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Import Leads from File</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">×</button>
          </div>

          {step === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select File (CSV or XLSX)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleFileUpload}
                  disabled={!file || loading}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Uploading...' : 'Upload & Preview'}
                </button>
                <button onClick={handleClose} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Column Mapping</h3>
                <p className="text-sm text-gray-600 mb-4">Map file columns to lead fields. Required: Name, Email, Event</p>

                {/* Full Name — multi-column picker */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name * (select one or more columns to combine)</label>
                  <div className="flex gap-2 mb-2">
                    <select
                      onChange={(e) => { addNameColumn(e.target.value); e.target.value = ''; }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      defaultValue=""
                    >
                      <option value="">-- Add Column --</option>
                      {columns.filter(c => !nameColumns.includes(c)).map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  {nameColumns.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {nameColumns.map((col, i) => (
                        <span key={col} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full">
                          {i > 0 && <span className="text-indigo-400 text-xs">+</span>}
                          {col}
                          <button onClick={() => removeNameColumn(col)} className="text-indigo-400 hover:text-indigo-600 ml-1">×</button>
                        </span>
                      ))}
                      {previewData.length > 0 && (
                        <span className="text-xs text-gray-500 self-center ml-2">
                          Preview: "{nameColumns.map(c => previewData[0][c] || '').filter(Boolean).join(' ')}"
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600">Select columns like "First Name" + "Last Name" to combine into Full Name</p>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {['email', 'title', 'company_name', 'phone', 'alt_email'].map(field => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                        {field.replace('_', ' ')} {field === 'email' ? '*' : ''}
                      </label>
                      <select
                        value={columnMapping[field] || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">-- Select Column --</option>
                        {columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event picker — required */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Event *</label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className={`w-full max-w-sm px-3 py-2 border rounded-lg text-sm ${!eventId ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                >
                  <option value="">-- Select Event --</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}{ev.date ? ` (${new Date(ev.date).toLocaleDateString()})` : ''}
                    </option>
                  ))}
                </select>
                {!eventId && <p className="text-xs text-amber-600 mt-1">An event must be selected to import leads</p>}
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Data Preview</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Filter rows..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <button onClick={selectAllRows} className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200">
                    {selectedRows.length === previewData.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto border border-gray-300 rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left">
                          <input
                            type="checkbox"
                            checked={selectedRows.length === previewData.length}
                            onChange={selectAllRows}
                            className="rounded"
                          />
                        </th>
                        {columns.map(col => (
                          <th key={col} className="px-2 py-1 text-left cursor-pointer hover:bg-gray-100" onClick={() => {
                            if (sortColumn === col) {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortColumn(col);
                              setSortDirection('asc');
                            }
                          }}>
                            {col} {sortColumn === col ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                          </th>
                        ))}
                        <th className="px-2 py-1 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.map((row, i) => {
                        const originalIndex = previewData.indexOf(row);
                        return (
                          <tr key={originalIndex} className="border-t">
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selectedRows.includes(originalIndex)}
                                onChange={() => toggleRowSelection(originalIndex)}
                                className="rounded"
                              />
                            </td>
                            {columns.map(col => (
                              <td key={col} className="px-2 py-1 truncate max-w-32">{row[col] || ''}</td>
                            ))}
                            <td className="px-2 py-1">
                              <button onClick={() => deleteRow(originalIndex)} className="text-red-500 text-xs">Delete</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {selectedRows.length} of {previewData.length} rows selected
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={selectedRows.length === 0 || loading || !eventId || nameColumns.length === 0 || !columnMapping.email}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Importing...' : `Import ${selectedRows.length} Leads`}
                </button>
                <button onClick={() => setStep('upload')} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                  Back
                </button>
                <button onClick={handleClose} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
