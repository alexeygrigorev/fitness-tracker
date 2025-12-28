import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faDumbbell, faAppleWhole, faBed, faBolt, faUser, faWeightScale } from '@fortawesome/free-solid-svg-icons';
import Dashboard from './pages/Dashboard';
import Exercises from './pages/Exercises';
import Nutrition from './pages/Nutrition';
import Sleep from './pages/Sleep';
import Metabolism from './pages/Metabolism';
import Profile from './pages/Profile';
import Weight from './pages/Weight';

type Tab = 'dashboard' | 'exercises' | 'nutrition' | 'sleep' | 'metabolism' | 'profile' | 'weight';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: faChartBar },
    { id: 'exercises' as Tab, label: 'Exercises', icon: faDumbbell },
    { id: 'nutrition' as Tab, label: 'Nutrition', icon: faAppleWhole },
    { id: 'weight' as Tab, label: 'Weight', icon: faWeightScale },
    { id: 'sleep' as Tab, label: 'Sleep', icon: faBed },
    { id: 'metabolism' as Tab, label: 'Metabolism', icon: faBolt },
    { id: 'profile' as Tab, label: 'Profile', icon: faUser },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">Fitness Tracker</h1>
            <nav className="flex space-x-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={activeTab === tab.id ? 'px-3 py-2 rounded-md text-sm font-medium transition-colors bg-blue-100 text-blue-700' : 'px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100'}
                >
                  <FontAwesomeIcon icon={tab.icon} className="mr-1" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'exercises' && <Exercises />}
        {activeTab === 'nutrition' && <Nutrition />}
        {activeTab === 'sleep' && <Sleep />}
        {activeTab === 'metabolism' && <Metabolism />}
        {activeTab === 'weight' && <Weight />}
        {activeTab === 'profile' && <Profile />}
      </main>
    </div>
  );
}

export default App;
