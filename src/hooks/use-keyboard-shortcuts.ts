import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect } from 'react';
import type { InboxItem } from '@/types';

interface UseKeyboardShortcutsOptions {
  items: InboxItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onMarkAsRead: (threadId: string) => void;
}

function isInputElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function useKeyboardShortcuts({
  items,
  selectedIndex,
  setSelectedIndex,
  onMarkAsRead,
}: UseKeyboardShortcutsOptions) {
  const moveDown = useCallback(() => {
    setSelectedIndex(Math.min(selectedIndex + 1, items.length - 1));
  }, [selectedIndex, setSelectedIndex, items.length]);

  const moveUp = useCallback(() => {
    setSelectedIndex(Math.max(selectedIndex - 1, 0));
  }, [selectedIndex, setSelectedIndex]);

  const openAndMarkRead = useCallback(async () => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      const item = items[selectedIndex];
      if (item.url) {
        await open(item.url);
      }
      if (item.unread) {
        onMarkAsRead(item.id);
      }
    }
  }, [selectedIndex, items, onMarkAsRead]);

  const markAsRead = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      const item = items[selectedIndex];
      if (item.unread) {
        onMarkAsRead(item.id);
      }
    }
  }, [selectedIndex, items, onMarkAsRead]);

  const goToTop = useCallback(() => {
    if (items.length > 0) {
      setSelectedIndex(0);
    }
  }, [items.length, setSelectedIndex]);

  const goToBottom = useCallback(() => {
    if (items.length > 0) {
      setSelectedIndex(items.length - 1);
    }
  }, [items.length, setSelectedIndex]);

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (isInputElement(e.target)) {
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          moveUp();
          break;
        case 'Enter':
          e.preventDefault();
          await openAndMarkRead();
          break;
        case 'e':
          e.preventDefault();
          markAsRead();
          break;
        case 'g':
          e.preventDefault();
          goToTop();
          break;
        case 'G':
          e.preventDefault();
          goToBottom();
          break;
      }
    },
    [moveDown, moveUp, openAndMarkRead, markAsRead, goToTop, goToBottom],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
