import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AppData, ScoutingReport, SprayApplication, SeedingEntry, PotatoYieldReport, TillageReport } from '../types';
import WeatherWidget from '../components/WeatherWidget';
import SoilTemperatureWidget from '../components/SoilTemperatureWidget';
import {
  ClipboardList, Syringe, Sprout, Wrench, CalendarDays, Wheat,
  ChevronRight, X
} from 'lucide-react';
import { format, subDays, isWithinInterval, parseISO } from 'date-fns';

interface Props {
  data: AppData;
}

const CROP_EMOJI: Record<string, string> = {
  Corn: '🌽', Canola: '🌻', Soybeans: '🫘', Wheat: '🌾',
  'Edible Beans': '🫘', Oats: '🌾', Potatoes: '🥔',
};

const TABLE_GRADES = ['>2"', '2.25"', '2.5"', '2.75"', '3"', '3.25"', '<3.5"'];
const PROC_GRADES = ['2oz', '3oz', '4oz', '5oz', '6oz', '7oz', '8oz', '9oz', '10oz', '11oz', '12oz'];
const GeoMap = lazy(() => import('../components/GeoMap'));

function toDisplayLabel(value: string): string {
  const spaced = value.replace(/([A-Z])/g, ' $1').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : spaced;
}

function toDisplayValue(value: unknown): string {
  if (typeof value !== 'string') return String(value);
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export default function Dashboard({ data }: Props) {
  const [activityFilter, setActivityFilter] = useState<'all' | 'scouting' | 'spray' | 'seeding' | 'tillage' | 'harvest'>('all');
  const [weeklyPriorityFilter, setWeeklyPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [weeklyCropFilter, setWeeklyCropFilter] = useState<string>('all');
  const [viewReport, setViewReport] = useState<ScoutingReport | null>(null);
  const [viewSpray, setViewSpray] = useState<SprayApplication | null>(null);
  const [viewSeeding, setViewSeeding] = useState<SeedingEntry | null>(null);
  const [viewYield, setViewYield] = useState<PotatoYieldReport | null>(null);
  const [viewTillage, setViewTillage] = useState<TillageReport | null>(null);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const weekAgo = subDays(today, 6);

  // Today's activity
  const todayScouting = data.scoutingReports.filter(r => r.date === todayStr);
  const todaySpray = data.sprayApplications.filter(a => a.appliedDate === todayStr || a.plannedDate === todayStr);
  const todaySeeding = data.seedingEntries.filter(e => e.seedingDate === todayStr);
  const todayTillage = data.tillageReports.filter(r => r.date === todayStr);
  const todayHarvest = data.harvestReports.filter(r => r.date === todayStr);
  const hasTodayActivity =
    todayScouting.length > 0
    || todaySpray.length > 0
    || todaySeeding.length > 0
    || todayTillage.length > 0
    || todayHarvest.length > 0;

  // Weekly scouting
  const weeklyReports = data.scoutingReports.filter(r => {
    try { return isWithinInterval(parseISO(r.date), { start: weekAgo, end: today }); }
    catch { return false; }
  });

  const priorityFilteredWeeklyReports = useMemo(() => {
    if (weeklyPriorityFilter === 'all') return weeklyReports;
    return weeklyReports.filter(r => r.priority === weeklyPriorityFilter);
  }, [weeklyReports, weeklyPriorityFilter]);

  const filteredWeeklyReports = useMemo(() => {
    if (weeklyCropFilter === 'all') return priorityFilteredWeeklyReports;
    return priorityFilteredWeeklyReports.filter(r => r.cropType === weeklyCropFilter);
  }, [priorityFilteredWeeklyReports, weeklyCropFilter]);

  // Weekly scouting breakdown by crop
  const weeklyByCrop = useMemo(() => {
    const map: Record<string, number> = {};
    priorityFilteredWeeklyReports.forEach(r => {
      map[r.cropType] = (map[r.cropType] ?? 0) + 1;
    });
    return map;
  }, [priorityFilteredWeeklyReports]);

  // Latest potato yield
  const latestYield = data.potatoYieldReports
    .filter(report => {
      try {
        return isWithinInterval(parseISO(report.date), { start: weekAgo, end: today });
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-green-900">
          Good {getGreeting()}, Welcome to WJS Agronomy
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">{format(today, 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Quick stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Link to="/tillage" className="card hover:shadow-md transition-all hover:border-green-300 group">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 rounded-lg p-2 group-hover:bg-green-200 transition-colors">
              <Wrench className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-green-900">{data.tillageReports.length}</div>
              <div className="text-xs text-gray-500">Tillage Reports</div>
            </div>
          </div>
        </Link>
        <Link to="/seeding-plan" className="card hover:shadow-md transition-all hover:border-green-300 group">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 rounded-lg p-2 group-hover:bg-amber-200 transition-colors">
              <CalendarDays className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-amber-900">{data.seedingEntries.length}</div>
              <div className="text-xs text-gray-500">Seeding Records</div>
            </div>
          </div>
        </Link>
        <Link to="/scouting" className="card hover:shadow-md transition-all hover:border-green-300 group">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-lg p-2 group-hover:bg-blue-200 transition-colors">
              <ClipboardList className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-blue-900">{data.scoutingReports.length}</div>
              <div className="text-xs text-gray-500">Scout Reports</div>
            </div>
          </div>
        </Link>
        <Link to="/spray" className="card hover:shadow-md transition-all hover:border-green-300 group">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 rounded-lg p-2 group-hover:bg-purple-200 transition-colors">
              <Syringe className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-purple-900">
                {data.sprayApplications.filter(a => a.status === 'planned').length}
              </div>
              <div className="text-xs text-gray-500">Sprays Planned</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Weather */}
        <div className="lg:col-span-1 space-y-4">
          <WeatherWidget />
          <SoilTemperatureWidget />
        </div>

        {/* Right: Alerts + Activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* Today's activity */}
          <div className="card lg:h-[25rem] lg:flex lg:flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-base font-semibold text-green-800">Today's Activity</h2>
              <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                <button onClick={() => setActivityFilter('all')} className={`text-xs sm:text-sm px-2.5 py-1.5 rounded-full whitespace-nowrap min-h-[34px] ${activityFilter === 'all' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>All</button>
                <button onClick={() => setActivityFilter('scouting')} className={`text-xs sm:text-sm px-2.5 py-1.5 rounded-full whitespace-nowrap min-h-[34px] ${activityFilter === 'scouting' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>Scouting</button>
                <button onClick={() => setActivityFilter('spray')} className={`text-xs sm:text-sm px-2.5 py-1.5 rounded-full whitespace-nowrap min-h-[34px] ${activityFilter === 'spray' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>Spray</button>
                <button onClick={() => setActivityFilter('seeding')} className={`text-xs sm:text-sm px-2.5 py-1.5 rounded-full whitespace-nowrap min-h-[34px] ${activityFilter === 'seeding' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>Seeding</button>
                <button onClick={() => setActivityFilter('tillage')} className={`text-xs sm:text-sm px-2.5 py-1.5 rounded-full whitespace-nowrap min-h-[34px] ${activityFilter === 'tillage' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>Tillage</button>
                <button onClick={() => setActivityFilter('harvest')} className={`text-xs sm:text-sm px-2.5 py-1.5 rounded-full whitespace-nowrap min-h-[34px] ${activityFilter === 'harvest' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>Harvest</button>
              </div>
            </div>
            <div className="max-h-80 lg:max-h-none lg:flex-1 overflow-y-auto pr-1">
              {!hasTodayActivity ? (
                <p className="text-sm text-gray-400 py-2">No activity recorded today.</p>
              ) : (
                <div className="space-y-2">
                  {(activityFilter === 'all' || activityFilter === 'scouting') && todayScouting.map(r => (
                    <button key={r.id} onClick={() => setViewReport(r)} className="w-full flex items-center gap-2 text-sm bg-blue-50 rounded-lg p-2.5 text-left hover:bg-blue-100 transition-colors">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                      <span>Scouted <span className="font-medium">Field {r.fieldNumber}</span> — {r.cropType}</span>
                    </button>
                  ))}
                  {(activityFilter === 'all' || activityFilter === 'spray') && todaySpray.map(a => (
                    <button key={a.id} onClick={() => setViewSpray(a)} className={`w-full text-left flex items-center gap-2 text-sm rounded-lg p-2.5 transition-colors ${a.appliedDate === todayStr ? 'bg-green-50 hover:bg-green-100' : 'bg-purple-50 hover:bg-purple-100'}`}>
                      <Syringe className={`h-4 w-4 ${a.appliedDate === todayStr ? 'text-green-600' : 'text-purple-600'}`} />
                      <span>
                        {a.appliedDate === todayStr ? 'Applied' : 'Planned'}: <span className="font-medium">{a.product}</span>
                        {a.fieldNumbers.length > 0 && ` — Fields: ${a.fieldNumbers.join(', ')}`}
                      </span>
                    </button>
                  ))}
                  {(activityFilter === 'all' || activityFilter === 'seeding') && todaySeeding.map(e => (
                    <button key={e.id} onClick={() => setViewSeeding(e)} className="w-full text-left flex items-center gap-2 text-sm bg-amber-50 rounded-lg p-2.5 hover:bg-amber-100 transition-colors">
                      <CalendarDays className="h-4 w-4 text-amber-600" />
                      <span>Seeded <span className="font-medium">Field {e.fieldNumber}</span> — {e.cropType}</span>
                    </button>
                  ))}
                  {(activityFilter === 'all' || activityFilter === 'tillage') && todayTillage.map(r => (
                    <button key={r.id} onClick={() => setViewTillage(r)} className="w-full text-left flex items-center gap-2 text-sm bg-green-50 rounded-lg p-2.5 hover:bg-green-100 transition-colors">
                      <Wrench className="h-4 w-4 text-green-600" />
                      <span>Tillage on <span className="font-medium">Field {r.fieldNumber}</span> — {r.method}</span>
                    </button>
                  ))}
                  {(activityFilter === 'all' || activityFilter === 'harvest') && todayHarvest.map(r => (
                    <Link key={r.id} to="/harvest" className="w-full text-left flex items-center gap-2 text-sm bg-orange-50 rounded-lg p-2.5 hover:bg-orange-100 transition-colors">
                      <Wheat className="h-4 w-4 text-orange-600" />
                      <span>Harvested <span className="font-medium">Field {r.fieldNumber}</span> — {r.cropType}</span>
                    </Link>
                  ))}
                  {((activityFilter === 'scouting' && todayScouting.length === 0)
                    || (activityFilter === 'spray' && todaySpray.length === 0)
                    || (activityFilter === 'seeding' && todaySeeding.length === 0)
                    || (activityFilter === 'tillage' && todayTillage.length === 0)
                    || (activityFilter === 'harvest' && todayHarvest.length === 0)) && (
                    <p className="text-sm text-gray-400 py-2">No matching activity for this filter today.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Weekly scouting summary */}
          <div className="card lg:h-[33.5rem] lg:flex lg:flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> This Week's Scouting
              </h2>
              <span className="text-xs text-gray-500">Last 7 days</span>
            </div>

            {weeklyReports.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No scouting reports this week.</p>
            ) : (
              <div className="space-y-3 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-green-800 text-lg">{filteredWeeklyReports.length}</span>{' '}
                  reports match current filters
                </div>

                {/* By crop */}
                <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                  <button
                    onClick={() => setWeeklyCropFilter('all')}
                    className={`px-2.5 py-1.5 rounded-full font-medium min-h-[34px] ${weeklyCropFilter === 'all' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                  >
                    All Crops ({priorityFilteredWeeklyReports.length})
                  </button>
                  {Object.entries(weeklyByCrop).map(([crop, count]) => (
                    <button
                      key={crop}
                      onClick={() => setWeeklyCropFilter(crop)}
                      className={`px-2.5 py-1.5 rounded-full font-medium min-h-[34px] flex items-center gap-1 ${weeklyCropFilter === crop ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                    >
                      <span>{CROP_EMOJI[crop] ?? '🌿'}</span>
                      <span>{crop}</span>
                      <span>({count})</span>
                    </button>
                  ))}
                </div>

                {/* Priority breakdown */}
                <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                  <button
                    onClick={() => setWeeklyPriorityFilter('all')}
                    className={`px-2.5 py-1.5 rounded-full font-medium min-h-[34px] ${weeklyPriorityFilter === 'all' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                  >
                    All ({weeklyReports.length})
                  </button>
                  {(['high', 'medium', 'low'] as const).map(p => {
                    const count = weeklyReports.filter(r => r.priority === p).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setWeeklyPriorityFilter(p)}
                        className={`px-2.5 py-1.5 rounded-full font-medium capitalize min-h-[34px] ${weeklyPriorityFilter === p ? (p === 'high' ? 'priority-high' : p === 'medium' ? 'priority-medium' : 'priority-low') : 'bg-gray-100 text-gray-600'}`}
                      >
                        {count} {p}
                      </button>
                    );
                  })}
                </div>

                {/* Recent reports */}
                <div className="max-h-56 lg:max-h-none lg:flex-1 overflow-y-auto pr-1 space-y-1">
                  {filteredWeeklyReports.map(r => (
                    <button key={r.id} onClick={() => setViewReport(r)} className="w-full flex items-center gap-2 text-sm text-gray-600 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded px-1 transition-colors text-left cursor-pointer">
                      <span className="text-base">{CROP_EMOJI[r.cropType] ?? '🌿'}</span>
                      <span className="font-medium">Field {r.fieldNumber}</span>
                      <span className="text-gray-400">{r.date}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded-full text-xs font-medium capitalize ${r.priority === 'high' ? 'priority-high' : r.priority === 'medium' ? 'priority-medium' : 'priority-low'}`}>
                        {r.priority}
                      </span>
                    </button>
                  ))}
                  {filteredWeeklyReports.length === 0 && (
                    <p className="text-sm text-gray-400 py-2">No reports match this priority this week.</p>
                  )}
                </div>
              </div>
            )}

            <Link to="/scouting" className="mt-3 lg:mt-auto text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
              View all reports <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming spray plan */}
        <div className="card md:h-[24rem] md:flex md:flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
              <Syringe className="h-5 w-5" /> Upcoming Sprays
            </h2>
          </div>
          <div className="max-h-72 md:max-h-none md:flex-1 overflow-y-auto pr-1">
            {data.sprayApplications.filter(a => a.status === 'planned').length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No sprays planned.</p>
            ) : (
              <div className="space-y-2">
                {data.sprayApplications
                  .filter(a => a.status === 'planned')
                  .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
                  .map(a => (
                    <button key={a.id} onClick={() => setViewSpray(a)} className={`w-full text-left flex items-center gap-3 text-sm rounded-lg p-2.5 transition-colors ${a.priority === 'high' ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <Syringe className={`h-4 w-4 shrink-0 ${a.priority === 'high' ? 'text-red-500' : 'text-purple-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{a.product}</div>
                        <div className="text-xs text-gray-500">
                          {a.plannedDate} · {a.fieldNumbers.length > 0 ? `Fields: ${a.fieldNumbers.join(', ')}` : 'All fields'}
                        </div>
                      </div>
                    </button>
                  ))
                }
              </div>
            )}
          </div>
          <Link to="/spray" className="mt-3 md:mt-auto text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
            Manage spray plan <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Latest potato yields */}
        <div className="card md:h-[24rem] md:flex md:flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
              <Sprout className="h-5 w-5" /> Recent Potato Yields
            </h2>
          </div>
          <div className="max-h-72 md:max-h-none md:flex-1 overflow-y-auto pr-1">
            {latestYield.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No yield reports yet.</p>
            ) : (
              <div className="space-y-2">
                {latestYield.map(r => (
                  <button key={r.id} onClick={() => setViewYield(r)} className="w-full text-left flex items-center gap-3 bg-orange-50 rounded-lg p-2.5 text-sm hover:bg-orange-100 transition-colors">
                    <span className="text-2xl">🥔</span>
                    <div className="flex-1">
                      <div className="font-medium">Field {r.fieldNumber}</div>
                      <div className="text-xs text-gray-500">{r.date} · {r.potatoType}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-700">{r.estimatedYield.toFixed(1)}</div>
                      <div className="text-xs text-gray-500">cwt/ac</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link to="/potato-yield" className="mt-3 md:mt-auto text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
            View all yield reports <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

    </div>

      {/* Scouting Report Detail Modal */}
      {viewReport !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl my-0 sm:my-4 max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b">
              <h2 className="text-base sm:text-lg font-semibold pr-2">
                Scouting Report — Field {viewReport!.fieldNumber}
              </h2>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-600 p-1.5 -mr-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-72px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div><span className="text-gray-500">Crop:</span> <span className="font-medium">{viewReport.cropType}</span></div>
                <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{viewReport.variety || '—'}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewReport.date}</span></div>
                <div><span className="text-gray-500">Priority:</span>{' '}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${viewReport.priority === 'high' ? 'priority-high' : viewReport.priority === 'medium' ? 'priority-medium' : 'priority-low'}`}>
                    {viewReport.priority}
                  </span>
                </div>
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
                    ))}
                </div>
              </div>

              {viewReport.photos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Photos ({viewReport.photos.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewReport.photos.map((p, i) => (
                      <img key={i} src={p} alt={`Photo ${i + 1}`} className="photo-thumbnail" />
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
                      <div key={`${c.name}-${i}`} className="flex justify-between gap-3">
                        <span className="font-medium">{c.name}</span>
                        {c.rate && <span className="text-gray-600 whitespace-nowrap">{c.rate} {c.rateUnit || 'L'}</span>}
                      </div>
                    ))}
                    <div><span className="text-gray-500">Method:</span> <span className="font-medium">{viewReport.sprayRecord.applicationMethod}</span></div>
                    {viewReport.sprayRecord.waterVolume && <div><span className="text-gray-500">Water Volume:</span> <span className="font-medium">{viewReport.sprayRecord.waterVolume}</span></div>}
                    {viewReport.sprayRecord.notes && <div><span className="text-gray-500">Notes:</span> <span className="font-medium">{viewReport.sprayRecord.notes}</span></div>}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Link to="/scouting" onClick={() => setViewReport(null)} className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1">
                  Open in Scouting <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewSpray && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl my-0 sm:my-4 max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b">
              <h2 className="text-base sm:text-lg font-semibold">Spray Report</h2>
              <button onClick={() => setViewSpray(null)} className="text-gray-400 hover:text-gray-600 p-1.5 -mr-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 text-sm overflow-y-auto max-h-[calc(92vh-72px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div><span className="text-gray-500">Status:</span> <span className="font-medium capitalize">{viewSpray.status}</span></div>
                <div><span className="text-gray-500">Priority:</span> <span className="font-medium capitalize">{viewSpray.priority}</span></div>
                <div><span className="text-gray-500">Planned Date:</span> <span className="font-medium">{viewSpray.plannedDate}</span></div>
                <div><span className="text-gray-500">Applied Date:</span> <span className="font-medium">{viewSpray.appliedDate || '-'}</span></div>
                <div className="sm:col-span-2"><span className="text-gray-500">Fields:</span> <span className="font-medium">{viewSpray.fieldNumbers.length ? viewSpray.fieldNumbers.join(', ') : 'All fields'}</span></div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Chemicals</h3>
                {(viewSpray.chemicals?.length ?? 0) > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-3 py-2 border border-gray-200">Name</th>
                          <th className="text-left px-3 py-2 border border-gray-200">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewSpray.chemicals ?? []).map((chem, idx) => (
                          <tr key={`${chem.name}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 border border-gray-200">{chem.name || '-'}</td>
                            <td className="px-3 py-1.5 border border-gray-200">{chem.rate ? `${chem.rate} ${chem.rateUnit || 'L'}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewSpray.product || 'No chemical list recorded.'}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div><span className="text-gray-500">Application Method:</span> <span className="font-medium">{viewSpray.applicationMethod || '-'}</span></div>
                <div><span className="text-gray-500">Water Volume:</span> <span className="font-medium">{viewSpray.waterVolume || '-'}</span></div>
                <div><span className="text-gray-500">Target Pest:</span> <span className="font-medium">{viewSpray.targetPest || '-'}</span></div>
                <div><span className="text-gray-500">Active Ingredient:</span> <span className="font-medium">{viewSpray.activeIngredient || '-'}</span></div>
                <div><span className="text-gray-500">Sprayer:</span> <span className="font-medium">{viewSpray.sprayer || '-'}</span></div>
                <div><span className="text-gray-500">Operator:</span> <span className="font-medium">{viewSpray.operator || '-'}</span></div>
                <div className="sm:col-span-2"><span className="text-gray-500">Weather at Application:</span> <span className="font-medium">{viewSpray.weatherAtApplication || '-'}</span></div>
              </div>

              {viewSpray.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewSpray.notes}</p>
                </div>
              )}

              <Link to="/spray" onClick={() => setViewSpray(null)} className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 pt-2">
                Open in Spray <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {viewSeeding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl my-0 sm:my-4 max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b">
              <h2 className="text-base sm:text-lg font-semibold">Seeding Report - Field {viewSeeding.fieldNumber}</h2>
              <button onClick={() => setViewSeeding(null)} className="text-gray-400 hover:text-gray-600 p-1.5 -mr-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 text-sm overflow-y-auto max-h-[calc(92vh-72px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div><span className="text-gray-500">Crop:</span> <span className="font-medium">{viewSeeding.cropType}</span></div>
                <div><span className="text-gray-500">Seeding Date:</span> <span className="font-medium">{viewSeeding.seedingDate}</span></div>
                <div><span className="text-gray-500">Seeding Rate:</span> <span className="font-medium">{viewSeeding.seedingRate}</span></div>
                {viewSeeding.variety && <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{viewSeeding.variety}</span></div>}
                {viewSeeding.seedingDirection && <div><span className="text-gray-500">Direction:</span> <span className="font-medium">{viewSeeding.seedingDirection}</span></div>}
                {viewSeeding.population !== undefined && <div><span className="text-gray-500">Population:</span> <span className="font-medium">{viewSeeding.population}</span></div>}
                {viewSeeding.rowSpacing !== undefined && <div><span className="text-gray-500">Row Spacing:</span> <span className="font-medium">{viewSeeding.rowSpacing} in</span></div>}
                {viewSeeding.seedDepth !== undefined && <div><span className="text-gray-500">Seed Depth:</span> <span className="font-medium">{viewSeeding.seedDepth} in</span></div>}
                {viewSeeding.tuberSize && <div><span className="text-gray-500">Tuber Size:</span> <span className="font-medium">{viewSeeding.tuberSize}</span></div>}
                {viewSeeding.seedCutDate && <div><span className="text-gray-500">Seed Cut Date:</span> <span className="font-medium">{viewSeeding.seedCutDate}</span></div>}
                {viewSeeding.tuberTemp !== undefined && <div><span className="text-gray-500">Tuber Temp:</span> <span className="font-medium">{viewSeeding.tuberTemp} C</span></div>}
                {viewSeeding.groundTemperature !== undefined && <div><span className="text-gray-500">Ground Temp:</span> <span className="font-medium">{viewSeeding.groundTemperature} C</span></div>}
                {viewSeeding.chemicalMix && <div className="sm:col-span-2"><span className="text-gray-500">Chemical Mix:</span> <span className="font-medium">{viewSeeding.chemicalMix}</span></div>}
                {viewSeeding.fieldTrials && <div className="sm:col-span-2"><span className="text-gray-500">Field Trials:</span> <span className="font-medium">{viewSeeding.fieldTrials}</span></div>}
                {viewSeeding.pinInfo && <div className="sm:col-span-2"><span className="text-gray-500">Pin Info:</span> <span className="font-medium">{viewSeeding.pinInfo}</span></div>}
              </div>

              {viewSeeding.weather && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Weather</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-50 rounded-lg p-3">
                    <div><span className="text-gray-500">Temp:</span> <span className="font-medium">{viewSeeding.weather.temperature} C</span></div>
                    <div><span className="text-gray-500">Precip:</span> <span className="font-medium">{viewSeeding.weather.precipitation} mm</span></div>
                    <div><span className="text-gray-500">Wind:</span> <span className="font-medium">{viewSeeding.weather.windSpeed} km/h</span></div>
                    {viewSeeding.weather.humidity !== undefined && <div><span className="text-gray-500">Humidity:</span> <span className="font-medium">{viewSeeding.weather.humidity}%</span></div>}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Location</h3>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  {viewSeeding.location.lat.toFixed(5)}, {viewSeeding.location.lng.toFixed(5)}
                  {viewSeeding.location.accuracy !== undefined ? ` (±${Math.round(viewSeeding.location.accuracy)}m)` : ''}
                </p>
              </div>

              {viewSeeding.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewSeeding.notes}</p>
                </div>
              )}

              <Link to="/seeding" onClick={() => setViewSeeding(null)} className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 pt-2">
                Open in Seeding <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {viewYield && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl my-0 sm:my-4 max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b">
              <h2 className="text-base sm:text-lg font-semibold">Yield Report - Field {viewYield.fieldNumber}</h2>
              <button onClick={() => setViewYield(null)} className="text-gray-400 hover:text-gray-600 p-1.5 -mr-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 text-sm overflow-y-auto max-h-[calc(92vh-72px)]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewYield.date}</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{viewYield.potatoType}</span></div>
                <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{viewYield.variety || '-'}</span></div>
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
                      {(viewYield.potatoType === 'table' ? TABLE_GRADES : PROC_GRADES).map(grade => {
                        const count = viewYield.grades[grade] ?? 0;
                        const weight = viewYield.gradeWeights[grade] ?? 0;
                        const pct = viewYield.totalTuberWeight > 0 ? ((weight / viewYield.totalTuberWeight) * 100).toFixed(1) : '0.0';
                        if (count === 0 && weight === 0) return null;
                        return (
                          <tr key={grade} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 border border-gray-200 font-medium">{grade}</td>
                            <td className="px-3 py-1.5 border border-gray-200">{count}</td>
                            <td className="px-3 py-1.5 border border-gray-200">{weight.toFixed(2)}</td>
                            <td className="px-3 py-1.5 border border-gray-200">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-green-50 font-semibold">
                        <td className="px-3 py-2 border border-gray-200">TOTALS</td>
                        <td className="px-3 py-2 border border-gray-200">{viewYield.totalTuberCount}</td>
                        <td className="px-3 py-2 border border-gray-200">{viewYield.totalTuberWeight.toFixed(2)} lbs</td>
                        <td className="px-3 py-2 border border-gray-200">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                <div className="text-sm text-green-700 font-medium">Estimated Yield</div>
                <div className="text-3xl sm:text-4xl font-bold text-green-800 my-1">{viewYield.estimatedYield.toFixed(1)} cwt/acre</div>
                <div className="text-xs sm:text-sm text-green-600">
                  approx {(viewYield.estimatedYield / 20).toFixed(2)} tons/ac | approx {(viewYield.estimatedYield * 100).toFixed(0)} lbs/ac
                </div>
              </div>

              {(viewYield.photos?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Photos ({viewYield.photos?.length ?? 0})</h3>
                  <div className="flex flex-wrap gap-2">
                    {(viewYield.photos ?? []).map((photo, i) => (
                      <img key={`${viewYield.id}-photo-${i}`} src={photo} alt={`Yield report photo ${i + 1}`} className="photo-thumbnail" />
                    ))}
                  </div>
                </div>
              )}

              {viewYield.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewYield.notes}</p>
                </div>
              )}

              <Link to="/potato-yield" onClick={() => setViewYield(null)} className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 pt-2">
                Open in Potato Yield <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {viewTillage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl my-0 sm:my-4 max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b">
              <h2 className="text-base sm:text-lg font-semibold">Tillage Report - Field {viewTillage.fieldNumber}</h2>
              <button onClick={() => setViewTillage(null)} className="text-gray-400 hover:text-gray-600 p-1.5 -mr-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 text-sm overflow-y-auto max-h-[calc(92vh-72px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewTillage.date}</span></div>
                <div><span className="text-gray-500">Method:</span> <span className="font-medium">{viewTillage.method}</span></div>
                {viewTillage.depthInches !== undefined && <div><span className="text-gray-500">Depth:</span> <span className="font-medium">{viewTillage.depthInches} in</span></div>}
              </div>

              {viewTillage.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewTillage.notes}</p>
                </div>
              )}

              <Link to="/tillage" onClick={() => setViewTillage(null)} className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 pt-2">
                Open in Tillage <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
