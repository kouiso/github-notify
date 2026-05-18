import { describe, expect, it, vi } from 'vitest';

const openMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (url: string) => openMock(url),
}));

import { openExternalUrl } from './open-url';

describe('openExternalUrl', () => {
  it('https://github.com の URL は open() に委譲する', async () => {
    openMock.mockClear();
    await openExternalUrl('https://github.com/kouiso/github-notify/pull/24');
    expect(openMock).toHaveBeenCalledWith('https://github.com/kouiso/github-notify/pull/24');
  });

  it('https://api.github.com も通過する (github.com サブドメイン)', async () => {
    openMock.mockClear();
    await openExternalUrl('https://api.github.com/notifications');
    expect(openMock).toHaveBeenCalledWith('https://api.github.com/notifications');
  });

  it('http:// (非 https) は throw する', async () => {
    openMock.mockClear();
    await expect(openExternalUrl('http://github.com/foo')).rejects.toThrow('non-https blocked');
    expect(openMock).not.toHaveBeenCalled();
  });

  it('github.com 以外のホストは throw する', async () => {
    openMock.mockClear();
    await expect(openExternalUrl('https://evil.example.com/phish')).rejects.toThrow(
      'non-github host blocked',
    );
    expect(openMock).not.toHaveBeenCalled();
  });

  it('似た名前のドメイン (github.com.evil.com) は通過しない', async () => {
    openMock.mockClear();
    await expect(openExternalUrl('https://github.com.evil.com/x')).rejects.toThrow(
      'non-github host blocked',
    );
    expect(openMock).not.toHaveBeenCalled();
  });

  it('javascript: スキームは throw する', async () => {
    openMock.mockClear();
    await expect(openExternalUrl('javascript:alert(1)')).rejects.toThrow('non-https blocked');
    expect(openMock).not.toHaveBeenCalled();
  });
});
