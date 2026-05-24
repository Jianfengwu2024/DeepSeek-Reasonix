# TriadMind Abstraction Governance Epic v0.1

## Why This Epic Exists

AI coding assistants optimize for local completion speed.
Without counter-pressure, they tend to generate flat concrete code:

- one more function
- one more class
- one more `if/else`
- one more direct dependency on another concrete implementation

This is not a small style issue.
For a topology-aware architecture companion like TriadMind, this becomes a structural entropy problem:

- capability graphs become concrete-heavy
- reuse becomes imitation instead of abstraction
- change impact grows faster than feature value
- Dream can only suggest split, not abstraction extraction
- Navigator can preview new nodes, but cannot yet force abstraction-first evolution

TriadMind should not only detect topology drift.
It should detect and govern abstraction deficit before the repository collapses into a big ball of mud.

## Current Codebase Reality

This Epic is justified by the current implementation state:

- `treeSitterParser.ts` already scans concrete executable units such as `class_declaration` and `function_declaration`, but does not yet promote abstraction constructs like `interface_declaration` or `type_alias_declaration` into first-class governance signals.
- `verify.ts` already measures execute-like ratio, ghost ratio, runtime parity, and triad completeness, but has no metric for abstraction scarcity or concrete-to-concrete coupling.
- `dream.ts` currently proposes denoise, split, runtime alignment, and fanout mitigation, but not abstraction extraction.
- `navigator.ts` and `navigatorLlm.ts` already generate impact protocols with `reuse` / `modify` / `create_child`, but the prompt rules only enforce reuse-first and minimal change, not abstraction-first when the existing area is structurally flat.
- `triad-map.json` already carries `fission.evidence` in practice, but `protocolRightBranch.ts` does not formally model that evidence as a stable contract. This should be corrected before adding new abstraction evidence.

The good news is that TriadMind already has most of the governance pipeline.
What is missing is the semantic layer that distinguishes abstraction from concrete implementation.

## Epic Goal

Add a new governance dimension that lets TriadMind:

1. detect abstraction scarcity
2. detect concrete-to-concrete dependency concentration
3. generate abstraction-oriented Dream proposals
4. bias Navigator toward abstraction-first impact protocols
5. keep topology evolution anti-entropic when AI-generated code accelerates

## Non-Goals

- not a full static type checker
- not a full dependency inversion theorem prover
- not a language-perfect abstraction detector in v0.1
- not a forced rewrite of all existing flat modules

The first version should be heuristic, explainable, and governance-friendly.

## Core Concept: Abstraction Deficit Index

Introduce a new metric family centered on `abstraction_deficit_index` (`ADI`).

`ADI` is a governance score, not a purity score.
Its job is to answer:

- does this module keep adding concrete leaves without introducing a reusable skeletal abstraction?
- does this feature area depend directly on concrete peers instead of stable contracts?
- is this a feature extension zone where AI will likely keep pasting more concrete branches?

### Suggested Inputs

#### 1. Abstraction-to-Concrete Balance

Per file, module, and selected directory scope, count:

- abstraction signals:
  - `interface`
  - `abstract class`
  - type alias used as contract / strategy / port
  - base policy / strategy / provider / port / gateway declarations
- concrete signals:
  - concrete classes
  - exported functions
  - sibling variant functions
  - implementation-heavy capability nodes

Derived metrics:

- `abstraction_signal_count`
- `concrete_signal_count`
- `abstraction_to_concrete_ratio`
- `modules_with_zero_abstractions`

#### 2. Concrete-to-Concrete Coupling

Detect dependency inversion pressure failures:

- concrete class directly calling multiple concrete peer classes
- concrete function clusters depending on sibling implementations instead of a contract
- feature extensions that grow by `if/else`, `switch`, or name-matched variants

Derived metrics:

- `c2c_edge_count`
- `c2c_hotspots`
- `dip_violation_clusters`
- `variant_without_contract_clusters`

#### 3. Flat Sibling Expansion

Detect areas where multiple same-level implementations exist without a unifying abstraction:

