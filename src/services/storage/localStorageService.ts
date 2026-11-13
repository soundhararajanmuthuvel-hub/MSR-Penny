/**
 * MSR Penny — Local Storage Service
 * File: src/services/storage/localStorageService.ts
 */

import { AppState } from '../../types';

const STORAGE_KEYS = {
  APP_STATE: 'my_money_app_state',
  PIN_LOCK: 'msr_penny_pin_config',
  OFFLINE_QUEUE: 'msr_penny_offline_queue',
};

export class LocalStorageService {
  public static getAppState(): AppState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.APP_STATE);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to parse app state from localStorage:', e);
      return null;
    }
  }

  public static setAppState(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to persist app state to localStorage:', e);
    }
  }

  public static clearAppState(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.APP_STATE);
    } catch (e) {
      console.warn('Failed to clear app state from localStorage:', e);
    }
  }
}
