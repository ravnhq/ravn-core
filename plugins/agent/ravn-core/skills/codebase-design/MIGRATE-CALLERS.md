# Migrate Callers Then Delete Legacy APIs

Adapted from pstack `principle-migrate-callers-then-delete-legacy-apis`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

When a new API replaces an old one, migrate every caller and delete the old API in the same refactor.

- Update tests to assert the new contract, and delete tests that only protect pre-refactor implementation details

**When this applies:**
- No external users depend on backward compatibility
- The project can absorb coordinated breaking changes
- The new API is part of a simplification or refactor initiative
