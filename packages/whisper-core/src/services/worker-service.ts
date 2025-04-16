import { Logger } from '../utils/logger';

/**
 * Configuration interface for the worker service.
 * Defines properties and callbacks for service worker initialization.
 */
export type WorkerServiceConfig = {
    /**
     * Version identifier for the service worker.
     * Used to trigger service worker updates when the version changes.
     */
    version: string;

    /**
     * Optional callback triggered when a new version of the application is available.
     * Allows the application to notify the user and handle the update process.
     */
    onNewVersion?: () => void;
};

// Internal effective config for testability and browser API injection
// (not exported, just like PushServiceEffectiveConfig)
type WorkerServiceEffectiveConfig = WorkerServiceConfig & {
    navigator: Navigator;
};

/**
 * Service interface for managing the application's service worker.
 * Provides methods for initializing and accessing the service worker registration.
 */
export interface WorkerService {
    /**
     * Initializes the service worker with the provided configuration.
     * Registers the service worker and sets up update notification handling.
     *
     * @param config - Configuration with version and optional callbacks
     * @returns Promise that resolves when initialization is complete
     */
    initialize(config: WorkerServiceEffectiveConfig): Promise<void>;

    /**
     * Gets the service worker registration object, if available.
     *
     * @returns The service worker registration or undefined if not registered
     */
    get registration(): ServiceWorkerRegistration | undefined;

    /**
     * Gets the service worker container object, if available.
     *
     * @returns The service worker container or undefined if not supported
     */
    get container(): ServiceWorkerContainer | undefined;

    /**
     * Gets the active service worker controller, if available.
     *
     * @returns The active service worker controller or null/undefined if not controlling
     */
    get controller(): ServiceWorker | null | undefined;
}

/**
 * Factory function that creates and returns an implementation of the WorkerService interface.
 * Manages service worker registration, updates, and message handling.
 *
 * @param logger - Logger instance for error and debugging information
 * @returns An implementation of the WorkerService interface
 */
export function getWorkerService(logger: Logger): WorkerService {
    let serviceWorker: ServiceWorkerContainer | undefined;
    let registration: ServiceWorkerRegistration | undefined;
    return {
        get registration(): ServiceWorkerRegistration | undefined {
            return registration;
        },
        get container(): ServiceWorkerContainer | undefined {
            return serviceWorker;
        },
        get controller(): ServiceWorker | null | undefined {
            return serviceWorker?.controller;
        },
        async initialize(config: WorkerServiceEffectiveConfig): Promise<void> {
            const navigator = config.navigator;
            if (!('serviceWorker' in navigator)) {
                logger.warn('[worker-service] Service Worker is not supported in this browser.');
                return;
            }
            serviceWorker = navigator.serviceWorker;
            try {
                registration = await serviceWorker.register(`/service-worker.js?_=${config.version}`);
                logger.debug('[worker-service] Registered with scope:', registration.scope);
                registration = await serviceWorker.ready;
                logger.debug('[worker-service] Ready to use.');
            } catch (err) {
                logger.warn('[worker-service] Error registering:', err);
            }
            serviceWorker.addEventListener('message', (event: any) => {
                if (event.data && event.data.type === 'NEW_VERSION_AVAILABLE') {
                    logger.debug('[worker-service] New version is available.');
                    if (config.onNewVersion) {
                        config.onNewVersion();
                    }
                }
            });
            logger.debug('[worker-service] Initialized.');
        },
    };
}
