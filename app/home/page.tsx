"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import CytoscapeComponent from "react-cytoscapejs";
import { io, Socket } from "socket.io-client";

interface Node {
  id: string;
  label: string;
}

interface Edge {
  source: string;
  target: string;
}

interface User {
  id: number;
  username: string;
  name: string;
  isFollowing?: boolean;
  _count?: {
    following: number;
    followers: number;
  };
}

interface Post {
  id: number;
  follower: { id: number; username: string; name: string };
  following: { id: number; username: string; name: string };
  action: string;
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const cyRef = useRef<any>(null);

  useEffect(() => {
    // Verificar autenticação
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      router.push("/login");
      return;
    }

    const user = JSON.parse(userStr);
    setCurrentUser(user);

    // Conectar Socket.io
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Conectado ao Socket.io");
    });

    newSocket.on("graph-updated", () => {
      loadGraph();
    });

    newSocket.on("posts-updated", () => {
      loadPosts();
    });

    newSocket.on("users-updated", () => {
      loadUsers();
    });

    setSocket(newSocket);

    // Carregar dados iniciais
    loadGraph();
    loadPosts();
    loadUsers();

    return () => {
      newSocket.close();
    };
  }, [router]);

  const loadGraph = async () => {
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
    } catch (error) {
      console.error("Erro ao carregar grafo:", error);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const response = await fetch("/api/posts?limit=20");
      if (response.ok) {
        const data = await response.json();
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      }
    } catch (error) {
      console.error("Erro ao carregar posts:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const userId = currentUser?.id;
      const response = await fetch(`/api/users${userId ? `?currentUserId=${userId}` : ""}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data.users) ? data.users : []);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  const handleFollow = async (followingId: number) => {
    if (!currentUser) return;

    try {
      const response = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerId: currentUser.id,
          followingId,
        }),
      });

      if (response.ok) {
        await loadUsers();
        await loadGraph();
        await loadPosts();
        // Socket emitirá evento automaticamente via API
      }
    } catch (error) {
      console.error("Erro ao seguir:", error);
    }
  };

  const handleUnfollow = async (followingId: number) => {
    if (!currentUser) return;

    try {
      const response = await fetch("/api/unfollow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerId: currentUser.id,
          followingId,
        }),
      });

      if (response.ok) {
        await loadUsers();
        await loadGraph();
        await loadPosts();
      }
    } catch (error) {
      console.error("Erro ao deixar de seguir:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

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

  const cyLayout = {
    name: "cose",
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 30,
  };

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "agora";
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Rede Social
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-400">
                Olá, <span className="text-zinc-100 font-medium">{currentUser?.name}</span>
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Grafo */}
          <div className="lg:col-span-2 space-y-6">
            {/* Grafo */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-zinc-100">Grafo de Relacionamentos</h2>
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-zinc-400">Live</span>
                </div>
              </div>
              <div className="bg-zinc-950 rounded-lg border border-zinc-800 h-[500px] overflow-hidden shadow-inner">
                <CytoscapeComponent
                  elements={cyElements}
                  style={{ width: "100%", height: "100%" }}
                  stylesheet={cyStylesheet}
                  layout={cyLayout}
                  cy={(cy: any) => {
                    cyRef.current = cy;
                  }}
                />
              </div>
            </div>

            {/* Posts */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
              <h2 className="text-xl font-semibold text-zinc-100 mb-4">Atividade Recente</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {posts.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">Nenhuma atividade ainda</p>
                ) : (
                  posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {post.follower.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-zinc-100">
                            <span className="font-semibold">{post.follower.name}</span>{" "}
                            {post.action === "follow" ? "seguiu" : "deixou de seguir"}{" "}
                            <span className="font-semibold">{post.following.name}</span>
                          </p>
                          <p className="text-zinc-400 text-sm mt-1">{formatDate(post.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Coluna 2: Lista de Usuários */}
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
              <h2 className="text-xl font-semibold text-zinc-100 mb-4">Usuários</h2>
              <div className="space-y-3 max-h-[800px] overflow-y-auto">
                {users.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">Nenhum usuário encontrado</p>
                ) : (
                  users
                    .filter((user) => user.id !== currentUser?.id)
                    .map((user) => (
                      <div
                        key={user.id}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-100">{user.name}</p>
                              <p className="text-sm text-zinc-400">@{user.username}</p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              user.isFollowing
                                ? handleUnfollow(user.id)
                                : handleFollow(user.id)
                            }
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              user.isFollowing
                                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                                : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                            }`}
                          >
                            {user.isFollowing ? "Seguindo" : "Seguir"}
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
