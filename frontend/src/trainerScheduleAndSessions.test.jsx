import { describe, it, expect } from 'vitest';
import {
  getSessionStartDateTime,
  getSessionEndDateTime,
  getScheduleJoinState,
  parseTimeToMinutes
} from './utils/scheduleSortUtil';

describe('Phase 4: Trainer Schedule and Sessions Logic', () => {
  const trainerId = 'trn_123';
  const trainerName = 'Donisha';

  const mockSchedules = [
    {
      id: 'sch_1',
      title: 'Speaking Class Batch 1',
      course: 'Spoken English',
      batch: 'batch-1',
      trainerId: 'trn_123',
      trainer: 'Donisha',
      audience: 'STUDENT',
      date: '2026-10-16',
      time: '10:00 AM - 11:00 AM',
      meetLink: 'https://meet.google.com/abc-defg-hij'
    },
    {
      id: 'sch_2',
      title: 'Grammar Intensive',
      course: 'Business English',
      batch: 'batch-2',
      trainerId: 'trn_123',
      trainer: 'Donisha',
      audience: 'STUDENT',
      date: '2026-10-16',
      time: '02:00 PM - 03:00 PM',
      meetLink: 'https://meet.google.com/xyz-uvwx-rst'
    },
    {
      id: 'sch_3_other_trainer',
      title: 'Pronunciation Mastery',
      course: 'Spoken English',
      batch: 'batch-3',
      trainerId: 'trn_999',
      trainer: 'Other Trainer',
      audience: 'STUDENT',
      date: '2026-10-16',
      time: '04:00 PM - 05:00 PM',
      meetLink: 'https://meet.google.com/aaa-bbbb-ccc'
    },
    {
      id: 'sch_4_trainer_course_learner',
      title: 'Trainer Onboarding & Pedagogy',
      course: 'trainer-3',
      batch: 'trainer-batch-1',
      trainerId: 'trn_admin',
      trainer: 'Admin Trainer',
      audience: 'TRAINER',
      date: '2026-10-16',
      time: '11:30 AM - 12:30 PM',
      meetLink: 'https://meet.google.com/ttt-rrrr-nnn'
    }
  ];

  it('Trainer Schedule: filters out trainer-audience learner courses and other trainers courses', () => {
    const taughtSchedules = mockSchedules.filter(item => {
      const aud = (item.audience || 'STUDENT').toUpperCase();
      if (aud !== 'STUDENT') return false;

      const isInstructor = (item.trainerId && item.trainerId === trainerId) ||
                           (item.trainer && item.trainer.toLowerCase().trim() === trainerName.toLowerCase().trim());
      return isInstructor;
    });

    // Should include sch_1 and sch_2 only
    expect(taughtSchedules.map(s => s.id)).toEqual(['sch_1', 'sch_2']);
    // sch_3 (other trainer) and sch_4 (trainer audience learner course) must NEVER be included
    expect(taughtSchedules.some(s => s.id === 'sch_3_other_trainer')).toBe(false);
    expect(taughtSchedules.some(s => s.id === 'sch_4_trainer_course_learner')).toBe(false);
  });

  it('Trainer Schedule: course filter narrows schedules correctly', () => {
    const taughtSchedules = mockSchedules.filter(item => {
      const aud = (item.audience || 'STUDENT').toUpperCase();
      return aud === 'STUDENT' && item.trainerId === trainerId;
    });

    const courses = Array.from(new Set(taughtSchedules.map(s => s.course)));
    expect(courses).toEqual(['Spoken English', 'Business English']);

    const filtered = taughtSchedules.filter(s => s.course === 'Business English');
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('Grammar Intensive');
  });

  it('Start Session: enabled only inside time window, disabled before start and after end', () => {
    const session = {
      id: 'sch_window_test',
      date: '2026-10-16',
      time: '10:00 AM - 11:00 AM',
      meetUrl: 'https://meet.google.com/valid-meet-link'
    };

    // Case 1: Before session starts (e.g. 09:30 AM)
    const beforeTime = new Date(Date.UTC(2026, 9, 16, 9, 30, 0));
    const beforeState = getScheduleJoinState(session, beforeTime);
    expect(beforeState.enabled).toBe(false);
    expect(beforeState.label).toContain('Join opens at 10:00 AM');

    // Case 2: During session window (e.g. 10:15 AM)
    const liveTime = new Date(Date.UTC(2026, 9, 16, 10, 15, 0));
    const liveState = getScheduleJoinState(session, liveTime);
    expect(liveState.enabled).toBe(true);
    expect(liveState.label).toContain('JOIN NOW');

    // Case 3: After session ends (e.g. 11:05 AM)
    const afterTime = new Date(Date.UTC(2026, 9, 16, 11, 5, 0));
    const afterState = getScheduleJoinState(session, afterTime);
    expect(afterState.enabled).toBe(false);
    expect(afterState.label).toBe('Session ended');
  });

  it('Trainer Sessions: Current Session resolves live session first, else earliest upcoming today', () => {
    const testSchedules = [
      {
        id: 'sch_morning',
        title: 'Morning Class',
        date: '2026-10-16',
        time: '09:00 AM - 10:00 AM'
      },
      {
        id: 'sch_afternoon',
        title: 'Afternoon Class',
        date: '2026-10-16',
        time: '02:00 PM - 03:00 PM'
      },
      {
        id: 'sch_evening',
        title: 'Evening Class',
        date: '2026-10-16',
        time: '06:00 PM - 07:00 PM'
      }
    ];

    // Scenario A: Time is 02:15 PM (sch_afternoon is LIVE)
    const time215 = new Date(Date.UTC(2026, 9, 16, 14, 15, 0)).getTime();
    const isLive = s => {
      const start = getSessionStartDateTime(s.date, s.time).getTime();
      const end = getSessionEndDateTime(s.date, s.time).getTime();
      return time215 >= start && time215 <= end;
    };
    const live = testSchedules.find(isLive);
    expect(live.id).toBe('sch_afternoon');

    // Scenario B: Time is 11:00 AM (no session live, morning ended, earliest upcoming is afternoon)
    const time1100 = new Date(Date.UTC(2026, 9, 16, 11, 0, 0)).getTime();
    const liveB = testSchedules.find(s => {
      const start = getSessionStartDateTime(s.date, s.time).getTime();
      const end = getSessionEndDateTime(s.date, s.time).getTime();
      return time1100 >= start && time1100 <= end;
    });
    expect(liveB).toBeUndefined();

    const upcomingB = testSchedules
      .filter(s => getSessionStartDateTime(s.date, s.time).getTime() > time1100)
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
    expect(upcomingB[0].id).toBe('sch_afternoon');
  });
});
