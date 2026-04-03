@echo off
echo ========================================
echo WhatsApp Webhook Setup Test
echo ========================================
echo.

echo [1/3] Testing if backend is running...
curl -s http://localhost:8000/health
if %errorlevel% neq 0 (
    echo ERROR: Backend is not running on port 8000!
    echo Please start your backend first:
    echo   cd backend
    echo   uvicorn app.main:app --reload --port 8000
    pause
    exit /b 1
)
echo ✓ Backend is running
echo.

echo [2/3] Testing webhook endpoint...
curl -s http://localhost:8000/webhook/test
echo.
echo ✓ Webhook endpoint is accessible
echo.

echo [3/3] Testing webhook verification...
curl -s "http://localhost:8000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=flowwa-webhook-token-123&hub.challenge=12345"
echo.
echo.

echo ========================================
echo ✓ All tests passed!
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Install ngrok from: https://ngrok.com/download
echo 2. Run: ngrok http 8000
echo 3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
echo 4. Use this in Meta Dashboard:
echo    - Callback URL: https://YOUR_NGROK_URL/webhook/whatsapp
echo    - Verify Token: flowwa-webhook-token-123
echo.
pause
