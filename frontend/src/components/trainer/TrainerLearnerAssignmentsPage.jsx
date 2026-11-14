import React from 'react';
import AssignmentPage from '../student/AssignmentPage';

/**
 * Dedicated Trainer's Assignments page (Task I2).
 * Reuses the exact components, viewer rules, and structure of AssignmentPage parameterized by role='TRAINER'.
 */
export default function TrainerLearnerAssignmentsPage({ setActiveScreen }) {
  return <AssignmentPage setActiveScreen={setActiveScreen} role="TRAINER" />;
}
