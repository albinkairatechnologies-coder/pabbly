# Setup ngrok for WhatsApp Webhook Testing

## Step 1: Install ngrok
Download from: https://ngrok.com/download

## Step 2: Start your backend
cd backend
# Make sure your FastAPI server is running on port 8000

## Step 3: Start ngrok
ngrok http 8000

## Step 4: Copy the HTTPS URL
You'll see something like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:8000
```

## Step 5: Use this as your Callback URL
Callback URL: https://abc123.ngrok.io/webhook/whatsapp
Verify Token: flowwa-webhook-token-123

## Important Notes:
- Use the HTTPS URL (not HTTP)
- Keep ngrok running while testing
- Free ngrok URLs change each time you restart
- For production, deploy to a real server
