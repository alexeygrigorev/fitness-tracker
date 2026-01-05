// SetItem classes - polymorphic pattern for different set types
import type { WorkoutSet, SetType } from '../types';

export interface CompletedDataDisplay {
  text: string;
  className: string;
}

export interface TimestampDisplay {
  isTimestamp: true;
  time: Date;
}

export type DisplayData = CompletedDataDisplay | TimestampDisplay;

export interface LastUsedData {
  weight?: number;
  reps: number;
  subSets?: Array<{ weight: number; reps: number }>;
}

// Base interface for all set items
export interface SetItem {
  // Unique identifier
  id: string;
  // Exercise info
  exerciseId: number;
  exerciseName: string;
  // Set type
  setType: SetType;
  // Set number (for display, not for warmup)
  setNumber: number;
  // Completion status
  completed: boolean;
  completedAt?: Date | null;
  // Visual flags
  isSuperset: boolean;
  isExtra: boolean;
  // Display helpers
  setDisplayLabel: string;
  badgeLabel?: string;
  badgeColor: string;
  showWeightInput: boolean;
  showCompletedData: boolean;
  // Get display data for completed sets
  getCompletedDisplay: () => DisplayData[];
}

// Base class with shared logic
abstract class BaseSetItem implements SetItem {
  id: string;
  exerciseId: number;
  exerciseName: string;
  setType: SetType;
  setNumber: number;
  completed: boolean;
  completedAt: Date | null = null;
  isSuperset = false;
  isExtra = false;
  badgeLabel?: string;
  badgeColor: string;
  showWeightInput: boolean;
  showCompletedData = true;

  constructor(props: {
    id: string;
    exerciseId: number;
    exerciseName: string;
    setType: SetType;
    setNumber: number;
    completed: boolean;
    completedAt?: Date | null;
    isSuperset?: boolean;
    isExtra?: boolean;
    badgeLabel?: string;
    badgeColor: string;
    showWeightInput: boolean;
  }) {
    this.id = props.id;
    this.exerciseId = props.exerciseId;
    this.exerciseName = props.exerciseName;
    this.setType = props.setType;
    this.setNumber = props.setNumber;
    this.completed = props.completed;
    this.completedAt = props.completedAt ?? null;
    this.isSuperset = props.isSuperset ?? false;
    this.isExtra = props.isExtra ?? false;
    this.badgeLabel = props.badgeLabel;
    this.badgeColor = props.badgeColor;
    this.showWeightInput = props.showWeightInput;
  }

  abstract setDisplayLabel: string;
  abstract getCompletedDisplay(): DisplayData[];

  protected formatTimestamp(): TimestampDisplay {
    return {
      isTimestamp: true,
      time: this.completedAt ?? new Date()
    };
  }
}

// Warmup set - no weight/reps tracking, just completion
export class WarmupSetItem extends BaseSetItem {
  setDisplayLabel = 'W';
  badgeLabel = 'Warmup';
  badgeColor = 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300';
  showWeightInput = false;
  showCompletedData = false;

  constructor(props: {
    id: string;
    exerciseId: number;
    exerciseName: string;
    completed: boolean;
    completedAt?: Date | null;
    isSuperset?: boolean;
  }) {
    super({
      ...props,
      setType: 'warmup',
      setNumber: 0,
      badgeColor: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
      showWeightInput: false
    });
  }

  getCompletedDisplay(): DisplayData[] {
    return []; // Warmup sets don't show data
  }
}

// Normal set - weight + reps
export class NormalSetItem extends BaseSetItem {
  weight: number;
  reps: number;

  setDisplayLabel = 'N';
  badgeColor = '';
  showWeightInput = true;

  constructor(props: {
    id: string;
    exerciseId: number;
    exerciseName: string;
    setNumber: number;
    weight: number;
    reps: number;
    completed: boolean;
    completedAt?: Date | null;
    isSuperset?: boolean;
    isExtra?: boolean;
  }) {
    super({
      ...props,
      setType: 'normal',
      badgeColor: '',
      showWeightInput: true
    });
    this.weight = props.weight;
    this.reps = props.reps;
  }

  getCompletedDisplay(): DisplayData[] {
    if (!this.completed) return [];
    return [
      { text: `${this.weight} kg`, className: 'text-gray-700 dark:text-gray-300 font-medium' },
      { text: `${this.reps} reps`, className: 'text-gray-600 dark:text-gray-400' },
      this.formatTimestamp()
    ];
  }
}

// Bodyweight set - only reps
export class BodyweightSetItem extends BaseSetItem {
  reps: number;

  setDisplayLabel = 'BW';
  badgeLabel = 'Bodyweight';
  badgeColor = 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300';
  showWeightInput = false;

