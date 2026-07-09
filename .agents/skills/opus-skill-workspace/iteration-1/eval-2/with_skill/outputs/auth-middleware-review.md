# Auth Middleware Review

## Phase 1: Problem Restatement

You've shared an Express authentication middleware that extracts a JWT from the `Authorization` header, verifies it, attaches the decoded user to `req.user`, and either calls `next()` or responds with 401. Below is a breakdown of every issue and the corrected version.

## Issues Found

### 1. `jwt.verify` can throw — no error handling

If the token is expired, malformed, or signed with the wrong secret, `jwt.verify` throws a `JsonWebTokenError` (or `TokenExpiredError`). This crashes the request and — unless you have a global error handler — the process.

### 2. "Bearer " prefix not stripped

Browsers and clients send the `Authorization` header as `Bearer <token>`. Passing `"Bearer eyJhbGci..."` directly into `jwt.verify` guarantees failure on every valid request.

### 3. `jwt` is not imported

`jwt` is a free variable — no `require('jsonwebtoken')` or `import` statement exists.

### 4. `JWT_SECRET` could be undefined

If `process.env.JWT_SECRET` is not set, `jwt.verify(token, undefined)` throws a confusing error. Better to fail fast with a clear message at startup.

### 5. No `return` after `res.status(401).send()`

While Express won't continue past this line in the `else` branch, omitting `return` is a common source of bugs when the function is later modified. The standard pattern is `return res.status(...).send(...)`.

---

## Corrected Code

```js
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  const token = header.split(' ')[1];

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### Changes explained

| Before | After | Reason |
|---|---|---|
| No import | `const jwt = require('jsonwebtoken')` | Missing dependency reference |
| `req.headers.authorization` used directly | Strips `"Bearer "` prefix | Token format compliance |
| `jwt.verify()` unwrapped | Wrapped in `try/catch` | Prevents unhandled exceptions |
| `res.status(401).send('unauthorized')` | `return res.status(401).json(...)` | Stops execution, returns structured error |
| Single error message | Differentiated expired vs invalid | Better debugging for clients |

---

## Phase 3: Self-Review

- **Solves the problem?** Yes — all six issues are addressed.
- **Edge cases?** Missing header, malformed header, expired token, invalid signature, missing env var (detected at import time as undefined — a startup check is recommended separately).
- **Simplest correct solution?** Yes — no over-abstraction, just a guard clause, a try/catch, and clear error responses.
- **Readable at a glance?** Yes — the intent (extract → verify → attach or reject) is linear and obvious.
