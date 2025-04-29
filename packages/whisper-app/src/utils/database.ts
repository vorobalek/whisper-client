import { Cryptography } from './cryptography';
import { Logger } from './logger';

export type DatabaseConfig = {
    dbName: string;
    tables: string[];
};

interface Database {
    initialize(config: DatabaseConfig): void;
    set<TypeData>(table: string, id: string, value: TypeData, password: string): Promise<void>;
    get<TypeData>(table: string, id: string, password: string): Promise<TypeData | null>;
    getAll<TypeData>(table: string, password: string): Promise<{ id: string; value: TypeData }[] | null>;
    delete(table: string, id: string): Promise<void>;
    clear(table: string): Promise<void>;
    getRawDump(): Promise<{
        [table: string]: Array<{ id: string; iv: number[]; salt: number[]; encryptedData: number[] }>;
    }>;
    createDatabaseFromDump(
        dbName: string,
        dump: {
            [table: string]: Array<{ id: string; iv: number[]; salt: number[]; encryptedData: number[] }>;
        },
        force?: boolean,
    ): Promise<void>;
}

function getIndexedDbDatabase(logger: Logger, cryptography: Cryptography): Database {
    let initialName: string | undefined;
    let tables: string[] = [];
    let db: IDBDatabase | null = null;

    async function open(): Promise<void> {
        if (db) {
            return;
        }
        if (initialName === undefined || initialName === null) {
            const error = '[database] indexedDB has not been initialized yet.';
            logger.error(error);
            throw new Error(error);
        }
        const name = initialName;
        await new Promise<void>(async (resolve, reject) => {
            let tableHashes: string[] = [];
            for (const table of tables) {
                tableHashes.push(await cryptography.getHashString(table));
            }
            const request: IDBOpenDBRequest = indexedDB.open(name, +process.env.BUILD_TIMESTAMP);

            request.onerror = (event: Event) => {
                const target = event.target as IDBOpenDBRequest;
                logger.error('[database] Error opening indexedDB database:', target.error);
                reject(target.error);
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const target = event.target as IDBOpenDBRequest;
                db = target.result as IDBDatabase;
                if (!db) {
                    const error = '[database] indexedDB database not found.';
                    logger.error(error);
                    throw new Error(error);
                }
                for (const tableHash of tableHashes) {
                    if (!db.objectStoreNames.contains(tableHash)) {
                        db.createObjectStore(tableHash, { keyPath: 'id' });
                    }
                }
            };

            request.onsuccess = (event: Event) => {
                const target = event.target as IDBOpenDBRequest;
                db = target.result as IDBDatabase;
                logger.debug('[database] indexedDB database opened.');
                resolve();
            };
        });
    }

    return {
        initialize(config: DatabaseConfig) {
            logger.debug(`[database] Initialized indexedDB with name ${config.dbName}.`);
            initialName = config.dbName;
            tables = config.tables;
        },
        async set<TypeData>(table: string, id: string, value: TypeData, password: string): Promise<void> {
            await open();
            const _id = await cryptography.getHashString(id);
            const _table = await cryptography.getHashString(table);
            const salt = cryptography.getSalt();
            const key = await cryptography.deriveKey(password, salt);
            const { iv, encryptedData } = await cryptography.encryptData(key, { id, value });

            return new Promise<void>((resolve, reject) => {
                const transaction = db!.transaction([_table], 'readwrite');
                const store = transaction.objectStore(_table);
                const dataToStore = {
                    id: _id,
                    iv: Array.from(iv),
                    salt: Array.from(salt),
                    encryptedData: Array.from(new Uint8Array(encryptedData)),
                };
                const request: IDBRequest = store.put(dataToStore);

                request.onsuccess = () => {
                    logger.debug(
                        `[database] Data with key '${id}' successfully encrypted and saved into table '${table}'.`,
                    );
                    resolve();
                };

                request.onerror = (event: Event) => {
                    const target = event.target as IDBRequest;
                    logger.error(
                        `[database] Error saving encrypted data with key '${id}' into table '${table}'.`,
                        target.error,
                    );
                    reject(target.error);
                };
            });
        },
        async get<TypeData>(table: string, id: string, password: string): Promise<TypeData | null> {
            await open();
            return new Promise<TypeData | null>(async (resolve, reject) => {
                const _id = await cryptography.getHashString(id);
                const _table = await cryptography.getHashString(table);
                const transaction = db!.transaction([_table], 'readonly');
                const store = transaction.objectStore(_table);
                const request: IDBRequest<
                    | {
                          id: string;
                          iv: number[];
                          salt: number[];
                          encryptedData: number[];
                      }
                    | undefined
                > = store.get(_id);

                request.onsuccess = async () => {
                    if (request.result) {
                        try {
                            const { iv, salt, encryptedData } = request.result;
                            const key = await cryptography.deriveKey(password, Uint8Array.from(salt));
                            const data = (await cryptography.decryptData(
                                key,
                                Uint8Array.from(iv),
                                Uint8Array.from(encryptedData).buffer,
                            )) as { id: string; value: TypeData };
                            logger.debug(
                                `[database] Data with key '${id}' retrieved and decrypted from table '${table}'.`,
                            );
                            resolve(data.value);
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        logger.debug(`[database] Data with key '${id}' not found in table '${table}'.`);
                        resolve(null);
                    }
                };

                request.onerror = (event: Event) => {
                    const target = event.target as IDBRequest;
                    logger.error(
                        `[database] Error retrieving data with key '${id}' from table '${table}'.`,
                        target.error,
                    );
                    reject(target.error);
                };
            });
        },
        async getAll<TypeData>(table: string, password: string): Promise<{ id: string; value: TypeData }[] | null> {
            await open();
            return new Promise<{ id: string; value: TypeData }[] | null>(async (resolve, reject) => {
                const _table = await cryptography.getHashString(table);
                const transaction = db!.transaction([_table], 'readonly');
                const store = transaction.objectStore(_table);
                const request: IDBRequest<{ id: string; iv: number[]; salt: number[]; encryptedData: number[] }[]> =
                    store.getAll();

                request.onsuccess = async () => {
                    if (request.result) {
                        const results: { id: string; value: TypeData }[] = [];
                        for (const entity of request.result) {
                            const { iv, salt, encryptedData } = entity;
                            const key = await cryptography.deriveKey(password, Uint8Array.from(salt));
                            const data = (await cryptography.decryptData(
                                key,
                                Uint8Array.from(iv),
                                Uint8Array.from(encryptedData).buffer,
                            )) as { id: string; value: TypeData };
                            results.push(data);
                        }
                        logger.debug(`[database] Data retrieved from table '${table}'.`);
                        resolve(results);
                    } else {
                        logger.debug(`[database] Data not found in table '${table}'.`);
                        resolve(null);
                    }
                };

                request.onerror = (event: Event) => {
                    const target = event.target as IDBRequest;
                    logger.error(`[database] Error retrieving data' from table '${table}'.`, target.error);
                    reject(target.error);
                };
            });
        },
        async delete(table: string, id: string): Promise<void> {
            await open();
            return new Promise<void>(async (resolve, reject) => {
                const _id = await cryptography.getHashString(id);
                const _table = await cryptography.getHashString(table);
                const transaction = db!.transaction([_table], 'readwrite');
                const store = transaction.objectStore(_table);
                const request: IDBRequest<undefined> = store.delete(_id);

                request.onsuccess = () => {
                    logger.debug(`[database] indexedDB data with key '${id}' deleted from table '${table}'.`);
                    resolve();
                };

                request.onerror = (event: Event) => {
                    const target = event.target as IDBRequest;
                    logger.error(
                        `[database] Error deleting indexedDB data with key '${id}' deleted from table '${table}'.`,
                        target.error,
                    );
                    reject(target.error);
                };
            });
        },
        async clear(table: string): Promise<void> {
            await open();
            return new Promise<void>(async (resolve, reject) => {
                const _table = await cryptography.getHashString(table);
                const transaction = db!.transaction([_table], 'readwrite');
                const store = transaction.objectStore(_table);
                const request: IDBRequest<undefined> = store.clear();

                request.onsuccess = () => {
                    logger.debug(`[database] All indexedDB keys in table '${table}' cleared.`);
                    resolve();
                };

                request.onerror = (event: Event) => {
                    const target = event.target as IDBRequest;
                    logger.error(`[database] Error clearing indexedDB keys in table '${table}'.`, target.error);
                    reject(target.error);
                };
            });
        },
        async getRawDump() {
            await open();
            const result: {
                [table: string]: Array<{ id: string; iv: number[]; salt: number[]; encryptedData: number[] }>;
            } = {};
            for (const tableName of tables) {
                const _table = await cryptography.getHashString(tableName);
                const transaction = db!.transaction([_table], 'readonly');
                const store = transaction.objectStore(_table);
                result[_table] = await new Promise<
                    Array<{
                        id: string;
                        iv: number[];
                        salt: number[];
                        encryptedData: number[];
                    }>
                >((resolve, reject) => {
                    const req = store.getAll();
                    req.onsuccess = () => {
                        if (req.result) {
                            resolve(
                                req.result.map((item) => ({
                                    id: item.id,
                                    iv: item.iv,
                                    salt: item.salt,
                                    encryptedData: item.encryptedData,
                                })),
                            );
                        } else {
                            resolve([]);
                        }
                    };
                    req.onerror = (e) => {
                        reject((e.target as IDBRequest).error);
                    };
                });
            }
            return result;
        },
        async createDatabaseFromDump(dbName, dump, force = false) {
            const existingDbs = await indexedDB.databases?.();
            let dbExists = false;
            if (existingDbs) {
                for (const dbInfo of existingDbs) {
                    if (dbInfo.name === dbName) {
                        dbExists = true;
                        break;
                    }
                }
            }
            if (dbExists) {
                if (force) {
                    logger.warn(`[database] removing indexedDB database with name '${dbName}'.`);
                    if (db && initialName === dbName) {
                        db.close();
                        db = null;
                    }
                    await new Promise<void>((resolve, reject) => {
                        const delRequest = indexedDB.deleteDatabase(dbName);
                        delRequest.onerror = () => {
                            logger.error(`[database] Error deleting indexedDB database '${dbName}'.`, delRequest.error);
                            reject(delRequest.error);
                        };
                        delRequest.onsuccess = () => {
                            logger.warn(`[database] indexedDB with name database '${dbName}' deleted successfully.`);
                            resolve();
                        };
                    });
                } else {
                    logger.error(`[database] indexedDB database with name '${dbName}' already exists.`);
                    return;
                }
            }

            const tableNames = Object.keys(dump);
            const request = indexedDB.open(dbName, +process.env.BUILD_TIMESTAMP);
            let newDb: IDBDatabase;
            await new Promise<void>((resolve, reject) => {
                request.onerror = (event: Event) => {
                    const target = event.target as IDBOpenDBRequest;
                    reject(target.error);
                };
                request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                    const target = event.target as IDBOpenDBRequest;
                    newDb = target.result as IDBDatabase;
                    for (const t of tableNames) {
                        if (!newDb.objectStoreNames.contains(t)) {
                            newDb.createObjectStore(t, { keyPath: 'id' });
                        }
                    }
                };
                request.onsuccess = (event: Event) => {
                    const target = event.target as IDBOpenDBRequest;
                    newDb = target.result as IDBDatabase;
                    resolve();
                };
            });

            const transaction = newDb!.transaction(tableNames, 'readwrite');
            for (const t of tableNames) {
                const store = transaction.objectStore(t);
                for (const item of dump[t]) {
                    store.put(item);
                }
            }

            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
            logger.warn(`[database] indexedDB with name database '${dbName}' restored successfully.`);
        },
    };
}

