/**
 * Web Push Notification utility for MSR Penny
 * Handles VAPID key conversion, subscription management, and push registration.
 */

// Fallback VAPID public key (can be overridden by import.meta.env.VITE_VAPID_PUBLIC_KEY)
export const DEFAULT_VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ||
  'BFumy3go8AuIfBnrtYBbst5Fksz3VkUbfJe23Q6Ydl6okux_S5BdX9hA9Jq679Evygnc_uh6fpYxb9Fs_cIa6t0';

/**
 * Convert a base64 string to a Uint8Array for applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Register for Web Push notifications
 */
export async function subscribeToPushNotifications(
  vapidPublicKey: string = DEFAULT_VAPID_PUBLIC_KEY
): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (!isPushNotificationSupported()) {
    return { success: false, error: 'Push notifications are not supported on this browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    // Save subscription to backend
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Backend push subscription save warning:', err);
    }

    return { success: true, subscription };
  } catch (err: any) {
    console.error('Failed to subscribe to push notifications:', err);
    return { success: false, error: err?.message || 'Failed to subscribe to push notifications.' };
  }
}

/**
 * Send a test notification to verify push setup
 */
export async function sendTestNotification(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: 'Test notification sent to your device!' };
    }
    return { success: false, message: data.error || 'Failed to send test notification.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error sending test notification.' };
  }
}
