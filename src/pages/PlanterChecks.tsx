import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle2,
  Ruler,
  Settings2,
  X,
} from 'lucide-react';
import type { AppData, Field, PlanterCheck, PlanterCheckPass, PlanterCheckRow } from '../types';
import { deletePlanterCheck, generateId, savePlanterCheck } from '../utils/storage';
import { VARIETIES_BY_CROP } from '../utils/varieties';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const DEFAULT_PLANTER_NAME = '8 Row Spudnik';

function createRows(rows: PlanterCheckRow[] = []): PlanterCheckRow[] {
  return Array.from({ length: 8 }, (_, index) => {
    const existing = rows.find(row => row.rowNumber === index + 1);
    return existing ?? {
      rowNumber: index + 1,
      spacingInches: undefined,
      doublesCount: undefined,
      skipsCount: undefined,
      notes: '',
    };
  });
}

function createPasses(checks: PlanterCheckPass[] = [], legacyRows: PlanterCheckRow[] = []): PlanterCheckPass[] {
  return [1, 2, 3].map(checkNumber => {
    const existing = checks.find(check => check.checkNumber === checkNumber);
    if (existing) {
      return {
        ...existing,
        rows: createRows(existing.rows),
      };
    }

    if (checkNumber === 1 && legacyRows.length > 0) {
      return {
        checkNumber,
        rows: createRows(legacyRows),
      };
    }

    return {
      checkNumber,
      rows: createRows(),
    };
  });
}

function emptyCheck(): Omit<PlanterCheck, 'id' | 'createdAt'> {
  return {
    fieldId: '',
    fieldNumber: '',
    variety: '',
    date: new Date().toISOString().split('T')[0],
    planterName: DEFAULT_PLANTER_NAME,
    targetSpacingInches: 10,
    toleranceInches: 1,
    checks: createPasses(),
    notes: '',
  };
}

interface RowSummary {
  measuredCount: number;
  avgSpacing: number;
  avgDeviation: number;
  accuracyScore: number;
  withinToleranceCount: number;
  worstRow: PlanterCheckRow | null;
  totalDoubles: number;
  totalSkips: number;
}

function summarizeRows(rows: PlanterCheckRow[], targetSpacingInches: number, toleranceInches: number): RowSummary {
  const measuredRows = rows.filter(row => typeof row.spacingInches === 'number' && Number.isFinite(row.spacingInches));
  const totalDoubles = rows.reduce((sum, row) => sum + (row.doublesCount ?? 0), 0);
  const totalSkips = rows.reduce((sum, row) => sum + (row.skipsCount ?? 0), 0);

  if (measuredRows.length === 0 || targetSpacingInches <= 0) {
    return {
      measuredCount: 0,
      avgSpacing: 0,
      avgDeviation: 0,
      accuracyScore: 0,
      withinToleranceCount: 0,
      worstRow: null,
      totalDoubles,
      totalSkips,
    };
  }

  const deviations = measuredRows.map(row => ({
    row,
    deviation: Math.abs((row.spacingInches ?? 0) - targetSpacingInches),
  }));

  const avgSpacing = measuredRows.reduce((sum, row) => sum + (row.spacingInches ?? 0), 0) / measuredRows.length;
  const avgDeviation = deviations.reduce((sum, item) => sum + item.deviation, 0) / deviations.length;
  const accuracyScore = Math.max(0, 100 - (avgDeviation / targetSpacingInches) * 100);
  const withinToleranceCount = deviations.filter(item => item.deviation <= toleranceInches).length;
  const worstRow = deviations.sort((a, b) => b.deviation - a.deviation)[0]?.row ?? null;

  return {
    measuredCount: measuredRows.length,
    avgSpacing,
    avgDeviation,
    accuracyScore,
    withinToleranceCount,
    worstRow,
    totalDoubles,
    totalSkips,
  };
}

function summarizeChecks(checks: PlanterCheckPass[], targetSpacingInches: number, toleranceInches: number): RowSummary {
  const allRows = checks.flatMap(check => check.rows);
  return summarizeRows(allRows, targetSpacingInches, toleranceInches);
}

