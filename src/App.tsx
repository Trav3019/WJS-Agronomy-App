import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import FarmAtGlance from './pages/FarmAtGlance';
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
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import { useAppData } from './hooks/useAppData';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

function App() {
  const { data, updateData, activeSeason, changeSeason, seasonOptions } = useAppData();
  const [authState, setAuthState] = useState<AuthState>('checking');

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        setAuthState(response.ok ? 'authenticated' : 'unauthenticated');
      } catch {
        setAuthState('unauthenticated');
      }
    };

    void verifySession();
  }, []);

  const handleSignIn = async (username: string, password: string, rememberMe: boolean): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username,
          password,
          rememberMe,
        }),
      });

      if (!response.ok) {
        setAuthState('unauthenticated');
        return false;
      }

      setAuthState('authenticated');
      return true;
    } catch {
      setAuthState('unauthenticated');
      return false;
    }
  };

  const handleSignUp = async (username: string, password: string, rememberMe: boolean): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username,
          password,
          rememberMe,
        }),
      });

      if (!response.ok) {
        setAuthState('unauthenticated');
        return false;
      }

      setAuthState('authenticated');
      return true;
    } catch {
      setAuthState('unauthenticated');
      return false;
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setAuthState('unauthenticated');
    }
  };

  const isAuthenticated = authState === 'authenticated';
  const isCheckingAuth = authState === 'checking';

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 text-green-900">
        <p className="text-sm sm:text-base font-medium">Checking session...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/signin"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <SignIn onSignIn={handleSignIn} />
            )
          }
        />
        <Route
          path="/signup"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <SignUp onSignUp={handleSignUp} />
            )
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout
                data={data}
                activeSeason={activeSeason}
                onSeasonChange={changeSeason}
                seasonOptions={seasonOptions}
                onSignOut={handleSignOut}
              />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        >
          <Route index element={<Dashboard data={data} />} />
          <Route path="farm-at-a-glance" element={<FarmAtGlance data={data} />} />
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
