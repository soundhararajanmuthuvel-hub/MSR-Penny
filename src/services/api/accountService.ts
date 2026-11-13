/**
 * MSR Penny — Account & Transfer API Service
 * File: src/services/api/accountService.ts
 */

import { ApiClient, ApiResponse } from './apiClient';
import { Account, Transfer, ReconciliationAdjustment } from '../../types';

export type AccountTransfer = Transfer;

export class AccountService {
  /**
   * Updates accounts and opening balances.
   */
  public static async updateAccounts(accounts: Account[], scriptUrl?: string): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({ action: 'update_accounts', accounts }),
      });
    }

    return await ApiClient.request('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ accounts }),
    });
  }

  /**
   * Saves an account transfer.
   */
  public static async saveTransfer(transfer: AccountTransfer, scriptUrl?: string): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({ action: 'save_transfer', transfer }),
      });
    }

    return await ApiClient.request('/api/transfers', {
      method: 'POST',
      body: JSON.stringify({ transfer }),
    });
  }

  /**
   * Deletes an account transfer by ID.
   */
  public static async deleteTransfer(id: string, scriptUrl?: string): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_transfer', id }),
      });
    }

    return await ApiClient.request(`/api/transfers?id=${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Records a bank balance reconciliation adjustment.
   */
  public static async reconcileBalance(
    rec: Omit<ReconciliationAdjustment, 'id' | 'createdAt'>,
    scriptUrl?: string
  ): Promise<ApiResponse> {
    if (scriptUrl && scriptUrl.trim()) {
      return await ApiClient.request(scriptUrl.trim(), {
        method: 'POST',
        body: JSON.stringify({ action: 'reconcile_balance', reconciliation: rec }),
      });
    }

    return await ApiClient.request('/api/reconcile', {
      method: 'POST',
      body: JSON.stringify({ reconciliation: rec }),
    });
  }
}
