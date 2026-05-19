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
exports.startDreamDaemon = startDreamDaemon;
exports.stopDreamDaemon = stopDreamDaemon;
exports.getDreamDaemonStatus = getDreamDaemonStatus;
exports.runDreamDaemonLoop = runDreamDaemonLoop;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const url_1 = require("url");
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const dreamScheduler_1 = require("./dreamScheduler");
const DEFAULT_DAEMON_STATE = {
    schemaVersion: '1.0',
    updatedAt: new Date(0).toISOString(),
    running: false,
    ticks: 0
};
function startDreamDaemon(paths, options = {}) {
    const config = (0, config_1.loadTriadConfig)(paths).dream;
    if (!config.daemonEnabled) {
        return {
            status: 'error',
            running: false,
            message: 'dream daemon is disabled by config.dream.daemonEnabled=false'
        };
    }
    const currentStatus = getDreamDaemonStatus(paths);
    if (currentStatus.running && currentStatus.pid) {
        return {
            status: 'already_running',
            running: true,
            pid: currentStatus.pid,
            message: `dream daemon already running (pid=${currentStatus.pid})`,
            state: currentStatus.state
        };
    }
    const intervalSeconds = normalizePositiveInteger(options.intervalSeconds, config.daemonIntervalSeconds);
    const maxTicks = normalizeNonNegativeInteger(options.maxTicks, config.daemonMaxTicksPerRun);
    fs.mkdirSync(path.dirname(paths.dreamDaemonLogFile), { recursive: true });
    const logFd = fs.openSync(paths.dreamDaemonLogFile, 'a');
    const args = buildDaemonSpawnArgs(intervalSeconds, maxTicks);
    const child = (0, child_process_1.spawn)(process.execPath, args, {
        cwd: paths.projectRoot,
        detached: true,
        stdio: ['ignore', logFd, logFd]
    });
    child.unref();
    fs.closeSync(logFd);
    const nowIso = new Date().toISOString();
    const pidRecord = {
        schemaVersion: '1.0',
        pid: child.pid ?? 0,
        startedAt: nowIso,
        intervalSeconds,
        maxTicks
    };
    writeDaemonPid(paths.dreamDaemonPidFile, pidRecord);
    const state = readDreamDaemonState(paths.dreamDaemonStateFile);
    const nextState = {
        ...state,
        schemaVersion: '1.0',
        updatedAt: nowIso,
        running: true,
        pid: pidRecord.pid,
        startedAt: nowIso
    };
    writeDreamDaemonState(paths.dreamDaemonStateFile, nextState);
    return {
        status: 'started',
        running: true,
        pid: child.pid,
        message: `dream daemon started (pid=${child.pid}, interval=${intervalSeconds}s, maxTicks=${maxTicks})`,
        state: nextState
    };
}
function stopDreamDaemon(paths) {
    const pidRecord = readDaemonPid(paths.dreamDaemonPidFile);
    if (!pidRecord || !pidRecord.pid) {
        const state = markDreamDaemonStopped(paths, undefined, 'dream daemon is not running');
        return {
            status: 'not_running',
            running: false,
            message: 'dream daemon is not running',
            state
        };
    }
    const running = isProcessRunning(pidRecord.pid);
    if (!running) {
        safeRemoveFile(paths.dreamDaemonPidFile);
        const state = markDreamDaemonStopped(paths, pidRecord.pid, 'dream daemon process already exited');
        return {
            status: 'not_running',
            running: false,
            pid: pidRecord.pid,
            message: 'dream daemon process already exited',
            state
        };
    }
    try {
        process.kill(pidRecord.pid, 'SIGTERM');
    }
    catch (error) {
        return {
            status: 'error',
            running: true,
            pid: pidRecord.pid,
            message: `failed to stop dream daemon: ${error?.message ? String(error.message) : String(error)}`
        };
    }
    const state = markDreamDaemonStopped(paths, pidRecord.pid, 'dream daemon stopped by command');
    safeRemoveFile(paths.dreamDaemonPidFile);
    return {
        status: 'stopped',
        running: false,
        pid: pidRecord.pid,
        message: `dream daemon stopped (pid=${pidRecord.pid})`,
        state
    };
}
function getDreamDaemonStatus(paths) {
    const pidRecord = readDaemonPid(paths.dreamDaemonPidFile);
    const state = readDreamDaemonState(paths.dreamDaemonStateFile);
    if (!pidRecord || !pidRecord.pid) {
        return {
            running: false,
            state: {
                ...state,
                running: false
            }
        };
    }
    const running = isProcessRunning(pidRecord.pid);
    if (!running) {
        safeRemoveFile(paths.dreamDaemonPidFile);
        const stoppedState = markDreamDaemonStopped(paths, pidRecord.pid, 'dream daemon process not found');
        return {
            running: false,
            pid: pidRecord.pid,
            state: stoppedState
        };
    }
    return {
        running: true,
        pid: pidRecord.pid,
        state: {
            ...state,
            running: true,
            pid: pidRecord.pid,
            startedAt: state.startedAt ?? pidRecord.startedAt
        }
    };
}
async function runDreamDaemonLoop(paths, options) {
    const intervalSeconds = normalizePositiveInteger(options.intervalSeconds, 180);
    const maxTicks = normalizeNonNegativeInteger(options.maxTicks, 0);
    const nowIso = new Date().toISOString();
    const pidRecord = {
        schemaVersion: '1.0',
        pid: process.pid,
        startedAt: nowIso,
        intervalSeconds,
        maxTicks
    };
    writeDaemonPid(paths.dreamDaemonPidFile, pidRecord);
    let stopRequested = false;
    let ticks = 0;
    const requestStop = () => {
        stopRequested = true;
    };
    process.on('SIGINT', requestStop);
    process.on('SIGTERM', requestStop);
    try {
        while (!stopRequested) {
            ticks += 1;
            const tickResult = await (0, dreamScheduler_1.tickDreamAutoRun)(paths, {
                trigger: 'daemon'
            });
            const state = readDreamDaemonState(paths.dreamDaemonStateFile);
            const heartbeat = new Date().toISOString();
            const nextState = {
                ...state,
                schemaVersion: '1.0',
                updatedAt: heartbeat,
                running: true,
                pid: process.pid,
                startedAt: state.startedAt ?? nowIso,
                heartbeatAt: heartbeat,
                ticks,
                lastStatus: tickResult.status,
                lastReason: tickResult.reason,
                lastError: tickResult.error
            };
            writeDreamDaemonState(paths.dreamDaemonStateFile, nextState);
            if (maxTicks > 0 && ticks >= maxTicks) {
                break;
            }
            await sleep(intervalSeconds * 1000);
        }
    }
    finally {
        process.off('SIGINT', requestStop);
        process.off('SIGTERM', requestStop);
        safeRemoveFile(paths.dreamDaemonPidFile);
        markDreamDaemonStopped(paths, process.pid, 'dream daemon loop exited');
    }
}
function buildDaemonSpawnArgs(intervalSeconds, maxTicks) {
    const cliEntry = resolveCliEntry();
    if (cliEntry.endsWith('.ts')) {
        const tsxPath = require.resolve('tsx');
        return [
            '--import',
            (0, url_1.pathToFileURL)(tsxPath).href,
            cliEntry,
            'dream',
            'daemon-loop',
            '--interval-seconds',
            String(intervalSeconds),
            '--max-ticks',
            String(maxTicks)
        ];
    }
    return [
        cliEntry,
        'dream',
        'daemon-loop',
        '--interval-seconds',
        String(intervalSeconds),
        '--max-ticks',
        String(maxTicks)
    ];
}
function resolveCliEntry() {
    const argvEntry = String(process.argv[1] ?? '').trim();
    if (argvEntry) {
        return path.resolve(argvEntry);
    }
    return path.resolve(__dirname, 'cli.js');
}
function markDreamDaemonStopped(paths, pid, reason) {
    const state = readDreamDaemonState(paths.dreamDaemonStateFile);
    const nextState = {
        ...state,
        schemaVersion: '1.0',
        updatedAt: new Date().toISOString(),
        running: false,
        pid,
        heartbeatAt: new Date().toISOString(),
        lastReason: reason
    };
    writeDreamDaemonState(paths.dreamDaemonStateFile, nextState);
    return nextState;
}
function readDaemonPid(filePath) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(filePath);
    if (result.status !== 'ok' || !result.value) {
        return undefined;
    }
    const parsed = result.value;
    const pid = Number(parsed.pid ?? 0);
    if (!Number.isFinite(pid) || pid <= 0) {
        return undefined;
    }
    return {
        schemaVersion: '1.0',
        pid,
        startedAt: String(parsed.startedAt ?? ''),
        intervalSeconds: normalizePositiveInteger(parsed.intervalSeconds, 180),
        maxTicks: normalizeNonNegativeInteger(parsed.maxTicks, 0)
    };
}
function writeDaemonPid(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}
function readDreamDaemonState(filePath) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(filePath);
    if (result.status !== 'ok' || !result.value) {
        return {
            ...DEFAULT_DAEMON_STATE
        };
    }
    const parsed = result.value;
    return {
        schemaVersion: '1.0',
        updatedAt: String(parsed.updatedAt ?? new Date(0).toISOString()),
        running: Boolean(parsed.running),
        pid: Number.isFinite(parsed.pid) ? Number(parsed.pid) : undefined,
        startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : undefined,
        heartbeatAt: typeof parsed.heartbeatAt === 'string' ? parsed.heartbeatAt : undefined,
        ticks: normalizeNonNegativeInteger(parsed.ticks, 0),
        lastStatus: parsed.lastStatus === 'run' || parsed.lastStatus === 'skipped' || parsed.lastStatus === 'error'
            ? parsed.lastStatus
            : undefined,
        lastReason: typeof parsed.lastReason === 'string' ? parsed.lastReason : undefined,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : undefined
    };
}
function writeDreamDaemonState(filePath, state) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function safeRemoveFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }
    try {
        fs.unlinkSync(filePath);
    }
    catch {
        // best effort
    }
}
function normalizePositiveInteger(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }
    return fallback;
}
function normalizeNonNegativeInteger(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return fallback;
}
//# sourceMappingURL=dreamDaemon.js.map