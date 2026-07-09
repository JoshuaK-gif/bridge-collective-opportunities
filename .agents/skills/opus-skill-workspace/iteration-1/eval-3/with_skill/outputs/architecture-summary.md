# Architecture Summary

The original monolithic `processUserData` function mixed three concerns: fetching, transforming, and storing. The refactored code separates these into four distinct layers.

## Files / Modules (in dependency order)

| Module | Responsibility |
|---|---|
| `types.ts` | Defines `RawUser` (API shape) and `StoredUser` (persisted shape) so every function speaks a typed contract. |
| `api.ts` | Pure I/O — fetches the raw payload and validates the HTTP response. No business logic. |
| `transform.ts` | Pure logic — maps `RawUser → StoredUser`. No side effects. Easy to unit-test. |
| `storage.ts` | Pure I/O — writes the formatted object to disk. No business logic. |
| `processUser.ts` | Orchestrator — composes the three steps while keeping the same public signature. |

## What changed and why

| Original problem | Fix |
|---|---|
| Fetch, transform, store in one function | Each concern extracted into its own module |
| No types — fragile property access | `RawUser` and `StoredUser` interfaces enforce structure at compile time |
| `age` computed twice (duplicated logic) | `computeAge()` extracted; result reused |
| `email` silently becomes `undefined` if missing | Explicit `?? null` so the stored field is always `string \| null` |
| No HTTP error handling | `response.ok` check before parsing JSON |
| `fs.writeFile` — raw `./users/` path | `node:path` for cross-platform safety; `node:fs/promises` for modern Promise API |
| No return value from the orchestrator | Returns the `StoredUser` so callers can use the result |

## Alternatives considered

- **Class-based service** — rejected; there's no mutable state to encapsulate, so free functions are simpler and compose better.
- **Validation library (Zod)** — not pulled in because the API shape is simple and stable; a plain type assertion keeps the dependency free. If validation needs grow, Zod would be the next step.
- **Repository pattern** — overkill for writing a single JSON file; a `writeUser` function is enough. Would revisit if storage backed by a DB or S3.
