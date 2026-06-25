import { useCallback, useRef, useState, useEffect, createContext, useContext } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getBezierPath,
} from "reactflow";
import "reactflow/dist/style.css";

const params = new URLSearchParams(window.location.search);
const API = (import.meta.env.VITE_API_URL || "https://bot.chatssync.online").replace(/\/$/, "");
const ACCOUNT_ID = parseInt(params.get("account_id") || import.meta.env.VITE_ACCOUNT_ID || "3", 10);

// Light theme (DASHBOARD)
const T = { blue: "#4C84FF", text: "#E8ECF3", sub: "#94A0B4", border: "#242C3A", bg: "#0B0F17", soft: "#161C28", green: "#3BD17F", greenBg: "rgba(46,166,107,.16)", grayPill: "#94A0B4", grayPillBg: "rgba(124,134,150,.16)", font: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
// Dark theme (CANVAS / EDITOR) — clean & professional
const D = { bg: "#0B0F17", panel: "#0F141E", panel2: "#161C28", card: "#161C28", border: "#242C3A", text: "#E8ECF3", sub: "#94A0B4", faint: "#5C6878", input: "#0F1622" };
// Muted, professional accent per node type
const NC = { start: "#5B8DEF", text: "#4C84FF", buttons: "#2EA66B", list: "#9B6DF0", media: "#C8902B", cta: "#3A7DE0", question: "#4F90E8", delay: "#7C8696", condition: "#CC6A2E", tag: "#D9694A", form: "#2B9F94", stop: "#E5524A" };
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
  .cs-tcard:hover{border-color:#39455a!important;transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.4)!important;}
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
    <FooterPreview data={data} /><div style={{ height: 8 }} /><Handle type="source" position={Position.Bottom} id="default" style={hStyle(a)} /></div>);
}
function ListNode({ data, selected }) {
  const a = NC.list; const rows = [];
  eachListRow(data.sections, (row, gi) => { rows.push(<div key={gi} style={itemPill}><div style={{ fontWeight: 600 }}>{row.title || `Row ${gi + 1}`}</div>{row.description ? <div style={small}>{row.description}</div> : null}<Handle type="source" position={Position.Right} id={`row-${gi}`} style={rightHandle(a)} /></div>); });
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="📋" title="Send List" /><HeaderPreview data={data} /><div style={nbody}>{data.body || "…"}{data.button ? <div style={{ marginTop: 4, fontSize: 11, color: a }}>▾ {data.button}</div> : null}</div>{rows}<FooterPreview data={data} /><div style={{ height: 8 }} /><Handle type="source" position={Position.Bottom} id="default" style={hStyle(a)} /></div>);
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
function FormNode({ data, selected }) {
  const a = NC.form; const fields = (data.fields || []).filter((f) => (f.label || "").trim());
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="📝" title="Send Form" />
    <div style={nbody}>{data.intro || "Collect details from the customer"}</div>
    <div style={{ padding: "0 13px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
      {fields.length ? fields.map((fd, i) => (<div key={i} style={{ fontSize: 11.5, color: D.text, display: "flex", gap: 6, alignItems: "center" }}><span style={{ color: a, fontWeight: 700 }}>{i + 1}.</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fd.label}</span></div>)) : <span style={{ fontSize: 12, color: D.faint }}>No fields yet</span>}
    </div>
    <Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>);
}
function StopNode({ data, selected }) { const a = NC.stop; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🛑" title="Stop Chatbot" /><div style={nbody}>{data.text || "(no message — hands over to a human)"}</div></div>); }

const nodeTypes = { start: StartNode, text: TextNode, buttons: ButtonsNode, list: ListNode, media: MediaNode, cta: CtaNode, question: QuestionNode, delay: DelayNode, condition: ConditionNode, tag: TagNode, form: FormNode, stop: StopNode };

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
  if (kind === "form") return { intro: "Please fill this quick form:", fields: [{ label: "Apna naam likhein", key: "naam" }, { label: "Phone number", key: "phone" }], submitMessage: "Shukriya! Hum jald rabta karenge 🙌" };
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
    { kind: "form", label: "Send Form", icon: "📝", color: NC.form },
  ]},
  { group: "Logic", items: [
    { kind: "delay", label: "Delay", icon: "⏱️", color: NC.delay },
    { kind: "condition", label: "Condition", icon: "🔀", color: NC.condition },
    { kind: "tag", label: "Update Tag", icon: "🏷️", color: NC.tag },
    { kind: "stop", label: "Stop Chatbot", icon: "🛑", color: NC.stop },
  ]},
];
const startNode = () => ({ id: "start", type: "start", position: { x: 340, y: 30 }, data: { keywords: "", fuzzy: false, sensitivity: 80 }, deletable: false });
const hdr = (d) => ({ type: (d.header && d.header.type) || "none", value: (d.header && d.header.value) || "" });

function toEngineFormat(nodes, edges) {
  const def = { start: null, trigger: { keywords: [], fuzzy: false, sensitivity: 80 }, layout: {}, nodes: {} };
  const plainNext = {}, btnNext = {}, rowNext = {}, condTrue = {}, condFalse = {};
  for (const e of edges) {
    const h = e.sourceHandle;
    if (h && h.startsWith("btn-")) { (btnNext[e.source] = btnNext[e.source] || {})[h] = e.target; }
    else if (h && h.startsWith("row-")) { (rowNext[e.source] = rowNext[e.source] || {})[h] = e.target; }
    else if (h === "cond-true") condTrue[e.source] = e.target;
    else if (h === "cond-false") condFalse[e.source] = e.target;
    else (plainNext[e.source] = plainNext[e.source] || []).push(e.target);
  }
  const nx = (id) => { const arr = plainNext[id]; if (!arr || !arr.length) return null; return arr.length === 1 ? arr[0] : arr; };
  def.start = (plainNext["start"] || [])[0] || null;
  for (const n of nodes) def.layout[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
  for (const n of nodes) {
    const d = n.data || {};
    if (n.type === "start") { def.trigger = { keywords: (d.keywords || "").split(",").map((x) => x.trim()).filter(Boolean), fuzzy: !!d.fuzzy, sensitivity: parseInt(d.sensitivity, 10) || 80 }; continue; }
    else if (n.type === "text") def.nodes[n.id] = { type: "text", text: d.text || "", next: nx(n.id) };
    else if (n.type === "media") def.nodes[n.id] = { type: "media", url: d.url || "", media_type: d.mediaType || "", name: d.name || "", caption: d.caption || "", next: nx(n.id) };
    else if (n.type === "cta") def.nodes[n.id] = { type: "cta", header: hdr(d), body: d.body || "", display: d.display || "", url: d.url || "", footer: d.footer || "", next: nx(n.id) };
    else if (n.type === "delay") def.nodes[n.id] = { type: "delay", seconds: (d.unit === "minutes" ? (parseInt(d.value, 10) || 0) * 60 : (parseInt(d.value, 10) || 0)), next: nx(n.id) };
    else if (n.type === "tag") def.nodes[n.id] = { type: "tag", labels: (d.labels || "").split(",").map((x) => x.trim()).filter(Boolean), next: nx(n.id) };
    else if (n.type === "form") def.nodes[n.id] = { type: "form", intro: d.intro || "", fields: (d.fields || []).filter((fd) => (fd.label || "").trim()).map((fd, i) => ({ label: fd.label || "", key: (fd.key || "").trim() || ("field_" + (i + 1)) })), submit_message: d.submitMessage || "", sheet_url: (d.sheetUrl || "").trim(), next: nx(n.id) };
    else if (n.type === "stop") def.nodes[n.id] = { type: "handover", text: d.text || "" };
    else if (n.type === "question") def.nodes[n.id] = { type: "question", text: d.text || "", save_as: d.saveAs || "answer", response_format: d.responseFormat || "any", timeout_seconds: (d.timeoutValue ? (d.timeoutUnit === "minutes" ? parseInt(d.timeoutValue, 10) * 60 : parseInt(d.timeoutValue, 10)) : 0), timeout_message: d.timeoutMessage || "", continue_on_timeout: !!d.continueOnTimeout, next: nx(n.id) };
    else if (n.type === "condition") def.nodes[n.id] = { type: "condition", match: d.match || "all", conditions: (d.conditions || []).map((c) => ({ first: c.first || "", operator: c.operator || "equals", second: c.second || "" })), next_true: condTrue[n.id] || null, next_false: condFalse[n.id] || null };
    else if (n.type === "buttons") def.nodes[n.id] = { type: "buttons", header: hdr(d), text: d.text || "", footer: d.footer || "", loop_menu: !!d.loopMenu, text_menu: !!d.textMenu, next: nx(n.id), buttons: (d.buttons || []).map((b, i) => ({ title: b.title || `Button ${i + 1}`, next: (btnNext[n.id] || {})[`btn-${i}`] || null })) };
    else if (n.type === "list") {
      const secs = (d.sections || []).map((sec) => ({ title: sec.title || "", rows: (sec.rows || []).map((r) => ({ title: r.title || "", description: r.description || "" })) }));
      let gi = 0; secs.forEach((sec) => sec.rows.forEach((r) => { r.next = (rowNext[n.id] || {})[`row-${gi}`] || null; gi++; }));
      def.nodes[n.id] = { type: "list", header: hdr(d), body: d.body || "", button: d.button || "", footer: d.footer || "", loop_menu: !!d.loopMenu, text_menu: !!d.textMenu, next: nx(n.id), sections: secs };
    }
  }
  return def;
}
function fromEngineFormat(def) {
  const start = startNode();
  if (def && def.trigger) start.data = { keywords: (def.trigger.keywords || []).join(", "), fuzzy: !!def.trigger.fuzzy, sensitivity: def.trigger.sensitivity || 80 };
  if (def && def.layout && def.layout.start) start.position = def.layout.start;
  const nodes = [start]; const edges = []; const y = 200;
  const pushNext = (srcId, nextVal, handle) => { const arr = Array.isArray(nextVal) ? nextVal : (nextVal ? [nextVal] : []); arr.forEach((t, k) => { if (!t) return; const e = { id: `e-${srcId}-${handle || "n"}${k}`, source: srcId, target: t, type: "deletable", animated: true }; if (handle) e.sourceHandle = handle; edges.push(e); }); };
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
    if (kind === "form") { data.intro = node.intro || ""; data.fields = (node.fields && node.fields.length ? node.fields : [{ label: "", key: "" }]).map((fd) => ({ label: fd.label || "", key: fd.key || "" })); data.submitMessage = node.submit_message || ""; data.sheetUrl = node.sheet_url || ""; }
    if (kind === "buttons") { data.header = node.header || { type: "none", value: "" }; data.text = node.text || ""; data.footer = node.footer || ""; data.loopMenu = !!node.loop_menu; data.textMenu = !!node.text_menu; data.buttons = (node.buttons || []).map((b) => ({ title: b.title })); }
    let normSecs = null;
    if (kind === "list") { data.header = node.header || { type: "none", value: "" }; data.body = node.body || ""; data.button = node.button || ""; data.footer = node.footer || ""; data.loopMenu = !!node.loop_menu; data.textMenu = !!node.text_menu; normSecs = (node.sections && node.sections.length ? node.sections : [{ title: "", rows: node.rows || [] }]); data.sections = normSecs.map((sec) => ({ title: sec.title || "", rows: (sec.rows || []).map((r) => ({ title: r.title, description: r.description || "" })) })); }
    nodes.push({ id, type: kind, position: (def.layout && def.layout[id]) ? def.layout[id] : { x: 340 + (idx % 2) * 330, y: y + idx * 135 }, data });
    if (kind === "buttons") { (node.buttons || []).forEach((b, i) => { if (b.next) edges.push({ id: `e-${id}-b${i}`, source: id, sourceHandle: `btn-${i}`, target: b.next, type: "deletable", animated: true }); }); pushNext(id, node.next, "default"); }
    else if (kind === "list") { let gi = 0; (normSecs || []).forEach((sec) => (sec.rows || []).forEach((r) => { if (r.next) edges.push({ id: `e-${id}-r${gi}`, source: id, sourceHandle: `row-${gi}`, target: r.next, type: "deletable", animated: true }); gi++; })); pushNext(id, node.next, "default"); }
    else if (kind === "condition") { if (node.next_true) edges.push({ id: `e-${id}-t`, source: id, sourceHandle: "cond-true", target: node.next_true, type: "deletable", animated: true }); if (node.next_false) edges.push({ id: `e-${id}-f`, source: id, sourceHandle: "cond-false", target: node.next_false, type: "deletable", animated: true }); }
    else pushNext(id, node.next);
  });
  if (def && def.start) edges.push({ id: "e-start", source: "start", target: def.start, type: "deletable", animated: true });
  return { nodes, edges };
}

