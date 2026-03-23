import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { AppData } from '../types';
import WeatherWidget from '../components/WeatherWidget';
import {
  AlertTriangle, ClipboardList, Syringe, Sprout, Rows3, CalendarDays,
  ChevronRight, CheckCircle, Minus
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
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const weekAgo = subDays(today, 6);

  // Today's activity
  const todayScouting = data.scoutingReports.filter(r => r.date === todayStr);
  const todaySpray = data.sprayApplications.filter(a => a.appliedDate === todayStr || a.plannedDate === todayStr);
  const todaySeeding = data.seedingEntries.filter(e => e.seedingDate === todayStr);

  // Weekly scouting
  const weeklyReports = data.scoutingReports.filter(r => {
    try { return isWithinInterval(parseISO(r.date), { start: weekAgo, end: today }); }
    catch { return false; }
  });

  // High priority items
  const highPriorityFields = data.fields.filter(f => f.priority === 'high');
  const highPriorityReports = data.scoutingReports.filter(r => r.priority === 'high').slice(0, 5);
  const pendingHighPrioritySpray = data.sprayApplications.filter(a => a.priority === 'high' && a.status === 'planned');

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
        <Link to="/seeding" className="card hover:shadow-md transition-all hover:border-green-300 group">
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
          {/* High priority items */}
          {(highPriorityFields.length > 0 || highPriorityReports.length > 0 || pendingHighPrioritySpray.length > 0) && (
            <div className="card border-red-200 bg-red-50">
              <h2 className="text-base font-semibold text-red-800 flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5" /> High Priority Items
              </h2>
              <div className="space-y-2">
                {highPriorityFields.map(f => (
                  <Link key={f.id} to="/fields" className="flex items-center gap-2 text-sm text-red-700 hover:text-red-900 bg-red-100 rounded-lg p-2.5">
                    <Rows3 className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Field {f.fieldNumber}</span>
                    <span className="text-red-500">— {f.cropType} {f.variety ? `(${f.variety})` : ''}</span>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Link>
                ))}
                {highPriorityReports.map(r => (
                  <Link key={r.id} to="/scouting" className="flex items-center gap-2 text-sm text-red-700 hover:text-red-900 bg-red-100 rounded-lg p-2.5">
                    <ClipboardList className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Field {r.fieldNumber}</span>
                    <span className="text-red-500">— Scouting {r.date}</span>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Link>
                ))}
                {pendingHighPrioritySpray.map(a => (
                  <Link key={a.id} to="/spray" className="flex items-center gap-2 text-sm text-red-700 hover:text-red-900 bg-red-100 rounded-lg p-2.5">
                    <Syringe className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{a.product}</span>
                    <span className="text-red-500">— Fields: {a.fieldNumbers.join(', ')}</span>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Today's activity */}
          <div className="card">
            <h2 className="text-base font-semibold text-green-800 mb-3">Today's Activity</h2>
            {todayScouting.length === 0 && todaySpray.length === 0 && todaySeeding.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No activity recorded today.</p>
            ) : (
              <div className="space-y-2">
                {todayScouting.map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-sm bg-blue-50 rounded-lg p-2.5">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                    <span>Scouted <span className="font-medium">Field {r.fieldNumber}</span> — {r.cropType}</span>
                  </div>
                ))}
                {todaySpray.map(a => (
                  <div key={a.id} className={`flex items-center gap-2 text-sm rounded-lg p-2.5 ${a.appliedDate === todayStr ? 'bg-green-50' : 'bg-purple-50'}`}>
                    <Syringe className={`h-4 w-4 ${a.appliedDate === todayStr ? 'text-green-600' : 'text-purple-600'}`} />
                    <span>
                      {a.appliedDate === todayStr ? 'Applied' : 'Planned'}: <span className="font-medium">{a.product}</span>
                      {a.fieldNumbers.length > 0 && ` — Fields: ${a.fieldNumbers.join(', ')}`}
                    </span>
                  </div>
                ))}
                {todaySeeding.map(e => (
                  <div key={e.id} className="flex items-center gap-2 text-sm bg-amber-50 rounded-lg p-2.5">
                    <CalendarDays className="h-4 w-4 text-amber-600" />
                    <span>Seeded <span className="font-medium">Field {e.fieldNumber}</span> — {e.cropType}</span>
                  </div>
                ))}
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
                    <div key={r.id} className="flex items-center gap-2 text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0">
                      <span className="text-base">{CROP_EMOJI[r.cropType] ?? '🌿'}</span>
                      <span className="font-medium">Field {r.fieldNumber}</span>
                      <span className="text-gray-400">{r.date}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded-full text-xs font-medium capitalize ${r.priority === 'high' ? 'priority-high' : r.priority === 'medium' ? 'priority-medium' : 'priority-low'}`}>
                        {r.priority}
                      </span>
                    </div>
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
                  <div key={a.id} className={`flex items-center gap-3 text-sm rounded-lg p-2.5 ${a.priority === 'high' ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <Syringe className={`h-4 w-4 shrink-0 ${a.priority === 'high' ? 'text-red-500' : 'text-purple-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.product}</div>
                      <div className="text-xs text-gray-500">
                        {a.plannedDate} · {a.fieldNumbers.length > 0 ? `Fields: ${a.fieldNumbers.join(', ')}` : 'All fields'}
                      </div>
                    </div>
                  </div>
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
                <div key={r.id} className="flex items-center gap-3 bg-orange-50 rounded-lg p-2.5 text-sm">
                  <span className="text-2xl">🥔</span>
                  <div className="flex-1">
                    <div className="font-medium">Field {r.fieldNumber}</div>
                    <div className="text-xs text-gray-500">{r.date} · {r.potatoType}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-700">{r.estimatedYield.toFixed(0)}</div>
                    <div className="text-xs text-gray-500">lbs/ac</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/potato-yield" className="mt-3 text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
            View all yield reports <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Field priority overview */}
      {data.fields.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-green-800 flex items-center gap-2">
              <Rows3 className="h-5 w-5" /> Field Priority Overview
            </h2>
            <Link to="/fields" className="text-xs text-green-700 hover:text-green-900 flex items-center gap-1">
              Manage fields <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.fields
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.priority] - order[b.priority];
              })
              .map(field => (
                <div key={field.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5 text-sm">
                  {field.priority === 'high' ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    : field.priority === 'medium' ? <Minus className="h-4 w-4 text-yellow-500 shrink-0" />
                    : <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                  <span className="font-medium text-gray-800">{field.fieldNumber}</span>
                  <span className="text-gray-500 text-xs">{CROP_EMOJI[field.cropType]} {field.cropType}</span>
                  {field.acres > 0 && <span className="ml-auto text-xs text-gray-400">{field.acres.toFixed(0)}ac</span>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
