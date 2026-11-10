# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Uses the [SKILL.md](SKILL.md) vocabulary.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable: merge the modules and test through the new interface directly. No adapter needed.

### 2. Local-substitutable

Dependencies that have local test stand-ins (PGLite for Postgres, in-memory filesystem). Deepenable if the stand-in exists. The deepened module is tested with the stand-in running in the test suite. The seam is internal; no port at the module's external interface.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (microservices, internal APIs). Define a **port** (interface) at the seam. The deep module owns the logic; the transport is injected as an **adapter**. Tests use an in-memory adapter. Production uses an HTTP/gRPC/queue adapter.

Recommend: *"Define a port at the seam, an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module though deployed across a network."*

### 4. True external (Mock)

Third-party services (Stripe, Twilio, etc.) you don't control. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

## Seam discipline

- **Port only for two adapters.** Introduce a port when two adapters are justified (typically production + test); a single-adapter seam is indirection.
- **Keep internal seams internal.** Tests that use an internal seam do not justify exposing it through the interface.

## Testing strategy: replace, don't layer

- Write new tests at the deepened module's interface, asserting observable outcomes, not internal state.
- Delete the old unit tests on the shallow modules once those exist.
- A test that must change when the implementation changes is testing past the interface.
