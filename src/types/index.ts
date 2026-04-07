export type CropType = 'Corn' | 'Canola' | 'Soybeans' | 'Wheat' | 'Edible Beans' | 'Oats' | 'Potatoes';

export type Priority = 'high' | 'medium' | 'low';

export type PotatoType = 'table' | 'processing';

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface WeatherData {
  temperature: number;
  temperatureMin?: number;
  temperatureMax?: number;
  precipitation: number;
  windSpeed: number;
  humidity?: number;
  weatherCode?: number;
  weatherDescription?: string;
  date?: string;
}

export interface Field {
  id: string;
  fieldNumber: string;
  cropType: CropType;
  variety: string;
  acres: number;
  priority: Priority;
  notes?: string;
  location?: GeoLocation;
  createdAt: string;
  updatedAt: string;
}

export interface ScoutingReport {
  id: string;
  fieldId: string;
  fieldNumber: string;
  cropType: CropType;
  variety: string;
  date: string;
  location?: GeoLocation;
  photos: string[]; // base64 data URLs
  weedsPresent?: string[];
  priority: Priority;
  notes: string;
  trialTrack?: ScoutingTrialTrack;
  sprayApplicationId?: string;
  sprayRecord?: ScoutingSprayRecord;
  cropData: CornScoutData | CanolaScoutData | SoyScoutData | WheatScoutData | EdibleBeanScoutData | OatsScoutData | PotatoScoutData;
  createdAt: string;
}

export interface ScoutingTrialTrack {
  name: string;
  points: GeoLocation[];
  closedShape?: boolean;
  pinPoints?: GeoLocation[];
  pinLabels?: string[];
}

export interface ScoutingSprayRecord {
  chemicals: SprayChemical[];
  applicationMethod: string;
  waterVolume?: string;
  notes?: string;
}

export interface CornScoutData {
  crop: 'Corn';
  plantStand: number; // plants/acre
  growthStage: string;
  rootwormFeeding: number; // 0-10 scale
  cornBorer: number; // larvae/plant
  aphids: number; // aphids/plant
  grayLeafSpot: boolean;
  northernLeafBlight: boolean;
  commonRust: boolean;
  earMolds: boolean;
  nitrogeneStress: boolean;
  compaction: boolean;
  weedPressure: string; // none/low/medium/high
  additionalPests: string;
}

export interface CanolaScoutData {
  crop: 'Canola';
  plantStand: number;
  growthStage: string;
  fleaBeetleFeeding: number; // 0-10 scale
  sclerotinia: boolean;
  blackleg: boolean;
  clubroot: boolean;
  swede: boolean;
  aphids: number;
  bertha: number; // larvae/sqm
  weedPressure: string;
  podShatter: boolean;
  additionalPests: string;
}

export interface SoyScoutData {
  crop: 'Soybeans';
  plantStand: number;
  growthStage: string;
  aphids: number; // aphids/plant
  spiderMites: boolean;
  scn: boolean; // soybean cyst nematode
  whiteMold: boolean;
  suddenDeathSyndrome: boolean;
  frogeye: boolean;
  stemCanker: boolean;
  weedPressure: string;
  podDamage: number; // %
  additionalPests: string;
}

export interface WheatScoutData {
  crop: 'Wheat';
  plantStand: number;
  growthStage: string;
  fusariumHead: boolean;
  leafRust: boolean;
  stemRust: boolean;
  stripeRust: boolean;
  powderyMildew: boolean;
  tanSpot: boolean;
  aphids: number;
  hessianFly: boolean;
  weedPressure: string;
  lodging: boolean;
  additionalPests: string;
}

export interface EdibleBeanScoutData {
  crop: 'Edible Beans';
  plantStand: number;
  growthStage: string;
  beanLeafBeetle: number; // % defoliation
  mexicanBeanBeetle: boolean;
  aphids: number;
  whiteMold: boolean;
  anthracnose: boolean;
  bacterialBlight: boolean;
  weedPressure: string;
  podFill: string; // poor/fair/good
  additionalPests: string;
}

export interface OatsScoutData {
  crop: 'Oats';
  plantStand: number;
  growthStage: string;
  crownRust: boolean;
  stemRust: boolean;
  barleyYellowDwarf: boolean;
  aphids: number;
  thrips: boolean;
  weedPressure: string;
  lodging: boolean;
  headSmut: boolean;
  additionalPests: string;
}

