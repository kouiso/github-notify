import { open } from '@tauri-apps/plugin-shell';

export async function openExternalUrl(url: string): Promise<void> {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error(`non-https blocked: ${url}`);
  if (!/(^|\.)github\.com$/.test(u.hostname)) {
    throw new Error(`non-github host blocked: ${u.hostname}`);
  }
  return open(u.toString());
}
