# WhatsApp Business Cloud API Setup Guide

## ✅ What's Been Implemented

Your FlowChat project now displays **Callback URL** and **Verify Token** automatically after you save your WhatsApp credentials - just like Pabbly!

---

## 🎯 User Flow

### Step 1: Enter WhatsApp Credentials in Settings
Users enter these three values in the Settings page:

1. **Phone Number ID**: `1106470769205346`
2. **WABA ID**: `1636924434397424`
3. **Access Token**: `EAAxxxxxxx...`

Then click **"Save Credentials"**

---

### Step 2: Webhook Configuration Appears
After saving, a beautiful blue section appears showing:

```
📋 Webhook Configuration
Copy these values to your Meta App Dashboard

┌─────────────────────────────────────────────────┐
│ Callback URL                                    │
│ https://yourdomain.com/webhook/whatsapp  [Copy] │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Verify Token                                    │
│ flowwa-webhook-token-123                 [Copy] │
└─────────────────────────────────────────────────┘

📌 Next Steps:
1. Go to Meta for Developers
2. Navigate to: Your App → WhatsApp → Configuration
3. Click Edit in the Webhook section
4. Paste the Callback URL and Verify Token above
5. Subscribe to webhook fields: messages, message_status
6. Click Verify and Save
```

---

## 🔧 Technical Implementation

### Backend Changes

**File**: `backend/app/routers/workspace.py`

Added new endpoint:
```python
@router.get("/{workspace_id}/whatsapp/webhook-config")
async def get_webhook_config(workspace_id: uuid.UUID, user: CurrentUser, db: DbDep):
    """Get webhook configuration for Meta WhatsApp setup"""
    from app.config import settings
    
    return {
        "callback_url": "/webhook/whatsapp",
        "verify_token": settings.META_WEBHOOK_VERIFY_TOKEN,
        "webhook_fields": ["messages", "message_status"],
    }
```

### Frontend Changes

**File**: `frontend/src/pages/Settings.tsx`

- Added `webhookConfig` state
- Fetches webhook config after saving credentials
- Displays beautiful webhook configuration section with copy buttons
- Only shows when `workspace.whatsapp_phone_number_id` exists

---

## 🚀 How to Use

### For Development (localhost)
If testing locally with ngrok:
```
Callback URL: https://your-ngrok-url.ngrok.io/webhook/whatsapp
Verify Token: flowwa-webhook-token-123
```

### For Production
```
Callback URL: https://yourdomain.com/webhook/whatsapp
Verify Token: flowwa-webhook-token-123
```

---

## 📝 Environment Variables

Make sure your `.env` file has:

```env
# Meta WhatsApp Cloud API
META_APP_ID=your_meta_app_id_here
META_APP_SECRET=your_meta_app_secret_here
META_WEBHOOK_VERIFY_TOKEN=flowwa-webhook-token-123
META_API_VERSION=v19.0
```

---

## 🎨 UI Features

- ✅ Gradient blue background (Pabbly-style)
- ✅ Copy buttons for both URL and Token
- ✅ Alert confirmation when copied
- ✅ Step-by-step instructions
- ✅ Only appears after credentials are saved
- ✅ Responsive design
- ✅ Professional look & feel

---

## 🔐 Security Note

The verify token (`flowwa-webhook-token-123`) is stored in your `.env` file and can be changed to any secure string you prefer. Just make sure to:

1. Update it in `.env`
2. Restart your backend
3. Copy the new token from the Settings page
4. Update it in Meta Dashboard

---

## 📞 Support

If you need to customize the webhook URL or token:
- Backend: `backend/app/config.py` → `META_WEBHOOK_VERIFY_TOKEN`
- Frontend: `frontend/src/pages/Settings.tsx` → webhook config section

---

**That's it! Your WhatsApp Business Cloud API setup is now complete! 🎉**
