# 🔧 WhatsApp Webhook Verification Troubleshooting

## Error: "The callback URL or verify token couldn't be validated"

This means Meta cannot reach your webhook endpoint. Follow these steps:

---

## ✅ Step 1: Test Your Webhook Locally

Open your browser or use curl:

```bash
# Test if webhook endpoint is accessible
curl http://localhost:8000/webhook/test

# Should return:
# {"status":"ok","message":"Webhook endpoint is accessible","verify_token":"flowwa-webhook-token-123"}
```

If this doesn't work, your backend is not running!

---

## ✅ Step 2: Make Your Localhost Publicly Accessible

### Option A: Use ngrok (Recommended for Testing)

1. **Download ngrok**: https://ngrok.com/download

2. **Start your backend**:
   ```bash
   cd backend
   # Make sure FastAPI is running on port 8000
   ```

3. **Start ngrok in a new terminal**:
   ```bash
   ngrok http 8000
   ```

4. **Copy the HTTPS URL**:
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:8000
   ```

5. **Test ngrok URL**:
   ```bash
   curl https://abc123.ngrok.io/webhook/test
   ```

6. **Use in Meta Dashboard**:
   - Callback URL: `https://abc123.ngrok.io/webhook/whatsapp`
   - Verify Token: `flowwa-webhook-token-123`

---

## ✅ Step 3: Verify Your .env File

Check `backend/.env`:

```env
META_WEBHOOK_VERIFY_TOKEN=flowwa-webhook-token-123
```

**IMPORTANT**: 
- No spaces around the `=`
- No quotes around the value
- Must match exactly what you enter in Meta Dashboard

---

## ✅ Step 4: Test Webhook Verification Manually

Test the exact URL Meta will call:

```bash
# Replace YOUR_NGROK_URL with your actual ngrok URL
curl "https://YOUR_NGROK_URL.ngrok.io/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=flowwa-webhook-token-123&hub.challenge=12345"

# Should return: 12345
```

If this returns `12345`, your webhook is working correctly!

---

## ✅ Step 5: Configure Meta Dashboard

1. Go to: https://developers.facebook.com
2. Select your app
3. Go to: **WhatsApp → Configuration**
4. Click **Edit** in Webhook section
5. Enter:
   - **Callback URL**: `https://YOUR_NGROK_URL.ngrok.io/webhook/whatsapp`
   - **Verify Token**: `flowwa-webhook-token-123`
6. Click **Verify and Save**

---

## 🚨 Common Issues

### Issue 1: "localhost" in Callback URL
❌ **Wrong**: `http://localhost:8000/webhook/whatsapp`
✅ **Correct**: `https://abc123.ngrok.io/webhook/whatsapp`

Meta cannot reach localhost!

### Issue 2: HTTP instead of HTTPS
❌ **Wrong**: `http://abc123.ngrok.io/webhook/whatsapp`
✅ **Correct**: `https://abc123.ngrok.io/webhook/whatsapp`

Meta requires HTTPS!

### Issue 3: Wrong Verify Token
Make sure the token in `.env` matches exactly what you enter in Meta Dashboard.

### Issue 4: Backend Not Running
Make sure your FastAPI server is running:
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Issue 5: CORS Issues
Your backend already has CORS enabled in `main.py`, so this shouldn't be an issue.

### Issue 6: Firewall Blocking
If using a VPS/server, make sure port 8000 is open:
```bash
# Check if port is listening
netstat -tuln | grep 8000
```

---

## 🧪 Debug Mode

Check your backend logs when Meta tries to verify:

```bash
# You should see:
[WEBHOOK VERIFY] mode=subscribe, token=flowwa-webhook-token-123, challenge=12345
[WEBHOOK VERIFY] Expected token: flowwa-webhook-token-123
[WEBHOOK VERIFY] ✅ Success - returning challenge
```

If you see:
```bash
[WEBHOOK VERIFY] ❌ Failed - token mismatch or invalid mode
```

Then your verify token doesn't match!

---

## 📱 For Production Deployment

When deploying to production (not localhost):

1. Deploy to a server with a domain (e.g., AWS, DigitalOcean, Heroku)
2. Set up HTTPS (use Let's Encrypt)
3. Update Callback URL to: `https://yourdomain.com/webhook/whatsapp`
4. Keep the same Verify Token

---

## 🆘 Still Not Working?

1. **Check backend logs** for errors
2. **Test the /webhook/test endpoint** first
3. **Verify ngrok is running** and not expired
4. **Try a different verify token** (update both .env and Meta Dashboard)
5. **Restart your backend** after changing .env

---

## ✅ Success Checklist

- [ ] Backend is running on port 8000
- [ ] `/webhook/test` returns success
- [ ] ngrok is running and showing HTTPS URL
- [ ] Callback URL uses HTTPS (not HTTP)
- [ ] Callback URL is publicly accessible (not localhost)
- [ ] Verify Token matches exactly in .env and Meta Dashboard
- [ ] Backend logs show verification attempt
- [ ] Meta Dashboard shows green checkmark after verification

---

**Once verified, you're ready to receive WhatsApp messages! 🎉**
