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
const T = { blue: "#1f93ff", text: "#1f2d3d", sub: "#64748b", border: "#e5e7eb", bg: "#ffffff", soft: "#f8fafc", green: "#15803d", greenBg: "#e7f7ee", grayPill: "#64748b", grayPillBg: "#f1f5f9", font: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
// Dark theme (CANVAS / EDITOR) — refined, professional (no neon)
const D = { bg: "#0B0E14", panel: "#0E121B", panel2: "#141A24", card: "#151B26", border: "#262E3B", text: "#E6EAF1", sub: "#97A3B6", faint: "#5A6678", input: "#0E141E" };
// Muted, professional accent per node type
const NC = { start: "#5B8DEF", text: "#4C84FF", buttons: "#3FB950", list: "#A371F7", media: "#D29922", cta: "#388BFD", question: "#56A2FF", delay: "#8B949E", condition: "#DB6D28", tag: "#EC6547", stop: "#F85149" };

function hexA(hex, a) { const h = hex.replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; const n = parseInt(f, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

// shared media helpers
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
  if (["mp3", "ogg", "wav", "m4a", "aac"].includes(ext)) return "audio";
  return "document";
}
function fmtSize(b) { if (b == null) return ""; if (b < 1024) return b + " B"; if (b < 1048576) return Math.round(b / 1024) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }
// iframe-safe clipboard (navigator.clipboard fails cross-origin and over http)
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
  .react-flow__edge-path{stroke:#3a4456;stroke-width:1.8;}
  .react-flow__edge.selected .react-flow__edge-path,.react-flow__edge:hover .react-flow__edge-path{stroke:${NC.start};}
  .cs-pal:hover{border-color:#39455a!important;background:#1A212D!important;}
  .cs-in{background:${D.input};border:1px solid #2A3340;color:${D.text};}
  .cs-in:focus{outline:none;border-color:${NC.text};box-shadow:0 0 0 3px ${hexA(NC.text,.18)};}
  .cs-in::placeholder{color:${D.faint};}
  .cs-gcard:hover{border-color:#39455a!important;transform:translateY(-2px);}
  .cs-pub:hover{filter:brightness(1.07);}
  `;
  document.head.appendChild(s);
}

// ===== NODE shell (clean, professional) =====
const nodeBox = (accent, sel) => ({ position: "relative", background: D.card, borderRadius: 12, width: 250, border: `1px solid ${sel ? accent : D.border}`, boxShadow: sel ? `0 0 0 1px ${accent}, 0 8px 24px rgba(0,0,0,.5)` : `0 1px 2px rgba(0,0,0,.35), 0 6px 16px rgba(0,0,0,.25)`, fontFamily: T.font, overflow: "hidden", transition: "box-shadow .15s, border-color .15s" });
const nbody = { padding: "4px 13px 13px", color: D.sub, whiteSpace: "pre-wrap", minHeight: 12, lineHeight: 1.45, fontSize: 12 };
const hStyle = (a) => ({ width: 9, height: 9, background: D.bg, border: `2px solid ${a}` });
const EdgeCtx = createContext(null);

function Hdr({ a, icon, title }) {
  return (<div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px 7px" }}>
    <div style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: hexA(a, .14), color: a, fontSize: 12.5 }}>{icon}</div>
    <div style={{ color: D.text, fontWeight: 600, fontSize: 12.5 }}>{title}</div>
  </div>);
}
function TopLine({ a }) { return <div style={{ height: 2, background: a, opacity: .85 }} />; }
const itemPill = { position: "relative", margin: "6px 13px", padding: "8px 28px 8px 11px", border: `1px solid ${D.border}`, borderRadius: 8, background: D.input, color: D.text, fontSize: 12, lineHeight: 1.3 };

function StartNode({ data }) { const a = NC.start; return (<div style={nodeBox(a, false)}><TopLine a={a} /><Hdr a={a} icon="⚡" title="On Message" /><div style={nbody}>{data.keywords ? `Keywords: ${data.keywords}` : "Flow starts on the first message"}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function TextNode({ data, selected }) { const a = NC.text; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="💬" title="Send Text" /><div style={nbody}>{data.text || "…"}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function ButtonsNode({ data, selected }) {
  const a = NC.buttons; const buttons = data.buttons || [];
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🔘" title="Send Buttons" /><div style={nbody}>{data.text || "…"}</div>
    {buttons.map((b, i) => (<div key={i} style={itemPill}>{b.title || `Button ${i + 1}`}<Handle type="source" position={Position.Right} id={`btn-${i}`} style={{ top: "50%", right: -6, transform: "translateY(-50%)", ...hStyle(a) }} /></div>))}
    <div style={{ height: 6 }} /></div>);
}
function ListNode({ data, selected }) {
  const a = NC.list; const rows = data.rows || [];
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="📋" title="Send List" /><div style={nbody}>{data.body || "…"}{data.button ? <div style={{ marginTop: 4, fontSize: 11, color: a }}>▾ {data.button}</div> : null}</div>
    {rows.map((r, i) => (<div key={i} style={itemPill}><div style={{ fontWeight: 600 }}>{r.title || `Row ${i + 1}`}</div>{r.description ? <div style={{ color: D.faint, fontSize: 11, marginTop: 1 }}>{r.description}</div> : null}<Handle type="source" position={Position.Right} id={`row-${i}`} style={{ top: "50%", right: -6, transform: "translateY(-50%)", ...hStyle(a) }} /></div>))}
    <div style={{ height: 6 }} /></div>);
}
function MediaNode({ data, selected }) {
  const a = NC.media;
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🖼️" title="Send Media" />
    <div style={{ padding: "2px 13px 13px" }}>
      {data.url ? (data.mediaType === "image"
        ? <img src={data.url} alt="" style={{ width: "100%", height: 92, objectFit: "cover", borderRadius: 8, border: `1px solid ${D.border}` }} />
        : <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: D.sub, padding: "6px 0" }}><span>{GTYPE[data.mediaType]?.icon || "📄"}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.name || "media"}</span></div>)
        : <div style={{ fontSize: 12, color: D.faint }}>No media selected</div>}
      {data.caption ? <div style={{ marginTop: 6, fontSize: 12, color: D.sub, whiteSpace: "pre-wrap" }}>{data.caption}</div> : null}
    </div>
    <Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>);
}
function CtaNode({ data, selected }) { const a = NC.cta; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🔗" title="Send CTA" /><div style={nbody}>{data.body || "…"}{data.url ? <div style={{ marginTop: 6, padding: "6px 10px", border: `1px solid ${D.border}`, borderRadius: 8, background: D.input, color: a, fontSize: 12, textAlign: "center" }}>🔗 {data.display || "Open link"}</div> : null}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function QuestionNode({ data, selected }) { const a = NC.question; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="❓" title="Ask Question" /><div style={nbody}>{data.text || "…"}{data.saveAs ? <div style={{ marginTop: 6, fontSize: 11, color: a }}>→ save as: {data.saveAs}</div> : null}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function DelayNode({ data, selected }) { const a = NC.delay; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="⏱️" title="Delay" /><div style={nbody}>Wait {data.value || 0} {data.unit || "seconds"}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function ConditionNode({ data, selected }) {
  const a = NC.condition;
  const opLabel = (OPERATORS.find((o) => o[0] === (data.operator || "contains")) || ["", "?"])[1];
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🔀" title="Condition" />
    <div style={nbody}><span style={{ color: D.text }}>{data.first || "{{last_message}}"}</span> <span style={{ color: a }}>{opLabel}</span> <span style={{ color: D.text }}>{data.second ? `"${data.second}"` : "…"}</span></div>
    <div style={{ ...itemPill, borderColor: hexA(NC.buttons, .5) }}><span style={{ color: NC.buttons, fontWeight: 600 }}>✓ True</span><Handle type="source" position={Position.Right} id="cond-true" style={{ top: "50%", right: -6, transform: "translateY(-50%)", ...hStyle(NC.buttons) }} /></div>
    <div style={{ ...itemPill, borderColor: hexA(NC.stop, .5) }}><span style={{ color: NC.stop, fontWeight: 600 }}>✕ False</span><Handle type="source" position={Position.Right} id="cond-false" style={{ top: "50%", right: -6, transform: "translateY(-50%)", ...hStyle(NC.stop) }} /></div>
    <div style={{ height: 6 }} /></div>);
}
function TagNode({ data, selected }) {
  const a = NC.tag; const labels = (data.labels || "").split(",").map((x) => x.trim()).filter(Boolean);
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🏷️" title="Update Tag" />
    <div style={{ padding: "2px 13px 13px", display: "flex", flexWrap: "wrap", gap: 6 }}>
      {labels.length ? labels.map((l, i) => (<span key={i} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: hexA(a, .15), color: a, border: `1px solid ${hexA(a, .4)}` }}>{l}</span>)) : <span style={{ fontSize: 12, color: D.faint }}>No tags selected</span>}
    </div>
    <Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>);
}
function StopNode({ data, selected }) { const a = NC.stop; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><TopLine a={a} /><Hdr a={a} icon="🛑" title="Stop Chatbot" /><div style={nbody}>{data.text || "(no message)"}</div></div>); }

const nodeTypes = { start: StartNode, text: TextNode, buttons: ButtonsNode, list: ListNode, media: MediaNode, cta: CtaNode, question: QuestionNode, delay: DelayNode, condition: ConditionNode, tag: TagNode, stop: StopNode };

const OPERATORS = [
  ["equals", "equals"], ["not_equals", "not equals"], ["contains", "contains"], ["not_contains", "does not contain"],
  ["starts_with", "starts with"], ["ends_with", "ends with"], ["greater_than", "greater than"], ["less_than", "less than"],
  ["is_email", "is email"], ["is_phone", "is phone number"], ["regex", "matches regex"],
];

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
  if (kind === "buttons") return { text: "Please choose an option", buttons: [{ title: "Yes" }, { title: "No" }] };
  if (kind === "list") return { body: "Pick one from the list", button: "View options", rows: [{ title: "Option 1", description: "" }, { title: "Option 2", description: "" }], footer: "" };
  if (kind === "media") return { url: "", mediaType: "", name: "", caption: "" };
  if (kind === "cta") return { body: "Tap the button below", display: "Open link", url: "", footer: "" };
  if (kind === "question") return { text: "Your question…", saveAs: "answer" };
  if (kind === "delay") return { value: 1, unit: "seconds" };
  if (kind === "condition") return { first: "{{last_message}}", operator: "contains", second: "" };
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
const startNode = () => ({ id: "start", type: "start", position: { x: 320, y: 40 }, data: { keywords: "" }, deletable: false });

function toEngineFormat(nodes, edges) {
  const def = { start: null, nodes: {} };
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
    if (n.type === "start") continue;
    else if (n.type === "text") def.nodes[n.id] = { type: "text", text: d.text || "", next: plainNext[n.id] || null };
    else if (n.type === "question") def.nodes[n.id] = { type: "question", text: d.text || "", save_as: d.saveAs || "answer", next: plainNext[n.id] || null };
    else if (n.type === "stop") def.nodes[n.id] = { type: "handover", text: d.text || "" };
    else if (n.type === "media") def.nodes[n.id] = { type: "media", url: d.url || "", media_type: d.mediaType || "", name: d.name || "", caption: d.caption || "", next: plainNext[n.id] || null };
    else if (n.type === "cta") def.nodes[n.id] = { type: "cta", body: d.body || "", display: d.display || "", url: d.url || "", footer: d.footer || "", next: plainNext[n.id] || null };
    else if (n.type === "delay") def.nodes[n.id] = { type: "delay", seconds: (d.unit === "minutes" ? (parseInt(d.value, 10) || 0) * 60 : (parseInt(d.value, 10) || 0)), next: plainNext[n.id] || null };
    else if (n.type === "tag") def.nodes[n.id] = { type: "tag", labels: (d.labels || "").split(",").map((x) => x.trim()).filter(Boolean), next: plainNext[n.id] || null };
    else if (n.type === "condition") def.nodes[n.id] = { type: "condition", first: d.first || "", operator: d.operator || "equals", second: d.second || "", next_true: condTrue[n.id] || null, next_false: condFalse[n.id] || null };
    else if (n.type === "buttons") def.nodes[n.id] = { type: "buttons", text: d.text || "", buttons: (d.buttons || []).map((b, i) => ({ title: b.title || `Button ${i + 1}`, next: (btnNext[n.id] || {})[`btn-${i}`] || null })) };
    else if (n.type === "list") def.nodes[n.id] = { type: "list", body: d.body || "", button: d.button || "", footer: d.footer || "", rows: (d.rows || []).map((r, i) => ({ title: r.title || `Row ${i + 1}`, description: r.description || "", next: (rowNext[n.id] || {})[`row-${i}`] || null })) };
  }
  return def;
}
function fromEngineFormat(def) {
  const nodes = [startNode()]; const edges = []; const y = 200;
  const ids = Object.keys((def && def.nodes) || {});
  ids.forEach((id, idx) => {
    const node = def.nodes[id]; const kind = node.type === "handover" ? "stop" : node.type; const data = {};
    if (kind === "text") data.text = node.text || "";
    if (kind === "question") { data.text = node.text || ""; data.saveAs = node.save_as || "answer"; }
    if (kind === "stop") data.text = node.text || "";
    if (kind === "media") { data.url = node.url || ""; data.mediaType = node.media_type || ""; data.name = node.name || ""; data.caption = node.caption || ""; }
    if (kind === "cta") { data.body = node.body || ""; data.display = node.display || ""; data.url = node.url || ""; data.footer = node.footer || ""; }
    if (kind === "delay") { const s = node.seconds || 0; if (s && s % 60 === 0 && s >= 60) { data.value = s / 60; data.unit = "minutes"; } else { data.value = s; data.unit = "seconds"; } }
    if (kind === "condition") { data.first = node.first || ""; data.operator = node.operator || "equals"; data.second = node.second || ""; }
    if (kind === "tag") data.labels = (node.labels || []).join(", ");
    if (kind === "buttons") { data.text = node.text || ""; data.buttons = (node.buttons || []).map((b) => ({ title: b.title })); }
    if (kind === "list") { data.body = node.body || ""; data.button = node.button || ""; data.footer = node.footer || ""; data.rows = (node.rows || []).map((r) => ({ title: r.title, description: r.description || "" })); }
    nodes.push({ id, type: kind, position: { x: 320 + (idx % 2) * 320, y: y + idx * 130 }, data });
    if (kind === "buttons") (node.buttons || []).forEach((b, i) => { if (b.next) edges.push({ id: `e-${id}-b${i}`, source: id, sourceHandle: `btn-${i}`, target: b.next, type: "deletable", animated: true }); });
    else if (kind === "list") (node.rows || []).forEach((r, i) => { if (r.next) edges.push({ id: `e-${id}-r${i}`, source: id, sourceHandle: `row-${i}`, target: r.next, type: "deletable", animated: true }); });
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

// ===================== GALLERY (DARK — media library) =====================
function Gallery() {
  const [media, setMedia] = useState(null);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    try { const j = await (await fetch(`${API}/api/media?account_id=${ACCOUNT_ID}`)).json(); setMedia(j.media || []); }
    catch { setMedia([]); setMsg("Couldn't load media — is the bot engine running?"); }
  };
  useEffect(() => { load(); }, []);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    setUploading(true); setMsg(""); let fail = 0;
    for (const file of files) {
      try { const fd = new FormData(); fd.append("file", file); fd.append("account_id", String(ACCOUNT_ID)); const j = await (await fetch(`${API}/api/upload`, { method: "POST", body: fd })).json(); if (!j.ok) fail++; } catch { fail++; }
    }
    setUploading(false); if (fail) setMsg(`${fail} file(s) failed to upload.`); await load();
  };
  const doDelete = async () => { const m = confirmDel; setConfirmDel(null); if (!m) return; try { await fetch(`${API}/api/media/${m.id}`, { method: "DELETE" }); await load(); } catch { setMsg("Delete failed."); } };
  const doCopy = (m) => { if (copyText(m.url)) { setCopiedId(m.id); setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500); } else setMsg("Copy failed — please copy the link manually."); };

  const list = (media || []).filter((m) => filter === "all" || m.type === filter);
  const counts = (media || []).reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; }, {});
  const filters = [["all", "All"], ["image", "Images"], ["video", "Videos"], ["audio", "Audio"], ["document", "Docs"]];

  const wrap = { minHeight: "100vh", background: D.bg, fontFamily: T.font, color: D.text };
  const primary = { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, cursor: uploading ? "default" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.font, opacity: uploading ? .75 : 1 };

  return (
    <div style={wrap}>
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
        {filters.map(([key, lbl]) => {
          const active = filter === key; const n = key === "all" ? (media || []).length : (counts[key] || 0);
          return (<button key={key} onClick={() => setFilter(key)} style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: T.font, border: `1px solid ${active ? NC.text : D.border}`, background: active ? hexA(NC.text, .16) : D.panel2, color: active ? "#93c5fd" : D.sub }}>{lbl}{media ? ` · ${n}` : ""}</button>);
        })}
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

// ===================== MEDIA PICKER (used in Editor) =====================
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
          {filters.map(([k, l]) => { const act = filter === k; return <button key={k} onClick={() => setFilter(k)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font, border: `1px solid ${act ? NC.text : D.border}`, background: act ? hexA(NC.text, .18) : D.panel2, color: act ? "#93c5fd" : D.sub }}>{l}</button>; })}
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

// ===================== EDITOR (DARK premium canvas) =====================
function Editor({ flowId, onBack }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([startNode()]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("Loading…");
  const [name, setName] = useState("");
  const [flowStatus, setFlowStatus] = useState("draft");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allLabels, setAllLabels] = useState([]);
  const idRef = useRef(1);

  useEffect(() => {
    (async () => {
      try { const j = await (await fetch(`${API}/api/flows/${flowId}`)).json(); setName(j.flow.name || ""); setFlowStatus(j.flow.status); const { nodes: n, edges: e } = fromEngineFormat(j.flow.definition || { start: null, nodes: {} }); setNodes(n); setEdges(e); idRef.current = n.length + 5; setStatus("Loaded"); } catch { setStatus("Load failed"); }
    })();
  }, [flowId]);
  useEffect(() => { (async () => { try { const j = await (await fetch(`${API}/api/labels?account_id=${ACCOUNT_ID}`)).json(); setAllLabels(j.labels || []); } catch { setAllLabels([]); } })(); }, []);

  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, type: "deletable", animated: true }, eds)), [setEdges]);
  const onDeleteEdge = useCallback((id) => setEdges((es) => es.filter((e) => e.id !== id)), [setEdges]);
  const addNode = (kind) => { const id = `n${++idRef.current}`; setNodes((nds) => [...nds, { id, type: kind, position: { x: 340 + Math.random() * 60, y: 200 + nds.length * 40 }, data: defaultData(kind) }]); setSelectedId(id); };
  const updateData = (id, patch) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  const selected = nodes.find((n) => n.id === selectedId) || null;

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
        {/* LEFT palette */}
        <div style={{ width: 218, background: D.panel, borderRight: `1px solid ${D.border}`, padding: 12, overflowY: "auto" }}>
          {PALETTE.map((grp) => (
            <div key={grp.group} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: D.faint, margin: "6px 2px 8px", textTransform: "uppercase", letterSpacing: ".08em" }}>{grp.group}</div>
              {grp.items.map((p) => (
                <button key={p.kind} className="cs-pal" onClick={() => addNode(p.kind)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 7, padding: "10px 11px", border: `1px solid ${D.border}`, borderRadius: 9, background: D.panel2, color: D.text, cursor: "pointer", fontSize: 12.5, fontWeight: 500, fontFamily: T.font, transition: "all .12s" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: hexA(p.color, .14), color: p.color, fontSize: 12 }}>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          ))}
          <div style={{ fontSize: 11, color: D.faint, marginTop: 10, lineHeight: 1.6 }}>Click a node to add it, then connect the dots. Click the <b style={{ color: "#fb7185" }}>✕</b> on a line to remove a connection.</div>
        </div>

        {/* CANVAS */}
        <div style={{ flex: 1, background: D.bg }}>
          <EdgeCtx.Provider value={{ onDeleteEdge }}>
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={{ type: "deletable", animated: true }} onNodeClick={(_, n) => setSelectedId(n.id)} onPaneClick={() => setSelectedId(null)} fitView proOptions={{ hideAttribution: false }}>
              <Background color="#1a2230" gap={20} size={1} />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(n) => NC[n.type] || NC.text} maskColor="rgba(7,10,16,.7)" />
            </ReactFlow>
          </EdgeCtx.Provider>
        </div>

        {/* RIGHT edit panel — only when a node is selected */}
        {selected && (
          <div style={{ width: 300, background: D.panel, borderLeft: `1px solid ${D.border}`, padding: 16, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: D.faint, textTransform: "uppercase", letterSpacing: ".06em" }}>Edit node</div>
              <button onClick={() => setSelectedId(null)} title="Close" style={{ marginLeft: "auto", width: 26, height: 26, borderRadius: 7, border: `1px solid ${D.border}`, background: D.panel2, color: D.sub, cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>

            {selected.type === "start" && (<Ed title="⚡ On Message (Start)"><Lb>Keywords (optional)</Lb><In value={selected.data.keywords || ""} onChange={(v) => updateData(selected.id, { keywords: v })} placeholder="hi, hello, menu" /><Hn>Connect Start to your first node. (For keyword routing, use a Condition node.)</Hn></Ed>)}

            {selected.type === "text" && (<Ed title="💬 Send Text"><Lb>Message</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Ed>)}

            {selected.type === "buttons" && (<Ed title="🔘 Send Buttons"><Lb>Body text</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Lb>Buttons (max 3)</Lb>
              {(selected.data.buttons || []).map((b, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}><In value={b.title} maxLength={20} onChange={(v) => { const arr = [...selected.data.buttons]; arr[i] = { ...arr[i], title: v }; updateData(selected.id, { buttons: arr }); }} placeholder={`Button ${i + 1}`} /><button onClick={() => updateData(selected.id, { buttons: selected.data.buttons.filter((_, j) => j !== i) })} style={delMini}>✕</button></div>))}
              {(selected.data.buttons || []).length < 3 && <button onClick={() => updateData(selected.id, { buttons: [...(selected.data.buttons || []), { title: "" }] })} style={addBtn(NC.buttons)}>+ Add Button</button>}
              <Hn>WhatsApp allows up to 3 buttons (max 20 characters each). Connect each button's right dot to the next node.</Hn></Ed>)}

            {selected.type === "list" && (<Ed title="📋 Send List"><Lb>Body text</Lb><Ar value={selected.data.body || ""} onChange={(v) => updateData(selected.id, { body: v })} /><Lb>List button label</Lb><In value={selected.data.button || ""} maxLength={20} onChange={(v) => updateData(selected.id, { button: v })} placeholder="View options" /><Lb>Rows (max 10)</Lb>
              {(selected.data.rows || []).map((r, i) => (<div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: 8, padding: 8, marginBottom: 8, background: D.panel2 }}>
                <div style={{ display: "flex", gap: 6 }}><In value={r.title} maxLength={24} onChange={(v) => { const arr = [...selected.data.rows]; arr[i] = { ...arr[i], title: v }; updateData(selected.id, { rows: arr }); }} placeholder={`Row ${i + 1} title`} /><button onClick={() => updateData(selected.id, { rows: selected.data.rows.filter((_, j) => j !== i) })} style={delMini}>✕</button></div>
                <div style={{ height: 6 }} /><In value={r.description || ""} maxLength={72} onChange={(v) => { const arr = [...selected.data.rows]; arr[i] = { ...arr[i], description: v }; updateData(selected.id, { rows: arr }); }} placeholder="Description (optional)" />
              </div>))}
              {(selected.data.rows || []).length < 10 && <button onClick={() => updateData(selected.id, { rows: [...(selected.data.rows || []), { title: "", description: "" }] })} style={addBtn(NC.list)}>+ Add Row</button>}
              <Lb>Footer (optional)</Lb><In value={selected.data.footer || ""} maxLength={60} onChange={(v) => updateData(selected.id, { footer: v })} placeholder="Footer text" />
              <Hn>WhatsApp list: up to 10 rows. Connect each row's right dot to the next node.</Hn></Ed>)}

            {selected.type === "media" && (<Ed title="🖼️ Send Media">
              {selected.data.url ? (<div style={{ marginBottom: 10 }}>
                {selected.data.mediaType === "image" ? <img src={selected.data.url} alt="" style={{ width: "100%", borderRadius: 8, border: `1px solid ${D.border}` }} />
                  : <div style={{ padding: 10, border: `1px solid ${D.border}`, borderRadius: 8, background: D.input, color: D.sub, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><span>{GTYPE[selected.data.mediaType]?.icon || "📄"}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.data.name || "media"}</span></div>}
              </div>) : null}
              <button onClick={() => setPickerOpen(true)} style={addBtn(NC.media)}>📁 Choose from gallery</button>
              <Lb>Or paste a link</Lb><In value={selected.data.url || ""} onChange={(v) => updateData(selected.id, { url: v, mediaType: guessType(v), name: (v.split("?")[0].split("/").pop() || "") })} placeholder="https://…/file.jpg" />
              <Lb>Caption (optional)</Lb><Ar value={selected.data.caption || ""} onChange={(v) => updateData(selected.id, { caption: v })} />
              <Hn>Pick from your Gallery or paste a direct file link.</Hn></Ed>)}

            {selected.type === "cta" && (<Ed title="🔗 Send CTA"><Lb>Body text</Lb><Ar value={selected.data.body || ""} onChange={(v) => updateData(selected.id, { body: v })} /><Lb>Button text</Lb><In value={selected.data.display || ""} maxLength={20} onChange={(v) => updateData(selected.id, { display: v })} placeholder="Open link" /><Lb>URL</Lb><In value={selected.data.url || ""} onChange={(v) => updateData(selected.id, { url: v })} placeholder="https://…" /><Lb>Footer (optional)</Lb><In value={selected.data.footer || ""} maxLength={60} onChange={(v) => updateData(selected.id, { footer: v })} placeholder="Footer text" /><Hn>Sends your text with a clickable link to the customer.</Hn></Ed>)}

            {selected.type === "question" && (<Ed title="❓ Ask Question"><Lb>Question</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Lb>Save answer as</Lb><In value={selected.data.saveAs || ""} onChange={(v) => updateData(selected.id, { saveAs: v })} placeholder="name, email…" /><Hn>The reply is saved and can be used later in a Condition as {"{{name}}"}.</Hn></Ed>)}

            {selected.type === "delay" && (<Ed title="⏱️ Delay"><Lb>Wait</Lb><div style={{ display: "flex", gap: 8 }}><input className="cs-in" type="number" min={1} value={selected.data.value || 1} onChange={(e) => updateData(selected.id, { value: e.target.value })} style={{ width: "50%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} /><Sel value={selected.data.unit || "seconds"} onChange={(v) => updateData(selected.id, { unit: v })} options={[["seconds", "Seconds"], ["minutes", "Minutes"]]} /></div><Hn>Pauses the flow before the next step (max 5 minutes).</Hn></Ed>)}

            {selected.type === "condition" && (<Ed title="🔀 Condition"><Lb>First value</Lb><In value={selected.data.first || ""} onChange={(v) => updateData(selected.id, { first: v })} placeholder="{{last_message}}" /><Lb>Operator</Lb><Sel value={selected.data.operator || "equals"} onChange={(v) => updateData(selected.id, { operator: v })} options={OPERATORS} /><Lb>Second value</Lb><In value={selected.data.second || ""} onChange={(v) => updateData(selected.id, { second: v })} placeholder="value to compare" /><Hn>Use <b style={{ color: D.sub }}>{"{{last_message}}"}</b> for the user's last message, or <b style={{ color: D.sub }}>{"{{answer}}"}</b> for a saved answer. Connect the green (True) and red (False) dots.</Hn></Ed>)}

            {selected.type === "tag" && (<Ed title="🏷️ Update Tag"><Lb>Tags to assign</Lb><In value={selected.data.labels || ""} onChange={(v) => updateData(selected.id, { labels: v })} placeholder="lead, vip" />
              {allLabels.length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{allLabels.map((l) => { const cur = (selected.data.labels || "").split(",").map((x) => x.trim()).filter(Boolean); const on = cur.includes(l); return (<button key={l} onClick={() => { const next = on ? cur.filter((x) => x !== l) : [...cur, l]; updateData(selected.id, { labels: next.join(", ") }); }} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: T.font, border: `1px solid ${on ? NC.tag : D.border}`, background: on ? hexA(NC.tag, .16) : D.panel2, color: on ? NC.tag : D.sub }}>{l}</button>); })}</div>)}
              <Hn>Adds these labels to the conversation in ChatsSync (existing labels stay). Separate multiple with commas.</Hn></Ed>)}

            {selected.type === "stop" && (<Ed title="🛑 Stop Chatbot / Talk to Human"><Lb>Message (optional)</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Hn>Stops the bot and opens the conversation for a human agent.</Hn></Ed>)}

            {selected.deletable !== false && (<button onClick={() => { setNodes((nds) => nds.filter((n) => n.id !== selected.id)); setEdges((e) => e.filter((ed) => ed.source !== selected.id && ed.target !== selected.id)); setSelectedId(null); }} style={{ marginTop: 16, width: "100%", padding: "9px 12px", border: `1px solid ${hexA(NC.stop, .5)}`, color: "#fb7185", background: hexA(NC.stop, .08), borderRadius: 8, cursor: "pointer", fontFamily: T.font, fontSize: 13 }}>Delete node</button>)}
          </div>
        )}
      </div>

      {pickerOpen && selected && selected.type === "media" && (
        <MediaPicker onClose={() => setPickerOpen(false)} onPick={(m) => { updateData(selected.id, { url: m.url, mediaType: m.type, name: m.original_name || m.filename || "" }); setPickerOpen(false); }} />
      )}
    </div>
  );
}

const delMini = { border: `1px solid ${hexA(NC.stop, .5)}`, color: "#fb7185", background: "transparent", borderRadius: 6, cursor: "pointer", padding: "0 10px", fontFamily: T.font };
const addBtn = (c) => ({ marginTop: 4, padding: "9px 12px", border: `1px dashed ${c}`, color: c, background: hexA(c, .08), borderRadius: 8, cursor: "pointer", width: "100%", fontFamily: T.font, fontSize: 13, fontWeight: 600 });

function Ed({ title, children }) { return (<div><div style={{ fontWeight: 700, marginBottom: 12, color: D.text, fontSize: 14 }}>{title}</div>{children}</div>); }
function Lb({ children }) { return <div style={{ fontSize: 12, fontWeight: 600, color: D.sub, margin: "10px 0 4px" }}>{children}</div>; }
function Hn({ children }) { return <div style={{ fontSize: 11, color: D.faint, marginTop: 8, lineHeight: 1.5 }}>{children}</div>; }
function In({ value, onChange, placeholder, maxLength }) { return (<input className="cs-in" value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} />); }
function Ar({ value, onChange }) { return (<textarea className="cs-in" value={value} onChange={(e) => onChange(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: T.font }} />); }
function Sel({ value, onChange, options }) { return (<select className="cs-in" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font, cursor: "pointer" }}>{options.map(([v, l]) => (<option key={v} value={v} style={{ background: D.panel2 }}>{l}</option>))}</select>); }
