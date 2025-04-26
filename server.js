const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// In-memory storage for chat sessions
const chatSessions = {};

// Get local IP address
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

// Generate QR code data
app.get("/api/generate-qr", (req, res) => {
  const sessionId = uuidv4();
  const localIp = getLocalIp();
  const port = process.env.PORT || 3000;

  // Create new chat session
  chatSessions[sessionId] = {
    messages: [],
    users: {},
  };

  const qrData = JSON.stringify({
    ip: `${localIp}:${port}`,
    session: sessionId,
  });

  QRCode.toDataURL(qrData, (err, url) => {
    if (err) {
      res.status(500).json({ error: "Failed to generate QR code" });
      return;
    }
    res.json({ qrUrl: url, sessionId, serverIp: `${localIp}:${port}` });
  });
});

// Socket.io connection handling
io.on("connection", (socket) => {
  let currentSessionId = null;
  let userId = null;

  socket.on("join-session", (data) => {
    const { sessionId, username } = data;

    if (!chatSessions[sessionId]) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    currentSessionId = sessionId;
    userId = uuidv4();

    chatSessions[sessionId].users[userId] = {
      id: userId,
      username: username || `User-${userId.substring(0, 4)}`,
      socketId: socket.id,
    };

    socket.join(sessionId);

    socket.emit("session-joined", {
      sessionId,
      messages: chatSessions[sessionId].messages,
      userId,
      username: chatSessions[sessionId].users[userId].username,
    });

    socket.to(sessionId).emit("user-joined", {
      userId,
      username: chatSessions[sessionId].users[userId].username,
    });
  });

  socket.on("send-message", (data) => {
    if (!currentSessionId || !chatSessions[currentSessionId]) return;

    const { message } = data;
    const user = chatSessions[currentSessionId].users[userId];
    if (!user) return;

    const messageData = {
      id: uuidv4(),
      userId,
      username: user.username,
      text: message,
      timestamp: Date.now(),
    };

    chatSessions[currentSessionId].messages.push(messageData);

    io.to(currentSessionId).emit("new-message", messageData);
  });

  socket.on("disconnect", () => {
    if (currentSessionId && chatSessions[currentSessionId] && userId) {
      const username = chatSessions[currentSessionId].users[userId]?.username;
      delete chatSessions[currentSessionId].users[userId];

      socket.to(currentSessionId).emit("user-left", { userId, username });

      if (Object.keys(chatSessions[currentSessionId].users).length === 0) {
        delete chatSessions[currentSessionId];
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const localIp = getLocalIp();

// NOTE: Listen on 0.0.0.0 to allow external access
server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running at:");
  console.log(`- Local:    http://localhost:${PORT}`);
  console.log(`- Network:  http://${localIp}:${PORT}`);
});
