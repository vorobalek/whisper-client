import { CallData } from './infrasctructure/call-data';
import { UpdateCallDataSubscription } from './update-call-data-subscription';

/**
 * Interface representing data required to update client information on the server.
 * Used to register or update push notification subscription details.
 */
export interface UpdateCallData extends CallData {
    /**
     * Optional subscription information for push notifications.
     * When present, updates the server with new subscription details.
     * When absent, indicates that push notifications are not supported or enabled.
     */
    b?: UpdateCallDataSubscription;
}
