// IPC channel names shared by main (ipcMain.handle) and preload (ipcRenderer.invoke).
// One channel per QuantApi method — see src/shared/types.ts for signatures.

export const IPC = {
  watchlistGet: 'watchlist:get',
  watchlistAdd: 'watchlist:add',
  watchlistRemove: 'watchlist:remove',
  symbolsSearch: 'symbols:search',
  quotesGet: 'quotes:get',
  holdingsGet: 'holdings:get',
  newsGet: 'news:get',
  earningsGet: 'earnings:get',
  chartGet: 'chart:get',
  pivotNewsGet: 'chart:pivot-news',
  openExternal: 'shell:open-external',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
