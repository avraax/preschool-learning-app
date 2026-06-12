---
name: deploy
description: Deploy the app to production using the official deployment script
user-invocable: true
---

# Deploy to Production

Run the official deployment script which handles version bump, build, git commit/push, and Vercel deployment:

```powershell
.\deploy-with-version.ps1
```

## Steps

1. Run `.\deploy-with-version.ps1` from the project root
2. Monitor the output for any errors
3. Verify the deployment completed successfully by checking the version output
4. Report the new version number and production URL to the user

## Important

- This is the ONLY approved method for production deployments
- Never deploy manually with separate build/commit/push steps
- The script automatically increments the patch version
- Production URL: https://preschool-learning-app.vercel.app
