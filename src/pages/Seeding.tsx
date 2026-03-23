import { useState, lazy, Suspense } from 'react';
import type { AppData, SeedingEntry, CropType, WeatherData } from '../types';
import { generateId, saveSeedingEntry, deleteSeedingEntry } from '../utils/storage';
import { getHistoricalWeather } from '../utils/weather';
import { CalendarDays, Plus, X, Trash2, Eye, Cloud, Loader2, MapPin, AlertCircle } from 'lucide-react';

const GeoMap = lazy(() => import('../components/GeoMap'));

const CROPS: CropType[] = ['Corn', 'Canola', 'Soybeans', 'Wheat', 'Edible Beans', 'Oats', 'Potatoes'];

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const emptyEntry = (): Omit<SeedingEntry, 'id' | 'createdAt'> => ({
  fieldId: '',
  fieldNumber: '',
  cropType: 'Corn',
  variety: '',
  seedingDate: new Date().toISOString().split('T')[0],
  seedingRate: 0,
  rowSpacing: undefined,
  seedDepth: undefined,
  population: undefined,
  location: { lat: 0, lng: 0 },
  weather: undefined,
  notes: '',
});

function WeatherCard({ weather }: { weather: WeatherData }) {
  return (
    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <Cloud className="h-5 w-5 text-blue-600" />
        <span className="font-semibold text-blue-800 text-sm">Seeding Day Weather</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{weather.temperature?.toFixed(1)}°C</div>
          <div className="text-xs text-gray-500">Avg Temp</div>
        </div>
        {weather.temperatureMax !== undefined && (
          <div className="text-center">
            <div className="text-sm font-semibold text-red-600">{weather.temperatureMax.toFixed(1)}°</div>
            <div className="text-xs text-gray-500">High</div>
          </div>
        )}
        {weather.temperatureMin !== undefined && (
          <div className="text-center">
            <div className="text-sm font-semibold text-blue-600">{weather.temperatureMin.toFixed(1)}°</div>
            <div className="text-xs text-gray-500">Low</div>
          </div>
        )}
        <div className="text-center">
          <div className="text-sm font-semibold text-blue-700">{weather.precipitation.toFixed(1)} mm</div>
          <div className="text-xs text-gray-500">Precipitation</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-700">{weather.windSpeed.toFixed(0)} km/h</div>
          <div className="text-xs text-gray-500">Max Wind</div>
        </div>
      </div>
    </div>
  );
}

