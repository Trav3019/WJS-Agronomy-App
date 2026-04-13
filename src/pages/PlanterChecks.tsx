import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Eye,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Ruler,
  X,
} from 'lucide-react';
import type { AppData, CropType, Field, PlanterCheck, PlanterCheckPass, PlanterCheckRow } from '../types';
import { deletePlanterCheck, generateId, savePlanterCheck } from '../utils/storage';
import { VARIETIES_BY_CROP } from '../utils/varieties';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const DEFAULT_PLANTER_NAME = 'Spudnik - Jake';
const DEFAULT_ROW_PLANTER_NAME = 'DB88-Mike';
const DEFAULT_AIR_SEEDER_NAME = '1895';
const CHECK_ROW_COUNT = 8;
const EQUIPMENT_NAME_OPTIONS = ['DB88-Mike', 'DB88-Clint', 'DB44', 'Spudnik - Jake', 'Spudnik-Ben', '730', '1895'] as const;

const EQUIPMENT_OPTIONS = [
  {
    value: 'potato-planter' as const,
    label: 'Potato Planter',
    defaultName: DEFAULT_PLANTER_NAME,
    defaultRowCount: CHECK_ROW_COUNT,
    defaultSpacing: 10,
    defaultSpacingTolerance: 1,
    defaultDepth: 4,
    defaultDepthTolerance: 0.5,
  },
  {
    value: 'row-planter' as const,
    label: 'Row Crop Planter',
    defaultName: DEFAULT_ROW_PLANTER_NAME,
    defaultRowCount: CHECK_ROW_COUNT,
    defaultSpacing: 8,
    defaultSpacingTolerance: 0.75,
    defaultDepth: 2,
    defaultDepthTolerance: 0.5,
  },
  {
    value: 'air-seeder' as const,
    label: 'Air Seeder',
    defaultName: DEFAULT_AIR_SEEDER_NAME,
    defaultRowCount: CHECK_ROW_COUNT,
    defaultSpacing: 7.5,
    defaultSpacingTolerance: 0.5,
    defaultDepth: 1.5,
    defaultDepthTolerance: 0.4,
  },
];

function equipmentMeta(equipmentType: PlanterCheck['equipmentType']) {
  return EQUIPMENT_OPTIONS.find(option => option.value === equipmentType) ?? EQUIPMENT_OPTIONS[0];
}

