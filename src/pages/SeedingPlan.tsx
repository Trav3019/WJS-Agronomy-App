import { useState, lazy, Suspense } from 'react';
import type { AppData, SeedingPlan, CropType, GeoLocation } from '../types';
import { generateId, saveSeedingPlan, deleteSeedingPlan } from '../utils/storage';
import { VARIETIES_BY_CROP } from '../utils/varieties';
import { CalendarDays, Plus, X, Trash2, Eye, MapPin } from 'lucide-react';

const GeoMap = lazy(() => import('../components/GeoMap'));

const CROPS: CropType[] = ['Corn', 'Canola', 'Soybeans', 'Wheat', 'Edible Beans', 'Oats', 'Potatoes'];
const SEEDING_DIRECTIONS: Array<'North-South' | 'East-West'> = ['North-South', 'East-West'];
const SEED_TREATMENT_PRODUCTS = [
  'Elatus',
  'Minuet',
  'Cimegra',
  'Gibberlic Acid',
  'Apron',
  'Maxim',
  'Poncho',
];
const SEED_TREATMENT_UNITS = ['L/ac', 'ML/AC', 'ML/CWT', 'L/CWT'] as const;
type SeedTreatmentUnit = (typeof SEED_TREATMENT_UNITS)[number];

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const emptyEntry = (): Omit<SeedingPlan, 'id' | 'createdAt'> => ({
  fieldId: '',
  fieldNumber: '',
  cropType: 'Corn',
  variety: '',
  seedingDate: new Date().toISOString().split('T')[0],
  seedingDirection: 'North-South',
  chemicalMix: '',
  fieldTrials: '',
  seedingRate: 0,
  rowSpacing: undefined,
  seedDepth: undefined,
  location: { lat: 0, lng: 0 },
  pinInfo: '',
  notes: '',
});

