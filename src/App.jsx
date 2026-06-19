import { useCallback, useRef, useState, useEffect, createContext, useContext } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getBezierPath,
} from "reactflow";
import "reactflow/dist/style.css";

const params = new URLSearchParams(window.location.search);
const API = (import.meta.env.VITE_API_URL || "https://kkzof1hiq0af5vngi0v689zi.5.75.237.171.sslip.io").replace(/\/$/, "");
const ACCOUNT_ID = parseInt(params.get("account_id") || import.meta.env.VITE_ACCOUNT_ID || "3", 10);

// Light theme (DASHBOARD)
const T = { blue: "#2563eb", text: "#1f2d3d", sub: "#64748b", border: "#e5e7eb", bg: "#ffffff", soft: "#f8fafc", green: "#15803d", greenBg: "#e7f7ee", grayPill: "#64748b", grayPillBg: "#f1f5f9", font: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
// Dark theme (CANVAS / EDITOR) — clean & professional
const D = { bg: "#0B0F17", panel: "#0F141E", panel2: "#161C28", card: "#161C28", border: "#242C3A", text: "#E8ECF3", sub: "#94A0B4", faint: "#5C6878", input: "#0F1622" };
// Muted, professional accent per node type
const NC = { start: "#5B8DEF", text: "#4C84FF", buttons: "#2EA66B", list: "#9B6DF0", media: "#C8902B", cta: "#3A7DE0", question: "#4F90E8", delay: "#7C8696", condition: "#CC6A2E", tag: "#D9694A", stop: "#E5524A" };
const ACCENT = "#4C84FF";

const OPERATORS = [
  ["equals", "equals"], ["not_equals", "not equals"], ["contains", "contains"], ["not_contains", "does not contain"],
  ["starts_with", "starts with"], ["ends_with", "ends with"], ["greater_than", "greater than"], ["less_than", "less than"],
  ["is_email", "is email"], ["is_phone", "is phone number"], ["regex", "matches regex"], ["fuzzy", "fuzzy match"],
];
const RESPONSE_FORMATS = [["any", "Any response"], ["text", "Text"], ["number", "Number"], ["email", "Email"], ["phone", "Phone number"]];
const HEADER_TYPES = [["none", "None"], ["text", "Text"], ["image", "Image"], ["video", "Video"], ["document", "Document"]];

function hexA(hex, a) { const h = hex.replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; const n = parseInt(f, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

const GTYPE = {
  image: { icon: "🖼️", label: "Image", color: NC.text },
  video: { icon: "🎬", label: "Video", color: NC.question },
  audio: { icon: "🎵", label: "Audio", color: NC.buttons },
  document: { icon: "📄", label: "Doc", color: NC.media },
};
function guessType(url) {
  const ext = (String(url).split("?")[0].split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "mkv", "avi"].includes(ext)) return "video";
  if (["mp3", "ogg", "wav", "m4a", "aac", "opus"].includes(ext)) return "audio";
  return "document";
}
function fmtSize(b) { if (b == null) return ""; if (b < 1024) return b + " B"; if (b < 1048576) return Math.round(b / 1024) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }
function copyText(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.top = "-9999px"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
  } catch { return false; }
}

function injectFont() {
  if (!document.getElementById("cs-inter")) {
    const l = document.createElement("link"); l.id = "cs-inter"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }
  document.body.style.margin = "0"; document.body.style.fontFamily = T.font;
}
function injectStyles() {
  if (document.getElementById("cs-dark")) return;
  const s = document.createElement("style"); s.id = "cs-dark";
  s.textContent = `
  .react-flow__controls{box-shadow:0 4px 16px rgba(0,0,0,.4);border-radius:8px;overflow:hidden;border:1px solid ${D.border};}
  .react-flow__controls-button{background:${D.panel2};border-bottom:1px solid ${D.border};}
  .react-flow__controls-button:hover{background:#1C2433;}
  .react-flow__controls-button svg{fill:#aeb8c8;}
  .react-flow__minimap{background:${D.bg} !important;border:1px solid ${D.border};border-radius:8px;}
  .react-flow__attribution{background:transparent;color:#3a4350;}
  .react-flow__edge-path{stroke:#3b4658;stroke-width:1.8;}
  .react-flow__edge.selected .react-flow__edge-path,.react-flow__edge:hover .react-flow__edge-path{stroke:${ACCENT};}
  .react-flow__handle{transition:transform .1s;}
  .react-flow__handle:hover{transform:scale(1.25);}
  .cs-pal:hover{border-color:#39455a!important;background:#1A212D!important;}
  .cs-in{background:${D.input};border:1px solid #2A3340;color:${D.text};}
  .cs-in:focus{outline:none;border-color:${ACCENT};box-shadow:0 0 0 3px ${hexA(ACCENT, .16)};}
  .cs-in::placeholder{color:${D.faint};}
  .cs-gcard:hover{border-color:#39455a!important;transform:translateY(-2px);}
  .cs-pub:hover{filter:brightness(1.07);}
  .cs-row:hover{background:#1A212D;}
  `;
  document.head.appendChild(s);
}

// ===== NODE shell =====
const nodeBox = (accent, sel) => ({ position: "relative", background: D.card, borderRadius: 12, width: 256, border: `1px solid ${sel ? accent : D.border}`, boxShadow: sel ? `0 0 0 1px ${accent}, 0 10px 26px rgba(0,0,0,.5)` : `0 1px 2px rgba(0,0,0,.35), 0 6px 16px rgba(0,0,0,.22)`, fontFamily: T.font, overflow: "hidden", transition: "box-shadow .15s, border-color .15s" });
const nbody = { padding: "4px 13px 12px", color: D.sub, whiteSpace: "pre-wrap", minHeight: 12, lineHeight: 1.45, fontSize: 12 };
const small = { color: D.faint, fontSize: 11, marginTop: 2, whiteSpace: "pre-wrap" };
const hStyle = (a) => ({ width: 12, height: 12, background: D.bg, border: `2px solid ${a}` });
const rightHandle = (a) => ({ top: "50%", right: -7, transform: "translateY(-50%)", ...hStyle(a) });
const itemPill = { position: "relative", margin: "7px 13px", padding: "9px 30px 9px 12px", border: `1px solid ${D.border}`, borderRadius: 9, background: D.input, color: D.text, fontSize: 12, lineHeight: 1.3, minHeight: 18 };
const EdgeCtx = createContext(null);

function Hdr({ a, icon, title }) {
  return (<div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px 7px" }}>
    <div style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: hexA(a, .14), color: a, fontSize: 12.5 }}>{icon}</div>
    <div style={{ color: D.text, fontWeight: 600, fontSize: 12.5 }}>{title}</div>
  </div>);
}
function TopLine({ a }) { return <div style={{ height: 2, background: a, opacity: .8 }} />; }
function HeaderPreview({ data }) {
  const h = data.header || {}; if (!h.type || h.type === "none") return null;
  if (h.type === "text") return <div style={{ margin: "0 13px 2px", fontSize: 12, fontWeight: 700, color: D.text }}>{h.value || "Header"}</div>;
  return <div style={{ margin: "2px 13px", fontSize: 11, color: D.faint, display: "flex", gap: 6, alignItems: "center" }}><span>{GTYPE[h.type]?.icon || "📎"}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(h.value || "").split("/").pop() || h.type + " header"}</span></div>;
}
function FooterPreview({ data }) { return data.footer ? <div style={{ margin: "2px 13px 0", fontSize: 11, color: D.faint }}>{data.footer}</div> : null; }

function eachListRow(sections, cb) { let gi = 0; (sections || []).forEach((sec, si) => { (sec.rows || []).forEach((row, ri) => { cb(row, gi, si, ri); gi++; }); }); }
function listRowCount(sections) { let n = 0; (sections || []).forEach((s) => (n += (s.rows || []).length)); return n; }

