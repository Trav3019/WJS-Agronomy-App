import type { AppData, Field, PlanterCheck, ScoutingReport, PotatoYieldReport, SprayApplication, SeedingEntry, SeedingPlan, TillageReport, HarvestReport, PotatoStorageBin } from '../types';

const LEGACY_STORAGE_KEY = 'wjs-agronomy-data';
const STORAGE_KEY_PREFIX = 'wjs-agronomy-data-season-';
const ACTIVE_SEASON_KEY = 'wjs-agronomy-active-season';

const defaultData: AppData = {
  fields: [],
  scoutingReports: [],
  potatoYieldReports: [],
  sprayApplications: [],
  seedingEntries: [],
  seedingPlans: [],
  planterChecks: [],
  tillageReports: [],
  harvestReports: [],
  potatoStorageBins: [],
  customBins: [],
  customBinCapacities: {},
};

function isValidSeasonYear(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}$/.test(value);
}

function seasonStorageKey(seasonYear: string): string {
  return `${STORAGE_KEY_PREFIX}${seasonYear}`;
}

function migrateLegacyDataToCurrentSeason(): void {
  try {
    const currentSeason = getCurrentSeasonYear();
    const seasonKey = seasonStorageKey(currentSeason);
    if (localStorage.getItem(seasonKey)) return;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) localStorage.setItem(seasonKey, legacy);
  } catch {
    // Ignore migration failures and fallback to defaults.
  }
}

export function getCurrentSeasonYear(): string {
  return String(new Date().getFullYear());
}

export function getActiveSeasonYear(): string {
  try {
    const value = localStorage.getItem(ACTIVE_SEASON_KEY);
    return isValidSeasonYear(value) ? value : getCurrentSeasonYear();
  } catch {
    return getCurrentSeasonYear();
  }
}

export function setActiveSeasonYear(seasonYear: string): void {
  if (!isValidSeasonYear(seasonYear)) return;
  try {
    localStorage.setItem(ACTIVE_SEASON_KEY, seasonYear);
  } catch {
    // Ignore write failures.
  }
}

export function getAvailableSeasonYears(): string[] {
  try {
    const years = new Set<string>();
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;
      const year = key.slice(STORAGE_KEY_PREFIX.length);
      if (isValidSeasonYear(year)) years.add(year);
    }

    const active = getActiveSeasonYear();
    years.add(active);

    return [...years].sort((a, b) => Number(b) - Number(a));
  } catch {
    return [getCurrentSeasonYear()];
  }
}

