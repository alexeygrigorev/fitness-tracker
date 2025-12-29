import { useEffect, useState } from 'react';
import { sleepApi } from '../api';
import type { SleepEntry } from '../types';

export default function SleepPage() {
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sleepApi.getAll().then(data => {
      setSleepEntries(data);
      setLoading(false);
    });
  }, []);

  const latestSleep = sleepEntries[0];
  const avgQuality = sleepEntries.length > 0
    ? sleepEntries.reduce((sum, s) => sum + s.quality, 0) / sleepEntries.length
    : 0;

  const getQualityColor = (quality: number) => {
    if (quality >= 4) return 'text-green-600';
    if (quality >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityLabel = (quality: number) => {
    if (quality >= 4) return 'Good';
    if (quality >= 3) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  const hoursBetween = (start: Date, end: Date) => {
    return ((new Date(end).getTime() - new Date(start).getTime()) / 3600000).toFixed(1);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Sleep Tracking</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Last Night</div>
          {latestSleep ? (
            <>
              <div className="text-2xl font-bold text-gray-900">{hoursBetween(latestSleep.bedTime, latestSleep.wakeTime)} hrs</div>
              <div className={"text-sm " + getQualityColor(latestSleep.quality)}>
                Quality: {getQualityLabel(latestSleep.quality)} ({latestSleep.quality}/5)
              </div>
            </>
          ) : (
            <div className="text-2xl font-bold text-gray-400">No data</div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Average Quality</div>
          <div className="text-2xl font-bold text-gray-900">{avgQuality.toFixed(1)}/5</div>
          <div className="text-sm text-gray-400">over {sleepEntries.length} nights</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500">Deep Sleep</div>
          {latestSleep?.deepSleepHours ? (
            <>
              <div className="text-2xl font-bold text-purple-600">{latestSleep.deepSleepHours} hrs</div>
              <div className="text-sm text-gray-400">last night</div>
            </>
          ) : (
            <div className="text-2xl font-bold text-gray-400">-</div>
          )}
        </div>
      </div>

      {latestSleep && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sleep Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {latestSleep.deepSleepHours && (
              <div>
                <div className="text-sm text-gray-500">Deep Sleep</div>
                <div className="font-medium text-purple-600">{latestSleep.deepSleepHours} hrs</div>
              </div>
            )}
            {latestSleep.remSleepHours && (
              <div>
                <div className="text-sm text-gray-500">REM Sleep</div>
                <div className="font-medium text-blue-600">{latestSleep.remSleepHours} hrs</div>
              </div>
            )}
            {latestSleep.lightSleepHours && (
              <div>
                <div className="text-sm text-gray-500">Light Sleep</div>
                <div className="font-medium text-green-600">{latestSleep.lightSleepHours} hrs</div>
              </div>
            )}
            {latestSleep.awakeHours && (
              <div>
                <div className="text-sm text-gray-500">Awake</div>
                <div className="font-medium text-gray-600">{latestSleep.awakeHours} hrs</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sleep History</h3>
        <div className="space-y-3">
          {sleepEntries.map(entry => (
            <div key={entry.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">
                    {new Date(entry.bedTime).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(entry.bedTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(entry.wakeTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
                <div className="text-right">
                  <div className={"font-medium " + getQualityColor(entry.quality)}>
                    {getQualityLabel(entry.quality)}
                  </div>
                  <div className="text-sm text-gray-500">{entry.quality}/5</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1">Source: {entry.source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
