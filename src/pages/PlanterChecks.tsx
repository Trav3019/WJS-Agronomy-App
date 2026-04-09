//  PlanterChecks page  rebuilt with 3-pass checks + doubles/skips 
import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, Plus, Ruler, Trash2, X } from 'lucide-react';
import type { AppData, Field, PlanterCheck, PlanterCheckPass, PlanterCheckRow } from '../types';
import { deletePlanterCheck, generateId, savePlanterCheck } from '../utils/storage';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

//  helpers 

function emptyRows(): PlanterCheckRow[] {
  return Array.from({ length: 8 }, (_, i) => ({
    rowNumber: i + 1,
    spacingInches: undefined,
    doublesCount: undefined,
    skipsCount: undefined,
    notes: '',
  }));
}

function hydrateRows(rows: PlanterCheckRow[] = []): PlanterCheckRow[] {
  return Array.from({ length: 8 }, (_, i) => {
    const existing = rows.find(r => r.rowNumber === i + 1);
    return existing ?? {
      rowNumber: i + 1,
      spacingInches: undefined,
      doublesCount: undefined,
      skipsCount: undefined,
      notes: '',
    };
  });
}

function emptyPasses(): PlanterCheckPass[] {
  return [1, 2, 3].map(n => ({ checkNumber: n, rows: emptyRows() }));
}

function hydratePasses(checks: PlanterCheckPass[]): PlanterCheckPass[] {
  return [1, 2, 3].map(n => {
    const existing = checks.find(c => c.checkNumber === n);
    return existing
      ? { ...existing, rows: hydrateRows(existing.rows) }
      : { checkNumber: n, rows: emptyRows() };
  });
}

type FormState = Omit<PlanterCheck, 'id' | 'createdAt'>;

function emptyForm(): FormState {
  return {
    fieldId: '',
    fieldNumber: '',
    variety: '',
    date: new Date().toISOString().split('T')[0],
    planterName: '8 Row Spudnik',
    targetSpacingInches: 10,
    toleranceInches: 1,
    checks: emptyPasses(),
    notes: '',
  };
}

interface PassSummary {
  measured: number;
  inTolerance: number;
  accuracyScore: number;
  avgSpacing: number | null;
  worstRowNum: number | null;
  totalDoubles: number;
  totalSkips: number;
}

function summarisePass(
  pass: PlanterCheckPass,
  target: number,
  tolerance: number,
): PassSummary {
  const measured = pass.rows.filter(r => r.spacingInches != null).length;
  const inTolerance = pass.rows.filter(
    r => r.spacingInches != null && Math.abs((r.spacingInches as number) - target) <= tolerance,
  ).length;
  const spacings = pass.rows.filter(r => r.spacingInches != null).map(r => r.spacingInches as number);
  const avgSpacing = spacings.length ? spacings.reduce((a, b) => a + b, 0) / spacings.length : null;
  const worstRow = pass.rows
    .filter(r => r.spacingInches != null)
    .reduce<PlanterCheckRow | null>((worst, r) => {
      if (!worst) return r;
      return Math.abs((r.spacingInches as number) - target) > Math.abs((worst.spacingInches as number) - target)
        ? r
        : worst;
    }, null);
  const totalDoubles = pass.rows.reduce((s, r) => s + (r.doublesCount ?? 0), 0);
  const totalSkips = pass.rows.reduce((s, r) => s + (r.skipsCount ?? 0), 0);
  return {
    measured,
    inTolerance,
    accuracyScore: measured ? Math.round((inTolerance / measured) * 100) : 0,
    avgSpacing,
    worstRowNum: worstRow?.rowNumber ?? null,
    totalDoubles,
    totalSkips,
  };
}

