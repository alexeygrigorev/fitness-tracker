import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { SetItem } from '../lib/setItems';
import { DropdownSetItem } from '../lib/setItems';

export interface SetForm {
  weight?: number;
  reps: number;
  editingSubPhase?: 'working' | 'drop';
  editingDropIndex?: number;
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

// Edit form (shared across all types) - uses polymorphism
function SetEditForm({ item, setForm, onSetFormChange, onSubmitSet, onCloseSetForm, onUncompleteSet, onDeleteSet }: {
  item: SetItem;
  setForm: SetForm;
  onSetFormChange: (form: SetForm) => void;
  onSubmitSet: () => void;
  onCloseSetForm: () => void;
  onUncompleteSet: () => void;
  onDeleteSet: () => void;
}) {
  // Warmup sets don't have weight/reps inputs - just complete/uncomplete
  if (item.setType === 'warmup') {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2">
          {item.completed ? (
            <>
              <span className="text-sm text-gray-600">Completed</span>
              <button
                onClick={() => { onUncompleteSet(); onCloseSetForm(); }}
                className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                title="Uncomplete this set"
              >
                Uncomplete
              </button>
            </>
          ) : (
            <button
              onClick={onSubmitSet}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
            >
              Complete
            </button>
          )}
          <button
            onClick={onCloseSetForm}
            className="px-2 py-1.5 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onDeleteSet}
            className="px-2 py-1.5 text-red-500 hover:text-red-700 transition-colors text-sm ml-2"
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
            className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <span className="text-gray-400 text-xs">reps</span>

          <button
            onClick={onSubmitSet}
            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
          >
            Save
          </button>

          {item.completed && (
            <button
              onClick={() => { onUncompleteSet(); onCloseSetForm(); }}
              className="px-2 py-1.5 text-red-500 hover:text-red-700 transition-colors text-sm"
              title="Uncomplete this set"
            >
              Uncomplete
            </button>
          )}

          <button
            onClick={onCloseSetForm}
            className="px-2 py-1.5 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            Cancel
          </button>

          <button
            onClick={onDeleteSet}
            className="px-2 py-1.5 text-red-500 hover:text-red-700 transition-colors text-sm ml-2"
            title="Delete set"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>
    );
  }

  // Normal/dropdown sets have weight+reps inputs
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
              className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <span className="text-gray-400 text-xs">kg</span>
          </>
        )}

        <input
          type="number"
          value={setForm.reps}
          onChange={(e) => onSetFormChange({ ...setForm, reps: parseInt(e.target.value) || 0 })}
          placeholder="reps"
          className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400 text-xs">reps</span>

        <button
          onClick={onSubmitSet}
          className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
        >
          Save
        </button>

        {item.completed && (
          <button
            onClick={() => { onUncompleteSet(); onCloseSetForm(); }}
            className="px-2 py-1.5 text-red-500 hover:text-red-700 transition-colors text-sm"
            title="Uncomplete this set"
          >
            Uncomplete
          </button>
        )}

        <button
          onClick={onCloseSetForm}
          className="px-2 py-1.5 text-gray-500 hover:text-gray-700 transition-colors text-sm"
        >
          Cancel
        </button>

        <button
          onClick={onDeleteSet}
          className="px-2 py-1.5 text-red-500 hover:text-red-700 transition-colors text-sm ml-2"
          title="Delete set"
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      {item.suggestedWeight !== undefined && item.showWeightInput && !item.completed && (
        <div className="text-xs text-gray-400 mt-1">
          Suggested: {item.suggestedWeight} kg
        </div>
      )}
    </div>
  );
}