  constructor(props: {
    id: string;
    exerciseId: number;
    exerciseName: string;
    setNumber: number;
    reps: number;
    completed: boolean;
    completedAt?: Date | null;
    isSuperset?: boolean;
    isExtra?: boolean;
  }) {
    super({
      ...props,
      setType: 'bodyweight',
      badgeLabel: 'Bodyweight',
      badgeColor: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
      showWeightInput: false
    });
    this.reps = props.reps;
  }

  getCompletedDisplay(): DisplayData[] {
    if (!this.completed) return [];
    return [
      { text: `${this.reps} reps`, className: 'text-gray-600 dark:text-gray-400' },
      this.formatTimestamp()
    ];
  }
}

// Dropdown set - main weight + multiple drop weights
export class DropdownSetItem extends BaseSetItem {
  weight: number;
  reps: number;
  subSets: Array<{ weight: number; reps: number }>;

  setDisplayLabel = 'DD';
  badgeLabel = 'Dropdown';
  badgeColor = 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
  showWeightInput = false; // Has custom UI

  constructor(props: {
    id: string;
    exerciseId: number;
    exerciseName: string;
    setNumber: number;
    weight: number;
    reps: number;
    subSets: Array<{ weight: number; reps: number }>;
    completed: boolean;
    completedAt?: Date | null;
    isSuperset?: boolean;
    isExtra?: boolean;
  }) {
    super({
      ...props,
      setType: 'dropdown',
      badgeLabel: 'Drop',
      badgeColor: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      showWeightInput: false
    });
    this.weight = props.weight;
    this.reps = props.reps;
    this.subSets = props.subSets;
  }

  getCompletedDisplay(): DisplayData[] {
    if (!this.completed) return [];
    // Show all dropdown weights
    const weights = [this.weight, ...this.subSets.map(s => s.weight)];
    return [
      { text: weights.join(' → '), className: 'text-gray-700 dark:text-gray-300 font-medium' },
      { text: `${this.reps} reps`, className: 'text-gray-600 dark:text-gray-400' },
      this.formatTimestamp()
    ];
  }
}

// Type guard for dropdown sets
export function isDropdownSetItem(item: SetItem): item is DropdownSetItem {
  return item.setType === 'dropdown';
}

// Factory function to create SetItem from backend WorkoutSet
export interface SetFormData {
  weight?: number;
  reps: number;
  subSets?: Array<{ weight: number; reps: number }>;
}

export function createSetItemFromBackend(
  backendSet: WorkoutSet,
  exerciseName: string,
  setNumber: number,
  isSuperset: boolean = false,
  isExtra: boolean = false
): SetItem {
  const id = String(backendSet.id);
  const exerciseId = backendSet.exerciseId;
  const completed = backendSet.loggedAt !== null;
  const completedAt = backendSet.loggedAt ? new Date(backendSet.loggedAt) : null;

  const baseProps = {
    id,
    exerciseId,
    exerciseName,
    setNumber,
    completed,
    completedAt,
    isSuperset,
    isExtra
  };

  const setType = backendSet.setType;

  if (setType === 'warmup') {
    return new WarmupSetItem(baseProps);
  }

  if (setType === 'dropdown') {
    return new DropdownSetItem({
      ...baseProps,
      weight: backendSet.weight || 0,
      reps: backendSet.reps,
      subSets: backendSet.dropdownWeights || []
    });
  }

  if (setType === 'bodyweight' || exerciseName.toLowerCase().includes('pullup') ||
      exerciseName.toLowerCase().includes('pull-up') || exerciseName.toLowerCase().includes('pull up') ||
      exerciseName.toLowerCase().includes('chinup') || exerciseName.toLowerCase().includes('dip') ||
      exerciseName.toLowerCase().includes('pushup') || exerciseName.toLowerCase().includes('push-up')) {
    return new BodyweightSetItem({
      ...baseProps,
      reps: backendSet.reps
    });
  }

  // Default to normal
  return new NormalSetItem({
    ...baseProps,
    weight: backendSet.weight || 0,
    reps: backendSet.reps
  });
}

// Create set items from a workout session
export function createSetItemsFromSession(
  session: { id: number | string; sets: WorkoutSet[] },
  exercisesMap: Map<number, { name: string; isBodyweight?: boolean }>
): SetItem[] {
  const items: SetItem[] = [];
  let setNumber = 1;

  // Group by exercise to count sets per exercise
  const exerciseSetCount = new Map<number, number>();

  for (const backendSet of session.sets) {
    const exercise = exercisesMap.get(backendSet.exerciseId);
    const exerciseName = exercise?.name || backendSet.exerciseName || 'Unknown';

    // Skip warmup in set numbering
    if (backendSet.setType !== 'warmup') {
      const currentCount = exerciseSetCount.get(backendSet.exerciseId) || 0;
      exerciseSetCount.set(backendSet.exerciseId, currentCount + 1);
      setNumber = currentCount + 1;
    }

    const item = createSetItemFromBackend(backendSet, exerciseName, setNumber);
    items.push(item);
  }

  return items;
}
