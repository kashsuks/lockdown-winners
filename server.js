const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const path = require("path")
const QRCode = require("qrcode")
const { v4: uuidv4 } = require("uuid")

const app = express()
const server = http.createServer(app)
const io = socketIo(server)

// Serve static files
app.use(express.static(path.join(__dirname, "public")))

// In-memory storage for chat sessions
const chatSessions = {}

// Get local IP address
function getLocalIp() {
  const { networkInterfaces } = require("os")
  const nets = networkInterfaces()

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address
      }
    }
  }
  return "localhost"
}

// Generate QR code data
app.get("/api/generate-qr", (req, res) => {
  const sessionId = uuidv4()
  const localIp = getLocalIp()
  const port = process.env.PORT || 3000

  // Create new chat session
  chatSessions[sessionId] = {
    messages: [],
    users: {},
  }

  const qrData = JSON.stringify({
    ip: `${localIp}:${port}`,
    session: sessionId,
  })

  QRCode.toDataURL(qrData, (err, url) => {
    if (err) {
      res.status(500).json({ error: "Failed to generate QR code" })
      return
    }
    res.json({ qrUrl: url, sessionId, serverIp: `${localIp}:${port}` })
  })
})

// Socket.io connection handling
io.on("connection", (socket) => {
  let currentSessionId = null
  let userId = null

  // Join a chat session
  socket.on("join-session", (data) => {
    const { sessionId, username } = data

    if (!chatSessions[sessionId]) {
      socket.emit("error", { message: "Session not found" })
      return
    }

    currentSessionId = sessionId
    userId = uuidv4()

    // Add user to session
    chatSessions[sessionId].users[userId] = {
      id: userId,
      username: username || `User-${userId.substring(0, 4)}`,
      socketId: socket.id,
    }

    // Join the room
    socket.join(sessionId)

    // Send existing messages to the new user
    socket.emit("session-joined", {
      sessionId,
      messages: chatSessions[sessionId].messages,
      userId,
      username: chatSessions[sessionId].users[userId].username,
    })

    // Notify others that a new user joined
    socket.to(sessionId).emit("user-joined", {
      userId,
      username: chatSessions[sessionId].users[userId].username,
    })
  })

  // Handle chat messages
  socket.on("send-message", (data) => {
    if (!currentSessionId || !chatSessions[currentSessionId]) return

    const { message } = data
    const user = chatSessions[currentSessionId].users[userId]

    if (!user) return

    const messageData = {
      id: uuidv4(),
      userId,
      username: user.username,
      text: message,
      timestamp: Date.now(),
    }

    // Save message to session
    chatSessions[currentSessionId].messages.push(messageData)

    // Broadcast to all users in the session
    io.to(currentSessionId).emit("new-message", messageData)
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    if (currentSessionId && chatSessions[currentSessionId] && userId) {
      // Remove user from session
      const username = chatSessions[currentSessionId].users[userId]?.username
      delete chatSessions[currentSessionId].users[userId]

      // Notify others that user left
      socket.to(currentSessionId).emit("user-left", { userId, username })

      // Clean up empty sessions
      if (Object.keys(chatSessions[currentSessionId].users).length === 0) {
        delete chatSessions[currentSessionId]
      }
    }
  })
})

// Start server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})