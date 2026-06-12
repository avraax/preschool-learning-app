---
description: Production deployment rules
---

# Deployment Rules

## Production: ONLY Use the Official Script

```powershell
.\deploy-with-version.ps1
```

This script handles everything:
1. Version bump (patch increment)
2. TypeScript compile + Vite build
3. Git commit and push
4. Vercel production deployment
5. Verification that new version is live

## Never Deploy Manually

Do NOT use manual steps for production:
- No direct `npm run build` + `git commit` + `git push`
- No manual `npx vercel --prod`

## Development Only

- `npm run dev` — local dev server (http://localhost:5173)
- `npm run build` — local build testing
- `npm run preview` — preview production build locally
