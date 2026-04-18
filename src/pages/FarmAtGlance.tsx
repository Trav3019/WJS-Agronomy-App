import type { AppData } from '../types';

interface Props {
  data: AppData;
}

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const formatPercent = (value: number) => `${clampPercent(value).toFixed(1)}%`;

const formatAcres = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

export default function FarmAtGlance({ data }: Props) {
  const totalFields = data.fields.length;
  const totalAcres = data.fields.reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const seededFieldNumbers = new Set(data.seedingEntries.map(entry => entry.fieldNumber));
  const tilledFieldNumbers = new Set(data.tillageReports.map(report => report.fieldNumber));
  const harvestedFieldNumbers = new Set(data.harvestReports.map(report => report.fieldNumber));

  const seededAcres = data.fields
    .filter(field => seededFieldNumbers.has(field.fieldNumber))
    .reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const tilledAcres = data.fields
    .filter(field => tilledFieldNumbers.has(field.fieldNumber))
    .reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const harvestedAcres = data.fields
    .filter(field => harvestedFieldNumbers.has(field.fieldNumber))
    .reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const seededPercent = totalAcres > 0 ? (seededAcres / totalAcres) * 100 : 0;
  const tilledPercent = totalAcres > 0 ? (tilledAcres / totalAcres) * 100 : 0;
  const harvestedPercent = totalAcres > 0 ? (harvestedAcres / totalAcres) * 100 : 0;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentlyScoutedFields = new Set(
    data.scoutingReports
      .filter(report => {
        const reportDate = new Date(report.date);
        return Number.isFinite(reportDate.getTime()) && reportDate >= weekAgo;
      })
      .map(report => report.fieldNumber),
  );

  const scoutingCoverage = totalFields > 0 ? (recentlyScoutedFields.size / totalFields) * 100 : 0;
  const sprayPlanned = data.sprayApplications.filter(app => app.status === 'planned').length;
  const sprayApplied = data.sprayApplications.filter(app => app.status === 'applied').length;

  const totalStorageCwt = data.potatoStorageBins.reduce((sum, bin) => sum + (bin.quantityCwt ?? 0), 0);
  const totalStorageCapacityCwt = data.potatoStorageBins.reduce(
    (sum, bin) => sum + (data.customBinCapacities[bin.binNumber] ?? 0),
    0,
  );
  const storageFillPercent = totalStorageCapacityCwt > 0 ? (totalStorageCwt / totalStorageCapacityCwt) * 100 : 0;

  const progressItems = [
    {
      label: 'Seeded Acres Complete',
      current: seededAcres,
      total: totalAcres,
      percent: seededPercent,
      barClass: 'bg-emerald-600',
    },
    {
      label: 'Tillage Acres Complete',
      current: tilledAcres,
      total: totalAcres,
      percent: tilledPercent,
      barClass: 'bg-amber-600',
    },
    {
      label: 'Harvest Acres Complete',
      current: harvestedAcres,
      total: totalAcres,
      percent: harvestedPercent,
      barClass: 'bg-sky-600',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-green-900">Farm at a Glance</h1>
        <p className="text-sm text-gray-600 mt-1">Live progress and season status across your farm.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Fields</p>
          <p className="mt-1 text-2xl font-bold text-green-900">{totalFields}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Acres</p>
          <p className="mt-1 text-2xl font-bold text-green-900">{formatAcres(totalAcres)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Sprays Planned</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{sprayPlanned}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Sprays Applied</p>
          <p className="mt-1 text-2xl font-bold text-sky-800">{sprayApplied}</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-base sm:text-lg font-semibold text-green-900">Acreage Progress</h2>
        <div className="space-y-4">
          {progressItems.map(item => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{item.label}</span>
                <span className="text-gray-600">
                  {formatAcres(item.current)} / {formatAcres(item.total)} acres ({formatPercent(item.percent)})
                </span>
              </div>
              <div className="mt-2 h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${item.barClass}`} style={{ width: formatPercent(item.percent) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Weekly Scouting Coverage</p>
          <p className="mt-1 text-2xl font-bold text-purple-800">{formatPercent(scoutingCoverage)}</p>
          <p className="mt-1 text-sm text-gray-600">
            {recentlyScoutedFields.size} of {totalFields} fields scouted in the last 7 days.
          </p>
        </div>

        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Potato Storage Fill</p>
          <p className="mt-1 text-2xl font-bold text-indigo-800">{formatPercent(storageFillPercent)}</p>
          <p className="mt-1 text-sm text-gray-600">
            {formatAcres(totalStorageCwt)} cwt stored of {formatAcres(totalStorageCapacityCwt)} cwt capacity.
          </p>
        </div>
      </div>
    </div>
  );
}