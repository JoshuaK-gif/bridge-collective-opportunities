import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'bridge_bookmarks';

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(loadBookmarks);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const isBookmarked = useCallback((id) => bookmarks.includes(id), [bookmarks]);

  const toggleBookmark = useCallback((id) => {
    setBookmarks((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  }, []);

  const addBookmark = useCallback((id) => {
    setBookmarks((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeBookmark = useCallback((id) => {
    setBookmarks((prev) => prev.filter((b) => b !== id));
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, addBookmark, removeBookmark };
}
