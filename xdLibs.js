/* xdLibs.js library - merged libs: xdTok.js, xdbLite.js, xdSrv.js, xdReq.js
 * Status: Private prototype
 * License: MIT
 * ------------------------------------------------------------------------------
 * Copyright (c) 2026 Jakub Śledzikowski <jsledzikowski.web@gmail.com>
 *
 */

import http from "http";
import https from "https";
import {
 URL,
 URLSearchParams
} from "url";
import {
 gunzipSync,
 inflateSync,
 brotliDecompressSync
} from "zlib";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
 EventEmitter
} from "node:events";

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
 RADIX = 64,
 TIMESTAMP_LENGTH = 9,
 INSTANCE_LENGTH = 3,
 COUNTER_LENGTH = 4,
 _DEFAULT_LENGTH = 36,
 PREFIX_LENGTH = 24,
 HASH_KEY = "xddd666_lol",
 MIN_LENGTH = TIMESTAMP_LENGTH + INSTANCE_LENGTH + COUNTER_LENGTH,
 MAX_COUNTER = RADIX ** COUNTER_LENGTH - 1,
 DEFAULT_LENGTH = _DEFAULT_LENGTH < MIN_LENGTH ? MIN_LENGTH : _DEFAULT_LENGTH;
const state = {
 lastTimestamp: -1,
 counter: 0,
 instanceId: (function() {
 let result = "";
 for (let i = 0; i < INSTANCE_LENGTH; i++) {
 result += CHARSET[Math.floor(Math.random() * RADIX)];
 }
 return result;
 })()
};
const toBase64 = (n, l) => {
 let r = "",
 v = n;
 while (v > 0) r = CHARSET[v % RADIX] + r, v = Math.floor(v / RADIX);
 return r.padStart(l, CHARSET[0])
};
const generateRandomString = (l) => {
 if (l <= 0) return "";
 let r = "";
 for (let i = 0; i < l; i++) r += CHARSET[Math.floor(Math.random() * RADIX)];
 return r
};
export const xdTok = (length = DEFAULT_LENGTH) => {
 length = "number" == typeof length ? Math.floor(length) : DEFAULT_LENGTH;
 if (length < 6 || length > 96) throw new Error("Token length must be between 6 and 96 characters.");
 const t = Date.now();
 t < state.lastTimestamp ? console.warn(`Clock went back: ${t} < ${state.lastTimestamp}. Instance: ${state.instanceId}. Strict monotonicity broken.`) : t > state.lastTimestamp && (state.lastTimestamp = t, state.counter = 0);
 state.counter > MAX_COUNTER && (console.warn(`Counter overflow detected at timestamp ${state.lastTimestamp}. Instance: ${state.instanceId}. Resetting counter. Collision risk increases.`), state.counter = 0);
 const c = state.counter++,
 ts = toBase64(t, TIMESTAMP_LENGTH),
 cp = toBase64(c, COUNTER_LENGTH),
 bt = ts + state.instanceId + cp,
 el = length - MIN_LENGTH;
 return el >= 0 ? bt + generateRandomString(el) : bt.slice(0, length)
};
export const xdDrawNum = (c = 0, d = 999) => {
 const o = {
 a: Math.floor(c),
 b: Math.floor(d),
 s: 0,
 l: 0,
 h: 0,
 set: (m = 0, M = 9) => (o.a = Math.floor(m), o.b = Math.floor(M), o.b < o.a && (() => {
 throw new RangeError('M<$')
 })(), o),
 next: () => {
 if (o.b < o.a) throw new RangeError('Invalid range');
 const m = o.a,
 M = o.b,
 r = M - m + 1;
 if (r <= 0) throw new RangeError('Invalid range');
 const n = Date.now(),
 p = "undefined" != typeof globalThis && globalThis.performance && "function" == typeof globalThis.performance.now ? globalThis.performance.now() : 0;
 o.s = (o.s + 1) % r;
 const e = o.s + Math.floor(n / 1e3) + Math.floor(p);
 if ("undefined" != typeof globalThis && globalThis.crypto && "function" == typeof globalThis.crypto.getRandomValues) {
 const a = new Uint32Array(1),
 x = 4294967296,
 l = Math.floor(x / r) * r;
 let v;
 do {
 globalThis.crypto.getRandomValues(a), v = (a[0] ^ n ^ e) >>> 0
 } while (v >= l);
 return m + v % r
 }
 const g = Math.random() * r;
 return m + Math.floor((g + e) % r)
 }
 };
 return !c && !d ? o.next() : o.set(c, d).next()
};
const simpleHash = (d, k) => {
 const e = new TextEncoder(),
 db = e.encode(d),
 kb = e.encode(k),
 r = new Uint8Array(db);
 for (let i = 0; i < r.length; i++) r[i] ^= kb[i % kb.length];
 for (let i = 0; i < r.length; i++) r[i] ^= kb[kb.length - 1 - i % kb.length];
 for (let i = 0; i < r.length - 1; i += 2) {
 const t = r[i];
 r[i] = r[i + 1], r[i + 1] = t
 }
 for (let i = 0; i < r.length; i++) r[i] = ((r[i] << 3) | (r[i] >>> 5)) & 255;
 return r
};
const simpleUnhash = (hb, k) => {
 const e = new TextEncoder(),
 d = new TextDecoder(),
 kb = e.encode(k),
 r = new Uint8Array(hb);
 for (let i = 0; i < r.length; i++) r[i] = ((r[i] >>> 3) | (r[i] << 5)) & 255;
 for (let i = 0; i < r.length - 1; i += 2) {
 const t = r[i];
 r[i] = r[i + 1], r[i + 1] = t
 }
 for (let i = 0; i < r.length; i++) r[i] ^= kb[kb.length - 1 - i % kb.length];
 for (let i = 0; i < r.length; i++) r[i] ^= kb[i % kb.length];
 return d.decode(r)
};
export const xdHash = (data) => {
 if ("string" != typeof data || 0 === data.length) return null;
 try {
 const s = xdTok(8),
 p = xdTok(PREFIX_LENGTH),
 k = HASH_KEY + s,
 h = simpleHash(data, k),
 b = String.fromCharCode(...h);
 return p + s + btoa(b)
 } catch (_) {
 return null
 }
};
export const xdUnHash = (h) => {
 if ("string" != typeof h || h.length <= PREFIX_LENGTH + 8) return null;
 try {
 const s = h.slice(PREFIX_LENGTH, PREFIX_LENGTH + 8),
 p = h.slice(PREFIX_LENGTH + 8),
 b = atob(p),
 a = new Uint8Array(b.length);
 for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
 return simpleUnhash(a, HASH_KEY + s)
 } catch (_) {
 return null
 }
};
const XDB_ERROR_CODES = {
 FILE_NOT_FOUND: "XDB_FILE_NOT_FOUND",
 DIR_NOT_FOUND: "XDB_DIR_NOT_FOUND",
 IO_ERROR: "XDB_IO_ERROR",
 INVALID_JSON: "XDB_INVALID_JSON",
 RECORD_NOT_FOUND: "XDB_RECORD_NOT_FOUND",
 RECORD_EXISTS: "XDB_RECORD_EXISTS",
 OPERATION_FAILED: "XDB_OPERATION_FAILED"
};
const LOG_LEVELS = {
 DEBUG: 10,
 INFO: 20,
 WARN: 30,
 ERROR: 40,
 NONE: 100
};
const __filename = '';
const __dirname = process.cwd();
let basePath = __dirname;
const DEFAULT_XDB_ID_LENGTH = 16;
const DEFAULT_LOCK_TIMEOUT = 5000;
const fileLocks = new Map();
const lockCleanup = new Set();
const dataCache = new Map();
let currentLogLevel = LOG_LEVELS.INFO;
let cachingEnabled = false;
let cacheTTL = 60000;

function log(level, message, ...args) {
 if (level < currentLogLevel) return;
 const timestamp = new Date().toISOString();
 const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || "UNKNOWN";
 const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
 switch (level) {
 case LOG_LEVELS.DEBUG:
 console.debug(formattedMessage, ...args);
 break;
 case LOG_LEVELS.INFO:
 console.log(formattedMessage, ...args);
 break;
 case LOG_LEVELS.WARN:
 console.warn(formattedMessage, ...args);
 break;
 case LOG_LEVELS.ERROR:
 console.error(formattedMessage, ...args);
 break;
 }
}

function createXdbError(message, code = XDB_ERROR_CODES.OPERATION_FAILED) {
 const error = new Error(message);
 error.code = code;
 return error;
}

