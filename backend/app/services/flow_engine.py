import re
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.flow import Flow, FlowRun, FlowRunLog, FlowRunStatus
from app.models.message import (
    Conversation, ConversationStatus, Message,
    MessageDirection, MessageStatus, MessageType,
)
from app.models.workspace import Workspace
from app.services.whatsapp import WhatsAppService, TwilioWhatsAppService

# All trigger node types (just pass through to next node)
TRIGGER_TYPES = {
    "trigger", "trigger_keyword", "trigger_first", "trigger_optin",
    "trigger_button", "trigger_list", "trigger_schedule", "trigger_webhook",
    "keyword_trigger", "webhook_trigger", "opt_in_trigger",
    "first_message_trigger", "api_trigger",
}


class FlowEngine:
    def __init__(self, db: AsyncSession, workspace: Workspace):
        self.db = db
        self.workspace = workspace

    # ── Public API ────────────────────────────────────────────────────────────

    async def trigger_flow(self, flow_id: uuid.UUID, contact_id: uuid.UUID,
                           context: dict, workspace_id: uuid.UUID) -> FlowRun:
        flow_result = await self.db.execute(select(Flow).where(Flow.id == flow_id))
        flow = flow_result.scalar_one_or_none()
        if not flow or not flow.is_active:
            raise ValueError("Flow not found or inactive")

        now = datetime.now(timezone.utc).isoformat()
        run = FlowRun(
            flow_id=flow_id, workspace_id=workspace_id, contact_id=contact_id,
            status=FlowRunStatus.running, context=context, started_at=now,
        )
        self.db.add(run)
        await self.db.flush()

        flow.total_runs = (flow.total_runs or 0) + 1
        flow.last_run_at = now

        start_node = self._find_start_node(flow.nodes)
        if not start_node:
            run.status = FlowRunStatus.failed
            await self.db.commit()
            return run

        await self._execute_from_node(run, flow, start_node["id"], context)
        await self.db.commit()
        return run

    async def resume_flow(self, flow_run_id: uuid.UUID, trigger_data: dict):
        run_result = await self.db.execute(select(FlowRun).where(FlowRun.id == flow_run_id))
        run = run_result.scalar_one_or_none()
        if not run or run.status != FlowRunStatus.waiting:
            return

        flow_result = await self.db.execute(select(Flow).where(Flow.id == run.flow_id))
        flow = flow_result.scalar_one_or_none()
        if not flow:
            return

        context = {**run.context, **trigger_data}

        # If wait_for_reply had a save_to variable, store the message
        nodes_map = {n["id"]: n for n in (flow.nodes or [])}
        waiting_node = nodes_map.get(run.current_node_id or "")
        if waiting_node:
            save_to = waiting_node.get("data", {}).get("save_to", "")
            if save_to and trigger_data.get("message"):
                context[f"flow.{save_to}"] = trigger_data["message"]
                context[save_to] = trigger_data["message"]

        run.context = context
        run.status = FlowRunStatus.running

        next_node_id = self._get_next_node(flow.edges, run.current_node_id)
        if next_node_id:
            await self._execute_from_node(run, flow, next_node_id, context)
        else:
            run.status = FlowRunStatus.completed
            run.completed_at = datetime.now(timezone.utc).isoformat()

        await self.db.commit()

    # ── Internal execution ────────────────────────────────────────────────────

    async def _execute_from_node(self, run: FlowRun, flow: Flow, node_id: str, context: dict):
        nodes_map = {n["id"]: n for n in (flow.nodes or [])}
        current_id = node_id

        while current_id:
            node = nodes_map.get(current_id)
            if not node:
                break

            run.current_node_id = current_id
            next_id = await self._execute_node(run, flow, node, context)

            if next_id is None:
                if run.status == FlowRunStatus.running:
                    run.status = FlowRunStatus.completed
                    run.completed_at = datetime.now(timezone.utc).isoformat()
                break

            current_id = next_id

    async def _execute_node(self, run: FlowRun, flow: Flow, node: dict, context: dict) -> str | None:
        node_type = node.get("type", "")
        node_data = node.get("data", {})
        now = datetime.now(timezone.utc).isoformat()

        log = FlowRunLog(
            flow_run_id=run.id, node_id=node["id"], node_type=node_type,
            status="running", input={"node_data": node_data, "context": context},
            executed_at=now,
        )
        self.db.add(log)
        await self.db.flush()

        try:
            next_node_id = await self._dispatch_node(run, flow, node, node_data, context)
            log.status = "completed"
            log.output = {"next_node_id": next_node_id}
            return next_node_id
        except Exception as e:
            log.status = "failed"
            log.error = str(e)
            run.status = FlowRunStatus.failed
            run.completed_at = datetime.now(timezone.utc).isoformat()
            return None

    async def _dispatch_node(self, run: FlowRun, flow: Flow, node: dict, data: dict, context: dict) -> str | None:
        t = node.get("type", "")
        nid = node["id"]

        # ── Triggers (pass through) ───────────────────────────────────────────
        if t in TRIGGER_TYPES:
            return self._get_next_node(flow.edges, nid)

        # ── Send Text ─────────────────────────────────────────────────────────
        if t == "send_message":
            text = await self.resolve_variables(data.get("message", ""), context)
            await self._send_text(run.contact_id, text)
            return self._get_next_node(flow.edges, nid)

        # ── Send Image ────────────────────────────────────────────────────────
        if t == "send_image":
            url = await self.resolve_variables(data.get("image_url", ""), context)
            caption = await self.resolve_variables(data.get("caption", ""), context)
            if url:
                wa = self._get_wa()
                contact = await self._get_contact(run.contact_id)
                await wa.send_image(contact.phone_number, url, caption)
                await self._save_outbound_message(run.contact_id, MessageType.image, {"url": url, "caption": caption})
            return self._get_next_node(flow.edges, nid)

        # ── Send Audio ────────────────────────────────────────────────────────
        if t == "send_audio":
            url = await self.resolve_variables(data.get("audio_url", ""), context)
            if url:
                wa = self._get_wa()
                contact = await self._get_contact(run.contact_id)
                await wa.send_audio(contact.phone_number, url)
                await self._save_outbound_message(run.contact_id, MessageType.audio, {"url": url})
            return self._get_next_node(flow.edges, nid)

        # ── Send Buttons ──────────────────────────────────────────────────────
        if t == "send_buttons":
            body = await self.resolve_variables(data.get("body", ""), context)
            raw_buttons = data.get("buttons", [])
            # Convert list of strings to WhatsApp button format
            buttons = [{"id": f"btn_{i}", "title": str(b)[:20]} for i, b in enumerate(raw_buttons) if b]
            if buttons:
                wa = self._get_wa()
                contact = await self._get_contact(run.contact_id)
                await wa.send_interactive_buttons(contact.phone_number, body, buttons)
                await self._save_outbound_message(run.contact_id, MessageType.interactive, {"body": body, "buttons": buttons})
            return self._get_next_node(flow.edges, nid)

        # ── Send List Menu ────────────────────────────────────────────────────
        if t == "send_list":
            body = await self.resolve_variables(data.get("body", ""), context)
            button_text = data.get("button_text", "Select")
            section_title = data.get("section_title", "Options")
            items_raw = data.get("items_raw", "")
            # Parse "id|title" format
            rows = []
            for line in items_raw.strip().split("\n"):
                if "|" in line:
                    item_id, title = line.split("|", 1)
                    rows.append({"id": item_id.strip(), "title": title.strip()[:24]})
            if rows:
                sections = [{"title": section_title, "rows": rows}]
                wa = self._get_wa()
                contact = await self._get_contact(run.contact_id)
                await wa.send_interactive_list(contact.phone_number, body, button_text, sections)
                await self._save_outbound_message(run.contact_id, MessageType.interactive, {"body": body, "sections": sections})
            return self._get_next_node(flow.edges, nid)

        # ── Send Template ─────────────────────────────────────────────────────
        if t == "send_template":
            template_name = data.get("template_name", "")
            language = data.get("language", "en")
            # Parse variables_raw: "{{1}}=value\n{{2}}=value2"
            variables_raw = data.get("variables_raw", "")
            components = []
            if variables_raw:
                params = []
                for line in variables_raw.strip().split("\n"):
                    if "=" in line:
                        _, val = line.split("=", 1)
                        resolved = await self.resolve_variables(val.strip(), context)
                        params.append({"type": "text", "text": resolved})
                if params:
                    components = [{"type": "body", "parameters": params}]
            if template_name:
                wa = self._get_wa()
                contact = await self._get_contact(run.contact_id)
                await wa.send_template(contact.phone_number, template_name, language, components)
                await self._save_outbound_message(run.contact_id, MessageType.template, {"template_name": template_name})
            return self._get_next_node(flow.edges, nid)

        # ── Wait for Reply ────────────────────────────────────────────────────
        if t == "wait_for_reply":
            run.status = FlowRunStatus.waiting
            run.current_node_id = nid
            timeout_minutes = int(data.get("timeout_minutes", 0))
            if timeout_minutes > 0:
                from app.tasks.flow_tasks import execute_flow_delay
                execute_flow_delay.apply_async(args=[str(run.id)], countdown=timeout_minutes * 60)
            return None

        # ── Wait / Delay ──────────────────────────────────────────────────────
        if t == "wait":
            duration = int(data.get("duration", 1))
            unit = data.get("unit", "minutes")
            seconds = duration * {"minutes": 60, "hours": 3600, "days": 86400}.get(unit, 60)
            run.status = FlowRunStatus.waiting
            run.current_node_id = nid
            from app.tasks.flow_tasks import execute_flow_delay
            execute_flow_delay.apply_async(args=[str(run.id)], countdown=seconds)
            return None

        # ── Condition ─────────────────────────────────────────────────────────
        if t == "condition":
            result = await self.evaluate_condition(data, context)
            return self._get_next_node(flow.edges, nid, handle="true" if result else "false")

        # ── A/B Split ─────────────────────────────────────────────────────────
        if t == "ab_split":
            import random
            pct = int(data.get("split_percent", 50))
            branch = "a" if random.randint(1, 100) <= pct else "b"
            return self._get_next_node(flow.edges, nid, handle=branch)

        # ── Add Tag ───────────────────────────────────────────────────────────
        if t == "add_tag":
            tag = data.get("tag", "").strip()
            if tag:
                contact = await self._get_contact(run.contact_id)
                tags = list(contact.tags or [])
                if tag not in tags:
                    tags.append(tag)
                    contact.tags = tags
            return self._get_next_node(flow.edges, nid)

        # ── Remove Tag ────────────────────────────────────────────────────────
        if t == "remove_tag":
            tag = data.get("tag", "").strip()
            if tag:
                contact = await self._get_contact(run.contact_id)
                contact.tags = [x for x in (contact.tags or []) if x != tag]
            return self._get_next_node(flow.edges, nid)

        # ── Update Contact ────────────────────────────────────────────────────
        if t == "update_contact":
            contact = await self._get_contact(run.contact_id)
            field = data.get("field", "")
            value = await self.resolve_variables(data.get("value", ""), context)
            if field and hasattr(contact, field):
                setattr(contact, field, value)
            elif field == "custom_field":
                cf = dict(contact.custom_fields or {})
                cf[data.get("custom_key", "value")] = value
                contact.custom_fields = cf
            return self._get_next_node(flow.edges, nid)

        # ── Assign Agent ──────────────────────────────────────────────────────
        if t == "assign_agent":
            from app.models.user import User
            agent_email = data.get("agent_email", "")
            if agent_email:
                agent_result = await self.db.execute(select(User).where(User.email == agent_email))
                agent = agent_result.scalar_one_or_none()
                if agent:
                    conv = await self._get_or_create_conversation(run.contact_id)
                    conv.assigned_to = agent.id
            return self._get_next_node(flow.edges, nid)

        # ── Resolve Conversation ──────────────────────────────────────────────
        if t == "resolve_conversation":
            conv = await self._get_or_create_conversation(run.contact_id)
            conv.status = ConversationStatus.resolved
            return self._get_next_node(flow.edges, nid)

        # ── HTTP Request ──────────────────────────────────────────────────────
        if t == "action":
            url = data.get("url", "")
            method = data.get("method", "POST").upper()
            body_raw = data.get("body", "")
            save_to = data.get("save_to", "")
            if url:
                try:
                    body_resolved = await self.resolve_variables(body_raw, context)
                    import json as _json
                    try:
                        payload = _json.loads(body_resolved)
                    except Exception:
                        payload = {}
                    async with httpx.AsyncClient(timeout=15) as client:
                        resp = await client.request(method, url, json=payload)
                        resp_data = resp.json() if "json" in resp.headers.get("content-type", "") else resp.text
                        if save_to:
                            context[save_to] = resp_data
                            context[f"flow.{save_to}"] = resp_data
                            run.context = context
                except Exception as e:
                    context["http_error"] = str(e)
            return self._get_next_node(flow.edges, nid)

        # ── Send Email ────────────────────────────────────────────────────────
        if t == "send_email":
            to = await self.resolve_variables(data.get("email_to", ""), context)
            subject = await self.resolve_variables(data.get("subject", "FlowWA Notification"), context)
            body = await self.resolve_variables(data.get("email_body", ""), context)
            if to and body:
                try:
                    import smtplib
                    from email.mime.text import MIMEText
                    from app.config import settings
                    if hasattr(settings, "SMTP_HOST") and settings.SMTP_HOST:
                        msg = MIMEText(body)
                        msg["Subject"] = subject
                        msg["From"] = settings.SMTP_FROM
                        msg["To"] = to
                        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as s:
                            if settings.SMTP_TLS:
                                s.starttls()
                            s.login(settings.SMTP_USER, settings.SMTP_PASS)
                            s.send_message(msg)
                except Exception:
                    pass  # Email is best-effort
            return self._get_next_node(flow.edges, nid)

        # ── Google Sheets ─────────────────────────────────────────────────────
        if t == "google_sheets":
            # Placeholder — requires OAuth2 setup
            # Logs the attempt for now
            pass
            return self._get_next_node(flow.edges, nid)

        # ── Jump to Flow ──────────────────────────────────────────────────────
        if t == "jump_flow":
            target_flow_id = data.get("target_flow_id", "")
            if target_flow_id:
                try:
                    await self.trigger_flow(
                        flow_id=uuid.UUID(target_flow_id),
                        contact_id=run.contact_id,
                        context=context,
                        workspace_id=run.workspace_id,
                    )
                except Exception:
                    pass
            return None  # End current flow after jump

        # ── Set Variable (legacy) ─────────────────────────────────────────────
        if t == "set_variable":
            var_name = data.get("variable_name", "")
            val = await self.resolve_variables(data.get("value", ""), context)
            if var_name:
                context[var_name] = val
                context[f"flow.{var_name}"] = val
                run.context = context
            return self._get_next_node(flow.edges, nid)

        # Unknown — skip
        return self._get_next_node(flow.edges, nid)

    # ── Condition evaluator ───────────────────────────────────────────────────

    async def evaluate_condition(self, condition: dict, context: dict) -> bool:
        field = condition.get("field", "message")
        operator = condition.get("operator", "contains")
        value = str(condition.get("value", ""))

        if field.startswith("contact."):
            contact = await self._get_contact_from_context(context)
            attr = field.split(".", 1)[1]
            if attr == "tag":
                tags = contact.tags or [] if contact else []
                if operator == "tag_contains":
                    return value in tags
                if operator == "tag_not_contains":
                    return value not in tags
            actual = str(getattr(contact, attr, "") or "") if contact else ""
        elif field.startswith("flow."):
            actual = str(context.get(field, context.get(field.replace("flow.", ""), "")) or "")
        else:
            actual = str(context.get(field, context.get("message", "")) or "")

        a, v = actual.lower(), value.lower()

        ops = {
            "contains": lambda: v in a,
            "not_contains": lambda: v not in a,
            "equals": lambda: a == v,
            "not_equals": lambda: a != v,
            "starts_with": lambda: a.startswith(v),
            "is_empty": lambda: not actual.strip(),
            "is_not_empty": lambda: bool(actual.strip()),
            "tag_contains": lambda: value in (context.get("contact_tags") or []),
            "greater_than": lambda: float(actual) > float(value) if actual and value else False,
            "less_than": lambda: float(actual) < float(value) if actual and value else False,
        }
        fn = ops.get(operator)
        try:
            return fn() if fn else False
        except Exception:
            return False

    # ── Variable resolver ─────────────────────────────────────────────────────

    async def resolve_variables(self, text: str, context: dict) -> str:
        if not text or "{{" not in text:
            return text

        contact = None
        if "contact." in text:
            contact = await self._get_contact_from_context(context)

        now = datetime.now(timezone.utc)

        def replacer(match: re.Match) -> str:
            key = match.group(1).strip()
            if key.startswith("contact.") and contact:
                return str(getattr(contact, key.split(".", 1)[1], "") or "")
            if key == "timestamp":
                return now.isoformat()
            if key == "date":
                return now.strftime("%Y-%m-%d")
            if key == "time":
                return now.strftime("%H:%M")
            # flow.variable or plain variable
            return str(context.get(key, context.get(key.replace("flow.", ""), match.group(0))))

        return re.sub(r"\{\{(.+?)\}\}", replacer, text)

    # ── Graph helpers ─────────────────────────────────────────────────────────

    def _find_start_node(self, nodes: list) -> dict | None:
        for node in (nodes or []):
            if node.get("type") in TRIGGER_TYPES:
                return node
        return nodes[0] if nodes else None

    def _get_next_node(self, edges: list, node_id: str, handle: str | None = None) -> str | None:
        for edge in (edges or []):
            if edge.get("source") == node_id:
                if handle is None or edge.get("sourceHandle") == handle:
                    return edge.get("target")
        return None

    # ── DB / WA helpers ───────────────────────────────────────────────────────

    def _get_wa(self) -> WhatsAppService:
        if self.workspace.whatsapp_provider == "twilio":
            if not self.workspace.twilio_account_sid:
                raise ValueError("Twilio not configured")
            return TwilioWhatsAppService(
                self.workspace.twilio_account_sid,
                self.workspace.twilio_auth_token,
                self.workspace.twilio_whatsapp_number,
            )
        if not self.workspace.whatsapp_access_token:
            raise ValueError("WhatsApp not configured")
        return WhatsAppService(self.workspace.whatsapp_access_token, self.workspace.whatsapp_phone_number_id)

    async def _get_contact(self, contact_id: uuid.UUID) -> Contact:
        result = await self.db.execute(select(Contact).where(Contact.id == contact_id))
        c = result.scalar_one_or_none()
        if not c:
            raise ValueError(f"Contact {contact_id} not found")
        return c

    async def _get_contact_from_context(self, context: dict) -> Contact | None:
        cid = context.get("contact_id")
        if not cid:
            return None
        result = await self.db.execute(select(Contact).where(Contact.id == uuid.UUID(str(cid))))
        return result.scalar_one_or_none()

    async def _send_text(self, contact_id: uuid.UUID, text: str):
        if not text:
            return
        contact = await self._get_contact(contact_id)
        wa = self._get_wa()
        resp = await wa.send_text(contact.phone_number, text)
        meta_id = resp.get("messages", [{}])[0].get("id")
        await self._save_outbound_message(contact_id, MessageType.text, {"text": text}, meta_id)
        contact.total_messages_sent = (contact.total_messages_sent or 0) + 1

    async def _save_outbound_message(self, contact_id: uuid.UUID, msg_type: MessageType,
                                      content: dict, meta_id: str | None = None):
        conv = await self._get_or_create_conversation(contact_id)
        now = datetime.now(timezone.utc).isoformat()
        msg = Message(
            workspace_id=self.workspace.id, contact_id=contact_id,
            conversation_id=conv.id, direction=MessageDirection.outbound,
            message_type=msg_type, content=content,
            status=MessageStatus.sent, meta_message_id=meta_id,
        )
        self.db.add(msg)
        conv.last_message_at = now

    async def _get_or_create_conversation(self, contact_id: uuid.UUID) -> Conversation:
        result = await self.db.execute(
            select(Conversation).where(
                Conversation.workspace_id == self.workspace.id,
                Conversation.contact_id == contact_id,
            )
        )
        conv = result.scalar_one_or_none()
        if not conv:
            conv = Conversation(
                workspace_id=self.workspace.id, contact_id=contact_id,
                status=ConversationStatus.bot,
                last_message_at=datetime.now(timezone.utc).isoformat(),
                unread_count=0,
            )
            self.db.add(conv)
            await self.db.flush()
        return conv