function StartNode({ data }) { const a = NC.start; return (<div style={nodeBox(a, false)}><TopLine a={a} /><Hdr a={a} icon="⚡" title="On Message" /><div style={nbody}>{data.keywords ? `Keywords: ${data.keywords}` : "Starts on the first message"}{data.fuzzy ? <div style={{ marginTop: 4, fontSize: 11, color: a }}>Fuzzy matching on</div> : null}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function TextNode({ data, selected }) { const a = NC.text; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="💬" title="Send Text" /><div style={nbody}>{data.text || "…"}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function ButtonsNode({ data, selected }) {
  const a = NC.buttons; const buttons = data.buttons || [];
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🔘" title="Send Buttons" /><HeaderPreview data={data} /><div style={nbody}>{data.text || "…"}</div>
    {buttons.map((b, i) => (<div key={i} style={itemPill}>{b.title || `Button ${i + 1}`}<Handle type="source" position={Position.Right} id={`btn-${i}`} style={rightHandle(a)} /></div>))}
    <FooterPreview data={data} /><div style={{ height: 8 }} /></div>);
}
function ListNode({ data, selected }) {
  const a = NC.list; const rows = [];
  eachListRow(data.sections, (row, gi) => { rows.push(<div key={gi} style={itemPill}><div style={{ fontWeight: 600 }}>{row.title || `Row ${gi + 1}`}</div>{row.description ? <div style={small}>{row.description}</div> : null}<Handle type="source" position={Position.Right} id={`row-${gi}`} style={rightHandle(a)} /></div>); });
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="📋" title="Send List" /><HeaderPreview data={data} /><div style={nbody}>{data.body || "…"}{data.button ? <div style={{ marginTop: 4, fontSize: 11, color: a }}>▾ {data.button}</div> : null}</div>{rows}<FooterPreview data={data} /><div style={{ height: 8 }} /></div>);
}
function MediaNode({ data, selected }) {
  const a = NC.media;
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🖼️" title="Send Media" />
    <div style={{ padding: "2px 13px 12px" }}>
      {data.url ? (data.mediaType === "image"
        ? <img src={data.url} alt="" style={{ width: "100%", height: 92, objectFit: "cover", borderRadius: 8, border: `1px solid ${D.border}` }} />
        : <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: D.sub, padding: "6px 0" }}><span>{GTYPE[data.mediaType]?.icon || "📄"}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.name || "media"}</span></div>)
        : <div style={{ fontSize: 12, color: D.faint }}>No media selected</div>}
      {data.caption ? <div style={{ marginTop: 6, fontSize: 12, color: D.sub, whiteSpace: "pre-wrap" }}>{data.caption}</div> : null}
    </div>
    <Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>);
}
function CtaNode({ data, selected }) { const a = NC.cta; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🔗" title="Send CTA" /><HeaderPreview data={data} /><div style={nbody}>{data.body || "…"}{data.url ? <div style={{ marginTop: 6, padding: "6px 10px", border: `1px solid ${D.border}`, borderRadius: 8, background: D.input, color: a, fontSize: 12, textAlign: "center" }}>🔗 {data.display || "Open link"}</div> : null}</div><FooterPreview data={data} /><div style={{ height: 4 }} /><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function QuestionNode({ data, selected }) { const a = NC.question; const fmt = (RESPONSE_FORMATS.find((f) => f[0] === (data.responseFormat || "any")) || ["", "Any"])[1]; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="❓" title="Ask Question" /><div style={nbody}>{data.text || "…"}<div style={{ marginTop: 6, fontSize: 11, color: a }}>Expects: {fmt}{data.saveAs ? ` → ${data.saveAs}` : ""}</div></div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function DelayNode({ data, selected }) { const a = NC.delay; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="⏱️" title="Delay" /><div style={nbody}>Wait {data.value || 0} {data.unit || "seconds"}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function ConditionNode({ data, selected }) {
  const a = NC.condition; const conds = data.conditions || [];
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🔀" title="Condition" />
    <div style={{ padding: "2px 13px 4px", fontSize: 11.5, color: D.sub }}>Match <b style={{ color: a }}>{data.match === "any" ? "ANY" : "ALL"}</b> of:</div>
    <div style={{ padding: "0 13px 6px" }}>{conds.map((c, i) => { const op = (OPERATORS.find((o) => o[0] === (c.operator || "equals")) || ["", "?"])[1]; return (<div key={i} style={{ fontSize: 11.5, color: D.text, marginBottom: 3 }}>{c.first || "{{last_message}}"} <span style={{ color: a }}>{op}</span> {c.second ? `"${c.second}"` : "…"}</div>); })}</div>
    <div style={{ ...itemPill, borderColor: hexA(NC.buttons, .5) }}><span style={{ color: NC.buttons, fontWeight: 600 }}>✓ True</span><Handle type="source" position={Position.Right} id="cond-true" style={rightHandle(NC.buttons)} /></div>
    <div style={{ ...itemPill, borderColor: hexA(NC.stop, .5) }}><span style={{ color: NC.stop, fontWeight: 600 }}>✕ False</span><Handle type="source" position={Position.Right} id="cond-false" style={rightHandle(NC.stop)} /></div>
    <div style={{ height: 8 }} /></div>);
}
function TagNode({ data, selected }) {
  const a = NC.tag; const labels = (data.labels || "").split(",").map((x) => x.trim()).filter(Boolean);
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🏷️" title="Update Tag" />
    <div style={{ padding: "2px 13px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
      {labels.length ? labels.map((l, i) => (<span key={i} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: hexA(a, .15), color: a, border: `1px solid ${hexA(a, .4)}` }}>{l}</span>)) : <span style={{ fontSize: 12, color: D.faint }}>No tags selected</span>}
    </div>
    <Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>);
}
function StopNode({ data, selected }) { const a = NC.stop; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🛑" title="Stop Chatbot" /><div style={nbody}>{data.text || "(no message — hands over to a human)"}</div></div>); }

const nodeTypes = { start: StartNode, text: TextNode, buttons: ButtonsNode, list: ListNode, media: MediaNode, cta: CtaNode, question: QuestionNode, delay: DelayNode, condition: ConditionNode, tag: TagNode, stop: StopNode };

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }) {
  const { onDeleteEdge } = useContext(EdgeCtx) || {};
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (<>
    <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 1.8 }} />
    <EdgeLabelRenderer>
      <button onClick={(e) => { e.stopPropagation(); onDeleteEdge && onDeleteEdge(id); }} title="Remove connection"
        style={{ position: "absolute", transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all", width: 18, height: 18, borderRadius: "50%", border: `2px solid ${D.bg}`, background: NC.stop, color: "#fff", cursor: "pointer", fontSize: 10, lineHeight: "14px", padding: 0 }}>✕</button>
    </EdgeLabelRenderer>
  </>);
}
const edgeTypes = { deletable: DeletableEdge };

function defaultData(kind) {
  if (kind === "text") return { text: "Type your message here…" };
  if (kind === "buttons") return { header: { type: "none", value: "" }, text: "Please choose an option", buttons: [{ title: "Yes" }, { title: "No" }], footer: "" };
  if (kind === "list") return { header: { type: "none", value: "" }, body: "Pick one from the list", button: "View options", footer: "", sections: [{ title: "", rows: [{ title: "Option 1", description: "" }, { title: "Option 2", description: "" }] }] };
  if (kind === "media") return { url: "", mediaType: "", name: "", caption: "" };
  if (kind === "cta") return { header: { type: "none", value: "" }, body: "Tap the button below", display: "Open link", url: "", footer: "" };
  if (kind === "question") return { text: "Your question…", saveAs: "answer", responseFormat: "any", timeoutValue: 0, timeoutUnit: "seconds", timeoutMessage: "", continueOnTimeout: false };
  if (kind === "delay") return { value: 1, unit: "seconds" };
  if (kind === "condition") return { match: "all", conditions: [{ first: "{{last_message}}", operator: "contains", second: "" }] };
  if (kind === "tag") return { labels: "" };
  if (kind === "stop") return { text: "Connecting you to an agent 🙌" };
  return {};
}
const PALETTE = [
  { group: "Messages", items: [
    { kind: "text", label: "Send Text", icon: "💬", color: NC.text },
    { kind: "buttons", label: "Send Buttons", icon: "🔘", color: NC.buttons },
    { kind: "list", label: "Send List", icon: "📋", color: NC.list },
    { kind: "media", label: "Send Media", icon: "🖼️", color: NC.media },
    { kind: "cta", label: "Send CTA", icon: "🔗", color: NC.cta },
    { kind: "question", label: "Ask Question", icon: "❓", color: NC.question },
  ]},
  { group: "Logic", items: [
    { kind: "delay", label: "Delay", icon: "⏱️", color: NC.delay },
    { kind: "condition", label: "Condition", icon: "🔀", color: NC.condition },
    { kind: "tag", label: "Update Tag", icon: "🏷️", color: NC.tag },
    { kind: "stop", label: "Stop Chatbot", icon: "🛑", color: NC.stop },
  ]},
];
const startNode = () => ({ id: "start", type: "start", position: { x: 340, y: 30 }, data: { keywords: "", fuzzy: false }, deletable: false });
const hdr = (d) => ({ type: (d.header && d.header.type) || "none", value: (d.header && d.header.value) || "" });

