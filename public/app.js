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
    let isVoiceEnabled = false
    let localStream = null
    let peerConnections = {}
    const voiceParticipants = document.getElementById("voice-participants")
    const toggleVoiceBtn = document.getElementById("toggle-voice-btn")
    
    // Store pending offers
    const pendingOffers = {}
  
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
          createPeerConnection(data.userId)
        }
      })
  
      socket.on("user-left", (data) => {
        delete connectedUsers[data.userId]
        updateUsersCount()
        addSystemMessage(`${data.username} left the chat`)
  
        if (peerConnections[data.userId]) {
          peerConnections[data.userId].close()
          delete peerConnections[data.userId]
        }
      })
  
      socket.on("new-message", (data) => {
        addMessageToChat(data)
      })
  
      socket.on("error", (data) => {
        alert(data.message)
        showScreen(welcomeScreen)
      })
  
      socket.on("voice-offer", async (data) => {
        console.log("Received voice offer from:", data.from)
        console.log("Offer data:", JSON.stringify(data.offer, null, 2))
        
        if (!isVoiceEnabled) {
          console.log("Voice chat not enabled, storing offer for later")
          pendingOffers[data.from] = data.offer
          return
        }

        try {
          console.log("Creating peer connection for offer from:", data.from)
          const peerConnection = createPeerConnection(data.from)
          
          console.log("Setting remote description from offer")
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
          
          console.log("Creating answer")
          const answer = await peerConnection.createAnswer()
          
          console.log("Setting local description from answer")
          await peerConnection.setLocalDescription(answer)
          
          console.log("Sending answer to:", data.from)
          socket.emit("voice-answer", {
            target: data.from,
            answer: answer,
          })
          
          console.log("Answer sent successfully")
        } catch (error) {
          console.error("Error handling voice offer:", error)
        }
      })
  
      socket.on("voice-answer", async (data) => {
        console.log("Received voice answer from:", data.from)
        console.log("Answer data:", JSON.stringify(data.answer, null, 2))
        
        const peerConnection = peerConnections[data.from]
        if (peerConnection) {
          try {
            console.log("Setting remote description from answer")
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            console.log("Remote description set successfully")
          } catch (error) {
            console.error("Error setting remote description:", error)
          }
        } else {
          console.error("No peer connection found for user:", data.from)
        }
      })
  
      socket.on("voice-ice-candidate", async (data) => {
        console.log("Received ICE candidate from:", data.from)
        console.log("ICE candidate data:", JSON.stringify(data.candidate, null, 2))
        
        const peerConnection = peerConnections[data.from]
        if (peerConnection) {
          try {
            console.log("Adding ICE candidate")
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
            console.log("ICE candidate added successfully")
          } catch (error) {
            console.error("Error adding ICE candidate:", error)
          }
        } else {
          console.error("No peer connection found for ICE candidate from:", data.from)
        }
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
        console.log("Initializing voice chat...")
  
        // First check if the browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser doesn't support audio capture")
        }
  
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        })
  
        console.log("Got local audio stream:", localStream.getAudioTracks()[0].label)
  
        // Check if we actually got audio tracks
        if (localStream.getAudioTracks().length === 0) {
          throw new Error("No audio track was captured")
        }
  
        isVoiceEnabled = true
        toggleVoiceBtn.textContent = "🎤 Stop Voice Chat"
        toggleVoiceBtn.style.backgroundColor = "#e74c3c"
        addSystemMessage("Voice chat enabled")
  
        // Process any pending offers
        for (const [userId, offer] of Object.entries(pendingOffers)) {
          console.log("Processing pending offer from:", userId)
          try {
            const peerConnection = createPeerConnection(userId)
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
            const answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)
            socket.emit("voice-answer", {
              target: userId,
              answer: answer,
            })
            console.log("Sent answer to pending offer from:", userId)
          } catch (error) {
            console.error("Error processing pending offer:", error)
          }
        }
        // Clear pending offers
        Object.keys(pendingOffers).forEach(key => delete pendingOffers[key])
  
        // Create peer connections for existing users
        Object.keys(connectedUsers).forEach((userId) => {
          if (userId !== currentUser.id) {
            console.log("Creating peer connection for user:", userId)
            createPeerConnection(userId)
          }
        })
  
        // Add a test tone to verify audio is working
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
  
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime) // A4 note
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime) // Low volume
  
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
  
        oscillator.start()
        setTimeout(() => {
          oscillator.stop()
        }, 500)
      } catch (error) {
        console.error("Error accessing microphone:", error)
        alert("Could not access microphone: " + error.message)
        stopVoiceChat()
      }
    }
  
    // Stop voice chat
    function stopVoiceChat() {
      console.log("Stopping voice chat...")
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          console.log("Stopping track:", track.label)
          track.stop()
        })
        localStream = null
      }
      Object.values(peerConnections).forEach((pc) => {
        console.log("Closing peer connection")
        pc.close()
      })
      peerConnections = {}
      isVoiceEnabled = false
      toggleVoiceBtn.textContent = "🎤 Start Voice Chat"
      voiceParticipants.innerHTML = ""
      addSystemMessage("Voice chat disabled")
    }
  
    // Create peer connection
    function createPeerConnection(targetUserId) {
      console.log("Creating new peer connection for user:", targetUserId)
  
      // Check if connection already exists
      if (peerConnections[targetUserId]) {
        console.log("Peer connection already exists for:", targetUserId)
        return peerConnections[targetUserId]
      }
  
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          {
            urls: "turn:numb.viagenie.ca",
            credential: "muazkh",
            username: "webrtc@live.com",
          },
        ],
      })
  
      peerConnections[targetUserId] = peerConnection
  
      // Add local stream
      if (localStream) {
        console.log("Adding local stream tracks to peer connection")
        localStream.getTracks().forEach((track) => {
          console.log("Adding track:", track.kind, track.label)
          peerConnection.addTrack(track, localStream)
        })

        // Create and send offer
        console.log("Creating offer for peer:", targetUserId)
        peerConnection.createOffer()
          .then(offer => {
            console.log("Setting local description from offer")
            return peerConnection.setLocalDescription(offer)
          })
          .then(() => {
            console.log("Sending offer to:", targetUserId)
            socket.emit("voice-offer", {
              target: targetUserId,
              offer: peerConnection.localDescription
            })
          })
          .catch(error => {
            console.error("Error creating/sending offer:", error)
          })
      }
  
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate to:", targetUserId)
          socket.emit("voice-ice-candidate", {
            target: targetUserId,
            candidate: event.candidate,
          })
        }
      }
  
      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log("Connection state changed:", peerConnection.connectionState)
        if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "disconnected") {
          console.log("Connection failed or disconnected, attempting to reconnect")
          // Close the old connection
          peerConnection.close()
          delete peerConnections[targetUserId]
          // Try to create a new connection after a short delay
          setTimeout(() => {
            if (isVoiceEnabled) {
              createPeerConnection(targetUserId)
            }
          }, 2000)
        }
      }
  
      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnection.iceConnectionState)
      }
  
      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        console.log("Received audio track from peer:", targetUserId)
        console.log("Track info:", event.track.kind, event.track.label)
        console.log("Stream info:", event.streams[0].id)

        // Create a new MediaStream for this peer
        const remoteStream = new MediaStream()
        peerConnection.getReceivers().forEach((receiver) => {
          if (receiver.track) {
            console.log("Adding track to remote stream:", receiver.track.kind, receiver.track.label)
            remoteStream.addTrack(receiver.track)
          }
        })

        // Remove any existing audio element for this user
        const existingElement = document.querySelector(`[data-user-id="${targetUserId}"]`)
        if (existingElement) {
          existingElement.remove()
        }

        const audioElement = document.createElement("audio")
        audioElement.srcObject = remoteStream
        audioElement.autoplay = true
        audioElement.controls = true
        audioElement.style.display = "block"
        audioElement.setAttribute("data-user-id", targetUserId)

        // Add volume control
        const volumeControl = document.createElement("input")
        volumeControl.type = "range"
        volumeControl.min = 0
        volumeControl.max = 1
        volumeControl.step = 0.1
        volumeControl.value = 1
        volumeControl.style.width = "100%"
        volumeControl.oninput = (e) => {
          audioElement.volume = e.target.value
        }

        const container = document.createElement("div")
        container.style.marginBottom = "10px"
        container.setAttribute("data-user-id", targetUserId)
        container.appendChild(audioElement)
        container.appendChild(volumeControl)

        voiceParticipants.appendChild(container)

        // Set up track event listeners
        event.track.onunmute = () => {
          console.log("Audio data arriving for track:", event.track.label)
        }

        event.track.onmute = () => {
          console.log("Audio data stopped for track:", event.track.label)
        }

        // Check if we're actually receiving audio data
        let audioCheckInterval = setInterval(async () => {
          try {
            const stats = await peerConnection.getStats()
            let hasAudioData = false
            
            stats.forEach(report => {
              if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                if (report.packetsReceived > 0) {
                  hasAudioData = true
                }
              }
            })

            if (!hasAudioData) {
              console.log("No audio data received, attempting to reconnect...")
              clearInterval(audioCheckInterval)
              peerConnection.close()
              delete peerConnections[targetUserId]
              setTimeout(() => {
                if (isVoiceEnabled) {
                  createPeerConnection(targetUserId)
                }
              }, 2000)
            }
          } catch (error) {
            console.error("Error checking audio stats:", error)
          }
        }, 5000) // Check every 5 seconds

        audioElement.onloadedmetadata = () => {
          console.log("Audio metadata loaded, attempting to play")
          audioElement.play().catch((e) => {
            console.error("Error playing audio:", e)
            alert("Error playing audio. Please check your browser's audio settings.")
          })
        }
      }
  
      return peerConnection
    }
  
    // Handle voice chat toggle
    toggleVoiceBtn.addEventListener("click", () => {
      if (!isVoiceEnabled) {
        initializeVoiceChat()
      } else {
        stopVoiceChat()
      }
    })
  })
  