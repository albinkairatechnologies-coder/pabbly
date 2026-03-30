import httpx
from app.config import settings


class TwilioWhatsAppService:
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = f"whatsapp:{from_number}" if not from_number.startswith("whatsapp:") else from_number

    async def send_text(self, to: str, message: str) -> dict:
        to_wa = f"whatsapp:{to}" if not to.startswith("whatsapp:") else to
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        async with httpx.AsyncClient() as client:
            r = await client.post(url, data={"From": self.from_number, "To": to_wa, "Body": message},
                                  auth=(self.account_sid, self.auth_token), timeout=15)
            r.raise_for_status()
            return r.json()

    async def send_image(self, to: str, image_url: str, caption: str = "") -> dict:
        to_wa = f"whatsapp:{to}" if not to.startswith("whatsapp:") else to
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        async with httpx.AsyncClient() as client:
            r = await client.post(url, data={"From": self.from_number, "To": to_wa,
                                             "Body": caption, "MediaUrl": image_url},
                                  auth=(self.account_sid, self.auth_token), timeout=15)
            r.raise_for_status()
            return r.json()

    # Twilio sandbox doesn't support interactive messages — fallback to text
    async def send_interactive_buttons(self, to: str, body: str, buttons: list) -> dict:
        text = body + "\n" + "\n".join(f"{i+1}. {b['title']}" for i, b in enumerate(buttons))
        return await self.send_text(to, text)

    async def send_interactive_list(self, to: str, body: str, button_text: str, sections: list) -> dict:
        rows = [r for s in sections for r in s.get("rows", [])]
        text = body + "\n" + "\n".join(f"{i+1}. {r['title']}" for i, r in enumerate(rows))
        return await self.send_text(to, text)

    async def send_audio(self, to: str, audio_url: str) -> dict:
        return await self.send_image(to, audio_url, "")

    async def send_template(self, to: str, template_name: str, language: str, components: list) -> dict:
        return await self.send_text(to, f"[Template: {template_name}]")


class WhatsAppService:
    BASE_URL = f"https://graph.facebook.com/{settings.META_API_VERSION}"

    def __init__(self, access_token: str, phone_number_id: str):
        self.phone_number_id = phone_number_id
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def _post(self, payload: dict) -> dict:
        url = f"{self.BASE_URL}/{self.phone_number_id}/messages"
        async with httpx.AsyncClient() as client:
            r = await client.post(url, json=payload, headers=self.headers, timeout=15)
            r.raise_for_status()
            return r.json()

    def _base(self, to: str) -> dict:
        return {"messaging_product": "whatsapp", "recipient_type": "individual", "to": to}

    async def send_text(self, to: str, message: str) -> dict:
        return await self._post({**self._base(to), "type": "text", "text": {"body": message, "preview_url": False}})

    async def send_template(self, to: str, template_name: str, language: str, components: list) -> dict:
        return await self._post({
            **self._base(to),
            "type": "template",
            "template": {"name": template_name, "language": {"code": language}, "components": components},
        })

    async def send_image(self, to: str, image_url: str, caption: str = "") -> dict:
        return await self._post({**self._base(to), "type": "image", "image": {"link": image_url, "caption": caption}})

    async def send_document(self, to: str, doc_url: str, filename: str) -> dict:
        return await self._post({**self._base(to), "type": "document", "document": {"link": doc_url, "filename": filename}})

    async def send_audio(self, to: str, audio_url: str) -> dict:
        return await self._post({**self._base(to), "type": "audio", "audio": {"link": audio_url}})

    async def send_video(self, to: str, video_url: str, caption: str = "") -> dict:
        return await self._post({**self._base(to), "type": "video", "video": {"link": video_url, "caption": caption}})

    async def send_interactive_buttons(self, to: str, body: str, buttons: list[dict]) -> dict:
        return await self._post({
            **self._base(to),
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": b["id"], "title": b["title"]}}
                        for b in buttons
                    ]
                },
            },
        })

    async def send_interactive_list(self, to: str, body: str, button_text: str, sections: list) -> dict:
        return await self._post({
            **self._base(to),
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": {"text": body},
                "action": {"button": button_text, "sections": sections},
            },
        })

    async def send_location(self, to: str, lat: float, lng: float, name: str, address: str) -> dict:
        return await self._post({
            **self._base(to),
            "type": "location",
            "location": {"latitude": lat, "longitude": lng, "name": name, "address": address},
        })

    async def mark_as_read(self, message_id: str) -> dict:
        url = f"{self.BASE_URL}/{self.phone_number_id}/messages"
        async with httpx.AsyncClient() as client:
            r = await client.post(
                url,
                json={"messaging_product": "whatsapp", "status": "read", "message_id": message_id},
                headers=self.headers,
                timeout=10,
            )
            r.raise_for_status()
            return r.json()

    async def upload_media(self, file_bytes: bytes, mime_type: str) -> str:
        url = f"{self.BASE_URL}/{self.phone_number_id}/media"
        async with httpx.AsyncClient() as client:
            r = await client.post(
                url,
                files={"file": ("upload", file_bytes, mime_type)},
                data={"messaging_product": "whatsapp"},
                headers={"Authorization": self.headers["Authorization"]},
                timeout=30,
            )
            r.raise_for_status()
            return r.json()["id"]

    async def get_media_url(self, media_id: str) -> str:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE_URL}/{media_id}",
                headers=self.headers,
                timeout=10,
            )
            r.raise_for_status()
            return r.json()["url"]

    async def create_template(self, name: str, category: str, language: str, components: list) -> dict:
        url = f"{self.BASE_URL}/{settings.META_APP_ID}/message_templates"
        async with httpx.AsyncClient() as client:
            r = await client.post(
                url,
                json={"name": name, "category": category, "language": language, "components": components},
                headers=self.headers,
                timeout=15,
            )
            r.raise_for_status()
            return r.json()

    async def get_phone_number_info(self) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE_URL}/{self.phone_number_id}",
                headers=self.headers,
                timeout=10,
            )
            r.raise_for_status()
            return r.json()
