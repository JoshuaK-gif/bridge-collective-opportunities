# Auth Middleware Review

**File:** `auth.js`

## Issues Found

### 1. Missing `jwt` import
`jwt` is used but never imported. Add:
```js
const jwt = require('jsonwebtoken');
```

### 2. No error handling around `jwt.verify`
If the token is expired, malformed, or tampered with, `jwt.verify` throws an error that will crash the server (or hit Express's default error handler). Wrap it in a `try/catch`:
```js
try {
  const user = jwt.verify(token, process.env.JWT_SECRET);
  req.user = user;
  next();
} catch (err) {
  return res.status(401).send('invalid token');
}
```

### 3. No `Bearer` prefix stripping
`Authorization` headers typically follow the format `Bearer <token>`. The code passes the full string (e.g. `"Bearer eyJhbG..."`) into `jwt.verify`, which will fail. Extract the token:
```js
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).send('unauthorized');
}
const token = authHeader.split(' ')[1];
```

### 4. Missing `return` on error branch
Without `return`, execution continues after `res.status(401).send(...)`, potentially triggering `next()` later or causing headers-sent errors. Add `return`.

### 5. No check for missing `JWT_SECRET`
If `process.env.JWT_SECRET` is undefined, `jwt.verify` will throw. Either validate it at startup or check it here.

### 6. Missing error parameter in `next()`
On auth failure, consider calling `next(err)` instead of directly sending the response. This lets a centralized error handler take over (depends on your app's pattern).

## Corrected Version

```js
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('unauthorized');
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).send('invalid token');
  }
}
```
