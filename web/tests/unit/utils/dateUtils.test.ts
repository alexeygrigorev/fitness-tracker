/**
 * Date utility tests
 * Tests for date formatting, comparison, and manipulation functions
 */
import { describe, it, expect } from 'vitest';

// Helper to check if dates are the same day (from Exercises.tsx)
const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

// Format date for display (from Exercises.tsx)
const formatDate = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Get day of week number from day label (from Exercises.tsx)
const getDayOfWeek = (dayLabel: string | undefined): number | null => {
  if (!dayLabel) return null;
  const days: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  return days[dayLabel.toLowerCase()] ?? null;
};

describe('Date Utilities', () => {
  describe('isSameDay', () => {
    it('should return true for same date', () => {
      const date1 = new Date('2024-01-15T10:00:00');
      const date2 = new Date('2024-01-15T18:30:00');
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different dates', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different months', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-02-15');
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different years', () => {
      const date1 = new Date('2023-01-15');
      const date2 = new Date('2024-01-15');
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('should return "Today" for today\'s date', () => {
      const today = new Date();
      expect(formatDate(today)).toBe('Today');
    });

    it('should return "Yesterday" for yesterday\'s date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatDate(yesterday)).toBe('Yesterday');
    });

    it('should return formatted date for older dates', () => {
      const oldDate = new Date('2024-01-15');
      const formatted = formatDate(oldDate);
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
    });
  });

  describe('getDayOfWeek', () => {
    it('should return correct day number for each day', () => {
      expect(getDayOfWeek('sunday')).toBe(0);
      expect(getDayOfWeek('Sunday')).toBe(0);
      expect(getDayOfWeek('monday')).toBe(1);
      expect(getDayOfWeek('tuesday')).toBe(2);
      expect(getDayOfWeek('wednesday')).toBe(3);
      expect(getDayOfWeek('thursday')).toBe(4);
      expect(getDayOfWeek('friday')).toBe(5);
      expect(getDayOfWeek('saturday')).toBe(6);
    });

    it('should return null for undefined input', () => {
      expect(getDayOfWeek(undefined)).toBeNull();
    });

    it('should return null for invalid day name', () => {
      expect(getDayOfWeek('notaday')).toBeNull();
    });
  });
});
