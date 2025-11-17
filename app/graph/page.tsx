"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type Cytoscape from "cytoscape";
import { io, Socket } from "socket.io-client";

interface Node {
  id: string;
  label: string;
}

interface Edge {
  source: string;
  target: string;
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cyRef = useRef<Cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadGraph = useCallback(async () => {
    try {
      const response = await fetch("/api/graph");
      if (!response.ok) {
        setNodes([]);
        setEdges([]);
        return;
      }
      const data = await response.json();
      setNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setEdges(Array.isArray(data.edges) ? data.edges : []);
      
      // Atualizar layout do Cytoscape após carregar dados
      if (cyRef.current) {
        setTimeout(() => {
          const layout = {
            name: "cose",
            animate: true,
            animationDuration: 1000,
            fit: true,
            padding: 30,
          };
          cyRef.current?.layout(layout).run();
        }, 100);
      }
    } catch (error) {
      console.error("Erro ao carregar grafo:", error);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Determinar URL do Socket.io (usar window.location.origin no cliente)
    const socketUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

    console.log("Conectando ao Socket.io em:", socketUrl);

    // Conectar Socket.io
    const newSocket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      autoConnect: true,
    });

    newSocket.on("connect", () => {
      console.log("✅ Conectado ao Socket.io - /graph, ID:", newSocket.id);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Desconectado do Socket.io, motivo:", reason);
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Erro ao conectar Socket.io:", error);
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Reconectado ao Socket.io após", attemptNumber, "tentativas");
    });

    newSocket.on("reconnect_attempt", (attemptNumber) => {
      console.log("🔄 Tentativa de reconexão", attemptNumber);
    });

    // Escutar evento de atualização do grafo
    newSocket.on("graph-updated", () => {
      console.log("📡 Evento graph-updated recebido, atualizando grafo...");
      loadGraph();
    });

    // Escutar todos os eventos para debug
    newSocket.onAny((eventName, ...args) => {
      console.log("📨 Evento recebido:", eventName, args);
    });

    setSocket(newSocket);

    // Carregar dados iniciais
    loadGraph();

    return () => {
      console.log("🧹 Limpando conexão Socket.io");
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.off("reconnect");
      newSocket.off("reconnect_attempt");
      newSocket.off("graph-updated");
      newSocket.offAny();
      newSocket.close();
    };
  }, [loadGraph]);

  // Função para entrar/sair de tela cheia
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      // Entrar em tela cheia
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((containerRef.current as any).mozRequestFullScreen) {
        (containerRef.current as any).mozRequestFullScreen();
      } else if ((containerRef.current as any).msRequestFullscreen) {
        (containerRef.current as any).msRequestFullscreen();
      }
    } else {
      // Sair de tela cheia
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  // Escutar mudanças de tela cheia
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Configuração do Cytoscape
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
        "font-size": "12px",
        "font-weight": "bold",
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
      },
    },
  ];

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];

  const cyElements = [
    ...safeNodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
      },
    })),
    ...safeEdges.map((edge, index) => ({
      data: {
        id: `edge-${index}`,
        source: edge.source,
        target: edge.target,
      },
    })),
  ];

  // Configuração do layout do Cytoscape
  const cyLayout = {
    name: "cose",
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 30,
  };

  // Ajustar layout quando entrar/sair de tela cheia ou quando os elementos mudarem
  useEffect(() => {
    if (cyRef.current && cyElements.length > 0) {
      setTimeout(() => {
        cyRef.current?.layout(cyLayout).run();
      }, 100);
    }
  }, [isFullscreen, nodes.length, edges.length]);

  return (
    <div
      ref={containerRef}
      className={`bg-zinc-950 text-zinc-50 ${
        isFullscreen ? "w-screen h-screen" : "min-h-screen"
      } relative`}
    >
      {/* Botão de tela cheia */}
      {!isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-10 p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-100 transition-all duration-200 backdrop-blur-sm shadow-lg hover:shadow-xl"
          title="Tela cheia"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      )}

      {/* Botão para sair de tela cheia */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-10 p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-100 transition-all duration-200 backdrop-blur-sm shadow-lg hover:shadow-xl"
          title="Sair de tela cheia"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Container do grafo */}
      <div
        className={`${
          isFullscreen ? "w-full h-full" : "container mx-auto px-4 py-8"
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-zinc-400">Carregando grafo...</p>
            </div>
          </div>
        ) : cyElements.length > 0 ? (
          <div className={`${isFullscreen ? "w-full h-full" : "h-[800px]"}`}>
            <CytoscapeComponent
              elements={cyElements}
              style={{ width: "100%", height: "100%" }}
              stylesheet={cyStylesheet}
              layout={cyLayout}
              cy={(cy: Cytoscape.Core) => {
                cyRef.current = cy;
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <p className="text-zinc-400 text-lg">
                Nenhum dado para exibir
              </p>
              <p className="text-zinc-500 text-sm mt-2">
                O grafo aparecerá aqui quando houver usuários e conexões
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
