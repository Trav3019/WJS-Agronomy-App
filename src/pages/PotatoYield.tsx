import { useState } from 'react';
import type { AppData, PotatoYieldReport, PotatoType } from '../types';
import { generateId, savePotatoYield, deletePotatoYield } from '../utils/storage';
import { Sprout, Plus, X, Trash2, Eye, Calculator } from 'lucide-react';
import PhotoCapture from '../components/PhotoCapture';
import { VARIETIES_BY_CROP } from '../utils/varieties';

const TABLE_GRADES = ['>2"', '2.25"', '2.5"', '2.75"', '3"', '3.25"', '<3.5"'] as const;
const PROC_GRADES = ['2oz', '3oz', '4oz', '5oz', '6oz', '7oz', '8oz', '9oz', '10oz', '11oz', '12oz'] as const;

// Estimated yield in cwt/ac (100 sq ft sample assumption)
function calcEstimatedYield(totalWeight: number): number {
  const lbsPerAcre = (totalWeight * 1537.526) / 100;
  return lbsPerAcre;
}

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const emptyReport = (): Omit<PotatoYieldReport, 'id' | 'createdAt' | 'estimatedYield'> => ({
  fieldId: '',
  fieldNumber: '',
  variety: '',
  date: new Date().toISOString().split('T')[0],
  potatoType: 'table',
  grades: {},
  gradeWeights: {},
  totalTuberCount: 0,
  totalTuberWeight: 0,
  photos: [],
  notes: '',
});

