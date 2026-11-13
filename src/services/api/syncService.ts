/**
 * MSR Penny — Sync & Health API Service
 * File: src/services/api/syncService.ts
 */

import { ApiClient, ApiResponse } from './apiClient';
import { AppState } from '../../types';

export class SyncService {
  /**
   * Executes bidirectional batch synchronization with Google Sheets.
   */
  public static async syncAll(payload: Partial<AppState>, scriptUrl?: string): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({
          action: 'sync_all',
          ...payload,
        }),
      });
    }

    return await ApiClient.request('/api/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Runs automated data health integrity diagnostics.
   */
  public static async runHealthCheck(scriptUrl?: string): Promise<ApiResponse> {
    const url = scriptUrl && scriptUrl.trim()
      ? `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=health`
      : '/api/health';

    return await ApiClient.request(url, { method: 'GET' });
  }
}
