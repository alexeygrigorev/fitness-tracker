import type { Exercise } from './types';

export interface SetData {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exercise: Exercise;
  setNumber: number;
  completed: boolean;
  completedAt?: Date;
  isBodyweight: boolean;
  suggestedWeight?: number;
  isExtra?: boolean;
  isSuperset?: boolean;
}

// Base class for all set items
export abstract class BaseSetItem implements SetData {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exercise: Exercise;
  setNumber: number;
  completed: boolean;
  completedAt?: Date;
  isBodyweight: boolean;
  suggestedWeight?: number;
  isExtra?: boolean;
  isSuperset?: boolean;

  // Properties that subclasses must define
  abstract weight?: number;
  abstract reps: number;
  abstract setType: 'normal' | 'warmup' | 'dropdown' | 'bodyweight';

  // Display properties - can be overridden by subclasses
  get badgeLabel(): string {
    return '';
  }

  get badgeColor(): string {
    return '';
  }

  get showWeightInput(): boolean {
    return !this.isBodyweight;
  }

  get showRepsInput(): boolean {
    return true;
  }

  get showCompletedData(): boolean {
    return true;
  }

  get setDisplayLabel(): string {
    return `${this.setNumber}`;
  }

  // Clone with new values
  withChanges(changes: Partial<this>): this {
    const Constructor = this.constructor as new (data: any) => this;
    return new Constructor({ ...this, ...changes });
  }

  // Convert to plain object for serialization
  toPlain(): any {
    return {
      id: this.id,
      exerciseId: this.exerciseId,
      exerciseName: this.exerciseName,
      exercise: this.exercise,
      setNumber: this.setNumber,
      setType: this.setType,
      weight: this.weight,
      reps: this.reps,
      completed: this.completed,
      completedAt: this.completedAt,
      isBodyweight: this.isBodyweight,
      suggestedWeight: this.suggestedWeight,
      isExtra: this.isExtra,
      isSuperset: this.isSuperset
    };
  }
}

// Warmup set - just click to complete, no weight/reps inputs
export class WarmupSetItem extends BaseSetItem {
  weight?: number;
  reps: number;
  setType = 'warmup' as const;

  constructor(data: SetData & { weight?: number; reps: number }) {
    super();
    Object.assign(this, data);
  }

  override get badgeLabel(): string {
    return 'Warmup';
  }

  override get badgeColor(): string {
    return 'bg-yellow-100 text-yellow-700';
  }

  override get showWeightInput(): boolean {
    return false;
  }

  override get showRepsInput(): boolean {
    return false;
  }

  override get showCompletedData(): boolean {
    return false;
  }

  override get setDisplayLabel(): string {
    return 'W';
  }
}

// Normal working set (with weight)
export class NormalSetItem extends BaseSetItem {
  weight?: number;
  reps: number;
 setType = 'normal' as const;

  constructor(data: SetData & { weight?: number; reps: number }) {
    super();
    Object.assign(this, data);
  }

  override get badgeLabel(): string {
    return '';
  }

  override get badgeColor(): string {
    return 'bg-blue-100 text-blue-700';
  }
}

// Bodyweight set - no weight, just reps
export class BodyweightSetItem extends BaseSetItem {
  weight?: number; // Not used for bodyweight, but required by base class
  reps: number;
  setType = 'bodyweight' as const;
  override isBodyweight = true;

  constructor(data: SetData & { weight?: number; reps: number }) {
    super();
    Object.assign(this, data);
  }

  override get badgeLabel(): string {
    return 'BW';
  }

  override get badgeColor(): string {
    return 'bg-amber-100 text-amber-700';
  }

  override get showWeightInput(): boolean {
    return false;
  }
}

// Dropdown set - ONE item that contains multiple sub-sets (rows)
// Each sub-set has its own weight/reps. Completing the dropdown completes all sub-sets.
export class DropdownSetItem extends BaseSetItem {
  weight?: number;
  reps: number; // Not used directly, each sub-set has its own reps
  setType = 'dropdown' as const;

  // Sub-sets: working set + drops, each with weight/reps
  subSets: Array<{ weight: number; reps: number; completed: boolean; completedAt?: Date }>;

  constructor(data: SetData & {
    weight?: number;
    reps: number;
    subSets: Array<{ weight: number; reps: number; completed: boolean; completedAt?: Date }>;
  }) {
    super();
    Object.assign(this, data);
    this.isBodyweight = false; // Dropdown sets always have weight
    this.subSets = data.subSets || [];
  }

  override get badgeLabel(): string {
    return 'Dropdown';
  }

  override get badgeColor(): string {
    return 'bg-purple-100 text-purple-700';
  }

  // Total number of sub-sets
  get totalSubSets(): number {
    return this.subSets.length;
  }

  // How many sub-sets are completed
  get completedSubSets(): number {
    return this.subSets.filter(s => s.completed).length;
  }

  // All sub-sets completed
  get allSubSetsCompleted(): boolean {
    return this.subSets.every(s => s.completed);
  }

  // For display - show the currently relevant data
  override get showCompletedData(): boolean {
    return this.subSets.some(s => s.completed);
  }

  override toPlain(): any {
    return {
      ...super.toPlain(),
      subSets: this.subSets
    };
  }
}

// Type union for all set item types
export type SetItem = WarmupSetItem | NormalSetItem | BodyweightSetItem | DropdownSetItem;

// Factory function to create the right SetItem type from plain data
export function createSetItem(data: any): SetItem {
  if (data.setType === 'warmup') return new WarmupSetItem(data);
  if (data.setType === 'bodyweight') return new BodyweightSetItem(data);
  if (data.setType === 'dropdown') return new DropdownSetItem(data);
  return new NormalSetItem(data);
}

// Convert plain array to SetItem array
export function createSetItems(dataArray: any[]): SetItem[] {
  return dataArray.map(createSetItem);
}
