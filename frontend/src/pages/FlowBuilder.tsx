import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, ToggleLeft, ToggleRight, ArrowLeft, Zap, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getFlow, saveFlow, toggleFlow } from "../api";
import Button from "../components/ui/Button";
import { nodeTypes, NODE_CATEGORIES, NODE_META } from "../components/flow/NodeTypes";
import ConfigPanel from "../components/flow/ConfigPanel";

let nodeIdCounter = 100;

export default function FlowBuilder() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { workspace } = useAuthStore();
  const provider = (workspace as any)?.whatsapp_provider ?? "twilio";

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flowName, setFlowName] = useState("Untitled Flow");
  const [isActive, setIsActive] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Always-fresh refs — no stale closure issues
  const workspaceRef = useRef(workspace);
  const flowIdRef = useRef(flowId);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const flowNameRef = useRef(flowName);

  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);
  useEffect(() => { flowIdRef.current = flowId; }, [flowId]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { flowNameRef.current = flowName; }, [flowName]);

  // Load flow on mount
  useEffect(() => {
    if (!workspace || !flowId) return;
    getFlow(workspace.id, flowId).then((data) => {
      setFlowName(data.name);
      setIsActive(data.is_active);
      if (data.nodes?.length) setNodes(data.nodes);
      if (data.edges?.length) setEdges(data.edges);
    }).catch(console.error);
  }, [workspace?.id, flowId]);

  // Core save — always reads from refs so never stale
  const doSave = useCallback(async (saveNodes: Node[], saveEdges: Edge[]) => {
    const ws = workspaceRef.current;
    const fid = flowIdRef.current;
    if (!ws || !fid) return;
    setSaving(true);
    const triggerNode = saveNodes.find((n) =>
      n.type?.startsWith("trigger") || n.type === "keyword_trigger"
    );
    const triggerConfig = triggerNode ? {
      keywords: (triggerNode.data as any)?.keyword ?? "",
      match_type: (triggerNode.data as any)?.match_type ?? "contains",
      ...(triggerNode.data as any),
    } : undefined;
    try {
      await saveFlow(ws.id, fid, {
        name: flowNameRef.current,
        nodes: saveNodes,
        edges: saveEdges,
        ...(triggerConfig ? { trigger_config: triggerConfig } : {}),
      });
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleSave = useCallback((n: Node[], e: Edge[]) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(n, e), 800);
  }, [doSave]);

  const onConnect = useCallback((conn: Connection) => {
    setEdges((eds) => {
      const updated = addEdge({
        ...conn,
        animated: true,
        style: { stroke: "#22c55e" },
        type: "default",
      }, eds);
      scheduleSave(nodesRef.current, updated);
      return updated;
    });
  }, [scheduleSave]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("nodeType");
    const label = e.dataTransfer.getData("nodeLabel");
    if (!type) return;
    const bounds = (e.target as HTMLElement).closest(".react-flow")?.getBoundingClientRect();
    if (!bounds) return;
    const newNode: Node = {
      id: `node_${++nodeIdCounter}`,
      type,
      position: { x: e.clientX - bounds.left - 95, y: e.clientY - bounds.top - 30 },
      data: { label },
    };
    setNodes((nds) => {
      const updated = [...nds, newNode];
      scheduleSave(updated, edgesRef.current);
      return updated;
    });
  }, [scheduleSave]);

  const onNodeDataChange = useCallback((id: string, data: object) => {
    setNodes((nds) => {
      const updated = nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n);
      scheduleSave(updated, edgesRef.current);
      return updated;
    });
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev);
  }, [scheduleSave]);

  const handleSave = () => doSave(nodesRef.current, edgesRef.current);

  const handleToggle = async () => {
    if (!workspace || !flowId) return;
    const updated = await toggleFlow(workspace.id, flowId);
    setIsActive(updated.is_active);
  };

  const onNodeClick = useCallback((_: any, node: Node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  // Save after node/edge deletion (Delete key)
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    const hasDelete = changes.some((c: any) => c.type === "remove");
    if (hasDelete) {
      const remaining = nodesRef.current.filter(
        (n) => !changes.find((c: any) => c.type === "remove" && c.id === n.id)
      );
      // also remove edges connected to deleted nodes
      const deletedIds = changes.filter((c: any) => c.type === "remove").map((c: any) => c.id);
      const remainingEdges = edgesRef.current.filter(
        (e) => !deletedIds.includes(e.source) && !deletedIds.includes(e.target)
      );
      scheduleSave(remaining, remainingEdges);
      if (selectedNode && deletedIds.includes(selectedNode.id)) setSelectedNode(null);
    }
  }, [onNodesChange, scheduleSave, selectedNode]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    const hasDelete = changes.some((c: any) => c.type === "remove");
    if (hasDelete) {
      const remaining = edgesRef.current.filter(
        (e) => !changes.find((c: any) => c.type === "remove" && c.id === e.id)
      );
      scheduleSave(nodesRef.current, remaining);
    }
  }, [onEdgesChange, scheduleSave]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => {
      const updated = nds.filter((n) => n.id !== selectedNode.id);
      const updatedEdges = edgesRef.current.filter(
        (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
      );
      setEdges(updatedEdges);
      scheduleSave(updated, updatedEdges);
      return updated;
    });
    setSelectedNode(null);
  }, [selectedNode, scheduleSave, setNodes, setEdges]);
  const toggleCategory = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0 z-10">
        <button onClick={() => navigate("/automations")} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="font-semibold text-gray-900 bg-transparent border-none outline-none text-sm w-52"
        />
        <div className="flex-1" />
        <span className="text-xs text-gray-400 hidden sm:block">
          {nodes.length} nodes · {edges.length} connections
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          provider === "twilio" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
        }`}>
          {provider === "twilio" ? "Twilio" : "Meta"}
        </span>
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-600"
        >
          {isActive ? <ToggleRight size={20} className="text-green-600" /> : <ToggleLeft size={20} />}
          <span className="text-xs">{isActive ? "Active" : "Inactive"}</span>
        </button>
        <Button size="sm" onClick={handleSave} loading={saving}>
          <Save size={14} /> Save
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Node Palette */}
        <div className="w-52 border-r border-gray-200 bg-white flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Node Library</p>
            {NODE_CATEGORIES.map((cat) => {
              const visibleNodes = provider === "twilio"
                ? cat.nodes.filter((n) => n.twilio)
                : cat.nodes;
              if (visibleNodes.length === 0) return null;
              return (
                <div key={cat.category} className="mb-2">
                  <button
                    onClick={() => toggleCategory(cat.category)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-wide py-1 hover:text-gray-700"
                  >
                    {cat.category}
                    {collapsed[cat.category] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {!collapsed[cat.category] && (
                    <div className="space-y-1 mt-1">
                      {visibleNodes.map(({ type, label, icon: Icon, bg, text }) => (
                        <div
                          key={type}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("nodeType", type);
                            e.dataTransfer.setData("nodeLabel", label);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 cursor-grab hover:border-gray-300 hover:shadow-sm transition-all bg-white"
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${bg}`}>
                            <Icon size={11} className={text} />
                          </div>
                          <span className="text-gray-700 text-xs truncate">{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            defaultEdgeOptions={{ type: "default", animated: true, style: { stroke: "#22c55e" } }}
            className="bg-gray-50"
          >
            <Background gap={20} color="#e5e7eb" />
            <Controls />
            <MiniMap
              nodeColor={(n) => NODE_META[n.type ?? ""]?.text?.replace("text-", "#") ?? "#22c55e"}
              className="!bg-white !border !border-gray-200 !rounded-lg"
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <Zap size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Drag nodes from the left panel</p>
                <p className="text-xs mt-1 opacity-70">Start with a Trigger node, then add actions</p>
              </div>
            </div>
          )}

          {selectedNode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2 pointer-events-auto z-10">
              <span className="text-xs text-gray-500">Selected: <strong>{String(selectedNode.data?.label ?? selectedNode.type)}</strong></span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-400">Press <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">Delete</kbd> or</span>
              <button onClick={deleteSelectedNode} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
                <Trash2 size={12} /> Remove
              </button>
            </div>
          )}
        </div>

        {/* Config Panel */}
        {selectedNode && (
          <ConfigPanel
            node={selectedNode}
            onChange={onNodeDataChange}
            onClose={() => setSelectedNode(null)}
            onDelete={deleteSelectedNode}
          />
        )}
      </div>
    </div>
  );
}
