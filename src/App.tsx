import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { canEdit, canView, defaultApprovedPermissions, fullEditPermissions, normalizePermissions, pageDefinitions } from './access';
import type { AuthUser, AppPageKey } from './access';
import AccessModeShell from './components/AccessModeShell';
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
import UserAccess from './pages/UserAccess';
import { useAppData } from './hooks/useAppData';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';
type AuthResult = { success: boolean; message?: string };

const readOnlyUpdateData = () => undefined;

function NoAccessPage() {
  return (
    <div className="card mx-auto mt-8 max-w-2xl text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-green-900">No Page Access Yet</h1>
      <p className="mt-2 text-sm text-gray-600">
        Your account is approved, but an admin still needs to grant page access.
      </p>
    </div>
  );
}

function App() {
  const { data, updateData, activeSeason, changeSeason, seasonOptions } = useAppData();
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const toAuthUser = (value?: Partial<AuthUser> | null): AuthUser | null => {
    if (!value?.username) return null;
    const isAdmin = Boolean(value.isAdmin);
    return {
      username: value.username,
      createdAt: value.createdAt ?? new Date().toISOString(),
      status: value.status === 'pending' ? 'pending' : 'approved',
      isAdmin,
      permissions: isAdmin
        ? fullEditPermissions
        : normalizePermissions(value.permissions, defaultApprovedPermissions),
    };
  };

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const body = await response.json() as { authenticated: boolean; user?: AuthUser };
          setCurrentUser(toAuthUser(body.user));
          setAuthState('authenticated');
        } else {
          setCurrentUser(null);
          setAuthState('unauthenticated');
        }
      } catch {
        setCurrentUser(null);
        setAuthState('unauthenticated');
      }
    };

    void verifySession();
  }, []);

  const handleSignIn = async (username: string, password: string, rememberMe: boolean): Promise<AuthResult> => {
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
        const body = await response.json().catch(() => null) as { message?: string } | null;
        setCurrentUser(null);
        setAuthState('unauthenticated');
        return { success: false, message: body?.message || 'Sign in failed. Check your credentials and try again.' };
      }

      const body = await response.json() as { authenticated: boolean; user?: AuthUser };
      setCurrentUser(toAuthUser(body.user));
      setAuthState('authenticated');
      return { success: true };
    } catch {
      setCurrentUser(null);
      setAuthState('unauthenticated');
      return { success: false, message: 'Unable to sign in right now.' };
    }
  };

  const handleSignUp = async (username: string, password: string, rememberMe: boolean): Promise<AuthResult> => {
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

      const body = await response.json().catch(() => null) as { authenticated?: boolean; message?: string; user?: AuthUser } | null;

      if (!response.ok) {
        setCurrentUser(null);
        setAuthState('unauthenticated');
        return { success: false, message: body?.message || 'Could not create account right now.' };
      }

      setCurrentUser(null);
      setAuthState('unauthenticated');
      return {
        success: true,
        message: body?.message || 'Account request submitted. An admin must approve your access before you can sign in.',
      };
    } catch {
      setCurrentUser(null);
      setAuthState('unauthenticated');
      return { success: false, message: 'Unable to create account right now.' };
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setCurrentUser(null);
      setAuthState('unauthenticated');
    }
  };

  const isAuthenticated = authState === 'authenticated';
  const isCheckingAuth = authState === 'checking';
  const isAdmin = Boolean(currentUser?.isAdmin);
  const pageMode = (key: AppPageKey) => isAdmin ? 'edit' : currentUser?.permissions[key] ?? 'none';
  const firstAccessibleRoute = pageDefinitions.find((page) => !page.adminOnly && canView(pageMode(page.key)))?.route ?? '/no-access';

  const renderViewOnly = (mode: 'none' | 'view' | 'edit', child: React.ReactElement) => {
    if (!canView(mode)) {
      return <Navigate to={firstAccessibleRoute} replace />;
    }
    return <AccessModeShell mode={mode}>{child}</AccessModeShell>;
  };

  const renderEditable = (
    key: AppPageKey,
    element: React.ReactElement,
    readOnlyElement: React.ReactElement,
  ) => {
    const mode = pageMode(key);
    if (!canView(mode)) {
      return <Navigate to={firstAccessibleRoute} replace />;
    }
    return canEdit(mode) ? element : <AccessModeShell mode={mode}>{readOnlyElement}</AccessModeShell>;
  };

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
                currentUser={currentUser!}
              />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        >
          <Route index element={canView(pageMode('dashboard')) ? <Dashboard data={data} /> : <Navigate to={firstAccessibleRoute} replace />} />
          <Route path="no-access" element={<NoAccessPage />} />
          <Route path="farm-at-a-glance" element={renderViewOnly(pageMode('farmAtGlance'), <FarmAtGlance data={data} />)} />
          <Route path="fields" element={renderEditable('fields', <Fields data={data} updateData={updateData} />, <Fields data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="scouting" element={renderEditable('scouting', <Scouting data={data} updateData={updateData} />, <Scouting data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="potato-yield" element={renderEditable('potatoYield', <PotatoYield data={data} updateData={updateData} />, <PotatoYield data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="spray" element={renderEditable('spray', <SprayPlanner data={data} updateData={updateData} />, <SprayPlanner data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="seeding-plan" element={renderEditable('seedingPlan', <SeedingPlan data={data} updateData={updateData} />, <SeedingPlan data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="seeding" element={renderEditable('seeding', <Seeding data={data} updateData={updateData} />, <Seeding data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="seeding/planter-checks" element={renderEditable('planterChecks', <PlanterChecks data={data} updateData={updateData} />, <PlanterChecks data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="tillage" element={renderEditable('tillage', <Tillage data={data} updateData={updateData} />, <Tillage data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="harvest" element={renderEditable('harvest', <Harvest data={data} updateData={updateData} />, <Harvest data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="potato-storage" element={renderEditable('potatoStorage', <PotatoStorageBins data={data} updateData={updateData} />, <PotatoStorageBins data={data} updateData={readOnlyUpdateData} />)} />
          <Route path="field-summary" element={renderViewOnly(pageMode('fieldSummary'), <FieldSummary data={data} />)} />
          <Route path="user-access" element={isAdmin ? <UserAccess currentUser={currentUser!} /> : <Navigate to={firstAccessibleRoute} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
