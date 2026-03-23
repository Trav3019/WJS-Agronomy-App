import { useState } from 'react';
import type { AppData, SprayApplication, Priority } from '../types';
import { generateId, saveSprayApplication, deleteSprayApplication } from '../utils/storage';
import { Plus, X, Trash2, Eye, CheckCircle, Clock, XCircle, Syringe, AlertTriangle } from 'lucide-react';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const METHODS = ['Ground Sprayer', 'Air (Aircraft)', 'High-Clearance Sprayer', 'Backpack Sprayer', 'Drone'];

const emptyApp = (): Omit<SprayApplication, 'id' | 'createdAt' | 'updatedAt'> => ({
  fieldIds: [],
  fieldNumbers: [],
  plannedDate: new Date().toISOString().split('T')[0],
  appliedDate: undefined,
  product: '',
  activeIngredient: '',
  rate: '',
  waterVolume: '',
  targetPest: '',
  applicationMethod: 'Ground Sprayer',
  sprayer: '',
  operator: '',
  status: 'planned',
  priority: 'medium',
  weatherAtApplication: '',
  notes: '',
});

function StatusBadge({ status }: { status: SprayApplication['status'] }) {
  if (status === 'applied') return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
      <CheckCircle className="h-3 w-3" /> Applied
    </span>
  );
  if (status === 'cancelled') return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
      <XCircle className="h-3 w-3" /> Cancelled
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
      <Clock className="h-3 w-3" /> Planned
    </span>
  );
}

