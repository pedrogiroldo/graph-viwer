"use client";

import { useState, useRef, useEffect } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type Cytoscape from "cytoscape";
import { dijkstra, type GraphEdge } from "@/lib/dijkstra";

interface Node {
  id: string;
  label: string;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

export default function ShortPathPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [startNode, setStartNode] = useState<string>("");
  const [endNode, setEndNode] = useState<string>("");
  const [shortestPath, setShortestPath] = useState<string[]>([]);
  const [shortestDistance, setShortestDistance] = useState<number | null>(null);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newEdgeSource, setNewEdgeSource] = useState("");
  const [newEdgeTarget, setNewEdgeTarget] = useState("");
  const [newEdgeWeight, setNewEdgeWeight] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cyRef = useRef<Cytoscape.Core | null>(null);

  // Calcular caminho mais curto sempre que mudar
  useEffect(() => {
    if (startNode && endNode && edges.length > 0) {
      calculateShortestPath();
    } else {
      setShortestPath([]);
      setShortestDistance(null);
    }
  }, [edges, startNode, endNode]);

  // Ajustar layout do cytoscape quando entrar/sair de tela cheia ou quando elementos mudarem
  useEffect(() => {
    if (cyRef.current && nodes.length > 0) {
      const timeoutId = setTimeout(() => {
        cyRef.current?.fit();
        cyRef.current?.center();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isFullscreen, nodes.length, edges.length]);

  // Ajustar layout quando a janela for redimensionada (mobile)
  useEffect(() => {
    const handleResize = () => {
      if (cyRef.current && nodes.length > 0) {
        setTimeout(() => {
          cyRef.current?.fit();
          cyRef.current?.center();
        }, 200);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [nodes.length]);

  const calculateShortestPath = () => {
    if (!startNode || !endNode || edges.length === 0) {
      setShortestPath([]);
      setShortestDistance(null);
      return;
    }

    const graphEdges: GraphEdge[] = edges.map((edge) => ({
      from: edge.source,
      to: edge.target,
      weight: edge.weight,
    }));

    const result = dijkstra(graphEdges, startNode, endNode);

    if (result) {
      setShortestPath(result.path);
      setShortestDistance(result.distance);
    } else {
      setShortestPath([]);
      setShortestDistance(null);
    }
  };

  const addNode = () => {
    if (!newNodeLabel.trim()) return;
    const nodeId = newNodeLabel.trim().toUpperCase();
    
    // Verificar se já existe
    if (nodes.some((n) => n.id === nodeId)) {
      alert("Nó já existe!");
      return;
    }

    setNodes([...nodes, { id: nodeId, label: nodeId }]);
    setNewNodeLabel("");
  };

  const addEdge = () => {
    if (!newEdgeSource || !newEdgeTarget || !newEdgeWeight) return;
    
    const source = newEdgeSource.trim().toUpperCase();
    const target = newEdgeTarget.trim().toUpperCase();
    const weight = parseFloat(newEdgeWeight);

    if (isNaN(weight) || weight < 0) {
      alert("Peso deve ser um número positivo!");
      return;
    }

    // Verificar se os nós existem
    if (!nodes.some((n) => n.id === source) || !nodes.some((n) => n.id === target)) {
      alert("Um ou ambos os nós não existem!");
      return;
    }

    // Verificar se já existe aresta entre esses nós
    const edgeId = `${source}-${target}`;
    const reverseEdgeId = `${target}-${source}`;
    if (
      edges.some((e) => e.id === edgeId || e.id === reverseEdgeId)
    ) {
      alert("Aresta já existe entre esses nós!");
      return;
    }

    setEdges([
      ...edges,
      { id: edgeId, source, target, weight },
    ]);
    setNewEdgeSource("");
    setNewEdgeTarget("");
    setNewEdgeWeight("");
  };

  const removeNode = (nodeId: string) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (startNode === nodeId) setStartNode("");
    if (endNode === nodeId) setEndNode("");
  };

  const removeEdge = (edgeId: string) => {
    setEdges(edges.filter((e) => e.id !== edgeId));
  };

  const loadInitialData = () => {
    const initialNodes: Node[] = [
      { id: "A", label: "A" },
      { id: "B", label: "B" },
      { id: "C", label: "C" },
      { id: "D", label: "D" },
      { id: "E", label: "E" },
      { id: "F", label: "F" },
    ];
    const initialEdges: Edge[] = [
      { id: "A-B", source: "A", target: "B", weight: 2 },
      { id: "B-D", source: "B", target: "D", weight: 1 },
      { id: "D-F", source: "D", target: "F", weight: 4 },
      { id: "A-C", source: "A", target: "C", weight: 5 },
      { id: "B-E", source: "B", target: "E", weight: 3 },
      { id: "C-E", source: "C", target: "E", weight: 1 },
      { id: "E-F", source: "E", target: "F", weight: 2 },
    ];
    setNodes(initialNodes);
    setEdges(initialEdges);
    setStartNode("A");
    setEndNode("F");
  };

  // Estilos do cytoscape (responsivo)
  const cyStylesheet = [
    {
      selector: "node",
      style: {
        "background-color": "#5b5b5b",
        label: "data(label)",
        color: "white",
        width: 40,
        height: 40,
        "text-valign": "center",
        "text-halign": "center",
        "font-size": "14px",
        "font-weight": "bold",
        shape: "ellipse",
      },
    },
    {
      selector: "edge",
      style: {
        "line-color": "#777",
        width: 2,
        "target-arrow-color": "#777",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        label: "data(weight)",
        "font-size": "11px",
        "text-rotation": "autorotate",
        "text-margin-y": -10,
        color: "#999",
      },
    },
    {
      selector: "node:selected",
      style: {
        "background-color": "#3b82f6",
        "border-width": 3,
        "border-color": "#60a5fa",
      },
    },
    {
      selector: ".shortest-path-node",
      style: {
        "background-color": "#10b981",
        "border-width": 3,
        "border-color": "#34d399",
      },
    },
    {
      selector: ".shortest-path-edge",
      style: {
        "line-color": "#10b981",
        width: 4,
        "target-arrow-color": "#10b981",
      },
    },
  ];

  const cyLayout = {
    name: "cose",
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 30,
    nodeDimensionsIncludeLabels: true,
  };

  // Preparar elementos do cytoscape
  const cyElements = [
    ...nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
      },
      classes: shortestPath.includes(node.id) ? "shortest-path-node" : "",
    })),
    ...edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
      },
      classes: isEdgeInShortestPath(edge) ? "shortest-path-edge" : "",
    })),
  ];

  function isEdgeInShortestPath(edge: Edge): boolean {
    if (shortestPath.length < 2) return false;
    for (let i = 0; i < shortestPath.length - 1; i++) {
      if (
        (shortestPath[i] === edge.source && shortestPath[i + 1] === edge.target) ||
        (shortestPath[i] === edge.target && shortestPath[i + 1] === edge.source)
      ) {
        return true;
      }
    }
    return false;
  }

  // Modo tela cheia
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col">
        {/* Header minimalista em tela cheia */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={() => setIsFullscreen(false)}
            className="px-4 py-2 bg-zinc-900/90 border border-zinc-800 rounded-lg text-zinc-100 hover:bg-zinc-800 transition-colors backdrop-blur-sm"
          >
            Sair da Tela Cheia
          </button>
        </div>
        {/* Grafo em tela cheia */}
        <div className="w-full h-full p-4">
          {cyElements.length > 0 ? (
            <CytoscapeComponent
              elements={cyElements}
              style={{ width: "100%", height: "100%" }}
              stylesheet={cyStylesheet}
              layout={cyLayout}
              cy={(cy: Cytoscape.Core) => {
                cyRef.current = cy;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400">
              Adicione nós e arestas para visualizar o grafo
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex-shrink-0">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 max-w-[1920px]">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Caminho Mais Curto - Algoritmo de Dijkstra
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-[1920px] flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Coluna 1: Visualização do Grafo - Em cima no mobile, esquerda no desktop */}
          <div className="lg:col-span-2 flex flex-col gap-4 order-1 lg:order-1">
            {/* Grafo */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-2 sm:p-4 backdrop-blur-sm shadow-2xl flex flex-col min-h-[400px] sm:min-h-[500px] lg:min-h-0 lg:flex-1">
              <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-zinc-100">
                  Visualização do Grafo
                </h2>
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-1 sm:gap-2"
                  title="Abrir em tela cheia"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3 sm:h-4 sm:w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  <span className="hidden sm:inline">Tela Cheia</span>
                </button>
              </div>
              <div className="bg-zinc-950 rounded-lg border border-zinc-800 flex-1 overflow-hidden shadow-inner min-h-[350px] sm:min-h-[450px] lg:min-h-0">
                {cyElements.length > 0 ? (
                  <CytoscapeComponent
                    elements={cyElements}
                    style={{ width: "100%", height: "100%" }}
                    stylesheet={cyStylesheet}
                    layout={cyLayout}
                    cy={(cy: Cytoscape.Core) => {
                      cyRef.current = cy;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm sm:text-base px-4 text-center">
                    Adicione nós e arestas para visualizar o grafo
                  </div>
                )}
              </div>
            </div>

            {/* Resultado do Caminho Mais Curto */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 sm:p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-zinc-100 mb-2 sm:mb-3">
                Caminho Mais Curto
              </h2>
              {shortestDistance !== null ? (
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-zinc-400 text-sm sm:text-base">Distância:</span>
                    <span className="text-green-400 font-bold text-xl sm:text-2xl">
                      {shortestDistance}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
                    <span className="text-zinc-400 text-sm sm:text-base flex-shrink-0">Caminho:</span>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {shortestPath.map((node, index) => (
                        <div key={index} className="flex items-center gap-1.5 sm:gap-2">
                          <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 font-semibold text-sm sm:text-base">
                            {node}
                          </span>
                          {index < shortestPath.length - 1 && (
                            <span className="text-zinc-500 text-sm sm:text-base">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-400 text-sm sm:text-base">
                  Não há caminho entre os nós selecionados.
                </p>
              )}
            </div>
          </div>

          {/* Coluna 2: Controles - Embaixo no mobile, direita no desktop */}
          <div className="flex flex-col gap-4 order-2 lg:order-2 lg:h-full lg:overflow-y-auto lg:pr-2">
            {/* Botão Carregar Dados Iniciais */}
            {nodes.length === 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 sm:p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
                <p className="text-xs sm:text-sm text-zinc-400 mb-2 sm:mb-3 text-center">
                  Comece criando seus próprios nós e arestas, ou carregue um exemplo inicial.
                </p>
                <button
                  onClick={loadInitialData}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-lg transition-all text-xs sm:text-sm"
                >
                  Carregar Dados Iniciais
                </button>
              </div>
            )}

            {/* Seleção de Nós - Compacto */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 sm:p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
              <h2 className="text-base sm:text-lg font-semibold text-zinc-100 mb-2 sm:mb-3">
                Caminho
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-400 mb-1.5 sm:mb-2">
                    Inicial
                  </label>
                  <select
                    value={startNode}
                    onChange={(e) => setStartNode(e.target.value)}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-400 mb-1.5 sm:mb-2">
                    Final
                  </label>
                  <select
                    value={endNode}
                    onChange={(e) => setEndNode(e.target.value)}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Adicionar Elementos - Agrupado */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 sm:p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
              <h2 className="text-base sm:text-lg font-semibold text-zinc-100 mb-2 sm:mb-3">
                Adicionar
              </h2>
              <div className="space-y-3 sm:space-y-4">
                {/* Adicionar Nó */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-400 mb-1.5 sm:mb-2">
                    Novo Nó
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNodeLabel}
                      onChange={(e) => setNewNodeLabel(e.target.value)}
                      placeholder="Ex: G"
                      maxLength={5}
                      className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === "Enter" && addNode()}
                    />
                    <button
                      onClick={addNode}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all text-sm sm:text-base"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Adicionar Aresta */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-400 mb-1.5 sm:mb-2">
                    Nova Aresta
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newEdgeSource}
                        onChange={(e) => setNewEdgeSource(e.target.value)}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Origem</option>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newEdgeTarget}
                        onChange={(e) => setNewEdgeTarget(e.target.value)}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Destino</option>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newEdgeWeight}
                        onChange={(e) => setNewEdgeWeight(e.target.value)}
                        placeholder="Peso"
                        min="0"
                        step="0.1"
                        className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === "Enter" && addEdge()}
                      />
                      <button
                        onClick={addEdge}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all text-sm sm:text-base"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Elementos - Com Tabs */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 sm:p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
              <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
                <h2 className="text-base sm:text-lg font-semibold text-zinc-100">
                  Elementos
                </h2>
                <div className="flex gap-1.5 sm:gap-2">
                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-600/20 text-blue-400 rounded text-xs sm:text-sm">
                    {nodes.length} nós
                  </span>
                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-600/20 text-purple-400 rounded text-xs sm:text-sm">
                    {edges.length} arestas
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                {/* Lista de Nós */}
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-zinc-400 mb-1.5 sm:mb-2 uppercase tracking-wide">
                    Nós
                  </h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    {nodes.length === 0 ? (
                      <p className="text-zinc-500 text-xs sm:text-sm text-center py-3 sm:py-4">
                        Nenhum nó
                      </p>
                    ) : (
                      nodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                              node.id === startNode ? 'bg-blue-500' :
                              node.id === endNode ? 'bg-green-500' :
                              'bg-zinc-600'
                            }`}></div>
                            <span className="text-zinc-100 font-medium text-xs sm:text-sm">
                              {node.label}
                            </span>
                          </div>
                          <button
                            onClick={() => removeNode(node.id)}
                            className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs sm:text-sm transition-colors"
                            title="Remover nó"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Lista de Arestas */}
                <div>
                  <h3 className="text-xs sm:text-sm font-medium text-zinc-400 mb-1.5 sm:mb-2 uppercase tracking-wide">
                    Arestas
                  </h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    {edges.length === 0 ? (
                      <p className="text-zinc-500 text-xs sm:text-sm text-center py-3 sm:py-4">
                        Nenhuma aresta
                      </p>
                    ) : (
                      edges.map((edge) => (
                        <div
                          key={edge.id}
                          className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 hover:border-zinc-700 transition-colors"
                        >
                          <span className="text-zinc-100 text-xs sm:text-sm truncate pr-2">
                            <span className="font-medium">{edge.source}</span>
                            <span className="text-zinc-500 mx-1 sm:mx-1.5">→</span>
                            <span className="font-medium">{edge.target}</span>
                            <span className="text-zinc-500 ml-1 sm:ml-2">({edge.weight})</span>
                          </span>
                          <button
                            onClick={() => removeEdge(edge.id)}
                            className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs sm:text-sm transition-colors flex-shrink-0"
                            title="Remover aresta"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
