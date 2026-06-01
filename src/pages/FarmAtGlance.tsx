import { lazy, Suspense, useState } from 'react';
import type { AppData, CropType } from '../types';

const GeoMap = lazy(() => import('../components/GeoMap'));

interface Props {
  data: AppData;
}

const CROP_COLORS: Record<CropType, { bg: string; text: string; bar: string }> = {
  Corn:          { bg: 'bg-yellow-100', text: 'text-yellow-800', bar: 'bg-yellow-500' },
  Canola:        { bg: 'bg-yellow-50',  text: 'text-yellow-700', bar: 'bg-yellow-400' },
  Soybeans:      { bg: 'bg-green-100',  text: 'text-green-800',  bar: 'bg-green-500' },
  Wheat:         { bg: 'bg-amber-100',  text: 'text-amber-800',  bar: 'bg-amber-500' },
  'Edible Beans':{ bg: 'bg-lime-100',   text: 'text-lime-800',   bar: 'bg-lime-500' },
  Oats:          { bg: 'bg-stone-100',  text: 'text-stone-700',  bar: 'bg-stone-400' },
  Potatoes:      { bg: 'bg-orange-100', text: 'text-orange-800', bar: 'bg-orange-500' },
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const formatPercent = (value: number) => `${clampPercent(value).toFixed(1)}%`;

const formatAcres = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const formatNum = (value: number, decimals = 1) => {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

const toTime = (value?: string) => {
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const FARM_MAP_IMPORTS = [
  { name: 'Red Farm', sources: ['/farm-maps/red-farm.pdf', '/farm-maps/red-farm.png'] },
  { name: 'Yellow Farm', sources: ['/farm-maps/yellow-farm.png'] },
  { name: 'Blue Farm', sources: ['/farm-maps/blue-farm.png'] },
  { name: 'Green Farm', sources: ['/farm-maps/green-farm.png'] },
] as const;

export default function FarmAtGlance({ data }: Props) {
  const [cropFilter, setCropFilter] = useState<CropType | 'All'>('All');
  const [seedingView, setSeedingView] = useState<'all' | 'seeded' | 'unseeded'>('seeded');
  const [activeTab, setActiveTab] = useState<'overview' | 'maps'>('overview');
  const [missingImportedMaps, setMissingImportedMaps] = useState<Record<string, true>>({});

  const toSeedingSignature = (record: {
    fieldId?: string;
    fieldNumber: string;
    cropType: CropType;
    variety?: string;
    seedingDate: string;
  }) => {
    const normalizedVariety = (record.variety ?? '').trim().toLowerCase();
    return `${record.fieldId ?? ''}|${record.fieldNumber}|${record.cropType}|${normalizedVariety}|${record.seedingDate}`;
  };

  const seedingPlanSignatures = new Set(data.seedingPlans.map(plan => toSeedingSignature(plan)));

  const isSeedingPlanEntry = (entry: (typeof data.seedingEntries)[number]) => {
    const trialName = entry.trialTrack?.name?.trim().toLowerCase();
    if (trialName === 'seeding plan') {
      return true;
    }

    return seedingPlanSignatures.has(toSeedingSignature(entry));
  };

  const fieldsById = new Map(data.fields.map(field => [field.id, field]));
  const fieldsByNumberAndCrop = new Map(data.fields.map(field => [`${field.fieldNumber}|${field.cropType}`, field]));
  const uniqueFieldIdByNumber = data.fields.reduce<Map<string, string | null>>((acc, field) => {
    if (!acc.has(field.fieldNumber)) {
      acc.set(field.fieldNumber, field.id);
    } else {
      acc.set(field.fieldNumber, null);
    }
    return acc;
  }, new Map<string, string | null>());

  const resolveField = (fieldId?: string, fieldNumber?: string, cropType?: CropType) => {
    if (fieldId) {
      const fromId = fieldsById.get(fieldId);
      if (fromId) return fromId;
    }

    if (fieldNumber && cropType) {
      const fromKey = fieldsByNumberAndCrop.get(`${fieldNumber}|${cropType}`);
      if (fromKey) return fromKey;
    }

    return undefined;
  };

  const resolveUniqueFieldIdByNumberOnly = (fieldNumber?: string) => {
    if (!fieldNumber) return undefined;
    const candidate = uniqueFieldIdByNumber.get(fieldNumber);
    return candidate ?? undefined;
  };

  // Build crop breakdown from all fields
  const cropBreakdown = Object.entries(
    data.fields.reduce<Record<string, { acres: number; count: number }>>((acc, field) => {
      const crop = field.cropType;
      if (!acc[crop]) acc[crop] = { acres: 0, count: 0 };
      acc[crop].acres += Number.isFinite(field.acres) ? field.acres : 0;
      acc[crop].count += 1;
      return acc;
    }, {}),
  )
    .map(([crop, val]) => ({ crop: crop as CropType, ...val }))
    .sort((a, b) => b.acres - a.acres);

  const allCrops = cropBreakdown.map(c => c.crop);

  // Apply crop filter
  const visibleFields = cropFilter === 'All'
    ? data.fields
    : data.fields.filter(f => f.cropType === cropFilter);
  const visibleFieldIds = new Set(visibleFields.map(field => field.id));

  const totalFields = visibleFields.length;
  const totalAcres = visibleFields.reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const seededFieldIds = new Set(
    data.seedingEntries
      .filter(entry => !isSeedingPlanEntry(entry))
      .map(entry => resolveField(entry.fieldId, entry.fieldNumber, entry.cropType)?.id)
      .filter((id): id is string => typeof id === 'string')
      .filter(id => visibleFieldIds.has(id)),
  );

  const tilledFieldIds = new Set(
    data.tillageReports
      .map(report => {
        if (report.fieldId) return report.fieldId;
        return resolveUniqueFieldIdByNumberOnly(report.fieldNumber);
      })
      .filter((id): id is string => typeof id === 'string')
      .filter(id => visibleFieldIds.has(id)),
  );

  const harvestedFieldIds = new Set(
    data.harvestReports
      .map(report => resolveField(report.fieldId, report.fieldNumber, report.cropType)?.id)
      .filter((id): id is string => typeof id === 'string')
      .filter(id => visibleFieldIds.has(id)),
  );

  const seededAcres = visibleFields
    .filter(field => seededFieldIds.has(field.id))
    .reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const tilledAcres = visibleFields
    .filter(field => tilledFieldIds.has(field.id))
    .reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const harvestedAcres = visibleFields
    .filter(field => harvestedFieldIds.has(field.id))
    .reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const seededPercent = totalAcres > 0 ? (seededAcres / totalAcres) * 100 : 0;
  const tilledPercent = totalAcres > 0 ? (tilledAcres / totalAcres) * 100 : 0;
  const harvestedPercent = totalAcres > 0 ? (harvestedAcres / totalAcres) * 100 : 0;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentlyScoutedFieldIds = new Set(
    data.scoutingReports
      .filter(report => {
        const reportDate = new Date(report.date);
        return Number.isFinite(reportDate.getTime()) && reportDate >= weekAgo;
      })
      .map(report => resolveField(report.fieldId, report.fieldNumber, report.cropType)?.id)
      .filter((id): id is string => typeof id === 'string')
      .filter(id => visibleFieldIds.has(id)),
  );

  const scoutedVisible = visibleFields.filter(f => recentlyScoutedFieldIds.has(f.id)).length;
  const scoutingCoverage = totalFields > 0 ? (scoutedVisible / totalFields) * 100 : 0;

  const latestScoutByFieldId = data.scoutingReports.reduce<Map<string, string>>((acc, report) => {
    const field = resolveField(report.fieldId, report.fieldNumber, report.cropType);
    if (!field || !visibleFieldIds.has(field.id)) return acc;

    const nextDate = report.date;
    const prevDate = acc.get(field.id);
    if (!prevDate || toTime(nextDate) > toTime(prevDate)) {
      acc.set(field.id, nextDate);
    }

    return acc;
  }, new Map<string, string>());

  const scoutingPriorityByCrop = visibleFields.reduce<Record<CropType, Array<{ fieldNumber: string; acres: number; lastScouted: string | null; daysSince: number | null }>>>((acc, field) => {
    const lastScouted = latestScoutByFieldId.get(field.id) ?? null;
    const daysSince = lastScouted
      ? Math.floor((Date.now() - toTime(lastScouted)) / (1000 * 60 * 60 * 24))
      : null;

    if (!acc[field.cropType]) {
      acc[field.cropType] = [];
    }

    acc[field.cropType].push({
      fieldNumber: field.fieldNumber,
      acres: field.acres,
      lastScouted,
      daysSince,
    });

    return acc;
  }, {} as Record<CropType, Array<{ fieldNumber: string; acres: number; lastScouted: string | null; daysSince: number | null }>>);

  const scoutingPriorityCrops = Object.entries(scoutingPriorityByCrop)
    .map(([crop, rows]) => ({
      crop: crop as CropType,
      rows: rows.sort((a, b) => {
        if (a.lastScouted === null && b.lastScouted !== null) return -1;
        if (a.lastScouted !== null && b.lastScouted === null) return 1;
        if (a.lastScouted === null && b.lastScouted === null) {
          return a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' });
        }
        return toTime(a.lastScouted ?? undefined) - toTime(b.lastScouted ?? undefined);
      }),
    }))
    .sort((a, b) => a.crop.localeCompare(b.crop));

  const sprayedFieldIds = new Set(
    data.sprayApplications
      .filter(app => app.status === 'applied')
      .flatMap(app => {
        const fromIds = app.fieldIds ?? [];
        const fromFieldNumbers = (app.fieldNumbers ?? [])
          .map(number => resolveUniqueFieldIdByNumberOnly(number))
          .filter((id): id is string => Boolean(id));
        return [...fromIds, ...fromFieldNumbers];
      })
      .filter((id): id is string => typeof id === 'string')
      .filter(id => visibleFieldIds.has(id)),
  );

  const sprayedAcres = visibleFields
    .filter(field => sprayedFieldIds.has(field.id))
    .reduce((sum, field) => sum + (Number.isFinite(field.acres) ? field.acres : 0), 0);

  const sprayedPercent = totalAcres > 0 ? (sprayedAcres / totalAcres) * 100 : 0;

  const unseededAcres = Math.max(0, totalAcres - seededAcres);

  type ResolvedSeedingEntry = { entry: (typeof data.seedingEntries)[number]; field: (typeof data.fields)[number] };
  const resolvedVisibleSeedingEntries: ResolvedSeedingEntry[] = data.seedingEntries
    .filter(entry => !isSeedingPlanEntry(entry))
    .map(entry => {
      const field = resolveField(entry.fieldId, entry.fieldNumber, entry.cropType);
      if (!field || !visibleFieldIds.has(field.id)) return null;
      return { entry, field };
    })
    .filter((item): item is ResolvedSeedingEntry => item !== null);

  const latestSeedingByFieldId = resolvedVisibleSeedingEntries.reduce<Map<string, ResolvedSeedingEntry>>((acc, current) => {
    const existing = acc.get(current.field.id);
    if (!existing) {
      acc.set(current.field.id, current);
      return acc;
    }

    const currentDate = Math.max(toTime(current.entry.seedingDate), toTime(current.entry.createdAt));
    const existingDate = Math.max(toTime(existing.entry.seedingDate), toTime(existing.entry.createdAt));
    if (currentDate >= existingDate) {
      acc.set(current.field.id, current);
    }
    return acc;
  }, new Map<string, ResolvedSeedingEntry>());

  const fieldSeedingRows = visibleFields
    .map(field => {
      const latest = latestSeedingByFieldId.get(field.id);
      const entry = latest?.entry;
      const isSeeded = Boolean(entry);
      return {
        field,
        entry,
        isSeeded,
      };
    })
    .sort((a, b) => a.field.fieldNumber.localeCompare(b.field.fieldNumber, undefined, { numeric: true, sensitivity: 'base' }));

  const seededFieldCount = fieldSeedingRows.filter(row => row.isSeeded).length;
  const unseededFieldCount = fieldSeedingRows.length - seededFieldCount;

  const visibleSeedingRows = fieldSeedingRows.filter(row => {
    if (seedingView === 'seeded') return row.isSeeded;
    if (seedingView === 'unseeded') return !row.isSeeded;
    return true;
  });

  const grandTotalAcres = data.fields.reduce((sum, f) => sum + (Number.isFinite(f.acres) ? f.acres : 0), 0);

  // --- Variety breakdown for visible fields ---
  const varietyBreakdown = Object.entries(
    data.seedingEntries
      .filter(entry => !isSeedingPlanEntry(entry))
      .map(entry => ({
        entry,
        field: resolveField(entry.fieldId, entry.fieldNumber, entry.cropType),
      }))
      .filter(({ entry, field }) => Boolean(entry.variety) && Boolean(field) && visibleFieldIds.has(field!.id))
      .reduce<Record<string, { acres: number; count: number }>>((acc, item) => {
        const variety = item.entry.variety;
        const acres = item.field && Number.isFinite(item.field.acres) ? item.field.acres : 0;
        if (!acc[variety]) acc[variety] = { acres: 0, count: 0 };
        acc[variety].acres += acres;
        acc[variety].count += 1;
        return acc;
      }, {}),
  )
    .map(([variety, val]) => ({ variety, ...val }))
    .sort((a, b) => b.acres - a.acres);

  // --- Potato yield by variety ---
  const potatoYieldReports = cropFilter === 'All' || cropFilter === 'Potatoes'
    ? data.potatoYieldReports
    : [];
  const potatoYieldByVariety = Object.entries(
    potatoYieldReports.reduce<Record<string, { totalYield: number; count: number; type: string }>>((acc, r) => {
      if (!acc[r.variety]) acc[r.variety] = { totalYield: 0, count: 0, type: r.potatoType };
      acc[r.variety].totalYield += Number.isFinite(r.estimatedYield) ? r.estimatedYield : 0;
      acc[r.variety].count += 1;
      return acc;
    }, {}),
  )
    .map(([variety, val]) => ({
      variety,
      avgYield: val.count > 0 ? val.totalYield / val.count : 0,
      samples: val.count,
      type: val.type,
    }))
    .sort((a, b) => b.avgYield - a.avgYield);

  // --- Harvest yield by variety (for filtered crop) ---
  const harvestReportsForCrop = cropFilter === 'All'
    ? data.harvestReports
    : data.harvestReports.filter(r => r.cropType === cropFilter);

  const harvestYieldByVariety = Object.entries(
    harvestReportsForCrop
      .filter(r => r.variety && Number.isFinite(r.yieldValue) && r.yieldValue! > 0)
      .reduce<Record<string, { totalYield: number; count: number; unit: string }>>((acc, r) => {
        const v = r.variety!;
        if (!acc[v]) acc[v] = { totalYield: 0, count: 0, unit: r.yieldUnit ?? 'bu/ac' };
        acc[v].totalYield += r.yieldValue!;
        acc[v].count += 1;
        return acc;
      }, {}),
  )
    .map(([variety, val]) => ({
      variety,
      avgYield: val.count > 0 ? val.totalYield / val.count : 0,
      samples: val.count,
      unit: val.unit,
    }))
    .sort((a, b) => b.avgYield - a.avgYield);

  const maxHarvestYield = harvestYieldByVariety.reduce((m, r) => Math.max(m, r.avgYield), 0);
  const maxPotatoYield = potatoYieldByVariety.reduce((m, r) => Math.max(m, r.avgYield), 0);

  // --- Potato storage bins ---
  const storageBins = data.potatoStorageBins;
  const totalStorageCwt = storageBins.reduce((s, b) => s + (b.quantityCwt ?? 0), 0);
  const totalStorageCapacity = storageBins.reduce((s, b) => s + (data.customBinCapacities[b.binNumber] ?? 0), 0);

  const showPotatoSections = cropFilter === 'Potatoes' || (cropFilter === 'All' && data.fields.some(f => f.cropType === 'Potatoes'));

  const progressItems = [
    { label: 'Seeded Acres Complete', current: seededAcres, total: totalAcres, percent: seededPercent, barClass: 'bg-emerald-600' },
    { label: 'Tillage Acres Complete', current: tilledAcres, total: totalAcres, percent: tilledPercent, barClass: 'bg-amber-600' },
    { label: 'Harvest Acres Complete', current: harvestedAcres, total: totalAcres, percent: harvestedPercent, barClass: 'bg-sky-600' },
    { label: 'Spraying Acres Complete', current: sprayedAcres, total: totalAcres, percent: sprayedPercent, barClass: 'bg-purple-600' },
  ];

  const binStatusColor: Record<string, string> = {
    Good: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Monitor: 'bg-amber-100 text-amber-800 border-amber-200',
    Issue: 'bg-red-100 text-red-800 border-red-200',
  };

  const fieldLocationMarkers = visibleFields
    .filter((field) => Number.isFinite(field.location?.lat) && Number.isFinite(field.location?.lng))
    .map((field) => ({
      location: field.location!,
      label: `${field.fieldNumber} (${field.cropType})`,
      date: field.updatedAt ? `Updated ${field.updatedAt}` : 'Field Location',
      color: '#2d6a4f',
    }));

  const scoutingLocationMarkers = data.scoutingReports
    .map((report) => {
      const field = resolveField(report.fieldId, report.fieldNumber, report.cropType);
      if (!field || !visibleFieldIds.has(field.id)) return null;
      if (!Number.isFinite(report.location?.lat) || !Number.isFinite(report.location?.lng)) return null;

      return {
        location: report.location!,
        label: `${report.fieldNumber} (${report.cropType})`,
        date: report.date,
        color: '#1d4ed8',
      };
    })
    .filter((marker): marker is { location: { lat: number; lng: number; accuracy?: number }; label: string; date: string; color: string } => Boolean(marker));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-green-900">Farm at a Glance</h1>
        <p className="text-sm text-gray-600 mt-1">Live progress and season status across your farm.</p>
      </div>

      <div className="inline-flex rounded-xl border border-green-200 bg-white p-1 shadow-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'overview' ? 'bg-green-700 text-white' : 'text-green-800 hover:bg-green-50'
          }`}
        >
          Farm Overview
        </button>
        <button
          onClick={() => setActiveTab('maps')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'maps' ? 'bg-green-700 text-white' : 'text-green-800 hover:bg-green-50'
          }`}
        >
          Farm Maps
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
      {/* Acres by Crop breakdown */}
      {cropBreakdown.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-green-900">Acres by Crop</h2>
          <div className="space-y-2">
            {cropBreakdown.map(({ crop, acres, count }) => {
              const pct = grandTotalAcres > 0 ? (acres / grandTotalAcres) * 100 : 0;
              const colors = CROP_COLORS[crop];
              return (
                <div key={crop}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className={`inline-flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-full text-xs ${colors.bg} ${colors.text}`}>
                      {crop}
                    </span>
                    <span className="text-gray-600 text-xs">
                      {count} field{count !== 1 ? 's' : ''} · {formatAcres(acres)} ac · {formatPercent(pct)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: formatPercent(pct) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Crop filter tabs */}
      {allCrops.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCropFilter('All')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              cropFilter === 'All'
                ? 'bg-green-700 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            All Crops
          </button>
          {allCrops.map(crop => {
            const colors = CROP_COLORS[crop];
            const active = cropFilter === crop;
            return (
              <button
                key={crop}
                onClick={() => setCropFilter(crop)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active ? `${colors.bar} text-white` : `${colors.bg} ${colors.text} hover:opacity-80`
                }`}
              >
                {crop}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {cropFilter === 'All' ? 'Total Fields' : `${cropFilter} Fields`}
          </p>
          <p className="mt-1 text-2xl font-bold text-green-900">{totalFields}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {cropFilter === 'All' ? 'Total Acres' : `${cropFilter} Acres`}
          </p>
          <p className="mt-1 text-2xl font-bold text-green-900">{formatAcres(totalAcres)}</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-base sm:text-lg font-semibold text-green-900">
          Acreage Progress{cropFilter !== 'All' ? ` — ${cropFilter}` : ''}
        </h2>
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

      {/* Variety Breakdown */}
      {varietyBreakdown.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-green-900">
            Varieties Planted{cropFilter !== 'All' ? ` — ${cropFilter}` : ''}
          </h2>
          <div className="space-y-2">
            {varietyBreakdown.map(({ variety, acres, count }) => {
              const pct = totalAcres > 0 ? (acres / totalAcres) * 100 : 0;
              const colors = cropFilter !== 'All' ? CROP_COLORS[cropFilter] : { bar: 'bg-green-500', bg: 'bg-green-100', text: 'text-green-800' };
              return (
                <div key={variety}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800 truncate max-w-[60%]">{variety}</span>
                    <span className="text-gray-500 text-xs">{count} field{count !== 1 ? 's' : ''} · {formatAcres(acres)} ac · {formatPercent(pct)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: formatPercent(pct) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Potato Yield by Variety */}
      {showPotatoSections && potatoYieldByVariety.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-green-900">Potato Yield by Variety</h2>
          <p className="text-xs text-gray-500">Average estimated yield from dig samples (cwt/ac)</p>
          <div className="space-y-3">
            {potatoYieldByVariety.map(({ variety, avgYield, samples, type }) => {
              const pct = maxPotatoYield > 0 ? (avgYield / maxPotatoYield) * 100 : 0;
              return (
                <div key={variety}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-800 truncate">{variety}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${type === 'table' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {type}
                      </span>
                    </div>
                    <span className="text-gray-600 text-xs shrink-0 ml-2">
                      {formatNum(avgYield)} cwt/ac · {samples} sample{samples !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full transition-all bg-orange-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Harvest Yield by Variety */}
      {harvestYieldByVariety.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-green-900">
            Harvest Yield by Variety{cropFilter !== 'All' ? ` — ${cropFilter}` : ''}
          </h2>
          <div className="space-y-3">
            {harvestYieldByVariety.map(({ variety, avgYield, samples, unit }) => {
              const pct = maxHarvestYield > 0 ? (avgYield / maxHarvestYield) * 100 : 0;
              const colors = cropFilter !== 'All' ? CROP_COLORS[cropFilter] : { bar: 'bg-sky-500' };
              return (
                <div key={variety}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800 truncate max-w-[60%]">{variety}</span>
                    <span className="text-gray-600 text-xs shrink-0 ml-2">
                      {formatNum(avgYield)} {unit} · {samples} field{samples !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seeding Summary (All Crops) */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-semibold text-green-900">
            Seeding Summary by Field{cropFilter !== 'All' ? ` — ${cropFilter}` : ''}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSeedingView('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                seedingView === 'all'
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All ({fieldSeedingRows.length})
            </button>
            <button
              onClick={() => setSeedingView('seeded')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                seedingView === 'seeded'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Seeded ({seededFieldCount})
            </button>
            <button
              onClick={() => setSeedingView('unseeded')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                seedingView === 'unseeded'
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Unseeded ({unseededFieldCount})
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
            <span>Seeded vs Unseeded Acres</span>
            <span>{formatAcres(seededAcres)} seeded / {formatAcres(unseededAcres)} unseeded</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: formatPercent(seededPercent) }} />
            <div className="h-full bg-amber-400 transition-all" style={{ width: formatPercent(100 - seededPercent) }} />
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Field</th>
                <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Crop</th>
                <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Status</th>
                <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Variety</th>
                <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Date</th>
                <th className="text-right py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Rate</th>
                <th className="text-right py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Row / Depth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleSeedingRows.map(({ field, entry, isSeeded }) => {
                const rateLabel = entry
                  ? field.cropType === 'Potatoes' && entry.seedingRateCwtAc != null
                    ? `${formatNum(entry.seedingRateCwtAc)} cwt/ac`
                    : entry.seedingRate > 0
                      ? `${formatNum(entry.seedingRate, 0)} seeds/ac`
                      : '—'
                  : '—';

                const spacingDepthLabel = entry
                  ? `${entry.rowSpacing != null ? `${entry.rowSpacing}"` : '—'} / ${entry.seedDepth != null ? `${entry.seedDepth}"` : '—'}`
                  : '—';

                return (
                  <tr key={field.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-3 font-medium text-green-800">{field.fieldNumber}</td>
                    <td className="py-2 pr-3 text-gray-700">{field.cropType}</td>
                    <td className="py-2 pr-3">
                      {isSeeded ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Seeded</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Unseeded</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{entry?.variety || '—'}</td>
                    <td className="py-2 pr-3 text-gray-700">{entry?.seedingDate || '—'}</td>
                    <td className="py-2 pr-3 text-right text-gray-700">{rateLabel}</td>
                    <td className="py-2 pr-3 text-right text-gray-700">{spacingDepthLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Potato Storage Bins */}
      {showPotatoSections && storageBins.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-green-900">Potato Storage</h2>
            <span className="text-sm text-gray-600">
              {formatNum(totalStorageCwt)} / {formatNum(totalStorageCapacity)} cwt
              {totalStorageCapacity > 0 && ` (${formatPercent((totalStorageCwt / totalStorageCapacity) * 100)} full)`}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {storageBins.map(bin => {
              const capacity = data.customBinCapacities[bin.binNumber] ?? 0;
              const fillPct = capacity > 0 ? Math.min(100, ((bin.quantityCwt ?? 0) / capacity) * 100) : 0;
              const statusClass = bin.status ? binStatusColor[bin.status] : 'bg-gray-100 text-gray-700 border-gray-200';
              return (
                <div key={bin.id} className={`rounded-lg border p-3 text-sm ${statusClass}`}>
                  <div className="font-semibold">Bin {bin.binNumber}</div>
                  {bin.variety && <div className="text-xs opacity-80 truncate">{bin.variety}</div>}
                  <div className="mt-1 text-xs">{formatNum(bin.quantityCwt ?? 0)} cwt</div>
                  {capacity > 0 && (
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                      <div className="h-full rounded-full bg-current opacity-50 transition-all" style={{ width: `${fillPct}%` }} />
                    </div>
                  )}
                  {bin.storageTempC != null && (
                    <div className="mt-1 text-xs opacity-70">{bin.storageTempC}°C</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scouting Priority by Crop */}
      {scoutingPriorityCrops.length > 0 && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-green-900">
              Scouting Priority by Crop{cropFilter !== 'All' ? ` — ${cropFilter}` : ''}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Fields are sorted so never-scouted and oldest-scouted fields appear first.
            </p>
          </div>

          <div className="space-y-4">
            {scoutingPriorityCrops.map(({ crop, rows }) => {
              const colors = CROP_COLORS[crop];
              return (
                <div key={crop} className="rounded-lg border border-gray-200 p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                      {crop}
                    </span>
                    <span className="text-xs text-gray-500">{rows.length} field{rows.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-sm min-w-[420px]">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Field</th>
                          <th className="text-right py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Acres</th>
                          <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-gray-500 font-medium">Last Scouted</th>
                          <th className="text-right py-2 text-xs uppercase tracking-wide text-gray-500 font-medium">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((row) => {
                          const priorityLabel = row.daysSince === null
                            ? 'Scout ASAP'
                            : row.daysSince >= 10
                              ? 'High'
                              : row.daysSince >= 7
                                ? 'Medium'
                                : 'Low';

                          const priorityClass = row.daysSince === null
                            ? 'bg-red-100 text-red-800'
                            : row.daysSince >= 10
                              ? 'bg-orange-100 text-orange-800'
                              : row.daysSince >= 7
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800';

                          return (
                            <tr key={`${crop}-${row.fieldNumber}`} className="hover:bg-gray-50">
                              <td className="py-2 pr-3 font-medium text-green-800">{row.fieldNumber}</td>
                              <td className="py-2 pr-3 text-right text-gray-700">{formatAcres(row.acres)}</td>
                              <td className="py-2 pr-3 text-gray-700">{row.lastScouted ?? 'Never'}</td>
                              <td className="py-2 text-right">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass}`}>
                                  {priorityLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <p className="text-xs uppercase tracking-wide text-gray-500">Weekly Scouting Coverage</p>
        <p className="mt-1 text-2xl font-bold text-purple-800">{formatPercent(scoutingCoverage)}</p>
        <p className="mt-1 text-sm text-gray-600">
          {scoutedVisible} of {totalFields} fields scouted in the last 7 days.
        </p>
      </div>
        </>
      )}

      {activeTab === 'maps' && (
        <>
          <div className="card space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-green-900">Imported Farm Maps</h2>
              <p className="text-xs text-gray-500 mt-1">
                Ordered as requested: Red Farm, Yellow Farm, Blue Farm, Green Farm.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FARM_MAP_IMPORTS.map((mapItem) => {
                const activeSource = mapItem.sources.find(source => !missingImportedMaps[source]) ?? mapItem.sources[0];
                const missing = mapItem.sources.every(source => Boolean(missingImportedMaps[source]));
                const isPdf = activeSource.toLowerCase().endsWith('.pdf');

                return (
                  <div key={mapItem.name} className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-green-900">{mapItem.name}</p>
                    </div>

                    {missing ? (
                      <div className="h-56 sm:h-64 flex items-center justify-center px-4 text-center text-sm text-gray-500 bg-gray-50">
                        Map file not found. Tried: {mapItem.sources.join(', ')}
                      </div>
                    ) : isPdf ? (
                      <object
                        data={activeSource}
                        type="application/pdf"
                        className="h-56 sm:h-64 w-full"
                        onError={() => setMissingImportedMaps(prev => ({ ...prev, [activeSource]: true }))}
                      >
                        <div className="h-56 sm:h-64 flex items-center justify-center px-4 text-center text-sm text-gray-500 bg-gray-50">
                          Unable to render PDF preview. <a className="text-green-700 underline" href={activeSource} target="_blank" rel="noreferrer">Open {mapItem.name} PDF</a>
                        </div>
                      </object>
                    ) : (
                      <img
                        src={activeSource}
                        alt={mapItem.name}
                        className="h-56 sm:h-64 w-full object-cover"
                        loading="lazy"
                        onError={() => setMissingImportedMaps(prev => ({ ...prev, [activeSource]: true }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-green-900">Field Map</h2>
            {fieldLocationMarkers.length > 0 ? (
              <Suspense fallback={<div className="text-sm text-gray-500">Loading map...</div>}>
                <GeoMap markers={fieldLocationMarkers} readonly height="430px" />
              </Suspense>
            ) : (
              <p className="text-sm text-gray-600">No saved field GPS locations available for this crop view.</p>
            )}
          </div>

          <div className="card space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-green-900">Scouting Pins Map</h2>
            {scoutingLocationMarkers.length > 0 ? (
              <Suspense fallback={<div className="text-sm text-gray-500">Loading map...</div>}>
                <GeoMap markers={scoutingLocationMarkers} readonly height="430px" />
              </Suspense>
            ) : (
              <p className="text-sm text-gray-600">No scouting GPS pins available for this crop view.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}