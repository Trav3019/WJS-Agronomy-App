import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import type {
  AppData, ScoutingReport, CropType, Priority, GeoLocation,
  CornScoutData, CanolaScoutData, SoyScoutData, WheatScoutData,
  EdibleBeanScoutData, OatsScoutData, PotatoScoutData
} from '../types';
import { generateId, saveScoutingReport, deleteScoutingReport, saveSprayApplication, deleteSprayApplication } from '../utils/storage';
import PhotoCapture from '../components/PhotoCapture';
import { VARIETIES_BY_CROP } from '../utils/varieties';
import {
  Plus, X, Trash2, ChevronDown, ChevronRight, MapPin, Image, Eye, Filter
} from 'lucide-react';

const GeoMap = lazy(() => import('../components/GeoMap'));

const CROPS: CropType[] = ['Wheat', 'Oats', 'Canola', 'Potatoes', 'Corn', 'Soybeans', 'Edible Beans'];
const CROP_ORDER: Record<CropType, number> = {
  Wheat: 0,
  Oats: 1,
  Canola: 2,
  Potatoes: 3,
  Corn: 4,
  Soybeans: 5,
  'Edible Beans': 6,
};
const SPRAY_METHODS = ['Ground Sprayer', 'Air (Aircraft)', 'High-Clearance Sprayer', 'Backpack Sprayer', 'Drone'];
const PRODUCT_OPTIONS = [
  'LI 700',
  'GLYPHOSATE',
  'DESICA',
  'INTERLOCK',
  'MANIPULATOR',
  'RAXIL',
  '2-4,D',
  'AATREX',
  'ALLEGRO',
  'AXIAL EXTREME',
  'BASAGRAN FORTE',
  'BRAVO',
  'EDGE',
  'EPTAM',
  'GLUFOSINATE',
  'GROUP 1',
  'HEAT/GENERIC',
  'HI ACTIVATE',
  'HINGE',
  'IMPACT',
  'KOMODO',
  'MANZATE MAX',
  'MIAVIS DUO',
  'MINECTO',
  'MOVENTO',
  'MSO',
  'ON-DECK',
  'ORANDIS',
  'OUTSHINE/FORCE FIGHTER',
  'PROLINE GOLD',
  'PROLINE/GOLD',
  'PROSARO/PRO',
  'PYTHON/VIPER',
  'QUAD TOP',
  'REFLEX',
  'Roundup WeatherMax',
  'Round up Extend',
  'Liberty 280',
  'Glyphosate 4L',
  '2,4-D Amine',
  'Atrazine 500',
  'Dicamba 2,4-D',
  'Metribuzin 75DF',
  'Sharpen 2.7',
  'Assure II',
  'Select Max',
  'Tebuconazole',
  'TRICOR',
  'UPTAKE',
];
const CROP_PRODUCT_OPTIONS: Record<CropType, string[]> = {
  Corn: [
    'LI 700', 'GLYPHOSATE', 'Roundup WeatherMax', 'Round up Extend', 'Glyphosate 4L',
    'AATREX', 'Atrazine 500', 'Dicamba 2,4-D', '2,4-D Amine', 'HEAT/GENERIC', 'Sharpen 2.7',
    'GLUFOSINATE', 'Liberty 280', 'INTERLOCK', 'MSO', 'UPTAKE', 'HI ACTIVATE'
  ],
  Canola: [
    'LI 700', 'GLYPHOSATE', 'Roundup WeatherMax', 'Glyphosate 4L', 'GLUFOSINATE', 'Liberty 280',
    'HEAT/GENERIC', 'Sharpen 2.7', 'Assure II', 'Select Max', 'PROLINE GOLD', 'PROLINE/GOLD',
    'INTERLOCK', 'MSO', 'UPTAKE', 'HI ACTIVATE'
  ],
  Soybeans: [
    'LI 700', 'GLYPHOSATE', 'Roundup WeatherMax', 'Round up Extend', 'Glyphosate 4L',
    'Dicamba 2,4-D', '2,4-D Amine', 'GLUFOSINATE', 'Liberty 280', 'HEAT/GENERIC', 'Sharpen 2.7',
    'REFLEX', 'Assure II', 'Select Max', 'INTERLOCK', 'MSO', 'UPTAKE', 'HI ACTIVATE'
  ],
  Wheat: [
    'LI 700', 'GLYPHOSATE', 'Roundup WeatherMax', 'Glyphosate 4L', '2,4-D Amine',
    'AXIAL EXTREME', 'GROUP 1', 'PROSARO/PRO', 'Tebuconazole', 'INTERLOCK', 'MSO', 'UPTAKE', 'RAXIL'
  ],
  'Edible Beans': [
    'LI 700', 'GLYPHOSATE', 'Roundup WeatherMax', 'Glyphosate 4L', 'BASAGRAN FORTE',
    'Assure II', 'Select Max', 'REFLEX', 'HEAT/GENERIC', 'Sharpen 2.7', 'INTERLOCK', 'MSO', 'UPTAKE'
  ],
  Oats: [
    'LI 700', 'GLYPHOSATE', 'Roundup WeatherMax', 'Glyphosate 4L', '2,4-D Amine',
    'AXIAL EXTREME', 'GROUP 1', 'Tebuconazole', 'INTERLOCK', 'MSO', 'UPTAKE'
  ],
  Potatoes: [
    'LI 700', 'GLYPHOSATE', 'Roundup WeatherMax', 'Glyphosate 4L', 'HEAT/GENERIC', 'Sharpen 2.7',
    'EPTAM', 'Metribuzin 75DF', 'REFLEX', 'TRICOR', 'EDGE', 'Assure II', 'Select Max',
    'BRAVO', 'ALLEGRO', 'ORANDIS', 'QUAD TOP', 'MANZATE MAX', 'MINECTO', 'MOVENTO',
    'KOMODO', 'PYTHON/VIPER', 'MIAVIS DUO', 'PROLINE/GOLD', 'PROLINE GOLD',
    'INTERLOCK', 'MSO', 'UPTAKE', 'HI ACTIVATE'
  ],
};
const WEED_OPTIONS = ['Wild Oats', 'Kochia', 'Pigweed', 'Lambsquarters', 'Foxtail', 'Volunteer Canola', 'Thistle', 'Ragweed', 'Cleavers', 'Buckwheat', 'Nightshade'];
const GROWTH_STAGE_OPTIONS_BY_CROP: Record<CropType, string[]> = {
  Corn: ['emergence', 'v2', 'v4', 'v6', 'tassel', 'silk', 'maturity'],
  Canola: ['emergence', 'rosette', 'bolting', 'flowering', 'pod set', 'maturity'],
  Soybeans: ['emergence', 'v2', 'v4', 'flowering', 'pod set', 'maturity'],
  Wheat: ['emergence', 'tillering', 'boot', 'heading', 'flowering', 'maturity'],
  'Edible Beans': ['emergence', 'v2', 'v4', 'flowering', 'pod set', 'maturity'],
  Oats: ['emergence', 'tillering', 'boot', 'heading', 'flowering', 'maturity'],
  Potatoes: ['emergence', 'vegetative', 'tuber initiation', 'tuber bulking', 'maturity'],
};
const CPB_GROWTH_STAGES = ['egg mass', '1st instar', '2nd instar', '3rd instar', '4th instar', 'adult'];
const IRRIGATION_STATUS_OPTIONS = ['off', 'running', 'intermittent', 'completed', 'not needed'];

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