export default function App() {
  const qv = params.get("view");
  const initialView = qv === "gallery" ? "gallery" : qv === "templates" ? "templates" : "dashboard";
  const [view, setView] = useState(initialView);
  const [editId, setEditId] = useState(null);
  useEffect(() => { injectFont(); injectStyles(); }, []);
  if (view === "gallery") return <Gallery />;
  if (view === "templates") return <Templates />;
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
  const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: T.soft, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: T.font };
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
      {msg && <div style={{ margin: "0 28px 8px", color: "#F87171", fontSize: 13 }}>{msg}</div>}
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
                  <select value={sel} onChange={(e) => setPendingInbox((p) => ({ ...p, [f.id]: e.target.value }))} style={{ padding: "6px 8px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, fontFamily: T.font, color: T.text, background: D.input, colorScheme: "dark", maxWidth: 170 }}>
                    <option value="">— None (off)</option>
                    {inboxes.map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
                  </select>
                  {dirty && <button onClick={() => saveInbox(f)} style={{ padding: "6px 12px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Save</button>}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                  <button style={{ ...btnGhost, padding: "6px 14px" }} onClick={() => onEdit(f.id)}>Edit</button>
                  <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuOpen(menuOpen && menuOpen.id === f.id ? null : { id: f.id, x: r.right, y: r.bottom }); }} style={{ width: 32, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, background: T.soft, cursor: "pointer", fontSize: 18, lineHeight: "16px", color: T.sub }}>⋮</button>
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
          <div style={{ position: "fixed", top: menuOpen.y + 6, left: menuOpen.x - 160, width: 160, background: "#161C28", border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,.5)", zIndex: 100, overflow: "hidden" }}>
            {items.map(([lbl, fn]) => (<div key={lbl} onClick={fn} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: lbl === "Delete" ? "#F87171" : T.text, borderTop: lbl === "Delete" ? `1px solid ${T.border}` : "none" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.soft)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>{lbl}</div>))}
          </div>
        </>);
      })()}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#161C28", borderRadius: 12, padding: 24, width: 360, fontFamily: T.font, color: T.text, border: `1px solid ${T.border}` }}>
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
  const reopenGuard = useRef(false);
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
  const rfRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    (async () => {
      try { const j = await (await fetch(`${API}/api/flows/${flowId}`)).json(); setName(j.flow.name || ""); setFlowStatus(j.flow.status); const { nodes: n, edges: e } = fromEngineFormat(j.flow.definition || { start: null, nodes: {} }); setNodes(n); setEdges(e); idRef.current = n.reduce((m, x) => Math.max(m, parseInt(String(x.id).replace(/\D/g, ""), 10) || 0), 1); setStatus("Loaded"); } catch { setStatus("Load failed"); }
    })();
  }, [flowId]);
  useEffect(() => { (async () => { try { const j = await (await fetch(`${API}/api/labels?account_id=${ACCOUNT_ID}`)).json(); setAllLabels(j.labels || []); } catch { setAllLabels([]); } })(); }, []);

  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, type: "deletable", animated: true }, eds)), [setEdges]);
  const onDeleteEdge = useCallback((id) => setEdges((es) => es.filter((e) => e.id !== id)), [setEdges]);
  const addNode = (kind, pos) => {
    const id = `n${++idRef.current}`;
    let position = pos;
    if (!position) {
      const k = idRef.current % 6;
      let base = { x: 440, y: 150 };
      try { if (rfRef.current && rfRef.current.screenToFlowPosition) base = rfRef.current.screenToFlowPosition({ x: window.innerWidth * 0.52, y: window.innerHeight * 0.40 }); } catch (e) {}
      position = { x: base.x + k * 46, y: base.y + k * 70 };
    }
    setNodes((nds) => [...nds, { id, type: kind, position, data: defaultData(kind) }]);
    setSelectedId(id);
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData("application/cs-node");
    if (!kind) return;
    let position; const inst = rfRef.current;
    try {
      if (inst && inst.screenToFlowPosition) position = inst.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      else if (inst && inst.project && wrapperRef.current) { const b = wrapperRef.current.getBoundingClientRect(); position = inst.project({ x: e.clientX - b.left, y: e.clientY - b.top }); }
    } catch (err) {}
    addNode(kind, position);
  };
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
                  <button key={p.kind} className="cs-pal" draggable onDragStart={(e) => { e.dataTransfer.setData("application/cs-node", p.kind); e.dataTransfer.effectAllowed = "move"; }} onClick={() => addNode(p.kind)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 7, padding: "10px 11px", border: `1px solid ${D.border}`, borderRadius: 9, background: D.panel2, color: D.text, cursor: "pointer", fontSize: 12.5, fontWeight: 500, fontFamily: T.font, transition: "all .12s" }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: hexA(p.color, .14), color: p.color, fontSize: 12 }}>{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: D.faint, marginTop: 10, lineHeight: 1.6 }}>Drag a node onto the canvas (or click to add), then connect the dots. Click the <b style={{ color: "#fb7185" }}>✕</b> on a line to remove a connection.</div>
        </div>

        <div ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop} style={{ flex: 1, background: D.bg }}>
          <EdgeCtx.Provider value={{ onDeleteEdge }}>
            <ReactFlow nodes={nodes} edges={edges} onInit={(inst) => { rfRef.current = inst; }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={{ type: "deletable", animated: true }} onNodeClick={(_, n) => { if (reopenGuard.current) return; setSelectedId(n.id); setTagOpen(false); }} onSelectionChange={({ nodes: sel }) => { if (reopenGuard.current) return; if (sel && sel.length === 1) { setSelectedId(sel[0].id); setTagOpen(false); } }} onPaneClick={() => { setSelectedId(null); setTagOpen(false); }} fitView>
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
              <button onClick={() => { reopenGuard.current = true; setSelectedId(null); setNodes((nds) => nds.map((n) => ({ ...n, selected: false }))); setTimeout(() => { reopenGuard.current = false; }, 300); }} title="Close" style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 7, border: `1px solid ${D.border}`, background: D.panel2, color: D.sub, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>

            {selected.type === "start" && (<Ed title="⚡ On Message (Start)"><Lb>Keywords (optional)</Lb><KeywordChips value={selected.data.keywords || ""} onChange={(v) => updateData(selected.id, { keywords: v })} /><Tog on={!!selected.data.fuzzy} onClick={() => updateData(selected.id, { fuzzy: !selected.data.fuzzy })} label="Enable fuzzy matching" />{selected.data.fuzzy && (<><Lb>Match sensitivity: {selected.data.sensitivity ?? 80}%</Lb><Slider value={selected.data.sensitivity ?? 80} onChange={(v) => updateData(selected.id, { sensitivity: v })} /><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: D.faint, marginTop: 2 }}><span>Exact</span><span>Very loose</span></div></>)}<Hn>No keywords = starts on any message. With fuzzy OFF, only an exact match starts the bot. With fuzzy ON, close/partial matches start it, based on the sensitivity.</Hn></Ed>)}

            {selected.type === "text" && (<Ed title="💬 Send Text"><Lb>Message</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Ed>)}

            {selected.type === "buttons" && (<Ed title="🔘 Send Buttons">
              <HeaderField header={selected.data.header} setHeader={setHeader} openPicker={() => { setPickerFor("header"); setPickerOpen(true); }} />
              <Lb>Body text</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} />
              <Lb>Buttons (max 3)</Lb>
              {(selected.data.buttons || []).map((b, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}><In value={b.title} maxLength={20} onChange={(v) => { const arr = [...selected.data.buttons]; arr[i] = { ...arr[i], title: v }; updateData(selected.id, { buttons: arr }); }} placeholder={`Button ${i + 1}`} /><button onClick={() => updateData(selected.id, { buttons: selected.data.buttons.filter((_, j) => j !== i) })} style={delMini}>✕</button></div>))}
              {(selected.data.buttons || []).length < 3 && <button onClick={() => updateData(selected.id, { buttons: [...(selected.data.buttons || []), { title: "" }] })} style={addBtn(NC.buttons)}>+ Add Button</button>}
              <Lb>Footer (optional)</Lb><In value={selected.data.footer || ""} maxLength={60} onChange={(v) => updateData(selected.id, { footer: v })} placeholder="Footer text" />
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 2, cursor: "pointer", fontSize: 12.5, color: D.text }}><input type="checkbox" checked={!!selected.data.textMenu} onChange={(e) => updateData(selected.id, { textMenu: e.target.checked })} style={{ width: 16, height: 16, accentColor: NC.buttons, cursor: "pointer" }} />Text menu — type a number (never greys out)</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 2, cursor: "pointer", fontSize: 12.5, color: D.text }}><input type="checkbox" checked={!!selected.data.loopMenu} onChange={(e) => updateData(selected.id, { loopMenu: e.target.checked })} style={{ width: 16, height: 16, accentColor: NC.buttons, cursor: "pointer" }} />Keep menu showing after each choice (loop)</label>
              <Hn>WhatsApp allows up to 3 buttons (max 20 chars each). Connect each button's right dot to the next node. “Keep menu showing” re-sends the menu after every choice.</Hn></Ed>)}

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
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 2, cursor: "pointer", fontSize: 12.5, color: D.text }}><input type="checkbox" checked={!!selected.data.textMenu} onChange={(e) => updateData(selected.id, { textMenu: e.target.checked })} style={{ width: 16, height: 16, accentColor: NC.list, cursor: "pointer" }} />Text menu — type a number (never greys out)</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 2, cursor: "pointer", fontSize: 12.5, color: D.text }}><input type="checkbox" checked={!!selected.data.loopMenu} onChange={(e) => updateData(selected.id, { loopMenu: e.target.checked })} style={{ width: 16, height: 16, accentColor: NC.list, cursor: "pointer" }} />Keep menu showing after each choice (loop)</label>
              <Hn>Up to 10 rows total across sections. Connect each row's right dot to the next node. “Keep menu showing” re-sends the list after every choice.</Hn></Ed>)}

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
              <div style={{ fontSize: 11.5, color: D.sub, lineHeight: 1.5, marginBottom: 10, padding: "8px 10px", background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 8 }}>Bot asks this, then <b>waits</b> for the customer's reply, saves it, and moves to the next node. Use the saved value later as <b style={{ color: D.sub }}>{"{{" + (selected.data.saveAs || "answer") + "}}"}</b>.</div>
              <Lb>Message</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} />
              <Lb>Response format</Lb><Sel value={selected.data.responseFormat || "any"} onChange={(v) => updateData(selected.id, { responseFormat: v })} options={RESPONSE_FORMATS} />
              <Hn>“Any response” accepts whatever they type. Other formats re-ask until it matches.</Hn>
              <Lb>Save answer as</Lb><In value={selected.data.saveAs || ""} onChange={(v) => updateData(selected.id, { saveAs: v })} placeholder="name, email…" />
              <Lb>Timeout</Lb>
              <div style={{ display: "flex", gap: 8 }}><input className="cs-in" type="number" min={0} value={selected.data.timeoutValue ?? 0} onChange={(e) => updateData(selected.id, { timeoutValue: e.target.value })} style={{ width: "50%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} /><Sel value={selected.data.timeoutUnit || "seconds"} onChange={(v) => updateData(selected.id, { timeoutUnit: v })} options={[["seconds", "Seconds"], ["minutes", "Minutes"]]} /></div>
              <Hn>0 = no timeout.</Hn>
              <Lb>Timeout message (optional)</Lb><Ar value={selected.data.timeoutMessage || ""} onChange={(v) => updateData(selected.id, { timeoutMessage: v })} />
              <Tog on={!!selected.data.continueOnTimeout} onClick={() => updateData(selected.id, { continueOnTimeout: !selected.data.continueOnTimeout })} label="Continue on timeout" />
              <Hn>No timer = bot simply waits for a reply, then continues. With a timer: if no reply in time, it sends the timeout message and either continues (toggle on) or stops (toggle off).</Hn></Ed>)}

            {selected.type === "delay" && (<Ed title="⏱️ Delay"><Lb>Wait</Lb><div style={{ display: "flex", gap: 8 }}><input className="cs-in" type="number" min={1} value={selected.data.value || 1} onChange={(e) => updateData(selected.id, { value: e.target.value })} style={{ width: "50%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} /><Sel value={selected.data.unit || "seconds"} onChange={(v) => updateData(selected.id, { unit: v })} options={[["seconds", "Seconds"], ["minutes", "Minutes"]]} /></div><Hn>Pauses the flow before the next step (max 5 minutes).</Hn></Ed>)}
            {selected.type === "form" && (<Ed title="📝 Send Form">
              <div style={{ fontSize: 11.5, color: D.sub, lineHeight: 1.5, marginBottom: 10, padding: "8px 10px", background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 8 }}>Bot asks each field one by one, saves every answer, then posts the filled form back in the chat (customer + agent both see it). Each answer is also reusable later as <b style={{ color: D.sub }}>{"{{key}}"}</b>.</div>
              <Lb>Intro message (optional)</Lb><Ar value={selected.data.intro || ""} onChange={(v) => updateData(selected.id, { intro: v })} placeholder="Please fill this quick form:" />
              <Lb>Fields</Lb>
              {(selected.data.fields || []).map((fd, i) => (
                <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 9, padding: 9, marginBottom: 8, background: D.panel2 }}>
                  <Lb>Question {i + 1}</Lb><In value={fd.label} onChange={(v) => { const fs = [...selected.data.fields]; fs[i] = { ...fs[i], label: v }; updateData(selected.id, { fields: fs }); }} placeholder="e.g. Apni location batayein" />
                  <div style={{ height: 6 }} /><Lb>Save as (one word)</Lb><In value={fd.key} onChange={(v) => { const fs = [...selected.data.fields]; fs[i] = { ...fs[i], key: v.replace(/\s+/g, "_") }; updateData(selected.id, { fields: fs }); }} placeholder="location" />
                  {(selected.data.fields || []).length > 1 && <button onClick={() => updateData(selected.id, { fields: selected.data.fields.filter((_, j) => j !== i) })} style={{ ...delMini, marginTop: 8, width: "100%", padding: "6px 0" }}>✕ Remove field</button>}
                </div>
              ))}
              <button onClick={() => updateData(selected.id, { fields: [...(selected.data.fields || []), { label: "", key: "" }] })} style={addBtn(NC.form)}>+ Add Field</button>
              <Lb>Message after submit (optional)</Lb><Ar value={selected.data.submitMessage || ""} onChange={(v) => updateData(selected.id, { submitMessage: v })} placeholder="Shukriya! Hum jald rabta karenge." />
              <Lb>Google Sheet link (optional — auto-saves every answer)</Lb><In value={selected.data.sheetUrl || ""} onChange={(v) => updateData(selected.id, { sheetUrl: v })} placeholder="https://docs.google.com/spreadsheets/d/..." />
              <div style={{ fontSize: 10.5, color: D.faint, marginTop: 4, lineHeight: 1.5 }}>Share the sheet with your bot's service email (Editor access). Each submission becomes a new row; columns are created automatically from the field keys.</div>
              <Hn>Tip: keep “Save as” one word (location, phone, naam) so you can reuse it later as {"{{location}}"}.</Hn></Ed>)}

            {selected.type === "condition" && (<Ed title="🔀 Condition">
              <div style={{ fontSize: 11.5, color: D.sub, lineHeight: 1.5, marginBottom: 10, padding: "8px 10px", background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 8 }}>If the check below is <b style={{ color: NC.buttons }}>true</b> → bot follows the <b style={{ color: NC.buttons }}>green</b> line. If <b style={{ color: NC.stop }}>false</b> → the <b style={{ color: NC.stop }}>red</b> line. By default it checks the customer's last message.</div>
              <Lb>Match</Lb><Sel value={selected.data.match || "all"} onChange={(v) => updateData(selected.id, { match: v })} options={[["all", "All conditions must be true"], ["any", "Any one condition is enough"]]} />
              <Lb>Conditions</Lb>
              {(selected.data.conditions || []).map((c, i) => { const noSecond = c.operator === "is_email" || c.operator === "is_phone"; return (
                <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 9, padding: 9, marginBottom: 8, background: D.panel2 }}>
                  <Lb>Check this</Lb><In value={c.first} onChange={(v) => setCond(i, { first: v })} placeholder="{{last_message}}" />
                  <div style={{ height: 6 }} /><Lb>Operator</Lb><Sel value={c.operator || "equals"} onChange={(v) => setCond(i, { operator: v })} options={OPERATORS} />
                  {!noSecond && (<><div style={{ height: 6 }} /><Lb>Against this value</Lb><In value={c.second} onChange={(v) => setCond(i, { second: v })} placeholder="e.g. yes" /></>)}
                  {(selected.data.conditions || []).length > 1 && <button onClick={() => updateData(selected.id, { conditions: selected.data.conditions.filter((_, j) => j !== i) })} style={{ ...delMini, marginTop: 8, width: "100%", padding: "6px 0" }}>✕ Remove</button>}
                </div>); })}
              <button onClick={() => updateData(selected.id, { conditions: [...(selected.data.conditions || []), { first: "{{last_message}}", operator: "contains", second: "" }] })} style={addBtn(NC.condition)}>+ Add Condition</button>
              <Hn>Keep <b style={{ color: D.sub }}>{"{{last_message}}"}</b> to test the customer's message, or use <b style={{ color: D.sub }}>{"{{answer}}"}</b> for a saved answer. Then drag the green (True) and red (False) dots to the next steps.</Hn></Ed>)}

            {selected.type === "tag" && (<Ed title="🏷️ Update Tag">
              <Lb>Tags to assign</Lb>
              {curTags.length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {curTags.map((l) => (<span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 4px 3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: hexA(NC.tag, .16), color: NC.tag, border: `1px solid ${hexA(NC.tag, .4)}` }}>{l}<span onClick={() => toggleTag(l)} style={{ cursor: "pointer", width: 15, height: 15, borderRadius: "50%", display: "grid", placeItems: "center", background: hexA(NC.tag, .25) }}>×</span></span>))}
              </div>)}
              <input className="cs-in" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Search or type a new tag…" style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${D.border}`, background: D.input, fontSize: 12.5, boxSizing: "border-box", fontFamily: T.font, color: D.text }} />
              <div style={{ marginTop: 6, maxHeight: 170, overflowY: "auto", border: `1px solid ${D.border}`, borderRadius: 8, background: D.panel2 }}>
                {allLabels.filter((l) => l.toLowerCase().includes(tagSearch.toLowerCase())).map((l) => { const on = curTags.includes(l); return (<div key={l} className="cs-row" onClick={() => toggleTag(l)} style={{ padding: "8px 12px", fontSize: 12.5, cursor: "pointer", color: D.text, display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: on ? NC.tag : D.faint }}>{on ? "✓" : "○"}</span>{l}</div>); })}
                {tagSearch.trim() && !allLabels.some((l) => l.toLowerCase() === tagSearch.trim().toLowerCase()) && (<div className="cs-row" onClick={() => { toggleTag(tagSearch.trim()); setTagSearch(""); }} style={{ padding: "8px 12px", fontSize: 12.5, cursor: "pointer", color: NC.tag, fontWeight: 600 }}>+ Create "{tagSearch.trim()}"</div>)}
                {allLabels.length === 0 && !tagSearch.trim() && <div style={{ padding: "10px 12px", fontSize: 12, color: D.faint }}>No tags yet — type above to create one.</div>}
              </div>
              <Hn>Tap a tag to add or remove it. Added labels go on the conversation in ChatsSync (existing ones stay).</Hn></Ed>)}

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
function KeywordChips({ value, onChange }) {
  const [input, setInput] = useState("");
  const chips = (value || "").split(",").map((x) => x.trim()).filter(Boolean);
  const add = (raw) => { const t = (raw || "").trim().replace(/,+$/, "").trim(); if (!t) { setInput(""); return; } if (!chips.some((c) => c.toLowerCase() === t.toLowerCase())) onChange([...chips, t].join(", ")); setInput(""); };
  const remove = (i) => onChange(chips.filter((_, j) => j !== i).join(", "));
  return (
    <div style={{ border: "1px solid #2A3340", borderRadius: 7, background: D.input, padding: "6px 8px", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {chips.map((c, i) => (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 4px 3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: hexA(NC.start, .16), color: NC.start, border: `1px solid ${hexA(NC.start, .4)}` }}>{c}<span onClick={() => remove(i)} style={{ cursor: "pointer", width: 16, height: 16, borderRadius: "50%", display: "grid", placeItems: "center", background: hexA(NC.start, .25) }}>×</span></span>))}
      <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); } else if (e.key === "Backspace" && !input && chips.length) { remove(chips.length - 1); } }} onBlur={() => add(input)} placeholder={chips.length ? "Add keyword…" : "Type a keyword, press Enter"} style={{ flex: 1, minWidth: 120, border: "none", outline: "none", background: "transparent", color: D.text, fontSize: 13, fontFamily: T.font, padding: "3px 0" }} />
    </div>
  );
}
function Slider({ value, onChange }) { return (<input type="range" min={50} max={100} step={5} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: NC.start, cursor: "pointer" }} />); }
function Tog({ on, onClick, label }) { return (<div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", margin: "10px 0 2px" }}><div style={{ width: 34, height: 20, borderRadius: 999, background: on ? NC.buttons : "#3a4456", position: "relative", transition: "background .15s", flexShrink: 0 }}><div style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .15s" }} /></div><span style={{ fontSize: 12.5, color: D.text }}>{label}</span></div>); }
// ════════════════════════════════════════════════════════════════════════════
//  WHATSAPP TEMPLATES — premium builder (sharp UI, rich editor, carousel, preview)
//  Self-contained: only uses theme tokens (T/D/NC/ACCENT) + hexA + helpers already
//  defined at the top of App.jsx. Replaces the old Templates/WaBubble/TemplateCreate.
// ════════════════════════════════════════════════════════════════════════════

const TPL_CATS = [
  ["MARKETING", "Marketing", "Promos, offers & announcements", "📣"],
  ["UTILITY", "Utility", "Order, account & service updates", "🧾"],
  ["AUTHENTICATION", "Authentication", "One-time passcodes", "🔐"],
];
const TPL_HEADER_TYPES = [
  ["none", "None", "—"], ["text", "Text", "🗛"], ["image", "Image", "🖼️"],
  ["video", "Video", "🎬"], ["document", "Document", "📄"],
];
const TPL_LANGS2 = [
  ["en", "English"], ["en_US", "English (US)"], ["en_GB", "English (UK)"], ["ur", "Urdu"], ["hi", "Hindi"],
  ["ar", "Arabic"], ["bn", "Bengali"], ["pa", "Punjabi"], ["es", "Spanish"], ["es_ES", "Spanish (Spain)"],
  ["es_MX", "Spanish (Mexico)"], ["pt_BR", "Portuguese (BR)"], ["pt_PT", "Portuguese (PT)"], ["fr", "French"],
  ["de", "German"], ["it", "Italian"], ["nl", "Dutch"], ["ru", "Russian"], ["tr", "Turkish"], ["id", "Indonesian"],
  ["ms", "Malay"], ["fil", "Filipino"], ["th", "Thai"], ["vi", "Vietnamese"], ["zh_CN", "Chinese (CN)"],
  ["zh_HK", "Chinese (HK)"], ["zh_TW", "Chinese (TW)"], ["ja", "Japanese"], ["ko", "Korean"], ["fa", "Persian"],
  ["ps", "Pashto"], ["af", "Afrikaans"], ["sq", "Albanian"], ["az", "Azerbaijani"], ["bg", "Bulgarian"],
  ["ca", "Catalan"], ["hr", "Croatian"], ["cs", "Czech"], ["da", "Danish"], ["nl_BE", "Dutch (BE)"],
  ["et", "Estonian"], ["fi", "Finnish"], ["el", "Greek"], ["gu", "Gujarati"], ["ha", "Hausa"], ["he", "Hebrew"],
  ["hu", "Hungarian"], ["kn", "Kannada"], ["kk", "Kazakh"], ["ko_KR", "Korean (KR)"], ["lo", "Lao"],
  ["lv", "Latvian"], ["lt", "Lithuanian"], ["mk", "Macedonian"], ["ml", "Malayalam"], ["mr", "Marathi"],
  ["nb", "Norwegian"], ["pl", "Polish"], ["ro", "Romanian"], ["sr", "Serbian"], ["sk", "Slovak"],
  ["sl", "Slovenian"], ["sw", "Swahili"], ["sv", "Swedish"], ["ta", "Tamil"], ["te", "Telugu"], ["uk", "Ukrainian"],
];

function tplStatusMeta(status) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return { dot: "#34d399", bg: "rgba(52,211,153,.13)", color: "#34d399", label: "Approved" };
  if (["PENDING", "IN_APPEAL", "PENDING_DELETION"].includes(s)) return { dot: "#fbbf24", bg: "rgba(251,191,36,.13)", color: "#fbbf24", label: s === "PENDING" ? "In review" : s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") };
  if (["REJECTED", "DISABLED", "PAUSED"].includes(s)) return { dot: "#fb7185", bg: "rgba(251,113,133,.12)", color: "#fb7185", label: s.charAt(0) + s.slice(1).toLowerCase() };
  return { dot: D.faint, bg: "rgba(124,134,150,.12)", color: D.sub, label: s ? s.charAt(0) + s.slice(1).toLowerCase() : "Draft" };
}
function tplCatMeta(cat) {
  const c = String(cat || "").toUpperCase();
  if (c === "MARKETING") return { color: NC.cta, label: "Marketing" };
  if (c === "UTILITY") return { color: NC.buttons, label: "Utility" };
  if (c === "AUTHENTICATION") return { color: NC.list, label: "Authentication" };
  return { color: D.sub, label: c || "—" };
}
function parseTplComponents(components) {
  let header = null, body = "", footer = "", buttons = [], cards = [];
  for (const c of (components || [])) {
    const t = (c.type || "").toUpperCase();
    if (t === "HEADER") header = { format: (c.format || "TEXT").toLowerCase(), text: c.text || "" };
    else if (t === "BODY") body = c.text || "";
    else if (t === "FOOTER") footer = c.text || "";
    else if (t === "BUTTONS") buttons = c.buttons || [];
    else if (t === "CAROUSEL") cards = c.cards || [];
  }
  return { header, body, footer, buttons, cards };
}
function countVars(text) { const m = String(text || "").match(/\{\{\s*\d+\s*\}\}/g); if (!m) return 0; return Math.max(0, ...m.map((x) => parseInt(x.replace(/\D/g, ""), 10))); }
// WhatsApp markdown -> HTML for the live preview (*bold*, _italic_, ~strike~, ```mono```)
function waMarkdownToHtml(text) {
  let s = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\*(.+?)\*/g, "<b>$1</b>").replace(/_(.+?)_/g, "<i>$1</i>").replace(/~(.+?)~/g, "<s>$1</s>").replace(/```(.+?)```/g, "<code>$1</code>");
  s = s.replace(/\n/g, "<br/>");
  return s;
}
function fillVars(text, examples) { return String(text || "").replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => { const v = (examples || [])[parseInt(n, 10) - 1]; return v ? v : "{{" + n + "}}"; }); }

