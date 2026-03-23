import { useState, useRef } from 'react';
import type { Field, CropType, Priority } from '../types';
import { generateId, saveField, deleteField } from '../utils/storage';
import type { AppData } from '../types';
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  AlertTriangle, CheckCircle, Minus, Search, X, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

const CROPS: CropType[] = ['Corn', 'Canola', 'Soybeans', 'Wheat', 'Edible Beans', 'Oats', 'Potatoes'];
const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

const CROP_COLORS: Record<CropType, string> = {
  Corn: 'bg-yellow-100 text-yellow-800',
  Canola: 'bg-yellow-50 text-yellow-700',
  Soybeans: 'bg-green-100 text-green-800',
  Wheat: 'bg-amber-100 text-amber-800',
  'Edible Beans': 'bg-lime-100 text-lime-800',
  Oats: 'bg-stone-100 text-stone-700',
  Potatoes: 'bg-orange-100 text-orange-800',
};

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const emptyField = (): Omit<Field, 'id' | 'createdAt' | 'updatedAt'> => ({
  fieldNumber: '',
  cropType: 'Corn',
  variety: '',
  acres: 0,
  priority: 'medium',
  notes: '',
});

function PriorityIcon({ p }: { p: Priority }) {
  if (p === 'high') return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (p === 'low') return <CheckCircle className="h-4 w-4 text-green-500" />;
  return <Minus className="h-4 w-4 text-yellow-500" />;
}

