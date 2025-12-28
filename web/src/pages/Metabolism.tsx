import { useEffect, useState } from 'react';
import { metabolismApi, adviceApi } from '../lib/api';
import type { MetabolismState, Advice } from '../lib/types';

export default function Metabolism() {
  const [metabolism, setMetabolism] = useState<MetabolismState | null>(null);
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([metabolismApi.getCurrent(), adviceApi.getActive()]).then(([meta, adv]) => {
      setMetabolism(meta);
      setAdvice(adv);
      setLoading(false);
    });
  }, []);

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('optimal') || s.includes('good') || s.includes('full') || s.includes('high')) return 'text-green-600 bg-green-50';
    if (s.includes('moderate') || s.includes('fair')) return 'text-yellow-600 bg-yellow-50';
    if (s.includes('low') || s.includes('poor') || s.includes('depleted') || s.includes('very')) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const handleAcknowledge = async (id: string) => {
    await adviceApi.acknowledge(id);
    setAdvice(prev => prev.filter(a => a.id !== id));
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Metabolism & Recovery</h2>

      {metabolism && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current State</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={"p-4 rounded-lg " + getStatusColor(metabolism.energyAvailability)}>
              <div className="text-sm opacity-75">Energy Availability</div>
              <div className="font-semibold capitalize">{metabolism.energyAvailability.replace('_', ' ')}</div>
            </div>
            <div className={"p-4 rounded-lg " + getStatusColor(metabolism.glycogenStatus)}>
              <div className="text-sm opacity-75">Glycogen Status</div>
              <div className="font-semibold capitalize">{metabolism.glycogenStatus}</div>
            </div>
            <div className={"p-4 rounded-lg " + getStatusColor(metabolism.insulinActivity)}>
              <div className="text-sm opacity-75">Insulin Activity</div>
              <div className="font-semibold capitalize">{metabolism.insulinActivity}</div>
            </div>
            <div className={"p-4 rounded-lg " + getStatusColor(metabolism.recoveryStatus)}>
              <div className="text-sm opacity-75">Recovery Status</div>
              <div className="font-semibold capitalize">{metabolism.recoveryStatus}</div>
            </div>
          </div>
        </div>
      )}

      {advice.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Advice</h3>
          <div className="space-y-4">
            {advice.map(item => (
              <div key={item.id} className={"p-4 rounded-lg border-l-4 " + (item.priority === 'high' ? 'border-red-500 bg-red-50' : item.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' : 'border-blue-500 bg-blue-50')}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{item.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{item.message}</div>
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Why?</summary>
                      <p className="text-xs text-gray-500 mt-1 pl-2">{item.reasoning}</p>
                    </details>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(item.id)}
                    className="ml-4 px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Understanding Your Metabolism</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Energy Availability</h4>
            <p>Reflects whether your body has enough energy to support training and recovery. Low availability may indicate need for more calories or rest.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Glycogen Status</h4>
            <p>Shows stored carbohydrate in muscles and liver. Depleted glycogen can hurt performance and slow recovery.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Insulin Activity</h4>
            <p>Indicates how your body is processing nutrients. Higher activity around meals supports muscle protein synthesis.</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Recovery Status</h4>
            <p>Combines sleep quality, recent training volume, and energy availability to estimate your readiness for hard training.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
