import type { Page } from '@playwright/test';

type TauriCommandMap = Record<string, unknown>;

export async function installTauriMock(page: Page, commands: TauriCommandMap): Promise<void> {
  await page.addInitScript((mockCommands) => {
    let nextCallbackId = 1;

    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: () => undefined,
    };

    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main' },
      },
      transformCallback: (callback: unknown) => {
        void callback;
        return nextCallbackId++;
      },
      unregisterCallback: (id: number) => {
        void id;
      },
      invoke: async (cmd: string, args?: unknown) => {
        void args;
        if (cmd === 'plugin:event|listen') return nextCallbackId++;
        if (cmd === 'plugin:event|unlisten') return undefined;
        if (cmd === 'plugin:window|hide') return undefined;

        if (cmd in mockCommands) return mockCommands[cmd as keyof typeof mockCommands];
        throw new Error(`Unhandled Tauri command in E2E mock: ${cmd}`);
      },
      convertFileSrc: (filePath: string) => filePath,
    };
  }, commands);
}
