import { useCallback, useRef, useState, useEffect, createContext, useContext } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getBezierPath,
} from "reactflow";
import "reactflow/dist/style.css";

const params = new URLSearchParams(window.location.search);
const API = (import.meta.env.VITE_API_URL || "http://kkzof1hiq0af5vngi0v689zi.5.75.237.171.sslip.io").replace(/\/$/, "");
const ACCOUNT_ID = parseInt(params.get("account_id") || import.meta.env.VITE_ACCOUNT_ID || "3", 10);

// ---- Theme (Chatwoot-ish) ----
const T = {
  blue: "#1f93ff", blueDark: "#1872cc",
  text: "#1f2d3d", sub: "#64748b", border: "#e5e7eb",
  bg: "#ffffff", soft: "#f8fafc",
  green: "#15803d", greenBg: "#e7f7ee", grayPill: "#64748b", grayPillBg: "#f1f5f9",
  font: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const C = { start: "#0EA5E9", text: "#2781F6", buttons: "#16A34A", question: "#9333EA", stop: "#DC2626" };

function injectFont() {
  if (document.getElementById("cs-inter")) return;
  const l = document.createElement("link"); l.id = "cs-inter"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
  document.body.style.margin = "0"; document.body.style.fontFamily = T.font;
}

// ===================== NODE COMPONENTS (canvas) =====================
const box = (sel) => ({ background: "#fff", borderRadius: 10, width: 230, border: sel ? `2px solid ${T.blue}` : "1px solid #e2e8f0", boxShadow: "0 2px 6px rgba(0,0,0,.08)", fontFamily: T.font, fontSize: 12, overflow: "hidden" });
const head = (bg) => ({ background: bg, color: "#fff", padding: "8px 10px", fontWeight: 600, fontSize: 12 });
const nbody = { padding: 10, color: "#334155", whiteSpace: "pre-wrap", minHeight: 18, lineHeight: 1.4 };
const btnRow = { position: "relative", margin: "6px 10px", padding: "6px 24px 6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#f1f5f9", color: "#1e293b" };
const EdgeCtx = createContext(null);

function StartNode({ data }) { return (<div style={box(false)}><div style={head(C.start)}>⚡ On Message (Start)</div><div style={nbody}>{data.keywords ? `Keywords: ${data.keywords}` : "Pehle message par flow shuru"}</div><Handle type="source" position={Position.Bottom} /></div>); }
function TextNode({ data, selected }) { return (<div style={box(selected)}><Handle type="target" position={Position.Top} /><div style={head(C.text)}>💬 Send Text</div><div style={nbody}>{data.text || "…"}</div><Handle type="source" position={Position.Bottom} /></div>); }
function ButtonsNode({ data, selected }) {
  const buttons = data.buttons || [];
  return (<div style={box(selected)}><Handle type="target" position={Position.Top} /><div style={head(C.buttons)}>🔘 Send Buttons</div><div style={nbody}>{data.text || "…"}</div>
    {buttons.map((b, i) => (<div key={i} style={btnRow}>{b.title || `Button ${i + 1}`}<Handle type="source" position={Position.Right} id={`btn-${i}`} style={{ top: "50%", right: -7, transform: "translateY(-50%)", background: C.buttons, width: 10, height: 10 }} /></div>))}
    <div style={{ height: 6 }} /></div>);
}
function QuestionNode({ data, selected }) { return (<div style={box(selected)}><Handle type="target" position={Position.Top} /><div style={head(C.question)}>❓ Ask Question</div><div style={nbody}>{data.text || "…"}{data.saveAs ? <div style={{ marginTop: 6, fontSize: 11, color: "#7c3aed" }}>→ save as: {data.saveAs}</div> : null}</div><Handle type="source" position={Position.Bottom} /></div>); }
function StopNode({ data, selected }) { return (<div style={box(selected)}><Handle type="target" position={Position.Top} /><div style={head(C.stop)}>🛑 Stop / Talk to Human</div><div style={nbody}>{data.text || "(koi message nahi)"}</div></div>); }
const nodeTypes = { start: StartNode, text: TextNode, buttons: ButtonsNode, question: QuestionNode, stop: StopNode };

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }) {
  const { onDeleteEdge } = useContext(EdgeCtx) || {};
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (<>
    <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: "#94a3b8", strokeWidth: 2 }} />
    <EdgeLabelRenderer>
      <button onClick={(e) => { e.stopPropagation(); onDeleteEdge && onDeleteEdge(id); }} title="Connection hatao"
        style={{ position: "absolute", transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all", width: 20, height: 20, borderRadius: "50%", border: "2px solid #fff", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 11, lineHeight: "16px", boxShadow: "0 1px 4px rgba(0,0,0,.35)", padding: 0 }}>✕</button>
    </EdgeLabelRenderer>
  </>);
}
const edgeTypes = { deletable: DeletableEdge };

