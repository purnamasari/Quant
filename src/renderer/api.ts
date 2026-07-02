// Typed access to the bridge exposed by src/main/preload.ts.
// All renderer data access goes through this object — never touch
// ipcRenderer or Node APIs from renderer code.

import type { QuantApi } from '../shared/types';

declare global {
  interface Window {
    quant: QuantApi;
  }
}

export const api: QuantApi = window.quant;
