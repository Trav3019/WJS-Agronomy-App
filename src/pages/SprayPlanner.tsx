import { useEffect, useRef, useState } from 'react';
import type { AppData, SprayApplication, Priority, CropType } from '../types';
import { generateId, saveSprayApplication, deleteSprayApplication } from '../utils/storage';
import { SPRAY_PRODUCT_OPTIONS } from '../utils/sprayCatalog';
import { Plus, X, Trash2, Eye, CheckCircle, Clock, XCircle, Syringe, AlertTriangle, ChevronDown } from 'lucide-react';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const METHODS = ['Ground Sprayer', 'Air (Aircraft)', 'High-Clearance Sprayer', 'Backpack Sprayer', 'Drone'];
const RATE_UNITS = ['L', 'mL', 'kg', 'g', 'lb', 'oz', 'gal', 'pt', 'qt'];
const CROPS: CropType[] = ['Corn', 'Canola', 'Soybeans', 'Wheat', 'Edible Beans', 'Oats', 'Potatoes'];
const PRODUCT_OPTIONS = SPRAY_PRODUCT_OPTIONS;

const emptyApp = (): Omit<SprayApplication, 'id' | 'createdAt' | 'updatedAt'> => ({
  fieldIds: [],
  fieldNumbers: [],
  plannedDate: new Date().toISOString().split('T')[0],
  appliedDate: undefined,
  product: '',
  products: [],
  chemicals: [],
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
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [listCropFilter, setListCropFilter] = useState<CropType | ''>('');
  const [listFieldFilter, setListFieldFilter] = useState('');
  const [cropFilter, setCropFilter] = useState<CropType | ''>('');
  const [fieldsDropdownOpen, setFieldsDropdownOpen] = useState(false);
  const [catalogInput, setCatalogInput] = useState('');
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);
  const fieldsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!fieldsDropdownRef.current?.contains(event.target as Node)) {
        setFieldsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function openNew() {
    setEditingId(null);
    setForm(emptyApp());
    setCropFilter('');
    setFieldsDropdownOpen(false);
    setCatalogDropdownOpen(false);
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
      products: app.products ?? [],
      chemicals: app.chemicals ?? (
        app.products?.map(p => ({ name: p, rate: app.rate ?? '', rateUnit: 'L' })) ??
        (app.product ? app.product.split(',').map(p => ({ name: p.trim(), rate: app.rate ?? '', rateUnit: 'L' })) : [])
      ),
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
    const selectedCrops = Array.from(new Set(
      app.fieldIds
        .map(fieldId => data.fields.find(f => f.id === fieldId)?.cropType)
        .filter((crop): crop is CropType => Boolean(crop))
    ));
    setCropFilter(selectedCrops.length === 1 ? selectedCrops[0] : '');
    setFieldsDropdownOpen(false);
    setCatalogDropdownOpen(false);
    setShowForm(true);
  }

  function toggleFieldSelection(fieldId: string, fieldNumber: string) {
    setForm(currentForm => {
      const isSelected = currentForm.fieldIds.includes(fieldId);

      if (isSelected) {
        return {
          ...currentForm,
          fieldIds: currentForm.fieldIds.filter(id => id !== fieldId),
          fieldNumbers: currentForm.fieldNumbers.filter(number => number !== fieldNumber),
        };
      }

      return {
        ...currentForm,
        fieldIds: [...currentForm.fieldIds, fieldId],
        fieldNumbers: [...currentForm.fieldNumbers, fieldNumber],
      };
    });
  }

  function handleSave() {
    const hasChemicals = (form.chemicals?.length ?? 0) > 0;
    if (!hasChemicals) return;
    const now = new Date().toISOString();
    const app: SprayApplication = {
      id: editingId ?? generateId(),
      ...form,
      chemicals: form.chemicals,
      products: form.chemicals?.map(c => c.name),
      product: form.chemicals?.map(c => c.name).join(', ') ?? '',
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
    .filter(a => !filterPriority || a.priority === filterPriority)
    .filter(a => !listCropFilter || a.fieldIds.some(fieldId => data.fields.find(f => f.id === fieldId)?.cropType === listCropFilter))
    .filter(a => !listFieldFilter || a.fieldNumbers.includes(listFieldFilter))
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

  const planned = data.sprayApplications.filter(a => a.status === 'planned');
  const applied = data.sprayApplications.filter(a => a.status === 'applied');
  const availableFields = data.fields
    .filter(field => !cropFilter || field.cropType === cropFilter)
    .sort((a, b) => a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' }));
  const listFieldOptions = Array.from(
    new Set(
      data.fields
        .filter(field => !listCropFilter || field.cropType === listCropFilter)
        .map(field => field.fieldNumber)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const formatChemicalRate = (chem: { rate?: string; rateUnit?: string }) => {
    if (!chem.rate) return '';
    if (chem.rateUnit) return `${chem.rate} ${chem.rateUnit}`;

    // Legacy values may already include units (e.g., "1.5 L").
    return /[a-zA-Z]/.test(chem.rate) ? chem.rate : `${chem.rate} L`;
  };
  const getDisplayChemicals = (app: SprayApplication) => {
    if ((app.chemicals?.length ?? 0) > 0) return app.chemicals ?? [];

    const legacyProducts = (app.products?.length ?? 0) > 0
      ? app.products!
      : (app.product || '').split(',').map(p => p.trim()).filter(Boolean);

    return legacyProducts.map(name => ({
      name,
      rate: app.rate || '',
      rateUnit: undefined,
    }));
  };
  const filteredCatalogOptions = PRODUCT_OPTIONS
    .filter(option => option.toLowerCase().includes(catalogInput.toLowerCase()))
    .slice(0, 8);

  function addChemicalFromCatalog(name: string) {
    const chemicalName = name.trim();
    if (!chemicalName) return;
    setForm(f => ({ ...f, chemicals: [...(f.chemicals ?? []), { name: chemicalName, rate: '', rateUnit: 'L' }] }));
    setCatalogInput('');
    setCatalogDropdownOpen(false);
  }

  useEffect(() => {
    if (listFieldFilter && !listFieldOptions.includes(listFieldFilter)) {
      setListFieldFilter('');
    }
  }, [listCropFilter, listFieldFilter, listFieldOptions]);

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
        <button
          type="button"
          onClick={() => {
            setFilterStatus('planned');
            setFilterPriority('');
          }}
          className={`card text-center py-3 border-blue-200 transition ${filterStatus === 'planned' && !filterPriority ? 'ring-2 ring-blue-400 bg-blue-50' : 'hover:bg-blue-50 cursor-pointer'}`}
        >
          <div className="text-2xl font-bold text-blue-700">{planned.length}</div>
          <div className="text-xs text-gray-500">Planned</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterStatus('applied');
            setFilterPriority('');
          }}
          className={`card text-center py-3 border-green-200 transition ${filterStatus === 'applied' && !filterPriority ? 'ring-2 ring-green-400 bg-green-50' : 'hover:bg-green-50 cursor-pointer'}`}
        >
          <div className="text-2xl font-bold text-green-700">{applied.length}</div>
          <div className="text-xs text-gray-500">Applied</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterStatus('planned');
            setFilterPriority('high');
          }}
          className={`card text-center py-3 border-red-200 transition ${filterStatus === 'planned' && filterPriority === 'high' ? 'ring-2 ring-red-400 bg-red-50' : 'hover:bg-red-50 cursor-pointer'}`}
        >
          <div className="text-2xl font-bold text-red-700">
            {data.sprayApplications.filter(a => a.priority === 'high' && a.status === 'planned').length}
          </div>
          <div className="text-xs text-gray-500">High Priority</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterStatus('');
            setFilterPriority('');
          }}
          className={`card text-center py-3 transition ${!filterStatus && !filterPriority ? 'ring-2 ring-gray-300 bg-gray-50' : 'hover:bg-gray-50 cursor-pointer'}`}
        >
          <div className="text-2xl font-bold text-gray-700">{data.sprayApplications.length}</div>
          <div className="text-xs text-gray-500">Total</div>
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select className="form-input w-40" value={listCropFilter} onChange={e => setListCropFilter(e.target.value as CropType | '')}>
          <option value="">All Crops</option>
          {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-input w-40" value={listFieldFilter} onChange={e => setListFieldFilter(e.target.value)}>
          <option value="">All Fields</option>
          {listFieldOptions.map(fieldNumber => (
            <option key={fieldNumber} value={fieldNumber}>Field {fieldNumber}</option>
          ))}
        </select>
      </div>

      {/* Applications list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            No spray applications yet. Click "New Application" to plan one.
          </div>
        ) : filtered.map(app => {
          const displayChemicals = getDisplayChemicals(app);
          const fieldCrops = Array.from(new Set(
            data.fields
              .filter(f => app.fieldIds.includes(f.id) || app.fieldNumbers.includes(f.fieldNumber))
              .map(f => f.cropType)
          ));
          return (
          <div key={app.id} className={`card hover:shadow-md transition-shadow ${app.priority === 'high' && app.status === 'planned' ? 'border-red-200 bg-red-50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Syringe className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-900">{app.fieldNumbers.length > 0 ? `Field ${app.fieldNumbers.join(', ')}` : 'All Fields'}</span>
                  <StatusBadge status={app.status} />
                  {app.priority === 'high' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                </div>
                <div className="text-xs text-gray-500 space-x-3">
                  <span>Crop: {fieldCrops.length > 0 ? fieldCrops.join(', ') : 'N/A'}</span>
                  {app.status === 'applied' && app.appliedDate && <span>Applied: {app.appliedDate}</span>}
                </div>
                {displayChemicals.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    <ul className="list-disc pl-5 text-sm text-gray-600">
                      {displayChemicals.map((c, idx) => (
                        <li key={`${app.id}-${c.name}-${idx}`}>
                          {c.name}
                          {c.rate ? ` - ${formatChemicalRate(c)}` : ' - n/a'}
                        </li>
                      ))}
                    </ul>
                    <div className="text-sm text-gray-600">Method: {app.applicationMethod}</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 mt-1">Method: {app.applicationMethod}</div>
                )}
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                {app.status === 'planned' && (
                  <button
                    onClick={() => markApplied(app)}
                    className="text-green-600 hover:bg-green-50 p-1.5 rounded-md"
                    title="Mark applied"
                    aria-label="Mark applied"
                  >
                    <CheckCircle className="h-4 w-4" />
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
        )})}
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
              {/* Crop filter */}
              <div>
                <label className="form-label">Crop Type</label>
                <select
                  className="form-input w-full"
                  value={cropFilter}
                  onChange={e => {
                    setCropFilter(e.target.value as CropType | '');
                    setForm(f => ({ ...f, fieldIds: [], fieldNumbers: [] }));
                    setFieldsDropdownOpen(false);
                  }}
                >
                  <option value="">All Crops</option>
                  {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Field selection - dropdown */}
              <div ref={fieldsDropdownRef} className="relative">
                <label className="form-label">Fields to Spray *</label>
                <button
                  type="button"
                  className="form-input w-full flex items-center justify-between text-left"
                  onClick={() => setFieldsDropdownOpen(open => !open)}
                >
                  <span className={form.fieldNumbers.length > 0 ? 'text-gray-900' : 'text-gray-400'}>
                    {form.fieldNumbers.length > 0
                      ? form.fieldNumbers.join(', ')
                      : 'Select field(s)...'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${fieldsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {fieldsDropdownOpen && (
                  <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="max-h-64 overflow-y-auto p-2">
                      {availableFields.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-400">No fields available for this crop.</div>
                      ) : availableFields.map(field => (
                        <label
                          key={field.id}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer ${form.fieldIds.includes(field.id) ? 'bg-green-50 text-green-800' : 'hover:bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={form.fieldIds.includes(field.id)}
                            onChange={() => toggleFieldSelection(field.id, field.fieldNumber)}
                            className="accent-green-600"
                          />
                          <span className="font-medium">{field.fieldNumber}</span>
                          <span className="text-xs text-gray-500">{field.cropType}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                      <span className="text-xs text-gray-500">{form.fieldIds.length} selected</span>
                      <button
                        type="button"
                        className="text-xs font-medium text-green-700 hover:text-green-800"
                        onClick={() => setForm(f => ({ ...f, fieldIds: [], fieldNumbers: [] }))}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
                {form.fieldNumbers.length > 0 && (
                  <p className="text-xs text-green-700 mt-1">Selected: {form.fieldNumbers.join(', ')}</p>
                )}
              </div>

              {/* Chemicals & Rates */}
              <div>
                <label className="form-label">Chemicals & Rates *</label>
                <div className="space-y-2">
                  {(form.chemicals ?? []).map((chem, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        className="form-input flex-1"
                        value={chem.name}
                        onChange={e => setForm(f => ({
                          ...f,
                          chemicals: (f.chemicals ?? []).map((c, i) => i === idx ? { ...c, name: e.target.value } : c),
                        }))}
                        placeholder="Chemical name"
                      />
                      <div className="w-44 flex gap-2">
                        <input
                          className="form-input"
                          value={chem.rate}
                          onChange={e => setForm(f => ({
                            ...f,
                            chemicals: (f.chemicals ?? []).map((c, i) => i === idx ? { ...c, rate: e.target.value } : c),
                          }))}
                          placeholder="Rate"
                        />
                        <select
                          className="form-input w-20"
                          value={chem.rateUnit ?? 'L'}
                          onChange={e => setForm(f => ({
                            ...f,
                            chemicals: (f.chemicals ?? []).map((c, i) => i === idx ? { ...c, rateUnit: e.target.value } : c),
                          }))}
                        >
                          {RATE_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, chemicals: (f.chemicals ?? []).filter((_, i) => i !== idx) }))} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <div className="flex gap-2">
                        <input
                          className="form-input w-full"
                          value={catalogInput}
                          onChange={e => setCatalogInput(e.target.value)}
                          onFocus={() => setCatalogDropdownOpen(true)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addChemicalFromCatalog(catalogInput);
                            }
                          }}
                          placeholder="Search/add from catalog"
                        />
                        <button
                          type="button"
                          className="btn-secondary px-2"
                          onClick={() => setCatalogDropdownOpen(open => !open)}
                          title="Toggle product dropdown"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${catalogDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {(catalogDropdownOpen || catalogInput.trim()) && filteredCatalogOptions.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                          {filteredCatalogOptions.map(option => (
                            <button
                              key={option}
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-green-50"
                              onClick={() => addChemicalFromCatalog(option)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary text-xs px-3 whitespace-nowrap"
                      onClick={() => addChemicalFromCatalog(catalogInput)}
                    >
                      Add
                    </button>
                    <button type="button" className="btn-secondary text-xs px-3 whitespace-nowrap" onClick={() => setForm(f => ({ ...f, chemicals: [...(f.chemicals ?? []), { name: '', rate: '', rateUnit: 'L' }] }))}>
                      + Custom
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Water Volume</label>
                  <input className="form-input" value={form.waterVolume} onChange={e => setForm(f => ({ ...f, waterVolume: e.target.value }))} placeholder="e.g. 15 gal/ac" />
                </div>
                <div>
                  <label className="form-label">Application Method</label>
                  <select className="form-input" value={form.applicationMethod} onChange={e => setForm(f => ({ ...f, applicationMethod: e.target.value }))}>
                    {METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Applied Date</label>
                  <input type="date" className="form-input" value={form.appliedDate ?? ''} onChange={e => setForm(f => ({ ...f, appliedDate: e.target.value || undefined }))} />
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
                <label className="form-label">Notes</label>
                <textarea className="form-input resize-none" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes, pre/post conditions..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!(form.chemicals?.length ?? 0) || form.fieldIds.length === 0}>
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
              <h2 className="text-lg font-semibold">{(viewApp.chemicals?.length ?? 0) > 0 ? viewApp.chemicals!.map(c => c.name).join(', ') : viewApp.products?.join(', ') || viewApp.product}</h2>
              <button onClick={() => setViewApp(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={viewApp.status} />
                {viewApp.priority === 'high' && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">High Priority</span>}
              </div>
              {getDisplayChemicals(viewApp).length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Chemicals & Rates</div>
                  <div className="space-y-1">
                    {getDisplayChemicals(viewApp).map((c, i) => (
                      <div key={i} className="bg-gray-50 rounded px-3 py-1.5">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-gray-600"> - {c.rate ? formatChemicalRate(c) : 'n/a'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {[
                ['Fields', viewApp.fieldNumbers.join(', ') || 'All Fields'],
                ['Water Volume', viewApp.waterVolume],
                ['Method', viewApp.applicationMethod],
                ['Applied Date', viewApp.appliedDate],
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
