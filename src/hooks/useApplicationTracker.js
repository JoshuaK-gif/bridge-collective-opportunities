import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'bridge_applications';

const STATUSES = ['Applied', 'Shortlisted', 'Accepted', 'Rejected'];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useApplicationTracker() {
  const [applications, setApplications] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  }, [applications]);

  const getStatus = useCallback((id) => applications[id] || null, [applications]);

  const setStatus = useCallback((id, status) => {
    if (status && !STATUSES.includes(status)) return;
    setApplications((prev) => {
      if (status === null) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { status, updatedAt: new Date().toISOString() } };
    });
  }, []);

  const getAllApplications = useCallback(() => applications, [applications]);

  return { getStatus, setStatus, getAllApplications, STATUSES };
}
