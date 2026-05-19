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
exports.DEFAULT_GOVERN_POLICY = void 0;
exports.buildDefaultGovernPolicy = buildDefaultGovernPolicy;
exports.resolveGovernPolicyPath = resolveGovernPolicyPath;
exports.ensureGovernPolicyFile = ensureGovernPolicyFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.DEFAULT_GOVERN_POLICY = {
    version: '1.0',
    mode: 'hard',
    must_pass: {
        diagnostics_no_code: { op: 'eq', value: 0 },
        execute_like_ratio: { op: 'lt', value: 0.1 },
        ghost_ratio: { op: 'lt', value: 0.4 },
        rendered_edges_consistency: { op: 'eq', value: true },
        runtime_unmatched_route_count: { op: 'lte_baseline_factor', value: 1.1 },
        triad_completeness_violations: { op: 'eq', value: 0 },
        protocol_focus_alignment_violations: { op: 'eq', value: 0 },
        focus_closure_violations: { op: 'eq', value: 0 },
        c2c_coupling_count: { op: 'lt', value: 3 }
    },
    language_ghost_policy: {
        python: { include_in_demand: false, top_k: 0, min_confidence: 'high' },
        javascript: { include_in_demand: false, top_k: 0, min_confidence: 'high' },
        typescript: { include_in_demand: true, top_k: 5, min_confidence: 'high' },
        java: { include_in_demand: true, top_k: 5, min_confidence: 'high' },
        go: { include_in_demand: true, top_k: 5, min_confidence: 'high' },
        rust: { include_in_demand: true, top_k: 8, min_confidence: 'high' }
    },
    forbidden_in_run: ['modify_policy', 'modify_baseline']
};
function buildDefaultGovernPolicy() {
    return JSON.parse(JSON.stringify(exports.DEFAULT_GOVERN_POLICY));
}
function resolveGovernPolicyPath(paths, overridePath) {
    const raw = String(overridePath ?? '').trim();
    if (!raw) {
        return paths.governPolicyFile;
    }
    return path.isAbsolute(raw) ? raw : path.resolve(paths.projectRoot, raw);
}
function ensureGovernPolicyFile(paths) {
    if (fs.existsSync(paths.governPolicyFile)) {
        return;
    }
    fs.mkdirSync(path.dirname(paths.governPolicyFile), { recursive: true });
    fs.writeFileSync(paths.governPolicyFile, JSON.stringify(buildDefaultGovernPolicy(), null, 2), 'utf-8');
}
//# sourceMappingURL=governPolicy.js.map