- `StripePay`, `PaypalPay`, `WechatPay` without `PaymentStrategy`
- multiple parser / exporter / provider implementations with shared shape but no contract node
- multiple peer functions sharing semantic prefixes and similar I/O

Derived metrics:

- `flat_variant_cluster_count`
- `largest_flat_variant_cluster`
- `cluster_contract_coverage_ratio`

### Initial Scoring Model

Version `v0.1` should keep scoring simple and debuggable:

```text
ADI = weighted(
  low_abstraction_ratio,
  c2c_coupling_ratio,
  flat_variant_cluster_ratio,
  zero_abstraction_hotspot_ratio
)
```

Default interpretation:

- `0.00 - 0.24`: healthy
- `0.25 - 0.49`: watch
- `0.50 - 0.74`: warning
- `0.75 - 1.00`: critical

## Data Model Changes

### 1. Formalize Evidence Contract First

Before adding abstraction metrics, formalize `fission.evidence` in the public node schema.

Current issue:

- parser artifacts already write evidence
- schema parsing strips or ignores that evidence in some pathways
- new governance signals will become fragile unless evidence is first-class

Add stable optional evidence fields to `TriadFission` or an adjacent node-evidence structure.

Suggested shape:

```json
{
  "fission": {
    "problem": "System Capability: ...",
    "demand": ["..."],
    "answer": ["..."],
    "evidence": {
      "ghostReads": [],
      "promotionReasons": [],
      "abstraction": {
        "role": "abstraction|concrete|mixed|unknown",
        "signals": ["interface", "abstract_class", "type_contract", "strategy_family"],
        "implements": ["PaymentStrategy"],
        "extendsAbstract": ["BaseProvider"],
        "peerConcreteCalls": ["StripePay.execute", "PaypalPay.execute"],
        "variantCluster": "payment"
      }
    }
  }
}
```

### 2. Parser-Level Semantic Output

The parser should emit abstraction evidence, not just capability promotion evidence.

For TypeScript first:

- detect `interface_declaration`
- detect `type_alias_declaration`
- detect abstract classes
- detect `implements` and `extends`
- detect sibling variant families
- detect call edges where both source and target are concrete

This does not require all abstractions to become visible topology nodes in v0.1.
It only requires them to become measurable evidence.

## Analyzer and Verify Changes

### Analyzer

Extend `analyzer.ts` with module-scope structure analysis:

- build per-source-path abstraction summaries
- aggregate abstraction signals by file / directory / category
- detect C2C hotspots from capability relations
- expose reusable helpers for Dream and Verify

Suggested exports:

- `calculateAbstractionDeficitMetrics(map, options)`
- `detectConcreteCouplingHotspots(map, options)`
- `detectFlatVariantClusters(map, options)`

### Verify

Extend `VerifyMetrics` and `VerifyThresholds` with:

- `abstraction_deficit_index`
- `abstraction_signal_count`
- `concrete_signal_count`
- `c2c_hotspot_count`
- `flat_variant_cluster_count`
- `zero_abstraction_hotspot_count`

Add checks such as:

- `abstraction_deficit_index < 0.5`
- `c2c_hotspot_count <= N`
- `zero_abstraction_hotspot_count <= N`

The verify report should explain the top offending files and directories, not just emit numeric failure.

## Dream Engine Changes

Add a new Dream pattern: `Aggregate & Abstract`.

### Trigger Conditions

Trigger when at least one of the following is true:

- a module has a high concrete count and zero abstraction signals
- a flat variant cluster exists without contract coverage
- a high-fanout node is actually orchestration over concrete variants
- C2C hotspot concentration exceeds threshold

### New Findings

- `FINDING_ABSTRACTION_DEFICIT_HIGH`
- `FINDING_CONCRETE_TO_CONCRETE_COUPLING`
- `FINDING_VARIANT_CLUSTER_WITHOUT_CONTRACT`

### New Proposal Type

Example:

