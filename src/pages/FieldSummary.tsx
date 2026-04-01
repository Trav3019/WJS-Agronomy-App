import { useEffect, useState } from 'react';
import type { AppData, CropType } from '../types';

interface Props {
  data: AppData;
}

interface FieldOperation {
  id: string;
  type: 'Seeding Plan' | 'Seeding Record' | 'Tillage' | 'Scouting' | 'Spray' | 'Harvest' | 'Potato Yield' | 'Storage Bin';
  date: string;
  detail: string;
  viewData: Array<{ label: string; value: string }>;
}

const OPERATION_ORDER: Record<FieldOperation['type'], number> = {
  'Seeding Plan': 1,
  Tillage: 2,
  'Seeding Record': 3,
  Scouting: 4,
  Spray: 5,
  Harvest: 6,
  'Storage Bin': 7,
  'Potato Yield': 8,
};

export default function FieldSummary({ data }: Props) {
  const [fieldFilter, setFieldFilter] = useState('');
  const [cropFilter, setCropFilter] = useState<CropType | ''>('');
  const [selectedOperation, setSelectedOperation] = useState<{ fieldNumber: string; operation: FieldOperation } | null>(null);
  const totalFields = data.fields.length;
  const totalAcres = data.fields.reduce((sum, field) => sum + (field.acres || 0), 0);
  const cropOptions = Array.from(new Set(data.fields.map(f => f.cropType))).sort();
  const fieldOptions = Array.from(
    new Set(
      data.fields
        .filter(f => !cropFilter || f.cropType === cropFilter)
        .map(f => f.fieldNumber)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  useEffect(() => {
    if (fieldFilter && !fieldOptions.includes(fieldFilter)) {
      setFieldFilter('');
    }
  }, [cropFilter, fieldFilter, fieldOptions]);

  const operationsByField = data.fields.map(field => {
    const seedingRecords = data.seedingEntries
      .filter(e => e.fieldId === field.id && e.trialTrack?.name !== 'Seeding Plan')
      .map<FieldOperation>(e => ({
        id: `record-${e.id}`,
        type: 'Seeding Record',
        date: e.seedingDate,
        detail: `${e.cropType}${e.variety ? ` - ${e.variety}` : ''}`,
        viewData: [
          { label: 'Date', value: e.seedingDate },
          { label: 'Crop', value: e.cropType },
          { label: 'Variety', value: e.variety || '-' },
          { label: 'Seeding Rate', value: e.seedingRate ? `${e.seedingRate.toLocaleString()} seeds/ac` : '-' },
          { label: 'Direction', value: e.seedingDirection || '-' },
          { label: 'Population', value: e.population ? `${e.population.toLocaleString()} seeds/ac` : '-' },
          { label: 'Row Spacing', value: e.rowSpacing ? `${e.rowSpacing} in` : '-' },
          { label: 'Seed Depth', value: e.seedDepth ? `${e.seedDepth} in` : '-' },
          { label: 'Tuber Size', value: e.tuberSize || '-' },
          { label: 'Seed Cut Date', value: e.seedCutDate || '-' },
          { label: 'Tuber Temp', value: e.tuberTemp !== undefined ? `${e.tuberTemp} C` : '-' },
          { label: 'Ground Temp', value: e.groundTemperature !== undefined ? `${e.groundTemperature} C` : '-' },
          { label: 'Chemical Mix', value: e.chemicalMix || '-' },
          { label: 'Field Trials', value: e.fieldTrials || '-' },
          { label: 'Pin Info', value: e.pinInfo || '-' },
          { label: 'Location', value: `${e.location.lat.toFixed(5)}, ${e.location.lng.toFixed(5)}${e.location.accuracy !== undefined ? ` (±${Math.round(e.location.accuracy)}m)` : ''}` },
          { label: 'Weather', value: e.weather ? `${e.weather.temperature} C, ${e.weather.precipitation} mm, ${e.weather.windSpeed} km/h${e.weather.humidity !== undefined ? `, ${e.weather.humidity}% humidity` : ''}` : '-' },
          { label: 'Notes', value: e.notes || '-' },
        ],
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const operations = [
      ...data.seedingEntries
        .filter(e => e.fieldId === field.id)
        .map<FieldOperation>(e => ({
          id: e.id,
          type: 'Seeding Plan',
          date: e.seedingDate,
          detail: `${e.cropType}${e.variety ? ` - ${e.variety}` : ''}`,
          viewData: [
            { label: 'Date', value: e.seedingDate },
            { label: 'Crop', value: e.cropType },
            { label: 'Variety', value: e.variety || '-' },
            { label: 'Seeding Rate', value: e.seedingRate ? `${e.seedingRate.toLocaleString()} seeds/ac` : '-' },
            { label: 'Row Spacing', value: e.rowSpacing ? `${e.rowSpacing} in` : '-' },
            { label: 'Seed Depth', value: e.seedDepth ? `${e.seedDepth} in` : '-' },
            { label: 'Population', value: e.population ? `${e.population.toLocaleString()} seeds/ac` : '-' },
            { label: 'Field Trials', value: e.fieldTrials || '-' },
            { label: 'Notes', value: e.notes || '-' },
          ],
        })),
      ...data.tillageReports
        .filter(t => t.fieldId === field.id)
        .map<FieldOperation>(t => ({
          id: t.id,
          type: 'Tillage',
          date: t.date,
          detail: `${t.method}${t.depthInches ? ` (${t.depthInches} in)` : ''}`,
          viewData: [
            { label: 'Date', value: t.date },
            { label: 'Method', value: t.method },
            { label: 'Depth', value: t.depthInches !== undefined ? `${t.depthInches} in` : '-' },
            { label: 'Notes', value: t.notes || '-' },
          ],
        })),
      ...data.scoutingReports
        .filter(s => s.fieldId === field.id)
        .map<FieldOperation>(s => ({
          id: s.id,
          type: 'Scouting',
          date: s.date,
          detail: `${s.cropType} scouting`,
          viewData: [
            { label: 'Date', value: s.date },
            { label: 'Crop', value: s.cropType },
            { label: 'Variety', value: s.variety || '-' },
            { label: 'Priority', value: s.priority },
            { label: 'Weeds Present', value: s.weedsPresent?.length ? s.weedsPresent.join(', ') : '-' },
            { label: 'Notes', value: s.notes || '-' },
          ],
        })),
      ...data.sprayApplications
        .filter(a => a.fieldIds.includes(field.id) || a.fieldNumbers.includes(field.fieldNumber))
        .map<FieldOperation>(a => ({
          id: a.id,
          type: 'Spray',
          date: a.appliedDate || a.plannedDate,
          detail: a.product || (a.products?.join(', ') ?? 'Spray application'),
          viewData: [
            { label: 'Date', value: a.appliedDate || a.plannedDate },
            { label: 'Status', value: a.status },
            { label: 'Application Method', value: a.applicationMethod || '-' },
            { label: 'Chemicals', value: a.chemicals?.length ? a.chemicals.map(c => `${c.name}${c.rate ? ` (${c.rate}L)` : ''}`).join(', ') : (a.product || a.products?.join(', ') || '-') },
            { label: 'Water Volume', value: a.waterVolume || '-' },
            { label: 'Notes', value: a.notes || '-' },
          ],
        })),
      ...data.harvestReports
        .filter(h => h.fieldId === field.id)
        .map<FieldOperation>(h => ({
          id: h.id,
          type: 'Harvest',
          date: h.date,
          detail: `${h.cropType}${h.yieldValue !== undefined ? ` - ${h.yieldValue} ${h.yieldUnit ?? ''}` : ''}`,
          viewData: [
            { label: 'Date', value: h.date },
            { label: 'Crop', value: h.cropType },
            { label: 'Yield', value: h.yieldValue !== undefined ? `${h.yieldValue} ${h.yieldUnit ?? ''}`.trim() : '-' },
            { label: 'Moisture', value: h.moisture !== undefined ? `${h.moisture}%` : '-' },
            { label: 'Notes', value: h.notes || '-' },
          ],
        })),
      ...data.potatoYieldReports
        .filter(p => p.fieldId === field.id)
        .map<FieldOperation>(p => ({
          id: p.id,
          type: 'Potato Yield',
          date: p.date,
          detail: `${p.estimatedYield.toFixed(1)} cwt/ac`,
          viewData: [
            { label: 'Date', value: p.date },
            { label: 'Variety', value: p.variety },
            { label: 'Potato Type', value: p.potatoType },
            { label: 'Estimated Yield', value: `${p.estimatedYield.toFixed(1)} cwt/ac` },
            { label: 'Total Tuber Count', value: String(p.totalTuberCount) },
            { label: 'Total Tuber Weight', value: `${p.totalTuberWeight.toFixed(1)} lbs` },
            { label: 'Notes', value: p.notes || '-' },
          ],
        })),
      ...data.harvestReports
        .filter(h => h.fieldId === field.id && h.cropType === 'Potatoes' && !!h.binNumber)
        .map<FieldOperation>(h => ({
          id: `bin-${h.id}`,
          type: 'Storage Bin',
          date: h.date,
          detail: `Bin ${h.binNumber}${h.totalCwt !== undefined ? ` - ${h.totalCwt} cwt` : ''}`,
          viewData: [
            { label: 'Date', value: h.date },
            { label: 'Bin #', value: h.binNumber || '-' },
            { label: 'Variety', value: h.variety || '-' },
            { label: 'Total CWT', value: h.totalCwt !== undefined ? `${h.totalCwt}` : '-' },
            { label: 'Quality', value: h.quality || '-' },
            { label: 'Tuber Temp', value: h.tuberTemp !== undefined ? `${h.tuberTemp} C` : '-' },
            { label: 'Tuber Defects', value: h.tuberDefects?.length ? h.tuberDefects.join(', ') : '-' },
            { label: 'Weather Data', value: h.weatherData || '-' },
            { label: 'Notes', value: h.notes || '-' },
          ],
        })),
    ].sort((a, b) => {
      const typeOrder = OPERATION_ORDER[a.type] - OPERATION_ORDER[b.type];
      if (typeOrder !== 0) return typeOrder;
      return b.date.localeCompare(a.date);
    });

    return { field, operations, seedingRecords };
  });

  const filteredOperationsByField = operationsByField.filter(({ field }) => {
    if (fieldFilter && !field.fieldNumber.toLowerCase().includes(fieldFilter.toLowerCase())) return false;
    if (cropFilter && field.cropType !== cropFilter) return false;
    return true;
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

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="form-label">Filter by Field Number</label>
            <select className="form-input" value={fieldFilter} onChange={e => setFieldFilter(e.target.value)}>
              <option value="">All Fields</option>
              {fieldOptions.map(fieldNum => <option key={fieldNum} value={fieldNum}>{fieldNum}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Filter by Crop Type</label>
            <select className="form-input" value={cropFilter} onChange={e => setCropFilter(e.target.value as CropType | '')}>
              <option value="">All Crops</option>
              {cropOptions.map(crop => <option key={crop} value={crop}>{crop}</option>)}
            </select>
          </div>
          <div className="text-sm text-gray-500">Showing {filteredOperationsByField.length} field{filteredOperationsByField.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredOperationsByField.length === 0 ? (
          <div className="card text-gray-500">No fields found. Add fields to see summaries.</div>
        ) : filteredOperationsByField.map(({ field, operations, seedingRecords }) => (
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
                  <button
                    type="button"
                    key={`${field.id}-${op.id}-${op.type}-${op.date}-${idx}`}
                    className="w-full text-left bg-gray-50 rounded-lg p-2.5 hover:bg-green-50 transition-colors"
                    onClick={() => setSelectedOperation({ fieldNumber: field.fieldNumber, operation: op })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-green-800">{op.type}</span>
                      <span className="text-xs text-gray-500">{op.date}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">{op.detail}</div>
                    <div className="text-xs text-green-700 mt-1">Click to view details</div>
                  </button>
                ))}
              </div>
            )}

            {seedingRecords.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="space-y-2">
                  {seedingRecords.map((record, idx) => (
                    <button
                      type="button"
                      key={`${field.id}-${record.id}-${idx}`}
                      className="w-full text-left bg-gray-50 rounded-lg p-2.5 hover:bg-green-50 transition-colors"
                      onClick={() => setSelectedOperation({ fieldNumber: field.fieldNumber, operation: record })}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-green-800">{record.type}</span>
                        <span className="text-xs text-gray-500">{record.date}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5">{record.detail}</div>
                      <div className="text-xs text-green-700 mt-1">Click to view details</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedOperation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{selectedOperation.operation.type} - Field {selectedOperation.fieldNumber}</h2>
              <button onClick={() => setSelectedOperation(null)} className="text-gray-400 hover:text-gray-600">Close</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {selectedOperation.operation.viewData.map((item, idx) => (
                <div key={`${item.label}-${idx}`} className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="col-span-2 font-medium text-gray-800 break-words">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end p-4 border-t bg-gray-50">
              <button onClick={() => setSelectedOperation(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