export default function SprayPlanner({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewApp, setViewApp] = useState<SprayApplication | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyApp());
  const [filterStatus, setFilterStatus] = useState<SprayApplication['status'] | ''>('');

  function openNew() {
    setEditingId(null);
    setForm(emptyApp());
    setShowForm(true);
  }

  function openEdit(app: SprayApplication) {
    setEditingId(app.id);
    setForm({
      fieldIds: app.fieldIds,
      fieldNumbers: app.fieldNumbers,
      plannedDate: app.plannedDate,
      appliedDate: app.appliedDate,
      product: app.product,
      activeIngredient: app.activeIngredient ?? '',
      rate: app.rate,
      waterVolume: app.waterVolume ?? '',
      targetPest: app.targetPest,
      applicationMethod: app.applicationMethod,
      sprayer: app.sprayer ?? '',
      operator: app.operator ?? '',
      status: app.status,
      priority: app.priority,
      weatherAtApplication: app.weatherAtApplication ?? '',
      notes: app.notes,
    });
    setShowForm(true);
  }

  function toggleFieldSelection(fieldId: string, fieldNumber: string) {
    setForm(f => {
      const selected = f.fieldIds.includes(fieldId);
      return {
        ...f,
        fieldIds: selected ? f.fieldIds.filter(id => id !== fieldId) : [...f.fieldIds, fieldId],
        fieldNumbers: selected ? f.fieldNumbers.filter(n => n !== fieldNumber) : [...f.fieldNumbers, fieldNumber],
      };
    });
  }

  function handleSave() {
    if (!form.product.trim()) return;
    const now = new Date().toISOString();
    const app: SprayApplication = {
      id: editingId ?? generateId(),
      ...form,
      createdAt: editingId
        ? (data.sprayApplications.find(a => a.id === editingId)?.createdAt ?? now)
        : now,
      updatedAt: now,
    };
    updateData(prev => saveSprayApplication(prev, app));
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this spray application?')) return;
    updateData(prev => deleteSprayApplication(prev, id));
    setViewApp(null);
  }

  function markApplied(app: SprayApplication) {
    const updated: SprayApplication = {
      ...app,
      status: 'applied',
      appliedDate: app.appliedDate || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };
    updateData(prev => saveSprayApplication(prev, updated));
  }

  const filtered = data.sprayApplications
    .filter(a => !filterStatus || a.status === filterStatus)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

  const planned = data.sprayApplications.filter(a => a.status === 'planned');
  const applied = data.sprayApplications.filter(a => a.status === 'applied');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Spray Application Planner</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan, track and record crop protection applications</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Application
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center py-3 border-blue-200">
          <div className="text-2xl font-bold text-blue-700">{planned.length}</div>
          <div className="text-xs text-gray-500">Planned</div>
        </div>
        <div className="card text-center py-3 border-green-200">
          <div className="text-2xl font-bold text-green-700">{applied.length}</div>
          <div className="text-xs text-gray-500">Applied</div>
        </div>
        <div className="card text-center py-3 border-red-200">
          <div className="text-2xl font-bold text-red-700">
            {data.sprayApplications.filter(a => a.priority === 'high' && a.status === 'planned').length}
          </div>
          <div className="text-xs text-gray-500">High Priority</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-gray-700">{data.sprayApplications.length}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
      </div>

      {/* Urgent alert */}
      {planned.filter(a => a.priority === 'high').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-red-800 text-sm">High Priority Applications Pending</div>
            <div className="text-sm text-red-600 mt-1">
              {planned.filter(a => a.priority === 'high').map(a => (
                <span key={a.id} className="mr-2">Fields: {a.fieldNumbers.join(', ')} — {a.product}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3">
        <select className="form-input w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
          <option value="">All Status</option>
          <option value="planned">Planned</option>
          <option value="applied">Applied</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Applications list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            No spray applications yet. Click "New Application" to plan one.
          </div>
        ) : filtered.map(app => (
          <div key={app.id} className={`card hover:shadow-md transition-shadow ${app.priority === 'high' && app.status === 'planned' ? 'border-red-200 bg-red-50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Syringe className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-900">{app.product}</span>
                  <StatusBadge status={app.status} />
                  {app.priority === 'high' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                </div>
                <div className="text-xs text-gray-500 space-x-3">
                  <span>Fields: {app.fieldNumbers.length > 0 ? app.fieldNumbers.join(', ') : 'All'}</span>
                  <span>Planned: {app.plannedDate}</span>
                  {app.appliedDate && <span>Applied: {app.appliedDate}</span>}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Target: {app.targetPest} | Rate: {app.rate} | {app.applicationMethod}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                {app.status === 'planned' && (
                  <button onClick={() => markApplied(app)} className="btn-primary text-xs py-1.5 px-2.5">
                    <CheckCircle className="h-3.5 w-3.5" /> Mark Applied
                  </button>
                )}
                <button onClick={() => setViewApp(app)} className="btn-secondary text-xs py-1.5 px-2.5">
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                <button onClick={() => openEdit(app)} className="btn-secondary text-xs py-1.5 px-2.5">Edit</button>
                <button onClick={() => handleDelete(app.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Application' : 'New Spray Application'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Field selection */}
              <div>
                <label className="form-label">Fields to Spray</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                  {data.fields.length === 0 ? (
                    <p className="text-xs text-gray-400 col-span-4">No fields added yet.</p>
                  ) : data.fields.map(field => (
                    <label key={field.id} className={`flex items-center gap-1.5 cursor-pointer text-sm p-1.5 rounded-md transition-colors ${form.fieldIds.includes(field.id) ? 'bg-green-100 text-green-800' : 'hover:bg-gray-100'}`}>
                      <input
                        type="checkbox"
                        checked={form.fieldIds.includes(field.id)}
                        onChange={() => toggleFieldSelection(field.id, field.fieldNumber)}
                        className="accent-green-600"
                      />
                      <span className="font-medium">{field.fieldNumber}</span>
                      <span className="text-xs text-gray-500 hidden sm:inline">{field.cropType.split(' ')[0]}</span>
                    </label>
                  ))}
                </div>
                {form.fieldNumbers.length > 0 && (
                  <p className="text-xs text-green-700 mt-1">Selected: {form.fieldNumbers.join(', ')}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} placeholder="e.g. Roundup WeatherMax" />
                </div>
                <div>
                  <label className="form-label">Active Ingredient</label>
                  <input className="form-input" value={form.activeIngredient} onChange={e => setForm(f => ({ ...f, activeIngredient: e.target.value }))} placeholder="e.g. Glyphosate" />
                </div>
                <div>
                  <label className="form-label">Rate</label>
                  <input className="form-input" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="e.g. 1.5 L/ac" />
                </div>
                <div>
                  <label className="form-label">Water Volume</label>
                  <input className="form-input" value={form.waterVolume} onChange={e => setForm(f => ({ ...f, waterVolume: e.target.value }))} placeholder="e.g. 15 gal/ac" />
                </div>
                <div>
                  <label className="form-label">Target Pest / Purpose</label>
                  <input className="form-input" value={form.targetPest} onChange={e => setForm(f => ({ ...f, targetPest: e.target.value }))} placeholder="e.g. Broadleaf weeds" />
                </div>
                <div>
                  <label className="form-label">Application Method</label>
                  <select className="form-input" value={form.applicationMethod} onChange={e => setForm(f => ({ ...f, applicationMethod: e.target.value }))}>
                    {METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Planned Date</label>
                  <input type="date" className="form-input" value={form.plannedDate} onChange={e => setForm(f => ({ ...f, plannedDate: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Applied Date</label>
                  <input type="date" className="form-input" value={form.appliedDate ?? ''} onChange={e => setForm(f => ({ ...f, appliedDate: e.target.value || undefined }))} />
                </div>
                <div>
                  <label className="form-label">Sprayer / Equipment</label>
                  <input className="form-input" value={form.sprayer} onChange={e => setForm(f => ({ ...f, sprayer: e.target.value }))} placeholder="e.g. Case IH 4440" />
                </div>
                <div>
                  <label className="form-label">Operator</label>
                  <input className="form-input" value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value }))} placeholder="Operator name" />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                    <option value="planned">Planned</option>
                    <option value="applied">Applied</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Weather at Application</label>
                <input className="form-input" value={form.weatherAtApplication} onChange={e => setForm(f => ({ ...f, weatherAtApplication: e.target.value }))} placeholder="e.g. 20°C, 10 km/h SW, Sunny" />
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input resize-none" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes, pre/post conditions..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.product.trim()}>
                {editingId ? 'Save Changes' : 'Save Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{viewApp.product}</h2>
              <button onClick={() => setViewApp(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={viewApp.status} />
                {viewApp.priority === 'high' && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">High Priority</span>}
              </div>
              {[
                ['Fields', viewApp.fieldNumbers.join(', ') || 'All Fields'],
                ['Active Ingredient', viewApp.activeIngredient],
                ['Rate', viewApp.rate],
                ['Water Volume', viewApp.waterVolume],
                ['Target', viewApp.targetPest],
                ['Method', viewApp.applicationMethod],
                ['Planned Date', viewApp.plannedDate],
                ['Applied Date', viewApp.appliedDate],
                ['Sprayer', viewApp.sprayer],
                ['Operator', viewApp.operator],
                ['Weather', viewApp.weatherAtApplication],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex gap-2">
                  <span className="text-gray-500 w-32 shrink-0">{k}:</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              {viewApp.notes && (
                <div className="bg-gray-50 rounded-lg p-3 mt-2 text-gray-600">{viewApp.notes}</div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => handleDelete(viewApp.id)} className="btn-danger">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button onClick={() => { openEdit(viewApp); setViewApp(null); }} className="btn-primary">Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