function summariseAll(
  checks: PlanterCheckPass[],
  target: number,
  tolerance: number,
): PassSummary {
  const all = checks.map(c => summarisePass(c, target, tolerance));
  const measured = all.reduce((s, p) => s + p.measured, 0);
  const inTolerance = all.reduce((s, p) => s + p.inTolerance, 0);
  const totalDoubles = all.reduce((s, p) => s + p.totalDoubles, 0);
  const totalSkips = all.reduce((s, p) => s + p.totalSkips, 0);
  const spacings = checks.flatMap(c =>
    c.rows.filter(r => r.spacingInches != null).map(r => r.spacingInches as number),
  );
  return {
    measured,
    inTolerance,
    accuracyScore: measured ? Math.round((inTolerance / measured) * 100) : 0,
    avgSpacing: spacings.length ? spacings.reduce((a, b) => a + b, 0) / spacings.length : null,
    worstRowNum: null,
    totalDoubles,
    totalSkips,
  };
}

function tone(score: number): string {
  if (score >= 95) return 'text-green-600';
  if (score >= 90) return 'text-yellow-600';
  return 'text-red-600';
}

function fieldLabel(f: Field): string {
  return `Field ${f.fieldNumber}${f.name ? `  ${f.name}` : ''}`;
}

//  component 

