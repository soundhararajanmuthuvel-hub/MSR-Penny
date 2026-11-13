/**
 * MSR Penny — Transaction API Service
 * File: src/services/api/transactionService.ts
 */

import { ApiClient, ApiResponse } from './apiClient';
import { Transaction, AppState } from '../../types';

export class TransactionService {
  /**
   * Retrieves complete application state from backend or Google Sheets.
   */
  public static async fetchState(scriptUrl?: string): Promise<ApiResponse<AppState>> {
    const url = scriptUrl && scriptUrl.trim()
      ? `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=get_all_data`
      : '/api/state';

    return await ApiClient.request<AppState>(url, { method: 'GET' });
  }

  /**
   * Saves a single transaction (insert or update).
   */
  public static async saveTransaction(tx: Transaction, scriptUrl?: string): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({ action: 'add_transaction', transaction: tx }),
      });
    }

    return await ApiClient.request('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ transaction: tx }),
    });
  }

  /**
   * Deletes a transaction by ID.
   */
  public static async deleteTransaction(id: string, scriptUrl?: string): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_transaction', id }),
      });
    }

    return await ApiClient.request(`/api/transactions?id=${id}`, {
      method: 'DELETE',
    });
  }
}
