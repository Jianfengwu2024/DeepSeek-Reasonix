"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tickDreamAutoRun = tickDreamAutoRun;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const dream_1 = require("./dream");
async function tickDreamAutoRun(paths, options) {
    const trigger = String(options.trigger ?? '').trim() || 'unknown';
    const now = options.now ?? new Date();
    const nowIso = now.toISOString();
    const config = (0, config_1.loadTriadConfig)(paths);
    const dreamConfig = config.dream;
    const state = readDreamAutoState(paths.dreamAutoStateFile);
    state.totalEvents += 1;
    state.pendingEvents += 1;
    state.lastTrigger = trigger;
    state.updatedAt = nowIso;
    writeDreamAutoState(paths.dreamAutoStateFile, state);
    const finalizeSkip = (reason, lock = 'none') => {
        state.updatedAt = nowIso;
        state.lastResult = 'skipped';
        state.lastReason = reason;
        writeDreamAutoState(paths.dreamAutoStateFile, state);
        return {
            status: 'skipped',
            trigger,
            reason,
            ran: false,
            pendingEvents: state.pendingEvents,
            lock
        };
    };
    if (!dreamConfig.enabled && !options.force) {
        return finalizeSkip('dream disabled by config');
    }
    if (!dreamConfig.autoTriggerEnabled && !options.force) {
        return finalizeSkip('dream auto-trigger disabled by config');
    }
    const triggerSet = new Set((dreamConfig.autoTriggerCommands ?? [])
        .map((item) => String(item ?? '').trim().toLowerCase())
        .filter(Boolean));
    if (!options.force && triggerSet.size > 0 && !triggerSet.has(trigger.toLowerCase())) {
        return finalizeSkip(`trigger "${trigger}" not in autoTriggerCommands`);
    }
    if (!options.force && state.pendingEvents < dreamConfig.minEventsBetweenRuns) {
        return finalizeSkip(`event gate blocked: pendingEvents=${state.pendingEvents}, minEventsBetweenRuns=${dreamConfig.minEventsBetweenRuns}`);
    }
    if (!options.force && isWithinHours(state.lastRunAt, now, dreamConfig.minHoursBetweenRuns)) {
        return finalizeSkip(`time gate blocked: minHoursBetweenRuns=${dreamConfig.minHoursBetweenRuns}, lastRunAt=${state.lastRunAt ?? 'n/a'}`);
    }
    if (!options.force && isWithinMinutes(state.lastAutoScanAt, now, dreamConfig.scanThrottleMinutes)) {
        return finalizeSkip(`scan throttle blocked: scanThrottleMinutes=${dreamConfig.scanThrottleMinutes}, lastAutoScanAt=${state.lastAutoScanAt ?? 'n/a'}`);
    }
    const lockResult = tryAcquireDreamLock(paths.dreamLockFile, nowIso, trigger, dreamConfig.lockTimeoutMinutes);
    if (!lockResult.acquired) {
        return finalizeSkip('dream lock is busy', 'busy');
    }
    try {
        const result = await (0, dream_1.runDreamAnalysis)(paths, {
            mode: 'idle',
            force: true,
            impactThreshold: options.impactThreshold
        });
        state.pendingEvents = 0;
        state.lastRunAt = result.report.generatedAt;
        state.lastAutoScanAt = nowIso;
        state.updatedAt = nowIso;
        state.lastResult = 'run';
        state.lastReason = 'auto dream run completed';
        delete state.lastError;
        writeDreamAutoState(paths.dreamAutoStateFile, state);
        return {
            status: 'run',
            trigger,
            reason: 'auto dream run completed',
            ran: true,
            pendingEvents: state.pendingEvents,
            lock: lockResult.staleRecovered ? 'stale_recovered' : 'acquired',
            reportFile: result.artifacts.reportFile,
            diagnosticsFile: result.artifacts.diagnosticsFile
        };
    }
    catch (error) {
        const message = error?.message ? String(error.message) : String(error);
        state.lastAutoScanAt = nowIso;
        state.updatedAt = nowIso;
        state.lastResult = 'error';
        state.lastReason = 'auto dream run failed';
        state.lastError = message;
        writeDreamAutoState(paths.dreamAutoStateFile, state);
        if (dreamConfig.failOnDreamError) {
            throw error;
        }
        return {
            status: 'error',
            trigger,
            reason: 'auto dream run failed',
            ran: false,
            pendingEvents: state.pendingEvents,
            lock: lockResult.staleRecovered ? 'stale_recovered' : 'acquired',
            error: message
        };
    }
    finally {
        releaseDreamLock(paths.dreamLockFile);
    }
}
function readDreamAutoState(filePath) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(filePath);
    if (result.status !== 'ok' || !result.value) {
        return {
            schemaVersion: '1.0',
            updatedAt: new Date(0).toISOString(),
            pendingEvents: 0,
            totalEvents: 0
        };
    }
    const parsed = result.value;
    return {
        schemaVersion: '1.0',
        updatedAt: String(parsed.updatedAt ?? new Date(0).toISOString()),
        pendingEvents: normalizeNonNegativeInteger(parsed.pendingEvents, 0),
        totalEvents: normalizeNonNegativeInteger(parsed.totalEvents, 0),
        lastRunAt: typeof parsed.lastRunAt === 'string' ? parsed.lastRunAt : undefined,
        lastAutoScanAt: typeof parsed.lastAutoScanAt === 'string' ? parsed.lastAutoScanAt : undefined,
        lastTrigger: typeof parsed.lastTrigger === 'string' ? parsed.lastTrigger : undefined,
        lastResult: parsed.lastResult === 'run' || parsed.lastResult === 'skipped' || parsed.lastResult === 'error'
            ? parsed.lastResult
            : undefined,
        lastReason: typeof parsed.lastReason === 'string' ? parsed.lastReason : undefined,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : undefined
    };
}
function writeDreamAutoState(filePath, state) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}
function tryAcquireDreamLock(lockFilePath, nowIso, trigger, lockTimeoutMinutes) {
    const timeoutMs = lockTimeoutMinutes * 60 * 1000;
    let staleRecovered = false;
    if (fs.existsSync(lockFilePath)) {
        const existing = readDreamLock(lockFilePath);
        const acquiredAt = Date.parse(existing?.acquiredAt ?? '');
        const isStaleByTime = Number.isFinite(acquiredAt) ? Date.now() - acquiredAt > timeoutMs : true;
        const processAlive = isProcessAlive(existing?.pid);
        const shouldRecover = isStaleByTime || !processAlive;
        if (!shouldRecover) {
            return {
                acquired: false,
                staleRecovered: false
            };
        }
        try {
            fs.unlinkSync(lockFilePath);
            staleRecovered = true;
        }
        catch {
            return {
                acquired: false,
                staleRecovered: false
            };
        }
    }
    const payload = {
        schemaVersion: '1.0',
        pid: process.pid,
        trigger,
        acquiredAt: nowIso,
        host: os.hostname()
    };
    try {
        fs.mkdirSync(path.dirname(lockFilePath), { recursive: true });
        fs.writeFileSync(lockFilePath, JSON.stringify(payload, null, 2), {
            encoding: 'utf-8',
            flag: 'wx'
        });
        return {
            acquired: true,
            staleRecovered
        };
    }
    catch (error) {
        if (String(error?.code ?? '').toUpperCase() === 'EEXIST') {
            return {
                acquired: false,
                staleRecovered: false
            };
        }
        throw error;
    }
}
function readDreamLock(lockFilePath) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(lockFilePath);
    if (result.status !== 'ok' || !result.value) {
        return undefined;
    }
    const parsed = result.value;
    return {
        schemaVersion: '1.0',
        pid: Number(parsed.pid ?? 0),
        trigger: String(parsed.trigger ?? ''),
        acquiredAt: String(parsed.acquiredAt ?? ''),
        host: typeof parsed.host === 'string' ? parsed.host : undefined
    };
}
function releaseDreamLock(lockFilePath) {
    if (!fs.existsSync(lockFilePath)) {
        return;
    }
    try {
        fs.unlinkSync(lockFilePath);
    }
    catch {
        // best effort
    }
}
function isProcessAlive(pid) {
    if (typeof pid !== 'number' || !Number.isFinite(pid) || pid <= 0) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        const code = String(error?.code ?? '').toUpperCase();
        if (code === 'EPERM') {
            return true;
        }
        return false;
    }
}
function isWithinHours(iso, now, thresholdHours) {
    if (!iso) {
        return false;
    }
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) {
        return false;
    }
    const elapsedHours = (now.getTime() - parsed) / 3_600_000;
    return elapsedHours < thresholdHours;
}
function isWithinMinutes(iso, now, thresholdMinutes) {
    if (!iso) {
        return false;
    }
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) {
        return false;
    }
    const elapsedMinutes = (now.getTime() - parsed) / 60_000;
    return elapsedMinutes < thresholdMinutes;
}
function normalizeNonNegativeInteger(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return fallback;
}
//# sourceMappingURL=dreamScheduler.js.map