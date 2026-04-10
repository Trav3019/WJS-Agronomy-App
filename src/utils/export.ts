import * as XLSX from 'xlsx';
import type { AppData, CropType, SeedingEntry } from '../types';

type OperationKind =
  | 'seeding-plan'
  | 'tillage'
  | 'seeding-record'
  | 'planter-check'
  | 'scouting'
  | 'spray'
  | 'harvest'
  | 'storage'
  | 'potato-yield';

const OPERATION_ORDER: Record<OperationKind, number> = {
  'seeding-plan': 1,
  tillage: 2,
  'seeding-record': 3,
  'planter-check': 4,
  scouting: 5,
  spray: 6,
  harvest: 7,
  storage: 8,
  'potato-yield': 9,
};

const TABLE_GRADE_COLUMNS = [
  { label: '>2"', countKey: 'Count_gt_2in', weightKey: 'Weight_gt_2in_lbs' },
  { label: '2.25"', countKey: 'Count_2_25in', weightKey: 'Weight_2_25in_lbs' },
  { label: '2.5"', countKey: 'Count_2_5in', weightKey: 'Weight_2_5in_lbs' },
  { label: '2.75"', countKey: 'Count_2_75in', weightKey: 'Weight_2_75in_lbs' },
  { label: '3"', countKey: 'Count_3in', weightKey: 'Weight_3in_lbs' },
  { label: '3.25"', countKey: 'Count_3_25in', weightKey: 'Weight_3_25in_lbs' },
  { label: '<3.5"', countKey: 'Count_lt_3_5in', weightKey: 'Weight_lt_3_5in_lbs' },
] as const;

const PROC_GRADE_COLUMNS = [
  { label: '2oz', countKey: 'Count_2oz', weightKey: 'Weight_2oz_lbs' },
  { label: '3oz', countKey: 'Count_3oz', weightKey: 'Weight_3oz_lbs' },
  { label: '4oz', countKey: 'Count_4oz', weightKey: 'Weight_4oz_lbs' },
  { label: '5oz', countKey: 'Count_5oz', weightKey: 'Weight_5oz_lbs' },
  { label: '6oz', countKey: 'Count_6oz', weightKey: 'Weight_6oz_lbs' },
  { label: '7oz', countKey: 'Count_7oz', weightKey: 'Weight_7oz_lbs' },
  { label: '8oz', countKey: 'Count_8oz', weightKey: 'Weight_8oz_lbs' },
  { label: '9oz', countKey: 'Count_9oz', weightKey: 'Weight_9oz_lbs' },
  { label: '10oz', countKey: 'Count_10oz', weightKey: 'Weight_10oz_lbs' },
  { label: '11oz', countKey: 'Count_11oz', weightKey: 'Weight_11oz_lbs' },
  { label: '12oz', countKey: 'Count_12oz', weightKey: 'Weight_12oz_lbs' },
] as const;

function isSeedingPlan(entry: SeedingEntry): boolean {
  return entry.trialTrack?.name === 'Seeding Plan';
}

function downloadJsonFile(filename: string, content: unknown): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function summarizeNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  return notes.trim() || undefined;
}

function getSprayChemicalsForExport(application: {
  chemicals?: Array<{ name: string; rate: string; rateUnit?: string }>;
  product?: string;
  products?: string[];
  rate?: string;
}): Array<{ name: string; rate?: string }> {
  if ((application.chemicals?.length ?? 0) > 0) {
    return (application.chemicals ?? []).map(chemical => ({
      name: chemical.name,
      rate: chemical.rate ? `${chemical.rate}${chemical.rateUnit ? ` ${chemical.rateUnit}` : ''}` : undefined,
    }));
  }

  const legacyProducts = (application.products?.length ?? 0) > 0
    ? application.products ?? []
    : (application.product ? [application.product] : []);

  return legacyProducts.map(name => ({
    name,
    rate: application.rate || undefined,
  }));
}

function buildSprayChemicalColumns(application: {
  chemicals?: Array<{ name: string; rate: string; rateUnit?: string }>;
  product?: string;
  products?: string[];
  rate?: string;
}, maxChemicals: number): Record<string, string | undefined> {
  const chemicals = getSprayChemicalsForExport(application);
  const columns: Record<string, string | undefined> = {};

  for (let index = 0; index < maxChemicals; index += 1) {
    const chemical = chemicals[index];
    const i = index + 1;
    columns[`Chemical${i}`] = chemical?.name;
    columns[`Rate${i}`] = chemical?.rate;
  }

  return columns;
}

