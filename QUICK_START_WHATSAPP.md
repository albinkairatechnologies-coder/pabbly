# 🚀 Quick Start: WhatsApp Business Cloud API Setup

## The Problem You're Facing

Meta shows error: **"The callback URL or verify token couldn't be validated"**

**Why?** Meta cannot reach `localhost` - you need a publicly accessible URL!

---

## ✅ Solution: Use ngrok (5 minutes setup)

### Step 1: Start Your Backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Keep this terminal running!

---

### Step 2: Test Locally (Optional)
Open new terminal:
```bash
# Run the test script
test-webhook.bat

# Or manually test:
curl http://localhost:8000/webhook/test
```

Should return: `{"status":"ok",...}`

---

### Step 3: Install & Run ngrok

**Download**: https://ngrok.com/download (Free, no credit card needed)

**Run ngrok** (in new terminal):
```bash
ngrok http 8000
```

You'll see:
```
Session Status    online
Forwarding        https://abc123.ngrok.io -> http://localhost:8000
```

**Copy the HTTPS URL**: `https://abc123.ngrok.io`

---

### Step 4: Test ngrok URL
```bash
curl https://abc123.ngrok.io/webhook/test
```

Should return: `{"status":"ok",...}`

---

### Step 5: Configure Meta Dashboard

1. Go to: https://developers.facebook.com
2. Select your app → **WhatsApp** → **Configuration**
3. Click **Edit** in Webhook section
4. Enter:

   **Callback URL**:
   ```
   https://abc123.ngrok.io/webhook/whatsapp
   ```
   (Replace `abc123` with your actual ngrok URL)

   **Verify Token**:
   ```
   flowwa-webhook-token-123
   ```

5. Click **Verify and Save**

6. Subscribe to fields:
   - ✅ messages
   - ✅ message_status

---

## ✅ Success!

You should see a green checkmark in Meta Dashboard!

Now you can:
- Receive WhatsApp messages in your FlowChat inbox
- Send messages from FlowChat
- Use automation flows

---

## 🔄 Important Notes

### ngrok Free Tier:
- ✅ Perfect for testing
- ⚠️ URL changes every time you restart ngrok
- ⚠️ Session expires after 2 hours (just restart)

### When URL Changes:
1. Get new ngrok URL
2. Update Callback URL in Meta Dashboard
3. Click Verify and Save again

### For Production:
Deploy to a real server with a domain:
- AWS, DigitalOcean, Heroku, etc.
- Use HTTPS (Let's Encrypt)
- Callback URL: `https://yourdomain.com/webhook/whatsapp`

---

## 🐛 Troubleshooting

### Error: "Connection refused"
- Backend not running → Start backend first
- Wrong port → Make sure backend is on port 8000

### Error: "Verification failed"
- Wrong verify token → Check `.env` file
- Token mismatch → Must be exactly: `flowwa-webhook-token-123`

### Error: "Cannot reach URL"
- Using localhost → Must use ngrok
- Using HTTP → Must use HTTPS
- ngrok not running → Start ngrok

### Check Backend Logs
You should see:
```
[WEBHOOK VERIFY] mode=subscribe, token=flowwa-webhook-token-123
[WEBHOOK VERIFY] ✅ Success - returning challenge
```

---

## 📞 Test Your Setup

After verification succeeds:

1. Send a WhatsApp message to your test number
2. Check FlowChat inbox
3. Message should appear!

---

## 🎯 Summary

```
1. Start backend (port 8000)
2. Start ngrok (ngrok http 8000)
3. Copy ngrok HTTPS URL
4. Paste in Meta Dashboard with verify token
5. Click Verify and Save
6. Done! ✅
```

---

**Need help?** Check `WEBHOOK_TROUBLESHOOTING.md` for detailed debugging steps.
