import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { Node } from "@xyflow/react";

interface Props {
  node: Node;
  onChange: (id: string, data: object) => void;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: any) {
  return (
    <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
  );
}

function Select({ value, onChange, children }: any) {
  return (
    <select value={value ?? ""} onChange={onChange}
      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
      {children}
    </select>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: any) {
  return (
    <textarea value={value ?? ""} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
  );
}

export default function ConfigPanel({ node, onChange, onClose }: Props) {
  const [local, setLocal] = useState<Record<string, any>>(node.data as any);

  useEffect(() => { setLocal(node.data as any); }, [node.id]);

  const set = (key: string, val: any) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    onChange(node.id, next);
  };

  const t = node.type ?? "";

  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="font-semibold text-sm text-gray-900">Configure Node</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label — always shown */}
        <Field label="Node Label">
          <Input value={local.label} onChange={(e: any) => set("label", e.target.value)} placeholder="Node name" />
        </Field>

        {/* ── TRIGGERS ── */}
        {t === "trigger_keyword" && (
          <>
            <Field label="Keywords (comma separated)">
              <Input value={local.keyword} onChange={(e: any) => set("keyword", e.target.value)} placeholder="hello, hi, start, menu" />
            </Field>
            <Field label="Match Type">
              <Select value={local.match_type} onChange={(e: any) => set("match_type", e.target.value)}>
                <option value="contains">Contains any keyword</option>
                <option value="exact">Exact match</option>
                <option value="starts_with">Starts with</option>
                <option value="regex">Regex pattern</option>
              </Select>
            </Field>
          </>
        )}

        {t === "trigger_button" && (
          <Field label="Button ID (leave empty for any)">
            <Input value={local.button_id} onChange={(e: any) => set("button_id", e.target.value)} placeholder="btn_yes" />
          </Field>
        )}

        {t === "trigger_list" && (
          <Field label="List Item ID (leave empty for any)">
            <Input value={local.list_id} onChange={(e: any) => set("list_id", e.target.value)} placeholder="item_1" />
          </Field>
        )}

        {t === "trigger_schedule" && (
          <>
            <Field label="Cron Expression">
              <Input value={local.cron} onChange={(e: any) => set("cron", e.target.value)} placeholder="0 9 * * 1 (Mon 9am)" />
            </Field>
            <Field label="Timezone">
              <Select value={local.timezone} onChange={(e: any) => set("timezone", e.target.value)}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
              </Select>
            </Field>
            <p className="text-xs text-gray-400">Common: <code>0 9 * * *</code> = daily 9am · <code>0 9 * * 1</code> = every Monday</p>
          </>
        )}

        {t === "trigger_webhook" && (
          <Field label="Webhook Event Filter (optional)">
            <Input value={local.event_type} onChange={(e: any) => set("event_type", e.target.value)} placeholder="order.placed" />
          </Field>
        )}

        {/* ── SEND TEXT ── */}
        {t === "send_message" && (
          <>
            <Field label="Message">
              <Textarea value={local.message} onChange={(e: any) => set("message", e.target.value)}
                placeholder={"Hi {{contact.name}}, welcome to our store! 🎉"} rows={4} />
            </Field>
            <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-500 space-y-0.5">
              <p className="font-medium text-gray-600">Variables:</p>
              <p>{"{{contact.name}}"} · {"{{contact.phone}}"} · {"{{contact.email}}"}</p>
              <p>{"{{date}}"} · {"{{time}}"} · {"{{flow.variable}}"}</p>
            </div>
          </>
        )}

        {/* ── SEND IMAGE ── */}
        {t === "send_image" && (
          <>
            <Field label="Image URL">
              <Input value={local.image_url} onChange={(e: any) => set("image_url", e.target.value)} placeholder="https://example.com/image.jpg" />
            </Field>
            <Field label="Caption (optional)">
              <Input value={local.caption} onChange={(e: any) => set("caption", e.target.value)} placeholder="Check this out!" />
            </Field>
          </>
        )}

        {/* ── SEND AUDIO ── */}
        {t === "send_audio" && (
          <Field label="Audio URL (mp3/ogg)">
            <Input value={local.audio_url} onChange={(e: any) => set("audio_url", e.target.value)} placeholder="https://example.com/audio.mp3" />
          </Field>
        )}

        {/* ── SEND BUTTONS ── */}
        {t === "send_buttons" && (
          <>
            <Field label="Message Body">
              <Textarea value={local.body} onChange={(e: any) => set("body", e.target.value)}
                placeholder="Please choose an option:" rows={2} />
            </Field>
            <Field label="Buttons (max 3)">
              <div className="space-y-2">
                {((local.buttons as string[]) ?? [""]).map((btn: string, i: number) => (
                  <div key={i} className="flex gap-1">
                    <input value={btn} onChange={(e) => {
                      const arr = [...((local.buttons as string[]) ?? [])];
                      arr[i] = e.target.value;
                      set("buttons", arr);
                    }} placeholder={`Button ${i + 1}`}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <button onClick={() => {
                      const arr = ((local.buttons as string[]) ?? []).filter((_: any, j: number) => j !== i);
                      set("buttons", arr);
                    }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
                {((local.buttons as string[]) ?? []).length < 3 && (
                  <button onClick={() => set("buttons", [...((local.buttons as string[]) ?? []), ""])}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700">
                    <Plus size={12} /> Add Button
                  </button>
                )}
              </div>
            </Field>
          </>
        )}

        {/* ── SEND LIST ── */}
        {t === "send_list" && (
          <>
            <Field label="Message Body">
              <Textarea value={local.body} onChange={(e: any) => set("body", e.target.value)} placeholder="Please select from the menu:" rows={2} />
            </Field>
            <Field label="Button Text">
              <Input value={local.button_text} onChange={(e: any) => set("button_text", e.target.value)} placeholder="View Options" />
            </Field>
            <Field label="Section Title">
              <Input value={local.section_title} onChange={(e: any) => set("section_title", e.target.value)} placeholder="Our Services" />
            </Field>
            <Field label="Items (one per line: id|title)">
              <Textarea value={local.items_raw} onChange={(e: any) => set("items_raw", e.target.value)}
                placeholder={"item_1|Track Order\nitem_2|Contact Support\nitem_3|View Catalog"} rows={4} />
            </Field>
          </>
        )}

        {/* ── SEND TEMPLATE ── */}
        {t === "send_template" && (
          <>
            <Field label="Template Name">
              <Input value={local.template_name} onChange={(e: any) => set("template_name", e.target.value)} placeholder="order_confirmation" />
            </Field>
            <Field label="Language">
              <Select value={local.language} onChange={(e: any) => set("language", e.target.value)}>
                <option value="en">English</option>
                <option value="en_IN">English (India)</option>
                <option value="hi">Hindi</option>
              </Select>
            </Field>
            <Field label="Variables (one per line: {{1}}=value)">
              <Textarea value={local.variables_raw} onChange={(e: any) => set("variables_raw", e.target.value)}
                placeholder={"{{1}}={{contact.name}}\n{{2}}={{flow.order_id}}"} rows={3} />
            </Field>
          </>
        )}

        {/* ── WAIT FOR REPLY ── */}
        {t === "wait_for_reply" && (
          <>
            <Field label="Timeout (minutes, 0 = no timeout)">
              <Input type="number" value={local.timeout_minutes} onChange={(e: any) => set("timeout_minutes", e.target.value)} placeholder="0" />
            </Field>
            <Field label="Save reply to variable">
              <Input value={local.save_to} onChange={(e: any) => set("save_to", e.target.value)} placeholder="user_reply" />
            </Field>
            <p className="text-xs text-gray-400">Use {"{{flow.user_reply}}"} in later nodes</p>
          </>
        )}

        {/* ── WAIT / DELAY ── */}
        {t === "wait" && (
          <div className="flex gap-2">
            <Field label="Duration">
              <Input type="number" value={local.duration} onChange={(e: any) => set("duration", e.target.value)} placeholder="1" />
            </Field>
            <Field label="Unit">
              <Select value={local.unit} onChange={(e: any) => set("unit", e.target.value)}>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </Select>
            </Field>
          </div>
        )}

        {/* ── CONDITION ── */}
        {t === "condition" && (
          <>
            <Field label="Field">
              <Select value={local.field} onChange={(e: any) => set("field", e.target.value)}>
                <option value="message">Message Text</option>
                <option value="contact.name">Contact Name</option>
                <option value="contact.email">Contact Email</option>
                <option value="contact.tag">Contact Tag</option>
                <option value="contact.opted_in">Opted In</option>
                <option value="flow.user_reply">Flow Variable</option>
              </Select>
            </Field>
            <Field label="Operator">
              <Select value={local.operator} onChange={(e: any) => set("operator", e.target.value)}>
                <option value="contains">Contains</option>
                <option value="not_contains">Not Contains</option>
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="starts_with">Starts With</option>
                <option value="is_empty">Is Empty</option>
                <option value="is_not_empty">Is Not Empty</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
                <option value="tag_contains">Tag Contains</option>
              </Select>
            </Field>
            <Field label="Value">
              <Input value={local.value} onChange={(e: any) => set("value", e.target.value)} placeholder="e.g. yes, order, vip" />
            </Field>
          </>
        )}

        {/* ── A/B SPLIT ── */}
        {t === "ab_split" && (
          <>
            <Field label={`Branch A: ${local.split_percent ?? 50}%`}>
              <input type="range" min={10} max={90} value={local.split_percent ?? 50}
                onChange={(e) => set("split_percent", Number(e.target.value))}
                className="w-full accent-green-600" />
            </Field>
            <p className="text-xs text-gray-500">Branch B: {100 - (local.split_percent ?? 50)}%</p>
          </>
        )}

        {/* ── ADD / REMOVE TAG ── */}
        {(t === "add_tag" || t === "remove_tag") && (
          <Field label="Tag Name">
            <Input value={local.tag} onChange={(e: any) => set("tag", e.target.value)} placeholder="vip, interested, paid" />
          </Field>
        )}

        {/* ── UPDATE CONTACT ── */}
        {t === "update_contact" && (
          <>
            <Field label="Field to Update">
              <Select value={local.field} onChange={(e: any) => set("field", e.target.value)}>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="opted_in">Opted In</option>
                <option value="custom_field">Custom Field</option>
              </Select>
            </Field>
            <Field label="Value">
              <Input value={local.value} onChange={(e: any) => set("value", e.target.value)} placeholder="{{flow.user_reply}}" />
            </Field>
          </>
        )}

        {/* ── ASSIGN AGENT ── */}
        {t === "assign_agent" && (
          <Field label="Agent Email">
            <Input value={local.agent_email} onChange={(e: any) => set("agent_email", e.target.value)} placeholder="agent@company.com" />
          </Field>
        )}

        {/* ── HTTP REQUEST ── */}
        {t === "action" && (
          <>
            <Field label="URL">
              <Input value={local.url} onChange={(e: any) => set("url", e.target.value)} placeholder="https://api.example.com/webhook" />
            </Field>
            <Field label="Method">
              <Select value={local.method} onChange={(e: any) => set("method", e.target.value)}>
                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
              </Select>
            </Field>
            <Field label="Body (JSON)">
              <Textarea value={local.body} onChange={(e: any) => set("body", e.target.value)}
                placeholder={'{"phone": "{{contact.phone}}", "name": "{{contact.name}}"}'} rows={4} />
            </Field>
            <Field label="Save response to variable">
              <Input value={local.save_to} onChange={(e: any) => set("save_to", e.target.value)} placeholder="http_response" />
            </Field>
          </>
        )}

        {/* ── SEND EMAIL ── */}
        {t === "send_email" && (
          <>
            <Field label="To Email">
              <Input value={local.email_to} onChange={(e: any) => set("email_to", e.target.value)} placeholder="{{contact.email}}" />
            </Field>
            <Field label="Subject">
              <Input value={local.subject} onChange={(e: any) => set("subject", e.target.value)} placeholder="New inquiry from {{contact.name}}" />
            </Field>
            <Field label="Body">
              <Textarea value={local.email_body} onChange={(e: any) => set("email_body", e.target.value)}
                placeholder="Hi team, new message from {{contact.name}} ({{contact.phone}})" rows={4} />
            </Field>
          </>
        )}

        {/* ── GOOGLE SHEETS ── */}
        {t === "google_sheets" && (
          <>
            <Field label="Action">
              <Select value={local.sheets_action} onChange={(e: any) => set("sheets_action", e.target.value)}>
                <option value="append_row">Append Row</option>
                <option value="update_row">Update Row</option>
                <option value="lookup">Lookup Value</option>
              </Select>
            </Field>
            <Field label="Spreadsheet ID">
              <Input value={local.spreadsheet_id} onChange={(e: any) => set("spreadsheet_id", e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
            </Field>
            <Field label="Sheet Name">
              <Input value={local.sheet_name} onChange={(e: any) => set("sheet_name", e.target.value)} placeholder="Sheet1" />
            </Field>
            <Field label="Row Data (comma separated)">
              <Input value={local.row_data} onChange={(e: any) => set("row_data", e.target.value)} placeholder="{{contact.name}},{{contact.phone}},{{date}}" />
            </Field>
          </>
        )}

        {/* ── JUMP TO FLOW ── */}
        {t === "jump_flow" && (
          <Field label="Target Flow ID">
            <Input value={local.target_flow_id} onChange={(e: any) => set("target_flow_id", e.target.value)} placeholder="paste flow UUID here" />
          </Field>
        )}
      </div>
    </div>
  );
}