function sortFieldNumbers<T extends { fieldNumber?: string | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => (left.fieldNumber ?? '').localeCompare(right.fieldNumber ?? '', undefined, {
    numeric: true,
    sensitivity: 'base',
  }));
}

function sortByDateDesc<T extends { date?: string; seedingDate?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftDate = left.date ?? left.seedingDate ?? '';
    const rightDate = right.date ?? right.seedingDate ?? '';
    return rightDate.localeCompare(leftDate);
  });
}

function sortOperations<T extends { kind: OperationKind; date: string; fieldNumber?: string | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const fieldOrder = (left.fieldNumber ?? '').localeCompare(right.fieldNumber ?? '', undefined, { numeric: true, sensitivity: 'base' });
    if (fieldOrder !== 0) return fieldOrder;
    const operationOrder = OPERATION_ORDER[left.kind] - OPERATION_ORDER[right.kind];
    if (operationOrder !== 0) return operationOrder;
    return right.date.localeCompare(left.date);
  });
}

function createAiExportData(data: AppData) {
  const seedingPlansSource = data.seedingPlans.length > 0 ? data.seedingPlans : data.seedingEntries.filter(isSeedingPlan);
  const seedingPlans = sortFieldNumbers(seedingPlansSource).map(entry => ({
    id: entry.id,
    fieldId: entry.fieldId,
    fieldNumber: entry.fieldNumber,
    cropType: entry.cropType,
    variety: entry.variety,
    seedingDate: entry.seedingDate,
    seedingDirection: entry.seedingDirection,
    chemicalMix: entry.chemicalMix,
    seedingRate: entry.seedingRate,
    rowSpacing: entry.rowSpacing,
    seedDepth: entry.seedDepth,
    population: 'population' in entry ? entry.population : undefined,
    fieldTrials: entry.fieldTrials,
    pinInfo: entry.pinInfo,
    notes: summarizeNotes(entry.notes),
    trackName: entry.trialTrack?.name,
    trackPointCount: entry.trialTrack?.points.length ?? 0,
    pinCount: entry.trialTrack?.pinPoints?.length ?? 0,
  }));

  const seedingRecords = sortFieldNumbers(data.seedingEntries.filter(entry => !isSeedingPlan(entry))).map(entry => ({
    id: entry.id,
    fieldId: entry.fieldId,
    fieldNumber: entry.fieldNumber,
    cropType: entry.cropType,
    variety: entry.variety,
    seedingDate: entry.seedingDate,
    seedingDirection: entry.seedingDirection,
    chemicalMix: entry.chemicalMix,
    fieldTrials: entry.fieldTrials,
    tuberSize: entry.tuberSize,
    tuberTemp: entry.tuberTemp,
    groundTemperature: entry.groundTemperature,
    seedCutDate: entry.seedCutDate,
    seedingRate: entry.seedingRate,
    rowSpacing: entry.rowSpacing,
    seedDepth: entry.seedDepth,
    population: entry.population,
    pinInfo: entry.pinInfo,
    location: entry.location,
    weather: entry.weather,
    trialTrackName: entry.trialTrack?.name,
    trialTrackPointCount: entry.trialTrack?.points.length ?? 0,
    notes: summarizeNotes(entry.notes),
  }));

  const scoutingReports = sortFieldNumbers(data.scoutingReports).map(report => ({
    id: report.id,
    fieldId: report.fieldId,
    fieldNumber: report.fieldNumber,
    cropType: report.cropType,
    variety: report.variety,
    date: report.date,
    priority: report.priority,
    weedsPresent: report.weedsPresent ?? [],
    cropData: report.cropData,
    location: report.location,
    photoCount: report.photos.length,
    sprayRecord: report.sprayRecord,
    trialTrackName: report.trialTrack?.name,
    trialTrackPointCount: report.trialTrack?.points.length ?? 0,
    notes: summarizeNotes(report.notes),
  }));

  const potatoYieldReports = sortFieldNumbers(data.potatoYieldReports).map(report => ({
    id: report.id,
    fieldId: report.fieldId,
    fieldNumber: report.fieldNumber,
    variety: report.variety,
    date: report.date,
    potatoType: report.potatoType,
    grades: report.grades,
    gradeWeights: report.gradeWeights,
    totalTuberCount: report.totalTuberCount,
    totalTuberWeight: report.totalTuberWeight,
    estimatedYield: report.estimatedYield,
    photos: report.photos ?? [],
    photoCount: report.photos?.length ?? 0,
    notes: summarizeNotes(report.notes),
    createdAt: report.createdAt,
  }));

  const planterChecks = sortFieldNumbers(data.planterChecks).map(check => {
    const allRows = (check.checks?.flatMap(pass => pass.rows) ?? check.rows ?? []).filter(row => row.spacingInches !== undefined);
    const avgSpacing = allRows.length > 0
      ? allRows.reduce((sum, row) => sum + (row.spacingInches ?? 0), 0) / allRows.length
      : undefined;
    const avgDoubles = allRows.length > 0
      ? allRows.reduce((sum, row) => sum + (row.doublesCount ?? 0), 0) / allRows.length
      : undefined;
    const avgSkips = allRows.length > 0
      ? allRows.reduce((sum, row) => sum + (row.skipsCount ?? 0), 0) / allRows.length
      : undefined;

    return {
      id: check.id,
      fieldId: check.fieldId,
      fieldNumber: check.fieldNumber,
      variety: check.variety,
      date: check.date,
      planterName: check.planterName,
      targetSpacingInches: check.targetSpacingInches,
      toleranceInches: check.toleranceInches,
      checkCount: check.checks?.length ?? 0,
      rowCount: allRows.length,
      avgSpacingInches: avgSpacing,
      avgDoubles: avgDoubles,
      avgSkips: avgSkips,
      notes: summarizeNotes(check.notes),
      rowsJson: JSON.stringify(check.checks?.length ? check.checks : (check.rows ?? [])),
      createdAt: check.createdAt,
    };
  });

  const operationsTimeline = sortOperations([
    ...data.seedingEntries.filter(isSeedingPlan).map(entry => ({
      kind: 'seeding-plan' as const,
      id: entry.id,
      date: entry.seedingDate,
      fieldId: entry.fieldId,
      fieldNumber: entry.fieldNumber,
      cropType: entry.cropType,
      summary: `${entry.cropType}${entry.variety ? ` - ${entry.variety}` : ''}`,
    })),
    ...data.tillageReports.map(report => ({
      kind: 'tillage' as const,
      id: report.id,
      date: report.date,
      fieldId: report.fieldId,
      fieldNumber: report.fieldNumber,
      cropType: data.fields.find(field => field.id === report.fieldId)?.cropType,
      summary: `${report.method}${report.depthInches !== undefined ? ` (${report.depthInches} in)` : ''}`,
    })),
    ...data.seedingEntries.filter(entry => !isSeedingPlan(entry)).map(entry => ({
      kind: 'seeding-record' as const,
      id: entry.id,
      date: entry.seedingDate,
      fieldId: entry.fieldId,
      fieldNumber: entry.fieldNumber,
      cropType: entry.cropType,
      summary: `${entry.cropType}${entry.variety ? ` - ${entry.variety}` : ''}`,
    })),
    ...planterChecks.map(check => ({
      kind: 'planter-check' as const,
      id: check.id,
      date: check.date,
      fieldId: check.fieldId,
      fieldNumber: check.fieldNumber,
      cropType: 'Potatoes' as CropType,
      summary: `${check.planterName}${check.variety ? ` - ${check.variety}` : ''}`,
    })),
    ...data.scoutingReports.map(report => ({
      kind: 'scouting' as const,
      id: report.id,
      date: report.date,
      fieldId: report.fieldId,
      fieldNumber: report.fieldNumber,
      cropType: report.cropType,
      summary: `${report.cropType} scouting (${report.priority})`,
    })),
    ...data.sprayApplications.map(report => ({
      kind: 'spray' as const,
      id: report.id,
      date: report.appliedDate || report.plannedDate,
      fieldId: report.fieldIds[0] ?? null,
      fieldNumber: report.fieldNumbers[0] ?? null,
      cropType: null as CropType | null,
      summary: report.product || report.products?.join(', ') || 'Spray application',
    })),
    ...data.harvestReports.filter(report => !report.binNumber).map(report => ({
      kind: 'harvest' as const,
      id: report.id,
      date: report.date,
      fieldId: report.fieldId,
      fieldNumber: report.fieldNumber,
      cropType: report.cropType,
      summary: `${report.cropType}${report.yieldValue !== undefined ? ` - ${report.yieldValue} ${report.yieldUnit ?? ''}` : ''}`.trim(),
    })),
    ...data.harvestReports.filter(report => !!report.binNumber).map(report => ({
      kind: 'storage' as const,
      id: report.id,
      date: report.date,
      fieldId: report.fieldId,
      fieldNumber: report.fieldNumber,
      cropType: report.cropType,
      summary: `Bin ${report.binNumber}${report.totalCwt !== undefined ? ` - ${report.totalCwt} cwt` : ''}`,
    })),
    ...data.potatoYieldReports.map(report => ({
      kind: 'potato-yield' as const,
      id: report.id,
      date: report.date,
      fieldId: report.fieldId,
      fieldNumber: report.fieldNumber,
      cropType: 'Potatoes' as CropType,
      summary: `${report.estimatedYield.toFixed(1)} cwt/ac`,
    })),
  ]);

  const fields = sortFieldNumbers(data.fields).map(field => ({
    ...field,
    operations: {
      seedingPlans: sortByDateDesc(seedingPlans.filter(entry => entry.fieldId === field.id)),
      tillage: sortByDateDesc(data.tillageReports.filter(report => report.fieldId === field.id)),
      seedingRecords: sortByDateDesc(seedingRecords.filter(entry => entry.fieldId === field.id)),
      scouting: sortByDateDesc(scoutingReports.filter(report => report.fieldId === field.id)),
      spraying: sortByDateDesc(data.sprayApplications.filter(report => report.fieldIds.includes(field.id) || report.fieldNumbers.includes(field.fieldNumber)).map(report => ({
        id: report.id,
        fieldIds: report.fieldIds,
        fieldNumbers: report.fieldNumbers,
        date: report.appliedDate || report.plannedDate,
        status: report.status,
        priority: report.priority,
        product: report.product,
        products: report.products,
        chemicals: report.chemicals,
        activeIngredient: report.activeIngredient,
        rate: report.rate,
        waterVolume: report.waterVolume,
        targetPest: report.targetPest,
        applicationMethod: report.applicationMethod,
        sprayer: report.sprayer,
        operator: report.operator,
        weatherAtApplication: report.weatherAtApplication,
        notes: summarizeNotes(report.notes),
      }))),
      planterChecks: sortByDateDesc(planterChecks.filter(check => check.fieldId === field.id)),
      harvest: sortByDateDesc(data.harvestReports.filter(report => report.fieldId === field.id && !report.binNumber)),
      storage: sortByDateDesc(data.harvestReports.filter(report => report.fieldId === field.id && !!report.binNumber)),
      potatoYield: sortByDateDesc(potatoYieldReports.filter(report => report.fieldId === field.id)),
    },
  }));

  return {
    exportedAt: new Date().toISOString(),
    summary: {
      fieldCount: data.fields.length,
      scoutingReportCount: data.scoutingReports.length,
      sprayApplicationCount: data.sprayApplications.length,
      seedingPlanCount: seedingPlans.length,
      seedingRecordCount: seedingRecords.length,
      tillageReportCount: data.tillageReports.length,
      planterCheckCount: data.planterChecks.length,
      harvestReportCount: data.harvestReports.length,
      potatoYieldReportCount: data.potatoYieldReports.length,
      storageBinCount: data.potatoStorageBins.length,
    },
    fields,
    seedingPlans,
    seedingRecords,
    tillageReports: sortFieldNumbers(data.tillageReports),
    scoutingReports,
    sprayApplications: sortFieldNumbers(data.sprayApplications.map(report => ({
      ...report,
      fieldNumber: report.fieldNumbers[0] ?? null,
    }))),
    planterChecks,
    harvestReports: sortFieldNumbers(data.harvestReports),
    potatoYieldReports,
    storageBins: sortFieldNumbers(data.potatoStorageBins.map(bin => ({ ...bin, fieldNumber: bin.fieldNumber ?? null }))),
    operationsTimeline,
  };
}

