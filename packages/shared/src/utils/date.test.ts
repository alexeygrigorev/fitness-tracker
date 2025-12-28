import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  calculateDuration,
  formatDuration,
  isPast,
  isFuture,
  startOfDay,
  endOfDay,
  addDays,
  getWeekNumber,
} from './date';

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('should format a date correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date)).toBe('Jan 15, 2024');
    });

    it('should accept ISO string input', () => {
      expect(formatDate('2024-01-15T10:30:00Z')).toBe('Jan 15, 2024');
    });

    it('should support custom format strings', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date, 'yyyy-MM-dd')).toBe('2024-01-15');
    });
  });

  describe('formatTime', () => {
    it('should format time in 12-hour format', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = formatTime(date);
      // Check for 12-hour format with AM/PM
      expect(result).toMatch(/\d+:\d{2} [AP]M/);
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time together', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = formatDateTime(date);
      expect(result).toContain('Jan 15');
      expect(result).toContain('2024');
    });
  });

  describe('formatRelativeTime', () => {
    it('should show "Today" for today\'s date', () => {
      const today = new Date();
      const result = formatRelativeTime(today);
      expect(result).toContain('Today');
    });

    it('should show "Yesterday" for yesterday\'s date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = formatRelativeTime(yesterday);
      expect(result).toContain('Yesterday');
    });

    it('should show relative time for older dates', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const result = formatRelativeTime(oldDate);
      expect(result).toContain('ago');
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration between two dates in milliseconds', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T11:00:00Z');
      expect(calculateDuration(start, end)).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should accept ISO string inputs', () => {
      const start = '2024-01-15T10:00:00Z';
      const end = '2024-01-15T11:00:00Z';
      expect(calculateDuration(start, end)).toBe(60 * 60 * 1000);
    });
  });

  describe('formatDuration', () => {
    it('should format duration in seconds for short times', () => {
      expect(formatDuration(30 * 1000)).toBe('30s');
      expect(formatDuration(59 * 1000)).toBe('59s');
    });

    it('should format duration in minutes', () => {
      expect(formatDuration(60 * 1000)).toBe('1m');
      expect(formatDuration(5 * 60 * 1000)).toBe('5m');
    });

    it('should format duration in hours and minutes', () => {
      expect(formatDuration(60 * 60 * 1000)).toBe('1h 0m');
      expect(formatDuration((2 * 60 + 30) * 60 * 1000)).toBe('2h 30m');
    });
  });

  describe('isPast', () => {
    it('should return true for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      expect(isPast(past)).toBe(true);
    });

    it('should return false for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 1);
      expect(isPast(future)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('should return true for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 1);
      expect(isFuture(future)).toBe(true);
    });

    it('should return false for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      expect(isFuture(past)).toBe(false);
    });
  });

  describe('startOfDay', () => {
    it('should return the start of the day', () => {
      const date = new Date('2024-01-15T14:30:45Z');
      const start = startOfDay(date);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('should use current date when no argument provided', () => {
      const start = startOfDay();
      expect(start.getHours()).toBe(0);
    });
  });

  describe('endOfDay', () => {
    it('should return the end of the day', () => {
      const date = new Date('2024-01-15T14:30:45Z');
      const end = endOfDay(date);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });
  });

  describe('addDays', () => {
    it('should add days to a date', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = addDays(date, 7);
      expect(result.getDate()).toBe(22);
    });

    it('should handle negative days', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = addDays(date, -7);
      expect(result.getDate()).toBe(8);
    });
  });

  describe('getWeekNumber', () => {
    it('should return correct week number for January 1st', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      expect(getWeekNumber(date)).toBe(1);
    });

    it('should return week 53 for end of year dates', () => {
      const date = new Date('2024-12-31T00:00:00Z');
      const week = getWeekNumber(date);
      expect(week).toBeGreaterThan(0);
      expect(week).toBeLessThanOrEqual(53);
    });
  });
});
