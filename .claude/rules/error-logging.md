---
description: Production error logging and debugging rules
---

# Error Logging Rules

## Production Log Endpoint

```
https://preschool-learning-app.vercel.app/api/log-error
```

Retrieves ALL log types (errors, warnings, info, logs) despite the endpoint name.

## ALWAYS Use curl/Bash — NOT WebFetch

WebFetch may fail to parse large JSON responses.

```bash
# Recent iPad errors
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=50&device=iPad&level=error"

# All recent logs
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=200" | head -200

# Search for specific terms
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=200" | grep -i "audio"
```

## Query Parameters

| Param    | Description                          | Default |
|----------|--------------------------------------|---------|
| `limit`  | Number of logs to return             | 50      |
| `level`  | Filter: `error`, `warn`, `info`, `log` | all  |
| `device` | Filter: `iPad`, `iPhone`, etc.       | all     |
| `since`  | ISO date string                      | —       |

## Audio Debugging

- Audio issues must be fixed in `SimplifiedAudioController`, not in components
- Check console for `SimplifiedAudioController` prefixed logs
- Verify components use `useSimplifiedAudio()` hook
- Check navigation cleanup logs
