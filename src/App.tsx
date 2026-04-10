import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Fields from './pages/Fields';
import Scouting from './pages/Scouting';
import PotatoYield from './pages/PotatoYield';
import SprayPlanner from './pages/SprayPlanner';
import Seeding from './pages/Seeding';
import SeedingPlan from './pages/SeedingPlan';
import PlanterChecks from './pages/PlanterChecks.tsx';
import Tillage from './pages/Tillage';
import Harvest from './pages/Harvest';
import FieldSummary from './pages/FieldSummary';
import PotatoStorageBins from './pages/PotatoStorageBins';
import { useAppData } from './hooks/useAppData';

function App() {
  const { data, updateData, activeSeason, changeSeason, seasonOptions } = useAppData();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Layout data={data} activeSeason={activeSeason} onSeasonChange={changeSeason} seasonOptions={seasonOptions} />}
        >
          <Route index element={<Dashboard data={data} />} />
          <Route path="fields" element={<Fields data={data} updateData={updateData} />} />
          <Route path="scouting" element={<Scouting data={data} updateData={updateData} />} />
          <Route path="potato-yield" element={<PotatoYield data={data} updateData={updateData} />} />
          <Route path="spray" element={<SprayPlanner data={data} updateData={updateData} />} />
          <Route path="seeding-plan" element={<SeedingPlan data={data} updateData={updateData} />} />
          <Route path="seeding" element={<Seeding data={data} updateData={updateData} />} />
          <Route path="seeding/planter-checks" element={<PlanterChecks data={data} updateData={updateData} />} />
          <Route path="tillage" element={<Tillage data={data} updateData={updateData} />} />
          <Route path="harvest" element={<Harvest data={data} updateData={updateData} />} />
          <Route path="potato-storage" element={<PotatoStorageBins data={data} updateData={updateData} />} />
          <Route path="field-summary" element={<FieldSummary data={data} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