function createRows(rows: PlanterCheckRow[] = []): PlanterCheckRow[] {
  return Array.from({ length: CHECK_ROW_COUNT }, (_, index) => {
    const existing = rows.find(row => row.rowNumber === index + 1);
    return existing ?? {
      rowNumber: index + 1,
      spacingInches: undefined,
      depthInches: undefined,
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
  const defaults = equipmentMeta('potato-planter');
  return {
    fieldId: '',
    fieldNumber: '',
    variety: '',
    date: new Date().toISOString().split('T')[0],
    equipmentType: defaults.value,
    planterName: defaults.defaultName,
    rowCount: CHECK_ROW_COUNT,
    targetSpacingInches: defaults.defaultSpacing,
    toleranceInches: defaults.defaultSpacingTolerance,
    targetDepthInches: defaults.defaultDepth,
    depthToleranceInches: defaults.defaultDepthTolerance,
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

interface DepthSummary {
  measuredCount: number;
  avgDepth: number;
  avgDeviation: number;
  accuracyScore: number;
  withinToleranceCount: number;
  worstRow: PlanterCheckRow | null;
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

function summarizeDepthRows(rows: PlanterCheckRow[], targetDepthInches: number, toleranceInches: number): DepthSummary {
  const measuredRows = rows.filter(row => typeof row.depthInches === 'number' && Number.isFinite(row.depthInches));

  if (measuredRows.length === 0 || targetDepthInches <= 0) {
    return {
      measuredCount: 0,
      avgDepth: 0,
      avgDeviation: 0,
      accuracyScore: 0,
      withinToleranceCount: 0,
      worstRow: null,
    };
  }

  const deviations = measuredRows.map(row => ({
    row,
    deviation: Math.abs((row.depthInches ?? 0) - targetDepthInches),
  }));

  const avgDepth = measuredRows.reduce((sum, row) => sum + (row.depthInches ?? 0), 0) / measuredRows.length;
  const avgDeviation = deviations.reduce((sum, item) => sum + item.deviation, 0) / deviations.length;
  const accuracyScore = Math.max(0, 100 - (avgDeviation / targetDepthInches) * 100);
  const withinToleranceCount = deviations.filter(item => item.deviation <= toleranceInches).length;
  const worstRow = deviations.sort((a, b) => b.deviation - a.deviation)[0]?.row ?? null;

  return {
    measuredCount: measuredRows.length,
    avgDepth,
    avgDeviation,
    accuracyScore,
    withinToleranceCount,
    worstRow,
  };
}

function summarizeDepthChecks(checks: PlanterCheckPass[], targetDepthInches: number, toleranceInches: number): DepthSummary {
  const allRows = checks.flatMap(check => check.rows);
  return summarizeDepthRows(allRows, targetDepthInches, toleranceInches);
}

function accuracyTone(score: number) {
  if (score >= 95) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 90) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function fieldLabel(field: Field) {
  return `${field.fieldNumber} (${field.cropType})`;
}

function allowedCropsForEquipment(equipmentType: PlanterCheck['equipmentType']): CropType[] {
  if (equipmentType === 'potato-planter') return ['Potatoes'];
  if (equipmentType === 'row-planter') return ['Corn', 'Soybeans', 'Edible Beans', 'Canola'];
  if (equipmentType === 'air-seeder') return ['Oats', 'Wheat', 'Canola'];
  return ['Potatoes'];
}

export default function PlanterChecks({ data, updateData }: Props) {
  const sortedFields = useMemo(
    () => [...data.fields]
      .sort((a, b) => a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' })),
    [data.fields]
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewCheck, setViewCheck] = useState<PlanterCheck | null>(null);
  const [expandedViewCheckNumber, setExpandedViewCheckNumber] = useState<number>(0);
  const [activeCheckIndex, setActiveCheckIndex] = useState(0);
  const [form, setForm] = useState(emptyCheck());

  const filteredChecks = [...data.planterChecks].sort((a, b) => b.date.localeCompare(a.date));

  const availableFields = useMemo(() => {
    const allowedCrops = new Set(allowedCropsForEquipment(form.equipmentType));
    return sortedFields.filter(field => allowedCrops.has(field.cropType));
  }, [sortedFields, form.equipmentType]);

  const selectedField = useMemo(
    () => sortedFields.find(field => field.id === form.fieldId),
    [sortedFields, form.fieldId]
  );

  const fieldVarieties = useMemo(() => {
    if (!form.fieldId) return [];
    const entries = data.seedingEntries?.filter(
      entry => entry.fieldId === form.fieldId || entry.fieldNumber === form.fieldNumber,
    ) ?? [];
    return Array.from(new Set(entries.map(entry => entry.variety).filter(Boolean)));
  }, [data.seedingEntries, form.fieldId, form.fieldNumber]);

  const varietyOptions = useMemo(() => {
    const cropType = selectedField?.cropType;
    const options = new Set<string>(cropType ? (VARIETIES_BY_CROP[cropType] ?? []) : []);
    fieldVarieties.forEach(variety => options.add(variety));
    if (selectedField?.variety) options.add(selectedField.variety);
    if (form.variety) options.add(form.variety);
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [fieldVarieties, form.variety, selectedField]);

  function openNew() {
    setEditingId(null);
    setActiveCheckIndex(0);
    setForm(emptyCheck());
    setShowForm(true);
  }

  function openEdit(check: PlanterCheck) {
    setEditingId(check.id);
    setActiveCheckIndex(0);
    const defaults = equipmentMeta(check.equipmentType);
    setForm({
      fieldId: check.fieldId,
      fieldNumber: check.fieldNumber,
      variety: check.variety,
      date: check.date,
      equipmentType: check.equipmentType ?? defaults.value,
      planterName: check.planterName,
      rowCount: CHECK_ROW_COUNT,
      targetSpacingInches: check.targetSpacingInches,
      toleranceInches: check.toleranceInches,
      targetDepthInches: check.targetDepthInches ?? defaults.defaultDepth,
      depthToleranceInches: check.depthToleranceInches ?? defaults.defaultDepthTolerance,
      checks: createPasses(check.checks ?? [], check.rows ?? []),
      notes: check.notes,
    });
    setShowForm(true);
  }

  function handleFieldSelect(fieldId: string) {
    const field = sortedFields.find(item => item.id === fieldId);
    setForm(current => ({
      ...current,
      fieldId,
      fieldNumber: field?.fieldNumber ?? '',
      variety: field?.variety ?? current.variety,
    }));
  }

  function handleEquipmentChange(nextType: NonNullable<PlanterCheck['equipmentType']>) {
    const defaults = equipmentMeta(nextType);
    const allowedCrops = new Set(allowedCropsForEquipment(nextType));
    setForm(current => {
      const selected = current.fieldId
        ? sortedFields.find(field => field.id === current.fieldId)
        : undefined;
      const shouldClearField = !!selected && !allowedCrops.has(selected.cropType);

      return {
        ...current,
        ...(shouldClearField
          ? {
              fieldId: '',
              fieldNumber: '',
              variety: '',
            }
          : {}),
      equipmentType: nextType,
      planterName: current.planterName === equipmentMeta(current.equipmentType).defaultName
        ? defaults.defaultName
        : current.planterName,
      rowCount: CHECK_ROW_COUNT,
      targetSpacingInches: defaults.defaultSpacing,
      toleranceInches: defaults.defaultSpacingTolerance,
      targetDepthInches: defaults.defaultDepth,
      depthToleranceInches: defaults.defaultDepthTolerance,
      checks: createPasses(current.checks),
      };
    });
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
      rowCount: CHECK_ROW_COUNT,
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

  function openViewCheck(check: PlanterCheck) {
    setExpandedViewCheckNumber(0);
    setViewCheck(check);
  }

  const activeCheck = form.checks[activeCheckIndex] ?? createPasses()[0];
  const rowsPerCheck = CHECK_ROW_COUNT;
  const totalRowsAcrossChecks = rowsPerCheck * form.checks.length;
  const currentSummary = summarizeRows(activeCheck.rows, form.targetSpacingInches, form.toleranceInches);
  const overallSummary = summarizeChecks(form.checks, form.targetSpacingInches, form.toleranceInches);
  const currentDepthSummary = summarizeDepthRows(activeCheck.rows, form.targetDepthInches ?? 0, form.depthToleranceInches ?? 0);
  const overallDepthSummary = summarizeDepthChecks(form.checks, form.targetDepthInches ?? 0, form.depthToleranceInches ?? 0);

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
          <h1 className="text-2xl font-bold text-green-900">Equipment Checks</h1>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Check
        </button>
      </div>

      {filteredChecks.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          No equipment checks yet. Add checks for potato planter, row planter, or air seeder depth/spacing performance.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredChecks.map(check => {
            const checks = createPasses(check.checks ?? [], check.rows ?? []);
            const summary = summarizeChecks(checks, check.targetSpacingInches, check.toleranceInches);
            const depthSummary = summarizeDepthChecks(checks, check.targetDepthInches ?? 0, check.depthToleranceInches ?? 0);
            const checksWithData = checks.filter(c => summarizeRows(c.rows, check.targetSpacingInches, check.toleranceInches).measuredCount > 0).length;
            const equipment = equipmentMeta(check.equipmentType);
            const totalRows = CHECK_ROW_COUNT * checks.length;
            const fieldCrop = data.fields.find(field => field.id === check.fieldId)?.cropType;

            return (
              <div key={check.id} className="card hover:shadow-md transition-shadow">
                <div className="sm:hidden space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-green-900">Field {check.fieldNumber}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{equipment.label}</span>
                        {fieldCrop && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{fieldCrop}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => openViewCheck(check)} className="btn-secondary text-xs py-1.5 px-2">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openEdit(check)} className="btn-secondary text-xs py-1.5 px-2">Edit</button>
                      <button onClick={() => handleDelete(check.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className={`rounded-lg border px-2.5 py-2 ${accuracyTone(summary.accuracyScore)}`}>
                      <div className="text-[11px] uppercase tracking-wide">Spacing</div>
                      <div className="text-base font-bold leading-tight">{summary.accuracyScore.toFixed(1)}%</div>
                    </div>
                    <div className={`rounded-lg border px-2.5 py-2 ${accuracyTone(depthSummary.accuracyScore)}`}>
                      <div className="text-[11px] uppercase tracking-wide">Depth</div>
                      <div className="text-base font-bold leading-tight">{depthSummary.accuracyScore.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 grid grid-cols-2 gap-x-2 gap-y-1">
                    <div><span className="text-gray-500">Date:</span> {check.date}</div>
                    <div><span className="text-gray-500">Checks:</span> {checksWithData}/3</div>
                    <div><span className="text-gray-500">Planter:</span> {check.planterName}</div>
                    <div><span className="text-gray-500">Rows:</span> {CHECK_ROW_COUNT}</div>
                    <div><span className="text-gray-500">Target:</span> {check.targetSpacingInches.toFixed(1)}&quot;</div>
                    <div><span className="text-gray-500">Tol:</span> +/- {check.toleranceInches.toFixed(1)}&quot;</div>
                    {typeof check.targetDepthInches === 'number' && <div><span className="text-gray-500">Depth:</span> {check.targetDepthInches.toFixed(1)}&quot;</div>}
                    <div><span className="text-gray-500">D/S:</span> {summary.totalDoubles}/{summary.totalSkips}</div>
                    {check.variety && <div className="col-span-2"><span className="text-gray-500">Variety:</span> {check.variety}</div>}
                  </div>
                </div>

                <div className="hidden sm:flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-green-900">Field {check.fieldNumber}</span>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{equipment.label}</span>
                      {fieldCrop && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{fieldCrop}</span>}
                      {check.variety && <span className="text-xs text-gray-500">{check.variety}</span>}
                    </div>
                    <div className="text-xs text-gray-500 space-x-3">
                      <span>Date: {check.date}</span>
                      <span>{check.planterName}</span>
                      <span>Rows checked: {CHECK_ROW_COUNT}</span>
                      <span>Target: {check.targetSpacingInches.toFixed(1)}&quot;</span>
                      <span>Tolerance: +/- {check.toleranceInches.toFixed(1)}&quot;</span>
                      {typeof check.targetDepthInches === 'number' && <span>Depth: {check.targetDepthInches.toFixed(1)}&quot;</span>}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      <div className={`rounded-lg border px-3 py-2 ${accuracyTone(summary.accuracyScore)}`}>
                        <div className="text-xs uppercase tracking-wide">Spacing Accuracy</div>
                        <div className="text-lg font-bold">{summary.accuracyScore.toFixed(1)}%</div>
                      </div>
                      <div className={`rounded-lg border px-3 py-2 ${accuracyTone(depthSummary.accuracyScore)}`}>
                        <div className="text-xs uppercase tracking-wide">Depth Accuracy</div>
                        <div className="text-lg font-bold">{depthSummary.accuracyScore.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Avg Spacing</div>
                        <div className="text-lg font-bold text-gray-900">{summary.measuredCount > 0 ? `${summary.avgSpacing.toFixed(2)}\"` : '—'}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-3 py-2">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Rows In Tolerance</div>
                        <div className="text-lg font-bold text-gray-900">{summary.withinToleranceCount}/{totalRows}</div>
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
                    <button onClick={() => openViewCheck(check)} className="btn-secondary text-xs py-1.5 px-2.5">
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
              {availableFields.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Add a field in Fields before creating equipment checks.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="form-label">Equipment Type</label>
                  <select className="form-input" value={form.equipmentType ?? 'potato-planter'} onChange={e => handleEquipmentChange(e.target.value as NonNullable<PlanterCheck['equipmentType']>)}>
                    {EQUIPMENT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Equipment Name</label>
                  <select className="form-input" value={form.planterName} onChange={e => setForm(current => ({ ...current, planterName: e.target.value }))}>
                    {EQUIPMENT_NAME_OPTIONS.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Field</label>
                  <select className="form-input" value={form.fieldId} onChange={e => handleFieldSelect(e.target.value)}>
                    <option value="">Select field...</option>
                    {availableFields.map(field => (
                      <option key={field.id} value={field.id}>{fieldLabel(field)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Variety</label>
                  <select className="form-input" value={form.variety} onChange={e => setForm(current => ({ ...current, variety: e.target.value }))}>
                    <option value="">Select variety...</option>
                    {varietyOptions.map(variety => <option key={variety} value={variety}>{variety}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(current => ({ ...current, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Target Spacing (inches)</label>
                  <input type="number" step="0.1" className="form-input" value={form.targetSpacingInches || ''} onChange={e => setForm(current => ({ ...current, targetSpacingInches: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="form-label">Tolerance (+/- inches)</label>
                  <input type="number" step="0.1" className="form-input" value={form.toleranceInches || ''} onChange={e => setForm(current => ({ ...current, toleranceInches: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="form-label">Target Depth (inches)</label>
                  <input type="number" step="0.1" className="form-input" value={form.targetDepthInches || ''} onChange={e => setForm(current => ({ ...current, targetDepthInches: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="form-label">Depth Tolerance (+/- inches)</label>
                  <input type="number" step="0.1" className="form-input" value={form.depthToleranceInches || ''} onChange={e => setForm(current => ({ ...current, depthToleranceInches: Number(e.target.value) || 0 }))} />
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

              <div className="space-y-4">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">Row Measurements - Check {activeCheck.checkNumber}</h3>
                    <div className="text-xs text-gray-500">Enter spacing, depth, doubles, and skips for each row/opener.</div>
                  </div>
                  <div className="space-y-2 sm:hidden">
                    {activeCheck.rows.map(row => {
                      const spacingDeviation = typeof row.spacingInches === 'number'
                        ? row.spacingInches - form.targetSpacingInches
                        : undefined;
                      const spacingWithinTolerance = typeof spacingDeviation === 'number' && Math.abs(spacingDeviation) <= form.toleranceInches;
                      const depthDeviation = typeof row.depthInches === 'number'
                        ? row.depthInches - (form.targetDepthInches ?? 0)
                        : undefined;
                      const depthWithinTolerance = typeof depthDeviation === 'number' && Math.abs(depthDeviation) <= (form.depthToleranceInches ?? 0);

                      return (
                        <div key={row.rowNumber} className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-green-900">Row {row.rowNumber}</div>
                            <div className="text-xs text-gray-600">
                              {typeof spacingDeviation === 'number' ? `${spacingDeviation > 0 ? '+' : ''}${spacingDeviation.toFixed(2)}\"` : 'No reading'}
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="flex-1 grid grid-cols-1 gap-3 min-w-0">
                              <div>
                                <label className="form-label">Measured Spacing</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  className="form-input"
                                  value={row.spacingInches ?? ''}
                                  onChange={e => handleRowChange(row.rowNumber, 'spacingInches', e.target.value)}
                                  placeholder="0.0"
                                />
                              </div>
                              <div>
                                <label className="form-label">Measured Depth</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  className="form-input"
                                  value={row.depthInches ?? ''}
                                  onChange={e => handleRowChange(row.rowNumber, 'depthInches', e.target.value)}
                                  placeholder="0.0"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Spacing Status</div>
                                  {typeof spacingDeviation !== 'number' ? (
                                    <span className="text-xs text-gray-400">No reading</span>
                                  ) : spacingWithinTolerance ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> In tolerance
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                                      <AlertCircle className="h-3.5 w-3.5" /> Adjust
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Depth Status</div>
                                  {typeof depthDeviation !== 'number' ? (
                                    <span className="text-xs text-gray-400">No reading</span>
                                  ) : depthWithinTolerance ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> In tolerance
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                                      <AlertCircle className="h-3.5 w-3.5" /> Adjust
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="w-24 shrink-0 space-y-3">
                              <div>
                                <label className="form-label">Doubles</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input"
                                  value={row.doublesCount ?? ''}
                                  onChange={e => handleRowChange(row.rowNumber, 'doublesCount', e.target.value)}
                                  placeholder="0"
                                />
                              </div>
                              <div>
                                <label className="form-label">Skips</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input"
                                  value={row.skipsCount ?? ''}
                                  onChange={e => handleRowChange(row.rowNumber, 'skipsCount', e.target.value)}
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-green-50 text-left text-gray-700">
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Measured Spacing</th>
                          <th className="px-3 py-2">Spacing Dev.</th>
                          <th className="px-3 py-2">Measured Depth</th>
                          <th className="px-3 py-2">Depth Dev.</th>
                          <th className="px-3 py-2">Doubles</th>
                          <th className="px-3 py-2">Skips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCheck.rows.map(row => {
                          const spacingDeviation = typeof row.spacingInches === 'number'
                            ? row.spacingInches - form.targetSpacingInches
                            : undefined;
                          const depthDeviation = typeof row.depthInches === 'number'
                            ? row.depthInches - (form.targetDepthInches ?? 0)
                            : undefined;

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
                                {typeof spacingDeviation === 'number' ? `${spacingDeviation > 0 ? '+' : ''}${spacingDeviation.toFixed(2)}\"` : '—'}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  className="form-input w-20 sm:w-24"
                                  value={row.depthInches ?? ''}
                                  onChange={e => handleRowChange(row.rowNumber, 'depthInches', e.target.value)}
                                  placeholder="0.0"
                                />
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {typeof depthDeviation === 'number' ? `${depthDeviation > 0 ? '+' : ''}${depthDeviation.toFixed(2)}\"` : '—'}
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
                    <div className="text-xs uppercase tracking-wide">Whole Equipment Spacing Accuracy</div>
                    <div className="mt-2 text-3xl font-bold">{overallSummary.accuracyScore.toFixed(1)}%</div>
                    <p className="mt-2 text-xs opacity-80">Overall spacing performance across Check 1, Check 2, and Check 3.</p>
                  </div>

                  <div className={`rounded-xl border p-4 ${accuracyTone(overallDepthSummary.accuracyScore)}`}>
                    <div className="text-xs uppercase tracking-wide">Whole Equipment Depth Accuracy</div>
                    <div className="mt-2 text-3xl font-bold">{overallDepthSummary.accuracyScore.toFixed(1)}%</div>
                    <p className="mt-2 text-xs opacity-80">Overall depth performance across Check 1, Check 2, and Check 3.</p>
                  </div>

                  <div className={`rounded-xl border p-4 ${accuracyTone(currentSummary.accuracyScore)}`}>
                    <div className="text-xs uppercase tracking-wide">Check {activeCheck.checkNumber} Spacing Accuracy</div>
                    <div className="mt-2 text-2xl font-bold">{currentSummary.accuracyScore.toFixed(1)}%</div>
                    <p className="mt-2 text-xs opacity-80">Current tab accuracy for this pass only.</p>
                  </div>

                  <div className={`rounded-xl border p-4 ${accuracyTone(currentDepthSummary.accuracyScore)}`}>
                    <div className="text-xs uppercase tracking-wide">Check {activeCheck.checkNumber} Depth Accuracy</div>
                    <div className="mt-2 text-2xl font-bold">{currentDepthSummary.accuracyScore.toFixed(1)}%</div>
                    <p className="mt-2 text-xs opacity-80">Current tab depth accuracy for this pass.</p>
                  </div>

                  <div className="card space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Measured spacing rows</span>
                      <span className="font-semibold text-gray-900">{currentSummary.measuredCount}/{rowsPerCheck}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Measured depth rows</span>
                      <span className="font-semibold text-gray-900">{currentDepthSummary.measuredCount}/{rowsPerCheck}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Avg spacing</span>
                      <span className="font-semibold text-gray-900">{currentSummary.measuredCount > 0 ? `${currentSummary.avgSpacing.toFixed(2)}\"` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Avg depth</span>
                      <span className="font-semibold text-gray-900">{currentDepthSummary.measuredCount > 0 ? `${currentDepthSummary.avgDepth.toFixed(2)}\"` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Avg deviation</span>
                      <span className="font-semibold text-gray-900">{currentSummary.measuredCount > 0 ? `${currentSummary.avgDeviation.toFixed(2)}\"` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Avg depth deviation</span>
                      <span className="font-semibold text-gray-900">{currentDepthSummary.measuredCount > 0 ? `${currentDepthSummary.avgDeviation.toFixed(2)}\"` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Rows in tolerance</span>
                      <span className="font-semibold text-gray-900">{currentSummary.withinToleranceCount}/{rowsPerCheck}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Depth rows in tolerance</span>
                      <span className="font-semibold text-gray-900">{currentDepthSummary.withinToleranceCount}/{rowsPerCheck}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Worst row</span>
                      <span className="font-semibold text-gray-900">{currentSummary.worstRow ? `Row ${currentSummary.worstRow.rowNumber}` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Worst depth row</span>
                      <span className="font-semibold text-gray-900">{currentDepthSummary.worstRow ? `Row ${currentDepthSummary.worstRow.rowNumber}` : '—'}</span>
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
                    <div className="mt-2 text-xs text-gray-700">Spacing: {overallSummary.withinToleranceCount}/{totalRowsAcrossChecks} in tolerance</div>
                    <div className="mt-1 text-xs text-gray-700">Depth: {overallDepthSummary.withinToleranceCount}/{totalRowsAcrossChecks} in tolerance</div>
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
              <button onClick={handleSave} className="btn-primary" disabled={!form.fieldId || !form.date || availableFields.length === 0}>
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
                const rowCount = CHECK_ROW_COUNT;
                const checks = createPasses(viewCheck.checks ?? [], viewCheck.rows ?? []);
                const summary = summarizeChecks(checks, viewCheck.targetSpacingInches, viewCheck.toleranceInches);
                const depthSummary = summarizeDepthChecks(checks, viewCheck.targetDepthInches ?? 0, viewCheck.depthToleranceInches ?? 0);
                const equipment = equipmentMeta(viewCheck.equipmentType);
                return (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Date</div>
                        <div className="mt-1 font-semibold text-gray-900">{viewCheck.date}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500">Equipment</div>
                        <div className="mt-1 font-semibold text-gray-900">{viewCheck.planterName}</div>
                        <div className="mt-0.5 text-xs text-gray-500">{equipment.label} • {rowCount} rows/openers</div>
                      </div>
                      <div className={`rounded-lg border px-4 py-3 ${accuracyTone(summary.accuracyScore)}`}>
                        <div className="text-xs uppercase tracking-wide">Spacing Accuracy</div>
                        <div className="mt-1 font-semibold">{summary.accuracyScore.toFixed(1)}%</div>
                      </div>
                      <div className={`rounded-lg border px-4 py-3 ${accuracyTone(depthSummary.accuracyScore)}`}>
                        <div className="text-xs uppercase tracking-wide">Depth Accuracy</div>
                        <div className="mt-1 font-semibold">{depthSummary.accuracyScore.toFixed(1)}%</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 px-4 py-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-gray-700">
                        <div>Target spacing: <span className="font-semibold">{viewCheck.targetSpacingInches.toFixed(1)}&quot;</span></div>
                        <div>Spacing tol.: <span className="font-semibold">+/- {viewCheck.toleranceInches.toFixed(1)}&quot;</span></div>
                        <div>Target depth: <span className="font-semibold">{(viewCheck.targetDepthInches ?? 0).toFixed(1)}&quot;</span></div>
                        <div>Depth tol.: <span className="font-semibold">+/- {(viewCheck.depthToleranceInches ?? 0).toFixed(1)}&quot;</span></div>
                        <div>Doubles / Skips: <span className="font-semibold">{summary.totalDoubles} / {summary.totalSkips}</span></div>
                      </div>
                    </div>

                    {checks.map(checkPass => {
                      const checkSummary = summarizeRows(checkPass.rows, viewCheck.targetSpacingInches, viewCheck.toleranceInches);
                      const depthCheckSummary = summarizeDepthRows(checkPass.rows, viewCheck.targetDepthInches ?? 0, viewCheck.depthToleranceInches ?? 0);
                      const expanded = expandedViewCheckNumber === checkPass.checkNumber;
                      return (
                        <div key={checkPass.checkNumber} className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setExpandedViewCheckNumber(expanded ? 0 : checkPass.checkNumber)}
                            className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left"
                          >
                            <div className="text-sm font-semibold text-gray-700">Check {checkPass.checkNumber}</div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${accuracyTone(checkSummary.accuracyScore)}`}>
                                S {checkSummary.accuracyScore.toFixed(1)}%
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${accuracyTone(depthCheckSummary.accuracyScore)}`}>
                                D {depthCheckSummary.accuracyScore.toFixed(1)}%
                              </span>
                              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>

                          {expanded && (
                          <>
                          <div className="space-y-2 sm:hidden">
                            {checkPass.rows.map(row => {
                              const spacingDeviation = typeof row.spacingInches === 'number'
                                ? row.spacingInches - viewCheck.targetSpacingInches
                                : undefined;
                              const depthDeviation = typeof row.depthInches === 'number'
                                ? row.depthInches - (viewCheck.targetDepthInches ?? 0)
                                : undefined;

                              return (
                                <div key={row.rowNumber} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-green-900">Row {row.rowNumber}</div>
                                    <div className="text-xs text-gray-600">{typeof spacingDeviation === 'number' ? `${spacingDeviation > 0 ? '+' : ''}${spacingDeviation.toFixed(2)}\"` : '—'}</div>
                                  </div>
                                  <div className="flex items-start gap-3 text-sm">
                                    <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                                      <div><span className="text-gray-500">Measured:</span> <span className="font-medium">{typeof row.spacingInches === 'number' ? `${row.spacingInches.toFixed(2)}\"` : '—'}</span></div>
                                      <div><span className="text-gray-500">Deviation:</span> <span className="font-medium">{typeof spacingDeviation === 'number' ? `${spacingDeviation > 0 ? '+' : ''}${spacingDeviation.toFixed(2)}\"` : '—'}</span></div>
                                      <div><span className="text-gray-500">Depth:</span> <span className="font-medium">{typeof row.depthInches === 'number' ? `${row.depthInches.toFixed(2)}\"` : '—'}</span></div>
                                      <div><span className="text-gray-500">Depth Dev:</span> <span className="font-medium">{typeof depthDeviation === 'number' ? `${depthDeviation > 0 ? '+' : ''}${depthDeviation.toFixed(2)}\"` : '—'}</span></div>
                                    </div>
                                    <div className="w-24 shrink-0 space-y-1 text-right">
                                      <div><span className="text-gray-500">Doubles:</span> <span className="font-medium">{row.doublesCount ?? 0}</span></div>
                                      <div><span className="text-gray-500">Skips:</span> <span className="font-medium">{row.skipsCount ?? 0}</span></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-green-50 text-left text-gray-700">
                                  <th className="px-3 py-2">Row</th>
                                  <th className="px-3 py-2">Spacing</th>
                                  <th className="px-3 py-2">Spacing Dev.</th>
                                  <th className="px-3 py-2">Depth</th>
                                  <th className="px-3 py-2">Depth Dev.</th>
                                  <th className="px-3 py-2">Doubles</th>
                                  <th className="px-3 py-2">Skips</th>
                                </tr>
                              </thead>
                              <tbody>
                                {checkPass.rows.map(row => {
                                  const spacingDeviation = typeof row.spacingInches === 'number'
                                    ? row.spacingInches - viewCheck.targetSpacingInches
                                    : undefined;
                                  const depthDeviation = typeof row.depthInches === 'number'
                                    ? row.depthInches - (viewCheck.targetDepthInches ?? 0)
                                    : undefined;
                                  return (
                                    <tr key={row.rowNumber} className="border-b border-gray-100 last:border-b-0">
                                      <td className="px-3 py-2 font-medium text-green-900">{row.rowNumber}</td>
                                      <td className="px-3 py-2">{typeof row.spacingInches === 'number' ? `${row.spacingInches.toFixed(2)}\"` : '—'}</td>
                                      <td className="px-3 py-2">{typeof spacingDeviation === 'number' ? `${spacingDeviation > 0 ? '+' : ''}${spacingDeviation.toFixed(2)}\"` : '—'}</td>
                                      <td className="px-3 py-2">{typeof row.depthInches === 'number' ? `${row.depthInches.toFixed(2)}\"` : '—'}</td>
                                      <td className="px-3 py-2">{typeof depthDeviation === 'number' ? `${depthDeviation > 0 ? '+' : ''}${depthDeviation.toFixed(2)}\"` : '—'}</td>
                                      <td className="px-3 py-2">{row.doublesCount ?? 0}</td>
                                      <td className="px-3 py-2">{row.skipsCount ?? 0}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          </>
                          )}
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
