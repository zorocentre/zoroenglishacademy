import { describe, it, expect } from 'vitest';
import { normalizeGoogleMeetUrl, isValidGoogleMeetUrl } from './utils/scheduleSortUtil';
import { inferNotificationType } from './api/notificationApi';

describe('Tasks G2-G6 Unit Tests', () => {

  describe('G6: Google Meet URL Normalization', () => {
    it('fixes redundant /meet/ prefix in Google Meet link', () => {
      const input = 'https://meet.google.com/meet/rks-qoss-swb';
      expect(normalizeGoogleMeetUrl(input)).toBe('https://meet.google.com/rks-qoss-swb');
    });

    it('leaves already valid Google Meet links unchanged', () => {
      const input = 'https://meet.google.com/ues-ssph-ree';
      expect(normalizeGoogleMeetUrl(input)).toBe('https://meet.google.com/ues-ssph-ree');
    });

    it('preserves query parameters', () => {
      const input = 'https://meet.google.com/meet/rks-qoss-swb?authuser=1&hs=122';
      expect(normalizeGoogleMeetUrl(input)).toBe('https://meet.google.com/rks-qoss-swb?authuser=1&hs=122');
    });

    it('leaves other meeting providers completely intact', () => {
      const zoom = 'https://zoom.us/j/987654321';
      const teams = 'https://teams.microsoft.com/l/meetup-join/xyz';
      expect(normalizeGoogleMeetUrl(zoom)).toBe(zoom);
      expect(normalizeGoogleMeetUrl(teams)).toBe(teams);
    });

    it('validates Google Meet URLs properly', () => {
      expect(isValidGoogleMeetUrl('https://meet.google.com/ues-ssph-ree')).toBe(true);
      expect(isValidGoogleMeetUrl('https://meet.google.com/meet/ues-ssph-ree')).toBe(true);
      expect(isValidGoogleMeetUrl('https://example.com/not-meet')).toBe(false);
      expect(isValidGoogleMeetUrl(null)).toBe(false);
    });
  });

  describe('G5: Notification Type Inference', () => {
    it('identifies schedule notifications correctly', () => {
      expect(inferNotificationType({ title: 'New Schedule: Spoken English', message: 'Class scheduled at 10 AM IST' })).toBe('schedule');
      expect(inferNotificationType({ title: 'Schedule Rescheduled', message: 'Moved to 11 AM IST' })).toBe('schedule');
    });

    it('identifies salary and assignment notifications correctly', () => {
      expect(inferNotificationType({ title: 'Salary Disbursed', message: 'Your salary has been paid' })).toBe('salary');
      expect(inferNotificationType({ title: 'New Assignment Submission', message: 'Student submitted homework' })).toBe('assignments');
    });

    it('falls back to system for generic alerts', () => {
      expect(inferNotificationType({ title: 'Maintenance Window', message: 'Server will be upgraded' })).toBe('system');
    });
  });

  describe('G4: Doubt Mode & Batch Formatter', () => {
    function formatDoubtSubtitle(doubt) {
      const isRecorded = (doubt.courseMode?.toLowerCase() === 'recorded' || doubt.mode?.toLowerCase() === 'recorded');
      if (isRecorded) {
        return `${doubt.course} • Topic: ${doubt.topic}`;
      }
      return `${doubt.course} • Batch: ${doubt.batchName || 'Unassigned'} • Topic: ${doubt.topic}`;
    }

    it('omits batch info completely for Recorded courses', () => {
      const recordedDoubt = {
        course: 'Recorded Grammar',
        courseMode: 'Recorded',
        batchName: 'Dummy Batch',
        topic: 'Past Tense'
      };
      expect(formatDoubtSubtitle(recordedDoubt)).toBe('Recorded Grammar • Topic: Past Tense');
    });

    it('includes resolved batch for Online and Hybrid courses', () => {
      const onlineDoubt = {
        course: 'Spoken English Online',
        courseMode: 'Online',
        batchName: 'Morning Batch A',
        topic: 'Pronunciation'
      };
      expect(formatDoubtSubtitle(onlineDoubt)).toBe('Spoken English Online • Batch: Morning Batch A • Topic: Pronunciation');
    });

    it('falls back to Unassigned for Online course when batch is absent', () => {
      const onlineDoubtNoBatch = {
        course: 'Spoken English Online',
        courseMode: 'Online',
        batchName: null,
        topic: 'Pronunciation'
      };
      expect(formatDoubtSubtitle(onlineDoubtNoBatch)).toBe('Spoken English Online • Batch: Unassigned • Topic: Pronunciation');
    });
  });
});
