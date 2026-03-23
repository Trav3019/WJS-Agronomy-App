import { useState, useCallback } from 'react';
import type { AppData } from '../types';
import { loadData, saveData } from '../utils/storage';

export function useAppData() {
  const [data, setData] = useState<AppData>(() => loadData());

  const updateData = useCallback((updater: (prev: AppData) => AppData) => {
    setData(prev => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  return { data, updateData };
}
