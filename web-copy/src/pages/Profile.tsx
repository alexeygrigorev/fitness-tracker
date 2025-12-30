import { useState } from 'react';
import { faUser, faEnvelope, faDumbbell, faBullseye, faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface UserProfile {
  name: string;
  email: string;
  weight: number;
  height: number;
  age: number;
  goal: 'lose_weight' | 'maintain' | 'gain_muscle';
  weeklyWorkouts: number;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Alex',
    email: 'alex@example.com',
    weight: 79.5,
    height: 178,
    age: 28,
    goal: 'gain_muscle',
    weeklyWorkouts: 4,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(profile);

  const handleSave = () => {
    setProfile(editForm);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm(profile);
    setIsEditing(false);
  };

  const calculateBMI = () => {
    const heightInMeters = profile.height / 100;
    return (profile.weight / (heightInMeters * heightInMeters)).toFixed(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FontAwesomeIcon icon={faCog} className="mr-2" />
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faUser} className="text-4xl text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{profile.name}</h3>
            <p className="text-gray-500 flex items-center justify-center mt-1">
              <FontAwesomeIcon icon={faEnvelope} className="mr-2 text-sm" />
              {profile.email}
            </p>
          </div>
        </div>

        {/* Stats & Settings */}
        <div className="md:col-span-2 space-y-6">
          {/* Physical Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Physical Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Weight</div>
                <div className="text-xl font-bold text-gray-900">
                  {isEditing ? (
                    <input
                      type="number"
                      value={editForm.weight}
                      onChange={e => setEditForm({ ...editForm, weight: Number(e.target.value) })}
                      className="w-24 border border-gray-300 rounded px-2 py-1"
                      step="0.1"
                    />
                  ) : (
                    <>{profile.weight} kg</>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Height</div>
                <div className="text-xl font-bold text-gray-900">
                  {isEditing ? (
                    <input
                      type="number"
                      value={editForm.height}
                      onChange={e => setEditForm({ ...editForm, height: Number(e.target.value) })}
                      className="w-24 border border-gray-300 rounded px-2 py-1"
                    />
                  ) : (
                    <>{profile.height} cm</>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Age</div>
                <div className="text-xl font-bold text-gray-900">
                  {isEditing ? (
                    <input
                      type="number"
                      value={editForm.age}
                      onChange={e => setEditForm({ ...editForm, age: Number(e.target.value) })}
                      className="w-20 border border-gray-300 rounded px-2 py-1"
                    />
                  ) : (
                    <>{profile.age} yrs</>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">BMI</div>
                <div className="text-xl font-bold text-blue-600">
                  {calculateBMI()}
                </div>
              </div>
            </div>
          </div>

          {/* Fitness Goals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FontAwesomeIcon icon={faBullseye} className="mr-2 text-blue-600" />
              Fitness Goals
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Primary Goal</label>
                {isEditing ? (
                  <select
                    value={editForm.goal}
                    onChange={e => setEditForm({ ...editForm, goal: e.target.value as UserProfile['goal'] })}
                    className="ml-2 border border-gray-300 rounded px-3 py-1"
                  >
                    <option value="lose_weight">Lose Weight</option>
                    <option value="maintain">Maintain</option>
                    <option value="gain_muscle">Gain Muscle</option>
                  </select>
                ) : (
                  <div className="font-medium capitalize mt-1">{profile.goal.replace('_', ' ')}</div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-500 flex items-center">
                  <FontAwesomeIcon icon={faDumbbell} className="mr-2" />
                  Weekly Workouts Target
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={editForm.weeklyWorkouts}
                    onChange={e => setEditForm({ ...editForm, weeklyWorkouts: Number(e.target.value) })}
                    className="ml-2 w-20 border border-gray-300 rounded px-2 py-1"
                  />
                ) : (
                  <div className="font-medium mt-1">{profile.weeklyWorkouts} days/week</div>
                )}
              </div>
            </div>
          </div>

          {/* Edit Actions */}
          {isEditing && (
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