export default function PlanterChecks({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewCheck, setViewCheck] = useState<PlanterCheck | null>(null);
  const [activePass, setActivePass] = useState(0);

  const potatoFields = useMemo(
    () => data.fields.filter(f => f.cropType?.toLowerCase() === 'potato'),
    [data.fields],
  );

  const fieldVarieties = useMemo(() => {
    if (!form.fieldId) return [];
    const entries = data.seedingEntries?.filter(
      e => e.fieldId === form.fieldId || e.fieldNumber === form.fieldNumber,
    ) ?? [];
    const seen = new Set<string>();
    entries.forEach(e => e.variety && seen.add(e.variety));
    return [...seen];
  }, [form.fieldId, form.fieldNumber, data.seedingEntries]);

  function resetForm() {
    setForm(emptyForm());
    setEditId(null);
    setActivePass(0);
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(check: PlanterCheck) {
    setForm({
      fieldId: check.fieldId,
      fieldNumber: check.fieldNumber,
      variety: check.variety,
      date: check.date,
      planterName: check.planterName,
      targetSpacingInches: check.targetSpacingInches,
      toleranceInches: check.toleranceInches,
      checks: hydratePasses(check.checks ?? []),
      notes: check.notes,
    });
    setEditId(check.id);
    setActivePass(0);
    setShowForm(true);
  }

  function handleFieldChange(fieldId: string) {
    const field = data.fields.find(f => f.id === fieldId);
    if (!field) return;
    setForm(prev => ({ ...prev, fieldId, fieldNumber: field.fieldNumber, variety: '' }));
  }

  function handleRowChange(
    passIdx: number,
    rowIdx: number,
    key: keyof PlanterCheckRow,
    value: string,
  ) {
    setForm(prev => {
      const checks = prev.checks.map((pass, pi) => {
        if (pi !== passIdx) return pass;
        const rows = pass.rows.map((row, ri) => {
          if (ri !== rowIdx) return row;
          if (key === 'notes') return { ...row, notes: value };
          const num = value === '' ? undefined : Number(value);
          return { ...row, [key]: num };
        });
        return { ...pass, rows };
      });
      return { ...prev, checks };
    });
  }

  function handleSave() {
    if (!form.fieldId || !form.date) return;
    if (editId) {
      const existing = data.planterChecks.find(c => c.id === editId);
      updateData(prev => savePlanterCheck(prev, {
        ...form,
        id: editId,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }));
    } else {
      updateData(prev => savePlanterCheck(prev, {
        ...form,
        id: generateId(),
        createdAt: new Date().toISOString(),
      }));
    }
    setShowForm(false);
    resetForm();
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this planter check?')) return;
    updateData(prev => deletePlanterCheck(prev, id));
  }

  const currentPass = form.checks[activePass];

  const passSummary = useMemo(
    () => currentPass
      ? summarisePass(currentPass, form.targetSpacingInches, form.toleranceInches)
      : null,
    [currentPass, form.targetSpacingInches, form.toleranceInches],
  );

  const overallSummary = useMemo(
    () => summariseAll(form.checks, form.targetSpacingInches, form.toleranceInches),
    [form.checks, form.targetSpacingInches, form.toleranceInches],
  );

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        <NavLink
          to="/seeding"
          end
          className={({ isActive }) =>
            `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
          }
        >
          Seeding Records
        </NavLink>
        <NavLink
          to="/seeding/planter-checks"
          className={({ isActive }) =>
            `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`
          }
        >
          Planter Checks
        </NavLink>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-800">Planter Checks</h2>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Check
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">{editId ? 'Edit' : 'New'} Planter Check</h3>
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field *</label>
              <select
                value={form.fieldId}
                onChange={e => handleFieldChange(e.target.value)}
                className="form-input"
              >
                <option value="">Select field</option>
                {potatoFields.map(f => (
                  <option key={f.id} value={f.id}>{fieldLabel(f)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Variety</label>
              {fieldVarieties.length > 0 ? (
                <select
                  value={form.variety}
                  onChange={e => setForm(p => ({ ...p, variety: e.target.value }))}
                  className="form-input"
                >
                  <option value="">Select variety</option>
                  {fieldVarieties.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.variety}
                  onChange={e => setForm(p => ({ ...p, variety: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. Russet Burbank"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planter</label>
              <input
                type="text"
                value={form.planterName}
                onChange={e => setForm(p => ({ ...p, planterName: e.target.value }))}
                className="form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Spacing (in)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={form.targetSpacingInches}
                onChange={e => setForm(p => ({ ...p, targetSpacingInches: Number(e.target.value) }))}
                className="form-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tolerance  (in)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.toleranceInches}
                onChange={e => setForm(p => ({ ...p, toleranceInches: Number(e.target.value) }))}
                className="form-input"
              />
            </div>
          </div>

          {/* Pass tabs */}
          <div>
            <div className="flex gap-1 mb-0">
              {form.checks.map((pass, idx) => {
                const s = summarisePass(pass, form.targetSpacingInches, form.toleranceInches);
                const hasData = s.measured > 0;
                return (
                  <button
                    key={pass.checkNumber}
                    type="button"
                    onClick={() => setActivePass(idx)}
                    className={`px-4 py-2 rounded-t text-sm font-medium border-t border-l border-r ${
                      activePass === idx
                        ? 'bg-white border-gray-300 text-blue-600 -mb-px z-10 relative'
                        : 'bg-gray-100 border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Check {pass.checkNumber}
                    {hasData && (
                      <span className={`ml-2 text-xs font-semibold ${tone(s.accuracyScore)}`}>
                        {s.accuracyScore}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="border border-gray-300 rounded-b rounded-tr p-3 flex gap-4">
              {/* Row table */}
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="px-2 py-2 text-left w-10">Row</th>
                      <th className="px-2 py-2 text-left">Spacing (in)</th>
                      <th className="px-2 py-2 text-left">Dev.</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Doubles</th>
                      <th className="px-2 py-2 text-left">Skips</th>
                      <th className="px-2 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPass?.rows.map((row, ri) => {
                      const spacing = row.spacingInches;
                      const dev = spacing != null ? spacing - form.targetSpacingInches : null;
                      const inTol = dev != null && Math.abs(dev) <= form.toleranceInches;
                      return (
                        <tr key={row.rowNumber} className="border-t border-gray-100">
                          <td className="px-2 py-1 text-gray-500 font-medium">{row.rowNumber}</td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={row.spacingInches ?? ''}
                              onChange={e => handleRowChange(activePass, ri, 'spacingInches', e.target.value)}
                              className="form-input py-0.5 w-20"
                            />
                          </td>
                          <td className={`px-2 py-1 font-mono text-xs ${dev != null ? (inTol ? 'text-green-600' : 'text-red-600') : 'text-gray-300'}`}>
                            {dev != null ? (dev >= 0 ? '+' : '') + dev.toFixed(2) : ''}
                          </td>
                          <td className="px-2 py-1">
                            {spacing == null ? (
                              <span className="text-gray-300"></span>
                            ) : inTol ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              value={row.doublesCount ?? ''}
                              onChange={e => handleRowChange(activePass, ri, 'doublesCount', e.target.value)}
                              className="form-input py-0.5 w-16"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              value={row.skipsCount ?? ''}
                              onChange={e => handleRowChange(activePass, ri, 'skipsCount', e.target.value)}
                              className="form-input py-0.5 w-16"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={row.notes ?? ''}
                              onChange={e => handleRowChange(activePass, ri, 'notes', e.target.value)}
                              className="form-input py-0.5 w-28"
                              placeholder="optional"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Live summary sidebar */}
              {passSummary && passSummary.measured > 0 && (
                <div className="w-44 shrink-0 bg-gray-50 rounded p-3 space-y-2 text-sm self-start">
                  <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide">
                    Check {currentPass?.checkNumber}
                  </p>
                  <div>
                    <span className="text-xs text-gray-500">Accuracy</span>
                    <p className={`text-2xl font-bold ${tone(passSummary.accuracyScore)}`}>
                      {passSummary.accuracyScore}%
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <span className="text-gray-500">Measured</span>
                    <span>{passSummary.measured} / 8</span>
                    <span className="text-gray-500">In tolerance</span>
                    <span>{passSummary.inTolerance}</span>
                    {passSummary.avgSpacing != null && (
                      <>
                        <span className="text-gray-500">Avg spacing</span>
                        <span>{passSummary.avgSpacing.toFixed(2)}&quot;</span>
                      </>
                    )}
                    {passSummary.worstRowNum != null && (
                      <>
                        <span className="text-gray-500">Worst row</span>
                        <span>#{passSummary.worstRowNum}</span>
                      </>
                    )}
                    <span className="text-gray-500">Doubles</span>
                    <span className={passSummary.totalDoubles > 0 ? 'text-yellow-600 font-semibold' : ''}>
                      {passSummary.totalDoubles}
                    </span>
                    <span className="text-gray-500">Skips</span>
                    <span className={passSummary.totalSkips > 0 ? 'text-red-600 font-semibold' : ''}>
                      {passSummary.totalSkips}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Overall summary bar */}
          {overallSummary.measured > 0 && (
            <div className="flex flex-wrap items-center gap-4 rounded bg-blue-50 px-4 py-2 text-sm">
              <span className="font-medium text-blue-700">Overall (all checks)</span>
              <span className={`font-bold ${tone(overallSummary.accuracyScore)}`}>
                {overallSummary.accuracyScore}% accuracy
              </span>
              <span className="text-gray-600">{overallSummary.measured} spacings measured</span>
              {overallSummary.totalDoubles > 0 && (
                <span className="text-yellow-700 font-medium">{overallSummary.totalDoubles} doubles</span>
              )}
              {overallSummary.totalSkips > 0 && (
                <span className="text-red-700 font-medium">{overallSummary.totalSkips} skips</span>
              )}
            </div>
          )}

          {/* General notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">General Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="form-input"
              placeholder="Any additional notes"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.fieldId || !form.date}
              className="btn-primary"
            >
              {editId ? 'Update' : 'Save'} Check
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {data.planterChecks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Ruler className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No planter checks recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...data.planterChecks]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(check => {
              const overall = summariseAll(
                check.checks ?? [],
                check.targetSpacingInches,
                check.toleranceInches,
              );
              return (
                <div key={check.id} className="card flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-gray-800">
                        Field {check.fieldNumber}
                      </span>
                      {check.variety && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          {check.variety}
                        </span>
                      )}
                      <span className="text-sm text-gray-500">{check.date}</span>
                      <span className="text-xs text-gray-400">{check.planterName}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(check.checks ?? []).map(pass => {
                        const s = summarisePass(pass, check.targetSpacingInches, check.toleranceInches);
                        if (s.measured === 0) return null;
                        return (
                          <span
                            key={pass.checkNumber}
                            className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-2 py-0.5"
                          >
                            <span className="text-gray-600">Check {pass.checkNumber}</span>
                            <span className={`font-semibold ${tone(s.accuracyScore)}`}>
                              {s.accuracyScore}%
                            </span>
                            {s.totalDoubles > 0 && (
                              <span className="text-yellow-600">D:{s.totalDoubles}</span>
                            )}
                            {s.totalSkips > 0 && (
                              <span className="text-red-600">S:{s.totalSkips}</span>
                            )}
                          </span>
                        );
                      })}
                      {overall.measured > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded px-2 py-0.5">
                          Overall {overall.accuracyScore}%
                        </span>
                      )}
                    </div>
                    {check.notes && (
                      <p className="mt-1 text-xs text-gray-500 truncate">{check.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setViewCheck(check)}
                      className="p-1 text-gray-400 hover:text-blue-500"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(check)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Ruler className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(check.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* View modal */}
      {viewCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Field {viewCheck.fieldNumber}  {viewCheck.date}
              </h3>
              <button
                onClick={() => setViewCheck(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-gray-500 flex gap-4 flex-wrap">
              {viewCheck.variety && (
                <span>Variety: <strong>{viewCheck.variety}</strong></span>
              )}
              <span>Planter: <strong>{viewCheck.planterName}</strong></span>
              <span>Target: <strong>{viewCheck.targetSpacingInches}&quot;</strong></span>
              <span>Tolerance: <strong>{viewCheck.toleranceInches}&quot;</strong></span>
            </div>

            {(viewCheck.checks ?? []).map(pass => {
              const s = summarisePass(pass, viewCheck.targetSpacingInches, viewCheck.toleranceInches);
              return (
                <div key={pass.checkNumber}>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h4 className="font-semibold text-gray-700">Check {pass.checkNumber}</h4>
                    {s.measured > 0 && (
                      <>
                        <span className={`font-bold text-sm ${tone(s.accuracyScore)}`}>
                          {s.accuracyScore}% accuracy
                        </span>
                        {s.totalDoubles > 0 && (
                          <span className="text-xs text-yellow-600">Doubles: {s.totalDoubles}</span>
                        )}
                        {s.totalSkips > 0 && (
                          <span className="text-xs text-red-600">Skips: {s.totalSkips}</span>
                        )}
                      </>
                    )}
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600">
                        <th className="px-2 py-1 text-left">Row</th>
                        <th className="px-2 py-1 text-left">Spacing</th>
                        <th className="px-2 py-1 text-left">Dev.</th>
                        <th className="px-2 py-1 text-left">Status</th>
                        <th className="px-2 py-1 text-left">Doubles</th>
                        <th className="px-2 py-1 text-left">Skips</th>
                        <th className="px-2 py-1 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pass.rows.map(row => {
                        const spacing = row.spacingInches;
                        const dev = spacing != null ? spacing - viewCheck.targetSpacingInches : null;
                        const inTol = dev != null && Math.abs(dev) <= viewCheck.toleranceInches;
                        return (
                          <tr key={row.rowNumber} className="border-t border-gray-100">
                            <td className="px-2 py-1 text-gray-500">{row.rowNumber}</td>
                            <td className="px-2 py-1">{spacing != null ? `${spacing}"` : ''}</td>
                            <td className={`px-2 py-1 font-mono text-xs ${dev != null ? (inTol ? 'text-green-600' : 'text-red-600') : 'text-gray-300'}`}>
                              {dev != null ? (dev >= 0 ? '+' : '') + dev.toFixed(2) : ''}
                            </td>
                            <td className="px-2 py-1">
                              {spacing == null ? (
                                <span className="text-gray-300"></span>
                              ) : inTol ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              )}
                            </td>
                            <td className="px-2 py-1 text-gray-700">{row.doublesCount ?? ''}</td>
                            <td className="px-2 py-1 text-gray-700">{row.skipsCount ?? ''}</td>
                            <td className="px-2 py-1 text-gray-500">{row.notes || ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {viewCheck.notes && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">{viewCheck.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
