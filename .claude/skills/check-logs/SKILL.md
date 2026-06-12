---
name: check-logs
description: Check production error logs from the deployed app
user-invocable: true
---

# Check Production Logs

Fetch and analyze production logs from the deployed app.

## Default: Recent Errors

```bash
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=50&level=error"
```

## With Arguments

The user may provide filters as arguments. Map them to query parameters:

- **device filter**: `?device=iPad`, `?device=iPhone`
- **level filter**: `?level=error`, `?level=warn`, `?level=info`
- **count**: `?limit=100`, `?limit=200`
- **search term**: Pipe output through `grep -i "<term>"`

## Examples

```bash
# iPad errors only
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=50&device=iPad&level=error"

# All recent logs
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=200" | head -200

# Search for audio issues
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=200" | grep -i "audio"
```

## Important

- ALWAYS use curl/Bash — never use WebFetch for this endpoint
- The endpoint returns ALL log types despite being named "log-error"
- Pipe through `head` for manageable output on large result sets
- Summarize findings for the user, highlighting critical errors
