import type { Exercise, WorkoutSet } from '../types';
import type { SetData, SetFormData, LastUsedData } from './setItemTypes';
export type { SetFormData, LastUsedData, SetData } from './setItemTypes';

export abstract class BaseSetItem implements SetData {
  id!: string;
  exerciseId!: string;
  exerciseName!: string;
  exercise!: Exercise;
  setNumber!: number;
  completed!: boolean;
  completedAt?: Date;
  isBodyweight!: boolean;
  suggestedWeight?: number;
  isExtra?: boolean;
  isSuperset?: boolean;
  originalIndex?: number;
  originalWorkoutSetId?: string;
  alreadySaved?: boolean;

  abstract weight?: number;
  abstract reps: number;
  abstract setType: 'normal' | 'warmup' | 'dropdown' | 'bodyweight';

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

  getInitialForm(lastUsed?: LastUsedData): SetFormData {
    return {
      weight: lastUsed?.weight ?? this.weight ?? this.suggestedWeight,
      reps: lastUsed?.reps ?? this.reps ?? 10
    };
  }

  getCompletedDisplay(): Array<{ text: string; className?: string } | { isTimestamp: true; time: Date }> {
    const display: Array<{ text: string; className?: string } | { isTimestamp: true; time: Date }> = [];
    if (!this.isBodyweight && this.weight) {
      display.push({ text: `${this.weight} kg`, className: 'font-medium text-gray-900' });
    }
    display.push({ text: `${this.reps} reps`, className: 'text-gray-600' });
    if (this.completedAt) {
      display.push({ isTimestamp: true, time: this.completedAt });
    }
    return display;
  }

  get isFullyCompleted(): boolean {
    return this.completed;
  }

  markCompleted(): this {
    return this.withChanges({ completed: true, completedAt: new Date() } as any);
  }

  applyFormAndComplete(form: SetFormData): this {
    return this.markCompleted().withChanges({
      weight: form.weight,
      reps: form.reps,
      alreadySaved: undefined
    } as any);
  }

  getLastUsedData(form: SetFormData): LastUsedData {
    return {
      weight: form.weight,
      reps: form.reps
    };
  }

  markUncompleted(): this {
    return this.withChanges({ completed: false, completedAt: undefined } as any);
  }

  toWorkoutSets(startTime: Date): WorkoutSet[] {
    if (this.alreadySaved) return [];
    if (!this.completed) return [];
    return [{
      id: this.originalWorkoutSetId || this.id,
      exerciseId: this.exerciseId,
      setType: this.setType === 'warmup' ? 'warmup' : 'normal',
      weight: this.weight,
      reps: this.reps,
      loggedAt: this.completedAt || startTime
    }];
  }

  withChanges(changes: Partial<this>): this {
    const Constructor = this.constructor as new (data: any) => this;
    return new Constructor({ ...this, ...changes });
  }

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
      isSuperset: this.isSuperset,
      originalIndex: this.originalIndex,
      originalWorkoutSetId: this.originalWorkoutSetId,
      alreadySaved: this.alreadySaved
    };
  }
}

export class WarmupSetItem extends BaseSetItem {
  weight?: number;
  reps!: number;
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
    return true;
  }

  override getCompletedDisplay(): Array<{ text: string; className?: string } | { isTimestamp: true; time: Date }> {
    if (!this.completedAt) return [];
    return [{ isTimestamp: true, time: this.completedAt }];
  }

  override get setDisplayLabel(): string {
    return 'W';
  }
}

export class NormalSetItem extends BaseSetItem {
  weight?: number;
  reps!: number;
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

export class BodyweightSetItem extends BaseSetItem {
  weight?: number;
  reps!: number;
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

  override getCompletedDisplay(): Array<{ text: string; className?: string } | { isTimestamp: true; time: Date }> {
    const display: Array<{ text: string; className?: string } | { isTimestamp: true; time: Date }> = [];
    display.push({ text: `${this.reps} reps`, className: 'text-gray-600' });
    if (this.completedAt) {
      display.push({ isTimestamp: true, time: this.completedAt });
    }
    return display;
  }
}

export class DropdownSetItem extends BaseSetItem {
  weight?: number;
  reps!: number;
  setType = 'dropdown' as const;
  subSets: Array<{ weight: number; reps: number; completed: boolean; completedAt?: Date }>;

  constructor(data: SetData & {
    weight?: number;
    reps: number;
    subSets: Array<{ weight: number; reps: number; completed: boolean; completedAt?: Date }>;
  }) {
    super();
    Object.assign(this, data);
    this.isBodyweight = false;
    this.subSets = data.subSets || [];
    this.weight = this.subSets[0]?.weight;
    this.reps = this.subSets[0]?.reps || 10;
  }