function toEngineFormat(nodes, edges) {
  const def = { start: null, trigger: { keywords: [], fuzzy: false }, nodes: {} };
  const plainNext = {}, btnNext = {}, rowNext = {}, condTrue = {}, condFalse = {};
  for (const e of edges) {
    const h = e.sourceHandle;
    if (h && h.startsWith("btn-")) { (btnNext[e.source] = btnNext[e.source] || {})[h] = e.target; }
    else if (h && h.startsWith("row-")) { (rowNext[e.source] = rowNext[e.source] || {})[h] = e.target; }
    else if (h === "cond-true") condTrue[e.source] = e.target;
    else if (h === "cond-false") condFalse[e.source] = e.target;
    else plainNext[e.source] = e.target;
  }
  def.start = plainNext["start"] || null;
  for (const n of nodes) {
    const d = n.data || {};
    if (n.type === "start") { def.trigger = { keywords: (d.keywords || "").split(",").map((x) => x.trim()).filter(Boolean), fuzzy: !!d.fuzzy }; continue; }
    else if (n.type === "text") def.nodes[n.id] = { type: "text", text: d.text || "", next: plainNext[n.id] || null };
    else if (n.type === "media") def.nodes[n.id] = { type: "media", url: d.url || "", media_type: d.mediaType || "", name: d.name || "", caption: d.caption || "", next: plainNext[n.id] || null };
    else if (n.type === "cta") def.nodes[n.id] = { type: "cta", header: hdr(d), body: d.body || "", display: d.display || "", url: d.url || "", footer: d.footer || "", next: plainNext[n.id] || null };
    else if (n.type === "delay") def.nodes[n.id] = { type: "delay", seconds: (d.unit === "minutes" ? (parseInt(d.value, 10) || 0) * 60 : (parseInt(d.value, 10) || 0)), next: plainNext[n.id] || null };
    else if (n.type === "tag") def.nodes[n.id] = { type: "tag", labels: (d.labels || "").split(",").map((x) => x.trim()).filter(Boolean), next: plainNext[n.id] || null };
    else if (n.type === "stop") def.nodes[n.id] = { type: "handover", text: d.text || "" };
    else if (n.type === "question") def.nodes[n.id] = { type: "question", text: d.text || "", save_as: d.saveAs || "answer", response_format: d.responseFormat || "any", timeout_seconds: (d.timeoutValue ? (d.timeoutUnit === "minutes" ? parseInt(d.timeoutValue, 10) * 60 : parseInt(d.timeoutValue, 10)) : 0), timeout_message: d.timeoutMessage || "", continue_on_timeout: !!d.continueOnTimeout, next: plainNext[n.id] || null };
    else if (n.type === "condition") def.nodes[n.id] = { type: "condition", match: d.match || "all", conditions: (d.conditions || []).map((c) => ({ first: c.first || "", operator: c.operator || "equals", second: c.second || "" })), next_true: condTrue[n.id] || null, next_false: condFalse[n.id] || null };
    else if (n.type === "buttons") def.nodes[n.id] = { type: "buttons", header: hdr(d), text: d.text || "", footer: d.footer || "", buttons: (d.buttons || []).map((b, i) => ({ title: b.title || `Button ${i + 1}`, next: (btnNext[n.id] || {})[`btn-${i}`] || null })) };
    else if (n.type === "list") {
      const secs = (d.sections || []).map((sec) => ({ title: sec.title || "", rows: (sec.rows || []).map((r) => ({ title: r.title || "", description: r.description || "" })) }));
      let gi = 0; secs.forEach((sec) => sec.rows.forEach((r) => { r.next = (rowNext[n.id] || {})[`row-${gi}`] || null; gi++; }));
      def.nodes[n.id] = { type: "list", header: hdr(d), body: d.body || "", button: d.button || "", footer: d.footer || "", sections: secs };
    }
  }
  return def;
}
function fromEngineFormat(def) {
  const start = startNode();
  if (def && def.trigger) start.data = { keywords: (def.trigger.keywords || []).join(", "), fuzzy: !!def.trigger.fuzzy };
  const nodes = [start]; const edges = []; const y = 200;
  const ids = Object.keys((def && def.nodes) || {});
  ids.forEach((id, idx) => {
    const node = def.nodes[id]; const kind = node.type === "handover" ? "stop" : node.type; const data = {};
    if (kind === "text") data.text = node.text || "";
    if (kind === "stop") data.text = node.text || "";
    if (kind === "media") { data.url = node.url || ""; data.mediaType = node.media_type || ""; data.name = node.name || ""; data.caption = node.caption || ""; }
    if (kind === "cta") { data.header = node.header || { type: "none", value: "" }; data.body = node.body || ""; data.display = node.display || ""; data.url = node.url || ""; data.footer = node.footer || ""; }
    if (kind === "delay") { const s = node.seconds || 0; if (s && s % 60 === 0 && s >= 60) { data.value = s / 60; data.unit = "minutes"; } else { data.value = s; data.unit = "seconds"; } }
    if (kind === "question") { data.text = node.text || ""; data.saveAs = node.save_as || "answer"; data.responseFormat = node.response_format || "any"; const ts = node.timeout_seconds || 0; if (ts && ts % 60 === 0 && ts >= 60) { data.timeoutValue = ts / 60; data.timeoutUnit = "minutes"; } else { data.timeoutValue = ts; data.timeoutUnit = "seconds"; } data.timeoutMessage = node.timeout_message || ""; data.continueOnTimeout = !!node.continue_on_timeout; }
    if (kind === "condition") { data.match = node.match || "all"; data.conditions = (Array.isArray(node.conditions) && node.conditions.length ? node.conditions : [{ first: node.first || "{{last_message}}", operator: node.operator || "contains", second: node.second || "" }]).map((c) => ({ first: c.first || "", operator: c.operator || "equals", second: c.second || "" })); }
    if (kind === "tag") data.labels = (node.labels || []).join(", ");
    if (kind === "buttons") { data.header = node.header || { type: "none", value: "" }; data.text = node.text || ""; data.footer = node.footer || ""; data.buttons = (node.buttons || []).map((b) => ({ title: b.title })); }
    let normSecs = null;
    if (kind === "list") { data.header = node.header || { type: "none", value: "" }; data.body = node.body || ""; data.button = node.button || ""; data.footer = node.footer || ""; normSecs = (node.sections && node.sections.length ? node.sections : [{ title: "", rows: node.rows || [] }]); data.sections = normSecs.map((sec) => ({ title: sec.title || "", rows: (sec.rows || []).map((r) => ({ title: r.title, description: r.description || "" })) })); }
    nodes.push({ id, type: kind, position: { x: 340 + (idx % 2) * 330, y: y + idx * 135 }, data });
    if (kind === "buttons") (node.buttons || []).forEach((b, i) => { if (b.next) edges.push({ id: `e-${id}-b${i}`, source: id, sourceHandle: `btn-${i}`, target: b.next, type: "deletable", animated: true }); });
    else if (kind === "list") { let gi = 0; (normSecs || []).forEach((sec) => (sec.rows || []).forEach((r) => { if (r.next) edges.push({ id: `e-${id}-r${gi}`, source: id, sourceHandle: `row-${gi}`, target: r.next, type: "deletable", animated: true }); gi++; })); }
    else if (kind === "condition") { if (node.next_true) edges.push({ id: `e-${id}-t`, source: id, sourceHandle: "cond-true", target: node.next_true, type: "deletable", animated: true }); if (node.next_false) edges.push({ id: `e-${id}-f`, source: id, sourceHandle: "cond-false", target: node.next_false, type: "deletable", animated: true }); }
    else if (node.next) edges.push({ id: `e-${id}`, source: id, target: node.next, type: "deletable", animated: true });
  });
  if (def && def.start) edges.push({ id: "e-start", source: "start", target: def.start, type: "deletable", animated: true });
  return { nodes, edges };
}

