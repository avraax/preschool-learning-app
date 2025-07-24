@echo off
echo 🎈 Børnelæring - Manual Production Deployment
echo ================================================

echo.
echo 📦 Building project...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)
echo ✅ Build successful

echo.
echo 🚀 Deploying to production...
call npx vercel --prod --yes
if %errorlevel% neq 0 (
    echo ❌ Deployment failed
    pause
    exit /b 1
)

echo.
echo 🌐 Production URL: https://preschool-learning-app.vercel.app/
echo 🎉 Deployment complete! The app is now live.
pause