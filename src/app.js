import { Conversation } from "@elevenlabs/client";

// DOM Elements
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");
const agentForm = document.getElementById("agent-form");
const agentNameInput = document.getElementById("agent-name");
const agentPromptInput = document.getElementById("agent-prompt");
const firstMessageInput = document.getElementById("first-message");
const voiceSelect = document.getElementById("voice-select");
const languageSelect = document.getElementById("language-select");
const createAgentBtn = document.getElementById("create-agent-btn");
const agentsList = document.getElementById("agents-list");
const conversationSection = document.getElementById("conversation-section");
const activeAgentEl = document.getElementById("active-agent").querySelector("span");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let conversation = null;
let currentAgentId = null;

// Utility functions
const log = (message) => {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.prepend(entry);
};

const setStatus = (text) => {
  statusEl.textContent = `Status: ${text}`;
};

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const targetTab = tab.dataset.tab;
    
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    
    tab.classList.add("active");
    document.getElementById(`${targetTab}-tab`).classList.add("active");
    
    if (targetTab === "existing") {
      loadAgents();
    }
  });
});

// Load voices on page load
async function loadVoices() {
  try {
    const response = await fetch("/api/voices");
    if (!response.ok) throw new Error("Failed to load voices");
    
    const { voices } = await response.json();
    voiceSelect.innerHTML = voices.map(v => 
      `<option value="${v.voice_id}">${v.name} (${v.category || 'custom'})</option>`
    ).join("");
  } catch (error) {
    console.error("Error loading voices:", error);
    voiceSelect.innerHTML = '<option value="">Failed to load voices</option>';
  }
}

// Load existing agents
async function loadAgents() {
  try {
    agentsList.innerHTML = '<p>Loading agents...</p>';
    
    const response = await fetch("/api/agents");
    if (!response.ok) throw new Error("Failed to load agents");
    
    const data = await response.json();
    const agents = data.agents || [];
    
    if (agents.length === 0) {
      agentsList.innerHTML = '<p>No agents found. Create one first!</p>';
      return;
    }
    
    agentsList.innerHTML = agents.map(agent => `
      <div class="agent-card">
        <div class="agent-card-info">
          <h4>${agent.name || 'Unnamed Agent'}</h4>
          <p>ID: ${agent.agent_id}</p>
        </div>
        <button onclick="window.selectAgent('${agent.agent_id}', '${(agent.name || 'Unnamed Agent').replace(/'/g, "\\'")}')">
          Select
        </button>
      </div>
    `).join("");
  } catch (error) {
    console.error("Error loading agents:", error);
    agentsList.innerHTML = '<p>Failed to load agents. Please try again.</p>';
  }
}

// Select an agent for conversation
window.selectAgent = function(agentId, agentName) {
  currentAgentId = agentId;
  activeAgentEl.textContent = agentName;
  conversationSection.classList.remove("hidden");
  startBtn.disabled = false;
  log(`Selected agent: ${agentName}`);
};

// Create new agent
agentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const prompt = agentPromptInput.value.trim();
  if (!prompt) {
    alert("Please enter a system prompt for your agent.");
    return;
  }
  
  createAgentBtn.disabled = true;
  createAgentBtn.innerHTML = '<span class="loading"></span>Creating...';
  
  try {
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agentNameInput.value.trim() || "Custom Agent",
        prompt: prompt,
        firstMessage: firstMessageInput.value.trim(),
        voiceId: voiceSelect.value,
        language: languageSelect.value,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details?.detail?.message || error.error || "Failed to create agent");
    }
    
    const agent = await response.json();
    log(`Created agent: ${agent.agent_id}`);
    
    // Auto-select the new agent
    window.selectAgent(agent.agent_id, agentNameInput.value.trim() || "Custom Agent");
    
    // Clear form
    agentForm.reset();
    
  } catch (error) {
    console.error("Error creating agent:", error);
    alert(`Failed to create agent: ${error.message}`);
  } finally {
    createAgentBtn.disabled = false;
    createAgentBtn.innerHTML = 'Create Agent';
  }
});

// Get WebRTC token
async function getWebRTCToken(agentId) {
  const response = await fetch("/api/webrtc-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to retrieve WebRTC token");
  }
  
  return response.json();
}

// Start conversation
async function startCall() {
  if (!currentAgentId) {
    alert("Please select an agent first.");
    return;
  }
  
  startBtn.disabled = true;
  stopBtn.disabled = true;
  setStatus("requesting token");

  try {
    const { token } = await getWebRTCToken(currentAgentId);
    if (!token) throw new Error("Server did not return a token");
    
    log("Fetched WebRTC token");
    setStatus("connecting via WebRTC");

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
        log(`Status: ${status.status}`);
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
}

// Stop conversation
async function stopCall() {
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
}

// Event listeners
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

// Initialize
loadVoices();
