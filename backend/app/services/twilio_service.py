import httpx


class TwilioWhatsAppService:
    """
    Twilio WhatsApp Sandbox / Business API service.
    Uses Twilio Messaging API — compatible interface with WhatsAppService.
    """

    BASE_URL = "https://api.twilio.com/2010-04-01"

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        # Ensure number is in whatsapp: format
        self.from_number = from_number if from_number.startswith("whatsapp:") else f"whatsapp:{from_number}"
        self.messages_url = f"{self.BASE_URL}/Accounts/{account_sid}/Messages.json"

    def _to(self, number: str) -> str:
        return number if number.startswith("whatsapp:") else f"whatsapp:{number}"

    async def _post(self, to: str, body: str = "", media_url: str = "") -> dict:
        payload = {
            "From": self.from_number,
            "To": self._to(to),
            "Body": body,
        }
        if media_url:
            payload["MediaUrl"] = media_url

        async with httpx.AsyncClient() as client:
            r = await client.post(
                self.messages_url,
                data=payload,
                auth=(self.account_sid, self.auth_token),
                timeout=15,
            )
            r.raise_for_status()
            data = r.json()
            # Return in Meta-compatible format
            return {"messages": [{"id": data.get("sid", "")}]}

    async def send_text(self, to: str, message: str) -> dict:
        return await self._post(to, body=message)

    async def send_image(self, to: str, image_url: str, caption: str = "") -> dict:
        body = caption or " "
        return await self._post(to, body=body, media_url=image_url)

    async def send_audio(self, to: str, audio_url: str) -> dict:
        return await self._post(to, body=" ", media_url=audio_url)

    async def send_document(self, to: str, doc_url: str, filename: str = "") -> dict:
        return await self._post(to, body=filename or "Document", media_url=doc_url)

    async def send_video(self, to: str, video_url: str, caption: str = "") -> dict:
        return await self._post(to, body=caption or " ", media_url=video_url)

    async def send_template(self, to: str, template_name: str, language: str, components: list) -> dict:
        # Twilio uses Content Templates — send as plain text fallback
        body = f"[Template: {template_name}]"
        if components:
            params = []
            for comp in components:
                for p in comp.get("parameters", []):
                    params.append(p.get("text", ""))
            if params:
                body = " | ".join(params)
        return await self._post(to, body=body)

    async def send_interactive_buttons(self, to: str, body: str, buttons: list[dict]) -> dict:
        # Twilio sandbox doesn't support interactive — send as text with options
        btn_text = "\n".join([f"{i+1}. {b.get('title', b.get('id', ''))}" for i, b in enumerate(buttons)])
        return await self._post(to, body=f"{body}\n\n{btn_text}")

    async def send_interactive_list(self, to: str, body: str, button_text: str, sections: list) -> dict:
        lines = [body, ""]
        for section in sections:
            if section.get("title"):
                lines.append(f"*{section['title']}*")
            for row in section.get("rows", []):
                lines.append(f"• {row.get('title', '')}")
        return await self._post(to, body="\n".join(lines))

    async def send_location(self, to: str, lat: float, lng: float, name: str, address: str) -> dict:
        body = f"📍 {name}\n{address}\nhttps://maps.google.com/?q={lat},{lng}"
        return await self._post(to, body=body)

    async def mark_as_read(self, message_id: str) -> dict:
        return {}  # Twilio doesn't support read receipts via API

    async def get_phone_number_info(self) -> dict:
        """Test connection by fetching account info."""
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE_URL}/Accounts/{self.account_sid}.json",
                auth=(self.account_sid, self.auth_token),
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            return {
                "display_phone_number": self.from_number,
                "verified_name": data.get("friendly_name", "Twilio Account"),
                "status": data.get("status", "active"),
            }
