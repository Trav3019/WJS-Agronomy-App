import { useEffect, useState } from 'react';
import type {
  AppData,
  CropType,
  GeoLocation,
  HarvestReport,
  PotatoYieldReport,
  ScoutingReport,
  SeedingEntry,
  SprayApplication,
  TillageReport,
} from '../types';

interface Props {
  data: AppData;
}

type OperationReport =
  | { kind: 'seeding-plan'; data: SeedingEntry }
  | { kind: 'seeding-record'; data: SeedingEntry }
  | { kind: 'tillage'; data: TillageReport }
  | { kind: 'scouting'; data: ScoutingReport }
  | { kind: 'spray'; data: SprayApplication }
  | { kind: 'harvest'; data: HarvestReport }
  | { kind: 'storage-bin'; data: HarvestReport }
  | { kind: 'potato-yield'; data: PotatoYieldReport };

interface FieldOperation {
  id: string;
  type: 'Seeding Plan' | 'Seeding Record' | 'Tillage' | 'Scouting' | 'Spray' | 'Harvest' | 'Potato Yield' | 'Storage Bin';
  date: string;
  detail: string;
  viewData: Array<{ label: string; value: string }>;
  report: OperationReport;
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

function toDisplayLabel(value: string): string {
  const spaced = value.replace(/([A-Z])/g, ' $1').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : spaced;
}

function toDisplayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value !== 'string') return String(value);
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function formatLocation(location?: GeoLocation): string | null {
  if (!location) return null;
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}${location.accuracy !== undefined ? ` (±${Math.round(location.accuracy)}m)` : ''}`;
}

export default function FieldSummary({ data }: Props) {
  const [fieldFilter, setFieldFilter] = useState('');
  const [cropFilter, setCropFilter] = useState<CropType | ''>('');
  const [operationFilter, setOperationFilter] = useState<FieldOperation['type'] | ''>('');
  const [selectedOperation, setSelectedOperation] = useState<{ fieldNumber: string; operation: FieldOperation } | null>(null);
  const cropOptions = Array.from(new Set(data.fields.map(f => f.cropType))).sort();
  const operationOptions = (Object.keys(OPERATION_ORDER) as FieldOperation['type'][])
    .sort((a, b) => OPERATION_ORDER[a] - OPERATION_ORDER[b]);
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
        report: { kind: 'seeding-record', data: e },
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
          report: { kind: 'seeding-plan', data: e },
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
          report: { kind: 'tillage', data: t },
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
          report: { kind: 'scouting', data: s },
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
          report: { kind: 'spray', data: a },
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
          report: { kind: 'harvest', data: h },
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
          report: { kind: 'potato-yield', data: p },
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
          report: { kind: 'storage-bin', data: h },
        })),
    ].sort((a, b) => {
      const typeOrder = OPERATION_ORDER[a.type] - OPERATION_ORDER[b.type];
      if (typeOrder !== 0) return typeOrder;
      return b.date.localeCompare(a.date);
    });

    return { field, operations, seedingRecords };
  });

  const filteredOperationsByField = operationsByField.filter(({ field, operations, seedingRecords }) => {
    if (fieldFilter && !field.fieldNumber.toLowerCase().includes(fieldFilter.toLowerCase())) return false;
    if (cropFilter && field.cropType !== cropFilter) return false;
    if (!operationFilter) return true;
    const hasMatchingOperations = operations.some(op => op.type === operationFilter);
    const hasMatchingSeedingRecords = operationFilter === 'Seeding Record' && seedingRecords.length > 0;
    return hasMatchingOperations || hasMatchingSeedingRecords;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-green-900">Field Summary</h1>
        <p className="text-sm text-gray-500 mt-1">Quick overview of your fields and total acreage.</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
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
          <div>
            <label className="form-label">Filter by Operation</label>
            <select className="form-input" value={operationFilter} onChange={e => setOperationFilter(e.target.value as FieldOperation['type'] | '')}>
              <option value="">All Operations</option>
              {operationOptions.map(operation => <option key={operation} value={operation}>{operation}</option>)}
            </select>
          </div>
          <div className="text-sm text-gray-500">Showing {filteredOperationsByField.length} field{filteredOperationsByField.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredOperationsByField.length === 0 ? (
          <div className="card text-gray-500">No fields found. Add fields to see summaries.</div>
        ) : filteredOperationsByField.map(({ field, operations, seedingRecords }) => {
          const visibleOperations = operationFilter ? operations.filter(op => op.type === operationFilter) : operations;
          const visibleSeedingRecords = !operationFilter || operationFilter === 'Seeding Record' ? seedingRecords : [];
          const totalVisibleOperations = visibleOperations.length + visibleSeedingRecords.length;

          return (
          <div key={field.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold text-green-900">Field {field.fieldNumber}</h2>
                <p className="text-xs text-gray-500">{field.cropType}{field.variety ? ` - ${field.variety}` : ''} · {field.acres || 0} acres</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{totalVisibleOperations} operation{totalVisibleOperations !== 1 ? 's' : ''}</span>
            </div>

            {totalVisibleOperations === 0 ? (
              <p className="text-sm text-gray-400">No operations recorded for this field yet.</p>
            ) : (
              <div className="space-y-2">
                {visibleOperations.map((op, idx) => (
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

            {visibleSeedingRecords.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="space-y-2">
                  {visibleSeedingRecords.map((record, idx) => (
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
          );
        })}
      </div>

      {selectedOperation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{selectedOperation.operation.type} - Field {selectedOperation.fieldNumber}</h2>
              <button onClick={() => setSelectedOperation(null)} className="text-gray-400 hover:text-gray-600">Close</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {selectedOperation.operation.report.kind === 'scouting' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div><span className="text-gray-500">Crop:</span> <span className="font-medium">{selectedOperation.operation.report.data.cropType}</span></div>
                    {selectedOperation.operation.report.data.variety && <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{selectedOperation.operation.report.data.variety}</span></div>}
                    <div><span className="text-gray-500">Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.date}</span></div>
                    <div><span className="text-gray-500">Priority:</span> <span className="font-medium capitalize">{selectedOperation.operation.report.data.priority}</span></div>
                  </div>

                  {(selectedOperation.operation.report.data.weedsPresent?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Weeds Present</h3>
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                        {selectedOperation.operation.report.data.weedsPresent?.join(', ')}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Scouting Data</h3>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                      {Object.entries(selectedOperation.operation.report.data.cropData)
                        .filter(([key, value]) => key !== 'crop' && value !== undefined && value !== '' && value !== 0 && value !== false)
                        .map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <span className="text-gray-500">{toDisplayLabel(key)}:</span>
                            <span className="font-medium">{toDisplayValue(value)}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {selectedOperation.operation.report.data.location && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Location</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{formatLocation(selectedOperation.operation.report.data.location)}</p>
                    </div>
                  )}

                  {selectedOperation.operation.report.data.trialTrack && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Trial Track</h3>
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
                        <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedOperation.operation.report.data.trialTrack.name}</span></div>
                        <div><span className="text-gray-500">Points:</span> <span className="font-medium">{selectedOperation.operation.report.data.trialTrack.points.length}</span></div>
                        {(selectedOperation.operation.report.data.trialTrack.pinPoints?.length ?? 0) > 0 && <div><span className="text-gray-500">Pins:</span> <span className="font-medium">{selectedOperation.operation.report.data.trialTrack.pinPoints?.length}</span></div>}
                      </div>
                    </div>
                  )}

                  {(selectedOperation.operation.report.data.photos?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Photos ({selectedOperation.operation.report.data.photos.length})</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedOperation.operation.report.data.photos.map((photo, index) => (
                          <img key={`${selectedOperation.operation.report.data.id}-photo-${index}`} src={photo} alt={`Scouting photo ${index + 1}`} className="photo-thumbnail" />
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOperation.operation.report.data.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.notes}</p>
                    </div>
                  )}

                  {selectedOperation.operation.report.data.sprayRecord && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Spray Record</h3>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                        {selectedOperation.operation.report.data.sprayRecord.chemicals.map((chemical, index) => (
                          <div key={`${chemical.name}-${index}`} className="flex justify-between gap-3">
                            <span className="font-medium">{chemical.name}</span>
                            {chemical.rate && <span className="text-gray-600 whitespace-nowrap">{chemical.rate} L</span>}
                          </div>
                        ))}
                        <div><span className="text-gray-500">Method:</span> <span className="font-medium">{selectedOperation.operation.report.data.sprayRecord.applicationMethod}</span></div>
                        {selectedOperation.operation.report.data.sprayRecord.waterVolume && <div><span className="text-gray-500">Water Volume:</span> <span className="font-medium">{selectedOperation.operation.report.data.sprayRecord.waterVolume}</span></div>}
                        {selectedOperation.operation.report.data.sprayRecord.notes && <div><span className="text-gray-500">Notes:</span> <span className="font-medium">{selectedOperation.operation.report.data.sprayRecord.notes}</span></div>}
                      </div>
                    </div>
                  )}
                </>
              )}

              {(selectedOperation.operation.report.kind === 'seeding-plan' || selectedOperation.operation.report.kind === 'seeding-record') && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div><span className="text-gray-500">Crop:</span> <span className="font-medium">{selectedOperation.operation.report.data.cropType}</span></div>
                    <div><span className="text-gray-500">Seeding Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.seedingDate}</span></div>
                    <div><span className="text-gray-500">Seeding Rate:</span> <span className="font-medium">{selectedOperation.operation.report.data.seedingRate.toLocaleString()} seeds/ac</span></div>
                    {selectedOperation.operation.report.data.variety && <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{selectedOperation.operation.report.data.variety}</span></div>}
                    {selectedOperation.operation.report.data.seedingDirection && <div><span className="text-gray-500">Direction:</span> <span className="font-medium">{selectedOperation.operation.report.data.seedingDirection}</span></div>}
                    {selectedOperation.operation.report.data.population !== undefined && <div><span className="text-gray-500">Population:</span> <span className="font-medium">{selectedOperation.operation.report.data.population.toLocaleString()} seeds/ac</span></div>}
                    {selectedOperation.operation.report.data.rowSpacing !== undefined && <div><span className="text-gray-500">Row Spacing:</span> <span className="font-medium">{selectedOperation.operation.report.data.rowSpacing} in</span></div>}
                    {selectedOperation.operation.report.data.seedDepth !== undefined && <div><span className="text-gray-500">Seed Depth:</span> <span className="font-medium">{selectedOperation.operation.report.data.seedDepth} in</span></div>}
                    {selectedOperation.operation.report.data.tuberSize && <div><span className="text-gray-500">Tuber Size:</span> <span className="font-medium">{selectedOperation.operation.report.data.tuberSize}</span></div>}
                    {selectedOperation.operation.report.data.seedCutDate && <div><span className="text-gray-500">Seed Cut Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.seedCutDate}</span></div>}
                    {selectedOperation.operation.report.data.tuberTemp !== undefined && <div><span className="text-gray-500">Tuber Temp:</span> <span className="font-medium">{selectedOperation.operation.report.data.tuberTemp} C</span></div>}
                    {selectedOperation.operation.report.data.groundTemperature !== undefined && <div><span className="text-gray-500">Ground Temp:</span> <span className="font-medium">{selectedOperation.operation.report.data.groundTemperature} C</span></div>}
                    {selectedOperation.operation.report.data.chemicalMix && <div className="sm:col-span-2"><span className="text-gray-500">Chemical Mix:</span> <span className="font-medium">{selectedOperation.operation.report.data.chemicalMix}</span></div>}
                    {selectedOperation.operation.report.data.fieldTrials && <div className="sm:col-span-2"><span className="text-gray-500">Field Trials:</span> <span className="font-medium">{selectedOperation.operation.report.data.fieldTrials}</span></div>}
                    {selectedOperation.operation.report.data.pinInfo && <div className="sm:col-span-2"><span className="text-gray-500">Pin Info:</span> <span className="font-medium">{selectedOperation.operation.report.data.pinInfo}</span></div>}
                  </div>

                  {selectedOperation.operation.report.data.weather && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Weather</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-50 rounded-lg p-3">
                        <div><span className="text-gray-500">Temp:</span> <span className="font-medium">{selectedOperation.operation.report.data.weather.temperature} C</span></div>
                        <div><span className="text-gray-500">Precip:</span> <span className="font-medium">{selectedOperation.operation.report.data.weather.precipitation} mm</span></div>
                        <div><span className="text-gray-500">Wind:</span> <span className="font-medium">{selectedOperation.operation.report.data.weather.windSpeed} km/h</span></div>
                        {selectedOperation.operation.report.data.weather.humidity !== undefined && <div><span className="text-gray-500">Humidity:</span> <span className="font-medium">{selectedOperation.operation.report.data.weather.humidity}%</span></div>}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Location</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{formatLocation(selectedOperation.operation.report.data.location)}</p>
                  </div>

                  {selectedOperation.operation.report.data.trialTrack && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Trial Track</h3>
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
                        <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedOperation.operation.report.data.trialTrack.name}</span></div>
                        <div><span className="text-gray-500">Points:</span> <span className="font-medium">{selectedOperation.operation.report.data.trialTrack.points.length}</span></div>
                        {(selectedOperation.operation.report.data.trialTrack.pinPoints?.length ?? 0) > 0 && <div><span className="text-gray-500">Pins:</span> <span className="font-medium">{selectedOperation.operation.report.data.trialTrack.pinPoints?.length}</span></div>}
                      </div>
                    </div>
                  )}

                  {selectedOperation.operation.report.data.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.notes}</p>
                    </div>
                  )}
                </>
              )}

              {selectedOperation.operation.report.kind === 'tillage' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div><span className="text-gray-500">Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.date}</span></div>
                    <div><span className="text-gray-500">Method:</span> <span className="font-medium">{selectedOperation.operation.report.data.method}</span></div>
                    {selectedOperation.operation.report.data.depthInches !== undefined && <div><span className="text-gray-500">Depth:</span> <span className="font-medium">{selectedOperation.operation.report.data.depthInches} in</span></div>}
                  </div>
                  {selectedOperation.operation.report.data.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.notes}</p>
                    </div>
                  )}
                </>
              )}

              {selectedOperation.operation.report.kind === 'spray' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div><span className="text-gray-500">Status:</span> <span className="font-medium capitalize">{selectedOperation.operation.report.data.status}</span></div>
                    <div><span className="text-gray-500">Priority:</span> <span className="font-medium capitalize">{selectedOperation.operation.report.data.priority}</span></div>
                    <div><span className="text-gray-500">Planned Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.plannedDate}</span></div>
                    {selectedOperation.operation.report.data.appliedDate && <div><span className="text-gray-500">Applied Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.appliedDate}</span></div>}
                    <div className="sm:col-span-2"><span className="text-gray-500">Fields:</span> <span className="font-medium">{selectedOperation.operation.report.data.fieldNumbers.length ? selectedOperation.operation.report.data.fieldNumbers.join(', ') : 'All fields'}</span></div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Chemicals</h3>
                    {(selectedOperation.operation.report.data.chemicals?.length ?? 0) > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left px-3 py-2 border border-gray-200">Name</th>
                              <th className="text-left px-3 py-2 border border-gray-200">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedOperation.operation.report.data.chemicals ?? []).map((chemical, index) => (
                              <tr key={`${chemical.name}-${index}`}>
                                <td className="px-3 py-1.5 border border-gray-200">{chemical.name || '-'}</td>
                                <td className="px-3 py-1.5 border border-gray-200">{chemical.rate ? `${chemical.rate} L` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.product || selectedOperation.operation.report.data.products?.join(', ') || 'No chemical list recorded.'}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {selectedOperation.operation.report.data.applicationMethod && <div><span className="text-gray-500">Application Method:</span> <span className="font-medium">{selectedOperation.operation.report.data.applicationMethod}</span></div>}
                    {selectedOperation.operation.report.data.waterVolume && <div><span className="text-gray-500">Water Volume:</span> <span className="font-medium">{selectedOperation.operation.report.data.waterVolume}</span></div>}
                    {selectedOperation.operation.report.data.targetPest && <div><span className="text-gray-500">Target Pest:</span> <span className="font-medium">{selectedOperation.operation.report.data.targetPest}</span></div>}
                    {selectedOperation.operation.report.data.activeIngredient && <div><span className="text-gray-500">Active Ingredient:</span> <span className="font-medium">{selectedOperation.operation.report.data.activeIngredient}</span></div>}
                    {selectedOperation.operation.report.data.sprayer && <div><span className="text-gray-500">Sprayer:</span> <span className="font-medium">{selectedOperation.operation.report.data.sprayer}</span></div>}
                    {selectedOperation.operation.report.data.operator && <div><span className="text-gray-500">Operator:</span> <span className="font-medium">{selectedOperation.operation.report.data.operator}</span></div>}
                    {selectedOperation.operation.report.data.weatherAtApplication && <div className="sm:col-span-2"><span className="text-gray-500">Weather at Application:</span> <span className="font-medium">{selectedOperation.operation.report.data.weatherAtApplication}</span></div>}
                  </div>

                  {selectedOperation.operation.report.data.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.notes}</p>
                    </div>
                  )}
                </>
              )}

              {selectedOperation.operation.report.kind === 'harvest' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div><span className="text-gray-500">Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.date}</span></div>
                    <div><span className="text-gray-500">Crop:</span> <span className="font-medium">{selectedOperation.operation.report.data.cropType}</span></div>
                    {selectedOperation.operation.report.data.variety && <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{selectedOperation.operation.report.data.variety}</span></div>}
                    {selectedOperation.operation.report.data.yieldValue !== undefined && <div><span className="text-gray-500">Yield:</span> <span className="font-medium">{`${selectedOperation.operation.report.data.yieldValue} ${selectedOperation.operation.report.data.yieldUnit ?? ''}`.trim()}</span></div>}
                    {selectedOperation.operation.report.data.totalCwt !== undefined && <div><span className="text-gray-500">Total CWT:</span> <span className="font-medium">{selectedOperation.operation.report.data.totalCwt}</span></div>}
                    {selectedOperation.operation.report.data.moisture !== undefined && <div><span className="text-gray-500">Moisture:</span> <span className="font-medium">{selectedOperation.operation.report.data.moisture}%</span></div>}
                    {selectedOperation.operation.report.data.binNumber && <div><span className="text-gray-500">Bin Number:</span> <span className="font-medium">{selectedOperation.operation.report.data.binNumber}</span></div>}
                    {selectedOperation.operation.report.data.quality && <div><span className="text-gray-500">Quality:</span> <span className="font-medium">{selectedOperation.operation.report.data.quality}</span></div>}
                    {selectedOperation.operation.report.data.tuberTemp !== undefined && <div><span className="text-gray-500">Tuber Temp:</span> <span className="font-medium">{selectedOperation.operation.report.data.tuberTemp} C</span></div>}
                    {selectedOperation.operation.report.data.weatherData && <div className="sm:col-span-2"><span className="text-gray-500">Weather Data:</span> <span className="font-medium">{selectedOperation.operation.report.data.weatherData}</span></div>}
                  </div>

                  {(selectedOperation.operation.report.data.tuberDefects?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Tuber Defects</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.tuberDefects?.join(', ')}</p>
                    </div>
                  )}

                  {selectedOperation.operation.report.data.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.notes}</p>
                    </div>
                  )}
                </>
              )}

              {selectedOperation.operation.report.kind === 'storage-bin' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div><span className="text-gray-500">Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.date}</span></div>
                    {selectedOperation.operation.report.data.binNumber && <div><span className="text-gray-500">Bin Number:</span> <span className="font-medium">{selectedOperation.operation.report.data.binNumber}</span></div>}
                    {selectedOperation.operation.report.data.variety && <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{selectedOperation.operation.report.data.variety}</span></div>}
                    {selectedOperation.operation.report.data.totalCwt !== undefined && <div><span className="text-gray-500">Total CWT:</span> <span className="font-medium">{selectedOperation.operation.report.data.totalCwt}</span></div>}
                    {selectedOperation.operation.report.data.quality && <div><span className="text-gray-500">Quality:</span> <span className="font-medium">{selectedOperation.operation.report.data.quality}</span></div>}
                    {selectedOperation.operation.report.data.tuberTemp !== undefined && <div><span className="text-gray-500">Tuber Temp:</span> <span className="font-medium">{selectedOperation.operation.report.data.tuberTemp} C</span></div>}
                    {selectedOperation.operation.report.data.weatherData && <div className="sm:col-span-2"><span className="text-gray-500">Weather Data:</span> <span className="font-medium">{selectedOperation.operation.report.data.weatherData}</span></div>}
                  </div>

                  {(selectedOperation.operation.report.data.tuberDefects?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Tuber Defects</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.tuberDefects?.join(', ')}</p>
                    </div>
                  )}

                  {selectedOperation.operation.report.data.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.notes}</p>
                    </div>
                  )}
                </>
              )}

              {selectedOperation.operation.report.kind === 'potato-yield' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div><span className="text-gray-500">Date:</span> <span className="font-medium">{selectedOperation.operation.report.data.date}</span></div>
                    <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{selectedOperation.operation.report.data.potatoType}</span></div>
                    <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{selectedOperation.operation.report.data.variety || '—'}</span></div>
                  </div>

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
                          {Object.keys(selectedOperation.operation.report.data.grades)
                            .filter(grade => (selectedOperation.operation.report.data.grades[grade] ?? 0) > 0 || (selectedOperation.operation.report.data.gradeWeights[grade] ?? 0) > 0)
                            .map(grade => {
                              const count = selectedOperation.operation.report.data.grades[grade] ?? 0;
                              const weight = selectedOperation.operation.report.data.gradeWeights[grade] ?? 0;
                              const percent = selectedOperation.operation.report.data.totalTuberWeight > 0
                                ? ((weight / selectedOperation.operation.report.data.totalTuberWeight) * 100).toFixed(1)
                                : '0.0';

                              return (
                                <tr key={grade}>
                                  <td className="px-3 py-1.5 border border-gray-200 font-medium">{grade}</td>
                                  <td className="px-3 py-1.5 border border-gray-200">{count}</td>
                                  <td className="px-3 py-1.5 border border-gray-200">{weight.toFixed(2)}</td>
                                  <td className="px-3 py-1.5 border border-gray-200">{percent}%</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                    <div className="text-sm text-green-700 font-medium">Estimated Yield</div>
                    <div className="text-3xl font-bold text-green-800 my-1">{selectedOperation.operation.report.data.estimatedYield.toFixed(1)} cwt/acre</div>
                    <div className="text-sm text-green-600">
                      Total Count: {selectedOperation.operation.report.data.totalTuberCount} | Sample Weight: {selectedOperation.operation.report.data.totalTuberWeight.toFixed(1)} lbs
                    </div>
                  </div>

                  {(selectedOperation.operation.report.data.photos?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Photos ({selectedOperation.operation.report.data.photos?.length ?? 0})</h3>
                      <div className="flex flex-wrap gap-2">
                        {(selectedOperation.operation.report.data.photos ?? []).map((photo, index) => (
                          <img key={`${selectedOperation.operation.report.data.id}-yield-photo-${index}`} src={photo} alt={`Yield photo ${index + 1}`} className="photo-thumbnail" />
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOperation.operation.report.data.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedOperation.operation.report.data.notes}</p>
                    </div>
                  )}
                </>
              )}
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