- title: `Extract Core Abstraction for Payment Module`
- objective: create a stable contract before adding more concrete variants
- expected outcome: lower ADI, reduced C2C coupling, safer feature extension path

Suggested action text:

- extract interface or abstract base for sibling variants
- route selection through strategy / factory / policy capability
- reattach concrete implementations beneath the abstraction
- rerun `triadmind verify --strict` and confirm ADI improvement

Dream should still remain proposal-oriented.
It should not auto-refactor.

## Navigator Changes

Navigator should become abstraction-aware when preparing impact protocols.

### Rule Upgrade

When demand targets a structurally flat area:

- do not only append another concrete leaf
- propose the missing abstraction as part of the impact topology
- then place new concrete implementations under that abstraction

### Example

Demand:

- `add WechatPay`

If the existing area contains `StripePay` and `PaypalPay` but no strategy contract, Navigator should prefer:

- proposed contract node: `PaymentStrategy.execute`
- proposed selector / factory node if needed
- proposed concrete child node: `WechatPay.execute`
- modify or reuse existing call sites to point to the abstraction boundary

### Prompt Policy Upgrade

Update Navigator prompt rules to say:

- when extending multiple peer variants, prefer creating a reusable abstraction boundary first
- avoid direct concrete-to-concrete growth when a strategy/policy/provider pattern is implied
- proposed nodes may represent contracts, abstract bases, or strategy boundaries, not only executable leaves

This can be implemented without changing protocol operations.
`create_child` is enough for `v0.1` as long as the proposed node can carry abstraction evidence or role metadata.

## Visual and Artifact Changes

Impact map and visualizer should make abstract proposed nodes visually distinct from concrete proposed nodes.

Suggested distinction:

- proposed abstraction: dashed outline + contract badge
- proposed concrete implementation: dashed outline + implementation badge

This matters because the user should see that TriadMind is not just adding meat.
It is adding skeleton.

## Implementation Phases

### P0: Make Evidence First-Class

Files likely touched:

- `protocolRightBranch.ts`
- `protocol.ts`
- `artifactReaders.ts`
- `topologyQuality.ts`

Deliverables:

- formal schema for `fission.evidence`
- backward-compatible artifact reading
- tests proving evidence survives parse / verify / dream paths

### P1: Detect Abstraction Signals

Files likely touched:

- `treeSitterParser.ts`
- `typescriptParser.ts`
- `ir.ts`
- `analyzer.ts`

Deliverables:

- abstraction signal extraction for TypeScript
- per-module summaries
- initial hotspot detection

### P2: Verify and Dream Governance

Files likely touched:

- `verify.ts`
- `dream.ts`
- `tests/verify-command.test.ts`
- `tests/dream-command.test.ts`

Deliverables:

- ADI metrics in verify report
- new Dream findings and proposals
- threshold-driven failures for critical hotspots

### P3: Navigator Abstraction-First Impact

Files likely touched:

- `navigator.ts`
- `navigatorLlm.ts`
- `visualizer.ts`
- `tests/navigator-command.test.ts`

Deliverables:

- abstraction-aware prompt rules
- proposed contract nodes in impact protocol preview
- visual distinction between abstract and concrete proposed nodes

## Acceptance Criteria

- TriadMind can identify modules with many concrete implementations and zero abstraction signals.
- Verify fails or warns on structurally critical abstraction-deficit hotspots.
- Dream emits at least one abstraction-oriented proposal when flat variant clusters are detected.
- Navigator proposes abstract boundary nodes before adding new peer variants in flat extension zones.
- Artifact evidence remains backward-compatible and readable across sync, verify, dream, and navigate flows.

## v0.1 Heuristic Guardrails

To avoid overfitting or false purity pressure:

- do not punish small modules with one or two concrete functions
- do not require interfaces where no polymorphism or extension pressure exists
- favor repeated-variant and repeated-extension patterns over isolated style opinions
- prefer explainable hotspot reports over opaque scores

## One-Line Summary

TriadMind should evolve from "topology drift detector" into "abstraction governor" so AI-generated code grows with skeleton, not only flesh.
