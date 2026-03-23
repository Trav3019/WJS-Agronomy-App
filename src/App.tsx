import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Fields from './pages/Fields';
import Scouting from './pages/Scouting';
import PotatoYield from './pages/PotatoYield';
import SprayPlanner from './pages/SprayPlanner';
import Seeding from './pages/Seeding';
import { useAppData } from './hooks/useAppData';

function App() {
  const { data, updateData } = useAppData();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard data={data} />} />
          <Route path="fields" element={<Fields data={data} updateData={updateData} />} />
          <Route path="scouting" element={<Scouting data={data} updateData={updateData} />} />
          <Route path="potato-yield" element={<PotatoYield data={data} updateData={updateData} />} />
          <Route path="spray" element={<SprayPlanner data={data} updateData={updateData} />} />
          <Route path="seeding" element={<Seeding data={data} updateData={updateData} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
