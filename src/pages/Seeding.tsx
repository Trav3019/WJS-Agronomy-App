import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { NavLink } from 'react-router-dom';
import type { AppData, SeedingEntry, CropType, WeatherData, GeoLocation } from '../types';
import { generateId, saveSeedingEntry, deleteSeedingEntry } from '../utils/storage';
import { getHistoricalWeather } from '../utils/weather';
import { VARIETIES_BY_CROP } from '../utils/varieties';
import { CalendarDays, Plus, X, Trash2, Eye, Cloud, Loader2, MapPin, AlertCircle, Zap, CheckCircle2 } from 'lucide-react';

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
  fieldTrials: '',
  tuberSize: '',
  tuberTemp: undefined,
  groundTemperature: undefined,
  seedCutDate: '',
  seedingRate: 0,
  seedingRateCwtAc: undefined,
  rowSpacing: undefined,
  seedDepth: undefined,
  location: { lat: 0, lng: 0 },
  weather: undefined,
  trialTrack: undefined,
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

function distanceMeters(a: GeoLocation, b: GeoLocation) {
  const toRad = (v: number) => v * (Math.PI / 180);
  const r = 6371000; // Earth radius in meters
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
            Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return r * c;
}

export default function Seeding({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewEntry, setViewEntry] = useState<SeedingEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEntry());
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [filterCrop, setFilterCrop] = useState<CropType | ''>('');
  const [filterFieldNumber, setFilterFieldNumber] = useState('');
  const [trackName, setTrackName] = useState('Seeding Trial');
  const [trialPoints, setTrialPoints] = useState<GeoLocation[]>([]);
  const [isTrackingTrial, setIsTrackingTrial] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const orderedFields = [...data.fields].sort((a, b) => {
    const cropCmp = CROPS.indexOf(a.cropType) - CROPS.indexOf(b.cropType);
    if (cropCmp !== 0) return cropCmp;
    return a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' });
  });
  const filterFieldOptions = Array.from(
    new Set(
      orderedFields
        .filter(f => !filterCrop || f.cropType === filterCrop)
        .map(f => f.fieldNumber)
    )
  );
  const varietyOptions = VARIETIES_BY_CROP[form.cropType] ?? [];

  // Clean up geolocation watch on component unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (filterFieldNumber && !filterFieldOptions.includes(filterFieldNumber)) {
      setFilterFieldNumber('');
    }
  }, [filterCrop, filterFieldNumber, filterFieldOptions]);

  function startTrialTracking() {
    setIsTrackingTrial(true);
    setTrackingError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const point: GeoLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setTrialPoints(prev => {
          if (prev.length === 0) return [point];
          const last = prev[prev.length - 1];
          if (distanceMeters(last, point) < 3) return prev; // 3m deduplication
          return [...prev, point];
        });
      },
      err => {
        if (err.code === 1) {
          setTrackingError('Location permission denied.');
        } else {
          setTrackingError('Unable to record GPS location.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  function stopTrialTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTrackingTrial(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyEntry());
    setWeatherError(null);
    setTrackName('Seeding Trial');
    setTrialPoints([]);
    setIsTrackingTrial(false);
    setTrackingError(null);
    stopTrialTracking();
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
      fieldTrials: entry.fieldTrials ?? '',
      tuberSize: entry.tuberSize ?? '',
      tuberTemp: entry.tuberTemp,
      groundTemperature: entry.groundTemperature,
      seedCutDate: entry.seedCutDate ?? '',
      seedingRate: entry.seedingRate,
      seedingRateCwtAc: entry.seedingRateCwtAc,
      rowSpacing: entry.rowSpacing,
      seedDepth: entry.seedDepth,
      location: entry.location,
      weather: entry.weather,
      trialTrack: entry.trialTrack,
      notes: entry.notes,
    });
    if (entry.trialTrack) {
      setTrackName(entry.trialTrack.name);
      setTrialPoints(entry.trialTrack.points);
    } else {
      setTrackName('Seeding Trial');
      setTrialPoints([]);
    }
    setWeatherError(null);
    setShowForm(true);
  }

  function handleFieldSelect(fieldId: string) {
    const field = data.fields.find(f => f.id === fieldId);
    const nextCropType = field?.cropType;
    setForm(f => ({
      ...f,
      fieldId,
      fieldNumber: field?.fieldNumber ?? '',
      cropType: field?.cropType ?? f.cropType,
      variety: field?.variety ?? f.variety,
      location: field?.location ?? f.location,
      tuberSize: nextCropType === 'Potatoes' ? f.tuberSize : '',
      tuberTemp: nextCropType === 'Potatoes' ? f.tuberTemp : undefined,
      groundTemperature: nextCropType === 'Potatoes' ? f.groundTemperature : undefined,
      seedingRateCwtAc: nextCropType === 'Potatoes' ? f.seedingRateCwtAc : undefined,
      seedCutDate: nextCropType === 'Potatoes' ? f.seedCutDate : '',
    }));
  }

  async function fetchWeather() {
    if (form.location?.lat == null || form.location?.lng == null || !form.seedingDate) {
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
      trialTrack: trialPoints.length > 0 ? { name: trackName, points: trialPoints } : undefined,
      createdAt: editingId
        ? (data.seedingEntries.find(e => e.id === editingId)?.createdAt ?? now)
        : now,
    };
    updateData(prev => saveSeedingEntry(prev, entry));
    setShowForm(false);
    stopTrialTracking();
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this seeding entry?')) return;
    updateData(prev => deleteSeedingEntry(prev, id));
    setViewEntry(null);
  }

  const filtered = data.seedingEntries
    .filter(e => !filterCrop || e.cropType === filterCrop)
    .filter(e => !filterFieldNumber || e.fieldNumber === filterFieldNumber)
    .sort((a, b) => b.seedingDate.localeCompare(a.seedingDate));

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-green-200 bg-white p-1 shadow-sm">
        <NavLink
          to="/seeding"
          end
          className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-green-700 text-white' : 'text-green-800 hover:bg-green-50'}`}
        >
          Seeding Records
        </NavLink>
        <NavLink
          to="/seeding/planter-checks"
          className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-green-700 text-white' : 'text-green-800 hover:bg-green-50'}`}
        >
          Planter Checks
        </NavLink>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-green-900">Seeding Records</h1>
      </div>

      {/* Filter */}
      <div className="flex items-end gap-2 flex-wrap sm:flex-nowrap">
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto flex-1 sm:flex-none">
          <select className="form-input w-full sm:w-40" value={filterCrop} onChange={e => setFilterCrop(e.target.value as CropType | '')}>
            <option value="">All Crops</option>
            {CROPS.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="form-input w-full sm:w-40" value={filterFieldNumber} onChange={e => setFilterFieldNumber(e.target.value)}>
            <option value="">All Fields</option>
            {filterFieldOptions.map(fieldNumber => (
              <option key={fieldNumber} value={fieldNumber}>Field {fieldNumber}</option>
            ))}
          </select>
        </div>
        <button onClick={openNew} className="btn-primary whitespace-nowrap">
          <Plus className="h-4 w-4" /> New Entry
        </button>
        <div className="hidden sm:block text-sm text-gray-500 self-center">{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</div>
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
                  {entry.cropType !== 'Potatoes' && entry.seedingRate > 0 && <span>Rate: {entry.seedingRate.toLocaleString()} seeds/ac</span>}
                  {entry.rowSpacing && <span>Row: {entry.rowSpacing}"</span>}
                </div>
                {entry.fieldTrials && (
                  <div className="text-xs text-gray-600 mt-1 space-x-3">
                    {entry.fieldTrials && <span>Field Trials: {entry.fieldTrials}</span>}
                  </div>
                )}
                {entry.cropType === 'Potatoes' && (
                  <div className="text-xs text-gray-600 mt-1 space-x-3">
                    {entry.tuberSize && <span>Tuber Size: {entry.tuberSize} oz</span>}
                    {entry.tuberTemp !== undefined && <span>Tuber Temp: {entry.tuberTemp} C</span>}
                    {entry.groundTemperature !== undefined && <span>Ground Temp: {entry.groundTemperature} C</span>}
                    {entry.seedCutDate && <span>Seed Cut Date: {entry.seedCutDate}</span>}
                    {entry.seedingRateCwtAc !== undefined && <span>Seeding Rate: {entry.seedingRateCwtAc.toFixed(1)} CWT/ac</span>}
                  </div>
                )}
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
                      setForm(f => ({
                        ...f,
                        cropType: nextCrop,
                        tuberSize: nextCrop === 'Potatoes' ? f.tuberSize : '',
                        tuberTemp: nextCrop === 'Potatoes' ? f.tuberTemp : undefined,
                        seedingRateCwtAc: nextCrop === 'Potatoes' ? f.seedingRateCwtAc : undefined,
                        groundTemperature: nextCrop === 'Potatoes' ? f.groundTemperature : undefined,
                        seedCutDate: nextCrop === 'Potatoes' ? f.seedCutDate : '',
                      }));
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
                    onChange={e => setForm(f => ({ ...f, seedingDate: e.target.value, weather: undefined }))}
                  />
                </div>
                {form.cropType !== 'Potatoes' && (
                  <div>
                    <label className="form-label">Seeding Rate (seeds/ac)</label>
                    <input type="number" className="form-input" value={form.seedingRate || ''} onChange={e => setForm(f => ({ ...f, seedingRate: parseInt(e.target.value) || 0 }))} />
                  </div>
                )}
                <div>
                  <label className="form-label">Row Spacing (inches)</label>
                  <input type="number" className="form-input" value={form.rowSpacing ?? ''} onChange={e => setForm(f => ({ ...f, rowSpacing: parseFloat(e.target.value) || undefined }))} />
                </div>
                <div>
                  <label className="form-label">Seed Depth (inches)</label>
                  <input type="number" step="0.25" className="form-input" value={form.seedDepth ?? ''} onChange={e => setForm(f => ({ ...f, seedDepth: parseFloat(e.target.value) || undefined }))} />
                </div>
                {form.cropType === 'Potatoes' && (
                  <>
                    <div>
                      <label className="form-label">Tuber Size (oz)</label>
                      <input
                        className="form-input"
                        value={form.tuberSize ?? ''}
                        onChange={e => setForm(f => ({ ...f, tuberSize: e.target.value }))}
                        placeholder="e.g. 2.5"
                      />
                    </div>
                    <div>
                      <label className="form-label">Tuber Temp (C)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={form.tuberTemp ?? ''}
                        onChange={e => setForm(f => ({ ...f, tuberTemp: parseFloat(e.target.value) || undefined }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Ground Temperature (C)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={form.groundTemperature ?? ''}
                        onChange={e => setForm(f => ({ ...f, groundTemperature: parseFloat(e.target.value) || undefined }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Seed Cut Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={form.seedCutDate ?? ''}
                        onChange={e => setForm(f => ({ ...f, seedCutDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Seeding Rate (CWT/ac)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={form.seedingRateCwtAc ?? ''}
                        onChange={e => setForm(f => ({ ...f, seedingRateCwtAc: parseFloat(e.target.value) || undefined }))}
                      />
                    </div>
                  </>
                )}
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

              {/* Trail Tracking */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="h-5 w-5 text-green-600" />
                  <span className="form-label mb-0">Seeding Trial Recording</span>
                  {isTrackingTrial && <CheckCircle2 className="h-4 w-4 text-green-500 animate-pulse" />}
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {!isTrackingTrial ? (
                      <button
                        type="button"
                        onClick={startTrialTracking}
                        className="btn-primary text-xs py-1.5 flex-1"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Start Recording
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopTrialTracking}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-md text-xs font-medium flex-1 flex items-center justify-center gap-2"
                      >
                        Stop Recording
                      </button>
                    )}
                    {trialPoints.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTrialPoints([]);
                          setTrackName('Seeding Trial');
                          stopTrialTracking();
                        }}
                        className="btn-secondary text-xs py-1.5"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="form-input flex-1"
                      value={trackName}
                      onChange={e => setTrackName(e.target.value)}
                      placeholder="Trial name"
                    />
                    {trialPoints.length > 0 && (
                      <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-md px-3 py-1.5 text-xs font-medium text-green-700 whitespace-nowrap">
                        <MapPin className="h-3.5 w-3.5" />
                        {trialPoints.length} points
                      </div>
                    )}
                  </div>
                  {trackingError && (
                    <div className="flex items-center gap-2 text-red-600 text-xs">
                      <AlertCircle className="h-3.5 w-3.5" /> {trackingError}
                    </div>
                  )}
                </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ['Crop', viewEntry.cropType],
                  ['Variety', viewEntry.variety || '—'],
                  ['Seeding Date', viewEntry.seedingDate],
                  ['Seeding Rate', viewEntry.seedingRate > 0 ? `${viewEntry.seedingRate.toLocaleString()} seeds/ac` : '—'],
                  ['Row Spacing', viewEntry.rowSpacing ? `${viewEntry.rowSpacing}"` : '—'],
                  ['Seed Depth', viewEntry.seedDepth ? `${viewEntry.seedDepth}"` : '—'],
                  ['Field Trials', viewEntry.fieldTrials || '—'],
                  ...(viewEntry.cropType === 'Potatoes'
                    ? [
                        ['Tuber Size', viewEntry.tuberSize ? `${viewEntry.tuberSize} oz` : '—'],
                        ['Tuber Temp', viewEntry.tuberTemp !== undefined ? `${viewEntry.tuberTemp} C` : '—'],
                        ['Ground Temperature', viewEntry.groundTemperature !== undefined ? `${viewEntry.groundTemperature} C` : '—'],
                        ['Seed Cut Date', viewEntry.seedCutDate || '—'],
                      ]
                    : []),
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

              {viewEntry.trialTrack && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Seeding Trial</h3>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-900">{viewEntry.trialTrack.name}</span>
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                        {viewEntry.trialTrack.points.length} points
                      </span>
                    </div>
                    <Suspense fallback={<div className="h-40 bg-white rounded flex items-center justify-center text-gray-400 text-xs">Loading map...</div>}>
                      <GeoMap
                        currentLocation={viewEntry.trialTrack.points[viewEntry.trialTrack.points.length - 1]}
                        markers={viewEntry.trialTrack.points.map((p, idx) => ({
                          location: p,
                          label: `${viewEntry.trialTrack?.name} #${idx + 1}`,
                          date: viewEntry.seedingDate,
                          color: '#16a34a',
                        }))}
                        height="180px"
                        readonly
                      />
                    </Suspense>
                  </div>
                </div>
              )}

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