// ─────────────────────────────────────────────────────────────────────────────
//  LIST PAGE
// ─────────────────────────────────────────────────────────────────────────────
function Templates() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [editFrom, setEditFrom] = useState(null);
  const [viewTpl, setViewTpl] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [waba, setWaba] = useState(null);

  const load = async () => {
    setErr("");
    try { const r = await fetch(`${API}/api/templates?account_id=${ACCOUNT_ID}`); const j = await r.json(); if (j.ok) setList(j.templates || []); else { setList([]); setErr(j.error || "Couldn't load templates."); } }
    catch { setList([]); setErr("Couldn't reach the server. Is the bot engine running?"); }
  };
  useEffect(() => { load(); (async () => { try { const j = await (await fetch(`${API}/api/templates/meta?account_id=${ACCOUNT_ID}`)).json(); if (j.ok) setWaba(j); } catch {} })(); }, []);

  const doDelete = async () => { const t = confirmDel; setConfirmDel(null); if (!t) return; try { const j = await (await fetch(`${API}/api/templates?account_id=${ACCOUNT_ID}&name=${encodeURIComponent(t.name)}`, { method: "DELETE" })).json(); if (j.ok) { setMsg(`Deleted "${t.name}".`); load(); } else setErr(j.error || "Delete failed."); } catch { setErr("Delete failed."); } };
  const duplicate = (t) => { setMenuFor(null); const p = parseTplComponents(t.components); setEditFrom({ name: t.name + "_copy", language: t.language, category: t.category, header: p.header, body: p.body, footer: p.footer, buttons: p.buttons, cards: p.cards }); setCreating(true); };

  if (creating) return <TemplateCreate prefill={editFrom} waba={waba} onClose={() => { setCreating(false); setEditFrom(null); }} onDone={() => { setCreating(false); setEditFrom(null); setMsg("Template submitted to WhatsApp for review."); load(); }} />;

  const q = search.trim().toLowerCase();
  const counts = { all: (list || []).length, APPROVED: 0, PENDING: 0, REJECTED: 0 };
  (list || []).forEach((t) => { const s = String(t.status || "").toUpperCase(); if (s === "APPROVED") counts.APPROVED++; else if (["REJECTED", "DISABLED", "PAUSED"].includes(s)) counts.REJECTED++; else counts.PENDING++; });
  const tabs = [["all", "All"], ["APPROVED", "Approved"], ["PENDING", "In review"], ["REJECTED", "Rejected"]];
  const filtered = (list || []).filter((t) => {
    if (q && !(`${t.name} ${t.category} ${t.language}`.toLowerCase().includes(q))) return false;
    if (tab !== "all") { const s = String(t.status || "").toUpperCase(); if (tab === "REJECTED") { if (!["REJECTED", "DISABLED", "PAUSED"].includes(s)) return false; } else if (tab === "PENDING") { if (["APPROVED", "REJECTED", "DISABLED", "PAUSED"].includes(s)) return false; } else if (s !== tab) return false; }
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: D.bg, fontFamily: T.font, color: D.text }}>
      {/* sharp gradient header */}
      <div style={{ borderBottom: `1px solid ${D.border}`, background: `linear-gradient(180deg, ${D.panel2} 0%, ${D.panel} 100%)` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg, ${hexA(NC.buttons, .9)}, ${hexA("#13a884", .9)})`, display: "grid", placeItems: "center", fontSize: 21, boxShadow: `0 6px 18px ${hexA(NC.buttons, .35)}` }}>📨</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em" }}>Message Templates</div>
            <div style={{ fontSize: 12.5, color: D.sub, marginTop: 1 }}>Design, preview &amp; submit WhatsApp templates{waba?.phone ? ` · ${waba.phone}` : ""}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={load} title="Refresh" style={btnIcon()}>↻</button>
            <button className="cs-pub" onClick={() => { setMsg(""); setErr(""); setEditFrom(null); setCreating(true); }} style={btnGreen()}>
              <span style={{ fontSize: 16, lineHeight: 0, marginRight: 2 }}>＋</span> New Template
            </button>
          </div>
        </div>
        {/* segmented tabs */}
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 14px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {tabs.map(([k, l]) => { const on = tab === k; const n = counts[k] ?? 0; return (
            <button key={k} onClick={() => setTab(k)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: T.font, border: `1px solid ${on ? hexA(ACCENT, .55) : D.border}`, background: on ? hexA(ACCENT, .14) : "transparent", color: on ? "#bdd4ff" : D.sub, transition: "all .12s" }}>
              {l}<span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: on ? hexA(ACCENT, .25) : D.panel2, color: on ? "#dbe7ff" : D.faint }}>{n}</span>
            </button>); })}
          <input className="cs-in" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, category…" style={{ marginLeft: "auto", padding: "8px 13px", borderRadius: 9, fontSize: 13, fontFamily: T.font, minWidth: 240 }} />
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 24px 40px" }}>
        {msg && <Banner kind="ok" onX={() => setMsg("")}>{msg}</Banner>}
        {err && <Banner kind="err" onX={() => setErr("")}>{err}</Banner>}

        {list === null && <div style={{ color: D.sub, fontSize: 14, padding: 30, textAlign: "center" }}>Loading templates…</div>}

        {list && filtered.length === 0 && (
          <div style={{ border: `1px dashed ${D.border}`, borderRadius: 16, padding: "60px 24px", textAlign: "center", background: `radial-gradient(120% 100% at 50% 0%, ${hexA(NC.buttons, .05)}, transparent)` }}>
            <div style={{ width: 60, height: 60, margin: "0 auto 16px", borderRadius: 16, background: D.panel2, border: `1px solid ${D.border}`, display: "grid", placeItems: "center", fontSize: 28 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5 }}>{list.length === 0 ? "No templates yet" : "Nothing matches"}</div>
            <div style={{ fontSize: 13, color: D.sub, marginBottom: list.length === 0 ? 20 : 0 }}>{list.length === 0 ? "Create your first WhatsApp template and send it for approval." : "Try a different search or filter."}</div>
            {list.length === 0 && <button className="cs-pub" onClick={() => setCreating(true)} style={{ ...btnGreen(), display: "inline-flex" }}><span style={{ fontSize: 16, marginRight: 2 }}>＋</span> New Template</button>}
          </div>
        )}

        {list && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16 }}>
            {filtered.map((t, i) => { const st = tplStatusMeta(t.status); const cat = tplCatMeta(t.category); const p = parseTplComponents(t.components); const hasCarousel = p.cards.length > 0;
              return (
                <div key={t.id || t.name + i} className="cs-tcard" style={{ position: "relative", background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden", transition: "transform .14s, border-color .14s, box-shadow .14s" }}>
                  <div style={{ height: 3, background: cat.color, opacity: .9 }} />
                  <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />{st.label}</span>
                        <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: hexA(cat.color, .14), color: cat.color, border: `1px solid ${hexA(cat.color, .3)}` }}>{cat.label}</span>
                        <span style={{ fontSize: 11, color: D.faint, fontWeight: 600, textTransform: "uppercase" }}>{t.language}</span>
                      </div>
                    </div>
                    <button onClick={() => setMenuFor(menuFor === (t.id || t.name) ? null : (t.id || t.name))} style={{ width: 30, height: 30, flexShrink: 0, border: `1px solid ${D.border}`, borderRadius: 8, background: D.panel2, color: D.sub, cursor: "pointer", fontSize: 16, lineHeight: "12px" }}>⋯</button>
                  </div>
                  {/* mini message preview */}
                  <div onClick={() => setViewTpl(t)} style={{ margin: "12px 16px 14px", padding: "11px 13px", background: D.input, border: `1px solid ${D.border}`, borderRadius: 10, cursor: "pointer", minHeight: 60 }}>
                    {p.header?.format && p.header.format !== "text" && <div style={{ fontSize: 11, color: D.faint, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>{p.header.format === "image" ? "🖼️" : p.header.format === "video" ? "🎬" : "📄"} {p.header.format} header</div>}
                    {p.header?.format === "text" && p.header.text && <div style={{ fontSize: 12.5, fontWeight: 700, color: D.text, marginBottom: 4 }}>{p.header.text}</div>}
                    <div style={{ fontSize: 12.5, color: D.sub, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: waMarkdownToHtml(p.body) || "<span style='color:" + D.faint + "'>No body</span>" }} />
                    {(p.buttons.length > 0 || hasCarousel) && <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {hasCarousel && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: hexA(NC.list, .16), color: NC.list }}>🎠 {p.cards.length} cards</span>}
                      {p.buttons.slice(0, 3).map((b, k) => <span key={k} style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: hexA(ACCENT, .12), color: "#9ec1ff" }}>{b.type === "URL" ? "🔗" : b.type === "PHONE_NUMBER" ? "📞" : "↩"} {b.text}</span>)}
                    </div>}
                  </div>

                  {menuFor === (t.id || t.name) && (<>
                    <div onClick={() => setMenuFor(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                    <div style={{ position: "absolute", top: 48, right: 14, width: 168, background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 11, boxShadow: "0 14px 34px rgba(0,0,0,.55)", zIndex: 50, overflow: "hidden", padding: 5 }}>
                      {[["👁  Preview", () => { setMenuFor(null); setViewTpl(t); }], ["⧉  Duplicate", () => duplicate(t)], ["↻  Refresh status", () => { setMenuFor(null); load(); }]].map(([l, fn]) => <div key={l} className="cs-row" onClick={fn} style={{ padding: "9px 11px", fontSize: 12.5, cursor: "pointer", color: D.text, borderRadius: 7 }}>{l}</div>)}
                      <div style={{ height: 1, background: D.border, margin: "5px 0" }} />
                      <div className="cs-row" onClick={() => { setMenuFor(null); setConfirmDel(t); }} style={{ padding: "9px 11px", fontSize: 12.5, cursor: "pointer", color: "#fb7185", borderRadius: 7 }}>🗑  Delete</div>
                    </div>
                  </>)}
                </div>
              ); })}
          </div>
        )}
      </div>

      {viewTpl && <TemplatePreviewModal tpl={viewTpl} onClose={() => setViewTpl(null)} onDuplicate={() => { setViewTpl(null); duplicate(viewTpl); }} onDelete={() => { setViewTpl(null); setConfirmDel(viewTpl); }} />}

      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)} width={400}>
          <div style={{ fontWeight: 700, fontSize: 16.5, marginBottom: 8 }}>Delete "{confirmDel.name}"?</div>
          <div style={{ fontSize: 13, color: D.sub, marginBottom: 20, lineHeight: 1.5 }}>This removes the template from WhatsApp across all languages. It can't be undone.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmDel(null)} style={btnGhost()}>Cancel</button>
            <button onClick={doDelete} style={{ ...btnGreen(), background: "#dc2626", boxShadow: "none" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PREVIEW MODAL (read-only, full message render)
// ─────────────────────────────────────────────────────────────────────────────
function TemplatePreviewModal({ tpl, onClose, onDuplicate, onDelete }) {
  const p = parseTplComponents(tpl.components); const st = tplStatusMeta(tpl.status); const cat = tplCatMeta(tpl.category);
  return (
    <Modal onClose={onClose} width={440}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, wordBreak: "break-word" }}>{tpl.name}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />{st.label}</span>
            <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: hexA(cat.color, .14), color: cat.color }}>{cat.label}</span>
            <span style={{ fontSize: 11, color: D.faint, fontWeight: 600, textTransform: "uppercase", alignSelf: "center" }}>{tpl.language}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ ...btnIcon(), width: 32, height: 32 }}>✕</button>
      </div>
      {tpl.rejected_reason && String(tpl.status).toUpperCase() === "REJECTED" && <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 9, background: hexA(NC.stop, .1), border: `1px solid ${hexA(NC.stop, .3)}`, color: "#fda4af", fontSize: 12.5 }}>Rejected: {String(tpl.rejected_reason).replace(/_/g, " ").toLowerCase()}</div>}
      <WaPhone parts={p} />
      <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
        <button onClick={onDelete} style={{ ...btnGhost(), color: "#fb7185", borderColor: hexA(NC.stop, .4) }}>Delete</button>
        <button onClick={onDuplicate} style={btnGreen()}>⧉ Duplicate &amp; edit</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WHATSAPP PHONE PREVIEW (sharp, realistic chat bubble)
// ─────────────────────────────────────────────────────────────────────────────
function WaPhone({ parts, examples }) {
  const { header, body, footer, buttons = [], cards = [] } = parts || {};
  const bodyHtml = waMarkdownToHtml(fillVars(body, examples));
  return (
    <div style={{ borderRadius: 18, padding: 14, background: "linear-gradient(160deg,#0b141a,#111b21)", border: `1px solid ${D.border}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)" }}>
      {/* WA chat wallpaper texture */}
      <div style={{ borderRadius: 12, padding: "16px 12px", background: "repeating-linear-gradient(135deg, rgba(255,255,255,.012) 0 2px, transparent 2px 22px), #0b141a", minHeight: 80 }}>
        <div style={{ maxWidth: 300, marginLeft: 0 }}>
          <div style={{ position: "relative", background: "#1f2c33", borderRadius: "0 8px 8px 8px", padding: 0, overflow: "hidden", boxShadow: "0 1px 1px rgba(0,0,0,.25)" }}>
            {/* media header */}
            {header?.format && ["image", "video", "document"].includes(header.format) && (
              <div style={{ height: header.format === "document" ? 56 : 150, background: "linear-gradient(135deg,#10202a,#15303a)", display: "grid", placeItems: "center", color: "#5b7682", fontSize: header.format === "document" ? 22 : 34, position: "relative" }}>
                {header.previewUrl && header.format === "image" ? <img src={header.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : header.previewUrl && header.format === "video" ? <video src={header.previewUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (header.format === "image" ? "🖼️" : header.format === "video" ? "🎬" : "📄")}
                {header.format === "video" && <div style={{ position: "absolute", width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", color: "#fff", fontSize: 18 }}>▶</div>}
              </div>
            )}
            <div style={{ padding: "7px 9px 8px" }}>
              {header?.format === "text" && header.text && <div style={{ fontSize: 14.5, fontWeight: 700, color: "#e9edef", marginBottom: 3, lineHeight: 1.3 }}>{fillVars(header.text, examples)}</div>}
              <div style={{ fontSize: 14, color: "#e9edef", lineHeight: 1.42, whiteSpace: "pre-wrap", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: bodyHtml || "<span style='color:#6b7c85'>Your message text…</span>" }} />
              {footer && <div style={{ fontSize: 12, color: "#8696a0", marginTop: 5 }}>{footer}</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 3 }}><span style={{ fontSize: 10.5, color: "#8696a0" }}>11:30</span><span style={{ fontSize: 12, color: "#53bdeb" }}>✓✓</span></div>
            </div>
            {/* inline buttons (quick replies render below as separate pills in WA, but show attached for clarity) */}
            {buttons.length > 0 && buttons.some((b) => b.type === "URL" || b.type === "PHONE_NUMBER" || b.type === "COPY_CODE") && (
              <div style={{ borderTop: "1px solid #2a3942" }}>
                {buttons.filter((b) => b.type === "URL" || b.type === "PHONE_NUMBER" || b.type === "COPY_CODE").map((b, i) => (
                  <div key={i} style={{ padding: "9px 0", textAlign: "center", color: "#53bdeb", fontSize: 14, fontWeight: 500, borderTop: i === 0 ? "none" : "1px solid #2a3942", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    {b.type === "URL" ? "🔗" : b.type === "PHONE_NUMBER" ? "📞" : "⧉"} {b.text || (b.type === "COPY_CODE" ? "Copy code" : "Button")}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* quick-reply pills (WA shows these as standalone buttons under the bubble) */}
          {buttons.filter((b) => b.type === "QUICK_REPLY").length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 5 }}>
              {buttons.filter((b) => b.type === "QUICK_REPLY").map((b, i) => (
                <div key={i} style={{ background: "#1f2c33", borderRadius: 8, padding: "9px 0", textAlign: "center", color: "#53bdeb", fontSize: 14, fontWeight: 500, boxShadow: "0 1px 1px rgba(0,0,0,.25)" }}>{b.text || "Quick reply"}</div>
              ))}
            </div>
          )}
          {/* carousel cards */}
          {cards.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, overflowX: "auto", paddingBottom: 4 }}>
              {cards.map((card, i) => { const cp = parseTplComponents(card.components); return (
                <div key={i} style={{ flex: "0 0 180px", background: "#1f2c33", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 1px rgba(0,0,0,.25)" }}>
                  <div style={{ height: 100, background: "linear-gradient(135deg,#10202a,#15303a)", display: "grid", placeItems: "center", color: "#5b7682", fontSize: 26 }}>{cp.header?.format === "video" ? "🎬" : "🖼️"}</div>
                  <div style={{ padding: "7px 9px" }}>
                    <div style={{ fontSize: 12.5, color: "#e9edef", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: waMarkdownToHtml(cp.body) || "Card text" }} />
                    {cp.buttons.map((b, k) => <div key={k} style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #2a3942", textAlign: "center", color: "#53bdeb", fontSize: 12.5, fontWeight: 500 }}>{b.type === "URL" ? "🔗 " : b.type === "PHONE_NUMBER" ? "📞 " : "↩ "}{b.text}</div>)}
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

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE / EDIT FORM
// ─────────────────────────────────────────────────────────────────────────────
function TemplateCreate({ onClose, onDone, prefill, waba }) {
  const pf = prefill || {};
  const [category, setCategory] = useState(pf.category || "MARKETING");
  const [language, setLanguage] = useState(pf.language || "en");
  const [name, setName] = useState(pf.name || "");
  const [headerType, setHeaderType] = useState(pf.header?.format || "none");
  const [headerText, setHeaderText] = useState(pf.header?.format === "text" ? (pf.header.text || "") : "");
  const [headerHandle, setHeaderHandle] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState("");
  const [body, setBody] = useState(pf.body || "");
  const [footer, setFooter] = useState(pf.footer || "");
  const [buttons, setButtons] = useState(pf.buttons ? pf.buttons.map((b) => ({ type: b.type, text: b.text || "", url: b.url || "", phone_number: b.phone_number || "" })) : []);
  const [cards, setCards] = useState(pf.cards ? pf.cards.map((c) => { const cp = parseTplComponents(c.components); return { header_type: cp.header?.format || "image", header_handle: "", header_name: "", body_text: cp.body || "", buttons: (cp.buttons || []).map((b) => ({ type: b.type, text: b.text || "", url: b.url || "", phone_number: b.phone_number || "" })) }; }) : []);
  const [useCarousel, setUseCarousel] = useState((pf.cards || []).length > 0);
  const [varExamples, setVarExamples] = useState([]);
  const [authSecurity, setAuthSecurity] = useState(true);
  const [authExpiry, setAuthExpiry] = useState("");
  const [authButtonText, setAuthButtonText] = useState("Copy Code");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const bodyRef = useRef(null);

  const isAuth = category === "AUTHENTICATION";
  const isMediaHeader = !isAuth && ["image", "video", "document"].includes(headerType);
  const nVars = countVars(body);
  useEffect(() => { setVarExamples((prev) => { const a = prev.slice(0, nVars); while (a.length < nVars) a.push(""); return a; }); }, [nVars]);

  // rich-text: wrap selection in body textarea with a marker (* _ ~ ```)
  const wrapSel = (mark) => {
    const ta = bodyRef.current; if (!ta) { setBody((b) => b + mark + "text" + mark); return; }
    const s = ta.selectionStart, e = ta.selectionEnd; const val = ta.value;
    const sel = val.slice(s, e) || "text";
    const next = val.slice(0, s) + mark + sel + mark + val.slice(e);
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + mark.length, s + mark.length + sel.length); });
  };
  const insertVar = () => {
    const ta = bodyRef.current; const n = nVars + 1; const token = "{{" + n + "}}";
    if (!ta) { setBody((b) => b + token); return; }
    const s = ta.selectionStart, val = ta.value;
    setBody(val.slice(0, s) + token + val.slice(s));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + token.length, s + token.length); });
  };

  const uploadMedia = async (file, cb) => {
    setUploading(true); setError("");
    try { const fd = new FormData(); fd.append("file", file); fd.append("account_id", String(ACCOUNT_ID)); const j = await (await fetch(`${API}/api/templates/upload-media`, { method: "POST", body: fd })).json();
      if (j.ok && j.handle) cb(j.handle, file.name, URL.createObjectURL(file)); else setError(j.error || "Media upload failed."); }
    catch { setError("Media upload failed."); }
    setUploading(false);
  };

  // button limit helpers
  const nQR = buttons.filter((b) => b.type === "QUICK_REPLY").length;
  const nURL = buttons.filter((b) => b.type === "URL").length;
  const nPH = buttons.filter((b) => b.type === "PHONE_NUMBER").length;
  const addButton = (type) => { if (type === "QUICK_REPLY" && nQR >= 10) return; if (type === "URL" && nURL >= 2) return; if (type === "PHONE_NUMBER" && nPH >= 1) return; if (buttons.length >= 10) return; setButtons((b) => [...b, { type, text: "", url: "", phone_number: "" }]); };
  const setBtn = (i, patch) => setButtons((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // carousel card ops
  const addCard = () => { if (cards.length >= 10) return; setCards((c) => [...c, { header_type: c[0]?.header_type || "image", header_handle: "", header_name: "", body_text: "", buttons: [] }]); };
  const setCard = (i, patch) => setCards((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const delCard = (i) => setCards((c) => c.filter((_, j) => j !== i));

  const validate = () => {
    if (!/^[a-z0-9_]+$/.test(name)) return "Name must be lowercase letters, numbers and underscores only (e.g. order_update).";
    if (!isAuth && !useCarousel && !body.trim()) return "Body text is required.";
    if (isMediaHeader && !headerHandle) return `Upload a sample ${headerType} for the header, or set header to None/Text.`;
    for (const b of buttons) { if (!b.text.trim()) return "Every button needs a label."; if (b.type === "URL" && !b.url.trim()) return "URL buttons need a link."; if (b.type === "PHONE_NUMBER" && !b.phone_number.trim()) return "Call buttons need a phone number."; }
    if (useCarousel) { if (cards.length < 2) return "A carousel needs at least 2 cards."; for (const c of cards) { if (!c.body_text.trim()) return "Every carousel card needs body text."; if (!c.header_handle) return "Every carousel card needs a sample media upload."; for (const b of (c.buttons || [])) { if (!b.text.trim()) return "Every card button needs a label."; } } }
    return "";
  };

  const submit = async () => {
    const v = validate(); if (v) { setError(v); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSubmitting(true); setError("");
    const examplesValid = varExamples.filter((x) => x.trim()).length === nVars && nVars > 0;
    const payload = {
      account_id: ACCOUNT_ID, name, language, category,
      header_type: isAuth ? "none" : headerType, header_text: headerText, header_handle: headerHandle || undefined,
      body_text: body, footer_text: footer, buttons: isAuth ? [] : buttons,
      body_example: examplesValid ? varExamples : undefined,
      add_security_recommendation: authSecurity, code_expiration_minutes: authExpiry ? parseInt(authExpiry, 10) : undefined, button_text: authButtonText,
      cards: useCarousel ? cards.map((c) => ({ header_type: c.header_type, header_handle: c.header_handle || undefined, body_text: c.body_text, buttons: c.buttons })) : undefined,
    };
    try { const j = await (await fetch(`${API}/api/templates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).json();
      if (j.ok) onDone(); else { setError(j.error || "Couldn't submit. Check the fields and try again."); window.scrollTo({ top: 0, behavior: "smooth" }); } }
    catch { setError("Couldn't reach the server."); }
    setSubmitting(false);
  };

  // preview parts
  const previewParts = isAuth
    ? { body: (body || "{{1}} is your verification code.").replace(/\{\{1\}\}/, "123456"), footer: authSecurity ? "For your security, do not share this code." : "", buttons: [{ type: "COPY_CODE", text: authButtonText || "Copy Code" }] }
    : { header: headerType !== "none" ? { format: headerType, text: headerText, previewUrl: headerPreviewUrl } : null, body, footer, buttons, cards: useCarousel ? cards.map((c) => ({ components: [{ type: "HEADER", format: c.header_type }, { type: "BODY", text: c.body_text }, ...(c.buttons.length ? [{ type: "BUTTONS", buttons: c.buttons }] : [])] })) : [] };

  return (
    <div style={{ minHeight: "100vh", background: D.bg, fontFamily: T.font, color: D.text }}>
      {/* sticky toolbar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: `linear-gradient(180deg, ${D.panel2}, ${D.panel})`, borderBottom: `1px solid ${D.border}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "13px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onClose} style={btnGhost()}>← Back</button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{pf.name ? "Duplicate template" : "New template"}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={submit} disabled={submitting || uploading} className="cs-pub" style={{ ...btnGreen(), opacity: submitting || uploading ? .6 : 1 }}>{submitting ? "Submitting…" : "Submit for review"}</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 24px 60px" }}>
        {error && <Banner kind="err" onX={() => setError("")}>{error}</Banner>}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 28, alignItems: "start" }}>
          {/* ░░░ FORM COLUMN ░░░ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* SETUP card */}
            <Card title="Setup" icon="⚙️">
              <Field label="Category">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
                  {TPL_CATS.map(([v, l, sub, ic]) => { const on = category === v; const cm = tplCatMeta(v); return (
                    <div key={v} onClick={() => setCategory(v)} style={{ cursor: "pointer", padding: "12px 11px", borderRadius: 11, border: `1.5px solid ${on ? cm.color : D.border}`, background: on ? hexA(cm.color, .1) : D.panel2, transition: "all .12s" }}>
                      <div style={{ fontSize: 18, marginBottom: 5 }}>{ic}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: on ? cm.color : D.text }}>{l}</div>
                      <div style={{ fontSize: 10.5, color: D.faint, marginTop: 2, lineHeight: 1.3 }}>{sub}</div>
                    </div>); })}
                </div>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Language"><Sel value={language} onChange={setLanguage} options={TPL_LANGS2} /></Field>
                <Field label="Template name"><In value={name} onChange={(v) => setName(v.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="order_confirmation" /></Field>
              </div>
              <Hint>Name is permanent and uses lowercase, numbers &amp; underscores. Pick a clear one like <b style={{ color: D.sub }}>welcome_offer</b>.</Hint>
            </Card>

            {isAuth ? (
              <Card title="Authentication content" icon="🔐">
                <div style={{ fontSize: 12.5, color: D.sub, lineHeight: 1.55, marginBottom: 14, padding: "10px 12px", background: hexA(NC.list, .08), border: `1px solid ${hexA(NC.list, .25)}`, borderRadius: 10 }}>WhatsApp fully controls authentication templates — it inserts the code and the copy button automatically. You only set the options below.</div>
                <Toggle on={authSecurity} onClick={() => setAuthSecurity(!authSecurity)} label='Add the security line ("For your security, do not share this code.")' />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <Field label="Code expiry (minutes, optional)"><In value={authExpiry} onChange={(v) => setAuthExpiry(v.replace(/[^0-9]/g, ""))} placeholder="10" /></Field>
                  <Field label="Copy button text"><In value={authButtonText} maxLength={25} onChange={setAuthButtonText} placeholder="Copy Code" /></Field>
                </div>
              </Card>
            ) : (
              <>
                {/* CONTENT card (only when not a carousel) */}
                {!useCarousel && (
                  <Card title="Content" icon="✍️">
                    <Field label="Header (optional)">
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {TPL_HEADER_TYPES.map(([v, l, ic]) => { const on = headerType === v; return (
                          <div key={v} onClick={() => { setHeaderType(v); setHeaderHandle(""); setHeaderName(""); setHeaderPreviewUrl(""); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, border: `1.5px solid ${on ? ACCENT : D.border}`, background: on ? hexA(ACCENT, .13) : D.panel2, color: on ? "#bdd4ff" : D.sub }}><span>{ic}</span>{l}</div>); })}
                      </div>
                      {headerType === "text" && <div style={{ marginTop: 9 }}><In value={headerText} maxLength={60} onChange={setHeaderText} placeholder="Header text (max 60 chars)" /></div>}
                      {isMediaHeader && <div style={{ marginTop: 9 }}>
                        <input ref={fileRef} type="file" accept={headerType === "image" ? "image/*" : headerType === "video" ? "video/*" : "application/pdf"} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadMedia(f, (h, nm, url) => { setHeaderHandle(h); setHeaderName(nm); setHeaderPreviewUrl(url); }); }} style={{ display: "none" }} />
                        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={dashBtn(NC.media)}>{uploading ? "Uploading…" : headerHandle ? `✓ ${headerName} — change` : `📎 Upload sample ${headerType}`}</button>
                        <Hint>WhatsApp needs one sample {headerType} to approve the template. Your real {headerType} is chosen when you send it.</Hint>
                      </div>}
                    </Field>

                    <Field label={`Body${nVars ? ` · ${nVars} variable${nVars > 1 ? "s" : ""}` : ""}`}>
                      {/* rich text toolbar */}
                      <div style={{ display: "flex", gap: 4, marginBottom: 7, alignItems: "center", flexWrap: "wrap" }}>
                        {[["B", "*", { fontWeight: 800 }], ["I", "_", { fontStyle: "italic" }], ["S", "~", { textDecoration: "line-through" }], ["</>", "```", { fontFamily: "monospace", fontSize: 11 }]].map(([lbl, mark, st]) => (
                          <button key={mark} onClick={() => wrapSel(mark)} title={mark === "*" ? "Bold" : mark === "_" ? "Italic" : mark === "~" ? "Strikethrough" : "Monospace"} style={{ minWidth: 30, height: 28, borderRadius: 7, border: `1px solid ${D.border}`, background: D.panel2, color: D.text, cursor: "pointer", fontSize: 12.5, ...st }}>{lbl}</button>
                        ))}
                        <div style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
                        <button onClick={insertVar} style={{ height: 28, padding: "0 11px", borderRadius: 7, border: `1px solid ${hexA(ACCENT, .5)}`, background: hexA(ACCENT, .12), color: "#bdd4ff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{"{ }"} Add variable</button>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: D.faint }}>{body.length}/1024</span>
                      </div>
                      <textarea ref={bodyRef} className="cs-in" value={body} maxLength={1024} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Hi {{1}}, your order {{2}} is confirmed! 🎉" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13.5, boxSizing: "border-box", resize: "vertical", fontFamily: T.font, lineHeight: 1.5 }} />
                      <Hint>Select text then tap <b style={{ color: D.sub }}>B</b> / <b style={{ color: D.sub }}>I</b> / <b style={{ color: D.sub }}>S</b> to format. Use <b style={{ color: D.sub }}>Add variable</b> for values you fill at send time.</Hint>
                    </Field>

                    {nVars > 0 && (
                      <Field label="Sample values (for WhatsApp review)">
                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          {Array.from({ length: nVars }).map((_, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: ACCENT, fontFamily: "monospace", minWidth: 34 }}>{"{{" + (i + 1) + "}}"}</span>
                              <div style={{ flex: 1 }}><In value={varExamples[i] || ""} onChange={(v) => setVarExamples((a) => { const c = [...a]; c[i] = v; return c; })} placeholder={i === 0 ? "e.g. Ali" : "e.g. #12345"} /></div>
                            </div>
                          ))}
                        </div>
                      </Field>
                    )}

                    <Field label="Footer (optional)"><In value={footer} maxLength={60} onChange={setFooter} placeholder="e.g. Reply STOP to unsubscribe" /></Field>
                  </Card>
                )}

                {/* BUTTONS card (only when not a carousel) */}
                {!useCarousel && (
                  <Card title="Buttons" icon="🔘" right={<span style={{ fontSize: 11, color: D.faint }}>{buttons.length}/10</span>}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: buttons.length ? 12 : 0 }}>
                      <button onClick={() => addButton("QUICK_REPLY")} disabled={nQR >= 10} style={addPill(nQR >= 10)}>↩ Quick reply <span style={{ color: D.faint }}>{nQR}/10</span></button>
                      <button onClick={() => addButton("URL")} disabled={nURL >= 2} style={addPill(nURL >= 2)}>🔗 Visit website <span style={{ color: D.faint }}>{nURL}/2</span></button>
                      <button onClick={() => addButton("PHONE_NUMBER")} disabled={nPH >= 1} style={addPill(nPH >= 1)}>📞 Call <span style={{ color: D.faint }}>{nPH}/1</span></button>
                    </div>
                    {buttons.map((b, i) => (
                      <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 10, padding: 10, marginBottom: 9, background: D.panel2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: b.type === "URL" ? "#9ec1ff" : b.type === "PHONE_NUMBER" ? NC.buttons : NC.list }}>{b.type === "QUICK_REPLY" ? "↩ Quick reply" : b.type === "URL" ? "🔗 Website" : "📞 Call"}</span>
                          <button onClick={() => setButtons((bs) => bs.filter((_, j) => j !== i))} style={{ ...miniX(), marginLeft: "auto" }}>✕</button>
                        </div>
                        <In value={b.text} maxLength={25} onChange={(v) => setBtn(i, { text: v })} placeholder="Button text (max 25)" />
                        {b.type === "URL" && <div style={{ marginTop: 7 }}><In value={b.url} onChange={(v) => setBtn(i, { url: v })} placeholder="https://example.com/{{1}}" /></div>}
                        {b.type === "PHONE_NUMBER" && <div style={{ marginTop: 7 }}><In value={b.phone_number} onChange={(v) => setBtn(i, { phone_number: v })} placeholder="+92300xxxxxxx" /></div>}
                      </div>
                    ))}
                    <Hint>Up to 10 quick replies, 2 website buttons and 1 call button.</Hint>
                  </Card>
                )}

                {/* CAROUSEL card */}
                <Card title="Carousel" icon="🎠" right={
                  <Toggle on={useCarousel} onClick={() => setUseCarousel(!useCarousel)} label="" small />
                }>
                  {!useCarousel ? (
                    <div style={{ fontSize: 12.5, color: D.sub, lineHeight: 1.55 }}>Turn this on to send a swipeable set of cards (2–10), each with its own image/video, text and buttons. Great for product showcases. <span style={{ color: D.faint }}>Turning it on uses the carousel instead of a single message body.</span></div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: D.sub, lineHeight: 1.5, marginBottom: 12, padding: "9px 11px", background: hexA(NC.list, .07), border: `1px solid ${hexA(NC.list, .22)}`, borderRadius: 9 }}>The body above becomes the intro message shown before the cards. Every card must use the same media type and button layout.</div>
                      {cards.map((c, i) => (
                        <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 11, padding: 12, marginBottom: 11, background: D.panel2 }}>
                          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: NC.list }}>Card {i + 1}</span>
                            <button onClick={() => delCard(i)} style={{ ...miniX(), marginLeft: "auto" }}>✕ Remove</button>
                          </div>
                          <Field label="Card media" tight>
                            <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
                              {[["image", "Image", "🖼️"], ["video", "Video", "🎬"]].map(([v, l, ic]) => { const on = c.header_type === v; return <div key={v} onClick={() => setCard(i, { header_type: v, header_handle: "", header_name: "" })} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? NC.list : D.border}`, background: on ? hexA(NC.list, .13) : D.input, color: on ? NC.list : D.sub }}><span>{ic}</span>{l}</div>; })}
                            </div>
                            <CardMediaUpload card={c} onUpload={(file) => uploadMedia(file, (h, nm) => setCard(i, { header_handle: h, header_name: nm }))} uploading={uploading} />
                          </Field>
                          <Field label="Card text" tight><textarea className="cs-in" value={c.body_text} maxLength={160} onChange={(e) => setCard(i, { body_text: e.target.value })} rows={2} placeholder="Card description (max 160)" style={{ width: "100%", padding: "9px 11px", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: T.font }} /></Field>
                          <CardButtons card={c} onChange={(btns) => setCard(i, { buttons: btns })} />
                        </div>
                      ))}
                      {cards.length < 10 && <button onClick={addCard} style={dashBtn(NC.list)}>＋ Add card {cards.length > 0 ? `(${cards.length}/10)` : ""}</button>}
                      {cards.length < 2 && <Hint>A carousel needs at least 2 cards.</Hint>}
                    </>
                  )}
                </Card>
              </>
            )}
          </div>

          {/* ░░░ PREVIEW COLUMN ░░░ */}
          <div style={{ position: "sticky", top: 78 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: D.faint }}>Live preview</span>
              <span style={{ fontSize: 10.5, color: D.faint, marginLeft: "auto" }}>Updates as you type</span>
            </div>
            <WaPhone parts={previewParts} examples={varExamples} />
            <div style={{ marginTop: 12, padding: "11px 13px", background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 11, fontSize: 11.5, color: D.sub, lineHeight: 1.55 }}>
              <b style={{ color: D.text }}>How approval works:</b> after you submit, WhatsApp reviews the template (usually minutes, up to 24h). You'll see <span style={{ color: "#fbbf24" }}>In review</span> → <span style={{ color: "#34d399" }}>Approved</span> or <span style={{ color: "#fb7185" }}>Rejected</span> on the list. Approved templates appear in your Campaigns.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// carousel card media upload button (separate so each card manages its own file input)
function CardMediaUpload({ card, onUpload, uploading }) {
  const ref = useRef(null);
  return (<>
    <input ref={ref} type="file" accept={card.header_type === "video" ? "video/*" : "image/*"} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} style={{ display: "none" }} />
    <button onClick={() => ref.current?.click()} disabled={uploading} style={dashBtn(NC.list)}>{card.header_handle ? `✓ ${card.header_name || "Uploaded"} — change` : `📎 Upload ${card.header_type}`}</button>
  </>);
}
// carousel card buttons (max 2 per card: quick reply / url)
function CardButtons({ card, onChange }) {
  const btns = card.buttons || [];
  const add = (type) => { if (btns.length >= 2) return; onChange([...btns, { type, text: "", url: "", phone_number: "" }]); };
  const set = (i, patch) => onChange(btns.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <Field label="Card buttons (optional, max 2)" tight>
      <div style={{ display: "flex", gap: 7, marginBottom: btns.length ? 8 : 0 }}>
        <button onClick={() => add("QUICK_REPLY")} disabled={btns.length >= 2} style={addPill(btns.length >= 2)}>↩ Quick reply</button>
        <button onClick={() => add("URL")} disabled={btns.length >= 2} style={addPill(btns.length >= 2)}>🔗 Website</button>
      </div>
      {btns.map((b, i) => (
        <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 8, padding: 8, marginBottom: 7, background: D.input }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: b.type === "URL" ? "#9ec1ff" : NC.list }}>{b.type === "URL" ? "🔗 Website" : "↩ Quick reply"}</span>
            <button onClick={() => onChange(btns.filter((_, j) => j !== i))} style={{ ...miniX(), marginLeft: "auto" }}>✕</button>
          </div>
          <In value={b.text} maxLength={25} onChange={(v) => set(i, { text: v })} placeholder="Button text" />
          {b.type === "URL" && <div style={{ marginTop: 6 }}><In value={b.url} onChange={(v) => set(i, { url: v })} placeholder="https://…" /></div>}
        </div>
      ))}
    </Field>
  );
}

// ── small shared UI atoms (scoped to templates; names are unique) ──
function Card({ title, icon, right, children }) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px", borderBottom: `1px solid ${D.border}`, background: hexA("#ffffff", .015) }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-.01em" }}>{title}</span>
        <div style={{ marginLeft: "auto" }}>{right}</div>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
function Field({ label, children, tight }) { return (<div style={{ marginBottom: tight ? 10 : 16 }}><div style={{ fontSize: 12, fontWeight: 600, color: D.sub, marginBottom: 7 }}>{label}</div>{children}</div>); }
function Hint({ children }) { return <div style={{ fontSize: 11, color: D.faint, marginTop: 8, lineHeight: 1.5 }}>{children}</div>; }
function Banner({ kind, children, onX }) {
  const ok = kind === "ok";
  return (<div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, padding: "11px 14px", borderRadius: 11, background: ok ? hexA(NC.buttons, .1) : hexA(NC.stop, .1), border: `1px solid ${ok ? hexA(NC.buttons, .35) : hexA(NC.stop, .35)}`, color: ok ? "#4ade80" : "#fda4af", fontSize: 13 }}>
    <span style={{ flex: 1, lineHeight: 1.5 }}>{children}</span>
    {onX && <button onClick={onX} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, opacity: .7, padding: 0 }}>✕</button>}
  </div>);
}
function Modal({ children, onClose, width }) {
  return (<div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.66)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: width || 420, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: D.panel, border: `1px solid ${D.border}`, borderRadius: 16, padding: 22, fontFamily: T.font, boxShadow: "0 24px 60px rgba(0,0,0,.6)" }}>{children}</div>
  </div>);
}
function Toggle({ on, onClick, label, small }) {
  return (<div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
    <div style={{ width: small ? 38 : 40, height: small ? 22 : 23, borderRadius: 999, background: on ? NC.buttons : "#3a4456", position: "relative", transition: "background .15s", flexShrink: 0 }}><div style={{ position: "absolute", top: 2, left: on ? (small ? 18 : 19) : 2, width: small ? 18 : 19, height: small ? 18 : 19, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.4)" }} /></div>
    {label && <span style={{ fontSize: 12.5, color: D.text, lineHeight: 1.4 }}>{label}</span>}
  </div>);
}
const btnGreen = () => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 17px", background: "linear-gradient(135deg, #1db954 0%, #16A34A 100%)", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.font, boxShadow: "0 4px 14px rgba(22,163,74,.32)" });
const btnGhost = () => ({ padding: "8px 15px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontFamily: T.font, fontWeight: 600, border: `1px solid ${D.border}`, background: D.panel2, color: D.text });
const btnIcon = () => ({ width: 36, height: 36, borderRadius: 9, border: `1px solid ${D.border}`, background: D.panel2, color: D.sub, cursor: "pointer", fontSize: 15, fontFamily: T.font });
const dashBtn = (c) => ({ width: "100%", padding: "10px 12px", border: `1.5px dashed ${hexA(c, .6)}`, color: c, background: hexA(c, .07), borderRadius: 9, cursor: "pointer", fontFamily: T.font, fontSize: 12.5, fontWeight: 600 });
const addPill = (disabled) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: T.font, border: `1px solid ${D.border}`, background: disabled ? "transparent" : D.panel2, color: disabled ? D.faint : D.text, cursor: disabled ? "default" : "pointer", opacity: disabled ? .5 : 1 });
const miniX = () => ({ border: `1px solid ${hexA(NC.stop, .45)}`, color: "#fb7185", background: "transparent", borderRadius: 6, cursor: "pointer", padding: "3px 9px", fontFamily: T.font, fontSize: 11.5, fontWeight: 600 });
// ════════════════════════════════════════════════════════════════════════════
//  END WHATSAPP TEMPLATES
// ════════════════════════════════════════════════════════════════════════════