export default function PotatoYield({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewReport, setViewReport] = useState<PotatoYieldReport | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyReport());
  const [filterField, setFilterField] = useState('');

  const potatoFields = data.fields
    .filter(f => f.cropType === 'Potatoes')
    .sort((a, b) => a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' }));
  const potatoVarieties = VARIETIES_BY_CROP.Potatoes;
  const grades = form.potatoType === 'table' ? TABLE_GRADES : PROC_GRADES;

  function openNew() {
    setEditingId(null);
    setForm(emptyReport());
    setShowForm(true);
  }

  function openEdit(report: PotatoYieldReport) {
    setEditingId(report.id);
    setForm({
      fieldId: report.fieldId,
      fieldNumber: report.fieldNumber,
      variety: report.variety,
      date: report.date,
      potatoType: report.potatoType,
      grades: report.grades,
      gradeWeights: report.gradeWeights,
      totalTuberCount: report.totalTuberCount,
      totalTuberWeight: report.totalTuberWeight,
      photos: report.photos ?? [],
      notes: report.notes,
    });
    setShowForm(true);
  }

  function setGradeCount(grade: string, value: number) {
    setForm(f => {
      const grades = { ...f.grades, [grade]: value };
      const totalCount = Object.values(grades).reduce((s, v) => s + v, 0);
      return { ...f, grades, totalTuberCount: totalCount };
    });
  }

  function setGradeWeight(grade: string, value: number) {
    setForm(f => {
      const gradeWeights = { ...f.gradeWeights, [grade]: value };
      const totalWeight = Object.values(gradeWeights).reduce((s, v) => s + v, 0);
      return { ...f, gradeWeights, totalTuberWeight: totalWeight };
    });
  }

  function handleFieldSelect(fieldId: string) {
    const field = data.fields.find(f => f.id === fieldId);
    setForm(f => ({
      ...f,
      fieldId,
      fieldNumber: field?.fieldNumber ?? '',
      variety: field?.variety ?? f.variety,
    }));
  }

  function handleSave() {
    const now = new Date().toISOString();
    const report: PotatoYieldReport = {
      id: editingId ?? generateId(),
      ...form,
      estimatedYield: calcEstimatedYield(form.totalTuberWeight),
      createdAt: editingId
        ? (data.potatoYieldReports.find(r => r.id === editingId)?.createdAt ?? now)
        : now,
    };
    updateData(prev => savePotatoYield(prev, report));
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this yield report?')) return;
    updateData(prev => deletePotatoYield(prev, id));
    setViewReport(null);
  }

  const filtered = data.potatoYieldReports
    .filter(r => !filterField || r.fieldNumber.toLowerCase().includes(filterField.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const estimatedYield = calcEstimatedYield(form.totalTuberWeight);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Potato Yield Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sample-based yield estimation — estimated in cwt/ac</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Report
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <input
          className="form-input flex-1 max-w-xs"
          placeholder="Filter by field #..."
          value={filterField}
          onChange={e => setFilterField(e.target.value)}
        />
        <div className="text-sm text-gray-500 self-center">{filtered.length} report{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Reports list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            No potato yield reports yet. Click "New Report" to add one.
          </div>
        ) : filtered.map(report => (
          <div key={report.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-green-900">Field {report.fieldNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${report.potatoType === 'table' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                    {report.potatoType === 'table' ? 'Table' : 'Processing'}
                  </span>
                  {report.variety && <span className="text-xs text-gray-500">{report.variety}</span>}
                </div>
                <div className="text-xs text-gray-500">{report.date}</div>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <div className="text-xs text-gray-500">Total Count</div>
                    <div className="font-semibold">{report.totalTuberCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Sample Weight</div>
                    <div className="font-semibold">{report.totalTuberWeight.toFixed(1)} lbs</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Estimated Yield</div>
                    <div className="font-semibold text-green-700">{report.estimatedYield.toFixed(1)} cwt/ac</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setViewReport(report)} className="btn-secondary text-xs py-1.5 px-2.5">
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                <button onClick={() => openEdit(report)} className="btn-secondary text-xs py-1.5 px-2.5">Edit</button>
                <button onClick={() => handleDelete(report.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md">
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
                <Sprout className="h-5 w-5 text-green-600" />
                {editingId ? 'Edit Yield Report' : 'New Potato Yield Report'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Field</label>
                  <select className="form-input" value={form.fieldId} onChange={e => handleFieldSelect(e.target.value)}>
                    <option value="">Select field...</option>
                    {potatoFields.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.fieldNumber} {f.variety ? `— ${f.variety}` : ''}
                      </option>
                    ))}
                  </select>
                  {potatoFields.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No potato fields found. Add fields first.</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Variety</label>
                  <select className="form-input" value={form.variety} onChange={e => setForm(f => ({ ...f, variety: e.target.value }))}>
                    <option value="">Select variety...</option>
                    {potatoVarieties.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Potato Type</label>
                  <select className="form-input" value={form.potatoType} onChange={e => setForm(f => ({ ...f, potatoType: e.target.value as PotatoType, grades: {}, gradeWeights: {}, totalTuberCount: 0, totalTuberWeight: 0 }))}>
                    <option value="table">Table Potatoes</option>
                    <option value="processing">Processing Potatoes</option>
                  </select>
                </div>
              </div>

              {/* Grade table */}
              <div>
                <h3 className="text-sm font-semibold text-green-800 mb-3">
                  {form.potatoType === 'table' ? 'Table Potato Grades (by size)' : 'Processing Potato Grades (by weight)'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-green-50">
                        <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">
                          {form.potatoType === 'table' ? 'Size Grade' : 'Weight Grade'}
                        </th>
                        <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">Count</th>
                        <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">Weight (lbs)</th>
                        <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">% Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map(grade => (
                        <tr key={grade} className="hover:bg-gray-50">
                          <td className="px-3 py-2 border border-gray-200 font-medium text-gray-700 bg-gray-50">{grade}</td>
                          <td className="px-3 py-1.5 border border-gray-200">
                            <input
                              type="number"
                              min="0"
                              className="w-full text-sm border-0 focus:outline-none bg-transparent"
                              value={form.grades[grade] ?? ''}
                              onChange={e => setGradeCount(grade, parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-1.5 border border-gray-200">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              className="w-full text-sm border-0 focus:outline-none bg-transparent"
                              value={form.gradeWeights[grade] ?? ''}
                              onChange={e => setGradeWeight(grade, parseFloat(e.target.value) || 0)}
                              placeholder="0.0"
                            />
                          </td>
                          <td className="px-3 py-1.5 border border-gray-200 text-gray-600">
                            {form.totalTuberWeight > 0 ? (((form.gradeWeights[grade] ?? 0) / form.totalTuberWeight) * 100).toFixed(1) : '0.0'}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-green-50 font-semibold">
                        <td className="px-3 py-2 border border-gray-200 text-green-800">TOTALS</td>
                        <td className="px-3 py-2 border border-gray-200 text-green-800">{form.totalTuberCount}</td>
                        <td className="px-3 py-2 border border-gray-200 text-green-800">{form.totalTuberWeight.toFixed(2)} lbs</td>
                        <td className="px-3 py-2 border border-gray-200 text-green-800">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Yield Estimate */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3">
                  <Calculator className="h-6 w-6 text-green-700" />
                  <div>
                    <div className="text-sm text-green-700 font-medium">Estimated Yield</div>
                    <div className="text-3xl font-bold text-green-800">
                      {estimatedYield.toFixed(1)} <span className="text-lg font-normal">cwt/acre</span>
                    </div>
                    {estimatedYield > 0 && (
                      <div className="text-sm text-green-700 mt-1">
                        ≈ {(estimatedYield / 20).toFixed(2)} tons/acre &nbsp;|&nbsp;
                        ≈ {(estimatedYield * 100).toFixed(0)} lbs/acre
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Photos</label>
                <PhotoCapture photos={form.photos ?? []} onChange={photos => setForm(f => ({ ...f, photos }))} maxPhotos={6} />
              </div>

              {/* Notes */}
              <div>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input resize-none"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Additional notes, field conditions..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary">
                {editingId ? 'Save Changes' : 'Save Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Yield Report — Field {viewReport.fieldNumber}</h2>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewReport.date}</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{viewReport.potatoType}</span></div>
                <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{viewReport.variety || '—'}</span></div>
              </div>

              {/* Grade breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Grade Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 border border-gray-200">Grade</th>
                        <th className="text-left px-3 py-2 border border-gray-200">Count</th>
                        <th className="text-left px-3 py-2 border border-gray-200">Weight (lbs)</th>
                        <th className="text-left px-3 py-2 border border-gray-200">% Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewReport.potatoType === 'table' ? TABLE_GRADES : PROC_GRADES).map(grade => {
                        const count = viewReport.grades[grade] ?? 0;
                        const weight = viewReport.gradeWeights[grade] ?? 0;
                        const pct = viewReport.totalTuberWeight > 0 ? (weight / viewReport.totalTuberWeight * 100).toFixed(1) : '0.0';
                        if (count === 0 && weight === 0) return null;
                        return (
                          <tr key={grade} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 border border-gray-200 font-medium">{grade}</td>
                            <td className="px-3 py-1.5 border border-gray-200">{count}</td>
                            <td className="px-3 py-1.5 border border-gray-200">{weight.toFixed(2)}</td>
                            <td className="px-3 py-1.5 border border-gray-200">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-green-50 font-semibold">
                        <td className="px-3 py-2 border border-gray-200">TOTALS</td>
                        <td className="px-3 py-2 border border-gray-200">{viewReport.totalTuberCount}</td>
                        <td className="px-3 py-2 border border-gray-200">{viewReport.totalTuberWeight.toFixed(2)} lbs</td>
                        <td className="px-3 py-2 border border-gray-200">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Yield estimate */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                <div className="text-sm text-green-700 font-medium">Estimated Yield</div>
                <div className="text-4xl font-bold text-green-800 my-1">
                  {viewReport.estimatedYield.toFixed(1)} cwt/acre
                </div>
                <div className="text-sm text-green-600">
                  ≈ {(viewReport.estimatedYield / 20).toFixed(2)} tons/ac &nbsp;|&nbsp;
                  ≈ {(viewReport.estimatedYield * 100).toFixed(0)} lbs/ac
                </div>
              </div>

              {(viewReport.photos?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Photos ({viewReport.photos?.length ?? 0})</h3>
                  <div className="flex flex-wrap gap-2">
                    {(viewReport.photos ?? []).map((photo, i) => (
                      <img
                        key={`${viewReport.id}-photo-${i}`}
                        src={photo}
                        alt={`Yield report photo ${i + 1}`}
                        className="photo-thumbnail cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewPhoto(photo)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {viewReport.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewReport.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => handleDelete(viewReport.id)} className="btn-danger">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button onClick={() => { openEdit(viewReport); setViewReport(null); }} className="btn-primary">
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {previewPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999] p-4" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-w-3xl max-h-full">
            <img src={previewPhoto} alt="Yield report preview" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            <button className="absolute top-2 right-2 bg-white rounded-full p-1 text-gray-800 hover:bg-gray-100" onClick={() => setPreviewPhoto(null)}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
