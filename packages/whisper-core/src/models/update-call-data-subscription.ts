import { UpdateCallDataSubscriptionKeys } from './update-call-data-subscription-keys';

/**
 * Interface representing a push notification subscription.
 * Contains all the necessary information for the server to send push notifications
 * to this client through a push service provider.
 */
export interface UpdateCallDataSubscription {
    /**
     * The URL endpoint for the push service that can be used to send notifications to this client.
     * Provided by the browser's Push API when subscribing to push notifications.
     */
    a: string;

    /**
     * Optional timestamp when the subscription expires, if applicable.
     * Some push services may issue time-limited subscriptions.
     */
    b: number | null;

    /**
     * Cryptographic keys required for encrypting push notification payloads.
     * Ensures that only the intended recipient can decrypt and read the notification content.
     */
    c: UpdateCallDataSubscriptionKeys;
}
