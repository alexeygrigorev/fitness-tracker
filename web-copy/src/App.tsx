import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faDumbbell, faAppleWhole, faBed, faBolt, faUser, faWeightScale, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { Link, NavLink, useLocation, Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Exercises from './pages/Exercises';
import Nutrition from './pages/Nutrition';
import Sleep from './pages/Sleep';
import Metabolism from './pages/Metabolism';
import Profile from './pages/Profile';
import Weight from './pages/Weight';
import Login from './pages/Login';
import Register from './pages/Register';

type Tab = 'dashboard' | 'exercises' | 'nutrition' | 'sleep' | 'metabolism' | 'profile' | 'weight';

const tabs = [
  { id: 'dashboard' as Tab, label: 'Dashboard', icon: faChartBar },
  { id: 'exercises' as Tab, label: 'Exercises', icon: faDumbbell },
  { id: 'nutrition' as Tab, label: 'Nutrition', icon: faAppleWhole },
  { id: 'weight' as Tab, label: 'Weight', icon: faWeightScale },
  { id: 'sleep' as Tab, label: 'Sleep', icon: faBed },
  { id: 'metabolism' as Tab, label: 'Metabolism', icon: faBolt },
  { id: 'profile' as Tab, label: 'Profile', icon: faUser },
];

function App() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentTab = (location.pathname.slice(1) || 'dashboard') as Tab;

  // Auth pages (login/register) have their own layout
  if (location.pathname === '/login' || location.pathname === '/register') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              Fitness Tracker
            </Link>
            <div className="flex items-center gap-4">
              <nav className="flex space-x-1">
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
                        ? 'px-3 py-2 rounded-md text-sm font-medium transition-colors bg-blue-100 text-blue-700'
                        : 'px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100'
                    }
                  >
                    <FontAwesomeIcon icon={tab.icon} className="mr-1" />
                    {tab.label}
                  </NavLink>
                  );
                })}
              </nav>
              <div className="flex items-center gap-3 border-l pl-4">
                <span className="text-sm text-gray-600">{user?.username}</span>
                <button
                  onClick={logout}
                  className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Logout"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <ProtectedRoute>
          {currentTab === 'dashboard' && <Dashboard />}
          {(currentTab === 'workouts' || currentTab.startsWith('workouts/')) && <Exercises />}
          {currentTab === 'nutrition' && <Nutrition />}
          {currentTab === 'sleep' && <Sleep />}
          {currentTab === 'metabolism' && <Metabolism />}
          {currentTab === 'weight' && <Weight />}
          {currentTab === 'profile' && <Profile />}
        </ProtectedRoute>
      </main>
    </div>
  );
}

export default App;