function defaultData(kind) {
  if (kind === "text") return { text: "Apna message yahan likhein…" };
  if (kind === "buttons") return { text: "Customer ko kya poochna hai?", buttons: [{ title: "Option 1" }, { title: "Option 2" }] };
  if (kind === "question") return { text: "Aapka sawaal…", saveAs: "answer" };
  if (kind === "stop") return { text: "Aapko ek agent se jod rahe hain 🙌" };
  return {};
}
const PALETTE = [
  { kind: "text", label: "💬 Send Text", color: C.text },
  { kind: "buttons", label: "🔘 Send Buttons", color: C.buttons },
  { kind: "question", label: "❓ Ask Question", color: C.question },
  { kind: "stop", label: "🛑 Stop / Human", color: C.stop },
];
const startNode = () => ({ id: "start", type: "start", position: { x: 320, y: 40 }, data: { keywords: "" }, deletable: false });

function toEngineFormat(nodes, edges) {
  const def = { start: null, nodes: {} }; const plainNext = {}; const btnNext = {};
  for (const e of edges) { if (e.sourceHandle && e.sourceHandle.startsWith("btn-")) { btnNext[e.source] = btnNext[e.source] || {}; btnNext[e.source][e.sourceHandle] = e.target; } else plainNext[e.source] = e.target; }
  def.start = plainNext["start"] || null;
  for (const n of nodes) {
    if (n.type === "start") continue;
    if (n.type === "text") def.nodes[n.id] = { type: "text", text: n.data.text || "", next: plainNext[n.id] || null };
    else if (n.type === "question") def.nodes[n.id] = { type: "question", text: n.data.text || "", save_as: n.data.saveAs || "answer", next: plainNext[n.id] || null };
    else if (n.type === "stop") def.nodes[n.id] = { type: "handover", text: n.data.text || "" };
    else if (n.type === "buttons") def.nodes[n.id] = { type: "buttons", text: n.data.text || "", buttons: (n.data.buttons || []).map((b, i) => ({ title: b.title || `Button ${i + 1}`, next: (btnNext[n.id] || {})[`btn-${i}`] || null })) };
  }
  return def;
}
function fromEngineFormat(def) {
  const nodes = [startNode()]; const edges = []; let y = 200;
  const ids = Object.keys((def && def.nodes) || {});
  ids.forEach((id, idx) => {
    const node = def.nodes[id]; const kind = node.type === "handover" ? "stop" : node.type; const data = {};
    if (kind === "text") data.text = node.text || "";
    if (kind === "question") { data.text = node.text || ""; data.saveAs = node.save_as || "answer"; }
    if (kind === "stop") data.text = node.text || "";
    if (kind === "buttons") { data.text = node.text || ""; data.buttons = (node.buttons || []).map((b) => ({ title: b.title })); }
    nodes.push({ id, type: kind, position: { x: 320 + (idx % 2) * 300, y: y + idx * 120 }, data });
    if (kind === "buttons") (node.buttons || []).forEach((b, i) => { if (b.next) edges.push({ id: `e-${id}-${i}`, source: id, sourceHandle: `btn-${i}`, target: b.next, type: "deletable", animated: true }); });
    else if (node.next) edges.push({ id: `e-${id}`, source: id, target: node.next, type: "deletable", animated: true });
  });
  if (def && def.start) edges.push({ id: "e-start", source: "start", target: def.start, type: "deletable", animated: true });
  return { nodes, edges };
}

// ========================= TOP-LEVEL APP =========================
export default function App() {
  const [view, setView] = useState("dashboard");
  const [editId, setEditId] = useState(null);
  useEffect(() => { injectFont(); }, []);
  if (view === "editor") return <Editor flowId={editId} onBack={() => setView("dashboard")} />;
  return <Dashboard onEdit={(id) => { setEditId(id); setView("editor"); }} />;
}

