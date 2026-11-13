/**
 * MSR Penny — Family Settlement API Service
 * File: src/services/api/settlementService.ts
 */

import { ApiClient, ApiResponse } from './apiClient';

export class SettlementService {
  /**
   * Archives a fully settled contact's transactions.
   */
  public static async archiveBatch(
    batchId: string,
    contactId: string,
    txIds: string[],
    scriptUrl?: string
  ): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({
          action: 'archive_settled',
          batchId,
          contactId,
          txIds,
        }),
      });
    }

    return await ApiClient.request('/api/archive', {
      method: 'POST',
      body: JSON.stringify({ batchId, contactId, txIds }),
    });
  }

  /**
   * Restores an archived settlement batch.
   */
  public static async restoreBatch(batchId: string, scriptUrl?: string): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({ action: 'restore_archive', batchId }),
      });
    }

    return await ApiClient.request('/api/archive', {
      method: 'POST',
      body: JSON.stringify({ action: 'restore', batchId }),
    });
  }
}
