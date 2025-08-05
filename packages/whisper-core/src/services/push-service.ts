import { CallPayload } from '../models/infrasctructure/call-payload';
import { Base64 } from '../utils/base64';
import { Logger } from '../utils/logger';
import { WorkerService } from './worker-service';

/**
 * Configuration options for the push notification service.
 * Defines optional settings for controlling service behavior and permission callbacks.
 */
export type PushServiceConfig = {
    /**
     * When true, disables the push notification service entirely.
     */
    disablePushService?: boolean;
    /**
     * VAPID key required for push service authentication.
     */
    vapidKey?: string;
    /**
     * Callback triggered when notification permission is in 'default' state.
     */
    onPermissionDefault?: () => Promise<void>;
    /**
     * Callback triggered when notification permission is granted by the user.
     */
    onPermissionGranted?: () => Promise<void>;
    /**
     * Callback triggered when notification permission is denied by the user.
     */
    onPermissionDenied?: () => Promise<void>;
    /**
     * Optional function to convert base64 string to Uint8Array (for testability).
     */
    urlBase64ToUint8Array?: (base64String: string) => Uint8Array;
};

/**
 * Internal configuration type that extends PushServiceConfig with required
 * callback handlers and optional browser API references.
 */
type PushServiceEffectiveConfig = {
    /**
     * Callback triggered when a push notification with call payload is received.
     *
     * @param payload - The call payload containing connection information
     */
    onCall: (payload: CallPayload) => Promise<void>;
    /**
     * Optional Notification class reference for environments where global access is restricted.
     */
    notification?: typeof Notification;
    /**
     * Optional PushManager class reference for environments where global access is restricted.
     */
    pushManager?: typeof PushManager;
    /**
     * Optional function to convert url-safe base64 string to Uint8Array (for testability).
     */
    urlBase64ToUint8Array?: (base64String: string) => Uint8Array;
} & PushServiceConfig;

/**
 * Represents a push notification subscription with endpoint and encryption keys.
 * Contains all the necessary information to deliver push messages to this device.
 */
export interface Subscription {
    /**
     * URL endpoint for the push service provider.
     */
    endpoint: string;
    /**
     * Optional timestamp when this subscription expires, or null if it does not expire.
     */
    expirationTime: number | null;
    /**
     * Cryptographic keys required for securing push notification payloads.
     */
    keys: {
        /**
         * P-256 Diffie-Hellman public key for message encryption.
         */
        p256dh: string;
        /**
         * Authentication secret for the subscription.
         */
        auth: string;
    };
}

/**
 * Service interface for managing push notifications.
 * Provides methods for initialization, subscription management, and displaying notifications.
 */
export interface PushService {
    /**
     * Initializes the push notification service with the provided configuration.
     * Sets up event listeners, requests permissions if needed, and registers with push service.
     *
     * @param config - Configuration with callbacks and settings
     * @returns Promise that resolves when initialization is complete
     */
    initialize(config: PushServiceEffectiveConfig): Promise<void>;

    /**
     * Retrieves the current push notification subscription if available.
     *
     * @returns Promise resolving to the current subscription or undefined if not subscribed
     */
    getSubscription(): Promise<Subscription | undefined>;

    /**
     * Displays a notification to the user, either through the service worker or directly.
     *
     * @param title - Title text of the notification
     * @param options - Additional notification options like body text, icon, etc.
     * @returns Boolean indicating if the notification was successfully displayed
     */
    showNotification(title: string, options?: NotificationOptions): boolean;
}

/**
 * Factory function that creates and returns an implementation of the PushService interface.
 * Manages push notification subscriptions, permission handling, and notification display.
 *
 * @param logger - Logger instance for output of service events and errors
 * @param workerService - Service for accessing the service worker registration
 * @param base64 - Utility for Base64 encoding/decoding of subscription keys
 * @returns An implementation of the PushService interface
 */