// ========================= DASHBOARD =========================
function Dashboard({ onEdit }) {
  const [flows, setFlows] = useState(null);
  const [inboxes, setInboxes] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    try { const j = await (await fetch(`${API}/api/flows?account_id=${ACCOUNT_ID}`)).json(); setFlows(j.flows || []); } catch { setFlows([]); }
    try { const j = await (await fetch(`${API}/api/inboxes?account_id=${ACCOUNT_ID}`)).json(); setInboxes(j.inboxes || []); } catch { setInboxes([]); }
  };
  useEffect(() => { load(); }, []);

  const createBot = async () => {
    try { const j = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: "New chatbot" }) })).json(); if (j.ok) onEdit(j.flow.id); } catch { setMsg("Create failed"); }
  };
  const duplicate = async (f) => {
    setMenuOpen(null);
    try {
      const full = await (await fetch(`${API}/api/flows/${f.id}`)).json();
      const cr = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: (f.name || "Chatbot") + " (copy)" }) })).json();
      if (cr.ok) await fetch(`${API}/api/flows/${cr.flow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cr.flow.name, definition: full.flow.definition }) });
      await load();
    } catch { setMsg("Duplicate failed"); }
  };
  const exportBot = async (f) => {
    setMenuOpen(null);
    try {
      const full = await (await fetch(`${API}/api/flows/${f.id}`)).json();
      const blob = new Blob([JSON.stringify({ name: full.flow.name, definition: full.flow.definition }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${(f.name || "chatbot").replace(/\s+/g, "-")}.json`; a.click(); URL.revokeObjectURL(url);
    } catch { setMsg("Export failed"); }
  };
  const doDelete = async () => {
    const f = confirmDel; setConfirmDel(null); if (!f) return;
    try { await fetch(`${API}/api/flows/${f.id}`, { method: "DELETE" }); await load(); } catch { setMsg("Delete failed"); }
  };
  const importBot = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const cr = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: data.name || "Imported chatbot" }) })).json();
      if (cr.ok && data.definition) await fetch(`${API}/api/flows/${cr.flow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cr.flow.name, definition: data.definition }) });
      await load();
    } catch { setMsg("Import failed — galat JSON"); }
    e.target.value = "";
  };
  const assign = async (f, val) => {
    try { await fetch(`${API}/api/flows/${f.id}/assign-inbox`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inbox_id: val === "" ? null : val }) }); await load(); } catch { setMsg("Assign failed"); }
  };

  const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: T.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: T.font };
  const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: T.font };
  const pill = (s) => ({ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: s === "published" ? T.greenBg : T.grayPillBg, color: s === "published" ? T.green : T.grayPill });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, color: T.text }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 28px 12px" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Chatbots</div>
          <div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>Manage your chatbots</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input ref={fileRef} type="file" accept="application/json" onChange={importBot} style={{ display: "none" }} />
          <button style={btnGhost} onClick={() => fileRef.current?.click()}>⬆ Import</button>
          <button style={btnPrimary} onClick={createBot}>＋ Create Chatbot</button>
        </div>
      </div>

      {msg && <div style={{ margin: "0 28px 8px", color: "#dc2626", fontSize: 13 }}>{msg}</div>}

      <div style={{ padding: "8px 28px 28px" }}>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1.2fr", padding: "12px 16px", background: T.soft, fontSize: 12, fontWeight: 600, color: T.sub, textTransform: "uppercase", letterSpacing: ".03em" }}>
            <div>Name</div><div>Status</div><div>Number / Inbox</div><div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {flows === null && <div style={{ padding: 20, color: T.sub, fontSize: 13 }}>Loading…</div>}
          {flows && flows.length === 0 && <div style={{ padding: 24, color: T.sub, fontSize: 13 }}>Abhi koi chatbot nahi. “Create Chatbot” se shuru karein.</div>}

          {flows && flows.map((f) => (
            <div key={f.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1.2fr", alignItems: "center", padding: "14px 16px", borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
              <div><span style={pill(f.status)}>{f.status}</span></div>
              <div>
                <select value={f.inbox_id ?? ""} onChange={(e) => assign(f, e.target.value)} style={{ padding: "6px 8px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, fontFamily: T.font, color: T.text, background: "#fff", maxWidth: 180 }}>
                  <option value="">— None (default)</option>
                  {inboxes.map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
                </select>
              </div>
              <div style={{ position: "relative", display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                <button style={{ ...btnGhost, padding: "6px 14px" }} onClick={() => onEdit(f.id)}>Edit</button>
                <button onClick={() => setMenuOpen(menuOpen === f.id ? null : f.id)} style={{ width: 32, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 18, lineHeight: "16px", color: T.sub }}>⋮</button>
                {menuOpen === f.id && (
                  <div style={{ position: "absolute", top: 38, right: 0, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20, minWidth: 150, overflow: "hidden" }}>
                    {[["Edit", () => { setMenuOpen(null); onEdit(f.id); }], ["Duplicate", () => duplicate(f)], ["Export", () => exportBot(f)], ["Delete", () => { setMenuOpen(null); setConfirmDel(f); }]].map(([lbl, fn]) => (
                      <div key={lbl} onClick={fn} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: lbl === "Delete" ? "#dc2626" : T.text, borderTop: lbl === "Delete" ? `1px solid ${T.border}` : "none" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.soft)} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>{lbl}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 24, width: 360, fontFamily: T.font }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete chatbot?</div>
            <div style={{ fontSize: 13, color: T.sub, marginBottom: 18 }}>“{confirmDel.name}” permanently delete ho jayega.</div>
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

// ========================= EDITOR (canvas) =========================
function Editor({ flowId, onBack }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([startNode()]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("Loading…");
  const [name, setName] = useState("");
  const [flowStatus, setFlowStatus] = useState("draft");
  const idRef = useRef(1);

  useEffect(() => {
    (async () => {
      try {
        const j = await (await fetch(`${API}/api/flows/${flowId}`)).json();
        setName(j.flow.name || ""); setFlowStatus(j.flow.status);
        const { nodes: n, edges: e } = fromEngineFormat(j.flow.definition || { start: null, nodes: {} });
        setNodes(n); setEdges(e); idRef.current = n.length + 5; setStatus("Loaded");
      } catch { setStatus("Load failed"); }
    })();
  }, [flowId]);

  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, type: "deletable", animated: true }, eds)), [setEdges]);
  const onDeleteEdge = useCallback((id) => setEdges((es) => es.filter((e) => e.id !== id)), [setEdges]);
  const addNode = (kind) => { const id = `n${++idRef.current}`; setNodes((nds) => [...nds, { id, type: kind, position: { x: 320 + Math.random() * 60, y: 200 + nds.length * 40 }, data: defaultData(kind) }]); };
  const updateData = (id, patch) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  const selected = nodes.find((n) => n.id === selectedId) || null;

  async function save(publish) {
    const definition = toEngineFormat(nodes, edges);
    if (publish && !definition.start) { setStatus("⚠️ Start ko kisi node se connect karein"); return; }
    setStatus(publish ? "Publishing…" : "Saving…");
    try {
      await fetch(`${API}/api/flows/${flowId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, definition }) });
      if (publish) { const j = await (await fetch(`${API}/api/flows/${flowId}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json(); if (j.ok) { setFlowStatus("published"); setStatus("✅ Published (live)"); } else setStatus("Error: " + (j.error || "")); }
      else setStatus("✅ Saved (draft)");
    } catch { setStatus("Save failed"); }
  }
  async function unpublish() {
    try { const j = await (await fetch(`${API}/api/flows/${flowId}/unpublish`, { method: "POST" })).json(); if (j.ok) { setFlowStatus("draft"); setStatus("Unpublished"); } } catch { setStatus("Failed"); }
  }

  const tBtn = { padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: T.font };
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: T.font }}>
      <div style={{ height: 56, background: "#fff", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <button onClick={onBack} style={{ ...tBtn, border: `1px solid ${T.border}`, background: "#fff", color: T.text }}>← Back</button>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chatbot ka naam" style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 14, fontWeight: 600, fontFamily: T.font, color: T.text, minWidth: 200 }} />
        <span style={{ fontSize: 12, color: T.sub }}>{status}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {flowStatus === "published" && <button onClick={unpublish} style={{ ...tBtn, border: `1px solid ${T.border}`, background: "#fff", color: T.sub }}>Unpublish</button>}
          <button onClick={() => save(false)} style={{ ...tBtn, border: `1px solid ${T.border}`, background: "#fff", color: T.text }}>Save Draft</button>
          <button onClick={() => save(true)} style={{ ...tBtn, border: "none", background: "#16A34A", color: "#fff", fontWeight: 700 }}>Publish</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 210, background: T.soft, borderRight: `1px solid ${T.border}`, padding: 12, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 8, textTransform: "uppercase" }}>Actions</div>
          {PALETTE.map((p) => (<button key={p.kind} onClick={() => addNode(p.kind)} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: "10px 12px", border: `1px solid ${T.border}`, borderLeft: `4px solid ${p.color}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: T.text, fontFamily: T.font }}>{p.label}</button>))}
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>Connection hatane ke liye line ke beech <b style={{ color: "#dc2626" }}>✕</b> click karein.</div>
        </div>

        <div style={{ flex: 1, background: T.soft }}>
          <EdgeCtx.Provider value={{ onDeleteEdge }}>
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={{ type: "deletable", animated: true }} onNodeClick={(_, n) => setSelectedId(n.id)} onPaneClick={() => setSelectedId(null)} fitView>
              <Background color="#cbd5e1" gap={16} /><Controls /><MiniMap pannable zoomable />
            </ReactFlow>
          </EdgeCtx.Provider>
        </div>

        <div style={{ width: 290, background: "#fff", borderLeft: `1px solid ${T.border}`, padding: 16, overflowY: "auto" }}>
          {!selected && <div style={{ color: "#94a3b8", fontSize: 13 }}>Koi node select karein editing ke liye.</div>}
          {selected && selected.type === "start" && (<Ed title="On Message (Start)"><Lb>Keywords (optional)</Lb><In value={selected.data.keywords || ""} onChange={(v) => updateData(selected.id, { keywords: v })} placeholder="hi, hello, menu" /><Hn>Start ko kisi node se connect karein.</Hn></Ed>)}
          {selected && selected.type === "text" && (<Ed title="💬 Send Text"><Lb>Message</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Ed>)}
          {selected && selected.type === "buttons" && (<Ed title="🔘 Send Buttons"><Lb>Body text</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Lb>Buttons</Lb>
            {(selected.data.buttons || []).map((b, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}><In value={b.title} onChange={(v) => { const arr = [...selected.data.buttons]; arr[i] = { ...arr[i], title: v }; updateData(selected.id, { buttons: arr }); }} placeholder={`Button ${i + 1}`} /><button onClick={() => { const arr = selected.data.buttons.filter((_, j) => j !== i); updateData(selected.id, { buttons: arr }); }} style={{ border: "1px solid #fca5a5", color: "#dc2626", background: "#fff", borderRadius: 6, cursor: "pointer", padding: "0 10px" }}>✕</button></div>))}
            <button onClick={() => updateData(selected.id, { buttons: [...(selected.data.buttons || []), { title: "" }] })} style={{ marginTop: 4, padding: "8px 12px", border: "1px dashed #16A34A", color: "#16A34A", background: "#f0fdf4", borderRadius: 8, cursor: "pointer", width: "100%" }}>+ Add Button</button><Hn>Har button ke right dot ko agle node se connect karein.</Hn></Ed>)}
          {selected && selected.type === "question" && (<Ed title="❓ Ask Question"><Lb>Sawaal</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Lb>Jawab kis naam se save ho</Lb><In value={selected.data.saveAs || ""} onChange={(v) => updateData(selected.id, { saveAs: v })} placeholder="naam, email…" /></Ed>)}
          {selected && selected.type === "stop" && (<Ed title="🛑 Stop / Talk to Human"><Lb>Message (optional)</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Ed>)}
          {selected && selected.deletable !== false && (<button onClick={() => { setNodes((nds) => nds.filter((n) => n.id !== selected.id)); setEdges((e) => e.filter((ed) => ed.source !== selected.id && ed.target !== selected.id)); setSelectedId(null); }} style={{ marginTop: 16, width: "100%", padding: "8px 12px", border: "1px solid #fca5a5", color: "#dc2626", background: "#fef2f2", borderRadius: 8, cursor: "pointer" }}>Delete node</button>)}
        </div>
      </div>
    </div>
  );
}

function Ed({ title, children }) { return (<div><div style={{ fontWeight: 700, marginBottom: 12, color: T.text }}>{title}</div>{children}</div>); }
function Lb({ children }) { return <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", margin: "10px 0 4px" }}>{children}</div>; }
function Hn({ children }) { return <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>{children}</div>; }
function In({ value, onChange, placeholder }) { return (<input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} />); }
function Ar({ value, onChange }) { return (<textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: T.font }} />); }