function priorityBadge(p: Priority) {
  const cls = p === 'high' ? 'priority-high' : p === 'medium' ? 'priority-medium' : 'priority-low';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>{p}</span>;
}

function shouldShowAphidField(growthStage?: string) {
  if (!growthStage) return false;
  const s = growthStage.toLowerCase().trim();
  if (!s) return false;

  // Early growth where aphid pressure checks are typically not primary.
  if (/emerg|seed|cotyledon|v\d|ve|vc|tillering|boot/i.test(s)) return false;

  return /(r\d|flower|flowering|heading|tassel|silk|pod|reproductive|tuber|bulking)/i.test(s);
}

function toDisplayLabel(value: string): string {
  const spaced = value.replace(/([A-Z])/g, ' $1').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : spaced;
}

function toDisplayValue(value: unknown): string {
  if (typeof value !== 'string') return String(value);
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function SeasonSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">{title}</h4>
      {children}
    </div>
  );
}

// ── Crop-specific form sections ──────────────────────────────────────────────

function CornForm({ data, onChange, weedsPresent, onToggleWeed }: { data: Partial<CornScoutData>; onChange: (d: Partial<CornScoutData>) => void; weedsPresent: string[]; onToggleWeed: (weed: string, checked: boolean) => void }) {
  const set = (k: keyof CornScoutData, v: any) => onChange({ ...data, [k]: v });
  const showAphids = shouldShowAphidField(data.growthStage);
  return (
    <div className="space-y-3">
      <SeasonSection title="Early Season">
        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Growth Stage" value={data.growthStage} onChange={v => set('growthStage', v)} opts={GROWTH_STAGE_OPTIONS_BY_CROP.Corn} />
          <FormNum label="Plant Stand (plants/ac)" value={data.plantStand} onChange={v => set('plantStand', v)} />
          <FormNum label="Rootworm Feeding (0-10)" value={data.rootwormFeeding} onChange={v => set('rootwormFeeding', v)} />
          <FormSelect label="Weed Pressure" value={data.weedPressure} onChange={v => set('weedPressure', v)} opts={['none','low','medium','high']} />
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Weeds Present</p>
            <div className="flex flex-wrap gap-3">
              {WEED_OPTIONS.map(w => (
                <Checkbox key={w} label={w} checked={weedsPresent.includes(w)} onChange={checked => onToggleWeed(w, checked)} />
              ))}
            </div>
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Mid Season">
        <div className="grid grid-cols-2 gap-3">
          <FormNum label="Corn Borer (larvae/plant)" value={data.cornBorer} onChange={v => set('cornBorer', v)} />
          {showAphids && <FormNum label="Aphids (per plant)" value={data.aphids} onChange={v => set('aphids', v)} />}
        </div>
      </SeasonSection>

      <SeasonSection title="Late Season">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Diseases / Issues Present</p>
          <div className="flex flex-wrap gap-3">
            {(['grayLeafSpot','northernLeafBlight','commonRust','earMolds','nitrogeneStress','compaction'] as const).map(k => (
              <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FormTextArea label="Additional Pests / Notes" value={data.additionalPests} onChange={v => set('additionalPests', v)} />
        </div>
      </SeasonSection>
    </div>
  );
}

function CanolaForm({ data, onChange, weedsPresent, onToggleWeed }: { data: Partial<CanolaScoutData>; onChange: (d: Partial<CanolaScoutData>) => void; weedsPresent: string[]; onToggleWeed: (weed: string, checked: boolean) => void }) {
  const set = (k: keyof CanolaScoutData, v: any) => onChange({ ...data, [k]: v });
  const showAphids = shouldShowAphidField(data.growthStage);
  return (
    <div className="space-y-3">
      <SeasonSection title="Early Season">
        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Growth Stage" value={data.growthStage} onChange={v => set('growthStage', v)} opts={GROWTH_STAGE_OPTIONS_BY_CROP.Canola} />
          <FormNum label="Plant Stand (plants/m²)" value={data.plantStand} onChange={v => set('plantStand', v)} />
          <FormNum label="Flea Beetle Feeding (0-10)" value={data.fleaBeetleFeeding} onChange={v => set('fleaBeetleFeeding', v)} />
          <FormSelect label="Weed Pressure" value={data.weedPressure} onChange={v => set('weedPressure', v)} opts={['none','low','medium','high']} />
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Weeds Present</p>
            <div className="flex flex-wrap gap-3">
              {WEED_OPTIONS.map(w => (
                <Checkbox key={w} label={w} checked={weedsPresent.includes(w)} onChange={checked => onToggleWeed(w, checked)} />
              ))}
            </div>
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Mid Season">
        <div className="grid grid-cols-2 gap-3">
          <FormNum label="Bertha (larvae/m²)" value={data.bertha} onChange={v => set('bertha', v)} />
          {showAphids && <FormNum label="Aphids (per plant)" value={data.aphids} onChange={v => set('aphids', v)} />}
        </div>
      </SeasonSection>

      <SeasonSection title="Late Season">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Diseases / Issues Present</p>
          <div className="flex flex-wrap gap-3">
            {(['sclerotinia','blackleg','clubroot','swede','podShatter'] as const).map(k => (
              <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FormTextArea label="Additional Pests / Notes" value={data.additionalPests} onChange={v => set('additionalPests', v)} />
        </div>
      </SeasonSection>
    </div>
  );
}

function SoyForm({ data, onChange, weedsPresent, onToggleWeed }: { data: Partial<SoyScoutData>; onChange: (d: Partial<SoyScoutData>) => void; weedsPresent: string[]; onToggleWeed: (weed: string, checked: boolean) => void }) {
  const set = (k: keyof SoyScoutData, v: any) => onChange({ ...data, [k]: v });
  const showAphids = shouldShowAphidField(data.growthStage);
  return (
    <div className="space-y-3">
      <SeasonSection title="Early Season">
        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Growth Stage" value={data.growthStage} onChange={v => set('growthStage', v)} opts={GROWTH_STAGE_OPTIONS_BY_CROP.Soybeans} />
          <FormNum label="Plant Stand (plants/ac)" value={data.plantStand} onChange={v => set('plantStand', v)} />
          <FormSelect label="Weed Pressure" value={data.weedPressure} onChange={v => set('weedPressure', v)} opts={['none','low','medium','high']} />
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Weeds Present</p>
            <div className="flex flex-wrap gap-3">
              {WEED_OPTIONS.map(w => (
                <Checkbox key={w} label={w} checked={weedsPresent.includes(w)} onChange={checked => onToggleWeed(w, checked)} />
              ))}
            </div>
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Mid Season">
        <div className="grid grid-cols-2 gap-3">
          {showAphids && <FormNum label="Aphids (per plant)" value={data.aphids} onChange={v => set('aphids', v)} />}
          <FormNum label="Pod Damage (%)" value={data.podDamage} onChange={v => set('podDamage', v)} />
        </div>
      </SeasonSection>

      <SeasonSection title="Late Season">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Diseases / Issues Present</p>
          <div className="flex flex-wrap gap-3">
            {(['spiderMites','scn','whiteMold','suddenDeathSyndrome','frogeye','stemCanker'] as const).map(k => (
              <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FormTextArea label="Additional Pests / Notes" value={data.additionalPests} onChange={v => set('additionalPests', v)} />
        </div>
      </SeasonSection>
    </div>
  );
}

function WheatForm({ data, onChange, weedsPresent, onToggleWeed }: { data: Partial<WheatScoutData>; onChange: (d: Partial<WheatScoutData>) => void; weedsPresent: string[]; onToggleWeed: (weed: string, checked: boolean) => void }) {
  const set = (k: keyof WheatScoutData, v: any) => onChange({ ...data, [k]: v });
  const showAphids = shouldShowAphidField(data.growthStage);
  return (
    <div className="space-y-3">
      <SeasonSection title="Early Season">
        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Growth Stage" value={data.growthStage} onChange={v => set('growthStage', v)} opts={GROWTH_STAGE_OPTIONS_BY_CROP.Wheat} />
          <FormNum label="Plant Stand (plants/m²)" value={data.plantStand} onChange={v => set('plantStand', v)} />
          <FormSelect label="Weed Pressure" value={data.weedPressure} onChange={v => set('weedPressure', v)} opts={['none','low','medium','high']} />
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Weeds Present</p>
            <div className="flex flex-wrap gap-3">
              {WEED_OPTIONS.map(w => (
                <Checkbox key={w} label={w} checked={weedsPresent.includes(w)} onChange={checked => onToggleWeed(w, checked)} />
              ))}
            </div>
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Mid Season">
        <div className="grid grid-cols-2 gap-3">
          {showAphids && <FormNum label="Aphids (per plant)" value={data.aphids} onChange={v => set('aphids', v)} />}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Insect / Stress Flags</p>
            <div className="flex flex-wrap gap-3">
              {(['hessianFly','lodging'] as const).map(k => (
                <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
              ))}
            </div>
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Late Season">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Diseases / Issues Present</p>
          <div className="flex flex-wrap gap-3">
            {(['fusariumHead','leafRust','stemRust','stripeRust','powderyMildew','tanSpot'] as const).map(k => (
              <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FormTextArea label="Additional Pests / Notes" value={data.additionalPests} onChange={v => set('additionalPests', v)} />
        </div>
      </SeasonSection>
    </div>
  );
}

function EdibleBeanForm({ data, onChange, weedsPresent, onToggleWeed }: { data: Partial<EdibleBeanScoutData>; onChange: (d: Partial<EdibleBeanScoutData>) => void; weedsPresent: string[]; onToggleWeed: (weed: string, checked: boolean) => void }) {
  const set = (k: keyof EdibleBeanScoutData, v: any) => onChange({ ...data, [k]: v });
  const showAphids = shouldShowAphidField(data.growthStage);
  return (
    <div className="space-y-3">
      <SeasonSection title="Early Season">
        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Growth Stage" value={data.growthStage} onChange={v => set('growthStage', v)} opts={GROWTH_STAGE_OPTIONS_BY_CROP['Edible Beans']} />
          <FormNum label="Plant Stand (plants/ac)" value={data.plantStand} onChange={v => set('plantStand', v)} />
          <FormNum label="Bean Leaf Beetle Defoliation (%)" value={data.beanLeafBeetle} onChange={v => set('beanLeafBeetle', v)} />
          <FormSelect label="Weed Pressure" value={data.weedPressure} onChange={v => set('weedPressure', v)} opts={['none','low','medium','high']} />
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Weeds Present</p>
            <div className="flex flex-wrap gap-3">
              {WEED_OPTIONS.map(w => (
                <Checkbox key={w} label={w} checked={weedsPresent.includes(w)} onChange={checked => onToggleWeed(w, checked)} />
              ))}
            </div>
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Mid Season">
        <div className="grid grid-cols-2 gap-3">
          {showAphids && <FormNum label="Aphids (per plant)" value={data.aphids} onChange={v => set('aphids', v)} />}
          <FormSelect label="Pod Fill" value={data.podFill} onChange={v => set('podFill', v)} opts={['poor','fair','good']} />
        </div>
      </SeasonSection>

      <SeasonSection title="Late Season">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Diseases / Issues Present</p>
          <div className="flex flex-wrap gap-3">
            {(['mexicanBeanBeetle','whiteMold','anthracnose','bacterialBlight'] as const).map(k => (
              <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FormTextArea label="Additional Pests / Notes" value={data.additionalPests} onChange={v => set('additionalPests', v)} />
        </div>
      </SeasonSection>
    </div>
  );
}

function OatsForm({ data, onChange, weedsPresent, onToggleWeed }: { data: Partial<OatsScoutData>; onChange: (d: Partial<OatsScoutData>) => void; weedsPresent: string[]; onToggleWeed: (weed: string, checked: boolean) => void }) {
  const set = (k: keyof OatsScoutData, v: any) => onChange({ ...data, [k]: v });
  const showAphids = shouldShowAphidField(data.growthStage);
  return (
    <div className="space-y-3">
      <SeasonSection title="Early Season">
        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Growth Stage" value={data.growthStage} onChange={v => set('growthStage', v)} opts={GROWTH_STAGE_OPTIONS_BY_CROP.Oats} />
          <FormNum label="Plant Stand (plants/m²)" value={data.plantStand} onChange={v => set('plantStand', v)} />
          <FormSelect label="Weed Pressure" value={data.weedPressure} onChange={v => set('weedPressure', v)} opts={['none','low','medium','high']} />
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Weeds Present</p>
            <div className="flex flex-wrap gap-3">
              {WEED_OPTIONS.map(w => (
                <Checkbox key={w} label={w} checked={weedsPresent.includes(w)} onChange={checked => onToggleWeed(w, checked)} />
              ))}
            </div>
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Mid Season">
        <div className="grid grid-cols-2 gap-3">
          {showAphids && <FormNum label="Aphids (per plant)" value={data.aphids} onChange={v => set('aphids', v)} />}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Insect / Stress Flags</p>
            <div className="flex flex-wrap gap-3">
              {(['thrips','lodging'] as const).map(k => (
                <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
              ))}
            </div>
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Late Season">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Diseases / Issues Present</p>
          <div className="flex flex-wrap gap-3">
            {(['crownRust','stemRust','barleyYellowDwarf','headSmut'] as const).map(k => (
              <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FormTextArea label="Additional Pests / Notes" value={data.additionalPests} onChange={v => set('additionalPests', v)} />
        </div>
      </SeasonSection>
    </div>
  );
}

function PotatoForm({ data, onChange, weedsPresent, onToggleWeed }: { data: Partial<PotatoScoutData>; onChange: (d: Partial<PotatoScoutData>) => void; weedsPresent: string[]; onToggleWeed: (weed: string, checked: boolean) => void }) {
  const set = (k: keyof PotatoScoutData, v: any) => onChange({ ...data, [k]: v });
  const showAphids = shouldShowAphidField(data.growthStage);
  return (
    <div className="space-y-3">
      <SeasonSection title="Early Season">
        <div className="grid grid-cols-2 gap-3">
          <FormSelect label="Growth Stage" value={data.growthStage} onChange={v => set('growthStage', v)} opts={GROWTH_STAGE_OPTIONS_BY_CROP.Potatoes} />
          <FormNum label="Plant Stand (plants/10ft)" value={data.plantStand} onChange={v => set('plantStand', v)} />
          <FormNum label="Seed Rot (% plants affected)" value={data.seedRot} onChange={v => set('seedRot', v)} />
          <FormNum label="Blackleg (% plants)" value={data.blackleg} onChange={v => set('blackleg', v)} />
          <FormSelect label="Weed Pressure" value={data.weedPressure} onChange={v => set('weedPressure', v)} opts={['none','low','medium','high']} />
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Weeds Present</p>
            <div className="flex flex-wrap gap-3">
              {WEED_OPTIONS.map(w => (
                <Checkbox key={w} label={w} checked={weedsPresent.includes(w)} onChange={checked => onToggleWeed(w, checked)} />
              ))}
            </div>
          </div>
          <FormSelect label="Soil Moisture" value={data.soilMoisture} onChange={v => set('soilMoisture', v)} opts={['dry','adequate','saturated']} />
        </div>
      </SeasonSection>

      <SeasonSection title="Mid Season">
        <div className="grid grid-cols-2 gap-3">
          <FormNum label="Avg Stems per Plant" value={data.avgStemsPerPlant} onChange={v => set('avgStemsPerPlant', v)} step={0.1} />
          <FormNum label="Avg Tubers per Stem" value={data.avgTubersPerStem} onChange={v => set('avgTubersPerStem', v)} step={0.1} />
          <FormNum label="CPB Larvae (per plant)" value={data.coloradoPotatoBeetle} onChange={v => set('coloradoPotatoBeetle', v)} step={0.1} />
          <FormSelect label="CPB Growth Stage" value={data.cpbGrowthStage} onChange={v => set('cpbGrowthStage', v)} opts={CPB_GROWTH_STAGES} />
          {showAphids && <FormNum label="Aphids (per leaf)" value={data.aphids} onChange={v => set('aphids', v)} />}
          <FormSelect label="Irrigation Status" value={data.irrigationStatus} onChange={v => set('irrigationStatus', v)} opts={IRRIGATION_STATUS_OPTIONS} />
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600 mb-1">Additional Pest Flags</p>
          <div className="flex flex-wrap gap-3">
            {(['wirewormDamage','potatoLeafhopper'] as const).map(k => (
              <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
            ))}
          </div>
        </div>
      </SeasonSection>

      <SeasonSection title="Late Season">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Diseases / Issues Present</p>
          <div className="flex flex-wrap gap-3">
            {([
              'earlyBlight','lateBlight','verticilliumWilt','commonScab','rhizoctoniaStemCanker','blackScurf','pinkRot','pythiumLeak','fusariumDryRot','silverScurf','virusSymptoms',
            ] as const).map(k => (
              <Checkbox key={k} label={k.replace(/([A-Z])/g,' $1').trim()} checked={!!data[k]} onChange={v => set(k, v)} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FormTextArea label="Additional Pests / Notes" value={data.additionalPests} onChange={v => set('additionalPests', v)} />
        </div>
      </SeasonSection>
    </div>
  );
}

// ── Shared form helpers ───────────────────────────────────────────────────────

function FormNum({ label, value, onChange, step = 1 }: { label: string; value?: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type="number"
        className="form-input"
        value={value ?? ''}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function FormText({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input className="form-input" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function FormSelect({ label, value, onChange, opts }: { label: string; value?: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <select className="form-input" value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">Select...</option>
        {opts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
      </select>
    </div>
  );
}

function FormTextArea({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <textarea className="form-input resize-none" rows={2} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
      <input type="checkbox" className="w-3.5 h-3.5 accent-green-600" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// ── Main Scouting component ──────────────────────────────────────────────────

export default function Scouting({ data, updateData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewReport, setViewReport] = useState<ScoutingReport | null>(null);
  const [editingReport, setEditingReport] = useState<ScoutingReport | null>(null);
  const [filterCrop, setFilterCrop] = useState<CropType | ''>('');
  const [filterField, setFilterField] = useState('');
  const [expandMap, setExpandMap] = useState(false);

  // Form state
  const [fieldId, setFieldId] = useState('');
  const [variety, setVariety] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<GeoLocation | undefined>();
  const [photos, setPhotos] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');
  const [weedsPresent, setWeedsPresent] = useState<string[]>([]);
  const [cropData, setCropData] = useState<any>({});
  const [recordSpray, setRecordSpray] = useState(false);
  const [sprayChemicals, setSprayChemicals] = useState<Array<{ name: string; rate: string }>>([]);
  const [sprayMethod, setSprayMethod] = useState(SPRAY_METHODS[0]);
  const [sprayWaterVolume, setSprayWaterVolume] = useState('');
  const [sprayNotes, setSprayNotes] = useState('');
  const [trackName, setTrackName] = useState('');
  const [trailPoints, setTrailPoints] = useState<GeoLocation[]>([]);
  const [isTrackingTrail, setIsTrackingTrail] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const selectedField = data.fields.find(f => f.id === fieldId);
  const cropType = selectedField?.cropType ?? 'Corn';
  const varietyOptions = VARIETIES_BY_CROP[cropType] ?? [];
  const sprayCatalogOptions = selectedField
    ? (CROP_PRODUCT_OPTIONS[selectedField.cropType] ?? PRODUCT_OPTIONS)
    : PRODUCT_OPTIONS;
  const orderedFields = [...data.fields].sort((a, b) => {
    const cropCmp = CROP_ORDER[a.cropType] - CROP_ORDER[b.cropType];
    if (cropCmp !== 0) return cropCmp;
    return a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' });
  });

  function distanceMeters(a: GeoLocation, b: GeoLocation) {
    const toRad = (v: number) => v * (Math.PI / 180);
    const r = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return r * c;
  }

  function stopTrailTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTrackingTrail(false);
  }

  function startTrailTracking() {
    if (!navigator.geolocation) {
      setTrackingError('Geolocation is not supported on this device/browser.');
      return;
    }
    setTrackingError(null);
    setIsTrackingTrail(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const point: GeoLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setLocation(point);
        setTrailPoints(prev => {
          if (prev.length === 0) return [point];
          const last = prev[prev.length - 1];
          if (distanceMeters(last, point) < 3) return prev;
          return [...prev, point];
        });
      },
      err => {
        setTrackingError(err.code === 1 ? 'Location permission denied.' : 'Unable to record GPS location.');
        stopTrailTracking();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  useEffect(() => {
    return () => stopTrailTracking();
  }, []);

  function resetForm() {
    stopTrailTracking();
    setFieldId('');
    setVariety('');
    setDate(new Date().toISOString().split('T')[0]);
    setLocation(undefined);
    setPhotos([]);
    setPriority('medium');
    setNotes('');
    setWeedsPresent([]);
    setCropData({});
    setRecordSpray(false);
    setSprayChemicals([]);
    setSprayMethod(SPRAY_METHODS[0]);
    setSprayWaterVolume('');
    setSprayNotes('');
    setTrackName('');
    setTrailPoints([]);
    setTrackingError(null);
    setEditingReport(null);
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(report: ScoutingReport) {
    setEditingReport(report);
    const field = data.fields.find(f => f.fieldNumber === report.fieldNumber);
    setFieldId(field?.id ?? '');
    setVariety(report.variety);
    setDate(report.date);
    setLocation(report.location);
    setPhotos(report.photos);
    setPriority(report.priority);
    setNotes(report.notes);
    setWeedsPresent(report.weedsPresent ?? []);
    setCropData(report.cropData);
    setRecordSpray(!!report.sprayRecord);
    setSprayChemicals(report.sprayRecord?.chemicals ?? []);
    setSprayMethod(report.sprayRecord?.applicationMethod ?? SPRAY_METHODS[0]);
    setSprayWaterVolume(report.sprayRecord?.waterVolume ?? '');
    setSprayNotes(report.sprayRecord?.notes ?? '');
    setTrackName(report.trialTrack?.name ?? '');
    setTrailPoints(report.trialTrack?.points ?? []);
    setTrackingError(null);
    setShowForm(true);
  }

  function handleSave() {
    if (!fieldId && !editingReport) return;
    const field = selectedField ?? data.fields.find(f => f.fieldNumber === editingReport?.fieldNumber);
    const now = new Date().toISOString();
    const cleanedChemicals = sprayChemicals
      .map(c => ({ name: c.name.trim(), rate: c.rate.trim() }))
      .filter(c => c.name);
    const shouldSaveSpray = recordSpray && cleanedChemicals.length > 0;
    const sprayApplicationId = shouldSaveSpray
      ? (editingReport?.sprayApplicationId ?? generateId())
      : undefined;
    const report: ScoutingReport = {
      id: editingReport?.id ?? generateId(),
      fieldId: field?.id ?? '',
      fieldNumber: field?.fieldNumber ?? editingReport?.fieldNumber ?? '',
      cropType: field?.cropType ?? editingReport?.cropType ?? 'Corn',
      variety,
      date,
      location,
      photos,
      weedsPresent,
      priority,
      notes,
      trialTrack: trailPoints.length > 0 ? {
        name: (trackName || 'Trial Track').trim(),
        points: trailPoints,
      } : undefined,
      sprayApplicationId,
      sprayRecord: shouldSaveSpray ? {
        chemicals: cleanedChemicals,
        applicationMethod: sprayMethod,
        waterVolume: sprayWaterVolume || undefined,
        notes: sprayNotes || undefined,
      } : undefined,
      cropData: { ...cropData, crop: field?.cropType ?? editingReport?.cropType },
      createdAt: editingReport?.createdAt ?? now,
    };
    updateData(prev => {
      let next = saveScoutingReport(prev, report);

      if (shouldSaveSpray && field && sprayApplicationId) {
        const existingSpray = prev.sprayApplications.find(a => a.id === sprayApplicationId);
        next = saveSprayApplication(next, {
          id: sprayApplicationId,
          fieldIds: [field.id],
          fieldNumbers: [field.fieldNumber],
          plannedDate: date,
          appliedDate: existingSpray?.status === 'applied' ? (existingSpray.appliedDate || date) : undefined,
          product: cleanedChemicals.map(c => c.name).join(', '),
          products: cleanedChemicals.map(c => c.name),
          chemicals: cleanedChemicals,
          activeIngredient: '',
          rate: cleanedChemicals.map(c => `${c.name}: ${c.rate ? `${c.rate}L` : 'n/a'}`).join(', '),
          waterVolume: sprayWaterVolume || undefined,
          targetPest: '',
          applicationMethod: sprayMethod,
          sprayer: '',
          operator: '',
          status: existingSpray?.status ?? 'planned',
          priority,
          weatherAtApplication: '',
          notes: sprayNotes || `Created from scouting report ${report.fieldNumber} on ${date}`,
          createdAt: existingSpray?.createdAt ?? now,
          updatedAt: now,
        });
      }

      if (!shouldSaveSpray && editingReport?.sprayApplicationId) {
        next = deleteSprayApplication(next, editingReport.sprayApplicationId);
      }

      return next;
    });
    setShowForm(false);
    resetForm();
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this scouting report?')) return;
    updateData(prev => deleteScoutingReport(prev, id));
    setViewReport(null);
  }

  const filtered = data.scoutingReports
    .filter(r => {
      if (filterCrop && r.cropType !== filterCrop) return false;
      if (filterField && !r.fieldNumber.toLowerCase().includes(filterField.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      const cropCmp = CROP_ORDER[a.cropType] - CROP_ORDER[b.cropType];
      if (cropCmp !== 0) return cropCmp;
      return a.fieldNumber.localeCompare(b.fieldNumber, undefined, { numeric: true, sensitivity: 'base' });
    });

  // Map markers for all scouted locations
  const mapMarkers = data.scoutingReports
    .filter(r => r.location)
    .map(r => ({
      location: r.location!,
      label: `Field ${r.fieldNumber} — ${r.cropType}`,
      date: r.date,
      color: r.priority === 'high' ? '#ef4444' : r.priority === 'medium' ? '#f59e0b' : '#22c55e',
    }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-green-900">Crop Scouting</h1>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Report
        </button>
      </div>

      {/* Map toggle */}
      <div className="card">
        <button
          className="flex items-center gap-2 text-sm font-semibold text-green-800"
          onClick={() => setExpandMap(v => !v)}
        >
          <MapPin className="h-4 w-4" />
          Scouting Location Map
          {expandMap ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-green-600 font-normal">({mapMarkers.length} locations)</span>
        </button>
        {expandMap && (
          <div className="mt-3">
            <Suspense fallback={<div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Loading map...</div>}>
              <GeoMap markers={mapMarkers} height="350px" readonly />
            </Suspense>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="form-input flex-1 min-w-40"
          placeholder="Filter by field #..."
          value={filterField}
          onChange={e => setFilterField(e.target.value)}
        />
        <select className="form-input w-40" value={filterCrop} onChange={e => setFilterCrop(e.target.value as CropType | '')}>
          <option value="">All Crops</option>
          {CROPS.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Filter className="h-3 w-3" /> {filtered.length} report{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Reports list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            No scouting reports yet. Click "New Report" to get started.
          </div>
        ) : filtered.map(report => (
          <div key={report.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-green-900">Field {report.fieldNumber}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{report.cropType}</span>
                  {report.variety && <span className="text-xs text-gray-500">{report.variety}</span>}
                  {priorityBadge(report.priority)}
                  {report.location && <MapPin className="h-3.5 w-3.5 text-green-500" />}
                  {report.photos.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-blue-500">
                      <Image className="h-3.5 w-3.5" /> {report.photos.length}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{report.date}</div>
                {report.notes && <div className="text-sm text-gray-600 mt-1 truncate">{report.notes}</div>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setViewReport(report)} className="btn-secondary text-xs py-1.5 px-2.5">
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                <button onClick={() => openEdit(report)} className="btn-secondary text-xs py-1.5 px-2.5">Edit</button>
                <button onClick={() => handleDelete(report.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-lg font-semibold">{editingReport ? 'Edit Scouting Report' : 'New Scouting Report'}</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Field * </label>
                  <select className="form-input" value={fieldId} onChange={e => setFieldId(e.target.value)}>
                    <option value="">Select field...</option>
                    {orderedFields.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.fieldNumber} — {f.cropType} {f.variety ? `(${f.variety})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Variety</label>
                  <select className="form-input" value={variety} onChange={e => setVariety(e.target.value)}>
                    <option value="">Select variety...</option>
                    {varietyOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Geolocation */}
              <div>
                <label className="form-label">GPS Location</label>
                <Suspense fallback={<div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Loading map...</div>}>
                  <GeoMap
                    currentLocation={location}
                    onLocationCapture={setLocation}
                    height="220px"
                  />
                </Suspense>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="form-label mb-0">Trial Track Recording</label>
                  <div className="flex gap-2">
                    {!isTrackingTrail ? (
                      <button type="button" onClick={startTrailTracking} className="btn-secondary text-xs py-1.5">Start Tracking</button>
                    ) : (
                      <button type="button" onClick={stopTrailTracking} className="btn-danger text-xs py-1.5">Stop Tracking</button>
                    )}
                    <button type="button" onClick={() => setTrailPoints([])} className="btn-secondary text-xs py-1.5">Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Track Name</label>
                    <input
                      className="form-input"
                      value={trackName}
                      onChange={e => setTrackName(e.target.value)}
                      placeholder="e.g. Trial Strip A"
                    />
                  </div>
                  <div className="text-sm text-gray-600 self-end pb-2">
                    {trailPoints.length} point{trailPoints.length !== 1 ? 's' : ''} recorded
                  </div>
                </div>
                {trackingError && <div className="text-sm text-red-600">{trackingError}</div>}
              </div>

              {/* Crop-specific form */}
              {(fieldId || editingReport) && (
                <div>
                  <h3 className="text-sm font-semibold text-green-800 mb-3 border-b pb-2">
                    {cropType} Scouting Data
                  </h3>
                  {cropType === 'Corn' && <CornForm data={cropData} onChange={setCropData} weedsPresent={weedsPresent} onToggleWeed={(weed, checked) => setWeedsPresent(prev => checked ? [...prev, weed] : prev.filter(x => x !== weed))} />}
                  {cropType === 'Canola' && <CanolaForm data={cropData} onChange={setCropData} weedsPresent={weedsPresent} onToggleWeed={(weed, checked) => setWeedsPresent(prev => checked ? [...prev, weed] : prev.filter(x => x !== weed))} />}
                  {cropType === 'Soybeans' && <SoyForm data={cropData} onChange={setCropData} weedsPresent={weedsPresent} onToggleWeed={(weed, checked) => setWeedsPresent(prev => checked ? [...prev, weed] : prev.filter(x => x !== weed))} />}
                  {cropType === 'Wheat' && <WheatForm data={cropData} onChange={setCropData} weedsPresent={weedsPresent} onToggleWeed={(weed, checked) => setWeedsPresent(prev => checked ? [...prev, weed] : prev.filter(x => x !== weed))} />}
                  {cropType === 'Edible Beans' && <EdibleBeanForm data={cropData} onChange={setCropData} weedsPresent={weedsPresent} onToggleWeed={(weed, checked) => setWeedsPresent(prev => checked ? [...prev, weed] : prev.filter(x => x !== weed))} />}
                  {cropType === 'Oats' && <OatsForm data={cropData} onChange={setCropData} weedsPresent={weedsPresent} onToggleWeed={(weed, checked) => setWeedsPresent(prev => checked ? [...prev, weed] : prev.filter(x => x !== weed))} />}
                  {cropType === 'Potatoes' && <PotatoForm data={cropData} onChange={setCropData} weedsPresent={weedsPresent} onToggleWeed={(weed, checked) => setWeedsPresent(prev => checked ? [...prev, weed] : prev.filter(x => x !== weed))} />}
                </div>
              )}

              {/* Photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Spray Record (Save To Spray Plan)</label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recordSpray}
                      onChange={e => setRecordSpray(e.target.checked)}
                      className="accent-green-600"
                    />
                    Include Spray Record
                  </label>
                </div>

                {recordSpray && (
                  <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
                    <div className="space-y-2">
                      {(sprayChemicals ?? []).map((chem, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            className="form-input flex-1"
                            value={chem.name}
                            onChange={e => setSprayChemicals(prev => prev.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))}
                            placeholder="Chemical name"
                          />
                          <div className="relative w-36">
                            <input
                              className="form-input pr-7"
                              value={chem.rate}
                              onChange={e => setSprayChemicals(prev => prev.map((c, i) => i === idx ? { ...c, rate: e.target.value } : c))}
                              placeholder="Rate"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">L</span>
                          </div>
                          <button type="button" onClick={() => setSprayChemicals(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <select className="form-input flex-1" value="" onChange={e => {
                          const value = e.target.value;
                          if (!value) return;
                          setSprayChemicals(prev => [...prev, { name: value, rate: '' }]);
                        }}>
                          <option value="">Add from catalog</option>
                          {sprayCatalogOptions.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button type="button" className="btn-secondary text-xs px-3 whitespace-nowrap" onClick={() => setSprayChemicals(prev => [...prev, { name: '', rate: '' }])}>
                          + Custom
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Catalog: {selectedField ? `${selectedField.cropType} chemicals` : 'All crops (select a field to filter)'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Application Method</label>
                        <select className="form-input" value={sprayMethod} onChange={e => setSprayMethod(e.target.value)}>
                          {SPRAY_METHODS.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Water Volume</label>
                        <input className="form-input" value={sprayWaterVolume} onChange={e => setSprayWaterVolume(e.target.value)} placeholder="e.g. 15 gal/ac" />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Spray Notes</label>
                      <textarea
                        className="form-input resize-none"
                        rows={2}
                        value={sprayNotes}
                        onChange={e => setSprayNotes(e.target.value)}
                        placeholder="Optional spray notes"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Photos */}
              <div>
                <label className="form-label">Photos</label>
                <PhotoCapture photos={photos} onChange={setPhotos} maxPhotos={8} />
              </div>

              {/* Notes */}
              <div>
                <label className="form-label">General Notes</label>
                <textarea
                  className="form-input resize-none"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Overall observations, recommendations..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!fieldId && !editingReport}>
                {editingReport ? 'Save Changes' : 'Save Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Report Modal */}
      {viewReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">
                Scouting Report — Field {viewReport.fieldNumber}
              </h2>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Crop:</span> <span className="font-medium">{viewReport.cropType}</span></div>
                <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{viewReport.variety || '—'}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewReport.date}</span></div>
                <div><span className="text-gray-500">Priority:</span> {priorityBadge(viewReport.priority)}</div>
              </div>

              {(viewReport.weedsPresent?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Weeds Present</h3>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    {viewReport.weedsPresent?.join(', ')}
                  </div>
                </div>
              )}

              {viewReport.trialTrack && viewReport.trialTrack.points.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Trial Track</h3>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-2">
                    <div><span className="text-gray-500">Name:</span> <span className="font-medium">{viewReport.trialTrack.name}</span></div>
                    <div><span className="text-gray-500">Points:</span> <span className="font-medium">{viewReport.trialTrack.points.length}</span></div>
                  </div>
                  <Suspense fallback={null}>
                    <GeoMap
                      currentLocation={viewReport.trialTrack.points[viewReport.trialTrack.points.length - 1]}
                      markers={viewReport.trialTrack.points.map((p, idx) => ({
                        location: p,
                        label: `${viewReport.trialTrack?.name} #${idx + 1}`,
                        date: viewReport.date,
                        color: '#2563eb',
                      }))}
                      height="200px"
                      readonly
                    />
                  </Suspense>
                </div>
              )}

              {viewReport.location && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Location</h3>
                  <Suspense fallback={null}>
                    <GeoMap currentLocation={viewReport.location} height="200px" readonly />
                  </Suspense>
                </div>
              )}

              {/* Crop data */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Scouting Data</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  {Object.entries(viewReport.cropData)
                    .filter(([k, v]) => k !== 'crop' && v !== undefined && v !== '' && v !== 0 && v !== false)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-gray-500">{toDisplayLabel(k)}:</span>
                        <span className="font-medium">{toDisplayValue(v)}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {viewReport.photos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Photos ({viewReport.photos.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewReport.photos.map((p, i) => (
                      <img key={i} src={p} alt={`Photo ${i+1}`} className="photo-thumbnail" />
                    ))}
                  </div>
                </div>
              )}

              {viewReport.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewReport.notes}</p>
                </div>
              )}

              {viewReport.sprayRecord && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Spray Record</h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    {viewReport.sprayRecord.chemicals.map((c, i) => (
                      <div key={`${c.name}-${i}`} className="flex justify-between">
                        <span className="font-medium">{c.name}</span>
                        {c.rate && <span className="text-gray-600">{c.rate} L</span>}
                      </div>
                    ))}
                    <div><span className="text-gray-500">Method:</span> <span className="font-medium">{viewReport.sprayRecord.applicationMethod}</span></div>
                    {viewReport.sprayRecord.waterVolume && <div><span className="text-gray-500">Water Volume:</span> <span className="font-medium">{viewReport.sprayRecord.waterVolume}</span></div>}
                    {viewReport.sprayRecord.notes && <div><span className="text-gray-500">Notes:</span> <span className="font-medium">{viewReport.sprayRecord.notes}</span></div>}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => handleDelete(viewReport.id)} className="btn-danger">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button onClick={() => { openEdit(viewReport); setViewReport(null); }} className="btn-primary">
                Edit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
