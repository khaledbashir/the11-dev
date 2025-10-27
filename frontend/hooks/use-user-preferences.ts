import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage user preferences with database persistence
 * Replaces localStorage-based preference management
 * 
 * @param userId - User identifier
 * @returns { preferences, loading, updatePreference, refetch }
 */
export function useUserPreferences(userId: string = 'default-user') {
  const [preferences, setPreferences] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch preferences from server
  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/preferences', {
        headers: {
          'x-user-id': userId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch preferences: ${response.status}`);
      }

      const data = await response.json();
      setPreferences(data.preferences || {});
    } catch (err: any) {
      console.error('❌ Error fetching preferences:', err);
      setError(err.message);
      // Set empty preferences on error
      setPreferences({});
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Update a single preference
  const updatePreference = useCallback(async (key: string, value: any) => {
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update preference: ${response.status}`);
      }

      // Update local state optimistically
      setPreferences(prev => ({
        ...prev,
        [key]: value,
      }));

      return true;
    } catch (err: any) {
      console.error('❌ Error updating preference:', err);
      return false;
    }
  }, [userId]);

  // Update multiple preferences at once
  const updatePreferences = useCallback(async (updates: { [key: string]: any }) => {
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update preferences: ${response.status}`);
      }

      // Update local state optimistically
      setPreferences(prev => ({
        ...prev,
        ...updates,
      }));

      return true;
    } catch (err: any) {
      console.error('❌ Error updating preferences:', err);
      return false;
    }
  }, [userId]);

  // Get a single preference value with optional default
  const getPreference = useCallback(<T = any>(key: string, defaultValue?: T): T => {
    return preferences[key] !== undefined ? preferences[key] : defaultValue;
  }, [preferences]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreference,
    updatePreferences,
    getPreference,
    refetch: fetchPreferences,
  };
}

/**
 * Hook for a single preference value
 * Simpler API when you only need one preference
 * 
 * @param key - Preference key
 * @param defaultValue - Default value if not set
 * @param userId - User identifier
 */
export function usePreference<T = any>(
  key: string,
  defaultValue: T,
  userId: string = 'default-user'
): [T, (value: T) => Promise<boolean>, boolean] {
  const { preferences, loading, updatePreference } = useUserPreferences(userId);
  
  const value = preferences[key] !== undefined ? preferences[key] : defaultValue;
  
  const setValue = useCallback(
    async (newValue: T) => {
      return await updatePreference(key, newValue);
    },
    [key, updatePreference]
  );

  return [value, setValue, loading];
}