function accuracyTone(score: number) {
  if (score >= 95) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 90) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function fieldLabel(field: Field) {
  return `${field.fieldNumber} (${field.cropType})`;
}

export default function PlanterChecks({ data, updateData }: Props) {
  const potatoFields = useMemo(
    () => [...data.fields]
      .filter(field => field.cropType === 'Potatoes')
      .sort((a, b) => a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' })),
    [data.fields]
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewCheck, setViewCheck] = useState<PlanterCheck | null>(null);
  const [activeCheckIndex, setActiveCheckIndex] = useState(0);
  const [form, setForm] = useState(emptyCheck());

  const filteredChecks = [...data.planterChecks].sort((a, b) => b.date.localeCompare(a.date));

  const fieldVarieties = useMemo(() => {
    if (!form.fieldId) return [];
    const entries = data.seedingEntries?.filter(
      entry => entry.fieldId === form.fieldId || entry.fieldNumber === form.fieldNumber,
    ) ?? [];
    return Array.from(new Set(entries.map(entry => entry.variety).filter(Boolean)));
  }, [data.seedingEntries, form.fieldId, form.fieldNumber]);

  const varietyOptions = useMemo(() => {
    const options = new Set<string>(VARIETIES_BY_CROP.Potatoes ?? []);
    fieldVarieties.forEach(variety => options.add(variety));
    if (form.variety) options.add(form.variety);
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [fieldVarieties, form.variety]);

  function openNew() {
    setEditingId(null);
    setActiveCheckIndex(0);
    setForm(emptyCheck());
    setShowForm(true);
  }

  function openEdit(check: PlanterCheck) {
    setEditingId(check.id);
    setActiveCheckIndex(0);
    setForm({
      fieldId: check.fieldId,
      fieldNumber: check.fieldNumber,
      variety: check.variety,
      date: check.date,
      planterName: check.planterName,
      targetSpacingInches: check.targetSpacingInches,
      toleranceInches: check.toleranceInches,
      checks: createPasses(check.checks ?? [], check.rows ?? []),
      notes: check.notes,
    });
    setShowForm(true);
  }

  function handleFieldSelect(fieldId: string) {
    const field = potatoFields.find(item => item.id === fieldId);
    setForm(current => ({
      ...current,
      fieldId,
      fieldNumber: field?.fieldNumber ?? '',
      variety: field?.variety ?? current.variety,
    }));
  }

  function handleRowChange(rowNumber: number, key: keyof PlanterCheckRow, value: string) {
    setForm(current => {
      const checks = current.checks.map((check, index) => {
        if (index !== activeCheckIndex) return check;

        const rows = check.rows.map(row => {
          if (row.rowNumber !== rowNumber) return row;

          const numericValue = value === '' ? undefined : Number(value);
          return { ...row, [key]: numericValue };
        });

        return { ...check, rows };
      });

      return { ...current, checks };
    });
  }

  function handleSave() {
    if (!form.fieldId || !form.date) return;

    const now = new Date().toISOString();
    const check: PlanterCheck = {
      id: editingId ?? generateId(),
      ...form,
      checks: createPasses(form.checks),
      rows: undefined,
      createdAt: editingId
        ? (data.planterChecks.find(entry => entry.id === editingId)?.createdAt ?? now)
        : now,
    };

    updateData(prev => savePlanterCheck(prev, check));
    setShowForm(false);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this planter check?')) return;
    updateData(prev => deletePlanterCheck(prev, id));
    setViewCheck(null);
  }

  const activeCheck = form.checks[activeCheckIndex] ?? createPasses()[0];
  const currentSummary = summarizeRows(activeCheck.rows, form.targetSpacingInches, form.toleranceInches);
  const overallSummary = summarizeChecks(form.checks, form.targetSpacingInches, form.toleranceInches);

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

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Potato Planter Checks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record eight-row spacing checks and see planter accuracy across the full machine.</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Planter Check
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-500">Checks Logged</div>
          <div className="mt-2 text-2xl font-bold text-green-900">{filteredChecks.length}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-500">Potato Fields</div>
          <div className="mt-2 text-2xl font-bold text-green-900">{potatoFields.length}</div>
        </div>
        <div className="card md:col-span-2 border border-green-100 bg-green-50/70">
          <div className="flex items-start gap-3">
            <Settings2 className="h-5 w-5 text-green-700 mt-0.5" />
            <div className="text-sm text-green-900">
              Use this for pre-start or in-field potato planter checks. Run up to three checks per field and track doubles/skips by row so problem units stand out quickly.
            </div>
          </div>
        </div>
      </div>

      {filteredChecks.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          No planter checks yet. Add one before or during potato planting to compare all 8 rows side by side.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredChecks.map(check => {
            const checks = createPasses(check.checks ?? [], check.rows ?? []);
            const summary = summarizeChecks(checks, check.targetSpacingInches, check.toleranceInches);
            const checksWithData = checks.filter(c => summarizeRows(c.rows, check.targetSpacingInches, check.toleranceInches).measuredCount > 0).length;

            return (
              <div key={check.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-green-900">Field {check.fieldNumber}</span>
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Potatoes</span>
                      {check.variety && <span className="text-xs text-gray-500">{check.variety}</span>}
                    </div>
                    <div className="text-xs text-gray-500 space-x-3">
                      <span>Date: {check.date}</span>
                      <span>{check.planterName}</span>
                      <span>Target: {check.targetSpacingInches.toFixed(1)}&quot;</span>
                      <span>Tolerance: +/- {check.toleranceInches.toFixed(1)}&quot;</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      <div className={`rounded-lg border px-3 py-2 ${accuracyTone(summary.accuracyScore)}`}>
                        <div className="text-xs uppercase tracking-wide">Accuracy</div>
                        <div className="text-lg font-bold">{summary.accuracyScore.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Avg Spacing</div>
                        <div className="text-lg font-bold text-gray-900">{summary.measuredCount > 0 ? `${summary.avgSpacing.toFixed(2)}\"` : '—'}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Rows In Tolerance</div>
                        <div className="text-lg font-bold text-gray-900">{summary.withinToleranceCount}/24</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Checks Used</div>
                        <div className="text-lg font-bold text-gray-900">{checksWithData}/3</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Doubles / Skips</div>
                        <div className="text-lg font-bold text-gray-900">{summary.totalDoubles} / {summary.totalSkips}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => setViewCheck(check)} className="btn-secondary text-xs py-1.5 px-2.5">
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    <button onClick={() => openEdit(check)} className="btn-secondary text-xs py-1.5 px-2.5">Edit</button>
                    <button onClick={() => handleDelete(check.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 sm:p-4">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Ruler className="h-5 w-5 text-green-600" />
                {editingId ? 'Edit Planter Check' : 'New Planter Check'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              {potatoFields.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Add a potato field in Fields before creating planter checks.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="form-label">Field</label>
                  <select className="form-input" value={form.fieldId} onChange={e => handleFieldSelect(e.target.value)}>
                    <option value="">Select potato field...</option>
                    {potatoFields.map(field => (
                      <option key={field.id} value={field.id}>{fieldLabel(field)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(current => ({ ...current, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Planter</label>
                  <input className="form-input" value={form.planterName} onChange={e => setForm(current => ({ ...current, planterName: e.target.value }))} placeholder="8 Row Spudnik" />
                </div>
                <div>
                  <label className="form-label">Variety</label>
                  <select className="form-input" value={form.variety} onChange={e => setForm(current => ({ ...current, variety: e.target.value }))}>
                    <option value="">Select variety...</option>
                    {varietyOptions.map(variety => <option key={variety} value={variety}>{variety}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Target Spacing (inches)</label>
                  <input type="number" step="0.1" className="form-input" value={form.targetSpacingInches || ''} onChange={e => setForm(current => ({ ...current, targetSpacingInches: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="form-label">Tolerance (+/- inches)</label>
                  <input type="number" step="0.1" className="form-input" value={form.toleranceInches || ''} onChange={e => setForm(current => ({ ...current, toleranceInches: Number(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50/70 p-2">
                <div className="flex flex-wrap gap-2">
                  {form.checks.map((check, index) => {
                    const summary = summarizeRows(check.rows, form.targetSpacingInches, form.toleranceInches);
                    const active = index === activeCheckIndex;
                    return (
                      <button
                        key={check.checkNumber}
                        type="button"
                        onClick={() => setActiveCheckIndex(index)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                          active
                            ? 'border-green-700 bg-green-700 text-white'
                            : 'border-green-200 bg-white text-green-800 hover:bg-green-100'
                        }`}
                      >
                        Check {check.checkNumber}
                        {summary.measuredCount > 0 && (
                          <span className={`ml-2 text-xs ${active ? 'text-green-100' : 'text-green-700'}`}>
                            {summary.accuracyScore.toFixed(1)}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_280px]">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">Row Measurements - Check {activeCheck.checkNumber}</h3>
                    <div className="text-xs text-gray-500">Enter spacing, doubles, and skips for each planter row.</div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-green-50 text-left text-gray-700">
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Measured Spacing</th>
                          <th className="px-3 py-2">Deviation</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Doubles</th>
                          <th className="px-3 py-2">Skips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCheck.rows.map(row => {
                          const deviation = typeof row.spacingInches === 'number'
                            ? row.spacingInches - form.targetSpacingInches
                            : undefined;
                          const withinTolerance = typeof deviation === 'number' && Math.abs(deviation) <= form.toleranceInches;

                          return (
                            <tr key={row.rowNumber} className="border-b border-gray-100 last:border-b-0">
                              <td className="px-3 py-2 font-medium text-green-900">{row.rowNumber}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  className="form-input w-20 sm:w-24"
                                  value={row.spacingInches ?? ''}
                                  onChange={e => handleRowChange(row.rowNumber, 'spacingInches', e.target.value)}
                                  placeholder="0.0"
                                />
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {typeof deviation === 'number' ? `${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}\"` : '—'}
                              </td>
                              <td className="px-3 py-2">
                                {typeof deviation !== 'number' ? (
                                  <span className="text-xs text-gray-400">No reading</span>
                                ) : withinTolerance ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> In tolerance
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                                    <AlertCircle className="h-3.5 w-3.5" /> Adjust
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input w-16 sm:w-20"
                                  value={row.doublesCount ?? ''}
                                  onChange={e => handleRowChange(row.rowNumber, 'doublesCount', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input w-16 sm:w-20"
                                  value={row.skipsCount ?? ''}
                                  onChange={e => handleRowChange(row.rowNumber, 'skipsCount', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className={`rounded-xl border p-4 ${accuracyTone(overallSummary.accuracyScore)}`}>
                    <div className="text-xs uppercase tracking-wide">Whole Planter Accuracy</div>
                    <div className="mt-2 text-3xl font-bold">{overallSummary.accuracyScore.toFixed(1)}%</div>
                    <p className="mt-2 text-xs opacity-80">Overall spacing performance across Check 1, Check 2, and Check 3.</p>
                  </div>

                  <div className={`rounded-xl border p-4 ${accuracyTone(currentSummary.accuracyScore)}`}>
                    <div className="text-xs uppercase tracking-wide">Check {activeCheck.checkNumber} Accuracy</div>
                    <div className="mt-2 text-2xl font-bold">{currentSummary.accuracyScore.toFixed(1)}%</div>
                    <p className="mt-2 text-xs opacity-80">Current tab accuracy for this pass only.</p>
                  </div>

                  <div className="card space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Measured rows</span>
                      <span className="font-semibold text-gray-900">{currentSummary.measuredCount}/8</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Avg spacing</span>
                      <span className="font-semibold text-gray-900">{currentSummary.measuredCount > 0 ? `${currentSummary.avgSpacing.toFixed(2)}\"` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Avg deviation</span>
                      <span className="font-semibold text-gray-900">{currentSummary.measuredCount > 0 ? `${currentSummary.avgDeviation.toFixed(2)}\"` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Rows in tolerance</span>
                      <span className="font-semibold text-gray-900">{currentSummary.withinToleranceCount}/8</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Worst row</span>
                      <span className="font-semibold text-gray-900">{currentSummary.worstRow ? `Row ${currentSummary.worstRow.rowNumber}` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Doubles</span>
                      <span className="font-semibold text-gray-900">{currentSummary.totalDoubles}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Skips</span>
                      <span className="font-semibold text-gray-900">{currentSummary.totalSkips}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-600">Overall Row Stats</div>
                    <div className="mt-2 text-xs text-gray-700">{overallSummary.withinToleranceCount}/24 rows in tolerance</div>
                    <div className="mt-1 text-xs text-gray-700">Doubles: {overallSummary.totalDoubles} | Skips: {overallSummary.totalSkips}</div>
                  </div>

                  <div>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input resize-none" rows={6} value={form.notes} onChange={e => setForm(current => ({ ...current, notes: e.target.value }))} placeholder="What changed, which rows were adjusted, chain/sprocket settings, depth changes..." />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 rounded-b-xl border-t bg-gray-50 p-4 sm:p-5">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.fieldId || !form.date || potatoFields.length === 0}>
                {editingId ? 'Save Changes' : 'Save Check'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewCheck && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4">
          <div className="my-4 w-full max-w-3xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-semibold">Planter Check - Field {viewCheck.fieldNumber}</h2>
              <button onClick={() => setViewCheck(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5 text-sm">
              {(() => {
                const checks = createPasses(viewCheck.checks ?? [], viewCheck.rows ?? []);
                const summary = summarizeChecks(checks, viewCheck.targetSpacingInches, viewCheck.toleranceInches);
                return (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Date</div>
                        <div className="mt-1 font-semibold text-gray-900">{viewCheck.date}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Planter</div>
                        <div className="mt-1 font-semibold text-gray-900">{viewCheck.planterName}</div>
                      </div>
                      <div className={`rounded-lg border px-4 py-3 ${accuracyTone(summary.accuracyScore)}`}>
                        <div className="text-xs uppercase tracking-wide">Overall Accuracy</div>
                        <div className="mt-1 font-semibold">{summary.accuracyScore.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Doubles / Skips</div>
                        <div className="mt-1 font-semibold text-gray-900">{summary.totalDoubles} / {summary.totalSkips}</div>
                      </div>
                    </div>

                    {checks.map(checkPass => {
                      const checkSummary = summarizeRows(checkPass.rows, viewCheck.targetSpacingInches, viewCheck.toleranceInches);
                      return (
                        <div key={checkPass.checkNumber} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-700">Check {checkPass.checkNumber}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${accuracyTone(checkSummary.accuracyScore)}`}>
                              {checkSummary.accuracyScore.toFixed(1)}%
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-green-50 text-left text-gray-700">
                                  <th className="px-3 py-2">Row</th>
                                  <th className="px-3 py-2">Measured</th>
                                  <th className="px-3 py-2">Deviation</th>
                                  <th className="px-3 py-2">Doubles</th>
                                  <th className="px-3 py-2">Skips</th>
                                </tr>
                              </thead>
                              <tbody>
                                {checkPass.rows.map(row => {
                                  const deviation = typeof row.spacingInches === 'number'
                                    ? row.spacingInches - viewCheck.targetSpacingInches
                                    : undefined;
                                  return (
                                    <tr key={row.rowNumber} className="border-b border-gray-100 last:border-b-0">
                                      <td className="px-3 py-2 font-medium text-green-900">{row.rowNumber}</td>
                                      <td className="px-3 py-2">{typeof row.spacingInches === 'number' ? `${row.spacingInches.toFixed(2)}\"` : '—'}</td>
                                      <td className="px-3 py-2">{typeof deviation === 'number' ? `${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}\"` : '—'}</td>
                                      <td className="px-3 py-2">{row.doublesCount ?? 0}</td>
                                      <td className="px-3 py-2">{row.skipsCount ?? 0}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}

                    {viewCheck.notes && (
                      <div>
                        <h3 className="mb-1 text-sm font-semibold text-gray-700">Notes</h3>
                        <p className="rounded-lg bg-gray-50 p-3 text-gray-600">{viewCheck.notes}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex justify-end gap-3 border-t bg-gray-50 p-5">
              <button onClick={() => handleDelete(viewCheck.id)} className="btn-danger">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button onClick={() => { openEdit(viewCheck); setViewCheck(null); }} className="btn-primary">Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
