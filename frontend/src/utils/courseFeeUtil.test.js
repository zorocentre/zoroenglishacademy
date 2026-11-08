import { describe, it, expect } from 'vitest';
import { formatPublicCourseFee } from './courseFeeUtil';

describe('formatPublicCourseFee (Task F7)', () => {
  it('formats Months duration unit as enteredFee /month', () => {
    const course = {
      price: 15000,
      enteredFee: 3000,
      duration: '5 Months',
      durationUnit: 'Months',
      durationValue: 5,
    };
    expect(formatPublicCourseFee(course)).toBe('₹3,000 /month');
  });

  it('formats Years duration unit as enteredFee /month', () => {
    const course = {
      price: 12000,
      enteredFee: 1000,
      duration: '1 Years',
      durationUnit: 'Years',
      durationValue: 1,
    };
    expect(formatPublicCourseFee(course)).toBe('₹1,000 /month');
  });

  it('formats Hours duration unit as amount only without suffix', () => {
    const course = {
      price: 15000,
      enteredFee: 15000,
      duration: '40 Hours',
      durationUnit: 'Hours',
      durationValue: 40,
    };
    expect(formatPublicCourseFee(course)).toBe('₹15,000');
  });

  it('formats Days duration unit as amount only without suffix', () => {
    const course = {
      price: 5000,
      enteredFee: 5000,
      duration: '15 Days',
      durationUnit: 'Days',
      durationValue: 15,
    };
    expect(formatPublicCourseFee(course)).toBe('₹5,000');
  });

  it('handles zero or missing fee with custom fallback', () => {
    expect(formatPublicCourseFee(null, 'Contact us')).toBe('Contact us');
    expect(formatPublicCourseFee({ price: 0 }, 'Contact us')).toBe('Contact us');
    expect(formatPublicCourseFee({ price: null }, 'Free')).toBe('Free');
  });

  it('falls back to duration string if durationUnit is not set', () => {
    const course = {
      price: 6000,
      enteredFee: 2000,
      duration: '3 Months',
    };
    expect(formatPublicCourseFee(course)).toBe('₹2,000 /month');
  });
});
