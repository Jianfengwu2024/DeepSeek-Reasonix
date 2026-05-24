import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateDashboard } from '../visualizer';

function readVisualizerArray<T>(html: string, name: string) {
    const nextName = name === 'RAW_NODES' ? 'RAW_EDGES' : name === 'RAW_EDGES' ? 'LEGEND' : 'MAYA_DATA';
    const match = html.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);\\s*const ${nextName} = `));
    assert.ok(match, `${name} bootstrap not found in generated html`);
    return JSON.parse(match[1]) as T[];
}

test('visualizer fast mode skips per-owner strict fingerprints without blocking HTML output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-visualizer-fast-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });

    const mapPath = path.join(triadDir, 'triad-map.json');
    const protocolPath = path.join(triadDir, 'draft-protocol.json');
    const outputPath = path.join(triadDir, 'visualizer.html');
    const configPath = path.join(triadDir, 'config.json');

    fs.writeFileSync(
        configPath,
        JSON.stringify(
            {
                visualizer: {
                    defaultView: 'architecture',
                    fastMode: true,
                    strictFingerprint: false,
                    fastMayaThreshold: 0,
                    fastFingerprintThreshold: 0,
                    maxFingerprintNodes: 8,
                    maxFingerprintOwners: 50,
                    fingerprintTimeoutMs: 50
                }
            },
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(
        mapPath,
        JSON.stringify(
            [
                { nodeId: 'Api.handle', fission: { demand: ['OrderCommand'], answer: ['OrderResult'] } },
                { nodeId: 'Service.execute', fission: { demand: ['OrderResult'], answer: ['WorkflowState'] } },
                { nodeId: 'Adapter.apply', fission: { demand: ['WorkflowState'], answer: ['PersistedOrder'] } }
            ],
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(
        protocolPath,
        JSON.stringify(
            {
                protocolVersion: '1.0',
                project: 'visualizer-fast-mode',
                mapSource: 'triad-map.json',
                userDemand: 'verify fast visualizer',
                actions: []
            },
            null,
            2
        ),
        'utf-8'
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: unknown, ...args: unknown[]) => {
        logs.push([message, ...args].map(String).join(' '));
    };

    try {
        generateDashboard(mapPath, protocolPath, outputPath);
    } finally {
        console.log = originalLog;
    }

    const html = fs.readFileSync(outputPath, 'utf-8');
    const nodes = readVisualizerArray<any>(html, 'RAW_NODES');
    const edges = readVisualizerArray<any>(html, 'RAW_EDGES');
    const apiNode = nodes.find((node) => node.id === 'Api.handle');
    const producerEdge = edges.find((edge) => edge._type === 'producer_consumer');

    assert.match(html, /maya: fast fallback enabled/);
    assert.match(html, /Fingerprint skipped in fast mode/);
    assert.match(html, /#607894/);
    assert.equal(apiNode?.color?.background, '#7fb0e6');
    assert.equal(apiNode?.color?.border, '#f8fbff');
    assert.equal(producerEdge?.color?.color, '#cbd5e1');
    assert.equal(producerEdge?.color?.opacity, 0.94);
    assert.ok(logs.some((line) => line.includes('Visualizer mode: view=architecture')));
    assert.ok(logs.some((line) => line.includes('Strict fingerprint skipped: fallback mode enabled')));
    assert.ok(logs.some((line) => line.includes('Fingerprint owners skipped: 3')));
    assert.ok(logs.some((line) => line.includes('Dashboard generated in')));
});