export default function App() {
  const initialView = params.get("view") === "gallery" ? "gallery" : "dashboard";
  const [view, setView] = useState(initialView);
  const [editId, setEditId] = useState(null);
  useEffect(() => { injectFont(); injectStyles(); }, []);
  if (view === "gallery") return <Gallery />;
  if (view === "editor") return <Editor flowId={editId} onBack={() => setView("dashboard")} />;
  return <Dashboard onEdit={(id) => { setEditId(id); setView("editor"); }} />;
}

// ===================== DASHBOARD (light) =====================
function Dashboard({ onEdit }) {
  const [flows, setFlows] = useState(null);
  const [inboxes, setInboxes] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [pendingInbox, setPendingInbox] = useState({});
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    try { const j = await (await fetch(`${API}/api/flows?account_id=${ACCOUNT_ID}`)).json(); setFlows(j.flows || []); } catch { setFlows([]); }
    try { const j = await (await fetch(`${API}/api/inboxes?account_id=${ACCOUNT_ID}`)).json(); setInboxes(j.inboxes || []); } catch { setInboxes([]); }
  };
  useEffect(() => { load(); }, []);

  const createBot = async () => { try { const j = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: "New chatbot" }) })).json(); if (j.ok) onEdit(j.flow.id); } catch { setMsg("Create failed"); } };
  const duplicate = async (f) => { setMenuOpen(null); try { const full = await (await fetch(`${API}/api/flows/${f.id}`)).json(); const cr = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: (f.name || "Chatbot") + " (copy)" }) })).json(); if (cr.ok) await fetch(`${API}/api/flows/${cr.flow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cr.flow.name, definition: full.flow.definition }) }); await load(); } catch { setMsg("Duplicate failed"); } };
  const exportBot = async (f) => { setMenuOpen(null); try { const full = await (await fetch(`${API}/api/flows/${f.id}`)).json(); const blob = new Blob([JSON.stringify({ name: full.flow.name, definition: full.flow.definition }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${(f.name || "chatbot").replace(/\s+/g, "-")}.json`; a.click(); URL.revokeObjectURL(url); } catch { setMsg("Export failed"); } };
  const doDelete = async () => { const f = confirmDel; setConfirmDel(null); if (!f) return; try { await fetch(`${API}/api/flows/${f.id}`, { method: "DELETE" }); await load(); } catch { setMsg("Delete failed"); } };
  const importBot = async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const data = JSON.parse(await file.text()); const cr = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: data.name || "Imported chatbot" }) })).json(); if (cr.ok && data.definition) await fetch(`${API}/api/flows/${cr.flow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cr.flow.name, definition: data.definition }) }); await load(); } catch { setMsg("Import failed — invalid JSON"); } e.target.value = ""; };
  const saveInbox = async (f) => { const val = pendingInbox[f.id]; try { await fetch(`${API}/api/flows/${f.id}/assign-inbox`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inbox_id: val === "" ? null : val }) }); setPendingInbox((p) => { const n = { ...p }; delete n[f.id]; return n; }); await load(); } catch { setMsg("Save failed"); } };

  const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: T.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: T.font };
  const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: T.font };
  const pill = (s) => ({ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: s === "published" ? T.greenBg : T.grayPillBg, color: s === "published" ? T.green : T.grayPill });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, color: T.text }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 28px 12px" }}>
        <div><div style={{ fontSize: 22, fontWeight: 700 }}>Chatbots</div><div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>Manage your chatbots</div></div>
        <div style={{ display: "flex", gap: 10 }}>
          <input ref={fileRef} type="file" accept="application/json" onChange={importBot} style={{ display: "none" }} />
          <button style={btnGhost} onClick={() => fileRef.current?.click()}>⬆ Import</button>
          <button style={btnPrimary} onClick={createBot}>＋ Create Chatbot</button>
        </div>
      </div>
      {msg && <div style={{ margin: "0 28px 8px", color: "#dc2626", fontSize: 13 }}>{msg}</div>}
      <div style={{ padding: "8px 28px 28px" }}>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.6fr 1.1fr", padding: "12px 16px", background: T.soft, fontSize: 12, fontWeight: 600, color: T.sub, textTransform: "uppercase", letterSpacing: ".03em", borderRadius: "12px 12px 0 0" }}>
            <div>Name</div><div>Status</div><div>Number / Inbox</div><div style={{ textAlign: "right" }}>Actions</div>
          </div>
          {flows === null && <div style={{ padding: 20, color: T.sub, fontSize: 13 }}>Loading…</div>}
          {flows && flows.length === 0 && <div style={{ padding: 24, color: T.sub, fontSize: 13 }}>No chatbots yet. Click "Create Chatbot" to get started.</div>}
          {flows && flows.map((f) => {
            const cur = f.inbox_id ?? ""; const sel = pendingInbox[f.id] !== undefined ? pendingInbox[f.id] : cur;
            const dirty = pendingInbox[f.id] !== undefined && String(pendingInbox[f.id]) !== String(cur);
            return (
              <div key={f.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.6fr 1.1fr", alignItems: "center", padding: "14px 16px", borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                <div><span style={pill(f.status)}>{f.status}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select value={sel} onChange={(e) => setPendingInbox((p) => ({ ...p, [f.id]: e.target.value }))} style={{ padding: "6px 8px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, fontFamily: T.font, color: T.text, background: "#fff", maxWidth: 170 }}>
                    <option value="">— None (off)</option>
                    {inboxes.map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
                  </select>
                  {dirty && <button onClick={() => saveInbox(f)} style={{ padding: "6px 12px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Save</button>}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                  <button style={{ ...btnGhost, padding: "6px 14px" }} onClick={() => onEdit(f.id)}>Edit</button>
                  <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuOpen(menuOpen && menuOpen.id === f.id ? null : { id: f.id, x: r.right, y: r.bottom }); }} style={{ width: 32, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 18, lineHeight: "16px", color: T.sub }}>⋮</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {menuOpen && (() => {
        const f = (flows || []).find((x) => x.id === menuOpen.id); if (!f) return null;
        const items = [["Edit", () => { setMenuOpen(null); onEdit(f.id); }], ["Duplicate", () => duplicate(f)], ["Export", () => exportBot(f)], ["Delete", () => { setMenuOpen(null); setConfirmDel(f); }]];
        return (<>
          <div onClick={() => setMenuOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "fixed", top: menuOpen.y + 6, left: menuOpen.x - 160, width: 160, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,.16)", zIndex: 100, overflow: "hidden" }}>
            {items.map(([lbl, fn]) => (<div key={lbl} onClick={fn} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: lbl === "Delete" ? "#dc2626" : T.text, borderTop: lbl === "Delete" ? `1px solid ${T.border}` : "none" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.soft)} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>{lbl}</div>))}
          </div>
        </>);
      })()}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 24, width: 360, fontFamily: T.font }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete chatbot?</div>
            <div style={{ fontSize: 13, color: T.sub, marginBottom: 18 }}>"{confirmDel.name}" will be permanently deleted.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
              <button style={{ ...btnPrimary, background: "#dc2626" }} onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== GALLERY (DARK) =====================
function Gallery() {
  const [media, setMedia] = useState(null);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const load = async () => { try { const j = await (await fetch(`${API}/api/media?account_id=${ACCOUNT_ID}`)).json(); setMedia(j.media || []); } catch { setMedia([]); setMsg("Couldn't load media — is the bot engine running?"); } };
  useEffect(() => { load(); }, []);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = ""; if (!files.length) return;
    setUploading(true); setMsg(""); let fail = 0;
    for (const file of files) { try { const fd = new FormData(); fd.append("file", file); fd.append("account_id", String(ACCOUNT_ID)); const j = await (await fetch(`${API}/api/upload`, { method: "POST", body: fd })).json(); if (!j.ok) fail++; } catch { fail++; } }
    setUploading(false); if (fail) setMsg(`${fail} file(s) failed to upload.`); await load();
  };
  const doDelete = async () => { const m = confirmDel; setConfirmDel(null); if (!m) return; try { await fetch(`${API}/api/media/${m.id}`, { method: "DELETE" }); await load(); } catch { setMsg("Delete failed."); } };
  const doCopy = (m) => { if (copyText(m.url)) { setCopiedId(m.id); setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500); } else setMsg("Copy failed — please copy the link manually."); };

  const list = (media || []).filter((m) => filter === "all" || m.type === filter);
  const counts = (media || []).reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; }, {});
  const filters = [["all", "All"], ["image", "Images"], ["video", "Videos"], ["audio", "Audio"], ["document", "Docs"]];
  const primary = { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, cursor: uploading ? "default" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.font, opacity: uploading ? .75 : 1 };

  return (
    <div style={{ minHeight: "100vh", background: D.bg, fontFamily: T.font, color: D.text }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: D.panel, borderBottom: `1px solid ${D.border}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: D.text }}>Media Gallery</div>
          <div style={{ fontSize: 12.5, color: D.sub, marginTop: 2 }}>Images, videos, audio &amp; documents to use in your chatbots</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf" onChange={onFiles} style={{ display: "none" }} />
          <button className="cs-pub" style={primary} onClick={() => !uploading && fileRef.current?.click()}>{uploading ? "Uploading…" : "⬆ Upload media"}</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0", flexWrap: "wrap" }}>
        {filters.map(([key, lbl]) => { const active = filter === key; const n = key === "all" ? (media || []).length : (counts[key] || 0); return (<button key={key} onClick={() => setFilter(key)} style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: T.font, border: `1px solid ${active ? ACCENT : D.border}`, background: active ? hexA(ACCENT, .16) : D.panel2, color: active ? "#93c5fd" : D.sub }}>{lbl}{media ? ` · ${n}` : ""}</button>); })}
      </div>
      {msg && <div style={{ margin: "14px 24px 0", padding: "10px 14px", background: hexA(NC.stop, .12), border: `1px solid ${hexA(NC.stop, .4)}`, color: "#fda4af", borderRadius: 8, fontSize: 13 }}>{msg}</div>}
      <div style={{ padding: 24 }}>
        {media === null && <div style={{ color: D.sub, fontSize: 14, padding: 20 }}>Loading…</div>}
        {media && list.length === 0 && (
          <div style={{ border: `1px dashed ${D.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", color: D.sub, background: D.panel2 }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🖼️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: D.text, marginBottom: 4 }}>{filter === "all" ? "No media yet" : "No files of this type"}</div>
            <div style={{ fontSize: 13 }}>Click "Upload media" above to add files.</div>
          </div>
        )}
        {media && list.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 16 }}>
            {list.map((m) => {
              const meta = GTYPE[m.type] || GTYPE.document; const name = m.original_name || m.filename || "file";
              return (
                <div key={m.id} className="cs-gcard" style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden", transition: "transform .15s, border-color .15s" }}>
                  <div style={{ position: "relative", height: 150, background: D.input, display: "grid", placeItems: "center", overflow: "hidden" }}>
                    {m.type === "image" ? (<img src={m.url} alt={name} onClick={() => setPreview(m)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }} />)
                      : m.type === "video" ? (<video src={m.url} preload="metadata" muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />)
                      : (<div style={{ fontSize: 44 }}>{meta.icon}</div>)}
                    <span style={{ position: "absolute", top: 8, left: 8, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: hexA(meta.color, .22), color: meta.color, border: `1px solid ${hexA(meta.color, .5)}` }}>{meta.label}</span>
                  </div>
                  <div style={{ padding: "10px 12px 12px" }}>
                    <div title={name} style={{ fontSize: 13, fontWeight: 600, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                    <div style={{ fontSize: 11, color: D.faint, marginTop: 2 }}>{fmtSize(m.size)}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => doCopy(m)} style={{ flex: 1, padding: "7px 8px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: T.font, border: `1px solid ${D.border}`, background: copiedId === m.id ? hexA(NC.buttons, .18) : D.panel2, color: copiedId === m.id ? "#4ade80" : D.text }}>{copiedId === m.id ? "✓ Copied" : "🔗 Copy link"}</button>
                      <button onClick={() => setConfirmDel(m)} title="Delete" style={{ width: 36, padding: "7px 0", borderRadius: 7, cursor: "pointer", fontSize: 13, border: `1px solid ${hexA(NC.stop, .5)}`, background: hexA(NC.stop, .08), color: "#fb7185" }}>🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 14, padding: 22, width: 360, maxWidth: "100%", fontFamily: T.font }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: D.text, marginBottom: 8 }}>Delete media?</div>
            <div style={{ fontSize: 13, color: D.sub, marginBottom: 18 }}>"{confirmDel.original_name || confirmDel.filename || "file"}" will be permanently deleted.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDel(null)} style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: T.font, border: `1px solid ${D.border}`, background: D.panel2, color: D.text }}>Cancel</button>
              <button onClick={doDelete} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.font, border: "none", background: "#dc2626", color: "#fff" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 210, padding: 24, cursor: "zoom-out" }}>
          <img src={preview.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}

// ===================== MEDIA PICKER =====================
function MediaPicker({ onPick, onClose }) {
  const [media, setMedia] = useState(null);
  const [filter, setFilter] = useState("all");
  useEffect(() => { (async () => { try { const j = await (await fetch(`${API}/api/media?account_id=${ACCOUNT_ID}`)).json(); setMedia(j.media || []); } catch { setMedia([]); } })(); }, []);
  const list = (media || []).filter((m) => filter === "all" || m.type === filter);
  const filters = [["all", "All"], ["image", "Images"], ["video", "Videos"], ["audio", "Audio"], ["document", "Docs"]];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", background: D.panel, border: `1px solid ${D.border}`, borderRadius: 14, fontFamily: T.font, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${D.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: D.text }}>Choose media</div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: `1px solid ${D.border}`, background: D.panel2, color: D.sub, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontFamily: T.font }}>✕ Close</button>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "12px 18px 0", flexWrap: "wrap" }}>
          {filters.map(([k, l]) => { const act = filter === k; return <button key={k} onClick={() => setFilter(k)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font, border: `1px solid ${act ? ACCENT : D.border}`, background: act ? hexA(ACCENT, .18) : D.panel2, color: act ? "#93c5fd" : D.sub }}>{l}</button>; })}
        </div>
        <div style={{ padding: 18, overflowY: "auto" }}>
          {media === null && <div style={{ color: D.sub, fontSize: 14 }}>Loading…</div>}
          {media && list.length === 0 && <div style={{ color: D.sub, fontSize: 14, padding: "20px 0", textAlign: "center" }}>No media yet. Upload some in the Gallery first.</div>}
          {media && list.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {list.map((m) => { const meta = GTYPE[m.type] || GTYPE.document; const name = m.original_name || m.filename || "file"; return (
                <div key={m.id} onClick={() => onPick(m)} className="cs-gcard" style={{ cursor: "pointer", background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden", transition: "transform .15s, border-color .15s" }}>
                  <div style={{ position: "relative", height: 104, background: D.input, display: "grid", placeItems: "center", overflow: "hidden" }}>
                    {m.type === "image" ? <img src={m.url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.type === "video" ? <video src={m.url} preload="metadata" muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontSize: 36 }}>{meta.icon}</div>}
                    <span style={{ position: "absolute", top: 6, left: 6, padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: hexA(meta.color, .22), color: meta.color, border: `1px solid ${hexA(meta.color, .5)}` }}>{meta.label}</span>
                  </div>
                  <div style={{ padding: "7px 9px" }}>
                    <div title={name} style={{ fontSize: 12, fontWeight: 600, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                    <div style={{ fontSize: 10.5, color: D.faint, marginTop: 1 }}>{fmtSize(m.size)}</div>
                  </div>
                </div>
              ); })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== EDITOR (DARK) =====================
function Editor({ flowId, onBack }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([startNode()]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("Loading…");
  const [name, setName] = useState("");
  const [flowStatus, setFlowStatus] = useState("draft");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState("media");
  const [allLabels, setAllLabels] = useState([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [search, setSearch] = useState("");
  const idRef = useRef(1);

  useEffect(() => {
    (async () => {
      try { const j = await (await fetch(`${API}/api/flows/${flowId}`)).json(); setName(j.flow.name || ""); setFlowStatus(j.flow.status); const { nodes: n, edges: e } = fromEngineFormat(j.flow.definition || { start: null, nodes: {} }); setNodes(n); setEdges(e); idRef.current = n.length + 5; setStatus("Loaded"); } catch { setStatus("Load failed"); }
    })();
  }, [flowId]);
  useEffect(() => { (async () => { try { const j = await (await fetch(`${API}/api/labels?account_id=${ACCOUNT_ID}`)).json(); setAllLabels(j.labels || []); } catch { setAllLabels([]); } })(); }, []);

  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, type: "deletable", animated: true }, eds)), [setEdges]);
  const onDeleteEdge = useCallback((id) => setEdges((es) => es.filter((e) => e.id !== id)), [setEdges]);
  const addNode = (kind) => { const id = `n${++idRef.current}`; setNodes((nds) => [...nds, { id, type: kind, position: { x: 360 + Math.random() * 60, y: 200 + nds.length * 40 }, data: defaultData(kind) }]); setSelectedId(id); };
  const updateData = (id, patch) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  const selected = nodes.find((n) => n.id === selectedId) || null;
  const setHeader = (h) => selected && updateData(selected.id, { header: h });
  const setSections = (mut) => { if (!selected) return; const secs = JSON.parse(JSON.stringify(selected.data.sections || [])); mut(secs); updateData(selected.id, { sections: secs }); };
  const setCond = (i, patch) => { if (!selected) return; const arr = (selected.data.conditions || []).map((c, j) => (j === i ? { ...c, ...patch } : c)); updateData(selected.id, { conditions: arr }); };

  async function save(publish) {
    const definition = toEngineFormat(nodes, edges);
    if (publish && !definition.start) { setStatus("⚠️ Connect Start to a node first"); return; }
    setStatus(publish ? "Publishing…" : "Saving…");
    try {
      await fetch(`${API}/api/flows/${flowId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, definition }) });
      if (publish) { const j = await (await fetch(`${API}/api/flows/${flowId}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json(); if (j.ok) { setFlowStatus("published"); setStatus("✅ Published (live)"); } else setStatus("Error: " + (j.error || "")); }
      else setStatus("✅ Saved (draft)");
    } catch { setStatus("Save failed"); }
  }
  async function unpublish() { try { const j = await (await fetch(`${API}/api/flows/${flowId}/unpublish`, { method: "POST" })).json(); if (j.ok) { setFlowStatus("draft"); setStatus("Unpublished"); } } catch { setStatus("Failed"); } }

  const dGhost = { padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: T.font, border: `1px solid ${D.border}`, background: D.panel2, color: D.text };
  const q = search.trim().toLowerCase();
  const curTags = selected && selected.type === "tag" ? (selected.data.labels || "").split(",").map((x) => x.trim()).filter(Boolean) : [];
  const toggleTag = (l) => { const next = curTags.includes(l) ? curTags.filter((x) => x !== l) : [...curTags, l]; updateData(selected.id, { labels: next.join(", ") }); };

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: T.font, background: D.bg }}>
      <div style={{ height: 56, background: D.panel, borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <button onClick={onBack} style={dGhost}>← Back</button>
        <input className="cs-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chatbot name" style={{ borderRadius: 8, padding: "7px 10px", fontSize: 14, fontWeight: 600, fontFamily: T.font, minWidth: 200 }} />
        <span style={{ fontSize: 12, color: D.sub }}>{status}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {flowStatus === "published" && <button onClick={unpublish} style={{ ...dGhost, color: D.sub }}>Unpublish</button>}
          <button onClick={() => save(false)} style={dGhost}>Save Draft</button>
          <button className="cs-pub" onClick={() => save(true)} style={{ padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: T.font, border: "none", background: "#16A34A", color: "#fff", fontWeight: 700 }}>Publish</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 222, background: D.panel, borderRight: `1px solid ${D.border}`, padding: 12, overflowY: "auto" }}>
          <input className="cs-in" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search components…" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 12.5, boxSizing: "border-box", fontFamily: T.font, marginBottom: 12 }} />
          {PALETTE.map((grp) => {
            const items = grp.items.filter((it) => !q || it.label.toLowerCase().includes(q));
            if (!items.length) return null;
            return (
              <div key={grp.group} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: D.faint, margin: "6px 2px 8px", textTransform: "uppercase", letterSpacing: ".08em" }}>{grp.group}</div>
                {items.map((p) => (
                  <button key={p.kind} className="cs-pal" onClick={() => addNode(p.kind)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 7, padding: "10px 11px", border: `1px solid ${D.border}`, borderRadius: 9, background: D.panel2, color: D.text, cursor: "pointer", fontSize: 12.5, fontWeight: 500, fontFamily: T.font, transition: "all .12s" }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: hexA(p.color, .14), color: p.color, fontSize: 12 }}>{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: D.faint, marginTop: 10, lineHeight: 1.6 }}>Click a node to add it, then connect the dots. Click the <b style={{ color: "#fb7185" }}>✕</b> on a line to remove a connection.</div>
        </div>

        <div style={{ flex: 1, background: D.bg }}>
          <EdgeCtx.Provider value={{ onDeleteEdge }}>
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={{ type: "deletable", animated: true }} onNodeClick={(_, n) => { setSelectedId(n.id); setTagOpen(false); }} onPaneClick={() => { setSelectedId(null); setTagOpen(false); }} fitView>
              <Background color="#1a2230" gap={20} size={1} />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(n) => NC[n.type] || ACCENT} maskColor="rgba(7,10,16,.7)" />
            </ReactFlow>
          </EdgeCtx.Provider>
        </div>

        {selected && (
          <div style={{ width: 304, background: D.panel, borderLeft: `1px solid ${D.border}`, padding: 16, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: D.faint, textTransform: "uppercase", letterSpacing: ".06em" }}>Edit node</div>
              <button onClick={() => setSelectedId(null)} title="Close" style={{ marginLeft: "auto", width: 26, height: 26, borderRadius: 7, border: `1px solid ${D.border}`, background: D.panel2, color: D.sub, cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>

            {selected.type === "start" && (<Ed title="⚡ On Message (Start)"><Lb>Keywords (optional)</Lb><In value={selected.data.keywords || ""} onChange={(v) => updateData(selected.id, { keywords: v })} placeholder="hi, hello, menu" /><Tog on={!!selected.data.fuzzy} onClick={() => updateData(selected.id, { fuzzy: !selected.data.fuzzy })} label="Enable fuzzy matching" /><Hn>Leave keywords empty to start on any message. With keywords, the bot only starts when the message matches one.</Hn></Ed>)}

            {selected.type === "text" && (<Ed title="💬 Send Text"><Lb>Message</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Ed>)}

            {selected.type === "buttons" && (<Ed title="🔘 Send Buttons">
              <HeaderField header={selected.data.header} setHeader={setHeader} openPicker={() => { setPickerFor("header"); setPickerOpen(true); }} />
              <Lb>Body text</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} />
              <Lb>Buttons (max 3)</Lb>
              {(selected.data.buttons || []).map((b, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}><In value={b.title} maxLength={20} onChange={(v) => { const arr = [...selected.data.buttons]; arr[i] = { ...arr[i], title: v }; updateData(selected.id, { buttons: arr }); }} placeholder={`Button ${i + 1}`} /><button onClick={() => updateData(selected.id, { buttons: selected.data.buttons.filter((_, j) => j !== i) })} style={delMini}>✕</button></div>))}
              {(selected.data.buttons || []).length < 3 && <button onClick={() => updateData(selected.id, { buttons: [...(selected.data.buttons || []), { title: "" }] })} style={addBtn(NC.buttons)}>+ Add Button</button>}
              <Lb>Footer (optional)</Lb><In value={selected.data.footer || ""} maxLength={60} onChange={(v) => updateData(selected.id, { footer: v })} placeholder="Footer text" />
              <Hn>WhatsApp allows up to 3 buttons (max 20 chars each). Connect each button's right dot to the next node.</Hn></Ed>)}

            {selected.type === "list" && (<Ed title="📋 Send List">
              <HeaderField header={selected.data.header} setHeader={setHeader} openPicker={() => { setPickerFor("header"); setPickerOpen(true); }} />
              <Lb>Body text</Lb><Ar value={selected.data.body || ""} onChange={(v) => updateData(selected.id, { body: v })} />
              <Lb>List button label</Lb><In value={selected.data.button || ""} maxLength={20} onChange={(v) => updateData(selected.id, { button: v })} placeholder="View options" />
              <Lb>Sections &amp; rows</Lb>
              {(selected.data.sections || []).map((sec, si) => (
                <div key={si} style={{ border: `1px solid ${D.border}`, borderRadius: 9, padding: 9, marginBottom: 9, background: D.panel2 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <In value={sec.title} maxLength={24} onChange={(v) => setSections((s) => { s[si].title = v; })} placeholder={`Section ${si + 1} title (optional)`} />
                    {(selected.data.sections || []).length > 1 && <button onClick={() => setSections((s) => { s.splice(si, 1); })} style={delMini}>✕</button>}
                  </div>
                  {(sec.rows || []).map((row, ri) => (
                    <div key={ri} style={{ border: `1px solid ${D.border}`, borderRadius: 8, padding: 7, marginBottom: 7, background: D.input }}>
                      <div style={{ display: "flex", gap: 6 }}><In value={row.title} maxLength={24} onChange={(v) => setSections((s) => { s[si].rows[ri].title = v; })} placeholder={`Row ${ri + 1} title`} /><button onClick={() => setSections((s) => { s[si].rows.splice(ri, 1); })} style={delMini}>✕</button></div>
                      <div style={{ height: 6 }} /><In value={row.description || ""} maxLength={72} onChange={(v) => setSections((s) => { s[si].rows[ri].description = v; })} placeholder="Description (optional)" />
                    </div>
                  ))}
                  {listRowCount(selected.data.sections) < 10 && <button onClick={() => setSections((s) => { s[si].rows.push({ title: "", description: "" }); })} style={addBtn(NC.list)}>+ Add Row</button>}
                </div>
              ))}
              <button onClick={() => setSections((s) => { s.push({ title: "", rows: [{ title: "", description: "" }] }); })} style={{ ...addBtn(NC.list), borderStyle: "solid" }}>+ Add Section</button>
              <Lb>Footer (optional)</Lb><In value={selected.data.footer || ""} maxLength={60} onChange={(v) => updateData(selected.id, { footer: v })} placeholder="Footer text" />
              <Hn>Up to 10 rows total across sections. Connect each row's right dot to the next node.</Hn></Ed>)}

            {selected.type === "media" && (<Ed title="🖼️ Send Media">
              {selected.data.url ? (<div style={{ marginBottom: 10 }}>
                {selected.data.mediaType === "image" ? <img src={selected.data.url} alt="" style={{ width: "100%", borderRadius: 8, border: `1px solid ${D.border}` }} />
                  : <div style={{ padding: 10, border: `1px solid ${D.border}`, borderRadius: 8, background: D.input, color: D.sub, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><span>{GTYPE[selected.data.mediaType]?.icon || "📄"}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.data.name || "media"}</span></div>}
              </div>) : null}
              <button onClick={() => { setPickerFor("media"); setPickerOpen(true); }} style={addBtn(NC.media)}>📁 Choose from gallery</button>
              <Lb>Or paste a link</Lb><In value={selected.data.url || ""} onChange={(v) => updateData(selected.id, { url: v, mediaType: guessType(v), name: (v.split("?")[0].split("/").pop() || "") })} placeholder="https://…/file.jpg" />
              <Lb>Caption (optional)</Lb><Ar value={selected.data.caption || ""} onChange={(v) => updateData(selected.id, { caption: v })} />
              <Hn>Audio is auto-converted to MP3 for WhatsApp.</Hn></Ed>)}

            {selected.type === "cta" && (<Ed title="🔗 Send CTA">
              <HeaderField header={selected.data.header} setHeader={setHeader} openPicker={() => { setPickerFor("header"); setPickerOpen(true); }} />
              <Lb>Body text</Lb><Ar value={selected.data.body || ""} onChange={(v) => updateData(selected.id, { body: v })} />
              <Lb>Button text</Lb><In value={selected.data.display || ""} maxLength={20} onChange={(v) => updateData(selected.id, { display: v })} placeholder="Open link" />
              <Lb>URL</Lb><In value={selected.data.url || ""} onChange={(v) => updateData(selected.id, { url: v })} placeholder="https://…" />
              <Lb>Footer (optional)</Lb><In value={selected.data.footer || ""} maxLength={60} onChange={(v) => updateData(selected.id, { footer: v })} placeholder="Footer text" />
              <Hn>Sends your text with a clickable link to the customer.</Hn></Ed>)}

            {selected.type === "question" && (<Ed title="❓ Ask Question">
              <Lb>Message</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} />
              <Lb>Response format</Lb><Sel value={selected.data.responseFormat || "any"} onChange={(v) => updateData(selected.id, { responseFormat: v })} options={RESPONSE_FORMATS} />
              <Lb>Save answer as</Lb><In value={selected.data.saveAs || ""} onChange={(v) => updateData(selected.id, { saveAs: v })} placeholder="name, email…" />
              <Lb>Timeout</Lb>
              <div style={{ display: "flex", gap: 8 }}><input className="cs-in" type="number" min={0} value={selected.data.timeoutValue ?? 0} onChange={(e) => updateData(selected.id, { timeoutValue: e.target.value })} style={{ width: "50%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} /><Sel value={selected.data.timeoutUnit || "seconds"} onChange={(v) => updateData(selected.id, { timeoutUnit: v })} options={[["seconds", "Seconds"], ["minutes", "Minutes"]]} /></div>
              <Hn>0 = no timeout.</Hn>
              <Lb>Timeout message (optional)</Lb><Ar value={selected.data.timeoutMessage || ""} onChange={(v) => updateData(selected.id, { timeoutMessage: v })} />
              <Tog on={!!selected.data.continueOnTimeout} onClick={() => updateData(selected.id, { continueOnTimeout: !selected.data.continueOnTimeout })} label="Continue on timeout" />
              <Hn>If on, the flow continues after timeout; if off, it stops. The reply is validated against the format and re-asked if it doesn't match.</Hn></Ed>)}

            {selected.type === "delay" && (<Ed title="⏱️ Delay"><Lb>Wait</Lb><div style={{ display: "flex", gap: 8 }}><input className="cs-in" type="number" min={1} value={selected.data.value || 1} onChange={(e) => updateData(selected.id, { value: e.target.value })} style={{ width: "50%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} /><Sel value={selected.data.unit || "seconds"} onChange={(v) => updateData(selected.id, { unit: v })} options={[["seconds", "Seconds"], ["minutes", "Minutes"]]} /></div><Hn>Pauses the flow before the next step (max 5 minutes).</Hn></Ed>)}

            {selected.type === "condition" && (<Ed title="🔀 Condition">
              <Lb>Match</Lb><Sel value={selected.data.match || "all"} onChange={(v) => updateData(selected.id, { match: v })} options={[["all", "All conditions"], ["any", "Any condition"]]} />
              <Lb>Conditions</Lb>
              {(selected.data.conditions || []).map((c, i) => { const noSecond = c.operator === "is_email" || c.operator === "is_phone"; return (
                <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 9, padding: 9, marginBottom: 8, background: D.panel2 }}>
                  <In value={c.first} onChange={(v) => setCond(i, { first: v })} placeholder="{{last_message}}" />
                  <div style={{ height: 6 }} /><Sel value={c.operator || "equals"} onChange={(v) => setCond(i, { operator: v })} options={OPERATORS} />
                  {!noSecond && (<><div style={{ height: 6 }} /><In value={c.second} onChange={(v) => setCond(i, { second: v })} placeholder="value to compare" /></>)}
                  {(selected.data.conditions || []).length > 1 && <button onClick={() => updateData(selected.id, { conditions: selected.data.conditions.filter((_, j) => j !== i) })} style={{ ...delMini, marginTop: 8, width: "100%", padding: "6px 0" }}>✕ Remove</button>}
                </div>); })}
              <button onClick={() => updateData(selected.id, { conditions: [...(selected.data.conditions || []), { first: "{{last_message}}", operator: "contains", second: "" }] })} style={addBtn(NC.condition)}>+ Add Condition</button>
              <Hn>Use <b style={{ color: D.sub }}>{"{{last_message}}"}</b> for the user's last message, or <b style={{ color: D.sub }}>{"{{answer}}"}</b> for a saved answer. Connect the green (True) and red (False) dots.</Hn></Ed>)}

            {selected.type === "tag" && (<Ed title="🏷️ Update Tag">
              <Lb>Tags to assign</Lb>
              <div style={{ position: "relative" }}>
                <div onClick={() => setTagOpen((o) => !o)} style={{ minHeight: 38, border: `1px solid ${D.border}`, borderRadius: 7, background: D.input, padding: "6px 8px", cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {curTags.length ? curTags.map((l) => (<span key={l} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: hexA(NC.tag, .16), color: NC.tag, border: `1px solid ${hexA(NC.tag, .4)}` }}>{l}</span>)) : <span style={{ color: D.faint, fontSize: 12.5 }}>Select tags to assign…</span>}
                  <span style={{ marginLeft: "auto", color: D.faint }}>▾</span>
                </div>
                {tagOpen && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 9, zIndex: 50, overflow: "hidden", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
                    <input className="cs-in" autoFocus value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Search or create…" style={{ width: "100%", padding: "8px 10px", borderRadius: 0, border: "none", borderBottom: `1px solid ${D.border}`, fontSize: 12.5, boxSizing: "border-box", fontFamily: T.font }} />
                    <div style={{ maxHeight: 180, overflowY: "auto" }}>
                      {allLabels.filter((l) => l.toLowerCase().includes(tagSearch.toLowerCase())).map((l) => { const on = curTags.includes(l); return (<div key={l} className="cs-row" onClick={() => toggleTag(l)} style={{ padding: "8px 12px", fontSize: 12.5, cursor: "pointer", color: D.text, display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: on ? NC.buttons : D.faint }}>{on ? "✓" : "○"}</span>{l}</div>); })}
                      {tagSearch.trim() && !allLabels.some((l) => l.toLowerCase() === tagSearch.trim().toLowerCase()) && (<div className="cs-row" onClick={() => { toggleTag(tagSearch.trim()); setTagSearch(""); }} style={{ padding: "8px 12px", fontSize: 12.5, cursor: "pointer", color: NC.tag }}>+ Create "{tagSearch.trim()}"</div>)}
                      {allLabels.length === 0 && !tagSearch.trim() && <div style={{ padding: "10px 12px", fontSize: 12, color: D.faint }}>No tags yet — type to create one.</div>}
                    </div>
                  </div>
                )}
              </div>
              <Hn>Adds these labels to the conversation in ChatsSync (existing labels stay).</Hn></Ed>)}

            {selected.type === "stop" && (<Ed title="🛑 Stop Chatbot / Talk to Human"><Lb>Message (optional)</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Hn>Stops the bot and opens the conversation for a human agent.</Hn></Ed>)}

            {selected.deletable !== false && (<button onClick={() => { setNodes((nds) => nds.filter((n) => n.id !== selected.id)); setEdges((e) => e.filter((ed) => ed.source !== selected.id && ed.target !== selected.id)); setSelectedId(null); }} style={{ marginTop: 16, width: "100%", padding: "9px 12px", border: `1px solid ${hexA(NC.stop, .5)}`, color: "#fb7185", background: hexA(NC.stop, .08), borderRadius: 8, cursor: "pointer", fontFamily: T.font, fontSize: 13 }}>Delete node</button>)}
          </div>
        )}
      </div>

      {pickerOpen && selected && (
        <MediaPicker onClose={() => setPickerOpen(false)} onPick={(m) => { if (pickerFor === "header") { setHeader({ ...(selected.data.header || { type: "none", value: "" }), value: m.url }); } else { updateData(selected.id, { url: m.url, mediaType: m.type, name: m.original_name || m.filename || "" }); } setPickerOpen(false); }} />
      )}
    </div>
  );
}

const delMini = { border: `1px solid ${hexA(NC.stop, .5)}`, color: "#fb7185", background: "transparent", borderRadius: 6, cursor: "pointer", padding: "0 10px", fontFamily: T.font, fontSize: 13 };
const addBtn = (c) => ({ marginTop: 4, padding: "9px 12px", border: `1px dashed ${c}`, color: c, background: hexA(c, .08), borderRadius: 8, cursor: "pointer", width: "100%", fontFamily: T.font, fontSize: 13, fontWeight: 600 });

function HeaderField({ header, setHeader, openPicker }) {
  const h = header || { type: "none", value: "" };
  return (<>
    <Lb>Header Type</Lb>
    <Sel value={h.type} onChange={(v) => setHeader({ type: v, value: "" })} options={HEADER_TYPES} />
    {h.type === "text" && (<><div style={{ height: 6 }} /><In value={h.value} maxLength={60} onChange={(v) => setHeader({ type: "text", value: v })} placeholder="Header text" /></>)}
    {(h.type === "image" || h.type === "video" || h.type === "document") && (<><div style={{ height: 6 }} /><button onClick={openPicker} style={addBtn(NC.media)}>📁 Choose header media</button><In value={h.value} onChange={(v) => setHeader({ type: h.type, value: v })} placeholder="https://… or pick from gallery" /></>)}
  </>);
}
function Ed({ title, children }) { return (<div><div style={{ fontWeight: 700, marginBottom: 12, color: D.text, fontSize: 14 }}>{title}</div>{children}</div>); }
function Lb({ children }) { return <div style={{ fontSize: 12, fontWeight: 600, color: D.sub, margin: "10px 0 4px" }}>{children}</div>; }
function Hn({ children }) { return <div style={{ fontSize: 11, color: D.faint, marginTop: 8, lineHeight: 1.5 }}>{children}</div>; }
function In({ value, onChange, placeholder, maxLength }) { return (<input className="cs-in" value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} />); }
function Ar({ value, onChange }) { return (<textarea className="cs-in" value={value} onChange={(e) => onChange(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: T.font }} />); }
function Sel({ value, onChange, options }) { return (<select className="cs-in" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font, cursor: "pointer" }}>{options.map(([v, l]) => (<option key={v} value={v} style={{ background: D.panel2 }}>{l}</option>))}</select>); }
function Tog({ on, onClick, label }) { return (<div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", margin: "10px 0 2px" }}><div style={{ width: 34, height: 20, borderRadius: 999, background: on ? NC.buttons : "#3a4456", position: "relative", transition: "background .15s", flexShrink: 0 }}><div style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} /></div><span style={{ fontSize: 12.5, color: D.text }}>{label}</span></div>); }