export default function SeedingPlan({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewEntry, setViewEntry] = useState<SeedingPlan | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEntry());
  const [drawPoints, setDrawPoints] = useState<GeoLocation[]>([]);
  const [pinPoints, setPinPoints] = useState<GeoLocation[]>([]);
  const [pinLabels, setPinLabels] = useState<string[]>([]);
  const [closedShape, setClosedShape] = useState(false);
  const [pinInfo, setPinInfo] = useState('');
  const [mapMode, setMapMode] = useState<'pin' | 'draw'>('pin');
  const [seedChemicals, setSeedChemicals] = useState<Array<{ name: string; rate: string; unit: SeedTreatmentUnit }>>([]);
  const [filterCrop, setFilterCrop] = useState<CropType | ''>('');
  const orderedFields = [...data.fields].sort((a, b) => {
    const cropCmp = CROPS.indexOf(a.cropType) - CROPS.indexOf(b.cropType);
    if (cropCmp !== 0) return cropCmp;
    return a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' });
  });
  const varietyOptions = VARIETIES_BY_CROP[form.cropType] ?? [];

  function openNew() {
    setEditingId(null);
    setForm(emptyEntry());
    setDrawPoints([]);
    setPinPoints([]);
    setPinLabels([]);
    setClosedShape(false);
    setPinInfo('');
    setMapMode('pin');
    setSeedChemicals([]);
    setShowForm(true);
  }

  function openEdit(entry: SeedingPlan) {
    setEditingId(entry.id);
    setForm({
      fieldId: entry.fieldId,
      fieldNumber: entry.fieldNumber,
      cropType: entry.cropType,
      variety: entry.variety,
      seedingDate: entry.seedingDate,
      seedingDirection: entry.seedingDirection ?? 'North-South',
      chemicalMix: entry.chemicalMix ?? '',
      fieldTrials: entry.fieldTrials ?? '',
      seedingRate: entry.seedingRate,
      rowSpacing: entry.rowSpacing,
      seedDepth: entry.seedDepth,
      location: entry.location,
      pinInfo: entry.pinInfo,
      notes: entry.notes,
    });
    setDrawPoints(entry.trialTrack?.points ?? []);
    setPinPoints(entry.trialTrack?.pinPoints ?? []);
    setPinLabels(entry.trialTrack?.pinLabels ?? []);
    setClosedShape(Boolean(entry.trialTrack?.closedShape));
    setPinInfo(entry.pinInfo ?? '');
    setMapMode((entry.trialTrack?.pinPoints?.length ?? 0) > 0 ? 'pin' : ((entry.trialTrack?.points?.length ?? 0) > 0 ? 'draw' : 'pin'));
    // Parse chemicalMix back into array
    const chemArray = entry.chemicalMix
      ? entry.chemicalMix.split(' | ').map(c => {
          const [name, rawRate] = c.split(' @ ');
          const rateText = rawRate?.trim() || '';
          const unitMatch = rateText.match(/\s*(L\/ac|ML\/AC|ml\/ac|ML\/CWT|mL\/CT|L\/CWT)$/i);
          const parsedUnit: SeedTreatmentUnit = unitMatch
            ? (() => {
                const normalizedUnit = unitMatch[1].toLowerCase();
                if (normalizedUnit === 'ml/ac') return 'ML/AC';
                if (normalizedUnit === 'ml/cwt' || normalizedUnit === 'ml/ct') return 'ML/CWT';
                if (normalizedUnit === 'l/cwt') return 'L/CWT';
                return 'L/ac';
              })()
            : (name?.toLowerCase().includes('gibberlic') ? 'ML/AC' : 'L/ac');
          const rateValue = unitMatch ? rateText.slice(0, rateText.length - unitMatch[0].length).trim() : rateText;
          return { name: name?.trim() || '', rate: rateValue, unit: parsedUnit };
        })
      : [];
    setSeedChemicals(chemArray);
    setShowForm(true);
  }

  function handleFieldSelect(fieldId: string) {
    const field = data.fields.find(f => f.id === fieldId);
    const nextCrop = field?.cropType;
    if (nextCrop && nextCrop !== 'Potatoes') {
      setSeedChemicals([]);
    }
    setForm(f => ({
      ...f,
      fieldId,
      fieldNumber: field?.fieldNumber ?? '',
      cropType: field?.cropType ?? f.cropType,
      variety: field?.variety ?? f.variety,
      location: field?.location ?? f.location,
    }));
  }

  function handleSave() {
    const now = new Date().toISOString();
    const normalizedLocation = form.location?.lat
      ? form.location
      : (drawPoints.length > 0 ? drawPoints[drawPoints.length - 1] : form.location);
    // Convert seedChemicals array back to string format
    const chemicalMixString = seedChemicals
      .filter(c => c.name.trim())
      .map(c => `${c.name.trim()}${c.rate ? ` @ ${c.rate.trim()} ${c.unit}` : ''}`)
      .join(' | ');
    const entry: SeedingPlan = {
      id: editingId ?? generateId(),
      ...form,
      location: normalizedLocation,
      chemicalMix: form.cropType === 'Potatoes' ? (chemicalMixString || undefined) : undefined,
      pinInfo: pinInfo.trim() ? pinInfo.trim() : undefined,
      trialTrack: (drawPoints.length > 0 || pinPoints.length > 0)
        ? { name: 'Seeding Plan', points: drawPoints, closedShape, pinPoints, pinLabels }
        : undefined,
      createdAt: editingId
        ? (data.seedingPlans.find(e => e.id === editingId)?.createdAt ?? now)
        : now,
    };
    updateData(prev => saveSeedingPlan(prev, entry));
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this seeding plan?')) return;
    updateData(prev => deleteSeedingPlan(prev, id));
    setViewEntry(null);
  }

  const filtered = data.seedingPlans
    .filter(e => !filterCrop || e.cropType === filterCrop)
    .sort((a, b) => b.seedingDate.localeCompare(a.seedingDate));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Seeding Plan</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track seeding plans and field details</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Seeding Plan
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select className="form-input w-40" value={filterCrop} onChange={e => setFilterCrop(e.target.value as CropType | '')}>
          <option value="">All Crops</option>
          {CROPS.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="hidden sm:block text-sm text-gray-500 self-center">{filtered.length} plan{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Entries list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            No seeding plans yet. Click "New Seeding Plan" to add one.
          </div>
        ) : filtered.map(entry => (
          <div key={entry.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-green-900">Field {entry.fieldNumber}</span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{entry.cropType}</span>
                  {entry.variety && <span className="text-xs text-gray-500">{entry.variety}</span>}
                  {(entry.trialTrack?.points.length ?? 0) > 0 || entry.location?.lat ? <MapPin className="h-3.5 w-3.5 text-green-500" /> : null}
                </div>
                <div className="text-xs text-gray-500 space-x-3">
                  <span>Seeded: {entry.seedingDate}</span>
                  {entry.seedingDirection && <span>Direction: {entry.seedingDirection}</span>}
                  {entry.seedingRate > 0 && <span>Rate: {entry.seedingRate.toLocaleString()} seeds/ac</span>}
                  {entry.rowSpacing && <span>{entry.cropType === 'Potatoes' ? 'Seed Spacing' : 'Row'}: {entry.rowSpacing}"</span>}
                </div>
                {(entry.chemicalMix || entry.fieldTrials) && (
                  <div className="text-xs text-gray-600 mt-1 space-x-3">
                    {entry.chemicalMix && <span>Chemical Mix: {entry.chemicalMix}</span>}
                    {entry.fieldTrials && <span>Field Trials: {entry.fieldTrials}</span>}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setViewEntry(entry)} className="btn-secondary text-xs py-1.5 px-2.5">
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                <button onClick={() => openEdit(entry)} className="btn-secondary text-xs py-1.5 px-2.5">Edit</button>
                <button onClick={() => handleDelete(entry.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md">
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
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-green-600" />
                {editingId ? 'Edit Seeding Plan' : 'New Seeding Plan'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Field</label>
                  <select className="form-input" value={form.fieldId} onChange={e => handleFieldSelect(e.target.value)}>
                    <option value="">Select field...</option>
                    {orderedFields.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.fieldNumber} ({f.cropType})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Crop Type</label>
                  <select
                    className="form-input"
                    value={form.cropType}
                    onChange={e => {
                      const nextCrop = e.target.value as CropType;
                      if (nextCrop !== 'Potatoes') {
                        setSeedChemicals([]);
                      }
                      setForm(f => ({ ...f, cropType: nextCrop }));
                    }}
                  >
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
                <div>
                  <label className="form-label">Seeding Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.seedingDate}
                    onChange={e => setForm(f => ({ ...f, seedingDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Seeding Direction</label>
                  <select
                    className="form-input"
                    value={form.seedingDirection ?? 'North-South'}
                    onChange={e => setForm(f => ({ ...f, seedingDirection: e.target.value as 'North-South' | 'East-West' }))}
                  >
                    {SEEDING_DIRECTIONS.map(direction => <option key={direction}>{direction}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Seeding Rate (seeds/ac)</label>
                  <input type="number" className="form-input" value={form.seedingRate || ''} onChange={e => setForm(f => ({ ...f, seedingRate: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="form-label">{form.cropType === 'Potatoes' ? 'Seed Spacing (inches)' : 'Row Spacing (inches)'}</label>
                  <input type="number" className="form-input" value={form.rowSpacing ?? ''} onChange={e => setForm(f => ({ ...f, rowSpacing: parseFloat(e.target.value) || undefined }))} />
                </div>
                <div>
                  <label className="form-label">Seed Depth (inches)</label>
                  <input type="number" step="0.25" className="form-input" value={form.seedDepth ?? ''} onChange={e => setForm(f => ({ ...f, seedDepth: parseFloat(e.target.value) || undefined }))} />
                </div>
                {form.cropType === 'Potatoes' && (
                  <div className="col-span-2">
                    <label className="form-label">Seed Treatments</label>
                    <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                      {seedChemicals.map((chem, idx) => {
                        return (
                          <div key={idx} className="grid grid-cols-[minmax(0,1fr)_6.5rem_5.25rem_auto] sm:grid-cols-[minmax(14rem,1fr)_11rem_7rem_auto] gap-2 items-center">
                            <select
                              className="form-input w-full"
                              value={chem.name}
                              onChange={e => setSeedChemicals(prev => prev.map((c, i) => {
                                if (i !== idx) return c;
                                const nextName = e.target.value;
                                const suggestedUnit: SeedTreatmentUnit = nextName.toLowerCase().includes('gibberlic') ? 'ML/AC' : 'L/ac';
                                return { ...c, name: nextName, unit: c.rate ? c.unit : suggestedUnit };
                              }))}
                            >
                              <option value="">Select product...</option>
                              {SEED_TREATMENT_PRODUCTS.map(product => (
                                <option key={product} value={product}>{product}</option>
                              ))}
                            </select>
                            <div className="w-full">
                              <input
                                className="form-input w-full"
                                value={chem.rate}
                                onChange={e => setSeedChemicals(prev => prev.map((c, i) => i === idx ? { ...c, rate: e.target.value } : c))}
                                placeholder="Rate"
                              />
                            </div>
                            <select
                              className="form-input !w-full shrink-0 px-2"
                              value={chem.unit}
                              onChange={e => setSeedChemicals(prev => prev.map((c, i) => i === idx ? { ...c, unit: e.target.value as SeedTreatmentUnit } : c))}
                            >
                              {SEED_TREATMENT_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => setSeedChemicals(prev => prev.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className="btn-secondary text-xs px-3"
                        onClick={() => setSeedChemicals(prev => [...prev, { name: '', rate: '', unit: 'L/ac' }])}
                      >
                        + Add Treatment
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="form-label">Field Trials</label>
                  <textarea
                    className="form-input resize-none"
                    rows={4}
                    value={form.fieldTrials ?? ''}
                    onChange={e => setForm(f => ({ ...f, fieldTrials: e.target.value }))}
                    placeholder="Trial name or treatment strip"
                  />
                </div>
              </div>

              {/* GPS Location */}
              <div>
                <label className="form-label">Field Location (GPS)</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    className={`btn-secondary text-xs py-1.5 ${mapMode === 'pin' ? 'ring-2 ring-green-300' : ''}`}
                    onClick={() => {
                      setMapMode('pin');
                    }}
                  >
                    Pin Mode
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary text-xs py-1.5 ${mapMode === 'draw' ? 'ring-2 ring-green-300' : ''}`}
                    onClick={() => {
                      setMapMode('draw');
                      setForm(f => ({ ...f, location: { lat: 0, lng: 0 } }));
                    }}
                  >
                    Draw Mode
                  </button>
                </div>
                <Suspense fallback={<div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Loading map...</div>}>
                  <GeoMap
                    currentLocation={form.location?.lat ? form.location : undefined}
                    trailPoints={drawPoints}
                    onTrailPointsChange={setDrawPoints}
                    closedShape={closedShape}
                    onClosedShapeChange={setClosedShape}
                    pinPoints={pinPoints}
                    pinLabels={pinLabels}
                    onPinPointsChange={setPinPoints}
                    onPinLabelsChange={setPinLabels}
                    interactionMode={mapMode}
                    startAtCurrentLocation
                    onLocationCapture={loc => setForm(f => ({ ...f, location: loc }))}
                    height="220px"
                  />
                </Suspense>
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input resize-none"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Field conditions, equipment notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary">
                {editingId ? 'Save Changes' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Seeding Plan — Field {viewEntry.fieldNumber}</h2>
              <button onClick={() => setViewEntry(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ['Crop', viewEntry.cropType],
                  ['Variety', viewEntry.variety || '—'],
                  ['Seeding Date', viewEntry.seedingDate],
                  ['Seeding Direction', viewEntry.seedingDirection || '—'],
                  ['Seeding Rate', viewEntry.seedingRate > 0 ? `${viewEntry.seedingRate.toLocaleString()} seeds/ac` : '—'],
                  [viewEntry.cropType === 'Potatoes' ? 'Seed Spacing' : 'Row Spacing', viewEntry.rowSpacing ? `${viewEntry.rowSpacing}"` : '—'],
                  ['Seed Depth', viewEntry.seedDepth ? `${viewEntry.seedDepth}"` : '—'],
                  ['Chemical Mix', viewEntry.chemicalMix || '—'],
                  ['Field Trials', viewEntry.fieldTrials || '—'],
                  ['Pin Info', viewEntry.pinInfo || '—'],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <span className="text-gray-500">{k}:</span>
                    <span className="font-medium ml-2">{v}</span>
                  </div>
                ))}
              </div>

              {viewEntry.location?.lat ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Location</h3>
                  <Suspense fallback={null}>
                    <GeoMap
                      currentLocation={viewEntry.location}
                      trailPoints={viewEntry.trialTrack?.points ?? []}
                      closedShape={Boolean(viewEntry.trialTrack?.closedShape)}
                      pinPoints={viewEntry.trialTrack?.pinPoints ?? []}
                      pinLabels={viewEntry.trialTrack?.pinLabels ?? []}
                      height="180px"
                      readonly
                    />
                  </Suspense>
                </div>
              ) : null}

              {viewEntry.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{viewEntry.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => handleDelete(viewEntry.id)} className="btn-danger">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button onClick={() => { openEdit(viewEntry); setViewEntry(null); }} className="btn-primary">Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
