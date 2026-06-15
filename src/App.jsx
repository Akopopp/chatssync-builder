import { useCallback, useRef, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position,
} from "reactflow";
import "reactflow/dist/style.css";

// ---------- Colors per node type ----------
const C = { start: "#0EA5E9", text: "#2781F6", buttons: "#16A34A", question: "#9333EA", stop: "#DC2626" };

// ---------- Shared styles ----------
const box = (sel) => ({
  background: "#fff", borderRadius: 10, width: 230,
  border: sel ? "2px solid #2781F6" : "1px solid #e2e8f0",
  boxShadow: "0 2px 6px rgba(0,0,0,.12)", fontFamily: "Arial, sans-serif",
  fontSize: 12, overflow: "hidden",
});
const head = (bg) => ({ background: bg, color: "#fff", padding: "8px 10px", fontWeight: 700, fontSize: 12 });
const body = { padding: 10, color: "#334155", whiteSpace: "pre-wrap", minHeight: 18, lineHeight: 1.4 };
const btnRow = {
  position: "relative", margin: "6px 10px", padding: "6px 24px 6px 8px",
  border: "1px solid #cbd5e1", borderRadius: 6, background: "#f1f5f9", color: "#1e293b",
};

// ---------- Custom Nodes ----------
function StartNode({ data, selected }) {
  return (
    <div style={box(selected)}>
      <div style={head(C.start)}>⚡ On Message (Start)</div>
      <div style={body}>{data.keywords ? `Keywords: ${data.keywords}` : "Pehle message par flow shuru"}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
function TextNode({ data, selected }) {
  return (
    <div style={box(selected)}>
      <Handle type="target" position={Position.Top} />
      <div style={head(C.text)}>💬 Send Text</div>
      <div style={body}>{data.text || "…"}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
function ButtonsNode({ data, selected }) {
  const buttons = data.buttons || [];
  return (
    <div style={box(selected)}>
      <Handle type="target" position={Position.Top} />
      <div style={head(C.buttons)}>🔘 Send Buttons</div>
      <div style={body}>{data.text || "…"}</div>
      {buttons.map((b, i) => (
        <div key={i} style={btnRow}>
          {b.title || `Button ${i + 1}`}
          <Handle
            type="source" position={Position.Right} id={`btn-${i}`}
            style={{ top: "50%", right: -7, transform: "translateY(-50%)", background: C.buttons, width: 10, height: 10 }}
          />
        </div>
      ))}
      <div style={{ height: 6 }} />
    </div>
  );
}
function QuestionNode({ data, selected }) {
  return (
    <div style={box(selected)}>
      <Handle type="target" position={Position.Top} />
      <div style={head(C.question)}>❓ Ask Question</div>
      <div style={body}>
        {data.text || "…"}
        {data.saveAs ? <div style={{ marginTop: 6, fontSize: 11, color: "#7c3aed" }}>→ save as: {data.saveAs}</div> : null}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
function StopNode({ data, selected }) {
  return (
    <div style={box(selected)}>
      <Handle type="target" position={Position.Top} />
      <div style={head(C.stop)}>🛑 Stop / Talk to Human</div>
      <div style={body}>{data.text || "(koi message nahi)"}</div>
    </div>
  );
}

const nodeTypes = { start: StartNode, text: TextNode, buttons: ButtonsNode, question: QuestionNode, stop: StopNode };

// ---------- Defaults for new nodes ----------
function defaultData(kind) {
  if (kind === "text") return { text: "Apna message yahan likhein…" };
  if (kind === "buttons") return { text: "Customer ko kya poochna hai?", buttons: [{ title: "Option 1" }, { title: "Option 2" }] };
  if (kind === "question") return { text: "Aapka sawaal…", saveAs: "answer" };
  if (kind === "stop") return { text: "Aapko ek agent se jod rahe hain 🙌" };
  return {};
}

// ---------- Palette items ----------
const PALETTE = [
  { kind: "text", label: "💬 Send Text", color: C.text },
  { kind: "buttons", label: "🔘 Send Buttons", color: C.buttons },
  { kind: "question", label: "❓ Ask Question", color: C.question },
  { kind: "stop", label: "🛑 Stop / Human", color: C.stop },
];

const initialNodes = [
  { id: "start", type: "start", position: { x: 320, y: 40 }, data: { keywords: "" }, deletable: false },
];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const idRef = useRef(1);

  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, animated: true }, eds)), [setEdges]);

  const addNode = (kind) => {
    const id = `n${++idRef.current}`;
    setNodes((nds) => [
      ...nds,
      { id, type: kind, position: { x: 320 + Math.random() * 60, y: 180 + nds.length * 40 }, data: defaultData(kind) },
    ]);
  };

  const updateData = (id, patch) =>
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));

  const selected = nodes.find((n) => n.id === selectedId) || null;

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "Arial, sans-serif" }}>
      {/* Top bar */}
      <div style={{ height: 48, background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
        <b>ChatsSync Builder</b>
        <span style={{ fontSize: 12, opacity: .6 }}>nodes: {nodes.length} · edges: {edges.length}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, opacity: .6 }}>Save & Publish — 5.4 mein</span>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LEFT palette */}
        <div style={{ width: 210, background: "#f8fafc", borderRight: "1px solid #e2e8f0", padding: 12, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>Actions</div>
          {PALETTE.map((p) => (
            <button
              key={p.kind} onClick={() => addNode(p.kind)}
              style={{
                display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: "10px 12px",
                border: "1px solid #e2e8f0", borderLeft: `4px solid ${p.color}`, borderRadius: 8,
                background: "#fff", cursor: "pointer", fontSize: 13, color: "#1e293b",
              }}
            >
              {p.label}
            </button>
          ))}
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>
            Click se node add hota hai. Nodes ko handles se connect karein. Node click → right mein edit.
          </div>
        </div>

        {/* CENTER canvas */}
        <div style={{ flex: 1, background: "#0f1115" }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
          >
            <Background color="#333" gap={16} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {/* RIGHT editor */}
        <div style={{ width: 290, background: "#fff", borderLeft: "1px solid #e2e8f0", padding: 16, overflowY: "auto" }}>
          {!selected && <div style={{ color: "#94a3b8", fontSize: 13 }}>Koi node select karein editing ke liye.</div>}

          {selected && selected.type === "start" && (
            <Editor title="On Message (Start)">
              <Label>Keywords (optional)</Label>
              <Input value={selected.data.keywords || ""} onChange={(v) => updateData(selected.id, { keywords: v })} placeholder="hi, hello, menu" />
              <Hint>Abhi flow har pehle message par chalता hai. Keywords baad mein use honge.</Hint>
            </Editor>
          )}

          {selected && selected.type === "text" && (
            <Editor title="💬 Send Text">
              <Label>Message</Label>
              <Area value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} />
            </Editor>
          )}

          {selected && selected.type === "buttons" && (
            <Editor title="🔘 Send Buttons">
              <Label>Body text</Label>
              <Area value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} />
              <Label>Buttons</Label>
              {(selected.data.buttons || []).map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <Input
                    value={b.title}
                    onChange={(v) => {
                      const arr = [...selected.data.buttons]; arr[i] = { ...arr[i], title: v };
                      updateData(selected.id, { buttons: arr });
                    }}
                    placeholder={`Button ${i + 1}`}
                  />
                  <button
                    onClick={() => { const arr = selected.data.buttons.filter((_, j) => j !== i); updateData(selected.id, { buttons: arr }); }}
                    style={{ border: "1px solid #fca5a5", color: "#dc2626", background: "#fff", borderRadius: 6, cursor: "pointer", padding: "0 10px" }}
                  >✕</button>
                </div>
              ))}
              <button
                onClick={() => updateData(selected.id, { buttons: [...(selected.data.buttons || []), { title: "" }] })}
                style={{ marginTop: 4, padding: "8px 12px", border: "1px dashed #16A34A", color: "#16A34A", background: "#f0fdf4", borderRadius: 8, cursor: "pointer", width: "100%" }}
              >+ Add Button</button>
              <Hint>Har button ke right dot ko agle node se connect karein (kaunsा button kahan jaye).</Hint>
            </Editor>
          )}

          {selected && selected.type === "question" && (
            <Editor title="❓ Ask Question">
              <Label>Sawaal</Label>
              <Area value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} />
              <Label>Jawab kis naam se save ho</Label>
              <Input value={selected.data.saveAs || ""} onChange={(v) => updateData(selected.id, { saveAs: v })} placeholder="naam, email, feedback…" />
            </Editor>
          )}

          {selected && selected.type === "stop" && (
            <Editor title="🛑 Stop / Talk to Human">
              <Label>Message (optional)</Label>
              <Area value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} />
              <Hint>Bot ruk jata hai aur chat agent ko mil jati hai.</Hint>
            </Editor>
          )}

          {selected && selected.deletable !== false && (
            <button
              onClick={() => { setNodes((nds) => nds.filter((n) => n.id !== selected.id)); setEdges((e) => e.filter((ed) => ed.source !== selected.id && ed.target !== selected.id)); setSelectedId(null); }}
              style={{ marginTop: 16, width: "100%", padding: "8px 12px", border: "1px solid #fca5a5", color: "#dc2626", background: "#fef2f2", borderRadius: 8, cursor: "pointer" }}
            >Delete node</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Small editor UI helpers ----------
function Editor({ title, children }) {
  return (<div><div style={{ fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>{title}</div>{children}</div>);
}
function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", margin: "10px 0 4px" }}>{children}</div>;
}
function Hint({ children }) {
  return <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>{children}</div>;
}
function Input({ value, onChange, placeholder }) {
  return (
    <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
  );
}
function Area({ value, onChange }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4}
      style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "Arial, sans-serif" }} />
  );
}
