import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './format-relative-time';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ja-JPロケール（デフォルト）', () => {
    it('1分未満は「たった今」', () => {
      expect(formatRelativeTime('2025-06-15T11:59:30Z')).toBe('たった今');
    });

    it('1分以上60分未満は「N分前」', () => {
      expect(formatRelativeTime('2025-06-15T11:30:00Z')).toBe('30分前');
    });

    it('1時間以上24時間未満は「N時間前」', () => {
      expect(formatRelativeTime('2025-06-15T06:00:00Z')).toBe('6時間前');
    });

    it('1日以上7日未満は「N日前」', () => {
      expect(formatRelativeTime('2025-06-13T12:00:00Z')).toBe('2日前');
    });

    it('7日以上は日付表示（ja-JP）', () => {
      const result = formatRelativeTime('2025-06-01T12:00:00Z');
      expect(result).toMatch(/6月1日/);
    });
  });

  describe('en-USロケール', () => {
    it('1分未満は「now」', () => {
      expect(formatRelativeTime('2025-06-15T11:59:30Z', 'en-US')).toBe('now');
    });

    it('1分以上60分未満は「Nm」', () => {
      expect(formatRelativeTime('2025-06-15T11:30:00Z', 'en-US')).toBe('30m');
    });

    it('1時間以上24時間未満は「Nh」', () => {
      expect(formatRelativeTime('2025-06-15T06:00:00Z', 'en-US')).toBe('6h');
    });

    it('1日以上7日未満は「Nd」', () => {
      expect(formatRelativeTime('2025-06-13T12:00:00Z', 'en-US')).toBe('2d');
    });

    it('7日以上は日付表示（en-US）', () => {
      const result = formatRelativeTime('2025-06-01T12:00:00Z', 'en-US');
      expect(result).toMatch(/Jun\s+1/);
    });
  });
});
