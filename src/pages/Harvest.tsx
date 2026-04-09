import { useEffect, useState } from 'react';
import type { AppData, HarvestReport, WeatherData, CropType } from '../types';
import { generateId, saveHarvestReport, deleteHarvestReport } from '../utils/storage';
import { getHistoricalWeather } from '../utils/weather';
import { VARIETIES_BY_CROP } from '../utils/varieties';
import { Plus, Trash2, Eye, X, Camera } from 'lucide-react';
import PhotoCapture from '../components/PhotoCapture';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const YIELD_UNITS = ['bu/ac', 't/ac', 'lbs/ac'];
const POTATO_QUALITY_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Cull'];
const POTATO_BIN_OPTIONS = ['M1', 'M2', 'M3', 'M4', 'CL1', 'CL2', 'J2', 'J3', 'J4'];
const POTATO_TUBER_DEFECT_OPTIONS = ['Greening', 'Hollow Heart', 'Scab', 'Rhizoctonia', 'Growth Cracks', 'Misshapen', 'Bruising', 'Rot'];

export default function Harvest({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewReport, setViewReport] = useState<HarvestReport | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [photoGallery, setPhotoGallery] = useState<string[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState('');
  const [cropFilter, setCropFilter] = useState<CropType | ''>('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherData | null>(null);
  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
  const orderedFields = [...data.fields].sort((a, b) => {
    const cropCmp = a.cropType.localeCompare(b.cropType);
    if (cropCmp !== 0) return cropCmp;
    return a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' });
  });
  const cropOptions = Array.from(new Set(data.harvestReports.map(r => r.cropType))).sort((a, b) => a.localeCompare(b));
  const fieldOptions = Array.from(
    new Set(
      data.harvestReports
        .filter(r => !cropFilter || r.cropType === cropFilter)
        .map(r => r.fieldNumber)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const [form, setForm] = useState({
    fieldId: '',
    variety: '',
    date: new Date().toISOString().split('T')[0],
    yieldValue: '',
    totalCwt: '',
    yieldUnit: YIELD_UNITS[0],
    moisture: '',
    binNumber: '',
    quality: '',
    tuberDefects: [] as string[],
    tuberTemp: '',
    weatherData: '',
    photos: [] as string[],
    notes: '',
  });

  function openNew() {
    setEditingId(null);
    setWeatherSnapshot(null);
    setForm({
      fieldId: '',
      variety: '',
      date: new Date().toISOString().split('T')[0],
      yieldValue: '',
      totalCwt: '',
      yieldUnit: YIELD_UNITS[0],
      moisture: '',
      binNumber: '',
      quality: '',
      tuberDefects: [],
      tuberTemp: '',
      weatherData: '',
      photos: [],
      notes: '',
    });
    setShowForm(true);
  }

  function openEdit(report: HarvestReport) {
    setEditingId(report.id);
    setWeatherSnapshot(null);
    setForm({
      fieldId: report.fieldId,
      variety: report.variety ?? '',
      date: report.date,
      yieldValue: report.yieldValue?.toString() ?? '',
      totalCwt: report.totalCwt?.toString() ?? '',
      yieldUnit: report.yieldUnit ?? YIELD_UNITS[0],
      moisture: report.moisture?.toString() ?? '',
      binNumber: report.binNumber ?? '',
      quality: report.quality ?? '',
      tuberDefects: report.tuberDefects ?? [],
      tuberTemp: report.tuberTemp?.toString() ?? '',
      weatherData: report.weatherData ?? '',
      photos: report.photos ?? [],
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
      variety: form.variety.trim() || selectedField.variety || undefined,
      date: form.date,
      yieldValue: form.yieldValue ? Number(form.yieldValue) : undefined,
      totalCwt: selectedField.cropType === 'Potatoes' ? (form.totalCwt ? Number(form.totalCwt) : undefined) : undefined,
      yieldUnit: selectedField.cropType === 'Potatoes' ? undefined : form.yieldUnit,
      moisture: selectedField.cropType === 'Potatoes' ? undefined : (form.moisture ? Number(form.moisture) : undefined),
      binNumber: selectedField.cropType === 'Potatoes' ? (form.binNumber.trim() || undefined) : undefined,
      quality: selectedField.cropType === 'Potatoes' ? (form.quality.trim() || undefined) : undefined,
      tuberDefects: selectedField.cropType === 'Potatoes' ? (form.tuberDefects.length ? form.tuberDefects : undefined) : undefined,
      tuberTemp: selectedField.cropType === 'Potatoes' ? (form.tuberTemp ? Number(form.tuberTemp) : undefined) : undefined,
      weatherData: selectedField.cropType === 'Potatoes' ? (form.weatherData.trim() || undefined) : undefined,
      photos: selectedField.cropType === 'Potatoes' ? (form.photos.length ? form.photos : undefined) : undefined,
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
    .filter(r => !cropFilter || r.cropType === cropFilter)
    .filter(r => !fieldFilter || r.fieldNumber === fieldFilter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const selectedFieldForForm = data.fields.find(f => f.id === form.fieldId);
  // Get varieties that were actually seeded on this field, or fall back to all varieties for the crop
  const seededVarietiesForField = selectedFieldForForm
    ? Array.from(
        new Set(
          data.seedingEntries
            .filter(e => e.fieldId === selectedFieldForForm.id && e.variety)
            .map(e => e.variety)
        )
      ).sort()
    : [];
  const varietyOptions = seededVarietiesForField.length > 0
    ? seededVarietiesForField
    : (selectedFieldForForm ? (VARIETIES_BY_CROP[selectedFieldForForm.cropType] ?? []) : []);
  const isPotatoHarvest = selectedFieldForForm?.cropType === 'Potatoes';
  const fallbackSeedingLocation = selectedFieldForForm
    ? [...data.seedingEntries]
        .filter(entry => entry.fieldId === selectedFieldForForm.id && entry.location)
        .sort((a, b) => b.seedingDate.localeCompare(a.seedingDate))[0]?.location
    : undefined;
  const fallbackScoutingLocation = selectedFieldForForm
    ? [...data.scoutingReports]
        .filter(report => report.fieldId === selectedFieldForForm.id && report.location)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.location
    : undefined;
  const weatherLocation = selectedFieldForForm?.location ?? fallbackSeedingLocation ?? fallbackScoutingLocation;

  useEffect(() => {
    if (fieldFilter && !fieldOptions.includes(fieldFilter)) {
      setFieldFilter('');
    }
  }, [cropFilter, fieldFilter, fieldOptions]);
  // Auto-populate variety from seeding entry when field is selected
  useEffect(() => {
    if (!selectedFieldForForm || editingId) return;
    const seedingEntry = data.seedingEntries
      .filter(e => e.fieldId === selectedFieldForForm.id)
      .sort((a, b) => b.seedingDate.localeCompare(a.seedingDate))[0];
    if (seedingEntry && seedingEntry.variety) {
      setForm(f => ({ ...f, variety: seedingEntry.variety }));
    } else {
      setForm(f => ({ ...f, variety: '' }));
    }
  }, [selectedFieldForForm?.id, editingId, data.seedingEntries]);
  function refreshWeather() {
    setWeatherRefreshKey(prev => prev + 1);
  }

  useEffect(() => {
    let cancelled = false;

    async function autoPopulateWeather() {
      if (!showForm || !isPotatoHarvest) {
        setWeatherLoading(false);
        setWeatherError(null);
        setWeatherSnapshot(null);
        return;
      }

      if (!weatherLocation || !form.date) {
        if (!cancelled) {
          setWeatherLoading(false);
          setWeatherError('Set date and save GPS in Field, Seeding, or Scouting to auto-populate weather.');
          setWeatherSnapshot(null);
        }
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      if (form.date > today) {
        if (!cancelled) {
          setWeatherLoading(false);
          setWeatherError('Historical weather is only available for today or earlier dates.');
          setWeatherSnapshot(null);
        }
        return;
      }

      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const weather = await getHistoricalWeather(weatherLocation.lat, weatherLocation.lng, form.date);
        if (cancelled) return;

        const summary = `${weather.temperature.toFixed(1)} C avg (${weather.temperatureMin?.toFixed(1)} to ${weather.temperatureMax?.toFixed(1)} C), ${weather.precipitation.toFixed(1)} mm rain, ${weather.windSpeed.toFixed(0)} km/h wind`;
        setWeatherSnapshot(weather);
        setForm(prev => ({ ...prev, weatherData: summary }));
      } catch {
        if (!cancelled) {
          setWeatherError('Failed to auto-populate weather data.');
          setWeatherSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      }
    }

    void autoPopulateWeather();

    return () => {
      cancelled = true;
    };
  }, [showForm, isPotatoHarvest, weatherLocation?.lat, weatherLocation?.lng, form.date, weatherRefreshKey]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Harvest</h1>
          <p className="text-sm text-gray-500 mt-1">Track harvest outcomes by field and date.</p>
        </div>
        <button onClick={openNew} className="btn-primary whitespace-nowrap">
          <Plus className="h-4 w-4" /> New Report
        </button>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
          <select className="form-input w-full sm:w-40" value={cropFilter} onChange={e => setCropFilter(e.target.value as CropType | '')}>
            <option value="">All Crops</option>
            {cropOptions.map(crop => (
              <option key={crop} value={crop}>{crop}</option>
            ))}
          </select>
          <select className="form-input w-full sm:w-40" value={fieldFilter} onChange={e => setFieldFilter(e.target.value)}>
            <option value="">All Fields</option>
            {fieldOptions.map(fieldNumber => (
              <option key={fieldNumber} value={fieldNumber}>Field {fieldNumber}</option>
            ))}
          </select>
        </div>
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
                      {r.photos?.length ? ` · ${r.photos.length} photo${r.photos.length === 1 ? '' : 's'}` : ''}
                    </div>
                    {r.notes && <div className="text-sm text-gray-600 mt-1 truncate">{r.notes}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(r.photos?.length ?? 0) > 0 && (
                      <button
                        onClick={() => setPhotoGallery(r.photos ?? null)}
                        className="btn-secondary text-[11px] py-1 px-2"
                        title="Open attached photos"
                      >
                        <Camera className="h-3 w-3" /> {r.photos?.length}
                      </button>
                    )}
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
                    {orderedFields.map(field => (
                      <option key={field.id} value={field.id}>{field.fieldNumber} ({field.cropType})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Variety {seededVarietiesForField.length === 1 ? '(from seeding)' : seededVarietiesForField.length > 1 ? '(pick from seeding)' : ''}</label>
                  {seededVarietiesForField.length === 1 ? (
                    <input type="text" className="form-input bg-gray-50" value={form.variety} disabled />
                  ) : (
                    <select className="form-input" value={form.variety} onChange={e => setForm(f => ({ ...f, variety: e.target.value }))}>
                      <option value="">Select variety...</option>
                      {varietyOptions.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Yield</label>
                  <input type="number" step="0.1" className="form-input" value={form.yieldValue} onChange={e => setForm(f => ({ ...f, yieldValue: e.target.value }))} placeholder="Optional" />
                </div>
                {isPotatoHarvest ? (
                  <>
                    <div>
                      <label className="form-label">Bin #</label>
                      <select className="form-input" value={form.binNumber} onChange={e => setForm(f => ({ ...f, binNumber: e.target.value }))}>
                        <option value="">Select bin...</option>
                        {[...POTATO_BIN_OPTIONS, ...(data.customBins ?? [])].map(bin => <option key={bin} value={bin}>{bin}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Quality</label>
                      <select className="form-input" value={form.quality} onChange={e => setForm(f => ({ ...f, quality: e.target.value }))}>
                        <option value="">Select quality...</option>
                        {POTATO_QUALITY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Tuber Temp</label>
                      <input type="number" step="0.1" className="form-input" value={form.tuberTemp} onChange={e => setForm(f => ({ ...f, tuberTemp: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div>
                      <label className="form-label">Total CWT</label>
                      <input type="number" step="0.1" className="form-input" value={form.totalCwt} onChange={e => setForm(f => ({ ...f, totalCwt: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label">Tuber Defects</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        {POTATO_TUBER_DEFECT_OPTIONS.map(defect => (
                          <label key={defect} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-green-600"
                              checked={form.tuberDefects.includes(defect)}
                              onChange={e => setForm(prev => ({
                                ...prev,
                                tuberDefects: e.target.checked
                                  ? [...prev.tuberDefects, defect]
                                  : prev.tuberDefects.filter(d => d !== defect),
                              }))}
                            />
                            <span>{defect}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="form-label mb-0">Weather Data</label>
                        <button type="button" onClick={refreshWeather} className="btn-secondary text-xs py-1.5 px-2.5" disabled={weatherLoading}>
                          {weatherLoading ? 'Updating...' : 'Refresh Weather'}
                        </button>
                      </div>
                      {weatherSnapshot ? (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mt-1">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><span className="text-gray-500">Avg Temp:</span> <span className="font-medium">{weatherSnapshot.temperature.toFixed(1)} C</span></div>
                            <div><span className="text-gray-500">Min/Max:</span> <span className="font-medium">{weatherSnapshot.temperatureMin?.toFixed(1)} / {weatherSnapshot.temperatureMax?.toFixed(1)} C</span></div>
                            <div><span className="text-gray-500">Rain:</span> <span className="font-medium">{weatherSnapshot.precipitation.toFixed(1)} mm</span></div>
                            <div><span className="text-gray-500">Wind:</span> <span className="font-medium">{weatherSnapshot.windSpeed.toFixed(0)} km/h</span></div>
                          </div>
                        </div>
                      ) : form.weatherData ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mt-1 text-sm text-gray-700">
                          {form.weatherData}
                        </div>
                      ) : null}
                      {weatherLoading && <p className="text-xs text-gray-500 mt-1">Auto-populating weather...</p>}
                      {!weatherLoading && weatherError && <p className="text-xs text-red-600 mt-1">{weatherError}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label">Photos</label>
                      <PhotoCapture photos={form.photos} onChange={photos => setForm(prev => ({ ...prev, photos }))} maxPhotos={6} />
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
              {viewReport.variety && <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{viewReport.variety}</span></div>}
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewReport.date}</span></div>
              {viewReport.yieldValue !== undefined && <div><span className="text-gray-500">Yield:</span> <span className="font-medium">{viewReport.yieldValue} {viewReport.yieldUnit ?? ''}</span></div>}
              {viewReport.moisture !== undefined && <div><span className="text-gray-500">Moisture:</span> <span className="font-medium">{viewReport.moisture}%</span></div>}
              {viewReport.cropType === 'Potatoes' && viewReport.binNumber && <div><span className="text-gray-500">Bin #:</span> <span className="font-medium">{viewReport.binNumber}</span></div>}
              {viewReport.cropType === 'Potatoes' && viewReport.totalCwt !== undefined && <div><span className="text-gray-500">Total CWT:</span> <span className="font-medium">{viewReport.totalCwt}</span></div>}
              {viewReport.cropType === 'Potatoes' && viewReport.quality && <div><span className="text-gray-500">Quality:</span> <span className="font-medium">{viewReport.quality}</span></div>}
              {viewReport.cropType === 'Potatoes' && viewReport.tuberDefects?.length && <div><span className="text-gray-500">Tuber Defects:</span> <span className="font-medium">{viewReport.tuberDefects.join(', ')}</span></div>}
              {viewReport.cropType === 'Potatoes' && viewReport.tuberTemp !== undefined && <div><span className="text-gray-500">Tuber Temp:</span> <span className="font-medium">{viewReport.tuberTemp}</span></div>}
              {viewReport.cropType === 'Potatoes' && viewReport.weatherData && <div><span className="text-gray-500">Weather Data:</span> <span className="font-medium">{viewReport.weatherData}</span></div>}
              {viewReport.photos?.length ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
                    <Camera className="h-4 w-4" />
                    Photos ({viewReport.photos.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {viewReport.photos.map((photo, idx) => (
                      <button key={`${viewReport.id}-photo-${idx}`} type="button" className="focus:outline-none" onClick={() => setPreviewPhoto(photo)}>
                        <img src={photo} alt={`Harvest photo ${idx + 1}`} className="h-16 w-16 rounded object-cover border border-gray-200 hover:opacity-90" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
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

      {photoGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9998] p-4" onClick={() => setPhotoGallery(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-base font-semibold">Photos ({photoGallery.length})</h3>
              <button onClick={() => setPhotoGallery(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photoGallery.map((photo, idx) => (
                <button key={`gallery-photo-${idx}`} type="button" className="focus:outline-none" onClick={() => setPreviewPhoto(photo)}>
                  <img src={photo} alt={`Harvest photo ${idx + 1}`} className="w-full h-32 rounded object-cover border border-gray-200 hover:opacity-90" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {previewPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999] p-4" onClick={() => setPreviewPhoto(null)}>
          <img src={previewPhoto} alt="Harvest photo preview" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
