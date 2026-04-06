import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Rows3, ClipboardList, Sprout, Syringe, CalendarDays, Leaf, Tractor, Wheat, FileText, Archive
} from 'lucide-react';
import type { AppData } from '../types';
import { exportAiDataJson, exportExcelData, exportFullDataJson } from '../utils/export';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tillage', label: 'Tillage', icon: Tractor },
  { to: '/seeding', label: 'Seeding', icon: CalendarDays, end: true },
  { to: '/scouting', label: 'Scouting', icon: ClipboardList },
  { to: '/spray', label: 'Spray Plan', icon: Syringe },
  { to: '/potato-yield', label: 'Potato Yield', icon: Sprout },
  { to: '/harvest', label: 'Harvest', icon: Wheat },
  { to: '/potato-storage', label: 'Potato Storage', icon: Archive },
  { to: '/field-summary', label: 'Field Summary', icon: FileText },
  { to: '/seeding-plan', label: 'Seeding Plan', icon: CalendarDays, end: true },
  { to: '/fields', label: 'Fields', icon: Rows3 },
];

interface Props {
  data: AppData;
}

export default function Layout({ data }: Props) {
  return (
    <div className="flex flex-col min-h-screen bg-green-50">
      {/* Header */}
      <header className="bg-green-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between gap-3 min-h-14 py-2">
            <div className="flex items-center gap-3">
              <Leaf className="h-6 w-6 text-green-300" />
              <span className="font-bold text-lg tracking-tight">WJS Agronomy</span>
              <span className="text-green-400 text-sm hidden sm:block">Farm Scouting & Management</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => exportAiDataJson(data)} className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-sm font-medium transition-colors">
                Export AI JSON
              </button>
              <button onClick={() => exportExcelData(data)} className="px-3 py-1.5 rounded-md bg-green-700 hover:bg-green-600 text-sm font-medium transition-colors">
                Export Excel
              </button>
              <button onClick={() => exportFullDataJson(data)} className="hidden sm:inline-flex px-3 py-1.5 rounded-md bg-green-900 hover:bg-green-950 text-sm font-medium transition-colors">
                Full JSON
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-green-700 text-white shadow-md sticky top-14 z-40 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-2">
          <div className="flex">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 min-h-[48px] ${
                    isActive
                      ? 'border-green-300 text-white bg-green-600'
                      : 'border-transparent text-green-200 hover:text-white hover:bg-green-600'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </main>

      <footer className="bg-green-800 text-green-300 text-xs text-center py-3 mt-auto">
        WJS Agronomy App &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
