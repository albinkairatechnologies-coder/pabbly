"""
FlowWA Webhook Simulator
========================
Simulates WhatsApp Cloud API webhook payloads for local testing.
No real WhatsApp number needed.

Usage:
    python simulate.py setup          # register + get phone_number_id
    python simulate.py text "hello"   # send inbound text
    python simulate.py keyword "order" # trigger keyword flow
    python simulate.py button         # simulate button reply
    python simulate.py list           # simulate list reply
    python simulate.py image          # simulate image message
    python simulate.py status         # simulate delivery status update
    python simulate.py first          # simulate first message (new contact)
    python simulate.py all            # run all scenarios
"""

import sys
import uuid
import random
import requests

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL   = "http://localhost:8000"
# ⚠️  Use the SAME email/password you registered with on the frontend!
EMAIL      = "test@flowwa.com"    # <-- your frontend login email
PASSWORD   = "test1234"           # <-- your frontend login password
WORKSPACE  = "Test Workspace"     # only used if registering fresh
FROM_PHONE = "919876543210"       # fake sender number

# ── State (filled by setup) ───────────────────────────────────────────────────
TOKEN        = ""
WORKSPACE_ID = ""
PHONE_ID     = ""           # whatsapp_phone_number_id stored in workspace

# ── Helpers ───────────────────────────────────────────────────────────────────
def h():
    return {"Authorization": f"Bearer {TOKEN}"}

def wamid():
    return f"wamid.test_{uuid.uuid4().hex[:12]}"

def post_webhook(payload: dict):
    r = requests.post(f"{BASE_URL}/webhook/whatsapp", json=payload)
    print(f"  → {r.status_code} {r.text}")
    return r

def base_payload(messages: list, statuses: list = []):
    return {
        "entry": [{
            "changes": [{
                "value": {
                    "metadata": {"phone_number_id": PHONE_ID},
                    "contacts": [{"profile": {"name": "Test User"}}],
                    "messages": messages,
                    "statuses": statuses,
                }
            }]
        }]
    }

# ── Setup ─────────────────────────────────────────────────────────────────────
def setup():
    global TOKEN, WORKSPACE_ID, PHONE_ID

    print("\n[1] Registering / logging in...")
    # Try register first
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Test User",
        "email": EMAIL,
        "password": PASSWORD,
        "workspace_name": WORKSPACE,
    })
    if r.status_code not in (200, 201):
        # Already exists — login
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})

    data = r.json()
    TOKEN        = data["access_token"]
    WORKSPACE_ID = data["workspace"]["id"]
    print(f"  ✓ Token: {TOKEN[:30]}...")
    print(f"  ✓ Workspace ID: {WORKSPACE_ID}")

    print("\n[2] Setting fake phone_number_id on workspace...")
    PHONE_ID = "test_phone_" + uuid.uuid4().hex[:8]
    r = requests.put(
        f"{BASE_URL}/workspaces/{WORKSPACE_ID}/whatsapp",
        json={
            "phone_number_id": PHONE_ID,
            "access_token": "fake_token_for_testing",
            "business_account_id": "fake_waba_id",
        },
        headers=h(),
    )
    print(f"  → {r.status_code} {r.text[:80]}")

    print(f"  ✓ Phone Number ID: {PHONE_ID}")
    _save_state()
    print("\n✅ Setup complete! Run: python simulate.py text hello\n")

def _save_state():
    with open(".sim_state", "w") as f:
        f.write(f"{TOKEN}\n{WORKSPACE_ID}\n{PHONE_ID}\n")

def _load_state():
    global TOKEN, WORKSPACE_ID, PHONE_ID
    try:
        lines = open(".sim_state").read().strip().splitlines()
        TOKEN, WORKSPACE_ID, PHONE_ID = lines[0], lines[1], lines[2]
        print(f"  ✓ Loaded state — workspace: {WORKSPACE_ID[:8]}... phone_id: {PHONE_ID}")
    except Exception:
        print("  ✗ No state found. Run: python simulate.py setup")
        sys.exit(1)

# ── Scenarios ─────────────────────────────────────────────────────────────────
def sim_text(body: str = "hello"):
    print(f"\n[TEXT] Sending: '{body}'")
    post_webhook(base_payload([{
        "from": FROM_PHONE,
        "id": wamid(),
        "type": "text",
        "text": {"body": body},
    }]))

def sim_first():
    phone = f"91{random.randint(7000000000, 9999999999)}"
    print(f"\n[FIRST MESSAGE] New contact: {phone}")
    post_webhook({
        "entry": [{
            "changes": [{
                "value": {
                    "metadata": {"phone_number_id": PHONE_ID},
                    "contacts": [{"profile": {"name": "New Customer"}}],
                    "messages": [{
                        "from": phone,
                        "id": wamid(),
                        "type": "text",
                        "text": {"body": "Hi"},
                    }],
                    "statuses": [],
                }
            }]
        }]
    })

def sim_button():
    print("\n[BUTTON REPLY] Simulating button click")
    post_webhook(base_payload([{
        "from": FROM_PHONE,
        "id": wamid(),
        "type": "interactive",
        "interactive": {
            "type": "button_reply",
            "button_reply": {"id": "btn_yes", "title": "Yes, confirm"},
        },
    }]))

def sim_list():
    print("\n[LIST REPLY] Simulating list selection")
    post_webhook(base_payload([{
        "from": FROM_PHONE,
        "id": wamid(),
        "type": "interactive",
        "interactive": {
            "type": "list_reply",
            "list_reply": {"id": "item_track", "title": "Track Order"},
        },
    }]))

def sim_image():
    print("\n[IMAGE] Simulating image message")
    post_webhook(base_payload([{
        "from": FROM_PHONE,
        "id": wamid(),
        "type": "image",
        "image": {
            "id": "img_" + uuid.uuid4().hex[:8],
            "mime_type": "image/jpeg",
            "caption": "Check this out",
            "sha256": "abc123",
        },
    }]))

def sim_status():
    print("\n[STATUS] Simulating delivered + read updates")
    mid = wamid()
    # delivered
    post_webhook(base_payload([], [{
        "id": mid, "status": "delivered",
        "timestamp": "1700000000", "recipient_id": FROM_PHONE,
    }]))
    # read
    post_webhook(base_payload([], [{
        "id": mid, "status": "read",
        "timestamp": "1700000010", "recipient_id": FROM_PHONE,
    }]))

def sim_keyword(kw: str = "order"):
    print(f"\n[KEYWORD] Sending keyword: '{kw}'")
    post_webhook(base_payload([{
        "from": FROM_PHONE,
        "id": wamid(),
        "type": "text",
        "text": {"body": kw},
    }]))

# ── Main ──────────────────────────────────────────────────────────────────────
COMMANDS = {
    "text":    lambda: sim_text(sys.argv[2] if len(sys.argv) > 2 else "hello"),
    "keyword": lambda: sim_keyword(sys.argv[2] if len(sys.argv) > 2 else "order"),
    "first":   sim_first,
    "button":  sim_button,
    "list":    sim_list,
    "image":   sim_image,
    "status":  sim_status,
    "all": lambda: [sim_first(), sim_text("hello"), sim_keyword("order"),
                    sim_button(), sim_list(), sim_image(), sim_status()],
}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd == "setup":
        setup()
    elif cmd in COMMANDS:
        _load_state()
        COMMANDS[cmd]()
    else:
        print(__doc__)