export interface PotatoScoutData {
  crop: 'Potatoes';
  plantStand: number;
  growthStage: string;
  avgStemsPerPlant: number;
  avgTubersPerStem: number;
  seedRot: number; // % plants affected
  coloradoPotatoBeetle: number; // larvae/plant
  cpbGrowthStage?: string;
  aphids: number; // aphids/leaf
  wirewormDamage: boolean;
  potatoLeafhopper: boolean;
  earlyBlight: boolean;
  lateBlight: boolean;
  verticilliumWilt: boolean;
  commonScab: boolean;
  rhizoctoniaStemCanker: boolean;
  blackScurf: boolean;
  pinkRot: boolean;
  pythiumLeak: boolean;
  fusariumDryRot: boolean;
  silverScurf: boolean;
  blackleg: number; // % plants affected
  virusSymptoms: boolean;
  weedPressure: string;
  irrigationStatus?: string;
  soilMoisture?: string; // dry/adequate/saturated
  additionalPests: string;
}

// Table potato grades: > 2", 2.25", 2.5", 2.75", 3", 3.25", < 3.5"
export type TablePotatoGrade = '>2"' | '2.25"' | '2.5"' | '2.75"' | '3"' | '3.25"' | '<3.5"';

// Processing potato grades: 2oz to 12oz
export type ProcessingPotatoGrade = '2oz' | '3oz' | '4oz' | '5oz' | '6oz' | '7oz' | '8oz' | '9oz' | '10oz' | '11oz' | '12oz';

export interface PotatoYieldReport {
  id: string;
  fieldId: string;
  fieldNumber: string;
  variety: string;
  date: string;
  potatoType: PotatoType;
  grades: Record<string, number>; // grade: count
  gradeWeights: Record<string, number>; // grade: weight in lbs
  totalTuberCount: number;
  totalTuberWeight: number; // lbs per 100 sq ft sample
  estimatedYield: number; // cwt/acre (calculated)
  photos?: string[];
  notes: string;
  createdAt: string;
}

export interface SprayChemical {
  name: string;
  rate: string; // in litres
}

export interface SprayApplication {
  id: string;
  fieldIds: string[];
  fieldNumbers: string[];
  plannedDate: string;
  appliedDate?: string;
  product: string; // legacy field; kept for backward compatibility
  products?: string[]; // legacy multi-product list
  chemicals?: SprayChemical[]; // new: each chemical with its own rate
  activeIngredient?: string;
  rate: string;
  waterVolume?: string;
  targetPest: string;
  applicationMethod: string;
  sprayer?: string;
  operator?: string;
  status: 'planned' | 'applied' | 'cancelled';
  priority: Priority;
  weatherAtApplication?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeedingEntry {
  id: string;
  fieldId: string;
  fieldNumber: string;
  cropType: CropType;
  variety: string;
  seedingDate: string;
  seedingDirection?: 'North-South' | 'East-West';
  chemicalMix?: string;
  fieldTrials?: string;
  tuberSize?: string;
  tuberTemp?: number;
  groundTemperature?: number;
  seedCutDate?: string;
  seedingRate: number; // seeds/acre
  seedingRateCwtAc?: number; // cwt/acre (for potatoes)
  rowSpacing?: number; // inches
  seedDepth?: number; // inches
  population?: number; // seeds/acre
  location: GeoLocation;
  pinInfo?: string;
  weather?: WeatherData;
  trialTrack?: ScoutingTrialTrack;
  notes: string;
  createdAt: string;
}

export interface TillageReport {
  id: string;
  fieldId: string;
  fieldNumber: string;
  date: string;
  method: string;
  depthInches?: number;
  notes?: string;
  createdAt: string;
}

export interface HarvestReport {
  id: string;
  fieldId: string;
  fieldNumber: string;
  cropType: CropType;
  variety?: string;
  date: string;
  yieldValue?: number;
  totalCwt?: number;
  yieldUnit?: string;
  moisture?: number;
  binNumber?: string;
  quality?: string;
  tuberDefects?: string[];
  tuberTemp?: number;
  weatherData?: string;
  notes?: string;
  createdAt: string;
}

export interface PotatoStorageBin {
  id: string;
  binNumber: string;
  fieldNumber?: string;
  variety?: string;
  quantityCwt?: number;
  storageTempC?: number;
  status?: 'Good' | 'Monitor' | 'Issue';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  fields: Field[];
  scoutingReports: ScoutingReport[];
  potatoYieldReports: PotatoYieldReport[];
  sprayApplications: SprayApplication[];
  seedingEntries: SeedingEntry[];
  tillageReports: TillageReport[];
  harvestReports: HarvestReport[];
  potatoStorageBins: PotatoStorageBin[];
  customBins: string[];
  customBinCapacities: Record<string, number>;
}