export default function Fields({ data, updateData }: Props) {
  const [editing, setEditing] = useState<Field | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(emptyField());
  const [search, setSearch] = useState('');
  const [filterCrop, setFilterCrop] = useState<CropType | ''>('');
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [sortBy, setSortBy] = useState<'fieldNumber' | 'priority' | 'acres'>('fieldNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [quickFieldNum, setQuickFieldNum] = useState('');
  const [quickCrop, setQuickCrop] = useState<CropType>('Corn');
  const [quickAcres, setQuickAcres] = useState('');
  const excelRef = useRef<HTMLInputElement>(null);

  // Quick add
  function handleQuickAdd() {
    if (!quickFieldNum.trim()) return;
    const now = new Date().toISOString();
    const field: Field = {
      id: generateId(),
      fieldNumber: quickFieldNum.trim(),
      cropType: quickCrop,
      variety: '',
      acres: parseFloat(quickAcres) || 0,
      priority: 'medium',
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    updateData(prev => saveField(prev, field));
    setQuickFieldNum('');
    setQuickAcres('');
  }

  // Excel import
  function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
        const now = new Date().toISOString();
        rows.forEach(row => {
          // Try various column name formats
          const fieldNum = String(row['Field #'] || row['Field Number'] || row['FieldNumber'] || row['field_number'] || row['Field'] || '').trim();
          const cropRaw = String(row['Crop'] || row['Crop Type'] || row['CropType'] || row['crop'] || '').trim();
          const acresRaw = parseFloat(row['Acres'] || row['acres'] || row['Area'] || 0);
          const variety = String(row['Variety'] || row['variety'] || '').trim();

          if (!fieldNum) return;
          const cropType = CROPS.find(c => c.toLowerCase() === cropRaw.toLowerCase()) ?? 'Corn';
          const field: Field = {
            id: generateId(),
            fieldNumber: fieldNum,
            cropType,
            variety,
            acres: acresRaw,
            priority: 'medium',
            notes: '',
            createdAt: now,
            updatedAt: now,
          };
          updateData(prev => saveField(prev, field));
        });
        alert(`Imported ${rows.length} field(s) from Excel`);
      } catch (err) {
        alert('Failed to parse Excel file. Ensure columns: Field #, Crop, Acres');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  function openEdit(field: Field) {
    setEditing(field);
    setIsNew(false);
    setForm({
      fieldNumber: field.fieldNumber,
      cropType: field.cropType,
      variety: field.variety,
      acres: field.acres,
      priority: field.priority,
      notes: field.notes ?? '',
    });
  }

  function openNew() {
    setEditing({ id: '', createdAt: '', updatedAt: '' } as any);
    setIsNew(true);
    setForm(emptyField());
  }

  function handleSave() {
    if (!form.fieldNumber.trim()) return;
    const now = new Date().toISOString();
    const field: Field = {
      id: isNew ? generateId() : editing!.id,
      ...form,
      createdAt: isNew ? now : editing!.createdAt,
      updatedAt: now,
    };
    updateData(prev => saveField(prev, field));
    setEditing(null);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this field?')) return;
    updateData(prev => deleteField(prev, id));
  }

  function setPriority(id: string, priority: Priority) {
    const field = data.fields.find(f => f.id === id);
    if (!field) return;
    updateData(prev => saveField(prev, { ...field, priority, updatedAt: new Date().toISOString() }));
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

  const filtered = data.fields
    .filter(f => {
      const q = search.toLowerCase();
      if (q && !f.fieldNumber.toLowerCase().includes(q) && !f.variety.toLowerCase().includes(q)) return false;
      if (filterCrop && f.cropType !== filterCrop) return false;
      if (filterPriority && f.priority !== filterPriority) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'fieldNumber') cmp = a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true });
      if (sortBy === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sortBy === 'acres') cmp = a.acres - b.acres;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const totalAcres = filtered.reduce((s, f) => s + f.acres, 0);

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-900">Field Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => excelRef.current?.click()}
            className="btn-secondary"
            title="Import from Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel
          </button>
          <button onClick={openNew} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Field
          </button>
        </div>
      </div>

      <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />

      {/* Quick add bar */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Add Field</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="form-label">Field #</label>
            <input
              className="form-input w-28"
              placeholder="e.g. 01A"
              value={quickFieldNum}
              onChange={e => setQuickFieldNum(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            />
          </div>
          <div>
            <label className="form-label">Crop</label>
            <select className="form-input w-36" value={quickCrop} onChange={e => setQuickCrop(e.target.value as CropType)}>
              {CROPS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Acres</label>
            <input
              className="form-input w-24"
              type="number"
              placeholder="0"
              value={quickAcres}
              onChange={e => setQuickAcres(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            />
          </div>
          <button onClick={handleQuickAdd} className="btn-primary h-9 self-end">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              className="form-input pl-9"
              placeholder="Search field # or variety..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="form-input w-36" value={filterCrop} onChange={e => setFilterCrop(e.target.value as CropType | '')}>
            <option value="">All Crops</option>
            {CROPS.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="form-input w-36" value={filterPriority} onChange={e => setFilterPriority(e.target.value as Priority | '')}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          {(search || filterCrop || filterPriority) && (
            <button onClick={() => { setSearch(''); setFilterCrop(''); setFilterPriority(''); }} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {(['high', 'medium', 'low'] as Priority[]).map(p => {
          const count = data.fields.filter(f => f.priority === p).length;
          return (
            <div key={p} className={`card text-center py-3 ${p === 'high' ? 'border-red-200' : p === 'medium' ? 'border-yellow-200' : 'border-green-200'}`}>
              <div className="text-2xl font-bold">{count}</div>
              <div className={`text-xs font-medium capitalize ${p === 'high' ? 'text-red-600' : p === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                {p} priority
              </div>
            </div>
          );
        })}
        <div className="card text-center py-3 col-span-3 sm:col-span-3">
          <div className="text-2xl font-bold text-green-800">{totalAcres.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Total Filtered Acres</div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-green-50 border-b border-gray-200">
              <th className="text-left px-4 py-3">
                <button className="flex items-center gap-1 font-semibold text-gray-700 hover:text-green-800" onClick={() => toggleSort('fieldNumber')}>
                  Field # <SortIcon col="fieldNumber" />
                </button>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Crop</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Variety</th>
              <th className="text-left px-4 py-3">
                <button className="flex items-center gap-1 font-semibold text-gray-700 hover:text-green-800" onClick={() => toggleSort('acres')}>
                  Acres <SortIcon col="acres" />
                </button>
              </th>
              <th className="text-left px-4 py-3">
                <button className="flex items-center gap-1 font-semibold text-gray-700 hover:text-green-800" onClick={() => toggleSort('priority')}>
                  Priority <SortIcon col="priority" />
                </button>
              </th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No fields found. Add a field to get started.</td></tr>
            ) : filtered.map(field => (
              <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-green-900">{field.fieldNumber}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CROP_COLORS[field.cropType]}`}>
                    {field.cropType}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{field.variety || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{field.acres > 0 ? field.acres.toFixed(1) : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <PriorityIcon p={field.priority} />
                    <select
                      value={field.priority}
                      onChange={e => setPriority(field.id, e.target.value as Priority)}
                      className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer capitalize"
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(field)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(field.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{isNew ? 'Add Field' : 'Edit Field'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Field # *</label>
                  <input
                    className="form-input"
                    value={form.fieldNumber}
                    onChange={e => setForm(f => ({ ...f, fieldNumber: e.target.value }))}
                    placeholder="e.g. 01A, North-40"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label">Acres</label>
                  <input
                    className="form-input"
                    type="number"
                    value={form.acres || ''}
                    onChange={e => setForm(f => ({ ...f, acres: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Crop Type</label>
                  <select className="form-input" value={form.cropType} onChange={e => setForm(f => ({ ...f, cropType: e.target.value as CropType }))}>
                    {CROPS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Variety</label>
                  <input
                    className="form-input"
                    value={form.variety}
                    onChange={e => setForm(f => ({ ...f, variety: e.target.value }))}
                    placeholder="Variety name"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Priority</label>
                <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input resize-none"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.fieldNumber.trim()}>
                {isNew ? 'Add Field' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
