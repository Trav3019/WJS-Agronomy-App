import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AppData } from '../types';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const BIN_LAYOUT = ['M1', 'M2', 'M3', 'M4', 'CL1', 'CL2', 'J2', 'J3', 'J4'];

const BIN_CAPACITY: Record<string, number> = {
  M1: 32000,
  M2: 50000,
  M3: 70000,
  M4: 70000,
  CL1: 50000,
  CL2: 70000,
  J2: 40000,
  J3: 70000,
  J4: 70000,
};

export default function PotatoStorageBins({ data, updateData }: Props) {
  const [showAddBin, setShowAddBin] = useState(false);
  const [newBinName, setNewBinName] = useState('');
  const [newBinCapacity, setNewBinCapacity] = useState('');
  const [addBinError, setAddBinError] = useState('');

  const customBins: string[] = data.customBins ?? [];
  const customBinCapacities: Record<string, number> = data.customBinCapacities ?? {};
  const allBins = [...BIN_LAYOUT, ...customBins];

  function handleAddBin() {
    const name = newBinName.trim().toUpperCase();
    if (!name) { setAddBinError('Bin name is required.'); return; }
    if (allBins.includes(name)) { setAddBinError(`Bin "${name}" already exists.`); return; }
    const capValue = newBinCapacity.trim() ? parseInt(newBinCapacity.trim(), 10) : undefined;
    if (newBinCapacity.trim() && (isNaN(capValue!) || capValue! <= 0)) {
      setAddBinError('Capacity must be a positive number.');
      return;
    }
    updateData(prev => ({
      ...prev,
      customBins: [...(prev.customBins ?? []), name],
      customBinCapacities: capValue !== undefined
        ? { ...(prev.customBinCapacities ?? {}), [name]: capValue }
        : (prev.customBinCapacities ?? {}),
    }));
    setNewBinName('');
    setNewBinCapacity('');
    setAddBinError('');
    setShowAddBin(false);
  }

  function handleDeleteCustomBin(binName: string) {
    updateData(prev => {
      const caps = { ...(prev.customBinCapacities ?? {}) };
      delete caps[binName];
      return { ...prev, customBins: (prev.customBins ?? []).filter(b => b !== binName), customBinCapacities: caps };
    });
  }

  const potatoHarvestByBin = useMemo(() => {
    const byBin = new Map<string, Array<{
      id: string;
      date: string;
      fieldId: string;
      fieldNumber: string;
      variety?: string;
      cwt: number;
      quality?: string;
      tuberTemp?: number;
      tuberDefects?: string[];
    }>>();

    data.harvestReports
      .filter(r => r.cropType === 'Potatoes' && r.binNumber)
      .forEach(r => {
        const bin = (r.binNumber ?? '').trim().toUpperCase();
        if (!bin) return;
        const cwt = r.totalCwt ?? r.yieldValue ?? 0;
        const seedingVariety = [...data.seedingEntries]
          .filter(entry => entry.fieldId === r.fieldId && entry.variety)
          .sort((a, b) => b.seedingDate.localeCompare(a.seedingDate))[0]?.variety;
        const fieldVariety = data.fields.find(field => field.id === r.fieldId)?.variety;
        const arr = byBin.get(bin) ?? [];
        arr.push({
          id: r.id,
          date: r.date,
          fieldId: r.fieldId,
          fieldNumber: r.fieldNumber,
          variety: r.variety || seedingVariety || fieldVariety || undefined,
          cwt,
          quality: r.quality,
          tuberTemp: r.tuberTemp,
          tuberDefects: r.tuberDefects,
        });
        byBin.set(bin, arr);
      });

    return byBin;
  }, [data.harvestReports, data.seedingEntries, data.fields]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Potato Storage Bins</h1>
          <p className="text-sm text-gray-500 mt-1">Bin layout auto-populates from Potato Harvest entries by selected Bin #.</p>
        </div>
        <button
          onClick={() => { setShowAddBin(true); setNewBinName(''); setAddBinError(''); }}
          className="btn-primary flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Bin
        </button>
      </div>

      {showAddBin && (
        <div className="card border-green-300 bg-green-50/40">
          <h2 className="font-semibold text-green-900 mb-3">New Bin</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bin Name</label>
              <input
                type="text"
                value={newBinName}
                onChange={e => { setNewBinName(e.target.value); setAddBinError(''); }}
                placeholder="e.g. M5, CL3, J5"
                className="input w-full"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (CWT)</label>
              <input
                type="number"
                value={newBinCapacity}
                onChange={e => { setNewBinCapacity(e.target.value); setAddBinError(''); }}
                placeholder="e.g. 50000"
                className="input w-full"
                min={1}
                onKeyDown={e => e.key === 'Enter' && handleAddBin()}
              />
            </div>
            <div className="flex gap-2 pb-0.5">
              <button onClick={handleAddBin} className="btn-primary">Save</button>
              <button onClick={() => { setShowAddBin(false); setAddBinError(''); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
          {addBinError && <p className="text-red-600 text-xs mt-2">{addBinError}</p>}
        </div>
      )}

      <div className="card bg-blue-50 border-blue-200 text-sm text-blue-900">
        Saving a Potato Harvest report with Bin # and Total CWT automatically updates these bins.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allBins.map(binNumber => {
          const isCustom = !BIN_LAYOUT.includes(binNumber);
          const loads = (potatoHarvestByBin.get(binNumber) ?? []).sort((a, b) => b.date.localeCompare(a.date));
          const totalCwt = loads.reduce((sum, load) => sum + load.cwt, 0);
          const capacity = BIN_CAPACITY[binNumber] ?? customBinCapacities[binNumber] ?? null;
          const fillPct = capacity ? Math.min(100, (totalCwt / capacity) * 100) : null;
          const remaining = capacity !== null ? capacity - totalCwt : null;

          return (
            <div key={binNumber} className={`card transition-shadow ${loads.length > 0 ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-green-900">
                    {binNumber}
                    {isCustom && <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Custom</span>}
                  </div>
                  <div className="text-xs text-gray-500">{loads.length} load{loads.length === 1 ? '' : 's'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-xs px-2 py-0.5 rounded-full ${loads.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {loads.length > 0 ? 'Filled' : 'Empty'}
                  </div>
                  {isCustom && (
                    <button
                      onClick={() => handleDeleteCustomBin(binNumber)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Remove custom bin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {capacity !== null && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Capacity: <span className="font-medium text-gray-700">{capacity.toLocaleString()} CWT</span></span>
                    <span>{fillPct!.toFixed(1)}% full</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        fillPct! >= 90 ? 'bg-red-500' : fillPct! >= 60 ? 'bg-yellow-400' : 'bg-green-500'
                      }`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Remaining: <span className="font-medium text-gray-700">{remaining!.toLocaleString()} CWT</span>
                  </div>
                </div>
              )}

              <div className="mt-3 text-sm">
                {loads.length > 0 ? (
                  <div>
                    <div className="text-gray-500 mb-2">Total CWT: <span className="font-semibold text-gray-800">{totalCwt.toFixed(1)}</span></div>
                    <div className="text-gray-500 mb-2">Entry Breakdown</div>
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {loads.map(load => (
                        <div key={load.id} className="rounded-md border border-gray-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-gray-900">{load.variety ?? 'Unknown Variety'}</span>
                            <span className="text-gray-500">{load.cwt.toFixed(1)} CWT</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {load.date} · Field {load.fieldNumber}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Quality: {load.quality ?? '-'} · Temp: {load.tuberTemp !== undefined ? `${load.tuberTemp} C` : '-'}
                          </div>
                          {load.tuberDefects?.length ? (
                            <div className="text-xs text-gray-600 mt-1">
                              Defects: {load.tuberDefects.join(', ')}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
