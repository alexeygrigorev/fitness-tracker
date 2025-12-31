import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { SetItem } from '../workout/setItems';
import { DropdownSetItem } from '../workout/setItems';

export interface SetForm {
  weight?: number;
  reps: number;
  subSets?: Array<{ weight: number; reps: number; completed: boolean }>;
}

interface SetRowProps {
  item: SetItem;
  isEditing: boolean;
  setForm: SetForm;
  onOpenSetForm: (item: SetItem) => void;
  onSubmitSet: () => void;
  onCloseSetForm: () => void;
  onUncompleteSet: () => void;
  onDeleteSet: () => void;
  onSetFormChange: (form: SetForm) => void;
}

// Edit form (shared across all types)
function SetEditForm({ item, setForm, onSetFormChange, onSubmitSet, onCloseSetForm, onUncompleteSet, onDeleteSet }: {
  item: SetItem;
  setForm: SetForm;
  onSetFormChange: (form: SetForm) => void;
  onSubmitSet: () => void;
  onCloseSetForm: () => void;
  onUncompleteSet: () => void;
  onDeleteSet: () => void;
}) {
  // Dropdown sets have multiple sub-sets - show inputs for each
  if (item.setType === 'dropdown') {
    const ddItem = item as DropdownSetItem;
    return (
      <div className="p-3 space-y-2">
        {ddItem.subSets.map((subSet, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-6">{idx === 0 ? 'W' : `D${idx}`}</span>
            <input
              type="number"
              value={setForm.subSets?.[idx]?.weight ?? subSet.weight}
              onChange={(e) => {
                const newWeight = parseFloat(e.target.value) || 0;
                const newSubSets = [...(setForm.subSets || ddItem.subSets)];
                newSubSets[idx] = { ...newSubSets[idx], weight: newWeight };
                onSetFormChange({ ...setForm, subSets: newSubSets });
              }}
              placeholder="kg"
              className="w-16 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 dark:text-gray-500 text-xs">kg</span>
            <input
              type="number"
              value={setForm.subSets?.[idx]?.reps ?? subSet.reps}
              onChange={(e) => {
                const newReps = parseInt(e.target.value) || 0;
                const newSubSets = [...(setForm.subSets || ddItem.subSets)];
                newSubSets[idx] = { ...newSubSets[idx], reps: newReps };
                onSetFormChange({ ...setForm, subSets: newSubSets });
              }}
              placeholder="reps"
              className="w-14 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 dark:text-gray-500 text-xs">reps</span>
          </div>
        ))}

        <EditFormActions
          item={item}
          onSubmitSet={onSubmitSet}
          onUncompleteSet={onUncompleteSet}
          onCloseSetForm={onCloseSetForm}
          onDeleteSet={onDeleteSet}
        />
      </div>
    );
  }

  // Warmup sets don't have weight/reps inputs - just complete/uncomplete
  if (item.setType === 'warmup') {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2">
          {item.completed ? (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-300">Completed</span>
              <button
                type="button"
                onClick={() => { onUncompleteSet(); onCloseSetForm(); }}
                className="px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                title="Uncomplete this set"
              >
                Uncomplete
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onSubmitSet}
              className="px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded text-sm hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
            >
              Complete
            </button>
          )}
          <button
            type="button"
            onClick={onCloseSetForm}
            className="px-2 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onDeleteSet}
            className="px-2 py-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors text-sm ml-2"
            title="Delete set"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>
    );
  }

  // Bodyweight sets - only reps input
  if (item.setType === 'bodyweight') {
    return (
      <div className="p-3">
        <div
          className="flex items-center gap-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmitSet();
            if (e.key === 'Escape') onCloseSetForm();
          }}
        >
          <input
            type="number"
            value={setForm.reps}
            onChange={(e) => onSetFormChange({ ...setForm, reps: parseInt(e.target.value) || 0 })}
            placeholder="reps"
            className="w-14 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <span className="text-gray-400 dark:text-gray-500 text-xs">reps</span>

          <EditFormActions
            item={item}
            onSubmitSet={onSubmitSet}
            onUncompleteSet={onUncompleteSet}
            onCloseSetForm={onCloseSetForm}
            onDeleteSet={onDeleteSet}
          />
        </div>
      </div>
    );
  }

  // Normal sets have weight+reps inputs
  return (
    <div className="p-3">
      <div
        className="flex items-center gap-2"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmitSet();
          if (e.key === 'Escape') onCloseSetForm();
        }}
      >
        {item.showWeightInput && (
          <>
            <input
              type="number"
              value={setForm.weight ?? ''}
              onChange={(e) => onSetFormChange({ ...setForm, weight: parseFloat(e.target.value) || undefined })}
              placeholder="kg"
              className="w-16 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <span className="text-gray-400 dark:text-gray-500 text-xs">kg</span>
          </>
        )}

        <input
          type="number"
          value={setForm.reps}
          onChange={(e) => onSetFormChange({ ...setForm, reps: parseInt(e.target.value) || 0 })}
          placeholder="reps"
          className="w-14 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400 dark:text-gray-500 text-xs">reps</span>

        <EditFormActions
          item={item}
          onSubmitSet={onSubmitSet}
          onUncompleteSet={onUncompleteSet}
          onCloseSetForm={onCloseSetForm}
          onDeleteSet={onDeleteSet}
        />
      </div>
    </div>
  );
}

