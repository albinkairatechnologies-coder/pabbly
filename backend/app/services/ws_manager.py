import json
import uuid
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # workspace_id -> list of active WebSocket connections
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, workspace_id: uuid.UUID, ws: WebSocket):
        await ws.accept()
        key = str(workspace_id)
        self._connections.setdefault(key, []).append(ws)

    def disconnect(self, workspace_id: uuid.UUID, ws: WebSocket):
        key = str(workspace_id)
        conns = self._connections.get(key, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, workspace_id: uuid.UUID, payload: dict):
        key = str(workspace_id)
        dead = []
        for ws in self._connections.get(key, []):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(workspace_id, ws)


manager = ConnectionManager()
