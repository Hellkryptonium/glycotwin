export type LifestyleType = 'meal' | 'activity' | 'sleep' | 'symptom';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
export interface LifestyleEntry {
  id: string;
  patientId: string;
  type: LifestyleType;
  occurredAt: Date;
  mealType: MealType | null;
  description: string | null;
  activityType: string | null;
  durationMinutes: number | null;
  sleepDurationMinutes: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
