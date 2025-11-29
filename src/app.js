import { Conversation } from "@elevenlabs/client";

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let conversation = null;

const log = (message) => {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.prepend(entry);
};

const setStatus = (text) => {
  statusEl.textContent = `Status: ${text}`;
};

const getWebRTCToken = async () => {
  const response = await fetch("/api/webrtc-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to retrieve WebRTC token");
  }
  return response.json();
};

const startCall = async () => {
  startBtn.disabled = true;
  stopBtn.disabled = true;
  setStatus("requesting token");

  try {
    // Get WebRTC token from server
    const { token } = await getWebRTCToken();
    if (!token) {
      throw new Error("Server did not return a token");
    }
    log("Fetched WebRTC token");

    setStatus("connecting via WebRTC");

    // Start conversation using ElevenLabs client SDK
    conversation = await Conversation.startSession({
      conversationToken: token,
      onConnect: () => {
        log("WebRTC connected");
        setStatus("connected");
        stopBtn.disabled = false;
      },
      onDisconnect: (details) => {
        log(`Disconnected: ${details?.reason || "unknown reason"}`);
        setStatus("disconnected");
        conversation = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
      },
      onMessage: (message) => {
        // Handle different message types
        if (message.type === "agent_response") {
          log(`Agent: ${message.message}`);
        } else if (message.type === "user_transcript") {
          log(`You: ${message.message}`);
        } else if (message.type === "interruption") {
          log("Interruption detected");
        } else if (message.type === "error") {
          log(`Error: ${message.message || "Unknown error"}`);
        }
      },
      onError: (error) => {
        log(`Error: ${error.message || "Unknown error"}`);
        console.error("Conversation error:", error);
      },
      onModeChange: (mode) => {
        log(`Mode: ${mode.mode}`);
      },
      onStatusChange: (status) => {
        log(`Status changed: ${status.status}`);
      },
    });

    log(`Conversation started: ${conversation.getId()}`);
  } catch (error) {
    log(`Error: ${error.message}`);
    setStatus("error");
    conversation = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
};

const stopCall = async () => {
  stopBtn.disabled = true;
  setStatus("disconnecting");
  
  if (conversation) {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error("Error ending session:", error);
    }
    conversation = null;
  }
  
  log("Conversation stopped");
  setStatus("idle");
  startBtn.disabled = false;
};

startBtn.addEventListener("click", () => {
  setStatus("starting");
  startCall();
});

stopBtn.addEventListener("click", () => {
  stopCall();
});

window.addEventListener("beforeunload", () => {
  if (conversation) {
    conversation.endSession();
  }
});

