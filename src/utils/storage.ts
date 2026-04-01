import type { AppData, Field, ScoutingReport, PotatoYieldReport, SprayApplication, SeedingEntry, TillageReport, HarvestReport, PotatoStorageBin } from '../types';

const STORAGE_KEY = 'wjs-agronomy-data';

const defaultData: AppData = {
  fields: [],
  scoutingReports: [],
  potatoYieldReports: [],
  sprayApplications: [],
  seedingEntries: [],
  tillageReports: [],
  harvestReports: [],
  potatoStorageBins: [],
  customBins: [],
  customBinCapacities: {},
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw);
    return { ...defaultData, ...parsed };
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  return { ...data, fields: data.fields.filter(f => f.id !== id) };
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
