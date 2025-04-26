document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const welcomeScreen = document.getElementById("welcome-screen")
    const qrScreen = document.getElementById("qr-screen")
    const scannerScreen = document.getElementById("scanner-screen")
    const usernameScreen = document.getElementById("username-screen")
    const chatScreen = document.getElementById("chat-screen")
  
    const createRoomBtn = document.getElementById("create-room-btn")
    const joinRoomBtn = document.getElementById("join-room-btn")
    const enterChatBtn = document.getElementById("enter-chat-btn")
    const backFromQrBtn = document.getElementById("back-from-qr-btn")
    const backFromScannerBtn = document.getElementById("back-from-scanner-btn")
    const backFromUsernameBtn = document.getElementById("back-from-username-btn")
    const joinChatBtn = document.getElementById("join-chat-btn")
    const leaveChatBtn = document.getElementById("leave-chat-btn")
  
    const qrCodeContainer = document.getElementById("qr-code")
    const sessionInfoText = document.getElementById("session-info")
    const usernameInput = document.getElementById("username-input")
    const messagesContainer = document.getElementById("messages-container")
    const messageInput = document.getElementById("message-input")
    const sendBtn = document.getElementById("send-btn")
    const usersCountText = document.getElementById("users-count")
  
    // App state
    let socket
    let sessionData = null
    let currentUser = {
      id: null,
      username: null,
    }
    let connectedUsers = {}
    let html5QrCode
  
    // Voice chat state
    let isVoiceEnabled = false;
    let localStream = null;
    let peerConnections = {};
    const voiceParticipants = document.getElementById("voice-participants");
    const toggleVoiceBtn = document.getElementById("toggle-voice-btn");
  
    // socket.io init
    function initializeSocket() {
      socket = io()
  
      // event listeners
      socket.on("session-joined", (data) => {
        sessionData = {
          sessionId: data.sessionId,
        }
  
        currentUser = {
          id: data.userId,
          username: data.username,
        }
  
        // add messages
        data.messages.forEach((message) => {
          addMessageToChat(message)
        })
  
        // show chat
        showScreen(chatScreen)
      })
  
      socket.on("user-joined", (data) => {
        connectedUsers[data.userId] = data.username
        updateUsersCount()
        addSystemMessage(`${data.username} joined the chat`)

        if (isVoiceEnabled) {
          createPeerConnection(data.userId);
        }
      })
  
      socket.on("user-left", (data) => {
        delete connectedUsers[data.userId]
        updateUsersCount()
        addSystemMessage(`${data.username} left the chat`)

        if (peerConnections[data.userId]) {
          peerConnections[data.userId].close();
          delete peerConnections[data.userId];
        }
      })
  
      socket.on("new-message", (data) => {
        addMessageToChat(data)
      })
  
      socket.on("error", (data) => {
        alert(data.message)
        showScreen(welcomeScreen)
      })
    }
  
    // show a screen
    function showScreen(screen) {
      document.querySelectorAll(".screen").forEach((s) => {
        s.classList.remove("active")
      })
      screen.classList.add("active")
    }
  
    // create a chat
    async function createRoom() {
      try {
        const response = await fetch("/api/generate-qr")
        const data = await response.json()
  
        // qr code
        qrCodeContainer.innerHTML = `<img src="${data.qrUrl}" alt="QR Code">`
        sessionInfoText.textContent = `Session ID: ${data.sessionId} | Server: ${data.serverIp}`
  
        // session data
        sessionData = {
          sessionId: data.sessionId,
          serverIp: data.serverIp,
        }
  
        showScreen(qrScreen)
      } catch (error) {
        console.error("Error creating room:", error)
        alert("Failed to create room. Please try again.")
      }
    }
  
    // qr code init
    function initScanner() {
      if (html5QrCode) {
        html5QrCode.clear()
      }
  
      html5QrCode = new Html5Qrcode("qr-reader")
  
      html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        onScanFailure,
      )
    }
  
    // 200 qr code scan
    function onScanSuccess(decodedText) {
      try {
        const data = JSON.parse(decodedText)
  
        if (data.ip && data.session) {
          // stop scan
          html5QrCode.stop()
  
          // session data
          sessionData = {
            sessionId: data.session,
            serverIp: data.ip,
          }
  
          // username/login screen
          showScreen(usernameScreen)
        } else {
          throw new Error("Invalid QR code format")
        }
      } catch (error) {
        console.error("Error parsing QR code:", error)
        alert("Invalid QR code. Please try again.")
      }
    }
  
    // Handle QR code scan failure
    function onScanFailure(error) {
      // We can ignore this as it's called frequently when no QR code is detected
      console.debug(`QR scan error: ${error}`)
    }
  
    // Join a chat session
    function joinChat() {
      const username = usernameInput.value.trim() || `User-${Math.floor(Math.random() * 1000)}`
  
      if (!sessionData || !sessionData.sessionId) {
        alert("Session data is missing. Please try again.")
        showScreen(welcomeScreen)
        return
      }
  
      // Initialize socket if not already done
      if (!socket) {
        initializeSocket()
      }
  
      // Join session
      socket.emit("join-session", {
        sessionId: sessionData.sessionId,
        username: username,
      })
    }
  
    // Send a chat message
    function sendMessage() {
      const message = messageInput.value.trim()
  
      if (!message) return
  
      socket.emit("send-message", { message })
      messageInput.value = ""
    }
  
    // Add a message to the chat
    function addMessageToChat(message) {
      const messageElement = document.createElement("div")
      messageElement.classList.add("message")
  
      // Check if message is from current user
      const isCurrentUser = message.userId === currentUser.id
      messageElement.classList.add(isCurrentUser ? "sent" : "received")
  
      // Format timestamp
      const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  
      messageElement.innerHTML = `
        <div class="message-info">
          ${isCurrentUser ? "You" : message.username} • ${timestamp}
        </div>
        <div class="message-text">${escapeHtml(message.text)}</div>
      `
  
      messagesContainer.appendChild(messageElement)
      scrollToBottom()
    }
  
    // Add a system message to the chat
    function addSystemMessage(text) {
      const messageElement = document.createElement("div")
      messageElement.classList.add("system-message")
      messageElement.textContent = text
  
      messagesContainer.appendChild(messageElement)
      scrollToBottom()
    }
  
    // Update the users count display
    function updateUsersCount() {
      const count = Object.keys(connectedUsers).length + 1
      usersCountText.textContent = `Users: ${count}`
    }
  
    // Scroll to the bottom of the messages container
    function scrollToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  
    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    }
  
    // leave
    function leaveChat() {
      if (socket) {
        socket.disconnect()
      }
  
      // Reset state
      sessionData = null
      currentUser = { id: null, username: null }
      connectedUsers = {}
      messagesContainer.innerHTML = ""
  
      showScreen(welcomeScreen)
    }
  
    // Event listeners
    createRoomBtn.addEventListener("click", createRoom)
  
    joinRoomBtn.addEventListener("click", () => {
      showScreen(scannerScreen)
      initScanner()
    })
  
    enterChatBtn.addEventListener("click", () => {
      showScreen(usernameScreen)
    })
  
    backFromQrBtn.addEventListener("click", () => {
      showScreen(welcomeScreen)
    })
  
    backFromScannerBtn.addEventListener("click", () => {
      if (html5QrCode) {
        html5QrCode.stop()
      }
      showScreen(welcomeScreen)
    })
  
    backFromUsernameBtn.addEventListener("click", () => {
      showScreen(welcomeScreen)
    })
  
    joinChatBtn.addEventListener("click", joinChat)
  
    leaveChatBtn.addEventListener("click", leaveChat)
  
    sendBtn.addEventListener("click", sendMessage)
  
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessage()
      }
    })
  
    // Initialize the app
    initializeSocket()

    // Initialize WebRTC
    async function initializeVoiceChat() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isVoiceEnabled = true;
        toggleVoiceBtn.textContent = "🎤 Stop Voice Chat";
        addSystemMessage("Voice chat enabled");

        // Create peer connections for existing users
        Object.keys(connectedUsers).forEach(userId => {
          if (userId !== currentUser.id) {
            createPeerConnection(userId);
          }
        });
      } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Could not access microphone. Please check your permissions.");
      }
    }

    // Stop voice chat
    function stopVoiceChat() {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }
      Object.values(peerConnections).forEach(pc => pc.close());
      peerConnections = {};
      isVoiceEnabled = false;
      toggleVoiceBtn.textContent = "🎤 Start Voice Chat";
      voiceParticipants.innerHTML = "";
      addSystemMessage("Voice chat disabled");
    }

    // Create peer connection
    function createPeerConnection(targetUserId) {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }
        ]
      });

      peerConnections[targetUserId] = peerConnection;

      // Add local stream
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("voice-ice-candidate", {
            target: targetUserId,
            candidate: event.candidate
          });
        }
      };

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        const audioElement = document.createElement("audio");
        audioElement.srcObject = event.streams[0];
        audioElement.autoplay = true;
        voiceParticipants.appendChild(audioElement);
      };

      // Create and send offer
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
          socket.emit("voice-offer", {
            target: targetUserId,
            offer: peerConnection.localDescription
          });
        });

      return peerConnection;
    }

    // Handle voice chat toggle
    toggleVoiceBtn.addEventListener("click", () => {
      if (!isVoiceEnabled) {
        initializeVoiceChat();
      } else {
        stopVoiceChat();
      }
    });

    // WebRTC signaling handlers
    socket.on("voice-offer", async (data) => {
      if (!isVoiceEnabled) return;

      const peerConnection = createPeerConnection(data.from);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("voice-answer", {
        target: data.from,
        answer: answer
      });
    });

    socket.on("voice-answer", async (data) => {
      const peerConnection = peerConnections[data.from];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on("voice-ice-candidate", async (data) => {
      const peerConnection = peerConnections[data.from];
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
  })
  