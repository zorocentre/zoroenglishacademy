import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { getMyPortals } from '../api/competitionApi';

export function useCompetitionPortalSwitch(roleProp) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showWarning } = useDialog();
  const [hasCompetitionAccess, setHasCompetitionAccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const roleUpper = String(roleProp || user?.role || '').toUpperCase();
  const isStudent = roleUpper === 'STUDENT';

  useEffect(() => {
    if (!isStudent) {
      setHasCompetitionAccess(false);
      return;
    }

    let isMounted = true;
    const checkPortals = async () => {
      try {
        const res = await getMyPortals();
        if (isMounted && res && res.success && res.data) {
          const hasComp = Boolean(res.data.competition ?? user?.hasCompetitionRegistration);
          setHasCompetitionAccess(hasComp);
        } else if (isMounted && user) {
          setHasCompetitionAccess(Boolean(user.hasCompetitionRegistration));
        }
      } catch {
        if (isMounted && user) {
          setHasCompetitionAccess(Boolean(user.hasCompetitionRegistration));
        }
      }
    };

    checkPortals();
    return () => {
      isMounted = false;
    };
  }, [user, isStudent]);

  const handleSwitchToCompetition = useCallback(async () => {
    let canSwitch = hasCompetitionAccess;
    if (!canSwitch) {
      setLoading(true);
      try {
        const res = await getMyPortals();
        if (res && res.success && res.data) {
          canSwitch = Boolean(res.data.competition ?? user?.hasCompetitionRegistration);
          setHasCompetitionAccess(canSwitch);
        } else if (user) {
          canSwitch = Boolean(user.hasCompetitionRegistration);
          setHasCompetitionAccess(canSwitch);
        }
      } catch {
        if (user) {
          canSwitch = Boolean(user.hasCompetitionRegistration);
          setHasCompetitionAccess(canSwitch);
        }
      } finally {
        setLoading(false);
      }
    }

    if (canSwitch) {
      navigate('/competition');
      return true;
    }

    showWarning(
      'You are not currently registered for any live competitions. Browse our open scholastic competitions to enroll.',
      'No Active Competition Registration'
    );
    return false;
  }, [hasCompetitionAccess, user, navigate, showWarning]);

  return {
    isStudent,
    hasCompetitionAccess,
    handleSwitchToCompetition,
    loading
  };
}