function getLocalStorageDatabase(logger: Logger, cryptography: Cryptography): Database {
    let initialName: string | undefined;
    let tables: string[] = [];

    return {
        initialize(config: DatabaseConfig) {
            logger.debug(`[database] Initialized localStorage with name ${config.dbName}.`);
            initialName = config.dbName;
            tables = config.tables;
        },
        async set<TypeData>(table: string, id: string, value: TypeData, password: string): Promise<void> {
            if (!initialName) {
                const error = '[database] localStorage has not been initialized yet.';
                logger.error(error);
                throw new Error(error);
            }
            const _id = await cryptography.getHashString(id);
            const _table = await cryptography.getHashString(table);
            const salt = cryptography.getSalt();
            const key = await cryptography.deriveKey(password, salt);
            const { iv, encryptedData } = await cryptography.encryptData(key, { id, value });
            const dataToStore = {
                id,
                iv: Array.from(iv),
                salt: Array.from(salt),
                encryptedData: Array.from(new Uint8Array(encryptedData)),
            };
            const storageKey = `${initialName}:${_table}:${_id}`;
            localStorage.setItem(storageKey, JSON.stringify(dataToStore));
            logger.debug(
                `[database] Data with key '${id}' successfully encrypted and saved into table '${table}' in localStorage.`,
            );
        },
        async get<TypeData>(table: string, id: string, password: string): Promise<TypeData | null> {
            if (!initialName) {
                const error = '[database] localStorage has not been initialized yet.';
                logger.error(error);
                throw new Error(error);
            }
            const _id = await cryptography.getHashString(id);
            const _table = await cryptography.getHashString(table);
            const storageKey = `${initialName}:${_table}:${_id}`;
            const dataStr = localStorage.getItem(storageKey);
            if (!dataStr) {
                logger.debug(`[database] Data with key '${id}' not found in table '${table}' in localStorage.`);
                return null;
            }
            const dataObj = JSON.parse(dataStr) as {
                id: string;
                iv: number[];
                salt: number[];
                encryptedData: number[];
            };
            const { iv, salt, encryptedData } = dataObj;
            const key = await cryptography.deriveKey(password, Uint8Array.from(salt));
            const data = (await cryptography.decryptData(
                key,
                Uint8Array.from(iv),
                Uint8Array.from(encryptedData).buffer,
            )) as { id: string; value: TypeData };
            logger.debug(
                `[database] Data with key '${id}' retrieved and decrypted from table '${table}' in localStorage.`,
            );
            return data.value;
        },
        async getAll<TypeData>(table: string, password: string): Promise<{ id: string; value: TypeData }[] | null> {
            if (!initialName) {
                const error = '[database] localStorage has not been initialized yet.';
                logger.error(error);
                throw new Error(error);
            }
            const _table = await cryptography.getHashString(table);
            const prefix = `${initialName}:${_table}:`;
            const results: { id: string; value: TypeData }[] = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const dataStr = localStorage.getItem(key)!;
                    const dataObj = JSON.parse(dataStr) as {
                        id: string;
                        iv: number[];
                        salt: number[];
                        encryptedData: number[];
                    };
                    const { iv, salt, encryptedData } = dataObj;
                    const cryptoKey = await cryptography.deriveKey(password, Uint8Array.from(salt));
                    const value = (await cryptography.decryptData(
                        cryptoKey,
                        Uint8Array.from(iv),
                        Uint8Array.from(encryptedData).buffer,
                    )) as { id: string; value: TypeData };
                    results.push(value);
                }
            }

            logger.debug(`[database] Data retrieved from table '${table}' in localStorage.`);
            return results;
        },
        async delete(table: string, id: string): Promise<void> {
            if (!initialName) {
                const error = '[database] localStorage has not been initialized yet.';
                logger.error(error);
                throw new Error(error);
            }
            const _id = await cryptography.getHashString(id);
            const _table = await cryptography.getHashString(table);
            const storageKey = `${initialName}:${_table}:${_id}`;
            localStorage.removeItem(storageKey);
            logger.debug(`[database] Data with key '${id}' deleted from table '${table}' in localStorage.`);
        },
        async clear(table: string): Promise<void> {
            if (!initialName) {
                const error = '[database] localStorage has not been initialized yet.';
                logger.error(error);
                throw new Error(error);
            }
            const _table = await cryptography.getHashString(table);
            const prefix = `${initialName}:${_table}:`;
            const keysToRemove: string[] = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach((key) => localStorage.removeItem(key));
            logger.debug(`[database] All data in table '${table}' cleared from localStorage.`);
        },
        async getRawDump() {
            if (!initialName) {
                throw new Error('[database] localStorage has not been initialized yet.');
            }
            const result: {
                [table: string]: Array<{ id: string; iv: number[]; salt: number[]; encryptedData: number[] }>;
            } = {};
            for (const table of tables) {
                const _table = await cryptography.getHashString(table);
                const prefix = `${initialName}:${_table}:`;
                const tableResults: Array<{ id: string; iv: number[]; salt: number[]; encryptedData: number[] }> = [];

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        const dataStr = localStorage.getItem(key)!;
                        const dataObj = JSON.parse(dataStr) as {
                            id: string;
                            iv: number[];
                            salt: number[];
                            encryptedData: number[];
                        };
                        const hashedId = await cryptography.getHashString(dataObj.id);
                        tableResults.push({
                            id: hashedId,
                            iv: dataObj.iv,
                            salt: dataObj.salt,
                            encryptedData: dataObj.encryptedData,
                        });
                    }
                }

                result[_table] = tableResults;
            }
            return result;
        },
        async createDatabaseFromDump(dbName, dump, force = false) {
            let dbExists = false;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(dbName + ':')) {
                    dbExists = true;
                    break;
                }
            }

            if (dbExists) {
                if (force) {
                    logger.warn(`[database] removing localStorage database with name '${dbName}'.`);
                    const prefix = dbName + ':';
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(prefix)) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach((k) => localStorage.removeItem(k));
                } else {
                    logger.error(`[database] localStorage database with name '${dbName}' already exists.`);
                    return;
                }
            }

            for (const table of Object.keys(dump)) {
                for (const item of dump[table]) {
                    const storageKey = `${dbName}:${table}:${item.id}`;
                    const dataToStore = {
                        id: item.id,
                        iv: item.iv,
                        salt: item.salt,
                        encryptedData: item.encryptedData,
                    };
                    localStorage.setItem(storageKey, JSON.stringify(dataToStore));
                }
            }
            logger.warn(`[database] localStorage with name database '${dbName}' restored successfully.`);
        },
    };
}

export default function getDatabase(logger: Logger, cryptography: Cryptography): Database {
    if (typeof indexedDB !== 'undefined') {
        return getIndexedDbDatabase(logger, cryptography);
    }
    return getLocalStorageDatabase(logger, cryptography);
}
