const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const SerialPort = require("serialport");

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

// Initialize serial port for Arduino
const arduinoPort = new SerialPort("/dev/cu.usbmodem101", { baudRate: 9600 }, (err) => {
  if (err) {
    console.error("Error opening serial port:", err);
  } else {
    console.log("Connected to Arduino via serial port.");
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  let currentSessionId = null;
  let userId = null;

  console.log("New socket connection:", socket.id);

  socket.on("join-session", (data) => {
    const { sessionId, username } = data;
    console.log(`User ${username} joining session ${sessionId}`);

    if (!chatSessions[sessionId]) {
      console.log(`Session ${sessionId} not found`);
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

    console.log(`User ${username} (${userId}) joined session ${sessionId}`);
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

    // Emit the message to other users
    io.to(currentSessionId).emit("new-message", messageData);

    // Send the message to the Arduino for display
    if (arduinoPort && arduinoPort.isOpen) {
      arduinoPort.write(message, (err) => {
        if (err) {
          console.error("Error sending message to Arduino:", err);
        } else {
          console.log("Message sent to Arduino:", message);
        }
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket ${socket.id} disconnected`);
    if (currentSessionId && chatSessions[currentSessionId] && userId) {
      const username = chatSessions[currentSessionId].users[userId]?.username;
      console.log(`User ${username} (${userId}) left session ${currentSessionId}`);
      delete chatSessions[currentSessionId].users[userId];

      socket.to(currentSessionId).emit("user-left", { userId, username });

      if (Object.keys(chatSessions[currentSessionId].users).length === 0) {
        console.log(`Session ${currentSessionId} is empty, removing it`);
        delete chatSessions[currentSessionId];
      }
    }
  });

  // WebRTC signaling with improved logging
  socket.on("voice-offer", (data) => {
    console.log("Voice offer data:", JSON.stringify(data, null, 2));
    console.log(`Voice offer from ${userId} to ${data.target}`);
    const targetUser = findUserById(data.target);
    if (targetUser) {
      socket.to(targetUser.socketId).emit("voice-offer", {
        offer: data.offer,
        from: userId,
      });
    } else {
      console.log(`Target user ${data.target} not found for voice offer`);
    }
  });

  socket.on("voice-answer", (data) => {
    console.log(`Voice answer from ${userId} to ${data.target}`);
    const targetUser = findUserById(data.target);
    if (targetUser) {
      socket.to(targetUser.socketId).emit("voice-answer", {
        answer: data.answer,
        from: userId,
      });
    } else {
      console.log(`Target user ${data.target} not found for voice answer`);
    }
  });

  socket.on("voice-ice-candidate", (data) => {
    console.log(`ICE candidate from ${userId} to ${data.target}`);
    const targetUser = findUserById(data.target);
    if (targetUser) {
      socket.to(targetUser.socketId).emit("voice-ice-candidate", {
        candidate: data.candidate,
        from: userId,
      });
    } else {
      console.log(`Target user ${data.target} not found for ICE candidate`);
    }
  });

  // Helper function to find a user by ID across all sessions
  function findUserById(targetId) {
    for (const sessionId in chatSessions) {
      const session = chatSessions[sessionId];
      if (session.users[targetId]) {
        return session.users[targetId];
      }
    }
    return null;
  }
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
