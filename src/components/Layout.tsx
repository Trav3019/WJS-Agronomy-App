import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Rows3, ClipboardList, Sprout, Syringe, CalendarDays, Leaf, Tractor, Wheat, FileText, Archive, Menu, X, LogOut
} from 'lucide-react';
import type { AppData } from '../types';
import { exportExcelData, exportFullDataJson } from '../utils/export';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tillage', label: 'Tillage', icon: Tractor },
  { to: '/seeding', label: 'Seeding', icon: CalendarDays },
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
  activeSeason: string;
  onSeasonChange: (seasonYear: string) => void;
  seasonOptions: string[];
  onSignOut: () => void;
}

export default function Layout({ data, activeSeason, onSeasonChange, seasonOptions, onSignOut }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFarmLogo, setShowFarmLogo] = useState(true);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="flex flex-col min-h-screen bg-green-50">
      {/* Header */}
      <header className="bg-green-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 relative">
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 min-h-14 py-2">
            <div className="flex items-center gap-3 min-w-0">
              {showFarmLogo && (
                <img
                  src="/farm-logo.jpg"
                  alt="Siemens Farming Co Ltd"
                  className="h-10 w-auto rounded bg-white p-1 shadow-sm"
                  onError={() => setShowFarmLogo(false)}
                />
              )}
              <Leaf className="h-6 w-6 text-green-300" />
              <div className="min-w-0">
                <span className="font-bold text-lg tracking-tight block leading-tight">WJ Farm Management</span>
                <span className="text-green-400 text-xs sm:text-sm block truncate">WJ Siemens Farming co</span>
              </div>
            </div>
            <div className="absolute top-2 right-4 sm:static flex items-center gap-2 sm:w-auto">
              <label className="hidden sm:inline text-xs text-green-200">Season</label>
              <select
                className="season-select h-8 rounded-md bg-green-900 border border-green-600 text-sm px-2 text-white"
                value={activeSeason}
                onChange={e => onSeasonChange(e.target.value)}
                aria-label="Select season year"
              >
                {seasonOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button onClick={() => exportExcelData(data)} className="hidden sm:inline-flex px-3 py-1.5 rounded-md bg-green-700 hover:bg-green-600 text-sm font-medium transition-colors">
                Export Excel
              </button>
              <button onClick={() => exportFullDataJson(data)} className="hidden sm:inline-flex px-3 py-1.5 rounded-md bg-green-900 hover:bg-green-950 text-sm font-medium transition-colors">
                Full JSON
              </button>
              <button
                onClick={onSignOut}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-700 hover:bg-red-800 text-sm font-medium transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Nav - Desktop */}
      <nav className="hidden md:block bg-green-700 text-white shadow-md sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-2">
          <div className="flex overflow-x-auto">
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
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Nav - Mobile Hamburger */}
      <div className="md:hidden bg-green-700/95 text-white shadow-md fixed top-14 left-0 right-0 z-40 backdrop-blur-sm">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-green-600 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="text-sm font-medium">Menu</span>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-green-600 bg-green-700 max-h-96 overflow-y-auto">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-l-4 ${
                    isActive
                      ? 'border-green-300 text-white bg-green-600'
                      : 'border-transparent text-green-200 hover:text-white hover:bg-green-600'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-100 hover:bg-red-700 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 pt-[4.25rem] pb-4 sm:py-6 md:pt-4">
        <Outlet />
      </main>

      <footer className="bg-green-800 text-green-300 text-xs text-center py-3 mt-auto">
        WJS Agronomy App &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
