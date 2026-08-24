import { lazy, Suspense, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faDumbbell, faAppleWhole, faBed, faBolt, faUser, faWeightScale, faRightFromBracket, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { Link, NavLink, useLocation, Routes, Route } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ExercisesPage = lazy(() => import('@/workout/ExercisesPage'));
const NutritionPage = lazy(() => import('@/food/NutritionPage'));
const SleepPage = lazy(() => import('@/health/SleepPage'));
const MetabolismPage = lazy(() => import('@/health/MetabolismPage'));
const Profile = lazy(() => import('./pages/Profile'));
const Weight = lazy(() => import('./pages/Weight'));
const LoginPage = lazy(() => import('@/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/auth/RegisterPage'));

type Tab = 'dashboard' | 'exercises' | 'nutrition' | 'sleep' | 'metabolism' | 'profile' | 'weight';

type NavigationTab = {
  id: Tab;
  label: string;
  shortLabel?: string;
  icon: typeof faChartBar;
};

const tabs: NavigationTab[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: faChartBar },
  { id: 'exercises', label: 'Workouts', shortLabel: 'Train', icon: faDumbbell },
  { id: 'nutrition', label: 'Nutrition', shortLabel: 'Food', icon: faAppleWhole },
  { id: 'weight', label: 'Weight', icon: faWeightScale },
  { id: 'sleep', label: 'Sleep', icon: faBed },
  { id: 'metabolism', label: 'Metabolism', shortLabel: 'Meta', icon: faBolt },
  { id: 'profile', label: 'Profile', icon: faUser },
];

function App() {
  const { user, logout, darkMode, toggleDarkMode } = useAuth();
  const location = useLocation();

  // Map pathname to Tab
  const getPathTab = (): Tab => {
    const path = location.pathname;
    if (path === '/' || path === '') return 'dashboard';
    if (path.startsWith('/workouts')) return 'exercises';
    if (path.startsWith('/nutrition')) return 'nutrition';
    return path.slice(1) as Tab;
  };
  const currentTab = getPathTab();

  useEffect(() => {
    const pageTitle =
      location.pathname === '/login'
        ? 'Sign in'
        : location.pathname === '/register'
          ? 'Create account'
          : location.pathname.startsWith('/workouts')
            ? 'Workouts'
            : currentTab === 'dashboard'
              ? 'Dashboard'
              : tabs.find((tab) => tab.id === currentTab)?.label;

    document.title = pageTitle ? `${pageTitle} | Fitness Tracker` : 'Fitness Tracker';
  }, [currentTab, location.pathname]);

  const routeFallback = (
    <div
      aria-busy="true"
      className="flex h-64 items-center justify-center"
    >
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      <span className="sr-only">Loading...</span>
    </div>
  );

  // Auth pages have their own layout
  if (location.pathname === '/login' || location.pathname === '/register') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Suspense fallback={routeFallback}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 pb-16 lg:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            <Link to="/" className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Fitness Tracker
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-4">
              <nav aria-label="Primary" className="flex space-x-1">
                {tabs.map(tab => {
                  const path = tab.id === 'dashboard'
                    ? '/'
                    : tab.id === 'exercises'
                    ? '/workouts'
                    : `/${tab.id}`;
                  return (
                    <NavLink
                      key={tab.id}
                      to={path}
                      className={({ isActive }) =>
                        isActive
                          ? 'px-3 py-2 rounded-md text-sm font-medium transition-colors bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                          : 'px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    >
                      <FontAwesomeIcon icon={tab.icon} className="mr-1" />
                      {tab.label}
                    </NavLink>
                  );
                })}
              </nav>
              <div className="flex items-center gap-3 border-l dark:border-gray-600 pl-4">
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  <FontAwesomeIcon icon={darkMode ? faSun : faMoon} />
                </button>
                <span className="inline-block max-w-28 truncate align-middle text-sm text-gray-600 dark:text-gray-300">
                  {user?.username}
                </span>
                <button
                  onClick={logout}
                  className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Logout"
                  title="Logout"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} />
                </button>
              </div>
            </div>

            {/* Mobile: Dark mode toggle only */}
            <div className="flex lg:hidden">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                <FontAwesomeIcon icon={darkMode ? faSun : faMoon} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 safe-area-bottom"
      >
        <div className="flex items-center justify-around h-16">
          {tabs.map(tab => {
            const path = tab.id === 'dashboard'
              ? '/'
              : tab.id === 'exercises'
              ? '/workouts'
              : `/${tab.id}`;
            const isActive = currentTab === tab.id;
            return (
              <NavLink
                key={tab.id}
                to={path}
                aria-label={tab.label}
                title={tab.label}
                className={({ isActive: navActive }) =>
                  `flex flex-col items-center justify-center w-full h-full px-1 transition-colors touch-manipulation ${
                    navActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`
                }
              >
                <FontAwesomeIcon
                  icon={tab.icon}
                  className={`text-lg mb-1 ${isActive ? 'scale-110' : ''}`}
                />
                <span className="text-[10px] leading-tight">
                  <span className="hidden min-[400px]:inline">{tab.label}</span>
                  <span className="min-[400px]:hidden">{tab.shortLabel ?? tab.label}</span>
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-6xl mx-auto px-4 py-4 md:py-6 focus:outline-none"
      >
        <ProtectedRoute>
          <Suspense fallback={routeFallback}>
            {currentTab === 'dashboard' && <Dashboard />}
            {location.pathname.startsWith('/workouts') && <ExercisesPage />}
            {location.pathname.startsWith('/nutrition') && <NutritionPage />}
            {currentTab === 'sleep' && <SleepPage />}
            {currentTab === 'metabolism' && <MetabolismPage />}
            {currentTab === 'weight' && <Weight />}
            {currentTab === 'profile' && <Profile />}
          </Suspense>
        </ProtectedRoute>
      </main>
    </div>
  );
}

export default App;