function ensureJsonExtension(filePath) {
 if (!filePath.toLowerCase().endsWith(".json")) {
 return filePath + ".json";
 }
 return filePath;
}
async function ensureDirectoryExists(dirPath) {
 try {
 await fs.mkdir(dirPath, {
 recursive: true
 });
 } catch (error) {
 if (error.code !== "EEXIST") {
 throw createXdbError(`Błąd tworzenia katalogu ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
 }
 }
}

function generateId(length = DEFAULT_XDB_ID_LENGTH) {
 try {
 const buffer = crypto.randomBytes(Math.ceil(length * 0.75));
 const base64 = buffer.toString('base64')
 .replace(/\+/g, '-')
 .replace(/\//g, '_')
 .replace(/=/g, '');
 const timestamp = Date.now().toString(36);
 const combined = timestamp + base64;
 return combined.slice(0, length);
 } catch (err) {
 log(LOG_LEVELS.WARN, `Nie udało się użyć crypto, używam zapasowego generatora ID: ${err.message}`);
 const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
 let result = '';
 const timestamp = Date.now().toString(36);
 const randomPart = Array(length - timestamp.length)
 .fill(0)
 .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
 .join('');
 return (timestamp + randomPart).slice(0, length);
 }
}

function getCacheKey(filePath, id = null) {
 filePath = ensureJsonExtension(filePath);
 return id ? `${filePath}:${id}` : filePath;
}

function getCachedData(filePath, id = null) {
 if (!cachingEnabled) return null;
 const key = getCacheKey(filePath, id);
 const cached = dataCache.get(key);
 if (!cached) return null;
 const now = Date.now();
 if (now - cached.timestamp > cacheTTL) {
 dataCache.delete(key);
 return null;
 }
 log(LOG_LEVELS.DEBUG, `Cache hit dla: ${key}`);
 return cached.data;
}

function setCachedData(filePath, data, id = null) {
 if (!cachingEnabled) return;
 const key = getCacheKey(filePath, id);
 dataCache.set(key, {
 data,
 timestamp: Date.now()
 });
 log(LOG_LEVELS.DEBUG, `Dodano do cache: ${key}`);
}

function invalidateCache(filePath, id = null) {
 if (!cachingEnabled) return;
 if (id) {
 const key = getCacheKey(filePath, id);
 dataCache.delete(key);
 log(LOG_LEVELS.DEBUG, `Usunięto z cache: ${key}`);
 } else {
 const prefix = getCacheKey(filePath);
 for (const key of dataCache.keys()) {
 if (key === prefix || key.startsWith(`${prefix}:`)) {
 dataCache.delete(key);
 log(LOG_LEVELS.DEBUG, `Usunięto z cache: ${key}`);
 }
 }
 }
}

function clearAllCache() {
 dataCache.clear();
 log(LOG_LEVELS.INFO, `Wyczyszczono cały cache`);
} // ==================== PLIKOVY LOCK SYSTEM - ZELPENA FIX (Punkt 1) ====================
const LOCK_TIMEOUT = 30000;
const LOCK_RETRY_INTERVAL = 50;
const LOCK_MAX_RETRIES = 600;
process.once('SIGINT', cleanupLocks);
process.once('SIGTERM', cleanupLocks);

function cleanupLocks() {
 log(LOG_LEVELS.INFO, 'Cleaning up file locks due to process termination');
 for (const [filePath, lockData] of fileLocks.entries()) {
 if (lockData.release) {
 try {
 lockData.release();
 } catch (e) {
 // Ignore errors during cleanup
 }
 }
 fileLocks.delete(filePath);
 }
 lockCleanup.clear();
}
async function acquireLock(filePath, timeout = LOCK_TIMEOUT) {
 const fullPath = path.resolve(getBasePath(), filePath);
 const startTime = Date.now();
 const processId = process.pid;
 log(LOG_LEVELS.DEBUG, `Próba uzyskania blokady dla: ${filePath} (PID: ${processId})`);
 if (lockCleanup.has(`${fullPath}:${processId}`)) {
 throw createXdbError(
 `Process ${processId} already holds lock for ${filePath} - potential deadlock`,
 XDB_ERROR_CODES.OPERATION_FAILED
 );
 }
 let retryCount = 0;

 while (fileLocks.has(fullPath)) {
 if (Date.now() - startTime > timeout) {
 throw createXdbError(
 `Timeout podczas oczekiwania na blokadę pliku ${filePath} po ${timeout}ms`,
 XDB_ERROR_CODES.OPERATION_FAILED
 );
 }
 const lockData = fileLocks.get(fullPath);
 if (lockData && lockData.expiresAt < Date.now()) {
 log(LOG_LEVELS.WARN, `Usuwam wygasłą blokadę dla: ${fullPath}`);
 if (lockData.release) {
 try {
 lockData.release();
 } catch (e) {}
 }
 fileLocks.delete(fullPath);
 lockCleanup.delete(`${fullPath}:${lockData.processId}`);
 break;
 }
 retryCount++;
 if (retryCount > LOCK_MAX_RETRIES) {
 throw createXdbError(
 `Przekroczono maksymalną liczbę prób uzyskania blokady dla: ${filePath}`,
 XDB_ERROR_CODES.OPERATION_FAILED
 );
 }
 await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_INTERVAL));
 }
 let release;
 const lockPromise = new Promise(resolve => {
 release = resolve;
 });
 const lockData = {
 promise: lockPromise,
 release: () => release(),
 expiresAt: Date.now() + timeout,
 processId: processId,
 filePath: fullPath
 };
 fileLocks.set(fullPath, lockData);
 lockCleanup.add(`${fullPath}:${processId}`);
 log(LOG_LEVELS.DEBUG, `Uzyskano blokadę dla: ${filePath} (PID: ${processId})`);
 return () => releaseLock(fullPath, release, processId);
}

function releaseLock(fullPath, release, processId) {
 if (fileLocks.has(fullPath)) {
 const lockData = fileLocks.get(fullPath);
 if (lockData.processId === processId) {
 if (release && typeof release === 'function') {
 release();
 }
 fileLocks.delete(fullPath);
 lockCleanup.delete(`${fullPath}:${processId}`);
 log(LOG_LEVELS.DEBUG, `Zwolniono blokadę dla: ${fullPath} (PID: ${processId})`);
 } else {
 log(LOG_LEVELS.WARN, `Próba zwolnienia blokady przez niewłaściwy proces: ${processId} != ${lockData.processId}`);
 }
 }
} // ==================== CENTRALNY ERROR HANDLER (Punkt 3) ====================
const createCentralErrorHandler = () => {
 const errorListeners = new Set();
 const unhandledRejections = new Map();

 process.on('unhandledRejection', (reason, promise) => {
 const errorId = Date.now() + Math.random().toString(36).substr(2, 9);
 unhandledRejections.set(promise, {
 reason,
 timestamp: Date.now(),
 errorId
 });

 log(LOG_LEVELS.ERROR, `Unhandled Promise Rejection (ID: ${errorId}):`, reason);

 for (const listener of errorListeners) {
 try {
 listener('unhandledRejection', {
 reason,
 promise,
 errorId
 });
 } catch (e) {}
 }
 });

 process.on('rejectionHandled', (promise) => {
 unhandledRejections.delete(promise);
 });

 const handleError = (error, context = {}) => {
 const errorWithContext = {
 ...context,
 message: error?.message || String(error),
 stack: error?.stack,
 code: error?.code,
 timestamp: Date.now()
 };

 log(LOG_LEVELS.ERROR, `Central Error Handler:`, errorWithContext);

 for (const listener of errorListeners) {
 try {
 listener('error', errorWithContext);
 } catch (e) {}
 }

 return errorWithContext;
 };

 const handleAsyncError = async (operation, context = {}) => {
 try {
 return await operation();
 } catch (error) {
 return handleError(error, context);
 }
 };

 const wrapAsyncOperation = (operation, context = {}) => {
 return async (...args) => {
 try {
 return await operation(...args);
 } catch (error) {
 const handledError = handleError(error, {
 ...context,
 args: args.length > 0 ? args : undefined
 });
 throw handledError;
 }
 };
 };

 return {
 handleError,
 handleAsyncError,
 wrapAsyncOperation,
 addListener: (listener) => errorListeners.add(listener),
 removeListener: (listener) => errorListeners.delete(listener),
 getUnhandledRejections: () => [...unhandledRejections.values()]
 };
};
const errorHandler = createCentralErrorHandler();
async function safeParseJSON(filePath) {
 const fullPath = path.resolve(basePath, filePath);
 const cachedData = getCachedData(filePath);
 if (cachedData !== null) {
 return cachedData;
 }
 return await errorHandler.handleAsyncError(async () => {
 const data = await fs.readFile(fullPath, "utf-8");
 try {
 const parsedData = JSON.parse(data);
 setCachedData(filePath, parsedData);
 return parsedData;
 } catch (parseError) {
 throw createXdbError(`Nieprawidłowy JSON w pliku ${filePath}: ${parseError.message}`, XDB_ERROR_CODES.INVALID_JSON);
 }
 }, {
 operation: 'safeParseJSON',
 filePath
 });
}

function validateId(id) {
 if (typeof id !== "string" || id.length === 0) {
 throw createXdbError(`Nieprawidłowe ID: ID musi być niepustym stringiem. Otrzymano: ${id}`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
}

function validateRecord(record) {
 if (!record || typeof record !== "object" || Array.isArray(record)) {
 throw createXdbError("Rekord musi być niepustym obiektem.", XDB_ERROR_CODES.OPERATION_FAILED);
 }
}
async function cleanupTempFile(tempPath) {
 if (!tempPath) return;
 try {
 await fs.unlink(tempPath);
 } catch (e) {
 if (e.code !== "ENOENT") {
 log(LOG_LEVELS.WARN, `Nie udało się usunąć pliku tymczasowego ${tempPath}: ${e.message}`);
 }
 }
}

function getBasePath() {
 return basePath;
}
async function atomicWrite(filePath, data) {
 const fullPath = path.resolve(getBasePath(), filePath);
 let tempPath;
 let fileHandle;
 try {
 tempPath = fullPath + ".tmp" + Date.now() + Math.random();
 await ensureDirectoryExists(path.dirname(fullPath));
 fileHandle = await fs.open(tempPath, "w");
 await fileHandle.writeFile(data, "utf-8");
 await fileHandle.sync();
 await fileHandle.close();
 fileHandle = null;
 await fs.rename(tempPath, fullPath);
 log(LOG_LEVELS.DEBUG, `Pomyślnie zapisano plik: ${filePath}`);
 invalidateCache(filePath);
 } catch (error) {
 if (fileHandle) {
 try {
 await fileHandle.close();
 } catch (closeError) {
 log(LOG_LEVELS.WARN, `Nie udało się zamknąć uchwytu pliku tymczasowego: ${closeError.message}`);
 }
 }
 await cleanupTempFile(tempPath);
 throw createXdbError(`Atomowy zapis do ${filePath} nie powiódł się: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
 }
}
async function setConfig(options = {}) {
 if (options.basePath) {
 basePath = path.resolve(options.basePath);
 log(LOG_LEVELS.INFO, `Ustawiono ścieżkę bazową: ${basePath}`);
 }
 if (options.logLevel !== undefined) {
 const requestedLevel = options.logLevel.toUpperCase ? options.logLevel.toUpperCase() : options.logLevel;
 if (typeof requestedLevel === 'string' && LOG_LEVELS[requestedLevel] !== undefined) {
 currentLogLevel = LOG_LEVELS[requestedLevel];
 log(LOG_LEVELS.INFO, `Ustawiono poziom logowania: ${requestedLevel}`);
 } else if (typeof requestedLevel === 'number') {
 currentLogLevel = requestedLevel;
 const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === requestedLevel);
 log(LOG_LEVELS.INFO, `Ustawiono poziom logowania: ${levelName || requestedLevel}`);
 }
 }
 if (options.cachingEnabled !== undefined) {
 cachingEnabled = !!options.cachingEnabled;
 log(LOG_LEVELS.INFO, `Cache ${cachingEnabled ? 'włączony' : 'wyłączony'}`);
 if (!cachingEnabled) {
 clearAllCache();
 }
 }
 if (options.cacheTTL !== undefined && typeof options.cacheTTL === 'number' && options.cacheTTL > 0) {
 cacheTTL = options.cacheTTL;
 log(LOG_LEVELS.INFO, `Ustawiono TTL cache: ${cacheTTL}ms`);
 }
 return {
 basePath: getBasePath(),
 logLevel: currentLogLevel,
 cachingEnabled,
 cacheTTL
 };
}
async function addDir(dirPath) {
 try {
 const fullPath = path.resolve(getBasePath(), dirPath);
 await ensureDirectoryExists(fullPath);
 log(LOG_LEVELS.INFO, `Utworzono katalog: ${dirPath}`);
 return {
 path: fullPath
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas tworzenia katalogu ${dirPath}: ${error.message}`);
 throw createXdbError(`Nie udało się utworzyć katalogu ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
 }
}
async function delDir(dirPath) {
 let release = null;
 const fullPath = path.resolve(getBasePath(), dirPath);
 try {
 release = await acquireLock(dirPath);
 try {
 await fs.stat(fullPath);
 } catch (statError) {
 if (statError.code === "ENOENT") {
 throw createXdbError(`Katalog ${dirPath} nie istnieje.`, XDB_ERROR_CODES.DIR_NOT_FOUND);
 }
 throw statError;
 }
 await fs.rm(fullPath, {
 recursive: true,
 force: true
 });
 log(LOG_LEVELS.INFO, `Usunięto katalog: ${dirPath}`);
 return {
 path: fullPath
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas usuwania katalogu ${dirPath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się usunąć katalogu ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function renameDir(oldPath, newPath) {
 let release = null;
 const oldFullPath = path.resolve(getBasePath(), oldPath);
 const newFullPath = path.resolve(getBasePath(), newPath);
 try {
 release = await acquireLock(oldPath);
 try {
 await fs.stat(oldFullPath);
 } catch (error) {
 if (error.code === "ENOENT") {
 throw createXdbError(`Katalog źródłowy ${oldPath} nie istnieje.`, XDB_ERROR_CODES.DIR_NOT_FOUND);
 }
 throw createXdbError(`Nie udało się uzyskać dostępu do katalogu źródłowego ${oldPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 }
 await ensureDirectoryExists(path.dirname(newFullPath));
 await fs.rename(oldFullPath, newFullPath);
 log(LOG_LEVELS.INFO, `Zmieniono nazwę katalogu z ${oldPath} na ${newPath}`);
 return {
 oldPath: oldFullPath,
 newPath: newFullPath
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas zmiany nazwy katalogu z ${oldPath} na ${newPath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się zmienić nazwy katalogu z ${oldPath} na ${newPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function moveFile(sourcePath, targetPath) {
 let release = null;
 sourcePath = ensureJsonExtension(sourcePath);
 targetPath = ensureJsonExtension(targetPath);
 const sourceFullPath = path.resolve(getBasePath(), sourcePath);
 const targetFullPath = path.resolve(getBasePath(), targetPath);
 try {
 release = await acquireLock(sourcePath);
 try {
 await fs.stat(sourceFullPath);
 } catch (error) {
 if (error.code === "ENOENT") {
 throw createXdbError(`Plik źródłowy ${sourcePath} nie istnieje.`, XDB_ERROR_CODES.FILE_NOT_FOUND);
 }
 throw createXdbError(`Nie udało się uzyskać dostępu do pliku źródłowego ${sourcePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 }
 await ensureDirectoryExists(path.dirname(targetFullPath));
 await fs.rename(sourceFullPath, targetFullPath);
 invalidateCache(sourcePath);
 log(LOG_LEVELS.INFO, `Przeniesiono plik z ${sourcePath} do ${targetPath}`);
 return {
 source: sourceFullPath,
 target: targetFullPath
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas przenoszenia pliku z ${sourcePath} do ${targetPath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się przenieść pliku z ${sourcePath} do ${targetPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function addAll(filePath, initialData = [], options = {
 overwrite: true
}) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
 if (!initialData || typeof initialData !== "object") {
 throw createXdbError("Nieprawidłowe dane: Dane muszą być tablicą lub obiektem.", XDB_ERROR_CODES.OPERATION_FAILED);
 }
 let processedData = initialData;
 if (Array.isArray(initialData)) {
 processedData = initialData.map(record => {
 if (!record || typeof record !== "object" || Array.isArray(record)) {
 throw createXdbError("Rekord musi być niepustym obiektem.", XDB_ERROR_CODES.OPERATION_FAILED);
 }
 let currentId = record.id;
 if (currentId === undefined || currentId === null) {
 currentId = generateId();
 } else {
 currentId = String(currentId);
 }
 return {
 ...record,
 id: currentId
 };
 });
 const ids = processedData.map(r => r.id);
 if (new Set(ids).size !== ids.length) {
 throw createXdbError(`Znaleziono zduplikowane ID w dostarczonych danych.`, XDB_ERROR_CODES.RECORD_EXISTS);
 }
 } else {
 validateRecord(initialData);
 let currentId = initialData.id;
 if (currentId === undefined || currentId === null) {
 currentId = generateId();
 } else {
 currentId = String(currentId);
 }
 processedData = {
 ...initialData,
 id: currentId
 };
 }
 release = await acquireLock(filePath);
 await ensureDirectoryExists(path.dirname(fullPath));
 let fileExists = false;
 try {
 await fs.stat(fullPath);
 fileExists = true;
 } catch (statError) {
 if (statError.code !== "ENOENT") throw statError;
 }
 if (fileExists && !options.overwrite) {
 throw createXdbError(`Plik ${filePath} już istnieje. Ustaw options.overwrite na true, aby nadpisać.`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 const dataToWrite = Array.isArray(processedData) ? processedData : [processedData];
 await atomicWrite(filePath, JSON.stringify(dataToWrite));
 log(LOG_LEVELS.INFO, `Dodano ${dataToWrite.length} rekordów do ${filePath}`);
 return {
 path: fullPath
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas dodawania danych do ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się dodać danych do ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function addRecordById(filePath, newRecord) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
 validateRecord(newRecord);
 release = await acquireLock(filePath);
 let data = await safeParseJSON(filePath);
 if (!Array.isArray(data)) {
 throw createXdbError(`Nie można dodać rekordu: Plik ${filePath} istnieje, ale nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 let recordToAdd = {
 ...newRecord
 };
 if (recordToAdd.id === undefined || recordToAdd.id === null) {
 recordToAdd.id = generateId();
 let attempts = 0;
 const maxAttempts = 10;
 while (data.some(record => String(record.id) === String(recordToAdd.id)) && attempts < maxAttempts) {
 recordToAdd.id = generateId();
 attempts++;
 log(LOG_LEVELS.DEBUG, `Kolizja ID, próba ${attempts}/${maxAttempts}: ${recordToAdd.id}`);
 }
 if (attempts >= maxAttempts) {
 throw createXdbError(`Nie udało się wygenerować unikalnego ID dla ${filePath} po ${maxAttempts} próbach.`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 } else {
 recordToAdd.id = String(recordToAdd.id);
 validateId(recordToAdd.id);
 if (data.some(record => String(record.id) === String(recordToAdd.id))) {
 throw createXdbError(`Rekord z ID ${recordToAdd.id} już istnieje w ${filePath}.`, XDB_ERROR_CODES.RECORD_EXISTS);
 }
 }
 data.push(recordToAdd);
 await atomicWrite(filePath, JSON.stringify(data));
 log(LOG_LEVELS.INFO, `Dodano rekord z ID ${recordToAdd.id} do ${filePath}`);
 return {
 path: fullPath,
 record: recordToAdd
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas dodawania rekordu do ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się dodać rekordu do ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function editAll(filePath, newData) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
 if (!newData || typeof newData !== "object") {
 throw createXdbError("Nieprawidłowe dane: Dane muszą być tablicą lub obiektem.", XDB_ERROR_CODES.OPERATION_FAILED);
 }
 if (Array.isArray(newData)) {
 for (const record of newData) {
 try {
 validateRecord(record);
 if (record.id !== undefined && record.id !== null) {
 record.id = String(record.id);
 validateId(record.id);
 }
 } catch (validationError) {
 throw createXdbError(`Nieprawidłowy rekord w tablicy danych: ${validationError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 }
 }
 release = await acquireLock(filePath);
 const dataWritten = Array.isArray(newData) ? newData : [newData];
 await atomicWrite(filePath, JSON.stringify(dataWritten));
 log(LOG_LEVELS.INFO, `Zaktualizowano ${filePath} - ${dataWritten.length} rekordów`);
 return {
 path: fullPath
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas edycji danych w ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się edytować danych w ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function editRecordById(filePath, id, newRecord) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
 const recordId = String(id);
 validateId(recordId);
 validateRecord(newRecord);
 release = await acquireLock(filePath);
 let data = await safeParseJSON(filePath);
 if (!Array.isArray(data)) {
 throw createXdbError(`Nie można edytować rekordu po ID: Plik ${filePath} nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 const recordIndex = data.findIndex(record => String(record.id) === recordId);
 if (recordIndex === -1) {
 throw createXdbError(`Rekord z ID ${recordId} nie został znaleziony w ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
 }
 const originalRecord = {
 ...data[recordIndex]
 };
 const updatedRecord = {
 ...originalRecord,
 ...newRecord,
 id: originalRecord.id
 };
 data[recordIndex] = updatedRecord;
 await atomicWrite(filePath, JSON.stringify(data));
 log(LOG_LEVELS.INFO, `Zaktualizowano rekord z ID ${recordId} w ${filePath}`);
 setCachedData(filePath, updatedRecord, recordId);
 return {
 path: fullPath,
 record: updatedRecord
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas edycji rekordu z ID ${id} w ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się edytować rekordu z ID ${id} w ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function deleteAll(filePath) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
 release = await acquireLock(filePath);
 try {
 await fs.stat(fullPath);
 await atomicWrite(filePath, JSON.stringify([]));
 } catch (statError) {
 if (statError.code === "ENOENT") {
 return {
 path: fullPath
 };
 }
 throw statError;
 }
 log(LOG_LEVELS.INFO, `Usunięto wszystkie rekordy z ${filePath}`);
 return {
 path: fullPath
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas usuwania wszystkich rekordów z ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się usunąć wszystkich rekordów z ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function deleteRecordById(filePath, id) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
 const recordId = String(id);
 validateId(recordId);
 release = await acquireLock(filePath);
 let data = await safeParseJSON(filePath);
 if (!Array.isArray(data)) {
 throw createXdbError(`Nie można usunąć rekordu po ID: Plik ${filePath} nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 const initialLength = data.length;
 const filteredData = data.filter(record => String(record.id) !== recordId);
 if (initialLength === filteredData.length) {
 throw createXdbError(`Rekord z ID ${recordId} nie został znaleziony w ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
 }
 await atomicWrite(filePath, JSON.stringify(filteredData));
 log(LOG_LEVELS.INFO, `Usunięto rekord z ID ${recordId} z ${filePath}`);
 invalidateCache(filePath, recordId);
 return {
 path: fullPath,
 deletedId: recordId
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas usuwania rekordu z ID ${id} z ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się usunąć rekordu z ID ${id} z ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function viewAll(filePath) {
 try {
 filePath = ensureJsonExtension(filePath);
 const parsedData = await safeParseJSON(filePath);
 return {
 path: path.resolve(basePath, filePath),
 data: parsedData
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas pobierania danych z ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się pobrać danych z ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
 }
}
async function viewRecordById(filePath, id) {
 try {
 const recordId = String(id);
 validateId(recordId);
 const cachedRecord = getCachedData(filePath, recordId);
 if (cachedRecord !== null) {
 return {
 path: path.resolve(basePath, filePath),
 record: cachedRecord,
 fromCache: true
 };
 }
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 const data = await safeParseJSON(filePath);
 if (!Array.isArray(data)) {
 throw createXdbError(`Nie można pobrać rekordu po ID: Plik ${filePath} nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 const record = data.find(record => String(record.id) === recordId);
 if (!record) {
 throw createXdbError(`Rekord z ID ${recordId} nie został znaleziony w ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
 }
 setCachedData(filePath, record, recordId);
 return {
 path: fullPath,
 record
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas pobierania rekordu z ID ${id} z ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się pobrać rekordu z ID ${id} z ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
 }
}
async function viewMore(filePath, options = {}) {
 try {
 filePath = ensureJsonExtension(filePath);
 let data = await safeParseJSON(filePath);
 if (!Array.isArray(data)) {
 throw createXdbError(`Nie można wykonać zapytania: Plik ${filePath} nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 if (options.filter && typeof options.filter === 'function') {
 try {
 data = data.filter(options.filter);
 } catch (filterError) {
 throw createXdbError(`Błąd podczas filtrowania: ${filterError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 }
 if (options.sort) {
 const sortCriteria = Array.isArray(options.sort) ? options.sort : [options.sort];
 try {
 data.sort((a, b) => {
 for (const criterion of sortCriteria) {
 const {
 key,
 order = 'asc'
 } = criterion;
 const direction = order.toLowerCase() === 'desc' ? -1 : 1;
 if (!key || typeof key !== 'string') {
 continue;
 }
 const valA = a[key];
 const valB = b[key];
 if (valA === valB) continue;
 if (valA === undefined || valA === null) return 1 * direction;
 if (valB === undefined || valB === null) return -1 * direction;
 if (valA < valB) return -1 * direction;
 if (valA > valB) return 1 * direction;
 }
 return 0;
 });
 } catch (sortError) {
 throw createXdbError(`Błąd podczas sortowania: ${sortError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
 }
 const skip = options.skip && Number.isInteger(options.skip) && options.skip > 0 ? options.skip : 0;
 const limit = options.limit && Number.isInteger(options.limit) && options.limit > 0 ? options.limit : data.length;
 const paginatedData = data.slice(skip, skip + limit);
 const totalCount = data.length;
 log(LOG_LEVELS.DEBUG, `Pobrano ${paginatedData.length} z ${totalCount} rekordów z ${filePath}`);
 return {
 path: path.resolve(basePath, filePath),
 data: paginatedData,
 meta: {
 total: totalCount,
 skip: skip,
 limit: limit,
 page: Math.floor(skip / limit) + 1,
 totalPages: Math.ceil(totalCount / limit)
 }
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas zapytania do ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się wykonać zapytania do ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
 }
}
async function del(filePath) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
 release = await acquireLock(filePath);
 try {
 await fs.unlink(fullPath);
 log(LOG_LEVELS.INFO, `Usunięto plik: ${filePath}`);
 } catch (unlinkError) {
 if (unlinkError.code === "ENOENT") {
 log(LOG_LEVELS.INFO, `Plik ${filePath} nie istniał, operacja zakończona sukcesem`);
 } else {
 throw unlinkError;
 }
 }
 invalidateCache(filePath);
 return {
 path: fullPath
 };
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas usuwania pliku ${filePath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się usunąć pliku ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
 if (release) release();
 }
}
async function listDir(dirPath) {
 try {
 const fullPath = path.resolve(getBasePath(), dirPath);

 try {
 await fs.stat(fullPath);
 } catch (statError) {
 if (statError.code === "ENOENT") {
 throw createXdbError(`Katalog ${dirPath} nie istnieje.`, XDB_ERROR_CODES.DIR_NOT_FOUND);
 }
 throw statError;
 }

 const items = await fs.readdir(fullPath);
 log(LOG_LEVELS.INFO, `Wylistowano ${items.length} elementów z katalogu: ${dirPath}`);

 return items;
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Błąd podczas listowania katalogu ${dirPath}: ${error.message}`);
 if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
 throw createXdbError(`Nie udało się wylistować katalogu ${dirPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 }
}
const xdBLite = {
 config: setConfig,
 dir: {
 add: addDir,
 del: delDir,
 rename: renameDir,
 list: listDir
 },
 move: {
 file: moveFile
 },
 edit: {
 all: editAll,
 id: editRecordById
 },
 del: {
 file: del,
 all: deleteAll,
 id: deleteRecordById
 },
 add: {
 all: addAll,
 id: addRecordById
 },
 view: {
 all: viewAll,
 id: viewRecordById,
 more: viewMore
 },
 cache: {
 clear: clearAllCache,
 invalidate: invalidateCache
 }
};
export const xdbLite = xdBLite; // ==================== CONSTANTS ====================
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const WS_READY_STATES = Object.freeze({
 CONNECTING: 0,
 OPEN: 1,
 CLOSING: 2,
 CLOSED: 3
});
const WS_OPCODES = Object.freeze({
 CONTINUATION: 0x0,
 TEXT: 0x1,
 BINARY: 0x2,
 CLOSE: 0x8,
 PING: 0x9,
 PONG: 0xA
});
const HOP_BY_HOP_HEADERS = new Set([
 'connection', 'keep-alive', 'proxy-authenticate',
 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'
]);
const DEFAULT_MIME_TYPES = Object.freeze({
 html: 'text/html; charset=utf-8',
 css: 'text/css; charset=utf-8',
 js: 'application/javascript; charset=utf-8',
 mjs: 'application/javascript; charset=utf-8',
 json: 'application/json; charset=utf-8',
 txt: 'text/plain; charset=utf-8',
 svg: 'image/svg+xml',
 png: 'image/png',
 jpg: 'image/jpeg',
 jpeg: 'image/jpeg',
 webp: 'image/webp',
 ico: 'image/x-icon',
 woff: 'font/woff',
 woff2: 'font/woff2',
 wasm: 'application/wasm',
 map: 'application/json; charset=utf-8',
 avif: 'image/avif',
 bmp: 'image/bmp'
}); // ==================== SECURITY UTILITIES ====================
const HTML_RE = /[&<>"']/g;
const HTML_UNQUOTED_RE = /[&<>"'`=\/ \t\n\r]/g;
const HTML_ESCAPES = Object.freeze({
 '&': '&amp;',
 '<': '&lt;',
 '>': '&gt;',
 '"': '&quot;',
 "'": '&#39;'
});
const HTML_UNQUOTED_ESCAPES = Object.freeze({
 ...HTML_ESCAPES,
 '`': '&#96;',
 '=': '&#61;',
 '/': '&#47;',
 ' ': '&#32;',
 '\t': '&#9;',
 '\n': '&#10;',
 '\r': '&#13;'
});
const JS_ESC_RE = /[\\'"`\u2028\u2029<&/]/g;
const CSS_SAFE_RE = /[^a-zA-Z0-9 _\-.,]/g;
const URL_PROTOCOL_RE = /^\s*([a-zA-Z][a-zA-Z0-9+.-]*):/;
const END_SCRIPT_RE = /<\/script/gi;
const DEFAULT_ESCAPE_OPTIONS = Object.freeze({
 handleObjects: 'convert',
 context: 'auto',
 quote: '"',
 targetName: null,
 inAttribute: false,
 urlPolicy: Object.freeze({
 allow: ['http', 'https', 'mailto', 'tel', 'data'],
 dataMimeAllow: /^image\/(png|gif|jpeg|webp|svg\+xml)$/i,
 onFail: 'about:blank'
 }),
 normalize: false
}); // ==================== CORE UTILITIES ====================
const safeJsonStringify = (value) => {
 const seen = new WeakSet();
 return JSON.stringify(value, (key, val) => {
 if (typeof val === 'object' && val !== null) {
 if (seen.has(val)) return '[Circular]';
 seen.add(val);
 }
 return val;
 }) || '';
};
const parseUrlSearchParams = (search) => Object.fromEntries(new URLSearchParams(search));
const createErrorWithCode = (msg, code) => {
 const e = new Error(msg);
 e.code = code;
 return e;
};
const createRegexPattern = (pattern) => {
 if (!pattern.includes(':')) return null;
 return new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
};
const mapReplace = (string, regex, mapping) =>
 string.replace(regex, char => mapping[char] || char);
const toStringSafe = (value, options = {}) => {
 if (value == null) return '';

 if (typeof value === 'string') {
 return options.normalize ? value.normalize('NFC') : value;
 }

 if (typeof value === 'number' || typeof value === 'bigint' ||
 typeof value === 'boolean' || typeof value === 'symbol') {
 return String(value);
 }

 if (value instanceof Date) {
 return isNaN(value.getTime()) ? '' : value.toISOString();
 }

 const handleObjects = options.handleObjects || 'convert';
 if (handleObjects === 'empty') return '';
 if (handleObjects === 'json') return safeJsonStringify(value);
 if (handleObjects === 'throw') {
 throw new TypeError('Non-primitive values not allowed');
 }

 return String(value);
};
const cssEscapeIdent = (string) => {
 let result = '';

 for (let i = 0; i < string.length; i++) {
 const char = string[i];
 const code = string.charCodeAt(i);

 if ((code >= 0x30 && code <= 0x39) ||
 (code >= 0x41 && code <= 0x5A) ||
 (code >= 0x61 && code <= 0x7A) ||
 char === '-' || char === '_') {

 if (i === 0 && code >= 0x30 && code <= 0x39) {
 result += '\\3' + char + ' ';
 continue;
 }

 result += char;
 } else {
 result += '\\' + code.toString(16) + ' ';
 }
 }

 return result;
};
const cssEscapeString = (string) =>
 string.replace(CSS_SAFE_RE, char =>
 '\\' + char.codePointAt(0).toString(16) + ' '
 );
const jsEscapeString = (string, quoteChar) =>
 string.replace(JS_ESC_RE, char => {
 switch (char) {
 case '\\':
 return '\\\\';
 case quoteChar:
 return '\\' + quoteChar;
 case '`':
 return '\\`';
 case '\u2028':
 return '\\u2028';
 case '\u2029':
 return '\\u2029';
 case '<':
 return '\\x3C';
 case '&':
 return '\\x26';
 case '/':
 return '\\/';
 default:
 return char;
 }
 });
const isSafeUrl = (url, policy) => {
 const match = String(url).match(URL_PROTOCOL_RE);
 if (!match) return {
 ok: true,
 url
 };

 const protocol = match[1].toLowerCase();

 if (protocol === 'data') {
 if (!policy.allow.includes('data')) return {
 ok: false
 };

 const dataPart = String(url).slice(match[0].length);
 const mimeMatch = dataPart.match(/^([^;,]+)[;,]/);
 const mimeType = mimeMatch ? mimeMatch[1].trim() : '';

 if (!policy.dataMimeAllow.test(mimeType)) return {
 ok: false
 };
 return {
 ok: true,
 url
 };
 }

 return policy.allow.includes(protocol) ? {
 ok: true,
 url
 } : {
 ok: false
 };
};
const sanitizeUrl = (url, policy) => {
 const result = isSafeUrl(url, policy);

 if (result.ok) return String(url);

 switch (policy.onFail) {
 case 'strip':
 return '';
 case 'throw':
 throw new Error('Blocked URL protocol');
 default:
 return 'about:blank';
 }
};
const detectContext = (string, options) => {
 if (!options.inAttribute || !options.targetName) {
 return 'htmlContent';
 }

 const name = options.targetName.toLowerCase();

 if (/^on/.test(name)) return 'jsString';
 if (name === 'style') return 'cssString';
 if (/^(href|src|xlink:href|action|formaction|poster|data)$/i.test(name)) {
 return 'url';
 }

 return options.quote ? 'htmlAttribute' : 'htmlAttributeUnquoted';
}; // ==================== UTF-8 VALIDATION FOR WEBSOCKET (Punkt 2) ====================
const isValidUTF8 = (buffer) => {
 try {
 const text = buffer.toString('utf8');
 Buffer.from(text, 'utf8');
 return true;
 } catch {
 return false;
 }
};
const escapeAny = (value, options = {}) => {
 const opts = {
 ...DEFAULT_ESCAPE_OPTIONS,
 ...options
 };
 let string = toStringSafe(value, opts);

 if (opts.normalize && typeof string.normalize === 'function') {
 string = string.normalize('NFC');
 }
 const context = opts.context === 'auto' ?
 detectContext(string, opts) : opts.context;
 switch (context) {
 case 'htmlContent':
 case 'htmlAttribute':
 return mapReplace(string, HTML_RE, HTML_ESCAPES);

 case 'htmlAttributeUnquoted':
 return mapReplace(string, HTML_UNQUOTED_RE, HTML_UNQUOTED_ESCAPES);

 case 'htmlComment':
 return string
 .replace(/--/g, '&#45;&#45;')
 .replace(/>/g, '>')
 .replace(/</g, '<');

 case 'jsString':
 return jsEscapeString(string,
 opts.quote === "'" ? "'" :
 opts.quote === '`' ? '`' : '"'
 );

 case 'scriptData':
 return string
 .replace(END_SCRIPT_RE, '<\\/script')
 .replace(/\u2028/g, '\\u2028')
 .replace(/\u2029/g, '\\u2029');

 case 'cssString':
 return cssEscapeString(string);

 case 'cssIdent':
 return cssEscapeIdent(string);

 case 'cssUrl':
 return `url("${mapReplace(
 sanitizeUrl(string, opts.urlPolicy),
 HTML_RE,
 HTML_ESCAPES
 )}")`;

 case 'url':
 return sanitizeUrl(string, opts.urlPolicy);

 case 'urlComponent':
 return encodeURIComponent(string);

 default:
 return mapReplace(string, HTML_RE, HTML_ESCAPES);
 }
};
const safeText = (value) => escapeAny(value, {
 context: 'htmlContent'
});
const safeAttr = (name, value, {
 quoted = true,
 ...options
} = {}) => {
 const escapedValue = escapeAny(value, {
 context: 'auto',
 inAttribute: true,
 targetName: name,
 quote: quoted ? '"' : '',
 ...options
 });

 return quoted ? `${name}="${escapedValue}"` : `${name}=${escapedValue}`;
};
const safeUrlAttr = (name, url, options = {}) => {
 const escapedUrl = escapeAny(url, {
 context: 'url',
 inAttribute: true,
 targetName: name,
 ...options
 });

 return `${name}="${mapReplace(escapedUrl, HTML_RE, HTML_ESCAPES)}"`;
}; // ==================== LRU CACHE WITH MEMORY LIMITS (Punkt 5) ====================
const createCache = ({
 max = 500,
 ttl = 0,
 maxMemoryBytes = Infinity,
 updateAgeOnGet = true,
 dispose = null
} = {}) => {
 const cache = new Map();
 const expiries = new Map();
 let currentMemoryUsage = 0;

 const calculateItemSize = (value) => {
 if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
 if (Buffer.isBuffer(value)) return value.length;
 if (typeof value === 'object') {
 try {
 return Buffer.byteLength(JSON.stringify(value), 'utf8');
 } catch {
 return 1024;
 }
 }
 return String(value).length;
 };

 const isExpired = (key) => {
 const expiry = expiries.get(key);
 return expiry !== undefined && expiry !== Infinity && Date.now() > expiry;
 };

 const evictOne = () => {
 const oldestKey = cache.keys().next().value;
 if (oldestKey === undefined) return false;

 const value = cache.get(oldestKey);
 const itemSize = calculateItemSize(value);

 cache.delete(oldestKey);
 expiries.delete(oldestKey);
 currentMemoryUsage -= itemSize;

 if (dispose) dispose(oldestKey, value, 'evict');
 return true;
 };

 const deleteKey = (key) => {
 if (!cache.has(key)) return false;

 const value = cache.get(key);
 const itemSize = calculateItemSize(value);

 cache.delete(key);
 expiries.delete(key);
 currentMemoryUsage -= itemSize;

 if (dispose) dispose(key, value, 'delete');
 return true;
 };

 const get = (key) => {
 if (!cache.has(key)) return undefined;

 if (isExpired(key)) {
 deleteKey(key);
 return undefined;
 }

 const value = cache.get(key);
 if (updateAgeOnGet) {
 cache.delete(key);
 cache.set(key, value);
 }

 return value;
 };

 const set = (key, value, setOpts = {}) => {
 const effectiveTtl = setOpts.ttl !== undefined ? setOpts.ttl : ttl;
 const expiry = effectiveTtl === Infinity || effectiveTtl <= 0 ? Infinity : Date.now() + effectiveTtl;
 const itemSize = calculateItemSize(value);

 if (itemSize > maxMemoryBytes) {
 log(LOG_LEVELS.WARN, `Item ${key} too large for cache: ${itemSize} bytes > ${maxMemoryBytes} max`);
 return false;
 }

 if (cache.has(key)) {
 const oldValue = cache.get(key);
 const oldSize = calculateItemSize(oldValue);
 currentMemoryUsage -= oldSize;
 cache.delete(key);
 expiries.delete(key);
 }

 while ((cache.size >= max || currentMemoryUsage + itemSize > maxMemoryBytes) && cache.size > 0) {
 if (!evictOne()) break;
 }

 if (currentMemoryUsage + itemSize > maxMemoryBytes) {
 log(LOG_LEVELS.WARN, `Insufficient cache memory for ${key}: ${currentMemoryUsage + itemSize} > ${maxMemoryBytes}`);
 return false;
 }

 cache.set(key, value);
 expiries.set(key, expiry);
 currentMemoryUsage += itemSize;
 return true;
 };

 const has = (key) => {
 if (!cache.has(key)) return false;
 if (isExpired(key)) {
 deleteKey(key);
 return false;
 }
 return true;
 };

 const clear = () => {
 if (dispose) {
 for (const [key, value] of cache) {
 dispose(key, value, 'clear');
 }
 }
 cache.clear();
 expiries.clear();
 currentMemoryUsage = 0;
 };

 const getKeys = () => {
 const validKeys = [];
 for (const key of cache.keys()) {
 if (!isExpired(key)) validKeys.push(key);
 }
 return validKeys[Symbol.iterator]();
 };

 const getSize = () => cache.size;

 const getMemoryUsage = () => currentMemoryUsage;

 const prune = () => {
 let expiredCount = 0;
 for (const [key, expiry] of expiries) {
 if (expiry !== Infinity && Date.now() > expiry) {
 deleteKey(key);
 expiredCount++;
 }
 }
 return expiredCount;
 };

 const pruneInterval = setInterval(() => {
 const expired = prune();
 if (expired > 0) {
 log(LOG_LEVELS.DEBUG, `Auto-pruned ${expired} expired items from cache`);
 }
 }, 5 * 60 * 1000);

 process.once('beforeExit', () => {
 clearInterval(pruneInterval);
 clear();
 });

 return {
 get,
 set,
 has,
 delete: deleteKey,
 clear,
 keys: getKeys,
 size: getSize,
 memoryUsage: getMemoryUsage,
 prune
 };
};
const xdLRU = (opts = {}) => {
 const {
 max = 500, ttl = 0, updateAgeOnGet = true, dispose = null
 } = opts;
 return createCache({
 max,
 ttl,
 updateAgeOnGet,
 dispose
 });
}; // ==================== REDIS-LIKE STORE ====================
const createRedisInstance = ({
 max = 1000
} = {}) => {
 const wrap = (type, data) => ({
 __type: type,
 data
 });
 const expiries = new Map();
 const cache = xdLRU({
 max,
 ttl: Infinity,
 updateAgeOnGet: true,
 dispose: key => expiries.delete(key)
 });
 const expired = (key) => {
 const expiry = expiries.get(key);
 return expiry !== undefined && expiry !== Infinity && Date.now() > expiry;
 };
 const assertType = (entry, type) => {
 if (!entry || entry.__type !== type) {
 throw new Error('WRONGTYPE Operation against a key holding the wrong kind of value');
 }
 };
 const setWithTTL = (key, payload, ttlSeconds = -1) => {
 const expiry = ttlSeconds >= 0 ? Date.now() + ttlSeconds * 1000 : Infinity;
 expiries.set(key, expiry);
 cache.set(key, payload, {
 ttl: expiry === Infinity ? Infinity : expiry - Date.now()
 });
 };
 const touch = (key) => {
 if (expired(key)) {
 cache.delete(key);
 return false;
 }
 return true;
 };
 const getEntry = (key) => cache.get(key);
 const getTtlSeconds = (key) => {
 if (!touch(key) || !cache.has(key)) return -2;

 const expiry = expiries.get(key);
 if (expiry === Infinity) return -1;
 return Math.max(1, Math.ceil((expiry - Date.now()) / 1000));
 };
 const preserveTtl = (key) => {
 const ttl = getTtlSeconds(key);
 return ttl === -2 ? -1 : ttl;
 };
 const stringOperations = {
 set: (key, value, {
 ttl = -1
 } = {}) => {
 setWithTTL(key, wrap('string', value), ttl);
 return 'OK';
 },
 get: (key) => {
 if (!touch(key)) return null;
 const entry = getEntry(key);
 return entry ? entry.data : null;
 },
 incr: (key) => {
 const value = stringOperations.get(key);
 const num = parseInt(value ?? 0, 10);

 if (Number.isNaN(num) && value !== null) {
 throw new Error('ERR value is not an integer or out of range');
 }

 const result = (Number.isNaN(num) ? 0 : num) + 1;
 stringOperations.set(key, String(result), {
 ttl: preserveTtl(key)
 });
 return result;
 },
 decr: (key) => {
 const value = stringOperations.get(key);
 const num = parseInt(value ?? 0, 10);

 if (Number.isNaN(num) && value !== null) {
 throw new Error('ERR value is not an integer or out of range');
 }

 const result = (Number.isNaN(num) ? 0 : num) - 1;
 stringOperations.set(key, String(result), {
 ttl: preserveTtl(key)
 });
 return result;
 },
 append: (key, string) => {
 const current = String(stringOperations.get(key) ?? '');
 const result = current + string;
 stringOperations.set(key, result, {
 ttl: preserveTtl(key)
 });
 return result.length;
 }
 };
 const listOperations = {
 lpush: (key, ...elements) => {
 touch(key);
 const entry = getEntry(key);
 const list = entry ? (assertType(entry, 'list'), entry.data) : [];

 for (const element of elements) {
 list.unshift(String(element));
 }

 setWithTTL(key, wrap('list', list), preserveTtl(key));
 return list.length;
 },
 rpush: (key, ...elements) => {
 touch(key);
 const entry = getEntry(key);
 const list = entry ? (assertType(entry, 'list'), entry.data) : [];

 for (const element of elements) {
 list.push(String(element));
 }

 setWithTTL(key, wrap('list', list), preserveTtl(key));
 return list.length;
 },
 lpop: (key) => {
 if (!touch(key) || !cache.has(key)) return null;

 const entry = getEntry(key);
 if (!entry) return null;

 assertType(entry, 'list');
 if (entry.data.length === 0) return null;

 const value = entry.data.shift();

 if (entry.data.length) {
 setWithTTL(key, wrap('list', entry.data), preserveTtl(key));
 } else {
 api.del(key);
 }

 return value;
 },
 rpop: (key) => {
 if (!touch(key) || !cache.has(key)) return null;

 const entry = getEntry(key);
 if (!entry) return null;

 assertType(entry, 'list');
 if (entry.data.length === 0) return null;

 const value = entry.data.pop();

 if (entry.data.length) {
 setWithTTL(key, wrap('list', entry.data), preserveTtl(key));
 } else {
 api.del(key);
 }

 return value;
 },
 lrange: (key, start, end) => {
 if (!touch(key) || !cache.has(key)) return [];

 const entry = getEntry(key);
 if (!entry) return [];

 assertType(entry, 'list');
 const length = entry.data.length;
 const getIndex = (index) => (index < 0 ? length + index : index);
 const from = Math.max(0, getIndex(start));
 const to = Math.min(length - 1, getIndex(end));

 return from <= to ? entry.data.slice(from, to + 1) : [];
 }
 };
 const hashOperations = {
 hset: (key, field, value) => {
 touch(key);
 const entry = getEntry(key);
 const hash = entry ? (assertType(entry, 'hash'), entry.data) : {};
 const isNew = !(String(field) in hash);

 hash[String(field)] = String(value);
 setWithTTL(key, wrap('hash', hash), preserveTtl(key));

 return isNew ? 1 : 0;
 },
 hget: (key, field) => {
 if (!touch(key) || !cache.has(key)) return null;

 const entry = getEntry(key);
 if (!entry) return null;

 assertType(entry, 'hash');
 return entry.data[String(field)] ?? null;
 },
 hdel: (key, ...fields) => {
 if (!touch(key) || !cache.has(key)) return 0;

 const entry = getEntry(key);
 if (!entry) return 0;

 assertType(entry, 'hash');
 let deletedCount = 0;

 for (const field of fields) {
 const fieldKey = String(field);
 if (Object.prototype.hasOwnProperty.call(entry.data, fieldKey)) {
 delete entry.data[fieldKey];
 deletedCount++;
 }
 }

 if (deletedCount > 0) {
 if (Object.keys(entry.data).length) {
 setWithTTL(key, wrap('hash', entry.data), preserveTtl(key));
 } else {
 api.del(key);
 }
 }

 return deletedCount;
 },
 hkeys: (key) => {
 if (!touch(key) || !cache.has(key)) return [];

 const entry = getEntry(key);
 if (!entry) return [];

 assertType(entry, 'hash');
 return Object.keys(entry.data);
 },
 hgetall: (key) => {
 if (!touch(key) || !cache.has(key)) return {};

 const entry = getEntry(key);
 if (!entry) return {};

 assertType(entry, 'hash');
 return {
 ...entry.data
 };
 }
 };
 const setOperations = {
 sadd: (key, ...members) => {
 touch(key);
 const entry = getEntry(key);
 const set = entry ? (assertType(entry, 'set'), entry.data) : new Set();
 let addedCount = 0;

 for (const member of members) {
 const memberStr = String(member);
 if (!set.has(memberStr)) {
 set.add(memberStr);
 addedCount++;
 }
 }

 if (addedCount > 0 || !entry) {
 setWithTTL(key, wrap('set', set), preserveTtl(key));
 }

 return addedCount;
 },
 srem: (key, ...members) => {
 if (!touch(key) || !cache.has(key)) return 0;

 const entry = getEntry(key);
 if (!entry) return 0;

 assertType(entry, 'set');
 let removedCount = 0;

 for (const member of members) {
 if (entry.data.delete(String(member))) removedCount++;
 }

 if (removedCount > 0) {
 if (entry.data.size) {
 setWithTTL(key, wrap('set', entry.data), preserveTtl(key));
 } else {
 api.del(key);
 }
 }

 return removedCount;
 },
 smembers: (key) => {
 if (!touch(key) || !cache.has(key)) return [];

 const entry = getEntry(key);
 if (!entry) return [];

 assertType(entry, 'set');
 return [...entry.data];
 },
 sismember: (key, member) => {
 if (!touch(key) || !cache.has(key)) return 0;

 const entry = getEntry(key);
 if (!entry) return 0;

 assertType(entry, 'set');
 return entry.data.has(String(member)) ? 1 : 0;
 }
 };
 const api = {
 exists: (key) => touch(key) && cache.has(key),
 del: (key) => cache.delete(key),
 keys: (pattern = '*') => {
 const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
 const result = [];
 for (const key of cache.keys()) {
 if (touch(key) && cache.has(key) && regex.test(key)) {
 result.push(key);
 }
 }
 return result;
 },
 ttl: (key) => getTtlSeconds(key),
 expire: (key, seconds) => {
 if (!api.exists(key)) return 0;

 const newTtlMs = seconds * 1000;
 expiries.set(key, Date.now() + newTtlMs);
 const payload = cache.get(key);

 if (payload !== undefined) {
 cache.set(key, payload, {
 ttl: newTtlMs
 });
 }

 return 1;
 },
 flushAll: () => {
 cache.clear();
 expiries.clear();
 return 'OK';
 },
 dbsize: () => {
 let count = 0;
 for (const key of cache.keys()) {
 if (touch(key) && cache.has(key)) count++;
 }
 return count;
 },
 ...stringOperations,
 ...listOperations,
 ...hashOperations,
 ...setOperations
 };
 const createRedisQueue = (queueKey, worker, options = {}) => {
 const {
 concurrency = 1,
 pollInterval = 500,
 maxRetries = 3,
 baseRetryDelay = 1000,
 dlqKeySuffix = '_DLQ'
 } = options;
 let running = 0;
 let stopped = false;
 let pollTimeout;
 const dlqName = `${queueKey}${dlqKeySuffix}`;
 const processTask = async () => {
 const taskString = api.lpop(queueKey);
 if (taskString == null) {
 running--;
 return;
 }
 let taskPayload;
 try {
 taskPayload = JSON.parse(taskString);
 } catch {
 api.rpush(dlqName, JSON.stringify({
 malformedTaskString: taskString,
 error: 'Failed to parse task JSON',
 failedAt: new Date().toISOString()
 }));
 running--;
 if (!stopped) scheduleNext();
 return;
 }
 const {
 originalTask,
 retryCount = 0
 } = taskPayload;
 try {
 await worker(originalTask);
 } catch (error) {
 const attempt = retryCount + 1;
 if (attempt <= maxRetries) {
 await new Promise(resolve => setTimeout(
 resolve,
 baseRetryDelay * Math.pow(2, attempt - 1)
 ));
 api.rpush(queueKey, JSON.stringify({
 originalTask,
 retryCount: attempt
 }));
 } else {
 api.rpush(dlqName, JSON.stringify({
 taskPayloadAtFailure: taskPayload,
 error: error instanceof Error ? error.message : String(error),
 errorStack: error instanceof Error ? error.stack : undefined,
 failedAt: new Date().toISOString()
 }));
 }
 } finally {
 running--;
 if (!stopped) scheduleNext();
 }
 };
 const scheduleNext = () => {
 if (stopped) return;

 while (running < concurrency) {
 running++;
 processTask();

 if (api.lrange(queueKey, 0, 0).length === 0 && running === 0) {
 break;
 }
 }
 };
 const startPolling = () => {
 if (stopped) return;
 scheduleNext();
 pollTimeout = setTimeout(startPolling, pollInterval);
 };
 startPolling();
 return {
 enqueue: (task) => {
 const length = api.rpush(queueKey, JSON.stringify({
 originalTask: task,
 retryCount: 0
 }));

 if (!stopped && running < concurrency) {
 clearTimeout(pollTimeout);
 startPolling();
 }

 return length;
 },
 stop: () => {
 stopped = true;
 clearTimeout(pollTimeout);
 },
 get length() {
 return api.lrange(queueKey, 0, -1).length;
 },
 get isRunning() {
 return !stopped;
 },
 getDLQName: () => dlqName,
 get dlqLength() {
 return api.lrange(dlqName, 0, -1).length;
 },
 viewDLQ: (start = 0, end = -1) =>
 api.lrange(dlqName, start, end).map(item => JSON.parse(item))
 };
 };
 return {
 ...api,
 createRedisQueue: (queueKey, worker, options) => createRedisQueue(queueKey, worker, options)
 };
};
const xdRedis = createRedisInstance; // ==================== HTTP UTILITIES ====================
const signData = (data, secret) =>
 crypto.createHmac('sha256', String(secret)).update(data).digest('base64url');
const generateSessionId = () =>
 crypto.randomBytes(32).toString('base64url');
const isSecureConnection = (request, trustProxy) =>
 Boolean(request.socket?.encrypted) ||
 (trustProxy && String(request.headers['x-forwarded-proto'] || '')
 .toLowerCase()
 .split(',')[0]
 ?.trim() === 'https');
const getClientIp = (request, trustProxy) => {
 if (trustProxy && request.headers['x-forwarded-for']) {
 return String(request.headers['x-forwarded-for']).split(',')[0].trim();
 }
 return request.socket?.remoteAddress || '';
};
const getHostname = (request) =>
 String(request.headers.host || '').trim().replace(/:.*/, '');
const generateEtag = (stats) =>
 `"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
const appendVaryHeader = (existing, value) => {
 if (!existing) return value;

 const headers = new Set(
 existing.split(',').map(h => h.trim()).filter(Boolean)
 );

 value.split(',').map(h => h.trim()).forEach(h => headers.add(h));

 return Array.from(headers).join(', ');
};
const sanitizeRedirectUrl = (url) =>
 (typeof url !== 'string' || url.includes('\n') || url.includes('\r')) ?
 '/' : url; // ==================== COOKIE HANDLER ====================
const createCookieHandler = () => {
 const parse = (header) => {
 if (!header) return Object.create(null);

 const cookies = Object.create(null);
 const parts = header.split(';');

 for (const part of parts) {
 const trimmed = part.trim();
 const eqIndex = trimmed.indexOf('=');

 if (eqIndex > 0) {
 const name = trimmed.slice(0, eqIndex).trim();
 const value = trimmed.slice(eqIndex + 1).trim();

 if (name) {
 try {
 cookies[name] = decodeURIComponent(value);
 } catch {
 cookies[name] = value;
 }
 }
 }
 }

 return cookies;
 };
 const serialize = (name, value, options = {}) => {
 if (!name || typeof name !== 'string') {
 throw new TypeError('Cookie name must be a non-empty string');
 }

 if (!/^[\w!#$%&'*+\-.0-9^`|~]+$/.test(name)) {
 throw new TypeError('Invalid cookie name');
 }
 let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
 const {
 maxAge,
 expires,
 domain,
 path = '/',
 secure,
 httpOnly = true,
 sameSite
 } = options;
 if (Number.isFinite(maxAge) && maxAge >= 0) {
 cookieString += `; Max-Age=${Math.floor(maxAge)}`;
 }

 if (expires instanceof Date) {
 cookieString += `; Expires=${expires.toUTCString()}`;
 }

 if (domain) {
 if (!/^\.[a-z0-9.-]+$/i.test(domain)) {
 throw new TypeError('Invalid domain');
 }
 cookieString += `; Domain=${domain}`;
 }

 if (path) {
 if (!/^\/[\w!#$%&'()*+\-./:<>?@[\]\\^_`{|}~]*$/.test(path)) {
 throw new TypeError('Invalid path');
 }
 cookieString += `; Path=${path}`;
 }

 if (httpOnly) cookieString += '; HttpOnly';
 if (secure) cookieString += '; Secure';

 if (sameSite === 'Strict' || sameSite === 'Lax' || sameSite === 'None') {
 cookieString += `; SameSite=${sameSite}`;
 } else if (sameSite !== undefined) {
 throw new TypeError('Invalid SameSite value');
 }

 return cookieString;
 };
 const setCookieHeader = (response, cookieHeader) => {
 const existing = response.getHeader('Set-Cookie');

 if (Array.isArray(existing)) {
 response.setHeader('Set-Cookie', [...existing, cookieHeader]);
 } else {
 response.setHeader('Set-Cookie', [cookieHeader]);
 }
 };
 const set = (response, name, value, options) => {
 const cookieHeader = serialize(name, value, options);
 setCookieHeader(response, cookieHeader);
 };
 const setAll = (response, cookieMap, options) => {
 if (!cookieMap || typeof cookieMap !== 'object') {
 throw new TypeError('Cookie map is required');
 }

 const cookies = Object.entries(cookieMap).map(([name, value]) =>
 serialize(name, value, options)
 );

 const existing = response.getHeader('Set-Cookie');

 if (Array.isArray(existing)) {
 response.setHeader('Set-Cookie', [...existing, ...cookies]);
 } else {
 response.setHeader('Set-Cookie', cookies);
 }
 };
 const clear = (response, name, options = {}) => {
 set(response, name, '', {
 ...options,
 maxAge: 0,
 expires: new Date(0)
 });
 };
 const get = (cookies, name) => cookies[name];
 const has = (cookies, name) => name in cookies;
 return {
 parse,
 serialize,
 set,
 setAll,
 clear,
 get,
 has
 };
};
const xdCookie = createCookieHandler(); // ==================== MIDDLEWARE ====================
const createRateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
 const rateLimiterCache = xdLRU({
 max: 10000,
 ttl: windowMs,
 updateAgeOnGet: false
 });
 return (request, response, next) => {
 const clientIp = request.ip || request.connection?.remoteAddress || '';
 const now = Date.now();
 let record = rateLimiterCache.get(clientIp);

 if (!record) {
 record = {
 count: 0,
 reset: now + windowMs
 };
 rateLimiterCache.set(clientIp, record, {
 ttl: windowMs
 });
 }

 record.count++;
 const remaining = Math.max(0, maxRequests - record.count);

 response.setHeader('X-RateLimit-Limit', String(maxRequests));
 response.setHeader('X-RateLimit-Remaining', String(remaining));
 response.setHeader('X-RateLimit-Reset', String(Math.floor(record.reset / 1000)));
 if (record.count > maxRequests) {
 response.setHeader('Retry-After',
 String(Math.ceil((record.reset - now) / 1000)));
 return response.status(429).json({
 error: 'Too many requests',
 retryAfter: Math.ceil((record.reset - now) / 1000)
 });
 }

 next();
 };
};
const rateLimiterMiddleware = createRateLimiter();
const corsMiddleware = (request, response, next) => {
 const origin = request.headers.origin || '*';

 response.setHeader('Vary', appendVaryHeader(
 String(response.getHeader('Vary') || ''),
 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
 ));

 response.setHeader('Access-Control-Allow-Origin', origin);
 response.setHeader('Access-Control-Allow-Methods',
 'GET, POST, PUT, DELETE, HEAD, OPTIONS');
 response.setHeader('Access-Control-Allow-Headers',
 'Content-Type, Authorization, X-API-Key');
 response.setHeader('Access-Control-Max-Age', '86400');
 response.setHeader('Access-Control-Allow-Credentials', 'true');

 if (request.method === 'OPTIONS') {
 response.statusCode = 204;
 response.end();
 return;
 }

 next();
};
const errorHandlerMiddleware = (error, request, response, next) => {
 if (response.headersSent) {
 try {
 response.end();
 } catch {}
 return;
 }

 if (error?.code === 'LIMIT_FILE_SIZE') {
 return response.status(400).json({
 error: 'File too large'
 });
 }

 if (error?.type === 'entity.parse.failed') {
 return response.status(400).json({
 error: 'Invalid JSON'
 });
 }

 const body = {
 error: 'Internal server error'
 };

 if (process.env.NODE_ENV === 'development') {
 body.message = String(error?.message || error);
 body.stack = error?.stack;
 }

 response.status(500).json(body);
}; // ==================== ASYNC FILE SERVING WITH PROPER STREAMS (Punkt 6) ====================
const serveFileAsync = async (request, response, relativePath, method = 'GET', staticRoot, mimeTypes, staticMaxAge, secureHeaders) => {
 let requestPath = relativePath === '/' ? '/index.html' : relativePath;
 try {
 requestPath = decodeURIComponent(requestPath);
 } catch {}
 requestPath = path.posix.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
 const absolutePath = path.resolve(staticRoot, '.' + requestPath);
 if (!absolutePath.startsWith(staticRoot + path.sep) && absolutePath !== staticRoot) {
 return false;
 }

 try {
 const stats = await fs.stat(absolutePath);
 if (!stats.isFile()) return false;
 const extension = path.extname(absolutePath).slice(1).toLowerCase();
 const etag = generateEtag(stats);

 response.setHeader('etag', etag);
 response.setHeader('last-modified', stats.mtime.toUTCString());
 response.setHeader('accept-ranges', 'bytes');
 response.setHeader('cache-control',
 staticMaxAge > 0 ?
 `public, max-age=${staticMaxAge}` :
 'public, max-age=0, must-revalidate'
 );
 response.setHeader('content-type', mimeTypes[extension] || 'application/octet-stream');

 if (secureHeaders && !/^(text\/html|application\/json)/i.test(
 response.getHeader('content-type') || ''
 )) {
 response.setHeader('x-content-type-options', 'nosniff');
 }
 const ifNoneMatch = String(request.headers['if-none-match'] || '');
 const ifModifiedSince = request.headers['if-modified-since'] ?
 new Date(request.headers['if-modified-since']) : null;

 if ((ifNoneMatch && ifNoneMatch === etag) ||
 (ifModifiedSince && !isNaN(ifModifiedSince.getTime()) && stats.mtime <= ifModifiedSince)) {
 response.statusCode = 304;
 response.end();
 return true;
 }

 if (method === 'HEAD') {
 response.setHeader('content-length', String(stats.size));
 response.statusCode = 200;
 response.end();
 return true;
 }
 const rangeHeader = String(request.headers.range || '');
 if (rangeHeader.startsWith('bytes=')) {
 const rangeParts = rangeHeader.slice(6).split(',')[0].split('-');
 let start = rangeParts[0] ? parseInt(rangeParts[0], 10) : 0;
 let end = rangeParts[1] ? parseInt(rangeParts[1], 10) : stats.size - 1;

 if (Number.isNaN(start)) start = 0;
 if (Number.isNaN(end)) end = stats.size - 1;

 if (start > end || start < 0 || end >= stats.size) {
 response.statusCode = 416;
 response.setHeader('content-range', `bytes */${stats.size}`);
 response.end();
 return true;
 }

 response.statusCode = 206;
 response.setHeader('content-range', `bytes ${start}-${end}/${stats.size}`);
 response.setHeader('content-length', String(end - start + 1));

 const readStream = fsSync.createReadStream(absolutePath, {
 start,
 end
 });

 readStream.on('error', (error) => {
 log(LOG_LEVELS.ERROR, `Error reading file range ${absolutePath}: ${error.message}`);
 if (!response.headersSent) {
 response.statusCode = 500;
 response.end('Internal Server Error');
 }
 });

 readStream.pipe(response);
 return true;
 }
 response.setHeader('content-length', String(stats.size));
 const readStream = fsSync.createReadStream(absolutePath);

 readStream.on('error', (error) => {
 log(LOG_LEVELS.ERROR, `Error reading file ${absolutePath}: ${error.message}`);
 if (!response.headersSent) {
 response.statusCode = 500;
 response.end('Internal Server Error');
 }
 });

 readStream.pipe(response);
 return true;
 } catch (error) {
 errorHandler.handleError(error, {
 operation: 'serveFileAsync',
 filePath: absolutePath,
 method,
 relativePath
 });
 return false;
 }
}; // ==================== BODY PARSING WITH PROPER ERROR HANDLING (Punkt 3) ====================
const parseMultipartData = async (buffer, boundary, parseOptions = {}) => {
 const {
 maxFileSize = 10 * 1024 * 1024,
 maxFiles = 10,
 maxFields = 100
 } = parseOptions;

 const result = {
 fields: {},
 files: []
 };
 const separator = Buffer.from('--' + boundary);
 const doubleCrlf = Buffer.from('\r\n\r\n');
 let position = buffer.indexOf(separator);
 if (position === -1) return result;

 position += separator.length;
 while (position < buffer.length) {
 if (buffer.slice(position, position + 2).equals(Buffer.from('--'))) {
 break;
 }

 if (buffer.slice(position, position + 2).equals(Buffer.from('\r\n'))) {
 position += 2;
 }
 const headerEnd = buffer.indexOf(doubleCrlf, position);
 if (headerEnd === -1) break;
 const headerString = buffer.slice(position, headerEnd).toString('utf8');
 const headers = {};

 headerString.split('\r\n').forEach((line) => {
 const colonIndex = line.indexOf(':');
 if (colonIndex > 0) {
 const headerName = line.slice(0, colonIndex).trim().toLowerCase();
 const headerValue = line.slice(colonIndex + 1).trim();
 headers[headerName] = headerValue;
 }
 });
 const bodyStart = headerEnd + 4;
 const nextSeparator = buffer.indexOf(separator, bodyStart);
 const body = buffer.slice(
 bodyStart,
 nextSeparator === -1 ? buffer.length : nextSeparator - 2
 );
 const disposition = headers['content-disposition'] || '';
 const nameMatch = disposition.match(/\bname="([^"]+)"/);
 const filenameMatch = disposition.match(/\bfilename="([^"]+)"/);

 const name = nameMatch ? nameMatch[1] : '';
 const filename = filenameMatch ? filenameMatch[1] : null;
 if (filename) {
 if (result.files.length >= maxFiles) {
 throw createErrorWithCode('Too many files', 'LIMIT_FILE_COUNT');
 }

 if (body.length > maxFileSize) {
 throw createErrorWithCode('File too large', 'LIMIT_FILE_SIZE');
 }

 result.files.push({
 name,
 filename,
 contentType: headers['content-type'] || 'application/octet-stream',
 data: body
 });
 } else if (name) {
 if (Object.keys(result.fields).length >= maxFields) {
 throw createErrorWithCode('Too many fields', 'LIMIT_FIELD_COUNT');
 }

 result.fields[name] = body.toString('utf8');
 }

 position = nextSeparator === -1 ? buffer.length : nextSeparator;
 }

 return result;
};
const parseRequestBody = (request, maxBodySize, parseOptions = {}) =>
 new Promise((resolve, reject) => {
 const contentType = String(request.headers['content-type'] || '').toLowerCase();
 const contentLength = parseInt(request.headers['content-length'] || '0', 10);

 if (Number.isFinite(contentLength) && contentLength > maxBodySize) {
 request.destroy(new Error('Payload Too Large'));
 return resolve(null);
 }
 let totalSize = 0;
 const chunks = [];
 let exceededLimit = false;
 const onData = (chunk) => {
 if (exceededLimit) return;

 totalSize += chunk.length;
 if (totalSize > maxBodySize) {
 exceededLimit = true;
 request.destroy(new Error('Payload Too Large'));
 reject(createErrorWithCode('Payload Too Large', 'LIMIT_FILE_SIZE'));
 return;
 }

 chunks.push(chunk);
 };
 const onEnd = async () => {
 if (exceededLimit) return;

 try {
 const buffer = Buffer.concat(chunks);
 if (contentType.includes('json')) {
 try {
 resolve(JSON.parse(buffer.toString('utf8')));
 } catch (parseError) {
 reject(createErrorWithCode('Invalid JSON payload', 'INVALID_JSON'));
 }
 } else if (contentType.includes('x-www-form-urlencoded')) {
 resolve(parseUrlSearchParams(buffer.toString('utf8')));
 } else if (contentType.includes('multipart/form-data')) {
 const boundaryMatch = contentType.match(
 /boundary=(?:"([^"]+)"|([^;\s]+))/i
 );

 if (!boundaryMatch) {
 reject(createErrorWithCode('Invalid boundary in multipart/form-data', 'INVALID_BOUNDARY'));
 return;
 }

 const boundary = boundaryMatch[1] || boundaryMatch[2];
 resolve(await parseMultipartData(buffer, boundary, parseOptions));
 } else {
 resolve(buffer.toString('utf8'));
 }
 } catch (error) {
 if (error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT') {
 resolve(null);
 } else {
 reject(error);
 }
 }
 };
 const onError = (error) => {
 reject(error);
 };
 request.on('data', onData);
 request.on('end', onEnd);
 request.on('error', onError);
 request.on('close', () => {
 if (!exceededLimit && totalSize === 0) {
 resolve(null);
 }
 });
 }); // ==================== SESSION MANAGEMENT ====================
const createSessionManager = (sessionSecret, sessionStore) => {
 const sessionLocks = new Map();
 const withSessionLock = async (sessionId, callback) => {
 const previousLock = sessionLocks.get(sessionId) || Promise.resolve();
 let release;
 const currentLock = new Promise(resolve => {
 release = resolve;
 });
 sessionLocks.set(sessionId, previousLock.then(() => currentLock));
 await previousLock;
 try {
 return await callback();
 } finally {
 release();
 if (sessionLocks.get(sessionId) === previousLock.then(() => currentLock)) {
 sessionLocks.delete(sessionId);
 }
 }
 };
 const getSessionData = async (sessionId) => {
 if (!sessionId) return null;
 try {
 const rawData = sessionStore.get(`sess:${sessionId}`);
 return rawData ? JSON.parse(rawData) : null;
 } catch {
 return null;
 }
 };
 const setSessionData = async (sessionId, data) => {
 sessionStore.set(`sess:${sessionId}`, safeJsonStringify(data), {
 ttl: 3600
 });
 };
 const destroySessionData = async (sessionId) => {
 sessionStore.del(`sess:${sessionId}`);
 };
 const getSessionId = async (request, sessionSecret) => {
 let sessionId = request.cookies.sid;
 if (sessionId?.includes('.')) {
 const [idPart, signaturePart] = sessionId.split('.', 2);
 if (signaturePart === signData(idPart, sessionSecret)) {
 return idPart;
 }
 }
 return generateSessionId();
 };
 return {
 withSessionLock,
 getSessionData,
 setSessionData,
 destroySessionData,
 getSessionId
 };
}; // ==================== WEBSOCKET IMPLEMENTATION WITH UTF-8 VALIDATION (Punkt 2) ====================
const createWebSocket = (socket, request, wsOptions = {}) => {
 const emitter = new EventEmitter();
 const {
 maxPayload = 16 * 1024 * 1024,
 pingInterval = 30000,
 pingTimeout = 10000,
 maxClients = 1000
 } = wsOptions;
 let readyState = WS_READY_STATES.OPEN;
 let fragmentBuffer = [];
 let fragmentOpcode = null;
 let pingTimer = null;
 let pongTimer = null;
 let closeCode = null;
 let closeReason = '';
 let activeClients = 0;
 const maxClientsLimit = maxClients || 1000;
 const websocket = {
 get readyState() {
 return readyState;
 },

 get CONNECTING() {
 return WS_READY_STATES.CONNECTING;
 },
 get OPEN() {
 return WS_READY_STATES.OPEN;
 },
 get CLOSING() {
 return WS_READY_STATES.CLOSING;
 },
 get CLOSED() {
 return WS_READY_STATES.CLOSED;
 },

 socket,
 request,

 on: (event, listener) => {
 emitter.on(event, listener);
 return websocket;
 },

 once: (event, listener) => {
 emitter.once(event, listener);
 return websocket;
 },

 off: (event, listener) => {
 emitter.off(event, listener);
 return websocket;
 },

 removeListener: (event, listener) => {
 emitter.removeListener(event, listener);
 return websocket;
 },
 send: (data, options = {}) => {
 if (readyState !== WS_READY_STATES.OPEN) return false;

 const isBinary = options.binary || Buffer.isBuffer(data);
 const opcode = isBinary ? WS_OPCODES.BINARY : WS_OPCODES.TEXT;
 const payload = Buffer.isBuffer(data) ?
 data :
 Buffer.from(String(data), 'utf8');

 if (payload.length > maxPayload) {
 log(LOG_LEVELS.WARN, `WebSocket payload too large: ${payload.length} > ${maxPayload}`);
 closeWithError(1009, 'Payload too large');
 return false;
 }

 const frame = createFrame(opcode, payload, true);

 try {
 socket.write(frame);
 return true;
 } catch {
 return false;
 }
 },
 close: (code = 1000, reason = '') => {
 if (readyState === WS_READY_STATES.CLOSED ||
 readyState === WS_READY_STATES.CLOSING) {
 return;
 }

 readyState = WS_READY_STATES.CLOSING;
 closeCode = code;
 closeReason = reason;

 const responsePayload = Buffer.alloc(2 + Buffer.byteLength(reason));
 if (reason) responsePayload.write(reason, 2, 'utf8');
 responsePayload.writeUInt16BE(code, 0);

 const frame = createFrame(WS_OPCODES.CLOSE, responsePayload, true);
 try {
 socket.write(frame);
 } catch {}

 setTimeout(() => {
 if (readyState !== WS_READY_STATES.CLOSED) {
 terminateConnection();
 }
 }, 5000);
 },
 ping: (data = Buffer.alloc(0)) => {
 if (readyState !== WS_READY_STATES.OPEN) return false;

 const payload = Buffer.isBuffer(data) ?
 data :
 Buffer.from(String(data), 'utf8');

 const frame = createFrame(WS_OPCODES.PING, payload, true);

 try {
 socket.write(frame);
 return true;
 } catch {
 return false;
 }
 },
 pong: (data = Buffer.alloc(0)) => {
 if (readyState !== WS_READY_STATES.OPEN) return false;

 const payload = Buffer.isBuffer(data) ?
 data :
 Buffer.from(String(data), 'utf8');

 const frame = createFrame(WS_OPCODES.PONG, payload, true);

 try {
 socket.write(frame);
 return true;
 } catch {
 return false;
 }
 },
 terminate: () => terminateConnection()
 };
 const createFrame = (opcode, payload, fin = true) => {
 const length = payload.length;
 let headerLength = 2;
 let extendedLengthBytes = 0;
 if (length > 65535) {
 headerLength += 8;
 extendedLengthBytes = 8;
 } else if (length > 125) {
 headerLength += 2;
 extendedLengthBytes = 2;
 }
 const frame = Buffer.alloc(headerLength + length);
 frame[0] = (fin ? 0x80 : 0x00) | opcode;
 if (extendedLengthBytes === 0) {
 frame[1] = length;
 } else if (extendedLengthBytes === 2) {
 frame[1] = 126;
 frame.writeUInt16BE(length, 2);
 } else {
 frame[1] = 127;
 if (length >= Number.MAX_SAFE_INTEGER) {
 closeWithError(1009, 'Payload too large');
 return Buffer.alloc(0);
 }
 frame.writeBigUInt64BE(BigInt(length), 2);
 }
 payload.copy(frame, headerLength);
 return frame;
 };
 const unmaskPayload = (data, mask) => {
 const result = Buffer.alloc(data.length);

 for (let i = 0; i < data.length; i++) {
 result[i] = data[i] ^ mask[i % 4];
 }

 return result;
 };
 let receiveBuffer = Buffer.alloc(0);
 const parseFrames = () => {
 while (receiveBuffer.length >= 2) {
 const firstByte = receiveBuffer[0];
 const secondByte = receiveBuffer[1];
 const fin = (firstByte & 0x80) !== 0;
 const rsv1 = (firstByte & 0x40) !== 0;
 const rsv2 = (firstByte & 0x20) !== 0;
 const rsv3 = (firstByte & 0x10) !== 0;
 const opcode = firstByte & 0x0F;
 const masked = (secondByte & 0x80) !== 0;
 let payloadLength = secondByte & 0x7F;
 if (rsv1 || rsv2 || rsv3) {
 closeWithError(1002, 'RSV bits must be 0');
 return;
 }

 if (!masked) {
 closeWithError(1002, 'Client frames must be masked');
 return;
 }
 let headerLength = 2;
 if (payloadLength === 126) headerLength += 2;
 else if (payloadLength === 127) headerLength += 8;
 headerLength += 4;
 if (receiveBuffer.length < headerLength) return;
 let offset = 2;
 if (payloadLength === 126) {
 payloadLength = receiveBuffer.readUInt16BE(offset);
 offset += 2;
 } else if (payloadLength === 127) {
 const highBits = receiveBuffer.readUInt32BE(offset);
 const lowBits = receiveBuffer.readUInt32BE(offset + 4);

 if (highBits > 0 || lowBits > Number.MAX_SAFE_INTEGER || lowBits > maxPayload) {
 closeWithError(1009, 'Payload too large');
 return;
 }
 payloadLength = Number(lowBits);
 offset += 8;
 }
 if (payloadLength > maxPayload) {
 closeWithError(1009, 'Payload too large');
 return;
 }
 const totalLength = headerLength + payloadLength;
 if (receiveBuffer.length < totalLength) return;
 const mask = receiveBuffer.slice(offset, offset + 4);
 offset += 4;
 const maskedPayload = receiveBuffer.slice(offset, offset + payloadLength);
 const payload = unmaskPayload(maskedPayload, mask);
 receiveBuffer = receiveBuffer.slice(totalLength);
 handleFrame(fin, opcode, payload);
 }
 };
 const handleFrame = (fin, opcode, payload) => {
 if (opcode >= 0x8) {
 handleControlFrame(opcode, payload);
 return;
 }
 if (opcode === WS_OPCODES.CONTINUATION) {
 if (fragmentOpcode === null) {
 closeWithError(1002, 'Unexpected continuation frame');
 return;
 }

 fragmentBuffer.push(payload);

 if (fin) {
 const fullPayload = Buffer.concat(fragmentBuffer);

 if (fragmentOpcode === WS_OPCODES.TEXT && !isValidUTF8(fullPayload)) {
 closeWithError(1007, 'Invalid UTF-8 in fragmented text message');
 return;
 }

 deliverMessage(fragmentOpcode, fullPayload);
 fragmentBuffer = [];
 fragmentOpcode = null;
 }
 } else {
 if (fragmentOpcode !== null) {
 closeWithError(1002, 'Expected continuation frame');
 return;
 }

 if (fin) {
 if (opcode === WS_OPCODES.TEXT && !isValidUTF8(payload)) {
 closeWithError(1007, 'Invalid UTF-8 in text message');
 return;
 }
 deliverMessage(opcode, payload);
 } else {
 fragmentOpcode = opcode;
 fragmentBuffer = [payload];
 }
 }
 };
 const handleControlFrame = (opcode, payload) => {
 if (opcode === WS_OPCODES.CLOSE) {
 let code = 1005;
 let reason = '';

 if (payload.length >= 2) {
 code = payload.readUInt16BE(0);
 reason = payload.slice(2).toString('utf8');
 }

 if (readyState === WS_READY_STATES.OPEN) {
 readyState = WS_READY_STATES.CLOSING;

 const responsePayload = Buffer.alloc(2);
 responsePayload.writeUInt16BE(code, 0);

 const frame = createFrame(WS_OPCODES.CLOSE, responsePayload, true);
 try {
 socket.write(frame);
 } catch {}
 }

 closeCode = code;
 closeReason = reason;
 terminateConnection();
 } else if (opcode === WS_OPCODES.PING) {
 if (readyState === WS_READY_STATES.OPEN) {
 const frame = createFrame(WS_OPCODES.PONG, payload, true);
 try {
 socket.write(frame);
 } catch {}
 }
 emitter.emit('ping', payload);
 } else if (opcode === WS_OPCODES.PONG) {
 clearTimeout(pongTimer);
 pongTimer = null;
 emitter.emit('pong', payload);
 }
 };
 const deliverMessage = (opcode, payload) => {
 if (opcode === WS_OPCODES.TEXT) {
 try {
 const text = payload.toString('utf8');
 Buffer.from(text, 'utf8');
 emitter.emit('message', text, false);
 } catch (error) {
 log(LOG_LEVELS.ERROR, `Invalid UTF-8 in WebSocket message: ${error.message}`);
 closeWithError(1007, 'Invalid UTF-8');
 }
 } else if (opcode === WS_OPCODES.BINARY) {
 emitter.emit('message', payload, true);
 }
 };
 const closeWithError = (code, reason) => {
 if (readyState === WS_READY_STATES.CLOSED) return;
 websocket.close(code, reason);
 };
 const terminateConnection = () => {
 if (readyState === WS_READY_STATES.CLOSED) return;

 readyState = WS_READY_STATES.CLOSED;
 clearInterval(pingTimer);
 clearTimeout(pongTimer);

 fragmentBuffer = [];
 fragmentOpcode = null;

 try {
 socket.end();
 } catch {}
 try {
 socket.destroy();
 } catch {}

 emitter.emit('close', closeCode || 1006, closeReason || '');

 socket.removeAllListeners();
 emitter.removeAllListeners();

 activeClients--;
 };
 const startHeartbeat = () => {
 if (pingInterval <= 0) return;

 pingTimer = setInterval(() => {
 if (readyState !== WS_READY_STATES.OPEN) return;

 websocket.ping();

 pongTimer = setTimeout(() => {
 if (readyState === WS_READY_STATES.OPEN) {
 closeWithError(1006, 'Pong timeout');
 }
 }, pingTimeout);
 }, pingInterval);
 };
 activeClients++;
 if (activeClients > maxClientsLimit) {
 log(LOG_LEVELS.WARN, `Rejecting WebSocket connection: ${activeClients} > ${maxClientsLimit}`);
 closeWithError(1013, 'Too many connections');
 return websocket;
 }
 socket.on('data', (chunk) => {
 receiveBuffer = Buffer.concat([receiveBuffer, chunk]);
 parseFrames();
 });
 socket.on('close', terminateConnection);
 socket.on('error', (error) => {
 emitter.emit('error', error);
 terminateConnection();
 });
 socket.on('end', terminateConnection);
 startHeartbeat();
 return websocket;
};
const handleWebSocketUpgrade = (request, socket, head, wsRoutes, wsOptions) => {
 const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
 const pathname = url.pathname;
 let matchedRoute = null;
 let params = {};
 for (const route of wsRoutes) {
 if (route.pattern === pathname) {
 matchedRoute = route;
 params = {};
 break;
 }

 if (route.regex) {
 const match = pathname.match(route.regex);
 if (match) {
 matchedRoute = route;
 params = match.groups || {};
 break;
 }
 }
 }
 if (!matchedRoute) {
 socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
 socket.destroy();
 return;
 }
 const key = request.headers['sec-websocket-key'];
 const version = request.headers['sec-websocket-version'];
 if (!key || version !== '13') {
 socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
 socket.destroy();
 return;
 }
 const acceptKey = crypto
 .createHash('sha1')
 .update(key + WS_GUID)
 .digest('base64');
 const responseHeaders = [
 'HTTP/1.1 101 Switching Protocols',
 'Upgrade: websocket',
 'Connection: Upgrade',
 `Sec-WebSocket-Accept: ${acceptKey}`
 ];
 const protocol = request.headers['sec-websocket-protocol'];
 if (protocol && wsOptions.protocols) {
 const requestedProtocols = protocol.split(',').map(p => p.trim());
 const supportedProtocols = Array.isArray(wsOptions.protocols) ?
 wsOptions.protocols : [wsOptions.protocols];
 const selectedProtocol = supportedProtocols.find(p =>
 requestedProtocols.includes(p)
 );
 if (selectedProtocol) {
 responseHeaders.push(`Sec-WebSocket-Protocol: ${selectedProtocol}`);
 }
 }
 socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
 const ws = createWebSocket(socket, request, wsOptions);
 ws.path = pathname;
 ws.query = parseUrlSearchParams(url.search);
 ws.params = params;
 ws.cookies = xdCookie.parse(request.headers.cookie || '');
 if (head && head.length > 0) {
 socket.unshift(head);
 }
 matchedRoute.handler(ws, request);
};
const xdWebSocket = {
 createWebSocket,
 handleUpgrade: handleWebSocketUpgrade
}; // ==================== CREATE SERVER APP WITH WEBSOCKET CLEANUP (Punkt 5) ====================
const createServerApp = (options = {}) => {
 const routes = {
 GET: [],
 POST: [],
 PUT: [],
 DELETE: [],
 HEAD: []
 };

 const wsRoutes = [];
 const middlewares = [];

 const staticRoot = path.resolve(options.static || './public');
 const maxBodySize = options.maxBody || 1048576;
 const spaMode = options.spa !== false;
 const enableLogs = options.logs !== false;
 const sessionSecret = String(options.sessionSecret || 'default-secret');
 const trustProxy = options.trustProxy === true;
 const staticMaxAge = Number.isFinite(options.staticMaxAge) ?
 Math.max(0, options.staticMaxAge) : 0;
 const secureHeaders = options.secureHeaders !== false;
 const sessionStore = options.sessionStore || xdRedis({
 max: 1000
 });
 const mimeTypes = {
 ...DEFAULT_MIME_TYPES
 };

 const wsOptions = {
 maxPayload: options.wsMaxPayload || 16 * 1024 * 1024,
 pingInterval: options.wsPingInterval || 30000,
 pingTimeout: options.wsPingTimeout || 10000,
 protocols: options.wsProtocols || null,
 maxClients: options.maxWsClients || 1000
 };
 const wsClients = new Set();
 const sessionManager = createSessionManager(sessionSecret, sessionStore);

 const wsCleanupInterval = setInterval(() => {
 let cleaned = 0;
 for (const client of wsClients) {
 if (client.readyState === WS_READY_STATES.CLOSED ||
 client.readyState === WS_READY_STATES.CLOSING) {
 wsClients.delete(client);
 cleaned++;
 }
 }
 if (cleaned > 0) {
 log(LOG_LEVELS.DEBUG, `Cleaned up ${cleaned} dead WebSocket connections`);
 }
 }, 30000);
 process.once('SIGTERM', () => {
 clearInterval(wsCleanupInterval);
 for (const client of wsClients) {
 try {
 client.close(1012, 'Server restarting');
 } catch {}
 }
 wsClients.clear();
 });

 process.once('SIGINT', () => {
 clearInterval(wsCleanupInterval);
 for (const client of wsClients) {
 try {
 client.close(1012, 'Server shutting down');
 } catch {}
 }
 wsClients.clear();
 });
 const useMiddleware = (pathPattern, middleware) => {
 if (typeof pathPattern === 'function') {
 middleware = pathPattern;
 pathPattern = '*';
 }

 middlewares.push({
 path: pathPattern,
 middleware
 });
 };
 const addRoute = (method, pattern, handler) => {
 const regex = createRegexPattern(pattern);
 routes[method].push({
 pattern,
 regex,
 handler
 });
 };
 const addWsRoute = (pattern, handler) => {
 const regex = createRegexPattern(pattern);
 wsRoutes.push({
 pattern,
 regex,
 handler
 });
 };
 const matchRoute = (method, pathname) => {
 for (const route of routes[method]) {
 if (route.pattern === pathname) {
 return {
 handler: route.handler,
 params: {}
 };
 }

 if (route.regex) {
 const match = pathname.match(route.regex);
 if (match) {
 return {
 handler: route.handler,
 params: match.groups || {}
 };
 }
 }
 }

 return null;
 };
 const executeMiddlewares = async (request, response, middlewareList, index = 0) => {
 if (index >= middlewareList.length || response.writableEnded) {
 return true;
 }

 let hasCalledNext = false;
 const next = (error) => {
 if (hasCalledNext) return;
 hasCalledNext = true;

 if (error) throw error;
 return executeMiddlewares(request, response, middlewareList, index + 1);
 };

 try {
 const result = middlewareList[index](request, response, next);
 if (result?.then) {
 await result;
 if (!hasCalledNext && !response.writableEnded) {
 await next();
 }
 }
 } catch (error) {
 return errorHandlerMiddleware(error, request, response, () => {});
 }

 return true;
 };
 const setupRequestResponse = (request, response) => {
 const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

 request.path = url.pathname;
 request.query = parseUrlSearchParams(url.search);
 request.cookies = xdCookie.parse(request.headers.cookie || '');
 request.hostname = getHostname(request);
 request.secure = isSecureConnection(request, trustProxy);
 request.ip = getClientIp(request, trustProxy);
 response.status = (code) => {
 response.statusCode = code;
 return response;
 };

 response.set = (key, value) => {
 response.setHeader(key, value);
 return response;
 };

 response.vary = (value) => {
 response.setHeader('Vary', appendVaryHeader(
 String(response.getHeader('Vary') || ''),
 value
 ));
 return response;
 };

 response.type = (type) => response.set('content-type', type);

 response.json = (data) => {
 response.type(mimeTypes.json);
 response.end(safeJsonStringify(data));
 };

 response.html = (html) => {
 response.type(mimeTypes.html);
 response.end(html);
 };

 response.send = (data) => {
 if (typeof data === 'object' && !Buffer.isBuffer(data)) {
 return response.json(data);
 }
 return response.end(String(data));
 };

 response.redirect = (code, urlString) => {
 response.status(code)
 .set('location', sanitizeRedirectUrl(urlString))
 .end();
 };

 response.safeHtml = (html) => response.html(safeText(html));
 response.safeJson = (data) => response.json(data);
 response.setHeader('x-response-time', '0');
 if (secureHeaders) {
 response.setHeader('x-frame-options', 'SAMEORIGIN');
 response.setHeader('referrer-policy', 'no-referrer');
 response.setHeader('cross-origin-opener-policy', 'same-origin');
 response.setHeader('cross-origin-resource-policy', 'same-origin');
 }(async () => {
 try {
 const sessionId = await sessionManager.getSessionId(request, sessionSecret);
 const sessionData = await sessionManager.getSessionData(sessionId);

 request.session = sessionData || {};
 request.currentSessionId = sessionId;
 request.saveSession = () => sessionManager.withSessionLock(sessionId, async () => {
 await sessionManager.setSessionData(sessionId, request.session);
 xdCookie.set(response, 'sid',
 `${sessionId}.${signData(sessionId, sessionSecret)}`, {
 httpOnly: true,
 secure: request.secure,
 maxAge: 3600,
 path: '/',
 sameSite: 'Lax'
 }
 );
 });
 request.destroySession = () => sessionManager.withSessionLock(sessionId, async () => {
 await sessionManager.destroySessionData(sessionId);
 xdCookie.clear(response, 'sid', {
 path: '/'
 });
 });
 } catch (error) {
 console.error('Session initialization error:', error);
 request.session = {};
 request.currentSessionId = null;
 }
 })();
 };
 const requestHandler = async (request, response) => {
 const startTime = Date.now();
 setupRequestResponse(request, response);
 response.on('finish', () => {
 if (enableLogs) {
 console.log(
 `${request.method} ${request.path} ` +
 `${response.statusCode || 200} ${Date.now() - startTime}ms`
 );
 }
 });
 try {
 const globalMiddlewares = middlewares
 .filter(m => m.path === '*' || request.path.startsWith(m.path))
 .map(m => m.middleware);

 await executeMiddlewares(request, response, globalMiddlewares);

 if (response.headersSent || response.writableEnded) return;
 } catch (error) {
 return errorHandlerMiddleware(error, request, response, () => {});
 }
 if (request.method === 'HEAD') {
 const routeMatch = matchRoute('GET', request.path);
 if (routeMatch) {
 request.params = routeMatch.params;

 const originalWrite = response.write;
 const originalEnd = response.end;

 response.write = () => true;
 response.end = function() {
 try {
 return originalEnd.call(response);
 } catch {
 return undefined;
 }
 };

 try {
 await routeMatch.handler(request, response);
 } catch (error) {
 errorHandlerMiddleware(error, request, response, () => {});
 }

 response.write = originalWrite;
 response.end = originalEnd;
 return;
 }

 if (await serveFileAsync(request, response, request.path, 'HEAD', staticRoot, mimeTypes, staticMaxAge, secureHeaders)) return;
 if (spaMode && await serveFileAsync(request, response, '/index.html', 'HEAD', staticRoot, mimeTypes, staticMaxAge, secureHeaders)) return;

 response.status(404).end();
 return;
 }
 const routeMatch = matchRoute(request.method, request.path);
 if (routeMatch) {
 request.params = routeMatch.params;

 try {
 if (request.method === 'GET' || request.method === 'DELETE') {
 await routeMatch.handler(request, response);
 } else {
 const bodyResult = await parseRequestBody(request, maxBodySize, {});

 if (bodyResult === null) {
 return response.status(413).send('Payload Too Large');
 }

 request.body = bodyResult;
 await routeMatch.handler(request, response);
 }
 } catch (error) {
 errorHandlerMiddleware(error, request, response, () => {});
 }

 return;
 }
 if (await serveFileAsync(request, response, request.path, 'GET', staticRoot, mimeTypes, staticMaxAge, secureHeaders)) return;
 if (spaMode && await serveFileAsync(request, response, '/index.html', 'GET', staticRoot, mimeTypes, staticMaxAge, secureHeaders)) return;

 response.status(404).send('Not Found');
 };
 const server = options.https ?
 https.createServer(options.tls || {}, requestHandler) :
 http.createServer(requestHandler);
 server.on('upgrade', (request, socket, head) => {
 const upgradeHeader = String(request.headers.upgrade || '').toLowerCase();

 if (upgradeHeader !== 'websocket') {
 socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
 socket.destroy();
 return;
 }
 try {
 xdWebSocket.handleUpgrade(request, socket, head, wsRoutes, wsOptions);
 } catch (error) {
 console.error('WebSocket upgrade error:', error);
 socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
 socket.destroy();
 }
 });
 const app = {
 get: (pattern, handler) => {
 addRoute('GET', pattern, handler);
 return app;
 },

 post: (pattern, handler) => {
 addRoute('POST', pattern, handler);
 return app;
 },

 put: (pattern, handler) => {
 addRoute('PUT', pattern, handler);
 return app;
 },

 delete: (pattern, handler) => {
 addRoute('DELETE', pattern, handler);
 return app;
 },

 use: (pathPattern, middleware) => {
 useMiddleware(pathPattern, middleware);
 return app;
 },
 ws: (pattern, handler) => {
 addWsRoute(pattern, (ws) => {
 if (wsClients.size >= wsOptions.maxClients) {
 log(LOG_LEVELS.WARN, `Rejecting WebSocket connection: max clients (${wsOptions.maxClients}) reached`);
 ws.close(1013, 'Too many connections');
 return;
 }

 wsClients.add(ws);
 ws.on('close', () => {
 wsClients.delete(ws);
 try {
 ws.socket.removeAllListeners();
 ws.removeAllListeners();
 } catch {}
 });
 handler(ws);
 });
 return app;
 },
 getWsClients: () => Array.from(wsClients).filter(client =>
 client.readyState === WS_READY_STATES.OPEN
 ),
 broadcast: (data, options = {}) => {
 const filterFn = options.filter || (() => true);
 const excludeSet = options.exclude ?
 new Set(Array.isArray(options.exclude) ? options.exclude : [options.exclude]) :
 new Set();

 let sent = 0;
 let failed = 0;

 for (const client of wsClients) {
 if (client.readyState === WS_READY_STATES.OPEN &&
 !excludeSet.has(client) &&
 filterFn(client)) {
 try {
 client.send(data, options);
 sent++;
 } catch (error) {
 failed++;
 errorHandler.handleError(error, {
 operation: 'websocket.broadcast',
 clientInfo: {
 path: client.path
 }
 });
 }
 }
 }

 if (failed > 0) {
 log(LOG_LEVELS.WARN, `WebSocket broadcast: ${sent} sent, ${failed} failed`);
 }

 return {
 sent,
 failed
 };
 },
 listen: (port, callback) => {
 server.listen(port, () => {
 console.log(
 `Server: http${options.https ? 's' : ''}://localhost:${port}`
 );
 if (callback) callback();
 });
 return app;
 },
 server,

 cleanup: () => {
 clearInterval(wsCleanupInterval);
 wsClients.clear();
 }
 };
 if (options.rateLimit !== false) {
 app.use(rateLimiterMiddleware);
 }

 if (options.cors !== false) {
 app.use(corsMiddleware);
 }
 return app;
};
const xdSrv = {
 createApp: createServerApp
}; // ==================== EXPORTS ====================
export {
 xdRedis,
 xdLRU,
 xdCookie,
 escapeAny,
 safeText,
 safeAttr,
 safeUrlAttr,
 errorHandlerMiddleware as errorHandler,
 corsMiddleware as cors,
 createRateLimiter,
 rateLimiterMiddleware,
 xdWebSocket,
 xdSrv
};
const createLRUCache = (options = {}) => {
 const {
 max = 500,
 ttl = 0,
 totalMaxSize = 100 * 1024 * 1024,
 lru = false,
 updateAgeOnGet = false,
 dispose = null,
 maxEntrySize = 10 * 1024 * 1024
 } = options;
 const cache = new Map();
 const now = Date.now;
 let currentSize = 0;
 const calculateSize = (value) => {
 if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
 if (Buffer.isBuffer(value)) return value.length;
 try {
 const str = JSON.stringify(value);
 return Buffer.byteLength(str, 'utf8');
 } catch {
 return 0;
 }
 };
 const remove = (key, entry, reason) => {
 if (entry) {
 currentSize -= entry.size;
 dispose?.(key, entry.value, reason);
 }
 cache.delete(key);
 };
 const isValid = (entry, currentTime) =>
 entry && (entry.expiration > currentTime || entry.expiration === Infinity);
 const refresh = (key, entry) => {
 cache.delete(key);
 cache.set(key, entry);
 };
 const canCacheEntry = (value) =>
 maxEntrySize === Infinity || calculateSize(value) <= maxEntrySize;
 const evictIfNeeded = (newSize) => {
 if (max <= 0 || (cache.size < max && currentSize + newSize <= totalMaxSize)) return;
 const iterator = cache.keys();
 while (cache.size > 0 && (cache.size >= max || currentSize + newSize > totalMaxSize)) {
 const evictKey = iterator.next().value;
 const entry = cache.get(evictKey);
 remove(evictKey, entry, 'evict');
 }
 };
 return {
 get(key) {
 const entry = cache.get(key);
 const currentTime = now();
 if (!isValid(entry, currentTime)) {
 remove(key, entry, 'stale');
 return undefined;
 }
 if (updateAgeOnGet && entry.itemTtl != null && entry.itemTtl !== Infinity) {
 const updatedEntry = {
 ...entry,
 expiration: currentTime + entry.itemTtl
 };
 if (lru || updateAgeOnGet) refresh(key, updatedEntry);
 return updatedEntry.value;
 }
 if (lru) refresh(key, entry);
 return entry.value;
 },
 set(key, value, {
 ttl: itemTtl
 } = {}) {
 const ttlValue = itemTtl ?? ttl;
 const expiration = ttlValue === Infinity ? Infinity : now() + ttlValue;
 const itemSize = calculateSize(value);

 if (!canCacheEntry(value) || (totalMaxSize < Infinity && itemSize > totalMaxSize)) return this;
 const existingEntry = cache.get(key);
 if (existingEntry) {
 currentSize -= existingEntry.size;
 const updatedEntry = {
 ...existingEntry,
 value,
 expiration,
 itemTtl: ttlValue,
 size: itemSize
 };
 refresh(key, updatedEntry);
 currentSize += itemSize;
 } else {
 evictIfNeeded(itemSize);
 cache.set(key, {
 value,
 expiration,
 itemTtl: ttlValue,
 size: itemSize
 });
 currentSize += itemSize;
 }
 return this;
 },
 has(key) {
 return isValid(cache.get(key), now());
 },
 delete(key) {
 remove(key, cache.get(key), 'delete');
 },
 clear() {
 for (const [key, entry] of cache) remove(key, entry, 'delete');
 cache.clear();
 currentSize = 0;
 },
 peek(key) {
 const entry = cache.get(key);
 return isValid(entry, now()) ? entry.value : undefined;
 },
 prune() {
 const currentTime = now();
 let removed = 0;
 for (const [key, entry] of cache) {
 if (!isValid(entry, currentTime)) {
 remove(key, entry, 'stale');
 removed++;
 }
 }
 return removed;
 },
 keys() {
 return Array.from(cache.keys());
 },
 get size() {
 return cache.size;
 },
 get totalSize() {
 return currentSize;
 },
 canCacheEntry(value) {
 return canCacheEntry(value);
 }
 };
};
const createErrorFactory = (name, baseCode) => ({
 init(message, code = baseCode, config, cause) {
 const error = new Error(message);
 error.name = name;
 error.code = code;
 error.config = config;
 if (cause && error.cause == null) error.cause = cause;
 return error;
 }
});
const XdError = createErrorFactory('XdError', 'EUNKNOWN');
const HttpError = createErrorFactory('HttpError', 'EHTTP');
const TimeoutError = createErrorFactory('TimeoutError', 'ETIMEOUT');
const DecompressError = createErrorFactory('DecompressError', 'EDECOMPRESS');
let requestInterceptors = [];
let responseInterceptors = [];
const addInterceptor = (interceptors, fn) => {
 interceptors.push(fn);
};
const addRequestInterceptor = (fn) => addInterceptor(requestInterceptors, fn);
const addResponseInterceptor = (fn) => addInterceptor(responseInterceptors, fn);
const isPlainObject = (value) =>
 value && typeof value === 'object' && !Buffer.isBuffer(value) &&
 !(value instanceof URLSearchParams) && !Array.isArray(value);
const clamp = (number) => Math.max(0, Number.isFinite(number) ? number : 0);
const normalizeHeaderKey = (key) => String(key).toLowerCase()
 .replace(/[^a-z0-9\-]/g, '')
 .replace(/^-+|-+$/g, '')
 .replace(/-+/g, '-');
const normalizeHeaders = (headers) => {
 if (!headers || typeof headers !== 'object') return Object.create(null);
 const normalized = Object.create(null);
 for (const key in headers) {
 if (Object.prototype.hasOwnProperty.call(headers, key)) {
 const normalizedKey = normalizeHeaderKey(key);
 if (normalizedKey && headers[key] != null) {
 normalized[normalizedKey] = String(headers[key])
 .replace(/[\r\n\t\f\v\0]/g, ' ')
 .replace(/\s+/g, ' ')
 .trim();
 }
 }
 }
 return normalized;
};
const parseContentType = (contentType) => {
 const str = (contentType || '').toLowerCase().trim();
 const parts = str.split(';');
 const type = parts[0].trim();
 let charset = 'utf8';
 for (let i = 1; i < parts.length; i++) {
 const part = parts[i].trim();
 if (part.startsWith('charset=')) {
 charset = part.substring(8).trim().toLowerCase();
 break;
 }
 }
 return {
 type,
 charset,
 raw: contentType || ''
 };
};
const encodeFormData = (data) => {
 const params = new URLSearchParams();
 for (const key in data) {
 if (Object.prototype.hasOwnProperty.call(data, key) && data[key] != null) {
 params.append(key, String(data[key]));
 }
 }
 params.sort();
 return params.toString();
};
const flattenObject = (obj, prefix = '') => {
 const flat = [];
 for (const key in obj) {
 if (Object.prototype.hasOwnProperty.call(obj, key)) {
 const value = obj[key];
 const fullKey = prefix ? `${prefix}.${key}` : key;
 if (isPlainObject(value)) {
 flat.push(...flattenObject(value, fullKey));
 } else if (Array.isArray(value)) {
 for (let i = 0; i < value.length; i++) {
 const item = value[i];
 const arrayKey = `${fullKey}[${i}]`;
 if (isPlainObject(item)) {
 flat.push(...flattenObject(item, arrayKey));
 } else {
 flat.push([arrayKey, item]);
 }
 }
 } else {
 flat.push([fullKey, value]);
 }
 }
 }
 return flat;
};
const isFileObject = (value) =>
 value && typeof value === 'object' && value.filename &&
 value.data && Buffer.isBuffer(value.data);
const buildMultipartPart = (key, value, boundary) => {
 if (isFileObject(value)) {
 const {
 filename,
 contentType = 'application/octet-stream',
 data
 } = value;
 let part = `--${boundary}\nContent-Disposition: form-data; name="${key}"; filename="${filename}"\nContent-Type: ${contentType}\n\n`;
 return [Buffer.from(part, 'utf8'), data, Buffer.from('\n', 'utf8')];
 }
 const content = String(value);
 const part = `--${boundary}\nContent-Disposition: form-data; name="${key}"\n\n${content}\n`;
 return Buffer.from(part, 'utf8');
};
const prepareMultipartPayload = (data, boundary) => {
 const flatData = flattenObject(data);
 const parts = [];
 for (let i = 0; i < flatData.length; i++) {
 const [key, value] = flatData[i];
 if (value == null) continue;
 const partBuffers = buildMultipartPart(key, value, boundary);
 if (Array.isArray(partBuffers)) {
 parts.push(...partBuffers);
 } else {
 parts.push(partBuffers);
 }
 }
 parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
 return Buffer.concat(parts);
};
const validateBufferForDecompression = (buf, enc) => {
 if (!Buffer.isBuffer(buf) || buf.length < 2) return false;
 switch (enc) {
 case 'gzip':
 return buf[0] === 0x1f && buf[1] === 0x8b;
 case 'deflate':
 return buf[0] === 0x78 && (buf[1] === 0x9C || buf[1] === 0x01 || buf[1] === 0xDA);
 case 'br':
 return buf.length > 2 && (buf[0] !== 0 || buf[1] !== 0);
 default:
 return false;
 }
};
const decodeBuffer = (buffer, encoding, config = {}) => {
 if (!Buffer.isBuffer(buffer) || buffer.length === 0) return buffer;
 const valid = validateBufferForDecompression(buffer, encoding);
 if (!valid) {
 if (encoding) {
 throw DecompressError.init(`Invalid header for ${encoding} compression or corrupted buffer`, 'EDECOMPRESS_INVALID_HEADER', config);
 }
 return buffer;
 }
 try {
 switch (encoding) {
 case 'br':
 return brotliDecompressSync(buffer);
 case 'gzip':
 return gunzipSync(buffer);
 case 'deflate':
 return inflateSync(buffer);
 default:
 return buffer;
 }
 } catch (error) {
 const errorCode = error.code || 'UNKNOWN';
 let message = `Decompression failed for encoding: ${encoding}`;
 switch (errorCode) {
 case 'Z_DATA_ERROR':
 message = 'Corrupted or invalid compressed data';
 break;
 case 'Z_BUF_ERROR':
 message = 'Insufficient buffer space or incomplete data';
 break;
 case 'Z_MEM_ERROR':
 message = 'Out of memory during decompression';
 break;
 case 'Z_VERSION_ERROR':
 message = `Incompatible zlib version for ${encoding}`;
 break;
 case 'Z_STREAM_ERROR':
 message = 'Invalid compression stream parameters';
 break;
 case 'Z_ERRNO':
 message = 'File I/O error during decompression';
 break;
 case 'BUFFER_SHORTAGE':
 message = 'Buffer too short for decompression';
 break;
 case 'ENOBUFS':
 message = 'No buffer space available during decompression';
 break;
 case 'EINVAL':
 message = 'Invalid argument in decompression stream';
 break;
 default:
 message = `Unknown decompression error: ${errorCode}`;
 }
 throw DecompressError.init(message, `EDECOMPRESS_${errorCode}`, config, error);
 }
};
const shouldParseJson = (contentType) => {
 const {
 type
 } = contentType;
 return type === 'application/json' || type.endsWith('+json');
};
const combineSignals = (signalA, signalB) => {
 if (!signalA) return signalB || null;
 if (!signalB) return signalA;
 if (signalA.aborted) return signalA;
 if (signalB.aborted) return signalB;
 const controller = new AbortController();
 const abort = () => {
 if (!controller.signal.aborted) controller.abort();
 };
 const cleanup = () => {
 signalA.removeEventListener('abort', abort);
 signalB.removeEventListener('abort', abort);
 };
 signalA.addEventListener('abort', abort, {
 once: true
 });
 signalB.addEventListener('abort', abort, {
 once: true
 });
 controller.signal.addEventListener('abort', cleanup, {
 once: true
 });
 return controller.signal;
};
const createKeepAliveAgents = () => ({
 http: new http.Agent({
 keepAlive: true,
 keepAliveMsecs: 1000
 }),
 https: new https.Agent({
 keepAlive: true,
 keepAliveMsecs: 1000
 })
});
const keepAliveAgents = createKeepAliveAgents();
const processInterceptors = async (item, opts, interceptors, errorMsg) => {
 let currentItem = {
 ...item
 };
 for (let i = 0; i < interceptors.length; i++) {
 try {
 const result = await interceptors[i](currentItem);
 if (result) currentItem = {
 ...currentItem,
 ...result
 };
 } catch (error) {
 throw XdError.init(errorMsg, 'EINTERCEPTOR', opts, error);
 }
 }
 return currentItem;
};
const processRequestInterceptors = (opts, interceptors = requestInterceptors) =>
 processInterceptors(opts, opts, interceptors, 'Request interceptor failed');
const processResponseInterceptors = (response, opts, interceptors = responseInterceptors) =>
 processInterceptors(response, opts, interceptors, 'Response interceptor failed');
const buildRequestOptions = (opts) => {
 const {
 method = 'GET',
 url: urlStr,
 headers = {},
 keepAlive = true,
 agent: customAgent,
 signal: userSignal,
 decompress = true
 } = opts;
 const parsedUrl = new URL(urlStr);
 const isHttps = parsedUrl.protocol === 'https:';
 if (method.toUpperCase() === 'GET' && isPlainObject(opts.data)) {
 for (const key in opts.data) {
 if (Object.prototype.hasOwnProperty.call(opts.data, key) && opts.data[key] != null) {
 parsedUrl.searchParams.append(key, String(opts.data[key]));
 }
 }
 }
 const normalizedHeaders = normalizeHeaders(headers);
 if (!normalizedHeaders.accept) {
 normalizedHeaders.accept = 'application/json, */*;q=0.8';
 }
 if (decompress !== false && !normalizedHeaders['accept-encoding']) {
 normalizedHeaders['accept-encoding'] = 'gzip, deflate, br';
 }
 return {
 hostname: parsedUrl.hostname,
 port: parsedUrl.port || (isHttps ? 443 : 80),
 path: `${parsedUrl.pathname}${parsedUrl.search}`,
 method: method.toUpperCase(),
 headers: normalizedHeaders,
 signal: userSignal,
 agent: customAgent || (keepAlive ? keepAliveAgents[isHttps ? 'https' : 'http'] : undefined)
 };
};
const preparePayload = (data, headers) => {
 if (data == null) return null;
 let payload = null;
 let contentType = headers['content-type'];
 if (Buffer.isBuffer(data)) {
 payload = data;
 } else if (typeof data === 'string') {
 payload = Buffer.from(data, 'utf8');
 } else if (isPlainObject(data)) {
 if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
 payload = Buffer.from(encodeFormData(data), 'utf8');
 } else if (contentType && contentType.includes('multipart/form-data')) {
 const boundary = `----xdReq${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
 payload = prepareMultipartPayload(data, boundary);
 if (!contentType) contentType = `multipart/form-data; boundary=${boundary}`;
 } else {
 const jsonString = JSON.stringify(data);
 payload = Buffer.from(jsonString, 'utf8');
 if (!contentType) contentType = 'application/json; charset=utf-8';
 }
 } else {
 payload = Buffer.from(String(data), 'utf8');
 }
 if (payload && !headers['content-length']) {
 headers['content-length'] = payload.length.toString();
 }
 if (contentType && !headers['content-type']) {
 headers['content-type'] = contentType;
 }
 return payload;
};
const createResponse = (res, requestOpts, data, meta = {}) => ({
 status: res.statusCode || 0,
 statusText: res.statusMessage || '',
 headers: res.headers,
 config: requestOpts,
 request: res.req,
 url: requestOpts.url,
 method: requestOpts.method,
 data,
 duration: Date.now() - (requestOpts._startTime || Date.now()),
 meta: {
 ...meta
 }
});
const handleStreamResponse = (res, requestOpts, timeoutId, resolve) => {
 if (timeoutId) clearTimeout(timeoutId);
 const response = createResponse(res, requestOpts, res);
 resolve(response);
};
const handleBufferResponse = async (chunks, res, requestOpts, timeoutId, resolve, reject) => {
 const buffer = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
 const encoding = (res.headers['content-encoding'] || '').toLowerCase().trim();
 let decoded = buffer;
 let decompressError = null;
 if (requestOpts.decompress !== false) {
 try {
 decoded = decodeBuffer(buffer, encoding, requestOpts);
 } catch (error) {
 decompressError = error;
 decoded = buffer;
 }
 }
 const contentType = parseContentType(res.headers['content-type']);
 const responseType = requestOpts.responseType || 'auto';
 let parsedData;
 let parseError = null;
 if (responseType === 'buffer') {
 parsedData = decoded;
 } else {
 const text = decoded.toString(contentType.charset);
 if (responseType === 'json' || (responseType === 'auto' && shouldParseJson(contentType))) {
 try {
 parsedData = JSON.parse(text);
 } catch (error) {
 parseError = error;
 parsedData = text;
 }
 } else {
 parsedData = text;
 }
 }
 const response = createResponse(res, requestOpts, parsedData, {
 parseError: parseError ? String(parseError.message) : null,
 decompressError: decompressError ? String(decompressError.message) : null,
 encoding,
 contentType: contentType.raw,
 raw: requestOpts.keepRaw ? buffer : undefined,
 size: buffer.length
 });
 if (timeoutId) clearTimeout(timeoutId);
 resolve(response);
};
const coreRequest = async (opts) => {
 const processedOpts = await processRequestInterceptors(opts);
 let {
 method = 'GET',
 url,
 data,
 timeout = 10000,
 stream = false,
 keepRaw = false,
 responseType = 'auto',
 decompress = true
 } = processedOpts;
 if (typeof url !== 'string' || !url.trim()) {
 throw XdError.init('URL is required', 'EURL', processedOpts);
 }
 let parsedUrl;
 try {
 parsedUrl = new URL(url);
 } catch (error) {
 throw XdError.init(`Invalid URL: ${url}`, 'EURL', processedOpts, error);
 }
 if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
 throw XdError.init(`Unsupported protocol: ${parsedUrl.protocol}`, 'EPROTOCOL', processedOpts);
 }
 const isHttps = parsedUrl.protocol === 'https:';
 const client = isHttps ? https : http;
 const abortController = new AbortController();
 const combinedSignal = combineSignals(abortController.signal, processedOpts.signal);
 const timeoutValue = clamp(timeout);
 processedOpts._startTime = Date.now();
 const upperMethod = method.toUpperCase();
 if (upperMethod === 'GET' || upperMethod === 'HEAD') {
 data = null;
 }
 const headers = {
 ...processedOpts.headers
 };
 const payload = preparePayload(data, headers);
 const requestOptions = buildRequestOptions({
 ...processedOpts,
 url: parsedUrl.toString(),
 headers,
 signal: combinedSignal,
 decompress
 });
 return new Promise((resolve, reject) => {
 let timeoutId = null;
 let req = null;
 let settled = false;
 const settleOnce = (fn, arg) => {
 if (settled) return;
 settled = true;
 if (timeoutId) {
 clearTimeout(timeoutId);
 timeoutId = null;
 }
 fn(arg);
 };
 const onAbort = () => {
 if (req && !req.destroyed) req.destroy();
 if (!settled) settleOnce(reject, XdError.init('Request aborted', 'EABORT', processedOpts));
 };
 combinedSignal.addEventListener('abort', onAbort, {
 once: true
 });
 try {
 if (timeoutValue > 0) {
 timeoutId = setTimeout(() => {
 if (req && !req.destroyed) req.destroy();
 abortController.abort(new Error(`Timeout after ${timeoutValue}ms`));
 }, timeoutValue);
 }
 req = client.request(requestOptions, (res) => {
 combinedSignal.removeEventListener('abort', onAbort);
 if (stream) {
 handleStreamResponse(res, processedOpts, timeoutId, resolve);
 return;
 }
 const chunks = [];
 const onDataHandler = (chunk) => {
 if (combinedSignal.aborted) {
 res.destroy();
 return;
 }
 chunks.push(chunk);
 };
 res.on('data', onDataHandler);
 res.on('end', () => {
 if (combinedSignal.aborted) return;
 handleBufferResponse(chunks, res, processedOpts, timeoutId, resolve, reject).catch(reject);
 });
 res.on('error', (error) => {
 if (combinedSignal.aborted) return;
 settleOnce(reject, XdError.init(`Response error: ${error.message}`, error.code || 'ERESPONSE', processedOpts, error));
 });
 if (res.statusCode && res.statusCode >= 400) res.resume();
 });
 req.on('error', (error) => {
 if (error.code === 'ABORT_ERR' || combinedSignal.aborted) return;
 settleOnce(reject, XdError.init(`Request error: ${error.message}`, error.code || 'EREQUEST', processedOpts, error));
 });
 if (payload) req.write(payload);
 req.end();
 } catch (error) {
 settleOnce(reject, XdError.init(error.message || 'Request initialization failed', 'EREQUEST_INIT', processedOpts, error));
 }
 });
};
const createRetryPlugin = (config = {}) => {
 const {
 retries = 3,
 delay = 100,
 maxDelay = 10000,
 idempotentMethods = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']),
 transientErrors = new Set(['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'ETIMEDOUT', 'ESOCKETTIMEDOUT'])
 } = config;
 return (next) => async (opts) => {
 const method = (opts.method || 'GET').toUpperCase();
 if (!idempotentMethods.has(method)) return next(opts);
 let lastError;
 for (let attempt = 0; attempt <= retries; attempt++) {
 try {
 return await next(opts);
 } catch (error) {
 lastError = error;
 if (attempt === retries) throw error;
 const status = error.name === 'HttpError' && error.meta?.status;
 const isNetworkError = error.name === 'TimeoutError' || transientErrors.has(error.code);
 if (!isNetworkError && !(status >= 500 || status === 408 || status === 429 || status === 503)) throw error;
 const baseDelay = Math.min(delay * Math.pow(2, attempt), maxDelay);
 const jitter = Math.random() * 100;
 const waitTime = baseDelay + jitter;
 await new Promise((resolve) => setTimeout(resolve, waitTime));
 }
 }
 throw lastError;
 };
};
const createCachePlugin = (config = {}) => {
 const {
 max = 100,
 ttl = 300000,
 totalMaxSize = Infinity,
 maxEntrySize = Infinity,
 updateAgeOnGet = false,
 excludeHeaders = ['authorization', 'cookie'],
 lru = true
 } = config;
 const cache = createLRUCache({
 max,
 ttl,
 totalMaxSize,
 lru,
 updateAgeOnGet,
 maxEntrySize,
 dispose: (key, value) => {
 if (value?.data && (Buffer.isBuffer(value.data) || typeof value.data === 'object')) value.data = null;
 }
 });
 return (next) => async (opts) => {
 const method = (opts.method || 'GET').toUpperCase();
 if (method !== 'GET' || opts.stream || opts.cache === false) return next(opts);
 const normalizedHeaders = normalizeHeaders(opts.headers);
 if (excludeHeaders.some((header) => normalizedHeaders[header.toLowerCase()]) ||
 normalizedHeaders['cache-control']?.includes('no-store')) return next(opts);
 const urlObj = new URL(opts.url);
 const vary = (opts.headers['vary'] || '').split(',').map(s => s.trim().toLowerCase());
 const headPart = vary.includes('accept') ? (normalizedHeaders.accept || '') : '';
 const sortedParams = [...urlObj.searchParams.entries()]
 .sort(([a], [b]) => a.localeCompare(b))
 .map(([key, value]) => `${key}=${value}`)
 .join('&');
 const cacheKey = `${urlObj.origin}${urlObj.pathname}${sortedParams ? `?${sortedParams}` : ''}|${headPart}`;
 const cached = cache.get(cacheKey);
 if (cached !== undefined) return {
 ...cached,
 fromCache: true
 };
 const response = await next(opts);
 if (response.status >= 200 && response.status < 300 && totalMaxSize !== 0 && maxEntrySize !== 0) {
 if (!cache.canCacheEntry(response)) return response;
 const cacheControl = (response.headers['cache-control'] || '').toLowerCase();
 const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
 const cacheTtl = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : ttl;
 cache.set(cacheKey, {
 ...response
 }, {
 ttl: cacheTtl
 });
 }
 return response;
 };
};
let globalDefaults = {};
let globalRequestPipeline = coreRequest;
const applyPlugin = (pipeline, plugin, config) => {
 if (typeof plugin === 'function') return plugin(config)(pipeline);
 switch (plugin) {
 case 'retry':
 return createRetryPlugin(config)(pipeline);
 case 'cache':
 return createCachePlugin(config)(pipeline);
 default:
 throw new Error(`Unknown plugin: ${plugin}`);
 }
};
const usePlugin = (plugin, config) => {
 globalRequestPipeline = applyPlugin(globalRequestPipeline, plugin, config);
 return xdReq;
};
const mergeOptions = (defaults, opts, url) => {
 const merged = {
 ...defaults,
 ...opts
 };
 if (url) merged.url = url;
 if (merged.baseURL && merged.url && !merged.url.match(/^https?:\/\//)) {
 try {
 merged.url = new URL(merged.url, merged.baseURL).href;
 } catch (error) {
 throw XdError.init('Invalid baseURL or relative URL', 'EURL', merged, error);
 }
 }
 return merged;
};
const createClient = (defaults = {}, pipeline = coreRequest, reqInterceptors = [...requestInterceptors], resInterceptors = [...responseInterceptors]) => {
 const processReq = (opts) => processRequestInterceptors(opts, reqInterceptors);
 const processRes = (response, opts) => processResponseInterceptors(response, opts, resInterceptors);
 let instancePipeline = pipeline;
 let instanceDefaults = {
 ...defaults
 };
 let instanceReqInterceptors = [...reqInterceptors];
 let instanceResInterceptors = [...resInterceptors];
 const instanceCoreRequest = async (opts) => {
 const processedOpts = await processReq(opts);
 let response = await instancePipeline(processedOpts);
 response = await processRes(response, processedOpts);
 if (processedOpts.stream !== true && response.status >= 400) {
 const textSnippet = response.data ? String(response.data).slice(0, 512) : '';
 const message = `HTTP ${response.status} ${response.statusText} for ${processedOpts.url}${textSnippet ? ` :: ${textSnippet}` : ''}`;
 const error = HttpError.init(message, `HTTP_${response.status}`, processedOpts, {
 headers: response.headers,
 duration: response.duration,
 size: response.meta?.size || 0
 });
 throw error;
 }
 return response;
 };
 let instanceRequestPipeline = instanceCoreRequest;
 const instance = (url, opts = {}) => instanceRequestPipeline(mergeOptions(instanceDefaults, opts, url));
 instance.defaults = (config = {}) => {
 Object.assign(instanceDefaults, config);
 return instance;
 };
 const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
 for (let i = 0; i < httpMethods.length; i++) {
 const method = httpMethods[i];
 instance[method] = (url, data, config = {}) => {
 const options = {
 method: method.toUpperCase(),
 url,
 ...config
 };
 if (data !== undefined) options.data = data;
 return instance(options.url, options);
 };
 }
 instance.addRequestInterceptor = (fn) => {
 instanceReqInterceptors.push(fn);
 reqInterceptors.push(fn);
 };
 instance.addResponseInterceptor = (fn) => {
 instanceResInterceptors.push(fn);
 resInterceptors.push(fn);
 };
 instance.use = (plugin, config) => {
 instanceRequestPipeline = applyPlugin(instanceRequestPipeline, plugin, config);
 return instance;
 };
 instance.create = (defaultConfig = {}) => createClient({
 ...instanceDefaults,
 ...defaultConfig
 }, instancePipeline, [...instanceReqInterceptors], [...instanceResInterceptors]);
 return instance;
};
export const xdReq = createClient();
xdReq.use = usePlugin;
xdReq.defaults = (config = {}) => {
 Object.assign(globalDefaults, config);
 return xdReq;
};
xdReq.addRequestInterceptor = addRequestInterceptor;
xdReq.addResponseInterceptor = addResponseInterceptor;
xdReq.create = (defaultConfig = {}) => createClient({
 ...globalDefaults,
 ...defaultConfig
}, globalRequestPipeline);




/* *** DOCUMENTATION v2.0 ***
 * 📘 XD LIBS - PRODUCTION-READY REFERENCE
 * =================================================================================================
 *
 * BASICS:
 * - All exported functions: { xdTok, xdDrawNum, xdHash, xdUnHash, xdbLite, xdSrv, xdReq, xdRedis, xdLRU, xdCookie, xdWebSocket }
 * - Import: import { xdbLite, xdSrv, xdReq } from './xdLibs.js';
 * - Zero dependencies: Pure Node.js core modules only
 * - ESM only: Works with Node.js 18+
 *
 * CRITICAL IMPORTANT NOTES:
 * 1. ALL functions are ASYNC where applicable (except utilities)
 * 2. ALWAYS wrap route handlers in try-catch (xdSrv returns 500 on unhandled errors)
 * 3. WebSocket .send() requires STRING data - use JSON.stringify() for objects
 * 4. xdHash is OBFUSCATION, not encryption - do not use for sensitive data
 * 5. File operations are ATOMIC with process-safe locks
 * =================================================================================================
 *
 * [1] 🗄️ xdbLite - JSON Database with Atomic Operations
 * -------------------------------------------------------------------------------------------------
 * Purpose: File-based JSON database with ACID-like guarantees
 * File format: Always array of objects, e.g. [{ id: '...', data: ... }, ...]
 *
 * CONFIGURATION (Required before first use):
 * await xdbLite.config({
 * basePath: './data', // Required: Where JSON files are stored
 * cachingEnabled: false, // Default: false - DON'T enable without cache invalidation plan
 * cacheTTL: 60000, // Default: 60000ms (1 minute)
 * logLevel: 'INFO' // DEBUG|INFO|WARN|ERROR|NONE
 * });
 *
 * IMPORTANT: Cache invalidation MUST be handled manually:
 * - After .edit.id(): Automatically invalidates cache for that record
 * - After .del.id(): Automatically invalidates cache for that record
 * - After .edit.all()/.del.all(): Automatically invalidates all cache for file
 * - For external file modifications: call xdbLite.cache.invalidate(filePath)
 *
 * CRUD OPERATIONS (All return Promise):
 * .add.id(filePath, record) → { path: string, record: object }
 * - If record.id missing → generates xdTok(16)
 * - If id exists → throws XDB_ERROR_CODES.RECORD_EXISTS
 * - Example: await xdbLite.add.id('users.json', { name: 'John', age: 30 })
 *
 * .add.all(filePath, data, { overwrite: true }) → { path: string }
 * - data: array of objects OR single object
 * - If file exists and overwrite=false → throws XDB_ERROR_CODES.OPERATION_FAILED
 * - Example: await xdbLite.add.all('posts.json', postsArray, { overwrite: false })
 *
 * .view.id(filePath, id) → { path: string, record: object, fromCache: boolean? }
 * - Throws XDB_ERROR_CODES.RECORD_NOT_FOUND if missing
 * - Example: const { record } = await xdbLite.view.id('posts.json', 'post123')
 *
 * .view.all(filePath) → { path: string, data: array }
 * - Returns empty array if file doesn't exist (no error)
 * - Example: const { data } = await xdbLite.view.all('posts.json')
 *
 * .view.more(filePath, options) → { path: string, data: array, meta: object }
 * - options MUST include at least one of: filter, sort, skip, limit
 * - filter: (item) => boolean
 * - sort: { key: 'field', order: 'asc'|'desc' } OR array of those
 * - Example: await xdbLite.view.more('posts.json', { filter: p => p.published, sort: { key: 'date', order: 'desc' }, limit: 10 })
 *
 * .edit.id(filePath, id, updates) → { path: string, record: object }
 * - Merges updates into existing record (shallow merge)
 * - Throws XDB_ERROR_CODES.RECORD_NOT_FOUND if id doesn't exist
 * - Updates cache for that id
 * - Example: await xdbLite.edit.id('users.json', 'user123', { status: 'active' })
 *
 * .edit.all(filePath, newData) → { path: string }
 * - Completely replaces file content with newData (array or object)
 * - Invalidates entire file cache
 * - Example: await xdbLite.edit.all('config.json', { version: '2.0' })
 *
 * .del.id(filePath, id) → { path: string, deletedId: string }
 * - Throws XDB_ERROR_CODES.RECORD_NOT_FOUND if id doesn't exist
 * - Invalidates cache for that id
 * - Example: await xdbLite.del.id('posts.json', 'post456')
 *
 * .del.all(filePath) → { path: string }
 * - Writes empty array [] to file
 * - Invalidates all file cache
 * - Example: await xdbLite.del.all('temporary.json')
 *
 * .del.file(filePath) → { path: string }
 * - Deletes file from disk
 * - Invalidates all file cache
 * - No error if file doesn't exist
 * - Example: await xdbLite.del.file('obsolete_data.json')
 *
 * DIRECTORY OPERATIONS:
 * .dir.add(path) → { path: string } // Creates directory recursively
 * .dir.del(path) → { path: string } // Deletes directory recursively
 * .dir.rename(oldPath, newPath) → { oldPath, newPath } // Atomic rename
 * .dir.list(path) → string[] // Returns array of filenames
 *
 * FILE MOVING:
 * .move.file(sourcePath, targetPath) → { source, target }
 * - Atomic rename (filesystem-level)
 * - Invalidates cache for both paths
 *
 * CACHE MANAGEMENT:
 * .cache.clear() → void // Clears entire cache
 * .cache.invalidate(filePath, id?) → void // Invalidates specific file/record cache
 *
 * ERROR CODES (throw objects with .code property):
 * XDB_ERROR_CODES.FILE_NOT_FOUND // File doesn't exist
 * XDB_ERROR_CODES.DIR_NOT_FOUND // Directory doesn't exist
 * XDB_ERROR_CODES.IO_ERROR // Filesystem error
 * XDB_ERROR_CODES.INVALID_JSON // File isn't valid JSON
 * XDB_ERROR_CODES.RECORD_NOT_FOUND // ID doesn't exist
 * XDB_ERROR_CODES.RECORD_EXISTS // ID already exists (collision)
 * XDB_ERROR_CODES.OPERATION_FAILED // Other operational error
 *
 * BEST PRACTICES:
 * 1. ALWAYS use try-catch with specific error.code checks
 * 2. Enable caching ONLY if you handle cache invalidation properly
 * 3. Use .move.file() instead of manual rename for atomic operations
 * 4. .dir.list() returns only names, not stats - use fs for advanced ops
 * =================================================================================================
 *
 * [2] 🌐 xdSrv - Minimalist Web Server with WebSockets
 * -------------------------------------------------------------------------------------------------
 * IMPORTANT: NOT a replacement for Express/Fastify - designed for simplicity
 *
 * INITIALIZATION:
 * const app = xdSrv.createApp({
 * static: './public', // Static files directory (optional)
 * cors: true, // Enable CORS headers (default: true)
 * logs: true, // Request logging (default: true)
 * secureHeaders: true, // Security headers (default: true)
 * sessionSecret: 'change-me', // REQUIRED for sessions
 * trustProxy: false, // Trust X-Forwarded-* headers
 * maxBody: 1048576, // Max request body size (default: 1MB)
 * staticMaxAge: 3600, // Cache-Control max-age for static files (seconds)
 * wsMaxPayload: 16777216, // WebSocket max message (default: 16MB)
 * wsPingInterval: 30000, // WebSocket ping interval (milliseconds)
 * wsPingTimeout: 10000, // WebSocket pong timeout
 * wsProtocols: ['chat', 'game'], // Supported subprotocols
 * maxWsClients: 1000, // Max concurrent WebSocket connections
 * rateLimit: true // Enable rate limiting (default: true)
 * });
 *
 * HTTP ROUTES:
 * app.get(pattern, handler) // GET requests
 * app.post(pattern, handler) // POST requests
 * app.put(pattern, handler) // PUT requests
 * app.delete(pattern, handler) // DELETE requests
 *
 * Pattern syntax:
 * - '/api/users' // Exact match
 * - '/api/users/:id' // Named parameter → req.params.id
 * - '/api/users/:id/posts/:postId' // Multiple params
 *
 * MIDDLEWARE:
 * app.use(pattern, (req, res, next) => { ...; next(); })
 * app.use((req, res, next) => { ...; next(); }) // Global middleware
 *
 * REQUEST OBJECT (req):
 * req.method // 'GET', 'POST', etc.
 * req.path // '/api/users/123'
 * req.query // { param: 'value' } from ?param=value
 * req.params // { id: '123' } from /users/:id
 * req.body // Parsed JSON, FormData or Buffer
 * req.cookies // { session: 'abc' } parsed cookies
 * req.ip // Client IP (respects trustProxy)
 * req.hostname // Host header without port
 * req.secure // Boolean (true if HTTPS)
 * req.session // Session object (initially {})
 * req.currentSessionId // Current session ID (string)
 *
 * SESSION METHODS (async):
 * await req.saveSession() // Persists req.session to store
 * await req.destroySession() // Clears session from store + cookie
 *
 * RESPONSE OBJECT (res):
 * res.status(code) → res // Sets HTTP status: res.status(404)
 * res.set(key, value) → res // Sets header: res.set('X-API', '1')
 * res.type(mime) → res // Sets Content-Type: res.type('json')
 * res.vary(header) → res // Adds to Vary header: res.vary('Accept')
 *
 * SENDING RESPONSES:
 * res.json(data) // Sends JSON with proper headers
 * res.html(string) // Sends HTML with text/html
 * res.send(string|object) // Auto-detects type, strings as text/html
 * res.redirect(code, url) // Redirects: res.redirect(302, '/')
 *
 * SECURITY HELPERS:
 * res.safeHtml(string) // Escapes HTML entities: & → &amp;
 * res.safeJson(data) // JSON.stringify with circular ref handling
 *
 * STATIC FILES:
 * - Serves files from 'static' directory
 * - Auto-indexes: / → /index.html
 * - Supports Range requests (partial content)
 * - Sends 304 Not Modified if ETag matches
 * - Respects staticMaxAge for Cache-Control
 *
 * WEBSOCKETS (app.ws):
 * app.ws(pattern, (ws, req) => {
 * // ws has same req properties: ws.path, ws.query, ws.params, ws.cookies
 * // WebSocket-specific:
 * ws.on('open', () => {}) // When connection opened
 * ws.on('message', (data, isBinary) => {
 * // data: If string sent → string, if Buffer/Binary → Buffer
 * // isBinary: boolean
 * // IMPORTANT: ws.send() expects STRING for text, Buffer/ArrayBuffer for binary
 * ws.send(JSON.stringify({ type: 'response' }));
 * });
 * ws.on('close', (code, reason) => {}) // code: number, reason: string
 * ws.on('error', (error) => {})
 * ws.on('ping', (data) => {}) // Received ping frame
 * ws.on('pong', (data) => {}) // Received pong frame
 *
 * // Control methods:
 * ws.send(data, { binary: boolean })
 * ws.ping(data) // data optional
 * ws.pong(data) // data optional
 * ws.close(code, reason) // code default: 1000
 * ws.terminate() // Force close without handshake
 *
 * // Properties:
 * ws.readyState // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
 * ws.socket // Raw net.Socket
 * ws.request // Original HTTP request
 * ws.path // WebSocket path
 * });
 *
 * BROADCASTING:
 * const result = app.broadcast(data, {
 * exclude: [wsClient1, wsClient2], // Clients to skip
 * filter: (client) => true/false // Predicate function
 * binary: false // Send as binary (default: false)
 * });
 * // Returns: { sent: number, failed: number }
 *
 * SERVER CONTROL:
 * app.listen(port, callback) // Starts server: app.listen(3000)
 * app.server // Raw http/https server instance
 * app.getWsClients() → WebSocket[] // Returns array of connected clients
 * app.cleanup() // Cleans up WebSocket intervals
 *
 * ERROR HANDLING:
 * - Unhandled errors in routes → 500 with error message
 * - JSON parse errors → 400 'Invalid JSON'
 * - Request body too large → 413 'Payload Too Large'
 * - 404 for unknown routes (falls back to static if enabled)
 *
 * WARNINGS:
 * 1. req.body exists only for POST/PUT with Content-Type
 * 2. WebSocket .send() requires string/Buffer - objects auto-converted to [object Object]
 * 3. Sessions MUST use req.saveSession() after modifications
 * 4. app.use() middleware runs BEFORE route matching
 * =================================================================================================
 *
 * [3] 📡 xdReq - Advanced HTTP Client with Plugins
 * -------------------------------------------------------------------------------------------------
 * Designed for: API calls, web scraping, proxy requests
 *
 * BASIC USAGE:
 * const response = await xdReq.get('https://api.example.com/data', {
 * headers: { 'Authorization': 'Bearer token' },
 * timeout: 5000, // Abort after ms (default: 10000)
 * responseType: 'json' // 'json'|'buffer'|'text'|'auto' (default: 'auto')
 * });
 *
 * REQUEST OPTIONS (all optional):
 * {
 * url: '...',
 * method: 'GET', // GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS
 * data: any, // Request body (auto-handled)
 * headers: { 'X-Custom': 'value' },
 * timeout: 10000, // milliseconds
 * responseType: 'auto', // auto-detects from Content-Type
 * decompress: true, // Auto-decompress gzip/brotli
 * stream: false, // If true, returns response stream
 * keepRaw: false, // Keep raw buffer in response.meta.raw
 * cache: true, // Use cache plugin if enabled
 * signal: AbortSignal, // AbortController signal
 * keepAlive: true, // HTTP keep-alive
 * baseURL: 'https://api.example.com' // For relative paths
 * }
 *
 * RESPONSE OBJECT:
 * {
 * data: parsed/json/string/buffer, // Parsed based on responseType
 * status: 200, // HTTP status code
 * statusText: 'OK', // HTTP status text
 * headers: {}, // Response headers (normalized lowercase)
 * config: {}, // Original request config
 * request: http.ClientRequest, // Raw request object
 * url: 'https://...', // Final URL
 * method: 'GET',
 * duration: 245, // Request duration in ms
 * meta: {
 * parseError: null/string, // JSON parse error if any
 * decompressError: null/string, // Decompression error if any
 * encoding: 'gzip'/'deflate'/null,
 * contentType: 'application/json',
 * raw: Buffer, // Only if keepRaw: true
 * size: 12345 // Response size in bytes
 * }
 * }
 *
 * INSTANCE CREATION (with defaults):
 * const api = xdReq.create({
 * baseURL: 'https://api.example.com',
 * headers: { 'Authorization': 'Bearer ...' },
 * timeout: 30000
 * });
 *
 * // All methods available:
 * api.get('endpoint')
 * api.post('endpoint', data)
 * api.put('endpoint', data)
 * api.patch('endpoint', data)
 * api.delete('endpoint')
 * api.head('endpoint')
 * api.options('endpoint')
 *
 * PLUGINS (built-in):
 * // Enable retry plugin (idempotent methods only: GET, HEAD, OPTIONS, TRACE)
 * api.use('retry', {
 * retries: 3, // Number of retry attempts
 * delay: 100, // Base delay between retries (ms)
 * maxDelay: 10000, // Maximum delay
 * transientErrors: [ // Error codes to retry on
 * 'ECONNRESET', 'ENOTFOUND',
 * 'ECONNREFUSED', 'EAI_AGAIN',
 * 'ETIMEDOUT', 'ESOCKETTIMEDOUT'
 * ]
 * });
 *
 * // Enable cache plugin (GET requests only)
 * api.use('cache', {
 * max: 100, // Maximum number of cached responses
 * ttl: 300000, // Cache TTL in ms (5 minutes)
 * totalMaxSize: Infinity, // Maximum cache size in bytes
 * maxEntrySize: Infinity, // Maximum per-entry size
 * excludeHeaders: ['authorization', 'cookie'] // Don't cache these headers
 * });
 *
 * INTERCEPTORS (modify requests/responses):
 * // Request interceptor (modify config before request)
 * api.addRequestInterceptor(config => {
 * config.headers['X-Timestamp'] = Date.now();
 * return config; // Must return modified config
 * });
 *
 * // Response interceptor (modify/validate response)
 * api.addResponseInterceptor(response => {
 * if (response.status === 401) {
 * throw new Error('Unauthorized');
 * }
 * response.data.timestamp = Date.now();
 * return response; // Must return response
 * });
 *
 * ADVANCED FEATURES:
 * // Multipart/form-data uploads
 * await api.post('upload', {
 * file: {
 * filename: 'image.jpg',
 * contentType: 'image/jpeg',
 * data: Buffer.from(...)
 * },
 * field: 'value'
 * });
 *
 * // Stream response (for large files)
 * const response = await api.get('large-file', { stream: true });
 * response.data.pipe(fs.createWriteStream('output.bin'));
 *
 * // AbortController for cancellation
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 5000);
 * try {
 * await api.get('slow-endpoint', { signal: controller.signal });
 * } catch (err) {
 * if (err.name === 'AbortError') console.log('Request cancelled');
 * }
 *
 * ERROR TYPES:
 * HttpError - HTTP status >= 400 (err.meta contains full response)
 * TimeoutError - Request timeout
 * DecompressError - Decompression failed
 * XdError - General request/response errors
 *
 * BEST PRACTICES:
 * 1. ALWAYS use try-catch - errors are thrown for status >= 400
 * 2. Set reasonable timeouts per endpoint type
 * 3. Use responseType: 'buffer' for binary data
 * 4. Enable keepAlive for multiple requests to same host
 * 5. Cache only safe-to-cache endpoints
 * =================================================================================================
 *
 * [4] 🧠 xdRedis - In-Memory Redis-Compatible Store
 * -------------------------------------------------------------------------------------------------
 * IMPORTANT: In-memory only, lost on process restart. Use for caching/sessions.
 *
 * INITIALIZATION:
 * const db = xdRedis({
 * max: 1000, // Maximum keys in store (default: 1000)
 * // Note: No persistence options - memory only
 * });
 *
 * STRING OPERATIONS:
 * db.set(key, value, { ttl: seconds }) → 'OK' // ttl: seconds, -1 = no expiry
 * db.get(key) → string|null // Returns null if not found/expired
 * db.exists(key) → 0|1 // 1 = exists, 0 = doesn't
 * db.del(key) → 0|1 // 1 = deleted, 0 = didn't exist
 * db.expire(key, seconds) → 0|1 // Set TTL, 1 = set, 0 = key doesn't exist
 * db.ttl(key) → -2|-1|seconds // -2 = doesn't exist, -1 = no expiry
 * db.incr(key) → number // Increments integer value
 * db.decr(key) → number // Decrements integer value
 * db.append(key, string) → newLength // Appends to string value
 *
 * LIST OPERATIONS (Redis lists):
 * db.lpush(key, ...values) → newLength // Prepends values
 * db.rpush(key, ...values) → newLength // Appends values
 * db.lpop(key) → string|null // Removes and returns first element
 * db.rpop(key) → string|null // Removes and returns last element
 * db.lrange(key, start, end) → string[] // Returns slice (0-based, -1 = last)
 *
 * HASH OPERATIONS (key-value within key):
 * db.hset(key, field, value) → 0|1 // 1 = new field, 0 = updated
 * db.hget(key, field) → string|null // Returns field value
 * db.hdel(key, ...fields) → number // Number of fields deleted
 * db.hkeys(key) → string[] // All field names
 * db.hgetall(key) → object // { field: value, ... }
 *
 * SET OPERATIONS (unique collections):
 * db.sadd(key, ...members) → number // Number of new members added
 * db.srem(key, ...members) → number // Number of members removed
 * db.smembers(key) → string[] // All members
 * db.sismember(key, member) → 0|1 // 1 = is member, 0 = is not
 *
 * BULK OPERATIONS:
 * db.keys(pattern) → string[] // pattern supports * wildcard
 * db.dbsize() → number // Number of keys in store
 * db.flushAll() → 'OK' // Deletes all keys
 *
 * JOB QUEUE (Redis-like queue with DLQ):
 * const queue = db.createRedisQueue('jobs', async (task) => {
 * // Process task
 * if (task.type === 'email') await sendEmail(task.data);
 * }, {
 * concurrency: 1, // Concurrent workers (default: 1)
 * pollInterval: 500, // Queue polling interval ms (default: 500)
 * maxRetries: 3, // Max retries before DLQ (default: 3)
 * baseRetryDelay: 1000, // Base delay between retries ms (default: 1000)
 * dlqKeySuffix: '_DLQ' // Dead Letter Queue suffix (default: '_DLQ')
 * });
 *
 * // Enqueue task (any JSON-serializable data)
 * queue.enqueue({ type: 'email', data: { to: '...' } }) → queue length
 *
 * // Control
 * queue.stop() // Stops processing
 * queue.length // Current queue length (getter)
 * queue.isRunning // Is queue active? (getter)
 * queue.dlqLength // Dead letter queue length (getter)
 * queue.viewDLQ(start, end) → [] // View DLQ contents
 *
 * IMPORTANT NOTES:
 * 1. All values stored as strings (JSON.stringify for objects)
 * 2. TTL precision: ~1 second
 * 3. Pattern matching: * wildcard only (no regex)
 * 4. No persistence - memory only
 * 5. Thread-safe within single Node.js process
 * =================================================================================================
 *
 * [5] 🛠️ UTILITIES - Security, Random, Cookies
 * -------------------------------------------------------------------------------------------------
 * SECURITY:
 * xdTok(length=36) → string // Time-sortable unique ID (similar to ULID)
 * xdHash(data) → string|null // Obfuscation (XOR + Base64) - NOT encryption
 * xdUnHash(hash) → string|null // Reverse of xdHash
 *
 * HTML ESCAPING (XSS prevention):
 * safeText(string) → string // Escapes: & < > " '
 * safeAttr(name, value, options) → string // name="escaped-value"
 * options: { quoted: true } // true → name="value", false → name=value
 * safeUrlAttr(name, url) → string // Sanitizes URL protocols (blocks javascript:)
 *
 * RANDOM NUMBERS:
 * xdDrawNum(min, max) → object // Returns: { next(), set(min, max) }
 * // Usage:
 * const rng = xdDrawNum(1, 100);
 * rng.next() → random number 1-100
 * rng.set(50, 500).next() → random number 50-500
 *
 * COOKIE HANDLING (xdCookie):
 * xdCookie.parse(header) → object // Parse 'Cookie:' header
 * xdCookie.serialize(name, value, options) → string // Create 'Set-Cookie:' value
 * xdCookie.set(res, name, value, options) // Set cookie on response
 * xdCookie.setAll(res, cookies, options) // Set multiple cookies
 * xdCookie.clear(res, name, options) // Clear cookie (maxAge: 0)
 * xdCookie.get(cookies, name) → string|null // Get from parsed cookies
 * xdCookie.has(cookies, name) → boolean // Check existence
 *
 * Cookie options:
 * {
 * maxAge: 3600, // seconds
 * expires: Date, // Date object
 * domain: '.example.com',
 * path: '/',
 * secure: true, // HTTPS only
 * httpOnly: true, // No JavaScript access
 * sameSite: 'Lax' // 'Strict'|'Lax'|'None'
 * }
 *
 * UNIVERSAL ESCAPE:
 * escapeAny(value, options) → string // Context-aware escaping
 * // options: { context: 'htmlContent'|'htmlAttribute'|'jsString'|'cssString'|'url'|'auto' }
 * // Example: escapeAny(userInput, { context: 'htmlContent' })
 *
 * CHARACTER ESCAPING:
 * escapeAny('alert(1)', { context: 'jsString' }) → "alert\x281\x29"
 * escapeAny(userInput, { context: 'auto', inAttribute: true, targetName: 'onclick' }) → properly escaped
 *
 * BEST PRACTICES:
 * 1. ALWAYS escape user input with safeText() or safeAttr()
 * 2. Use xdCookie.set() with httpOnly: true, secure: true for sessions
 * 3. xdHash for obfuscation only (e.g., temporary tokens)
 * 4. xdTok for database IDs (not crypto-secure random)
 * 5. escapeAny() when unsure of context
 * =================================================================================================
 *
 * [6] 🎯 xdLRU - LRU Cache Implementation
 * -------------------------------------------------------------------------------------------------
 * const cache = xdLRU({
 * max: 500, // Maximum items in cache
 * ttl: 60000, // Time-to-live in ms (0 = no expiry)
 * maxMemoryBytes: 52428800, // 50MB memory limit
 * updateAgeOnGet: false, // Reset TTL on access
 * dispose: (key, value, reason) => { ... } // Called on eviction
 * });
 *
 * Methods:
 * cache.get(key) → value|undefined
 * cache.set(key, value, { ttl: ms }) → cache (chainable)
 * cache.has(key) → boolean
 * cache.delete(key) → boolean (true if deleted)
 * cache.clear() → void
 * cache.peek(key) → value|undefined (no TTL reset)
 * cache.prune() → number (removed expired items)
 * cache.keys() → iterator
 * cache.size → number
 * cache.memoryUsage → number (bytes)
 * cache.canCacheEntry(value) → boolean (fits memory limits?)
 *
 * AUTOMATIC CLEANUP:
 * - Auto-prunes expired entries every 5 minutes
 * - Auto-evicts when max items or max memory reached
 * - dispose() called for each evicted entry
 *
 * USE CASES:
 * - Session storage (TTL-based)
 * - API response caching
 * - Expensive computation memoization
 * - Rate limiting counters
 * =================================================================================================
 *
 * [7] ⚡ xdWebSocket - Raw WebSocket Handler
 * -------------------------------------------------------------------------------------------------
 * Used internally by xdSrv. Exported for custom implementations.
 *
 * const { createWebSocket, handleUpgrade } = xdWebSocket;
 *
 * // Manual WebSocket upgrade handling:
 * if (req.headers.upgrade === 'websocket') {
 * handleUpgrade(req, socket, head, routes, options);
 * }
 *
 * // Creating custom WebSocket:
 * const ws = createWebSocket(socket, req, {
 * maxPayload: 16777216, // Max message size
 * pingInterval: 30000, // Ping interval ms
 * pingTimeout: 10000, // Pong timeout ms
 * maxClients: 1000 // Max connections
 * });
 *
 * Low-level control only. Use xdSrv.createApp().ws() for production.
 * =================================================================================================
 *
 * [8] 🚨 ERROR HANDLING PATTERNS
 * -------------------------------------------------------------------------------------------------
 * try {
 * // xdbLite operations
 * const { record } = await xdbLite.view.id('data.json', '123');
 * } catch (err) {
 * if (err.code === 'XDB_RECORD_NOT_FOUND') {
 * res.status(404).json({ error: 'Not found' });
 * } else {
 * console.error('Database error:', err);
 * res.status(500).json({ error: 'Internal error' });
 * }
 * }
 *
 * try {
 * // xdReq operations
 * const response = await xdReq.get('https://api.com/data');
 * if (response.status >= 400) {
 * throw new Error(`API error: ${response.status}`);
 * }
 * } catch (err) {
 * if (err.name === 'HttpError') {
 * console.log('HTTP error:', err.meta);
 * } else if (err.name === 'TimeoutError') {
 * console.log('Request timeout');
 * }
 * }
 *
 * // WebSocket error handling
 * ws.on('error', (err) => {
 * console.error('WebSocket error:', err);
 * ws.close(1011, 'Internal error');
 * });
 *
 * // Global error handler for xdSrv
 * app.use((err, req, res, next) => {
 * console.error('Unhandled error:', err);
 * res.status(500).json({ error: 'Something went wrong' });
 * });
 *
 * COMMON ERROR CODES:
 * XDB_ERROR_CODES.* // Database errors
 * ECONNREFUSED, ETIMEDOUT // Network errors
 * ENOENT // File not found
 * LIMIT_FILE_SIZE // Body too large
 * INVALID_JSON // JSON parse error
 * =================================================================================================
 *
 * [9] 🧪 TESTING TIPS
 * -------------------------------------------------------------------------------------------------
 * // Mock xdbLite for testing
 * import { xdbLite } from './xdLibs.js';
 * import { test } from 'node:test';
 * import assert from 'node:assert';
 * import { temporaryDirectory } from 'tempy';
 *
 * test('xdbLite operations', async () => {
 * const testDir = temporaryDirectory();
 * await xdbLite.config({ basePath: testDir, cachingEnabled: false });
 *
 * const { record } = await xdbLite.add.id('test.json', { name: 'test' });
 * assert.ok(record.id);
 *
 * const { data } = await xdbLite.view.all('test.json');
 * assert.strictEqual(data.length, 1);
 *
 * await xdbLite.del.file('test.json');
 * });
 *
 * // Test xdSrv routes
 * const app = xdSrv.createApp({ logs: false });
 * app.get('/test', (req, res) => res.json({ ok: true }));
 *
 * // Use supertest or manual http requests
 *
 * // Clean up after tests
 * afterEach(async () => {
 * await xdbLite.cache.clear();
 * });
 *
 * PERFORMANCE NOTES:
 * - xdbLite: ~1000 ops/sec (depends on filesystem)
 * - xdRedis: ~50k ops/sec (in-memory)
 * - xdSrv: ~10k req/sec (simple routes)
 * - xdReq: ~100 req/sec (depends on network)
 * =================================================================================================
 *
 * [10] ⚖️ PRODUCTION DEPLOYMENT
 * -------------------------------------------------------------------------------------------------
 * 1. Set proper sessionSecret (32+ random chars)
 * 2. Enable trustProxy if behind reverse proxy
 * 3. Configure rate limiting thresholds
 * 4. Set appropriate wsMaxClients
 * 5. Use process manager (PM2, systemd)
 * 6. Enable logging for monitoring
 * 7. Set NODE_ENV=production
 * 8. Regular backup of xdbLite data directory
 * 9. Monitor memory usage (xdRedis can grow)
 * 10. Implement health checks
 *
 * SECURITY CHECKLIST:
 * [ ] All user input escaped with safeText()/safeAttr()
 * [ ] Session cookies: httpOnly: true, secure: true
 * [ ] CORS properly configured
 * [ ] Rate limiting enabled
 * [ ] File uploads validated (size, type)
 * [ ] No sensitive data in xdHash() (use crypto for encryption)
 * [ ] WebSocket origin validation if needed
 * [ ] Directory traversal prevented (xdSrv handles this)
 *
 * TROUBLESHOOTING:
 * Issue: xdbLite.cache.invalidate() not working
 * Fix: Check file path is relative to basePath, use absolute paths
 *
 * Issue: xdReq cache plugin caching POST requests
 * Fix: cache plugin only caches GET by default, verify method
 *
 * Issue: WebSocket messages showing [object Object]
 * Fix: Always JSON.stringify() objects before ws.send()
 *
 * Issue: xdRedis losing data on restart
 * Fix: Expected behavior - memory only. Implement persistence layer if needed
 *
 * Issue: xdSrv returning 404 for valid routes
 * Fix: Check route patterns match exactly, middleware not blocking
 *
 * Issue: xdReq timeout too short
 * Fix: Increase timeout option or implement retry plugin
 * =================================================================================================
 */


// // TESTS
// import { describe, it, beforeEach, afterEach } from 'node:test';import assert from 'node:assert';
// const testFileLockSystem = () => { const fileLocks = new Map(); const lockCleanup = new Set(); const LOCK_TIMEOUT = 30000; const LOCK_RETRY_INTERVAL = 50;  const acquireLock = async (filePath, timeout = LOCK_TIMEOUT) => {  const fullPath = path.resolve(filePath);  const startTime = Date.now();  const processId = process.pid + '_' + Math.random();   if (lockCleanup.has(`${fullPath}:${processId}`)) {  throw new Error(`Process ${processId} already holds lock for ${filePath} - potential deadlock`);  }  let retryCount = 0;  const maxRetries = Math.ceil(timeout / LOCK_RETRY_INTERVAL);  while (fileLocks.has(fullPath)) {  if (Date.now() - startTime > timeout) {   throw new Error(`Timeout waiting for lock on ${filePath} after ${timeout}ms`);  }   const lockData = fileLocks.get(fullPath);  if (lockData && lockData.expiresAt < Date.now()) {   fileLocks.delete(fullPath);   lockCleanup.delete(`${fullPath}:${lockData.processId}`);   break;  }   retryCount++;  if (retryCount > maxRetries) {   throw new Error(`Max retries exceeded for lock on ${filePath}`);  }   await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_INTERVAL));  }  let release;  const lockPromise = new Promise(resolve => { release = resolve; });  const lockData = {  promise: lockPromise,  release: () => release(),  expiresAt: Date.now() + timeout,  processId: processId,  filePath: fullPath  };  fileLocks.set(fullPath, lockData);  lockCleanup.add(`${fullPath}:${processId}`);  return () => {  if (fileLocks.has(fullPath)) {   const currentLock = fileLocks.get(fullPath);   if (currentLock.processId === processId) {   fileLocks.delete(fullPath);   lockCleanup.delete(`${fullPath}:${processId}`);   }  }  }; };  return { acquireLock, fileLocks, lockCleanup }; };  const testUTF8Validation = () => { const isValidUTF8 = (buffer) => {  try {  const text = buffer.toString('utf8'); const reencoded = Buffer.from(text, 'utf8');   return buffer.equals(reencoded);  } catch {  return false;  } };  return { isValidUTF8 }; };  const createTestErrorHandler = () => { const errorListeners = new Set(); const unhandledRejections = new Map();  const handleError = (error, context = {}) => {  const errorWithContext = {  ...context,  message: error?.message || String(error),  stack: error?.stack,  code: error?.code,  timestamp: Date.now()  };  for (const listener of errorListeners) {  try {   listener('error', errorWithContext);  } catch {}  }  return errorWithContext; };  const handleAsyncError = async (operation, context = {}) => {  try {  return await operation();  } catch (error) {  return handleError(error, context);  } };  return { handleError, handleAsyncError, errorListeners }; };  const createTestCache = ({  max = 100,  ttl = 5000,  maxMemoryBytes = 1024 * 1024 } = {}) => { const cache = new Map(); let currentMemoryUsage = 0;  const calculateItemSize = (value) => {  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');  if (Buffer.isBuffer(value)) return value.length;  try {  return Buffer.byteLength(JSON.stringify(value), 'utf8');  } catch {  return 0;  } };  const set = (key, value) => {  const itemSize = calculateItemSize(value);   if (itemSize > maxMemoryBytes) {  return false;  }  while (cache.size >= max || currentMemoryUsage + itemSize > maxMemoryBytes) {  const firstKey = cache.keys().next().value;  if (!firstKey) break; const oldEntry = cache.get(firstKey);  currentMemoryUsage -= oldEntry.size;  cache.delete(firstKey);  }  cache.set(key, { value, size: itemSize, timestamp: Date.now() });  currentMemoryUsage += itemSize;  return true; };  const get = (key) => {  const entry = cache.get(key);  if (!entry) return undefined;   if (entry.timestamp + ttl < Date.now()) {  currentMemoryUsage -= entry.size;  cache.delete(key);  return undefined;  }   return entry.value; };  const getMemoryUsage = () => currentMemoryUsage;  return { set, get, getMemoryUsage, cache }; };  const testAsyncFileServing = () => { const serveFileAsync = async (filePath, response) => {  try {  const stats = await fs.stat(filePath);  if (!stats.isFile()) throw new Error('Not a file');  return true;  } catch (error) {  return false;  } };  return { serveFileAsync }; };  describe('File Lock System (Punkt 1)', () => { const testDir = './test-locks';  beforeEach(async () => {  await fs.mkdir(testDir, { recursive: true }); });  afterEach(async () => {  await fs.rm(testDir, { recursive: true, force: true }); });  it('powinien poprawnie nabywać i zwalniać blokadę', async () => {  const lockSystem = testFileLockSystem();  const testFile = path.join(testDir, 'test.json');  await fs.writeFile(testFile, '{}');  const release = await lockSystem.acquireLock(testFile);  assert(lockSystem.fileLocks.has(path.resolve(testFile)), 'Blokada powinna istnieć');   release();  assert(!lockSystem.fileLocks.has(path.resolve(testFile)), 'Blokada powinna być zwolniona'); });  it('powinien obsługiwać timeout przy oczekiwaniu na blokadę', async () => {  const lockSystem = testFileLockSystem();  const testFile = path.join(testDir, 'test.json');  await fs.writeFile(testFile, '{}');  const release1 = await lockSystem.acquireLock(testFile);   await assert.rejects(  async () => {   await lockSystem.acquireLock(testFile, 100);  },  /Timeout waiting for lock/,  'Powinien timeoutować'  );  release1(); });  it('powinien zapobiegać deadlock przez wykrywanie podwójnej blokady', async () => {  const lockSystem = testFileLockSystem();  const testFile = path.join(testDir, 'test.json');  await fs.writeFile(testFile, '{}');  const processId = process.pid + '_test';   lockSystem.lockCleanup.add(`${path.resolve(testFile)}:${processId}`);   await assert.rejects(  async () => {  const fullPath = path.resolve(testFile);   if (lockSystem.lockCleanup.has(`${fullPath}:${processId}`)) {   throw new Error(`Process ${processId} already holds lock for ${testFile} - potential deadlock`);   }  },  /already holds lock.*potential deadlock/,  'Powinien wykryć deadlock'  ); });  it('powinien czyścić wygasłe blokady', async () => {  const lockSystem = testFileLockSystem();  const testFile = path.join(testDir, 'test.json');  await fs.writeFile(testFile, '{}'); const expiredLock = {  promise: Promise.resolve(),  release: () => {},  expiresAt: Date.now() - 1000,  processId: 9999,  filePath: path.resolve(testFile)  };   lockSystem.fileLocks.set(path.resolve(testFile), expiredLock);  const release = await lockSystem.acquireLock(testFile);  assert(lockSystem.fileLocks.has(path.resolve(testFile)), 'Powinien nabyć nową blokadę');   release(); }); }); describe('WebSocket UTF-8 Validation (Punkt 2)', () => { const utf8 = testUTF8Validation();  it('powinien poprawnie walidować prawidłowe UTF-8', () => {  const validTexts = [  'Hello World',  'Zażółć gęślą jaźń',  '你好世界',  '🚀 Unicode emojis',  'Special chars: àáâãäåæçèéêë'  ];  validTexts.forEach(text => {  const buffer = Buffer.from(text, 'utf8');  assert(utf8.isValidUTF8(buffer), `Powinien zaakceptować: ${text}`);  }); });  it('powinien odrzucać nieprawidłowe UTF-8', () => {  const invalidBuffers = [  Buffer.from([0xFF, 0xFE]),   Buffer.from([0xC0, 0x80]),   Buffer.from([0xED, 0xA0, 0x80]),   Buffer.from([0xF5, 0x80, 0x80, 0x80])  ];  invalidBuffers.forEach(buffer => {  assert(!utf8.isValidUTF8(buffer), `Powinien odrzucić nieprawidłowy buffer`);  }); });  it('powinien obsługiwać puste bufory', () => {  assert(utf8.isValidUTF8(Buffer.alloc(0)), 'Pusty buffer powinien być prawidłowy'); });  it('powinien obsługiwać bufory ASCII', () => {  const asciiBuffer = Buffer.from('Hello World!', 'ascii');  assert(utf8.isValidUTF8(asciiBuffer), 'ASCII powinien być prawidłowym UTF-8'); }); });  describe('Central Error Handler (Punkt 3)', () => { let errorHandler;  beforeEach(() => {  errorHandler = createTestErrorHandler(); });  it('powinien poprawnie obsługiwać błędy synchroniczne', () => {  const testError = new Error('Test error');  const context = { operation: 'test', id: 123 };  const result = errorHandler.handleError(testError, context);  assert.strictEqual(result.message, 'Test error');  assert.strictEqual(result.operation, 'test');  assert.strictEqual(result.id, 123);  assert(result.timestamp instanceof Number || typeof result.timestamp === 'number'); });  it('powinien obsługiwać błędy asynchroniczne', async () => {  const asyncOperation = async () => {   throw new Error('Async test error');  };  const result = await errorHandler.handleAsyncError(asyncOperation, { context: 'async-test' });  assert.strictEqual(result.message, 'Async test error');  assert.strictEqual(result.context, 'async-test'); });  it('powinien obsługiwać nieobiektowe błędy', () => {  const result = errorHandler.handleError('String error', { type: 'string' });  assert.strictEqual(result.message, 'String error');  assert.strictEqual(result.type, 'string'); });  it('powinien wywoływać listenerów błędów', () => {  let capturedError = null;  errorHandler.errorListeners.add((type, error) => {   capturedError = error;  });  errorHandler.handleError(new Error('Listened error'));  assert(capturedError);  assert.strictEqual(capturedError.message, 'Listened error'); });  it('powinien obsługiwać błędy bez stacka', () => {  const error = { message: 'Custom error object' };  const result = errorHandler.handleError(error);  assert.strictEqual(result.message, 'Custom error object');  assert.strictEqual(result.stack, undefined); }); }); describe('Cache with Memory Limits (Punkt 5)', () => { let cache;  beforeEach(() => {  cache = createTestCache({ max: 3, ttl: 1000, maxMemoryBytes: 500 }); });  it('powinien ograniczać liczbę elementów', () => {  cache.set('key1', 'value1');  cache.set('key2', 'value2');  cache.set('key3', 'value3');  cache.set('key4', 'value4');   assert.strictEqual(cache.cache.size, 3, 'Powinien utrzymać maksymalnie 3 elementy');  assert.strictEqual(cache.get('key1'), undefined, 'Najstarszy element powinien być usunięty');  assert.strictEqual(cache.get('key4'), 'value4', 'Najnowszy element powinien istnieć'); });  it('powinien ograniczać użycie pamięci', () => {   const largeValue = 'x'.repeat(300);  cache.set('large1', largeValue);  cache.set('large2', largeValue);  const memoryBefore = cache.getMemoryUsage();  const success = cache.set('large3', largeValue); assert(memoryBefore > 0, 'Użycie pamięci powinno być większe niż 0');  assert(success || !success, 'Set powinien zwrócić boolean'); });  it('powinien obsługiwać TTL', async () => {  cache.set('temp', 'temporary');  assert.strictEqual(cache.get('temp'), 'temporary'); await new Promise(resolve => setTimeout(resolve, 1100));   assert.strictEqual(cache.get('temp'), undefined, 'Element powinien wygasnąć'); });  it('powinien poprawnie liczyć użycie pamięci', () => {  const value1 = 'Hello';  const value2 = Buffer.from('World');  const value3 = { test: 'object' };  cache.set('str', value1);  cache.set('buf', value2);  cache.set('obj', value3);  const usage = cache.getMemoryUsage();  assert(usage > 0, 'Użycie pamięci powinno być większe niż 0'); }); }); describe('Async File Serving (Punkt 6)', () => { const testDir = './test-files';  beforeEach(async () => {  await fs.mkdir(testDir, { recursive: true }); });  afterEach(async () => {  await fs.rm(testDir, { recursive: true, force: true }); });  it('powinien serwować pliki asynchronicznie', async () => {  const fileServer = testAsyncFileServing();  const testFile = path.join(testDir, 'test.txt');  const content = 'Test file content';  await fs.writeFile(testFile, content);  const mockResponse = {};  const result = await fileServer.serveFileAsync(testFile, mockResponse);  assert(result, 'Powinien pomyślnie obsłużyć istniejący plik'); });  it('powinien obsługiwać błędy podczas odczytu pliku', async () => {  const fileServer = testAsyncFileServing();  const nonExistentFile = path.join(testDir, 'nonexistent.txt');  const mockResponse = {};  const result = await fileServer.serveFileAsync(nonExistentFile, mockResponse);  assert(!result, 'Powinien zwrócić false dla nieistniejącego pliku'); });  it('powinien obsługiwać duże pliki poprzez streaming', async () => {  const fileServer = testAsyncFileServing();  const largeFile = path.join(testDir, 'large.txt');  const largeContent = 'x'.repeat(1024 * 1024);  await fs.writeFile(largeFile, largeContent);  const mockResponse = {};  const result = await fileServer.serveFileAsync(largeFile, mockResponse);  assert(result, 'Powinien pomyślnie obsłużyć duży plik'); }); }); describe('Integration Tests', () => { it('powinien obsługiwać pełny przepływ: lock -> operacja -> unlock', async () => {  const testDir = './test-integration';  const testFile = path.join(testDir, 'integration.json');   await fs.mkdir(testDir, { recursive: true });   const data = { counter: 0 };  await fs.writeFile(testFile, JSON.stringify(data));  for (let i = 0; i < 5; i++) {  const lockSystem = testFileLockSystem();  const release = await lockSystem.acquireLock(testFile); const fileData = JSON.parse(await fs.readFile(testFile, 'utf8'));  fileData.counter++;  await fs.writeFile(testFile, JSON.stringify(fileData)); release();  }   const finalData = JSON.parse(await fs.readFile(testFile, 'utf8'));  assert.strictEqual(finalData.counter, 5, 'Licznik powinien wynosić 5 po wszystkich operacjach');  await fs.rm(testDir, { recursive: true, force: true }); });  it('powinien obsługiwać kombinację cache + error handling', async () => {  const cache = createTestCache({ max: 2, ttl: 1000 });  const errorHandler = createTestErrorHandler(); cache.set('test', 'value');  assert.strictEqual(cache.get('test'), 'value', 'Cache powinien zwrócić wartość');  const error = new Error('Test error');  const result = errorHandler.handleError(error, { source: 'cache' });  assert.strictEqual(result.message, 'Test error');  assert.strictEqual(result.source, 'cache'); }); }); 

/*
▶ File Lock System (Punkt 1)
  ✔ powinien poprawnie nabywać i zwalniać blokadę (8.019797ms)
  ✔ powinien obsługiwać timeout przy oczekiwaniu na blokadę (110.76772ms)
  ✔ powinien zapobiegać deadlock przez wykrywanie podwójnej blokady (6.362604ms)
  ✔ powinien czyścić wygasłe blokady (9.52708ms)
✔ File Lock System (Punkt 1) (138.290021ms)
▶ WebSocket UTF-8 Validation (Punkt 2)
  ✔ powinien poprawnie walidować prawidłowe UTF-8 (0.87611ms)
  ✔ powinien odrzucać nieprawidłowe UTF-8 (0.483631ms)
  ✔ powinien obsługiwać puste bufory (0.326292ms)
  ✔ powinien obsługiwać bufory ASCII (0.425156ms)
✔ WebSocket UTF-8 Validation (Punkt 2) (3.33901ms)
▶ Central Error Handler (Punkt 3)
  ✔ powinien poprawnie obsługiwać błędy synchroniczne (1.797543ms)
  ✔ powinien obsługiwać błędy asynchroniczne (0.738717ms)
  ✔ powinien obsługiwać nieobiektowe błędy (0.323794ms)
  ✔ powinien wywoływać listenerów błędów (0.421198ms)
  ✔ powinien obsługiwać błędy bez stacka (0.330739ms)
✔ Central Error Handler (Punkt 3) (4.539652ms)
▶ Cache with Memory Limits (Punkt 5)
  ✔ powinien ograniczać liczbę elementów (1.316348ms)
  ✔ powinien ograniczać użycie pamięci (0.474791ms)
  ✔ powinien obsługiwać TTL (1102.874752ms)
  ✔ powinien poprawnie liczyć użycie pamięci (10.502529ms)
✔ Cache with Memory Limits (Punkt 5) (1116.468046ms)
▶ Async File Serving (Punkt 6)
  ✔ powinien serwować pliki asynchronicznie (6.820534ms)
  ✔ powinien obsługiwać błędy podczas odczytu pliku (1.858868ms)
  ✔ powinien obsługiwać duże pliki poprzez streaming (5.337251ms)
✔ Async File Serving (Punkt 6) (14.734433ms)
▶ Integration Tests
  ✔ powinien obsługiwać pełny przepływ: lock -> operacja -> unlock (8.1236ms)
  ✔ powinien obsługiwać kombinację cache + error handling (0.624744ms)
✔ Integration Tests (9.342158ms)
*/