  override get badgeLabel(): string {
    return 'Dropdown';
  }

  override get badgeColor(): string {
    return 'bg-purple-100 text-purple-700';
  }

  get totalSubSets(): number {
    return this.subSets.length;
  }

  get completedSubSets(): number {
    return this.subSets.filter(s => s.completed).length;
  }

  get allSubSetsCompleted(): boolean {
    return this.subSets.every(s => s.completed);
  }

  override get isFullyCompleted(): boolean {
    return this.allSubSetsCompleted;
  }

  override markCompleted(): this {
    const now = new Date();
    const completedSubSets = this.subSets.map(subSet => ({
      ...subSet,
      completed: true,
      completedAt: now
    }));
    return this.withChanges({ subSets: completedSubSets, completed: true, completedAt: now } as any);
  }

  override markUncompleted(): this {
    const uncompletedSubSets = this.subSets.map(subSet => ({
      ...subSet,
      completed: false,
      completedAt: undefined
    }));
    return this.withChanges({ subSets: uncompletedSubSets, completed: false, completedAt: undefined } as any);
  }

  override applyFormAndComplete(form: SetFormData): this {
    const now = new Date();
    const subSetsToUse = form.subSets || this.subSets;
    const updatedSubSets = subSetsToUse.map((subSet, idx) => ({
      ...subSet,
      weight: idx === 0 ? (form.weight ?? subSet.weight) : subSet.weight,
      reps: form.reps,
      completed: true,
      completedAt: now
    }));
    return this.withChanges({ subSets: updatedSubSets, completed: true, completedAt: now, alreadySaved: undefined } as any);
  }

  override getLastUsedData(form: SetFormData): LastUsedData {
    return {
      weight: form.weight,
      reps: form.reps,
      subSets: (form.subSets || this.subSets).map(s => ({ weight: s.weight, reps: s.reps }))
    };
  }

  override getCompletedDisplay(): Array<{ text: string; className?: string } | { isTimestamp: true; time: Date }> {
    const display: Array<{ text: string; className?: string } | { isTimestamp: true; time: Date }> = [];
    this.subSets.forEach(subSet => {
      display.push({ text: `${subSet.weight}kg x ${subSet.reps}`, className: 'text-gray-600' });
    });
    if (this.completedAt) {
      display.push({ isTimestamp: true, time: this.completedAt });
    }
    return display;
  }

  override get showCompletedData(): boolean {
    return this.subSets.some(s => s.completed);
  }

  override getInitialForm(lastUsed?: LastUsedData): SetFormData {
    let subSetsToUse = this.subSets;
    if (lastUsed?.subSets && lastUsed.subSets.length === this.subSets.length) {
      const savedSubSets = lastUsed.subSets;
      subSetsToUse = this.subSets.map((subSet, idx) => ({
        ...subSet,
        weight: savedSubSets[idx]?.weight ?? subSet.weight,
        reps: savedSubSets[idx]?.reps ?? subSet.reps
      }));
    }
    return {
      weight: lastUsed?.weight ?? subSetsToUse[0]?.weight,
      reps: lastUsed?.reps ?? subSetsToUse[0]?.reps ?? 10,
      subSets: subSetsToUse
    };
  }

  override toWorkoutSets(startTime: Date): WorkoutSet[] {
    if (!this.completed) return [];
    // Save as a single set representing the entire dropdown
    // The backend will handle storing individual sub-sets with set_order
    return [{
      id: this.originalWorkoutSetId || this.id,
      exerciseId: this.exerciseId,
      setType: 'dropdown',
      weight: this.subSets[0]?.weight,
      reps: this.subSets[0]?.reps || 10,
      loggedAt: this.completedAt || startTime
    }];
  }

  override toPlain(): any {
    return {
      ...super.toPlain(),
      subSets: this.subSets
    };
  }
}

export type SetItem = WarmupSetItem | NormalSetItem | BodyweightSetItem | DropdownSetItem;

export function createSetItem(data: any): SetItem {
  if (data.setType === 'warmup') return new WarmupSetItem(data);
  if (data.setType === 'bodyweight') return new BodyweightSetItem(data);
  if (data.setType === 'dropdown') return new DropdownSetItem(data);
  return new NormalSetItem(data);
}

export function createSetItems(dataArray: any[]): SetItem[] {
  return dataArray.map(createSetItem);
}
