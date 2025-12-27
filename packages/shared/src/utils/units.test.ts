import { describe, it, expect } from 'vitest';
import {
  kgToLbs,
  lbsToKg,
  cmToInches,
  inchesToCm,
  cmToFeetInches,
  kmToMiles,
  milesToKm,
  formatWeight,
  formatHeight,
  formatDistance,
  calculateBMI,
  calculateBMR,
  calculateTDEE,
} from './units';

describe('Unit Conversion Utilities', () => {
  describe('Weight Conversions', () => {
    it('should convert kg to lbs', () => {
      expect(kgToLbs(1)).toBeCloseTo(2.20462, 5);
      expect(kgToLbs(10)).toBeCloseTo(22.0462, 4);
      expect(kgToLbs(100)).toBeCloseTo(220.462, 3);
    });

    it('should convert lbs to kg', () => {
      expect(lbsToKg(2.20462)).toBeCloseTo(1, 4);
      expect(lbsToKg(100)).toBeCloseTo(45.359, 3);
    });

    it('should be reversible', () => {
      const originalKg = 75;
      const lbs = kgToLbs(originalKg);
      const backToKg = lbsToKg(lbs);
      expect(backToKg).toBeCloseTo(originalKg, 5);
    });
  });

  describe('Height Conversions', () => {
    it('should convert cm to inches', () => {
      expect(cmToInches(2.54)).toBeCloseTo(1, 4);
      expect(cmToInches(30.48)).toBeCloseTo(12, 4);
    });

    it('should convert inches to cm', () => {
      expect(inchesToCm(1)).toBeCloseTo(2.54, 4);
      expect(inchesToCm(12)).toBeCloseTo(30.48, 4);
    });

    it('should convert cm to feet and inches', () => {
      const result = cmToFeetInches(180);
      expect(result.feet).toBe(5); // 5'11"
      expect(result.inches).toBe(11);
    });

    it('should handle exact foot conversions', () => {
      const result = cmToFeetInches(182.88); // ~6 feet
      expect(result.feet).toBe(6);
      expect(result.inches).toBe(0);
    });
  });

  describe('Distance Conversions', () => {
    it('should convert km to miles', () => {
      expect(kmToMiles(1)).toBeCloseTo(0.621371, 5);
      expect(kmToMiles(10)).toBeCloseTo(6.21371, 4);
    });

    it('should convert miles to km', () => {
      expect(milesToKm(1)).toBeCloseTo(1.60934, 4);
    });

    it('should be reversible', () => {
      const originalKm = 5;
      const miles = kmToMiles(originalKm);
      const backToKm = milesToKm(miles);
      expect(backToKm).toBeCloseTo(originalKm, 4);
    });
  });

  describe('Format Functions', () => {
    it('should format weight in metric', () => {
      expect(formatWeight(75, 'METRIC')).toBe('75.0 kg');
      expect(formatWeight(80.5, 'METRIC')).toBe('80.5 kg');
    });

    it('should format weight in english units', () => {
      expect(formatWeight(75, 'ENGLISH')).toContain('lbs');
      expect(formatWeight(75, 'ENGLISH')).toContain('165'); // 75kg ≈ 165.3 lbs
    });

    it('should format height in metric', () => {
      expect(formatHeight(180, 'METRIC')).toBe('180 cm');
    });

    it('should format height in english units', () => {
      expect(formatHeight(180, 'ENGLISH')).toBe(`5'11"`);
    });

    it('should format distance in metric', () => {
      expect(formatDistance(1, 'METRIC')).toBe('1.00 km');
      expect(formatDistance(0.5, 'METRIC')).toBe('500 m');
    });

    it('should format distance in english units', () => {
      // For < 1 mile, shows in feet: 1 km = 0.621371 miles = ~3281 feet
      expect(formatDistance(1, 'ENGLISH')).toContain('ft');
      expect(formatDistance(0.1, 'ENGLISH')).toContain('ft');
      // For >= 1 mile, shows in miles: 2 km = ~1.24 miles
      expect(formatDistance(2, 'ENGLISH')).toContain('mi');
    });
  });

  describe('Health Calculations', () => {
    it('should calculate BMI correctly', () => {
      // 70kg at 175cm should have BMI ~22.86
      const bmi = calculateBMI(70, 175);
      expect(bmi).toBeCloseTo(22.86, 2);
    });

    it('should calculate BMI for overweight person', () => {
      // 100kg at 175cm should have BMI ~32.65
      const bmi = calculateBMI(100, 175);
      expect(bmi).toBeGreaterThan(30);
    });

    it('should calculate BMR for male', () => {
      // Mifflin-St Jeor: 10*weight + 6.25*height - 5*age + 5
      // 75kg, 180cm, 30 years, male
      const bmr = calculateBMR(75, 180, 30, 'male');
      expect(bmr).toBeCloseTo(10 * 75 + 6.25 * 180 - 5 * 30 + 5, 1);
    });

    it('should calculate BMR for female', () => {
      // Mifflin-St Jeor: 10*weight + 6.25*height - 5*age - 161
      // 60kg, 165cm, 25 years, female
      const bmr = calculateBMR(60, 165, 25, 'female');
      expect(bmr).toBeCloseTo(10 * 60 + 6.25 * 165 - 5 * 25 - 161, 1);
    });

    it('should calculate TDEE based on activity level', () => {
      const bmr = 2000;
      expect(calculateTDEE(bmr, 'sedentary')).toBe(2400); // 1.2x
      expect(calculateTDEE(bmr, 'light')).toBe(2750); // 1.375x
      expect(calculateTDEE(bmr, 'moderate')).toBe(3100); // 1.55x
      expect(calculateTDEE(bmr, 'active')).toBe(3450); // 1.725x
      expect(calculateTDEE(bmr, 'very_active')).toBe(3800); // 1.9x
    });
  });
});
