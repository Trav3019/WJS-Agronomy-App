import { useCallback, useMemo, useState } from 'react';
import type { AppData } from '../types';
import {
  getActiveSeasonYear,
  getAvailableSeasonYears,
  getCurrentSeasonYear,
  loadData,
  saveData,
  setActiveSeasonYear,
} from '../utils/storage';

export function useAppData() {
  const [activeSeason, setActiveSeason] = useState<string>(() => getActiveSeasonYear());
  const [data, setData] = useState<AppData>(() => loadData(activeSeason));

  const updateData = useCallback((updater: (prev: AppData) => AppData) => {
    setData(prev => {
      const next = updater(prev);
      saveData(next, activeSeason);
      return next;
    });
  }, [activeSeason]);

  const changeSeason = useCallback((seasonYear: string) => {
    setActiveSeasonYear(seasonYear);
    setActiveSeason(seasonYear);
    setData(loadData(seasonYear));
  }, []);

  const seasonOptions = useMemo(() => {
    const years = new Set(getAvailableSeasonYears());
    const current = Number(getCurrentSeasonYear());
    for (let offset = -2; offset <= 2; offset += 1) {
      years.add(String(current + offset));
    }
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [activeSeason, data]);

  return { data, updateData, activeSeason, changeSeason, seasonOptions };
}