function exportWorkbook(filename: string, sheets: Record<string, unknown[]>): void {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName, rows]) => {
    const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ empty: '' }]);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  });
  XLSX.writeFile(workbook, filename);
}

export function exportFullDataJson(data: AppData): void {
  downloadJsonFile(`wjs-agronomy-full-export-${new Date().toISOString().slice(0, 10)}.json`, {
    exportedAt: new Date().toISOString(),
    data,
  });
}

export function exportAiDataJson(data: AppData): void {
  const exportData = createAiExportData(data);
  downloadJsonFile(`wjs-agronomy-ai-export-${new Date().toISOString().slice(0, 10)}.json`, exportData);
}

export function exportExcelData(data: AppData): void {
  const exportData = createAiExportData(data);
  const maxSprayChemicals = exportData.sprayApplications.reduce((maxCount, application) => {
    const chemicalCount = getSprayChemicalsForExport(application).length;
    return Math.max(maxCount, chemicalCount);
  }, 0);
  const fieldSummaryRowsRaw = [
    ...exportData.seedingPlans.map(item => ({
      kind: 'seeding-plan' as const,
      date: item.seedingDate,
      FieldNumber: item.fieldNumber,
      Operation: 'Seeding Plan',
      Date: item.seedingDate,
      CropType: item.cropType,
      Variety: item.variety,
      SeedingDirection: item.seedingDirection,
      SeedingRate: item.seedingRate,
      RowSpacingInches: item.rowSpacing,
      SeedDepthInches: item.seedDepth,
      Population: item.population,
      ChemicalMix: item.chemicalMix,
      FieldTrials: item.fieldTrials,
      PinInfo: item.pinInfo,
      TrackName: item.trackName,
      TrackPointCount: item.trackPointCount,
      PinCount: item.pinCount,
      Notes: item.notes,
    })),
    ...exportData.tillageReports.map(item => ({
      kind: 'tillage' as const,
      date: item.date,
      FieldNumber: item.fieldNumber,
      Operation: 'Tillage',
      Date: item.date,
      Method: item.method,
      DepthInches: item.depthInches,
      Notes: item.notes,
    })),
    ...exportData.seedingRecords.map(item => ({
      kind: 'seeding-record' as const,
      date: item.seedingDate,
      FieldNumber: item.fieldNumber,
      Operation: 'Seeding Record',
      Date: item.seedingDate,
      CropType: item.cropType,
      Variety: item.variety,
      SeedingDirection: item.seedingDirection,
      SeedingRate: item.seedingRate,
      RowSpacingInches: item.rowSpacing,
      SeedDepthInches: item.seedDepth,
      Population: item.population,
      TuberSize: item.tuberSize,
      TuberTempC: item.tuberTemp,
      GroundTempC: item.groundTemperature,
      SeedCutDate: item.seedCutDate,
      ChemicalMix: item.chemicalMix,
      FieldTrials: item.fieldTrials,
      PinInfo: item.pinInfo,
      Notes: item.notes,
    })),
    ...exportData.scoutingReports.map(item => ({
      kind: 'scouting' as const,
      date: item.date,
      FieldNumber: item.fieldNumber,
      Operation: 'Scouting',
      Date: item.date,
      CropType: item.cropType,
      Variety: item.variety,
      Priority: item.priority,
      WeedsPresent: item.weedsPresent.join(', '),
      TrialTrackName: item.trialTrackName,
      TrialTrackPointCount: item.trialTrackPointCount,
      PhotoCount: item.photoCount,
      CropDataJson: JSON.stringify(item.cropData),
      Notes: item.notes,
    })),
    ...exportData.sprayApplications.map(item => ({
      kind: 'spray' as const,
      date: item.appliedDate || item.plannedDate,
      FieldNumber: item.fieldNumbers[0] ?? '',
      Operation: 'Spraying',
      Date: item.appliedDate || item.plannedDate,
      FieldNumbers: item.fieldNumbers.join(', '),
      Status: item.status,
      Priority: item.priority,
      ...buildSprayChemicalColumns(item, maxSprayChemicals),
      ActiveIngredient: item.activeIngredient,
      Rate: item.rate,
      WaterVolume: item.waterVolume,
      TargetPest: item.targetPest,
      ApplicationMethod: item.applicationMethod,
      Sprayer: item.sprayer,
      Operator: item.operator,
      WeatherAtApplication: item.weatherAtApplication,
      Notes: item.notes,
    })),
    ...exportData.planterChecks.map(item => ({
      kind: 'planter-check' as const,
      date: item.date,
      FieldNumber: item.fieldNumber,
      Operation: 'Planter Check',
      Date: item.date,
      Variety: item.variety,
      PlanterName: item.planterName,
      TargetSpacingInches: item.targetSpacingInches,
      ToleranceInches: item.toleranceInches,
      CheckCount: item.checkCount,
      RowCount: item.rowCount,
      AvgSpacingInches: item.avgSpacingInches,
      AvgDoubles: item.avgDoubles,
      AvgSkips: item.avgSkips,
      Notes: item.notes,
    })),
    ...exportData.harvestReports.filter(item => !item.binNumber).map(item => ({
      kind: 'harvest' as const,
      date: item.date,
      FieldNumber: item.fieldNumber,
      Operation: 'Harvest',
      Date: item.date,
      CropType: item.cropType,
      Variety: item.variety,
      YieldValue: item.yieldValue,
      YieldUnit: item.yieldUnit,
      TotalCwt: item.totalCwt,
      Moisture: item.moisture,
      Quality: item.quality,
      TuberTempC: item.tuberTemp,
      TuberDefects: item.tuberDefects?.join(', '),
      Notes: item.notes,
    })),
    ...exportData.harvestReports.filter(item => !!item.binNumber).map(item => ({
      kind: 'storage' as const,
      date: item.date,
      FieldNumber: item.fieldNumber,
      Operation: 'Storage',
      Date: item.date,
      CropType: item.cropType,
      Variety: item.variety,
      BinNumber: item.binNumber,
      TotalCwt: item.totalCwt,
      Quality: item.quality,
      TuberTempC: item.tuberTemp,
      TuberDefects: item.tuberDefects?.join(', '),
      Notes: item.notes,
    })),
    ...exportData.potatoYieldReports.map(item => {
      const sizeBreakdown = Object.fromEntries(
        [...TABLE_GRADE_COLUMNS, ...PROC_GRADE_COLUMNS].flatMap(grade => [
          [grade.countKey, item.grades[grade.label] ?? 0],
          [grade.weightKey, item.gradeWeights[grade.label] ?? 0],
        ])
      );

      return {
        kind: 'potato-yield' as const,
        date: item.date,
        FieldNumber: item.fieldNumber,
        Operation: 'Potato Yield',
        Date: item.date,
        Variety: item.variety,
        PotatoType: item.potatoType,
        TotalTuberCount: item.totalTuberCount,
        TotalTuberWeight: item.totalTuberWeight,
        EstimatedYield: item.estimatedYield,
        PhotosCount: item.photoCount,
        Notes: item.notes,
        ...sizeBreakdown,
      };
    }),
  ];

  const fieldSummaryRows = sortOperations(fieldSummaryRowsRaw).map(({ kind: _, date: __, ...row }) => row);

  exportWorkbook(`wjs-agronomy-export-${new Date().toISOString().slice(0, 10)}.xlsx`, {
    Summary: [exportData.summary],
    Fields: exportData.fields.map(field => ({
      FieldNumber: field.fieldNumber,
      CropType: field.cropType,
      Variety: field.variety,
      Acres: field.acres,
      Priority: field.priority,
      Notes: field.notes,
    })),
    FieldSummary: fieldSummaryRows,
    SeedingPlans: exportData.seedingPlans.map(item => ({
      FieldNumber: item.fieldNumber,
      CropType: item.cropType,
      Variety: item.variety,
      SeedingDate: item.seedingDate,
      SeedingDirection: item.seedingDirection,
      SeedingRate: item.seedingRate,
      RowSpacing: item.rowSpacing,
      SeedDepth: item.seedDepth,
      Population: item.population,
      ChemicalMix: item.chemicalMix,
      FieldTrials: item.fieldTrials,
      PinInfo: item.pinInfo,
      TrackName: item.trackName,
      TrackPointCount: item.trackPointCount,
      PinCount: item.pinCount,
      Notes: item.notes,
    })),
    SeedingRecords: exportData.seedingRecords.map(item => ({
      FieldNumber: item.fieldNumber,
      CropType: item.cropType,
      Variety: item.variety,
      SeedingDate: item.seedingDate,
      Direction: item.seedingDirection,
      SeedingRate: item.seedingRate,
      Population: item.population,
      RowSpacing: item.rowSpacing,
      SeedDepth: item.seedDepth,
      ChemicalMix: item.chemicalMix,
      FieldTrials: item.fieldTrials,
      Notes: item.notes,
    })),
    Tillage: exportData.tillageReports.map(item => ({
      FieldNumber: item.fieldNumber,
      Date: item.date,
      Method: item.method,
      DepthInches: item.depthInches,
      Notes: item.notes,
    })),
    Scouting: exportData.scoutingReports.map(item => ({
      FieldNumber: item.fieldNumber,
      CropType: item.cropType,
      Variety: item.variety,
      Date: item.date,
      Priority: item.priority,
      WeedsPresent: item.weedsPresent.join(', '),
      TrialTrackName: item.trialTrackName,
      TrialTrackPointCount: item.trialTrackPointCount,
      PhotoCount: item.photoCount,
      Notes: item.notes,
    })),
    Spraying: exportData.sprayApplications.map(item => ({
      FieldNumbers: item.fieldNumbers.join(', '),
      PlannedDate: item.plannedDate,
      AppliedDate: item.appliedDate,
      Status: item.status,
      Priority: item.priority,
      ...buildSprayChemicalColumns(item, maxSprayChemicals),
      ApplicationMethod: item.applicationMethod,
      TargetPest: item.targetPest,
      WaterVolume: item.waterVolume,
      Notes: item.notes,
    })),
    PlanterChecks: exportData.planterChecks.map(item => ({
      FieldNumber: item.fieldNumber,
      Date: item.date,
      Variety: item.variety,
      PlanterName: item.planterName,
      TargetSpacingInches: item.targetSpacingInches,
      ToleranceInches: item.toleranceInches,
      CheckCount: item.checkCount,
      RowCount: item.rowCount,
      AvgSpacingInches: item.avgSpacingInches,
      AvgDoubles: item.avgDoubles,
      AvgSkips: item.avgSkips,
      Notes: item.notes,
      RowsJson: item.rowsJson,
      CreatedAt: item.createdAt,
    })),
    Harvest: exportData.harvestReports.map(item => ({
      FieldNumber: item.fieldNumber,
      CropType: item.cropType,
      Variety: item.variety,
      Date: item.date,
      YieldValue: item.yieldValue,
      YieldUnit: item.yieldUnit,
      TotalCwt: item.totalCwt,
      Moisture: item.moisture,
      Quality: item.quality,
      BinNumber: item.binNumber,
      TuberTemp: item.tuberTemp,
      TuberDefects: item.tuberDefects?.join(', '),
      Notes: item.notes,
    })),
    PotatoYield: exportData.potatoYieldReports.map(item => {
      const sizeBreakdown = Object.fromEntries(
        [...TABLE_GRADE_COLUMNS, ...PROC_GRADE_COLUMNS].flatMap(grade => [
          [grade.countKey, item.grades[grade.label] ?? 0],
          [grade.weightKey, item.gradeWeights[grade.label] ?? 0],
        ])
      );

      return {
        Id: item.id,
        FieldId: item.fieldId,
        FieldNumber: item.fieldNumber,
        Variety: item.variety,
        Date: item.date,
        PotatoType: item.potatoType,
        TotalTuberCount: item.totalTuberCount,
        TotalTuberWeight: item.totalTuberWeight,
        EstimatedYield: item.estimatedYield,
        PhotosCount: item.photoCount,
        Notes: item.notes,
        CreatedAt: item.createdAt,
        ...sizeBreakdown,
      };
    }),
    StorageBins: exportData.storageBins.map(item => ({
      BinNumber: item.binNumber,
      FieldNumber: item.fieldNumber,
      Variety: item.variety,
      QuantityCwt: item.quantityCwt,
      StorageTempC: item.storageTempC,
      Status: item.status,
      Notes: item.notes,
    })),
  });
}