// Dropdown set row - shows working set + drops in one expandable item
function DropdownSetRow({ item, isEditing, setForm, onOpenSetForm, onSubmitSet, onCloseSetForm, onUncompleteSet, onDeleteSet, onSetFormChange }: SetRowProps & { item: DropdownSetItem }) {
  const ddItem = item as DropdownSetItem;

  // Determine which phase is being edited
  const editingPhase = isEditing ? setForm.editingSubPhase : null;
  const editingDropIndex = isEditing ? setForm.editingDropIndex : null;

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      ddItem.allCompleted
        ? 'border-green-300 bg-green-50'
        : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
              ddItem.allCompleted
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {ddItem.allCompleted ? <FontAwesomeIcon icon={faCheck} className="text-sm" /> : ddItem.setNumber}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{ddItem.exerciseName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Dropdown</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Set {ddItem.setNumber}</span>
                {ddItem.isSuperset && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Superset</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600">{ddItem.completedCount}/{ddItem.totalSets} completed</div>
        </div>
      </div>

      {/* Working set row */}
      <div className={`border-b border-gray-100 ${
        ddItem.workingCompleted ? 'bg-green-50' : 'bg-white'
      }`}>
        {editingPhase === 'working' ? (
          <SetEditForm
            item={{
              ...ddItem,
              weight: ddItem.workingWeight,
              reps: ddItem.workingReps,
              completed: ddItem.workingCompleted
            }}
            setForm={setForm}
            onSetFormChange={onSetFormChange}
            onSubmitSet={onSubmitSet}
            onCloseSetForm={onCloseSetForm}
            onUncompleteSet={onUncompleteSet}
            onDeleteSet={onDeleteSet}
          />
        ) : (
          <div
            onClick={() => !ddItem.workingCompleted && onOpenSetForm(ddItem)}
            className="w-full p-3 flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                ddItem.workingCompleted
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {ddItem.workingCompleted ? <FontAwesomeIcon icon={faCheck} className="text-xs" /> : 'W'}
              </div>
              <span className="text-sm font-medium text-gray-900">Working</span>
              {ddItem.workingCompleted && ddItem.workingWeight && (
                <>
                  <span className="text-sm text-gray-600">{ddItem.workingWeight} kg</span>
                  <span className="text-sm text-gray-600">{ddItem.workingReps} reps</span>
                </>
              )}
            </div>
            {!ddItem.workingCompleted && (
              <span className="text-sm text-gray-400 italic">Click to fill</span>
            )}
          </div>
        )}
      </div>

      {/* Drop rows */}
      {ddItem.drops.map((drop, idx) => (
        <div key={idx} className={`border-b border-gray-100 last:border-b-0 ${
          drop.completed ? 'bg-green-50' : 'bg-white'
        }`}>
          {editingPhase === 'drop' && editingDropIndex === idx ? (
            <SetEditForm
              item={{
                ...ddItem,
                weight: drop.weight,
                reps: drop.reps,
                completed: drop.completed
              }}
              setForm={setForm}
              onSetFormChange={onSetFormChange}
              onSubmitSet={onSubmitSet}
              onCloseSetForm={onCloseSetForm}
              onUncompleteSet={onUncompleteSet}
              onDeleteSet={onDeleteSet}
            />
          ) : (
            <div
              onClick={() => !drop.completed && onOpenSetForm(ddItem)}
              className="w-full p-3 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                  drop.completed
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {drop.completed ? <FontAwesomeIcon icon={faCheck} className="text-xs" /> : `D${idx + 1}`}
                </div>
                <span className="text-sm font-medium text-gray-900">Drop {idx + 1}</span>
                {drop.completed && (
                  <>
                    <span className="text-sm text-gray-600">{drop.weight} kg</span>
                    <span className="text-sm text-gray-600">{drop.reps} reps</span>
                  </>
                )}
              </div>
              {!drop.completed && (
                <span className="text-sm text-gray-400 italic">Click to fill</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Main SetRow component - handles all set types using polymorphism
export default function SetRow({ item, isEditing, setForm, onOpenSetForm, onSubmitSet, onCloseSetForm, onUncompleteSet, onDeleteSet, onSetFormChange }: SetRowProps) {
  // Dropdown sets have special rendering
  if (item.setType === 'dropdown') {
    return (
      <DropdownSetRow
        item={item as DropdownSetItem}
        isEditing={isEditing}
        setForm={setForm}
        onOpenSetForm={onOpenSetForm}
        onSubmitSet={onSubmitSet}
        onCloseSetForm={onCloseSetForm}
        onUncompleteSet={onUncompleteSet}
        onDeleteSet={onDeleteSet}
        onSetFormChange={onSetFormChange}
      />
    );
  }

  // Regular set (warmup, normal, bodyweight)
  return (
    <div
      className={`border rounded-lg transition-all ${
        item.completed
          ? 'border-green-300 bg-green-50'
          : isEditing
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
            : 'border-gray-200 bg-white hover:border-blue-300 cursor-pointer'
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
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {item.completed ? <FontAwesomeIcon icon={faCheck} className="text-sm" /> : item.setDisplayLabel}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{item.exerciseName}</span>
                {item.badgeLabel && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.badgeColor}`}>{item.badgeLabel}</span>
                )}
                {item.isSuperset && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Superset</span>
                )}
                {item.isExtra && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Extra</span>
                )}
              </div>
              {item.setType !== 'warmup' && (
                <div className="text-sm text-gray-500">Set {item.setNumber}</div>
              )}
            </div>

            {item.completed && item.showCompletedData && (
              <div className="flex items-center gap-3 text-sm">
                {!item.isBodyweight && item.weight && (
                  <span className="font-medium text-gray-900">{item.weight} kg</span>
                )}
                <span className="text-gray-600">{item.reps} reps</span>
                {item.completedAt && (
                  <span className="text-gray-400 flex items-center gap-1" title="Completed at">
                    <FontAwesomeIcon icon={faClock} className="text-xs" />
                    {item.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1">
              {!item.completed ? (
                <span className="text-sm text-gray-400 italic">{item.setType === 'warmup' ? 'Click to complete' : 'Click to fill'}</span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onUncompleteSet(); }}
                  className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  title="Uncomplete this set"
                >
                  Uncomplete
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSet(); }}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
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

export type { SetForm };