// Shared action buttons for edit form
function EditFormActions({ item, onSubmitSet, onUncompleteSet, onCloseSetForm, onDeleteSet }: {
  item: SetItem;
  onSubmitSet: () => void;
  onUncompleteSet: () => void;
  onCloseSetForm: () => void;
  onDeleteSet: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onSubmitSet}
        className="px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded text-sm hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
      >
        Save
      </button>

      {item.completed && (
        <button
          type="button"
          onClick={() => { onUncompleteSet(); onCloseSetForm(); }}
          className="px-2 py-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors text-sm"
          title="Uncomplete this set"
        >
          Uncomplete
        </button>
      )}

      <button
        type="button"
        onClick={onCloseSetForm}
        className="px-2 py-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={onDeleteSet}
        className="px-2 py-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors text-sm ml-2"
        title="Delete set"
      >
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </>
  );
}

// Shared display for completed data - uses polymorphism from SetItem
function CompletedDataDisplay({ item }: { item: SetItem }) {
  const displayData = item.getCompletedDisplay();

  if (displayData.length === 0) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      {displayData.map((data, idx) => {
        if ('isTimestamp' in data) {
          return (
            <span key={idx} className="text-gray-400 dark:text-gray-500 flex items-center gap-1" title="Completed at">
              <FontAwesomeIcon icon={faClock} className="text-xs" />
              {data.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          );
        }
        return (
          <span key={idx} className={data.className}>
            {data.text}
          </span>
        );
      })}
    </div>
  );
}

// Main SetRow component - unified for all set types
export default function SetRow({ item, isEditing, setForm, onOpenSetForm, onSubmitSet, onCloseSetForm, onUncompleteSet, onDeleteSet, onSetFormChange }: SetRowProps) {
  // Common display label (circle content)
  const displayLabel = item.completed
    ? <FontAwesomeIcon icon={faCheck} className="text-sm" />
    : item.setType === 'warmup'
      ? 'W'
      : item.setDisplayLabel;

  // Common set number display
  const setNumberDisplay = item.setType === 'warmup' ? null : <div className="text-sm text-gray-500 dark:text-gray-400">Set {item.setNumber}</div>;

  return (
    <div
      className={`border rounded-lg transition-all ${
        item.completed
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
          : isEditing
            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer'
      }`}
    >
      {isEditing ? (
        <SetEditForm
          item={item}
          setForm={setForm}
          onSetFormChange={onSetFormChange}
          onSubmitSet={onSubmitSet}
          onCloseSetForm={onCloseSetForm}
          onUncompleteSet={onUncompleteSet}
          onDeleteSet={onDeleteSet}
        />
      ) : (
        <div
          onClick={() => onOpenSetForm(item)}
          className="w-full p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
              item.completed
                ? 'bg-green-500 dark:bg-green-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
            }`}>
              {displayLabel}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-gray-100">{item.exerciseName}</span>
                {item.badgeLabel && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.badgeColor}`}>{item.badgeLabel}</span>
                )}
                {item.isSuperset && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300">Superset</span>
                )}
                {item.isExtra && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">Extra</span>
                )}
              </div>
              {setNumberDisplay}
            </div>

            {item.completed && item.showCompletedData && (
              <CompletedDataDisplay item={item} />
            )}

            <div className="flex items-center gap-1">
              {!item.completed ? (
                <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                  {item.setType === 'warmup' ? 'Click to complete' : 'Click to fill'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUncompleteSet(); }}
                  className="px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                  title="Uncomplete this set"
                >
                  Uncomplete
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteSet(); }}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Delete set"
              >
                <FontAwesomeIcon icon={faTrash} className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
