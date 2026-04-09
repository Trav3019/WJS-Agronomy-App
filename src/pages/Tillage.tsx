import { useEffect, useState } from 'react';
import type { AppData, TillageReport } from '../types';
import { generateId, saveTillageReport, deleteTillageReport } from '../utils/storage';
import { Plus, Trash2, Eye, X } from 'lucide-react';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const METHODS = [
  'Heavy Salford',
  'Light Salford',
  '2680H',
  'Tiller',
  'Power Hiller',
  'Harrow',
  '2410',
  'Field Cultivator',
  'Row Crop Cultivator',
  '980',
  '985',
];
const DEPTH_OPTIONS = Array.from({ length: 33 }, (_, i) => (i * 0.25).toString());

export default function Tillage({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewReport, setViewReport] = useState<TillageReport | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const orderedFields = [...data.fields].sort((a, b) => {
    const cropCmp = a.cropType.localeCompare(b.cropType);
    if (cropCmp !== 0) return cropCmp;
    return a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' });
  });
  const fieldOptions = Array.from(
    new Set(
      orderedFields
        .filter(f => !cropFilter || f.cropType === cropFilter)
        .map(f => f.fieldNumber)
    )
  );
  const cropOptions = Array.from(new Set(data.fields.map(f => f.cropType))).sort((a, b) => a.localeCompare(b));
  const fieldById = new Map(data.fields.map(f => [f.id, f]));

  useEffect(() => {
    if (fieldFilter && !fieldOptions.includes(fieldFilter)) {
      setFieldFilter('');
    }
  }, [cropFilter, fieldFilter, fieldOptions]);
  const [form, setForm] = useState({
    fieldId: '',
    date: new Date().toISOString().split('T')[0],
    method: METHODS[0],
    depthInches: '',
    notes: '',
  });

  function openNew() {
    setEditingId(null);
    setForm({
      fieldId: '',
      date: new Date().toISOString().split('T')[0],
      method: METHODS[0],
      depthInches: '',
      notes: '',
    });
    setShowForm(true);
  }

  function openEdit(report: TillageReport) {
    setEditingId(report.id);
    setForm({
      fieldId: report.fieldId,
      date: report.date,
      method: report.method,
      depthInches: report.depthInches?.toString() ?? '',
      notes: report.notes ?? '',
    });
    setShowForm(true);
  }

  function handleSave() {
    const selectedField = data.fields.find(f => f.id === form.fieldId);
    if (!selectedField) return;
    const now = new Date().toISOString();
    updateData(prev => saveTillageReport(prev, {
      id: editingId ?? generateId(),
      fieldId: selectedField.id,
      fieldNumber: selectedField.fieldNumber,
      date: form.date,
      method: form.method,
      depthInches: form.depthInches ? Number(form.depthInches) : undefined,
      notes: form.notes.trim() || undefined,
      createdAt: editingId
        ? (data.tillageReports.find(r => r.id === editingId)?.createdAt ?? now)
        : now,
    }));
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this tillage report?')) return;
    updateData(prev => deleteTillageReport(prev, id));
    setViewReport(null);
  }

  const reports = data.tillageReports
    .filter(r => {
      const fieldMatches = !fieldFilter || r.fieldNumber === fieldFilter;
      const cropType = fieldById.get(r.fieldId)?.cropType ?? '';
      const cropMatches = !cropFilter || cropType === cropFilter;
      return fieldMatches && cropMatches;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-green-900">Tillage</h1>
        <p className="text-sm text-gray-500 mt-1">Track tillage operations by field and date.</p>
      </div>

      <div className="flex items-end gap-2 flex-wrap sm:flex-nowrap">
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto flex-1 sm:flex-none">
          <select
            className="form-input w-full sm:w-40"
            value={fieldFilter}
            onChange={e => setFieldFilter(e.target.value)}
          >
            <option value="">All fields</option>
            {fieldOptions.map(fieldNumber => (
              <option key={fieldNumber} value={fieldNumber}>Field {fieldNumber}</option>
            ))}
          </select>
          <select
            className="form-input w-full sm:w-40"
            value={cropFilter}
            onChange={e => setCropFilter(e.target.value)}
          >
            <option value="">All crops</option>
            {cropOptions.map(crop => (
              <option key={crop} value={crop}>{crop}</option>
            ))}
          </select>
        </div>
        <button onClick={openNew} className="btn-primary whitespace-nowrap">
          <Plus className="h-4 w-4" /> New Report
        </button>
      </div>

      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">No tillage reports yet. Click "New Report" to add one.</div>
        ) : (
          <>
            {reports.map(r => (
              <div key={r.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-green-900">Field {r.fieldNumber}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {r.date} · {fieldById.get(r.fieldId)?.cropType ?? 'Unknown crop'} · {r.method}{r.depthInches ? ` · ${r.depthInches} in` : ''}
                    </div>
                    {r.notes && <div className="text-sm text-gray-600 mt-1 truncate">{r.notes}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setViewReport(r)} className="btn-secondary text-xs py-1.5 px-2.5">
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    <button onClick={() => openEdit(r)} className="btn-secondary text-xs py-1.5 px-2.5">Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Tillage Report' : 'New Tillage Report'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Field</label>
                  <select className="form-input" value={form.fieldId} onChange={e => setForm(f => ({ ...f, fieldId: e.target.value }))}>
                    <option value="">Select field...</option>
                    {orderedFields.map(field => (
                      <option key={field.id} value={field.id}>{field.fieldNumber} ({field.cropType})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Method</label>
                  <select className="form-input" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                    {METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Depth (inches)</label>
                  <select className="form-input" value={form.depthInches} onChange={e => setForm(f => ({ ...f, depthInches: e.target.value }))}>
                    <option value="">Select depth...</option>
                    {DEPTH_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input resize-none" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.fieldId}>Save Report</button>
            </div>
          </div>
        </div>
      )}

      {viewReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Tillage Report - Field {viewReport.fieldNumber}</h2>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-2 text-sm">
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewReport.date}</span></div>
              <div><span className="text-gray-500">Method:</span> <span className="font-medium">{viewReport.method}</span></div>
              {viewReport.depthInches !== undefined && <div><span className="text-gray-500">Depth:</span> <span className="font-medium">{viewReport.depthInches} in</span></div>}
              {viewReport.notes && <div className="bg-gray-50 rounded-lg p-3 text-gray-600 mt-2">{viewReport.notes}</div>}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => handleDelete(viewReport.id)} className="btn-danger">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button onClick={() => { openEdit(viewReport); setViewReport(null); }} className="btn-primary">Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
