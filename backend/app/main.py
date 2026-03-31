from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth, workspace, webhook, contacts, messages,
    flows, broadcasts, templates, analytics, billing, integrations, admin,
)

app = FastAPI(title="FlowWA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workspace.router)
app.include_router(webhook.router)
app.include_router(contacts.router)
app.include_router(messages.router)
app.include_router(flows.router)
app.include_router(broadcasts.router)
app.include_router(templates.router)
app.include_router(analytics.router)
app.include_router(billing.router)
app.include_router(integrations.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