export function getPushService(logger: Logger, workerService: WorkerService, base64: Base64): PushService {
    let subscription: Subscription | undefined;
    let vapidKey: string | undefined;
    let notification: typeof Notification | undefined;
    let pushManager: typeof PushManager | undefined;
    let urlBase64ToUint8Array: ((base64String: string) => Uint8Array) | undefined;
    return {
        async initialize(config: PushServiceEffectiveConfig): Promise<void> {
            if (config.disablePushService) {
                logger.warn('[push-service] Disabled.');
                return;
            }
            if (!workerService.container) {
                logger.warn('[push-service] Service Worker is not available.');
                return;
            }

            notification = config.notification;
            pushManager = config.pushManager;
            urlBase64ToUint8Array = config.urlBase64ToUint8Array;

            async function processMessage(payload: any) {
                const { data } = payload;
                if (!data) {
                    logger.error('[push-service] Invalid payload data.');
                    return;
                }
                const callPayload = data as CallPayload;
                if (!callPayload || !callPayload.a) {
                    logger.error('[push-service] Invalid payload data.');
                    return;
                }
                if (!config.onCall) {
                    logger.warn('[push-service] Message callback is not initialized.');
                    return;
                }
                try {
                    await config.onCall(callPayload);
                } catch (error) {
                    logger.error(`[push-service] Error while processing push call.`, error);
                }
            }

            workerService.container.addEventListener('message', async (event: any) => {
                if (event.data?.payload && event.data.type === 'PUSH_NOTIFICATION') {
                    logger.debug('[push-service] Message received from Service Worker:', event.data.payload);
                    await processMessage(event.data.payload);
                }
            });

            vapidKey = config.vapidKey;
            if (!config.vapidKey) {
                logger.warn('[push-service] No vapid key found.');
                return;
            }

            const Notification = notification;

            if (!Notification) {
                logger.warn('[push-service] Notifications are not supported.');
                return;
            }
            let permission: NotificationPermission = Notification.permission;
            const { onPermissionDefault, onPermissionGranted, onPermissionDenied } = config;
            if (permission === 'default') {
                if (onPermissionDefault) await onPermissionDefault();
                permission = await Notification.requestPermission();
            }
            switch (permission) {
                case 'granted':
                    logger.debug('[push-service] Notification permission granted.');
                    if (onPermissionGranted) await onPermissionGranted();
                    break;
                case 'denied':
                    logger.error('[push-service] Notification permission denied.');
                    if (onPermissionDenied) await onPermissionDenied();
                    break;
                case 'default':
                    logger.error('[push-service] Notification permission is still default.');
                    if (onPermissionDefault) await onPermissionDefault();
                    break;
            }
            logger.debug('[push-service] Initialized.');
        },
        async getSubscription(): Promise<Subscription | undefined> {
            async function getPushSubscription(
                urlBase64ToUint8Array: (base64String: string) => Uint8Array,
            ): Promise<PushSubscription | undefined> {
                if (!pushManager) {
                    logger.warn('[push-service] PushManager is not available.');
                    return undefined;
                }

                async function unsubscribePushSubscription(subscription: PushSubscription): Promise<void> {
                    try {
                        await subscription.unsubscribe();
                        logger.debug(`[push-service] Unsubscribed.`);
                    } catch (err) {
                        logger.error('[push-service] An error occurred while cancelling the subscription.', err);
                    }
                }

                const registration = workerService.registration;
                if (!registration) {
                    logger.warn('[push-service] Service Worker registration is not available.');
                    return undefined;
                }
                if (!vapidKey) {
                    logger.warn('[push-service] Vapid Key is not initialized.');
                    return undefined;
                }
                try {
                    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
                    const currentSubscription = await registration.pushManager.getSubscription();
                    if (currentSubscription?.options?.applicationServerKey) {
                        const currentSubscriptionApplicationServerKey = new Uint8Array(
                            currentSubscription.options.applicationServerKey,
                        );
                        if (
                            base64.encode(currentSubscriptionApplicationServerKey) !==
                            base64.encode(applicationServerKey)
                        ) {
                            logger.debug('[push-service] Another subscription found. Unsubscribing.');
                            await unsubscribePushSubscription(currentSubscription);
                        }
                    }
                    return await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
                    });
                } catch (err) {
                    logger.error('[push-service] An error occurred while obtaining the subscription.', err);
                    return undefined;
                }
            }

            const Notification = notification;

            if (!Notification) {
                return undefined;
            }
            if (Notification.permission !== 'granted') {
                logger.warn('[push-service] Notification permission was not granted.');
                return undefined;
            }
            if (!urlBase64ToUint8Array) {
                logger.warn('[push-service] UrlBase64ToUint8Array is not initialized.');
                return undefined;
            }
            const pushSubscription = await getPushSubscription(urlBase64ToUint8Array);
            if (!pushSubscription) {
                return undefined;
            }
            if (!pushSubscription.endpoint) {
                logger.warn('[push-service] Invalid subscription endpoint.');
                return undefined;
            }
            const p256dhKey = pushSubscription.getKey('p256dh');
            if (!p256dhKey || p256dhKey.byteLength === 0) {
                logger.warn('[push-service] Invalid p256dh key.');
                return undefined;
            }
            const authKey = pushSubscription.getKey('auth');
            if (!authKey || authKey.byteLength === 0) {
                logger.warn('[push-service] Invalid auth key.');
                return undefined;
            }
            subscription = {
                endpoint: pushSubscription.endpoint,
                expirationTime: pushSubscription.expirationTime,
                keys: {
                    p256dh: base64.encode(new Uint8Array(p256dhKey)),
                    auth: base64.encode(new Uint8Array(authKey)),
                },
            };

            logger.debug('[push-service] Subscription:', JSON.stringify(subscription));
            return subscription;
        },
        showNotification(title: string, options?: NotificationOptions) {
            function showInternal() {
                if (!workerService.controller?.postMessage) {
                    logger.warn('[push-service] Unable to show notification. Service worker is not initialized.');
                    return false;
                }
                if (!subscription) {
                    logger.warn('[push-service] Unable to show notification. Notifications unavailable.');
                    return false;
                }
                workerService.controller.postMessage({ type: 'SHOW_NOTIFICATION', title: title, options: options });
                return true;
            }

            const shown = showInternal();
            if (!shown) {
                const Notification = notification;

                if (Notification) {
                    new Notification(title, options);
                    return true;
                }
                return false;
            }
            return shown;
        },
    };
}
