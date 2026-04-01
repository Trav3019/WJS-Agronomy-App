import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AppData, ScoutingReport, SprayApplication, SeedingEntry, PotatoYieldReport } from '../types';
import WeatherWidget from '../components/WeatherWidget';
import {
  ClipboardList, Syringe, Sprout, Rows3, CalendarDays,
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

export default function Dashboard({ data }: Props) {
  const [activityFilter, setActivityFilter] = useState<'all' | 'scouting' | 'spray' | 'seeding'>('all');
  const [viewReport, setViewReport] = useState<ScoutingReport | null>(null);
  const [viewSpray, setViewSpray] = useState<SprayApplication | null>(null);
  const [viewSeeding, setViewSeeding] = useState<SeedingEntry | null>(null);
  const [viewYield, setViewYield] = useState<PotatoYieldReport | null>(null);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const weekAgo = subDays(today, 6);

  // Today's activity
  const todayScouting = data.scoutingReports.filter(r => r.date === todayStr);
  const todaySpray = data.sprayApplications.filter(a => a.appliedDate === todayStr || a.plannedDate === todayStr);
  const todaySeeding = data.seedingEntries.filter(e => e.seedingDate === todayStr);
  const hasTodayActivity = todayScouting.length > 0 || todaySpray.length > 0 || todaySeeding.length > 0;

  // Weekly scouting
  const weeklyReports = data.scoutingReports.filter(r => {
    try { return isWithinInterval(parseISO(r.date), { start: weekAgo, end: today }); }
    catch { return false; }
  });

  // Weekly scouting breakdown by crop
  const weeklyByCrop = useMemo(() => {
    const map: Record<string, number> = {};
    weeklyReports.forEach(r => {
      map[r.cropType] = (map[r.cropType] ?? 0) + 1;
    });
    return map;
  }, [weeklyReports]);

  // Latest potato yield
  const latestYield = data.potatoYieldReports
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">
          Good {getGreeting()}, Welcome to WJS Agronomy
        </h1>
        <p className="text-gray-500 text-sm mt-1">{format(today, 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Quick stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/fields" className="card hover:shadow-md transition-all hover:border-green-300 group">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 rounded-lg p-2 group-hover:bg-green-200 transition-colors">
              <Rows3 className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-900">{data.fields.length}</div>
              <div className="text-xs text-gray-500">Fields</div>
            </div>
          </div>
        </Link>
        <Link to="/scouting" className="card hover:shadow-md transition-all hover:border-green-300 group">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-lg p-2 group-hover:bg-blue-200 transition-colors">
              <ClipboardList className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-900">{data.scoutingReports.length}</div>
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
              <div className="text-2xl font-bold text-purple-900">
                {data.sprayApplications.filter(a => a.status === 'planned').length}
              </div>
              <div className="text-xs text-gray-500">Sprays Planned</div>
            </div>
          </div>
        </Link>
        <Link to="/seeding-plan" className="card hover:shadow-md transition-all hover:border-green-300 group">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 rounded-lg p-2 group-hover:bg-amber-200 transition-colors">
              <CalendarDays className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-900">{data.seedingEntries.length}</div>
              <div className="text-xs text-gray-500">Seeding Records</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Weather */}
        <div className="lg:col-span-1">
          <WeatherWidget />
        </div>

        {/* Right: Alerts + Activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* Today's activity */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-base font-semibold text-green-800">Today's Activity</h2>
              <div className="flex gap-1">
                <button onClick={() => setActivityFilter('all')} className={`text-xs px-2 py-1 rounded-full ${activityFilter === 'all' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>All</button>
                <button onClick={() => setActivityFilter('scouting')} className={`text-xs px-2 py-1 rounded-full ${activityFilter === 'scouting' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>Scouting</button>
                <button onClick={() => setActivityFilter('spray')} className={`text-xs px-2 py-1 rounded-full ${activityFilter === 'spray' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>Spray</button>
                <button onClick={() => setActivityFilter('seeding')} className={`text-xs px-2 py-1 rounded-full ${activityFilter === 'seeding' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>Seeding</button>
              </div>
            </div>
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
                {((activityFilter === 'scouting' && todayScouting.length === 0)
                  || (activityFilter === 'spray' && todaySpray.length === 0)
                  || (activityFilter === 'seeding' && todaySeeding.length === 0)) && (
                  <p className="text-sm text-gray-400 py-2">No matching activity for this filter today.</p>
                )}
              </div>
            )}
          </div>

          {/* Weekly scouting summary */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> This Week's Scouting
              </h2>
              <span className="text-xs text-gray-500">Last 7 days</span>
            </div>

            {weeklyReports.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No scouting reports this week.</p>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-green-800 text-lg">{weeklyReports.length}</span> reports filed this week
                </div>

                {/* By crop */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(weeklyByCrop).map(([crop, count]) => (
                    <div key={crop} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <span className="text-lg">{CROP_EMOJI[crop] ?? '🌿'}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-700">{count}x</div>
                        <div className="text-xs text-gray-500">{crop}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Priority breakdown */}
                <div className="flex gap-3 text-xs">
                  {(['high', 'medium', 'low'] as const).map(p => {
                    const count = weeklyReports.filter(r => r.priority === p).length;
                    if (count === 0) return null;
                    return (
                      <span key={p} className={`px-2 py-1 rounded-full font-medium capitalize ${p === 'high' ? 'priority-high' : p === 'medium' ? 'priority-medium' : 'priority-low'}`}>
                        {count} {p}
                      </span>
                    );
                  })}
                </div>

                {/* Recent reports */}
                <div className="space-y-1">
                  {weeklyReports.slice(0, 4).map(r => (
                    <button key={r.id} onClick={() => setViewReport(r)} className="w-full flex items-center gap-2 text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded px-1 transition-colors text-left cursor-pointer">
                      <span className="text-base">{CROP_EMOJI[r.cropType] ?? '🌿'}</span>
                      <span className="font-medium">Field {r.fieldNumber}</span>
                      <span className="text-gray-400">{r.date}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded-full text-xs font-medium capitalize ${r.priority === 'high' ? 'priority-high' : r.priority === 'medium' ? 'priority-medium' : 'priority-low'}`}>
                        {r.priority}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Link to="/scouting" className="mt-3 text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
              View all reports <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming spray plan */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
              <Syringe className="h-5 w-5" /> Upcoming Sprays
            </h2>
          </div>
          {data.sprayApplications.filter(a => a.status === 'planned').length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No sprays planned.</p>
          ) : (
            <div className="space-y-2">
              {data.sprayApplications
                .filter(a => a.status === 'planned')
                .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
                .slice(0, 4)
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
          <Link to="/spray" className="mt-3 text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
            Manage spray plan <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Latest potato yields */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
              <Sprout className="h-5 w-5" /> Recent Potato Yields
            </h2>
          </div>
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
          <Link to="/potato-yield" className="mt-3 text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
            View all yield reports <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

    </div>

      {/* Scouting Report Detail Modal */}
      {viewReport !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">
                Scouting Report — Field {viewReport!.fieldNumber}
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

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Scouting Data</h3>
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  {Object.entries(viewReport.cropData)
                    .filter(([k, v]) => k !== 'crop' && v !== undefined && v !== '' && v !== 0 && v !== false)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="font-medium">{String(v)}</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl my-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Spray Detail</h2>
              <button onClick={() => setViewSpray(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div><span className="text-gray-500">Product:</span> <span className="font-medium">{viewSpray.product}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="font-medium capitalize">{viewSpray.status}</span></div>
              <div><span className="text-gray-500">Priority:</span> <span className="font-medium capitalize">{viewSpray.priority}</span></div>
              <div><span className="text-gray-500">Planned Date:</span> <span className="font-medium">{viewSpray.plannedDate}</span></div>
              {viewSpray.appliedDate && <div><span className="text-gray-500">Applied Date:</span> <span className="font-medium">{viewSpray.appliedDate}</span></div>}
              <div><span className="text-gray-500">Fields:</span> <span className="font-medium">{viewSpray.fieldNumbers.length ? viewSpray.fieldNumbers.join(', ') : 'All fields'}</span></div>
              {viewSpray.notes && <div><span className="text-gray-500">Notes:</span> <span className="font-medium">{viewSpray.notes}</span></div>}
              <Link to="/spray" onClick={() => setViewSpray(null)} className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 pt-2">
                Open in Spray <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {viewSeeding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl my-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Seeding Detail</h2>
              <button onClick={() => setViewSeeding(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div><span className="text-gray-500">Field:</span> <span className="font-medium">{viewSeeding.fieldNumber}</span></div>
              <div><span className="text-gray-500">Crop:</span> <span className="font-medium">{viewSeeding.cropType}</span></div>
              {viewSeeding.variety && <div><span className="text-gray-500">Variety:</span> <span className="font-medium">{viewSeeding.variety}</span></div>}
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewSeeding.seedingDate}</span></div>
              {viewSeeding.seedingRate && <div><span className="text-gray-500">Seeding Rate:</span> <span className="font-medium">{viewSeeding.seedingRate}</span></div>}
              {viewSeeding.notes && <div><span className="text-gray-500">Notes:</span> <span className="font-medium">{viewSeeding.notes}</span></div>}
              <Link to="/seeding-plan" onClick={() => setViewSeeding(null)} className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 pt-2">
                Open in Seeding <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {viewYield && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl my-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Potato Yield Detail</h2>
              <button onClick={() => setViewYield(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div><span className="text-gray-500">Field:</span> <span className="font-medium">{viewYield.fieldNumber}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewYield.date}</span></div>
              <div><span className="text-gray-500">Potato Type:</span> <span className="font-medium">{viewYield.potatoType}</span></div>
              <div><span className="text-gray-500">Estimated Yield:</span> <span className="font-medium">{viewYield.estimatedYield.toFixed(1)} cwt/ac</span></div>
              <Link to="/potato-yield" onClick={() => setViewYield(null)} className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 pt-2">
                Open in Potato Yield <ChevronRight className="h-4 w-4" />
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
