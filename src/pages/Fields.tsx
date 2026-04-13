import { useEffect, useState, useRef } from 'react';
import type { Field, CropType, Priority } from '../types';
import { generateId, saveField, deleteField } from '../utils/storage';
import type { AppData } from '../types';
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  X, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { VARIETIES_BY_CROP } from '../utils/varieties';

const CROPS: CropType[] = ['Corn', 'Canola', 'Soybeans', 'Wheat', 'Edible Beans', 'Oats', 'Potatoes'];

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

export default function Fields({ data, updateData }: Props) {
  const [editing, setEditing] = useState<Field | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteSelected, setPendingDeleteSelected] = useState(false);
  const [form, setForm] = useState(emptyField());
  const [filterCrop, setFilterCrop] = useState<CropType | ''>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'fieldNumber' | 'priority' | 'acres'>('fieldNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const excelRef = useRef<HTMLInputElement>(null);
  const varietyOptions = VARIETIES_BY_CROP[form.cropType] ?? [];

  useEffect(() => {
    const existing = new Set(data.fields.map(f => f.id));
    setSelectedIds(prev => prev.filter(id => existing.has(id)));
  }, [data.fields]);

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
    setPendingDeleteId(id);
    setPendingDeleteSelected(false);
  }

  function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    setPendingDeleteSelected(true);
    setPendingDeleteId(null);
  }

  function cancelPendingDelete() {
    setPendingDeleteId(null);
    setPendingDeleteSelected(false);
  }

  function confirmPendingDelete() {
    if (pendingDeleteSelected) {
      updateData(prev => selectedIds.reduce((acc, id) => deleteField(acc, id), prev));
      setSelectedIds([]);
      cancelPendingDelete();
      return;
    }

    if (pendingDeleteId) {
      updateData(prev => deleteField(prev, pendingDeleteId));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== pendingDeleteId));
      cancelPendingDelete();
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
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
      if (filterCrop && f.cropType !== filterCrop) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'fieldNumber') cmp = a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true });
      if (sortBy === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sortBy === 'acres') cmp = a.acres - b.acres;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const allVisibleSelected = filtered.length > 0 && filtered.every(field => selectedIds.includes(field.id));

  function toggleSelectAllVisible() {
    const visibleIds = filtered.map(field => field.id);
    if (visibleIds.length === 0) return;

    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  }

  const totalAcres = data.fields.reduce((s, f) => s + f.acres, 0);
  const cropAcres = CROPS.map(crop => ({
    crop,
    acres: data.fields
      .filter(field => field.cropType === crop)
      .reduce((sum, field) => sum + field.acres, 0),
  }));

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-green-900">Field Management</h1>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleDeleteSelected}
            className="btn-secondary text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
            disabled={selectedIds.length === 0}
            title="Delete selected fields"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected ({selectedIds.length})
          </button>
          <button
            onClick={() => excelRef.current?.click()}
            className="btn-secondary flex-1 sm:flex-none"
            title="Import from Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel
          </button>
          <button onClick={openNew} className="btn-primary flex-1 sm:flex-none justify-center">
            <Plus className="h-4 w-4" /> Add Field
          </button>
        </div>
      </div>

      <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <button
          type="button"
          onClick={() => setFilterCrop('')}
          className={`card text-center py-3 transition-colors ${filterCrop === '' ? 'ring-2 ring-green-400 bg-green-50' : 'hover:bg-gray-50'}`}
          title="Show all crops"
        >
          <div className="text-2xl font-bold text-green-800">{totalAcres.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Total Acres</div>
        </button>
        {cropAcres.map(({ crop, acres }) => (
          <button
            key={crop}
            type="button"
            onClick={() => setFilterCrop(prev => (prev === crop ? '' : crop))}
            className={`card text-center py-3 transition-colors ${filterCrop === crop ? 'ring-2 ring-green-400 bg-green-50' : 'hover:bg-gray-50'}`}
            title={`Filter by ${crop}`}
          >
            <div className="text-xl font-bold text-green-800">{acres.toFixed(1)}</div>
            <div className="text-xs text-gray-500">{crop} Acres</div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="space-y-3 sm:hidden">
        {filtered.length === 0 ? (
          <div className="card text-center py-10 text-gray-400">No fields found. Add a field to get started.</div>
        ) : filtered.map(field => (
          <div key={field.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-green-700 mt-1 shrink-0"
                  checked={selectedIds.includes(field.id)}
                  onChange={() => toggleSelected(field.id)}
                  aria-label={`Select field ${field.fieldNumber}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-green-900">{field.fieldNumber}</div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CROP_COLORS[field.cropType]}`}>
                      {field.cropType}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-600">
                    <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{field.variety || '—'}</span></div>
                    <div><span className="text-gray-500">Acres:</span> <span className="font-medium">{field.acres > 0 ? field.acres.toFixed(1) : '—'}</span></div>
                    <div><span className="text-gray-500">Priority:</span> <span className="font-medium capitalize">{field.priority}</span></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => openEdit(field)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => handleDelete(field.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors" aria-label={`Delete field ${field.fieldNumber}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block card p-0 overflow-hidden">
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
        <table className="w-full text-sm min-w-[36rem] sm:min-w-0">
          <thead>
            <tr className="bg-green-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-green-700"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  aria-label="Select all visible fields"
                />
              </th>
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
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No fields found. Add a field to get started.</td></tr>
            ) : filtered.map(field => (
              <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-green-700"
                    checked={selectedIds.includes(field.id)}
                    onChange={() => toggleSelected(field.id)}
                    aria-label={`Select field ${field.fieldNumber}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-green-900">{field.fieldNumber}</td>

                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CROP_COLORS[field.cropType]}`}>
                    {field.cropType}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{field.variety || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{field.acres > 0 ? field.acres.toFixed(1) : '—'}</td>
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
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-lg my-0 sm:my-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{isNew ? 'Add Field' : 'Edit Field'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Crop Type</label>
                  <select className="form-input" value={form.cropType} onChange={e => {
                    const nextCrop = e.target.value as CropType;
                    setForm(f => ({
                      ...f,
                      cropType: nextCrop,
                      variety: (VARIETIES_BY_CROP[nextCrop] ?? []).includes(f.variety) ? f.variety : '',
                    }));
                  }}>
                    {CROPS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Variety</label>
                  <select className="form-input" value={form.variety} onChange={e => setForm(f => ({ ...f, variety: e.target.value }))}>
                    <option value="">Select variety...</option>
                    {varietyOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
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

      {(pendingDeleteId || pendingDeleteSelected) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-5 border-b">
              <h2 className="text-lg font-semibold">Confirm Delete</h2>
            </div>
            <div className="p-5 text-sm text-gray-700">
              {pendingDeleteSelected
                ? `Delete ${selectedIds.length} selected ${selectedIds.length === 1 ? 'field' : 'fields'}?`
                : 'Delete this field?'}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button type="button" onClick={cancelPendingDelete} className="btn-secondary">Cancel</button>
              <button type="button" onClick={confirmPendingDelete} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
