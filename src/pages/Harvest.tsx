import { useState } from 'react';
import type { AppData, HarvestReport } from '../types';
import { generateId, saveHarvestReport, deleteHarvestReport } from '../utils/storage';
import { Plus, Trash2, Eye, X } from 'lucide-react';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const YIELD_UNITS = ['bu/ac', 't/ac', 'lbs/ac'];

export default function Harvest({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewReport, setViewReport] = useState<HarvestReport | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState('');
  const [form, setForm] = useState({
    fieldId: '',
    date: new Date().toISOString().split('T')[0],
    yieldValue: '',
    yieldUnit: YIELD_UNITS[0],
    moisture: '',
    notes: '',
  });

  function openNew() {
    setEditingId(null);
    setForm({
      fieldId: '',
      date: new Date().toISOString().split('T')[0],
      yieldValue: '',
      yieldUnit: YIELD_UNITS[0],
      moisture: '',
      notes: '',
    });
    setShowForm(true);
  }

  function openEdit(report: HarvestReport) {
    setEditingId(report.id);
    setForm({
      fieldId: report.fieldId,
      date: report.date,
      yieldValue: report.yieldValue?.toString() ?? '',
      yieldUnit: report.yieldUnit ?? YIELD_UNITS[0],
      moisture: report.moisture?.toString() ?? '',
      notes: report.notes ?? '',
    });
    setShowForm(true);
  }

  function handleSave() {
    const selectedField = data.fields.find(f => f.id === form.fieldId);
    if (!selectedField) return;
    const now = new Date().toISOString();
    updateData(prev => saveHarvestReport(prev, {
      id: editingId ?? generateId(),
      fieldId: selectedField.id,
      fieldNumber: selectedField.fieldNumber,
      cropType: selectedField.cropType,
      date: form.date,
      yieldValue: form.yieldValue ? Number(form.yieldValue) : undefined,
      yieldUnit: form.yieldUnit,
      moisture: form.moisture ? Number(form.moisture) : undefined,
      notes: form.notes.trim() || undefined,
      createdAt: editingId
        ? (data.harvestReports.find(r => r.id === editingId)?.createdAt ?? now)
        : now,
    }));
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this harvest report?')) return;
    updateData(prev => deleteHarvestReport(prev, id));
    setViewReport(null);
  }

  const reports = data.harvestReports
    .filter(r => !fieldFilter || r.fieldNumber.toLowerCase().includes(fieldFilter.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-green-900">Harvest</h1>
        <p className="text-sm text-gray-500 mt-1">Track harvest outcomes by field and date.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <input
          className="form-input max-w-xs"
          placeholder="Filter by field #..."
          value={fieldFilter}
          onChange={e => setFieldFilter(e.target.value)}
        />
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Report
        </button>
      </div>

      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">No harvest reports yet. Click "New Report" to add one.</div>
        ) : (
          <>
            {reports.map(r => (
              <div key={r.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-green-900">Field {r.fieldNumber} - {r.cropType}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {r.date}
                      {r.yieldValue !== undefined ? ` · ${r.yieldValue} ${r.yieldUnit ?? ''}` : ''}
                      {r.moisture !== undefined ? ` · ${r.moisture}% moisture` : ''}
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
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Harvest Report' : 'New Harvest Report'}</h2>
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
                    {data.fields.map(f => <option key={f.id} value={f.id}>{f.fieldNumber} - {f.cropType}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Yield</label>
                  <input type="number" step="0.1" className="form-input" value={form.yieldValue} onChange={e => setForm(f => ({ ...f, yieldValue: e.target.value }))} placeholder="Optional" />
                </div>
                <div>
                  <label className="form-label">Yield Unit</label>
                  <select className="form-input" value={form.yieldUnit} onChange={e => setForm(f => ({ ...f, yieldUnit: e.target.value }))}>
                    {YIELD_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Moisture (%)</label>
                  <input type="number" step="0.1" className="form-input" value={form.moisture} onChange={e => setForm(f => ({ ...f, moisture: e.target.value }))} placeholder="Optional" />
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
              <h2 className="text-lg font-semibold">Harvest Report - Field {viewReport.fieldNumber}</h2>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-2 text-sm">
              <div><span className="text-gray-500">Crop:</span> <span className="font-medium">{viewReport.cropType}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewReport.date}</span></div>
              {viewReport.yieldValue !== undefined && <div><span className="text-gray-500">Yield:</span> <span className="font-medium">{viewReport.yieldValue} {viewReport.yieldUnit ?? ''}</span></div>}
              {viewReport.moisture !== undefined && <div><span className="text-gray-500">Moisture:</span> <span className="font-medium">{viewReport.moisture}%</span></div>}
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