export default function Seeding({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewEntry, setViewEntry] = useState<SeedingEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEntry());
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [filterCrop, setFilterCrop] = useState<CropType | ''>('');

  function openNew() {
    setEditingId(null);
    setForm(emptyEntry());
    setWeatherError(null);
    setShowForm(true);
  }

  function openEdit(entry: SeedingEntry) {
    setEditingId(entry.id);
    setForm({
      fieldId: entry.fieldId,
      fieldNumber: entry.fieldNumber,
      cropType: entry.cropType,
      variety: entry.variety,
      seedingDate: entry.seedingDate,
      seedingRate: entry.seedingRate,
      rowSpacing: entry.rowSpacing,
      seedDepth: entry.seedDepth,
      population: entry.population,
      location: entry.location,
      weather: entry.weather,
      notes: entry.notes,
    });
    setWeatherError(null);
    setShowForm(true);
  }

  function handleFieldSelect(fieldId: string) {
    const field = data.fields.find(f => f.id === fieldId);
    setForm(f => ({
      ...f,
      fieldId,
      fieldNumber: field?.fieldNumber ?? '',
      cropType: field?.cropType ?? f.cropType,
      variety: field?.variety ?? f.variety,
      location: field?.location ?? f.location,
    }));
  }

  async function fetchWeather() {
    if (!form.location?.lat || !form.location?.lng || !form.seedingDate) {
      setWeatherError('Set a GPS location and date first');
      return;
    }

    // Check if date is in the future
    const today = new Date().toISOString().split('T')[0];
    if (form.seedingDate > today) {
      setWeatherError('Cannot fetch historical weather for future dates');
      return;
    }

    setLoadingWeather(true);
    setWeatherError(null);
    try {
      const weather = await getHistoricalWeather(form.location.lat, form.location.lng, form.seedingDate);
      setForm(f => ({ ...f, weather }));
    } catch {
      setWeatherError('Failed to fetch weather data. Check your connection.');
    } finally {
      setLoadingWeather(false);
    }
  }

  function handleSave() {
    const now = new Date().toISOString();
    const entry: SeedingEntry = {
      id: editingId ?? generateId(),
      ...form,
      createdAt: editingId
        ? (data.seedingEntries.find(e => e.id === editingId)?.createdAt ?? now)
        : now,
    };
    updateData(prev => saveSeedingEntry(prev, entry));
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this seeding entry?')) return;
    updateData(prev => deleteSeedingEntry(prev, id));
    setViewEntry(null);
  }

  const filtered = data.seedingEntries
    .filter(e => !filterCrop || e.cropType === filterCrop)
    .sort((a, b) => b.seedingDate.localeCompare(a.seedingDate));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Seeding Records</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track seeding dates with historical weather data</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Entry
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select className="form-input w-40" value={filterCrop} onChange={e => setFilterCrop(e.target.value as CropType | '')}>
          <option value="">All Crops</option>
          {CROPS.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="text-sm text-gray-500 self-center">{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</div>
      </div>

      {/* Entries list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            No seeding records yet. Click "New Entry" to add one.
          </div>
        ) : filtered.map(entry => (
          <div key={entry.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-green-900">Field {entry.fieldNumber}</span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{entry.cropType}</span>
                  {entry.variety && <span className="text-xs text-gray-500">{entry.variety}</span>}
                  {entry.location?.lat ? <MapPin className="h-3.5 w-3.5 text-green-500" /> : null}
                  {entry.weather && <Cloud className="h-3.5 w-3.5 text-blue-500" />}
                </div>
                <div className="text-xs text-gray-500 space-x-3">
                  <span>Seeded: {entry.seedingDate}</span>
                  {entry.seedingRate > 0 && <span>Rate: {entry.seedingRate.toLocaleString()} seeds/ac</span>}
                  {entry.rowSpacing && <span>Row: {entry.rowSpacing}"</span>}
                </div>
                {entry.weather && (
                  <div className="text-xs text-blue-600 mt-1">
                    Weather: {entry.weather.temperature?.toFixed(1)}°C, {entry.weather.precipitation.toFixed(1)}mm rain, {entry.weather.windSpeed.toFixed(0)}km/h wind
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
                {editingId ? 'Edit Seeding Entry' : 'New Seeding Entry'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Field</label>
                  <select className="form-input" value={form.fieldId} onChange={e => handleFieldSelect(e.target.value)}>
                    <option value="">Select field...</option>
                    {data.fields.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.fieldNumber} — {f.cropType}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Crop Type</label>
                  <select className="form-input" value={form.cropType} onChange={e => setForm(f => ({ ...f, cropType: e.target.value as CropType }))}>
                    {CROPS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Variety</label>
                  <input className="form-input" value={form.variety} onChange={e => setForm(f => ({ ...f, variety: e.target.value }))} placeholder="Variety name" />
                </div>
                <div>
                  <label className="form-label">Seeding Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.seedingDate}
                    onChange={e => setForm(f => ({ ...f, seedingDate: e.target.value, weather: undefined }))}
                  />
                </div>
                <div>
                  <label className="form-label">Seeding Rate (seeds/ac)</label>
                  <input type="number" className="form-input" value={form.seedingRate || ''} onChange={e => setForm(f => ({ ...f, seedingRate: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="form-label">Row Spacing (inches)</label>
                  <input type="number" className="form-input" value={form.rowSpacing ?? ''} onChange={e => setForm(f => ({ ...f, rowSpacing: parseFloat(e.target.value) || undefined }))} />
                </div>
                <div>
                  <label className="form-label">Seed Depth (inches)</label>
                  <input type="number" step="0.25" className="form-input" value={form.seedDepth ?? ''} onChange={e => setForm(f => ({ ...f, seedDepth: parseFloat(e.target.value) || undefined }))} />
                </div>
                <div>
                  <label className="form-label">Population (seeds/ac)</label>
                  <input type="number" className="form-input" value={form.population ?? ''} onChange={e => setForm(f => ({ ...f, population: parseInt(e.target.value) || undefined }))} />
                </div>
              </div>

              {/* GPS Location */}
              <div>
                <label className="form-label">Field Location (GPS)</label>
                <p className="text-xs text-gray-500 mb-2">Required for weather data lookup</p>
                <Suspense fallback={<div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Loading map...</div>}>
                  <GeoMap
                    currentLocation={form.location?.lat ? form.location : undefined}
                    onLocationCapture={loc => setForm(f => ({ ...f, location: loc, weather: undefined }))}
                    height="220px"
                  />
                </Suspense>
              </div>

              {/* Weather fetch */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="form-label mb-0">Seeding Day Weather</span>
                  <button
                    type="button"
                    onClick={fetchWeather}
                    disabled={loadingWeather}
                    className="btn-secondary text-xs py-1.5"
                  >
                    {loadingWeather ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
                    {loadingWeather ? 'Fetching...' : 'Fetch Weather Data'}
                  </button>
                </div>

                {weatherError && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm mb-2">
                    <AlertCircle className="h-4 w-4" /> {weatherError}
                  </div>
                )}

                {form.weather ? (
                  <WeatherCard weather={form.weather} />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-400 border border-dashed border-gray-300">
                    Set a GPS location and date, then click "Fetch Weather Data" to auto-populate historical weather.
                  </div>
                )}
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
              <h2 className="text-lg font-semibold">Seeding Record — Field {viewEntry.fieldNumber}</h2>
              <button onClick={() => setViewEntry(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Crop', viewEntry.cropType],
                  ['Variety', viewEntry.variety || '—'],
                  ['Seeding Date', viewEntry.seedingDate],
                  ['Seeding Rate', viewEntry.seedingRate > 0 ? `${viewEntry.seedingRate.toLocaleString()} seeds/ac` : '—'],
                  ['Row Spacing', viewEntry.rowSpacing ? `${viewEntry.rowSpacing}"` : '—'],
                  ['Seed Depth', viewEntry.seedDepth ? `${viewEntry.seedDepth}"` : '—'],
                  ['Population', viewEntry.population ? `${viewEntry.population.toLocaleString()} seeds/ac` : '—'],
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
                    <GeoMap currentLocation={viewEntry.location} height="180px" readonly />
                  </Suspense>
                </div>
              ) : null}

              {viewEntry.weather && <WeatherCard weather={viewEntry.weather} />}

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
