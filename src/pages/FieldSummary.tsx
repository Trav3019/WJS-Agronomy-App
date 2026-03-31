import type { AppData } from '../types';

interface Props {
  data: AppData;
}

export default function FieldSummary({ data }: Props) {
  const totalFields = data.fields.length;
  const totalAcres = data.fields.reduce((sum, field) => sum + (field.acres || 0), 0);

  const operationsByField = data.fields.map(field => {
    const operations = [
      ...data.seedingEntries
        .filter(e => e.fieldId === field.id)
        .map(e => ({ type: 'Seeding', date: e.seedingDate, detail: `${e.cropType}${e.variety ? ` - ${e.variety}` : ''}` })),
      ...data.tillageReports
        .filter(t => t.fieldId === field.id)
        .map(t => ({ type: 'Tillage', date: t.date, detail: `${t.method}${t.depthInches ? ` (${t.depthInches} in)` : ''}` })),
      ...data.scoutingReports
        .filter(s => s.fieldId === field.id)
        .map(s => ({ type: 'Scouting', date: s.date, detail: `${s.cropType} scouting` })),
      ...data.sprayApplications
        .filter(a => a.fieldIds.includes(field.id) || a.fieldNumbers.includes(field.fieldNumber))
        .map(a => ({ type: 'Spray', date: a.appliedDate || a.plannedDate, detail: a.product || (a.products?.join(', ') ?? 'Spray application') })),
      ...data.harvestReports
        .filter(h => h.fieldId === field.id)
        .map(h => ({ type: 'Harvest', date: h.date, detail: `${h.cropType}${h.yieldValue !== undefined ? ` - ${h.yieldValue} ${h.yieldUnit ?? ''}` : ''}` })),
      ...data.potatoYieldReports
        .filter(p => p.fieldId === field.id)
        .map(p => ({ type: 'Potato Yield', date: p.date, detail: `${p.estimatedYield.toFixed(1)} cwt/ac` })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return { field, operations };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-green-900">Field Summary</h1>
        <p className="text-sm text-gray-500 mt-1">Quick overview of your fields and total acreage.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card">
          <div className="text-sm text-gray-500">Total Fields</div>
          <div className="text-2xl font-semibold text-green-800 mt-1">{totalFields}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Total Acres</div>
          <div className="text-2xl font-semibold text-green-800 mt-1">{totalAcres.toFixed(1)}</div>
        </div>
      </div>

      <div className="space-y-4">
        {operationsByField.length === 0 ? (
          <div className="card text-gray-500">No fields found. Add fields to see summaries.</div>
        ) : operationsByField.map(({ field, operations }) => (
          <div key={field.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold text-green-900">Field {field.fieldNumber}</h2>
                <p className="text-xs text-gray-500">{field.cropType}{field.variety ? ` - ${field.variety}` : ''} · {field.acres || 0} acres</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{operations.length} operation{operations.length !== 1 ? 's' : ''}</span>
            </div>

            {operations.length === 0 ? (
              <p className="text-sm text-gray-400">No operations recorded for this field yet.</p>
            ) : (
              <div className="space-y-2">
                {operations.map((op, idx) => (
                  <div key={`${field.id}-${op.type}-${op.date}-${idx}`} className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-green-800">{op.type}</span>
                      <span className="text-xs text-gray-500">{op.date}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">{op.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
