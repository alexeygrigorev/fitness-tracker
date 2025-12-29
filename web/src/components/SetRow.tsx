import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { SetItem } from '../lib/setItems';
import { DropdownSetItem } from '../lib/setItems';

export interface SetForm {
  weight?: number;
  reps: number;
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
            <span className="text-xs text-gray-500 w-6">{idx === 0 ? 'W' : `D${idx}`}</span>
            <input
              type="number"
              value={subSet.completed ? subSet.weight : (setForm.weight ?? subSet.weight)}
              onChange={(e) => {
                const newWeight = parseFloat(e.target.value) || 0;
                // Update the specific sub-set in the form
                const newSubSets = [...(setForm as any).subSets || ddItem.subSets];
                newSubSets[idx] = { ...newSubSets[idx], weight: newWeight };
                onSetFormChange({ ...setForm, subSets: newSubSets });
              }}
              placeholder="kg"
              className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={subSet.completed}
            />
            <span className="text-gray-400 text-xs">kg</span>
            <input
              type="number"
              value={subSet.completed ? subSet.reps : (setForm.reps ?? subSet.reps)}
              onChange={(e) => {
                const newReps = parseInt(e.target.value) || 0;
                const newSubSets = [...(setForm as any).subSets || ddItem.subSets];
                newSubSets[idx] = { ...newSubSets[idx], reps: newReps };
                onSetFormChange({ ...setForm, subSets: newSubSets });
              }}
              placeholder="reps"
              className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={subSet.completed}
            />
            <span className="text-gray-400 text-xs">reps</span>
            {subSet.completed && (
              <FontAwesomeIcon icon={faCheck} className="text-green-500 text-xs" />
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSubmitSet}
            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
          >
            Save All
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

// Dropdown set row - looks like other rows but with edit form showing sub-sets
function DropdownSetRow({ item, isEditing, setForm, onOpenSetForm, onSubmitSet, onCloseSetForm, onUncompleteSet, onDeleteSet, onSetFormChange }: SetRowProps & { item: DropdownSetItem }) {
  const ddItem = item as DropdownSetItem;

  return (
    <div
      className={`border rounded-lg transition-all ${
        ddItem.completed
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
              ddItem.completed
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {ddItem.completed ? <FontAwesomeIcon icon={faCheck} className="text-sm" /> : ddItem.setNumber}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{ddItem.exerciseName}</span>
                {ddItem.badgeLabel && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ddItem.badgeColor}`}>{ddItem.badgeLabel}</span>
                )}
                {ddItem.isSuperset && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Superset</span>
                )}
                {ddItem.isExtra && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Extra</span>
                )}
              </div>
              <div className="text-sm text-gray-500">Set {ddItem.setNumber}</div>
            </div>

            {ddItem.completed && ddItem.showCompletedData && (
              <div className="flex items-center gap-3 text-sm">
                {ddItem.subSets.map((subSet, idx) => (
                  <span key={idx} className="text-gray-600">
                    {subSet.weight}kg x {subSet.reps}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1">
              {!ddItem.completed ? (
                <span className="text-sm text-gray-400 italic">Click to fill</span>
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
