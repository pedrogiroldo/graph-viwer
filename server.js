const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Cliente conectado ao Socket.io:", socket.id);

    socket.on("disconnect", () => {
      console.log("❌ Cliente desconectado do Socket.io:", socket.id);
    });
  });

  // Tornar io acessível globalmente para as APIs
  global.io = io;
  
  // Log quando eventos são emitidos
  const originalEmit = io.emit.bind(io);
  io.emit = function(event, ...args) {
    console.log(`📤 Socket.io emitindo evento: ${event}`, args.length > 0 ? args : "");
    return originalEmit(event, ...args);
  };

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