export function loadData(seasonYear: string = getActiveSeasonYear()): AppData {
  try {
    migrateLegacyDataToCurrentSeason();
    const raw = localStorage.getItem(seasonStorageKey(seasonYear));
    if (!raw) return defaultData;

    // If a non-current season accidentally got cloned from legacy data, treat it as empty.
    const currentSeason = getCurrentSeasonYear();
    if (seasonYear !== currentSeason) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy && raw === legacy) return defaultData;
    }

    const parsed = JSON.parse(raw);
    return { ...defaultData, ...parsed };
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData, seasonYear: string = getActiveSeasonYear()): void {
  try {
    localStorage.setItem(seasonStorageKey(seasonYear), JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Field operations
export function saveField(data: AppData, field: Field): AppData {
  const idx = data.fields.findIndex(f => f.id === field.id);
  const updated = idx >= 0
    ? data.fields.map(f => f.id === field.id ? field : f)
    : [...data.fields, field];
  return { ...data, fields: updated };
}

export function deleteField(data: AppData, id: string): AppData {
  const field = data.fields.find(f => f.id === id);
  if (!field) return data;

  const nextSprayApplications = data.sprayApplications
    .map(app => {
      const hadScopedFields = app.fieldIds.length > 0 || app.fieldNumbers.length > 0;
      const fieldIds = app.fieldIds.filter(fieldId => fieldId !== id);
      const fieldNumbers = app.fieldNumbers.filter(fieldNumber => fieldNumber !== field.fieldNumber);
      return { app, hadScopedFields, fieldIds, fieldNumbers };
    })
    .filter(({ hadScopedFields, fieldIds, fieldNumbers }) => {
      // Keep true all-field applications (already unscoped),
      // but drop scoped applications that no longer target any field.
      if (!hadScopedFields) return true;
      return fieldIds.length > 0 || fieldNumbers.length > 0;
    })
    .map(({ app, fieldIds, fieldNumbers }) => ({
      ...app,
      fieldIds,
      fieldNumbers,
    }));

  return {
    ...data,
    fields: data.fields.filter(f => f.id !== id),
    scoutingReports: data.scoutingReports.filter(r => r.fieldId !== id && r.fieldNumber !== field.fieldNumber),
    potatoYieldReports: data.potatoYieldReports.filter(r => r.fieldId !== id && r.fieldNumber !== field.fieldNumber),
    seedingEntries: data.seedingEntries.filter(e => e.fieldId !== id && e.fieldNumber !== field.fieldNumber),
    seedingPlans: data.seedingPlans.filter(p => p.fieldId !== id && p.fieldNumber !== field.fieldNumber),
    planterChecks: data.planterChecks.filter(check => check.fieldId !== id && check.fieldNumber !== field.fieldNumber),
    tillageReports: data.tillageReports.filter(r => r.fieldId !== id && r.fieldNumber !== field.fieldNumber),
    harvestReports: data.harvestReports.filter(r => r.fieldId !== id && r.fieldNumber !== field.fieldNumber),
    potatoStorageBins: data.potatoStorageBins.filter(b => b.fieldNumber !== field.fieldNumber),
    sprayApplications: nextSprayApplications,
  };
}

// Scouting
export function saveScoutingReport(data: AppData, report: ScoutingReport): AppData {
  const idx = data.scoutingReports.findIndex(r => r.id === report.id);
  const updated = idx >= 0
    ? data.scoutingReports.map(r => r.id === report.id ? report : r)
    : [...data.scoutingReports, report];
  return { ...data, scoutingReports: updated };
}

export function deleteScoutingReport(data: AppData, id: string): AppData {
  return { ...data, scoutingReports: data.scoutingReports.filter(r => r.id !== id) };
}

// Potato yield
export function savePotatoYield(data: AppData, report: PotatoYieldReport): AppData {
  const idx = data.potatoYieldReports.findIndex(r => r.id === report.id);
  const updated = idx >= 0
    ? data.potatoYieldReports.map(r => r.id === report.id ? report : r)
    : [...data.potatoYieldReports, report];
  return { ...data, potatoYieldReports: updated };
}

export function deletePotatoYield(data: AppData, id: string): AppData {
  return { ...data, potatoYieldReports: data.potatoYieldReports.filter(r => r.id !== id) };
}

// Spray applications
export function saveSprayApplication(data: AppData, app: SprayApplication): AppData {
  const idx = data.sprayApplications.findIndex(a => a.id === app.id);
  const updated = idx >= 0
    ? data.sprayApplications.map(a => a.id === app.id ? app : a)
    : [...data.sprayApplications, app];
  return { ...data, sprayApplications: updated };
}

export function deleteSprayApplication(data: AppData, id: string): AppData {
  return { ...data, sprayApplications: data.sprayApplications.filter(a => a.id !== id) };
}

// Seeding entries
export function saveSeedingEntry(data: AppData, entry: SeedingEntry): AppData {
  const idx = data.seedingEntries.findIndex(e => e.id === entry.id);
  const updated = idx >= 0
    ? data.seedingEntries.map(e => e.id === entry.id ? entry : e)
    : [...data.seedingEntries, entry];
  return { ...data, seedingEntries: updated };
}

export function deleteSeedingEntry(data: AppData, id: string): AppData {
  return { ...data, seedingEntries: data.seedingEntries.filter(e => e.id !== id) };
}

// Seeding plans
export function saveSeedingPlan(data: AppData, plan: SeedingPlan): AppData {
  const idx = data.seedingPlans.findIndex(p => p.id === plan.id);
  const updated = idx >= 0
    ? data.seedingPlans.map(p => p.id === plan.id ? plan : p)
    : [...data.seedingPlans, plan];
  return { ...data, seedingPlans: updated };
}

export function deleteSeedingPlan(data: AppData, id: string): AppData {
  return { ...data, seedingPlans: data.seedingPlans.filter(p => p.id !== id) };
}

// Planter checks
export function savePlanterCheck(data: AppData, check: PlanterCheck): AppData {
  const idx = data.planterChecks.findIndex(entry => entry.id === check.id);
  const updated = idx >= 0
    ? data.planterChecks.map(entry => entry.id === check.id ? check : entry)
    : [...data.planterChecks, check];
  return { ...data, planterChecks: updated };
}

export function deletePlanterCheck(data: AppData, id: string): AppData {
  return { ...data, planterChecks: data.planterChecks.filter(entry => entry.id !== id) };
}

// Tillage reports
export function saveTillageReport(data: AppData, report: TillageReport): AppData {
  const idx = data.tillageReports.findIndex(r => r.id === report.id);
  const updated = idx >= 0
    ? data.tillageReports.map(r => r.id === report.id ? report : r)
    : [...data.tillageReports, report];
  return { ...data, tillageReports: updated };
}

export function deleteTillageReport(data: AppData, id: string): AppData {
  return { ...data, tillageReports: data.tillageReports.filter(r => r.id !== id) };
}

// Harvest reports
export function saveHarvestReport(data: AppData, report: HarvestReport): AppData {
  const idx = data.harvestReports.findIndex(r => r.id === report.id);
  const updated = idx >= 0
    ? data.harvestReports.map(r => r.id === report.id ? report : r)
    : [...data.harvestReports, report];
  return { ...data, harvestReports: updated };
}

export function deleteHarvestReport(data: AppData, id: string): AppData {
  return { ...data, harvestReports: data.harvestReports.filter(r => r.id !== id) };
}

// Potato storage bins
export function savePotatoStorageBin(data: AppData, bin: PotatoStorageBin): AppData {
  const idx = data.potatoStorageBins.findIndex(b => b.id === bin.id);
  const updated = idx >= 0
    ? data.potatoStorageBins.map(b => b.id === bin.id ? bin : b)
    : [...data.potatoStorageBins, bin];
  return { ...data, potatoStorageBins: updated };
}

export function deletePotatoStorageBin(data: AppData, id: string): AppData {
  return { ...data, potatoStorageBins: data.potatoStorageBins.filter(b => b.id !== id) };
}
