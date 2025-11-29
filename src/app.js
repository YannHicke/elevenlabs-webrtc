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

// Edit modal elements
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editAgentId = document.getElementById("edit-agent-id");
const editAgentName = document.getElementById("edit-agent-name");
const editAgentPrompt = document.getElementById("edit-agent-prompt");
const editFirstMessage = document.getElementById("edit-first-message");
const editVoiceSelect = document.getElementById("edit-voice-select");
const editLanguageSelect = document.getElementById("edit-language-select");
const saveAgentBtn = document.getElementById("save-agent-btn");
const deleteAgentBtn = document.getElementById("delete-agent-btn");

let conversation = null;
let currentAgentId = null;
let voicesCache = null;

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
    voicesCache = voices;
    
    const options = voices.map(v => 
      `<option value="${v.voice_id}">${v.name} (${v.category || 'custom'})</option>`
    ).join("");
    
    voiceSelect.innerHTML = options;
    editVoiceSelect.innerHTML = options;
  } catch (error) {
    console.error("Error loading voices:", error);
    voiceSelect.innerHTML = '<option value="">Failed to load voices</option>';
    editVoiceSelect.innerHTML = '<option value="">Failed to load voices</option>';
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
        <div class="agent-card-actions">
          <button class="btn-edit" onclick="window.editAgent('${agent.agent_id}')">
            Edit
          </button>
          <button onclick="window.selectAgent('${agent.agent_id}', '${(agent.name || 'Unnamed Agent').replace(/'/g, "\\'")}')">
            Select
          </button>
        </div>
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

// Open edit modal
window.editAgent = async function(agentId) {
  try {
    editModal.classList.remove("hidden");
    editForm.reset();
    editAgentId.value = agentId;
    saveAgentBtn.disabled = true;
    saveAgentBtn.innerHTML = '<span class="loading"></span>Loading...';
    
    const response = await fetch(`/api/agents/${agentId}`);
    if (!response.ok) throw new Error("Failed to load agent");
    
    const agent = await response.json();
    
    // Populate form
    editAgentName.value = agent.name || '';
    editAgentPrompt.value = agent.conversation_config?.agent?.prompt?.prompt || '';
    editFirstMessage.value = agent.conversation_config?.agent?.first_message || '';
    editLanguageSelect.value = agent.conversation_config?.agent?.language || 'en';
    
    // Set voice
    const voiceId = agent.conversation_config?.tts?.voice_id;
    if (voiceId) {
      editVoiceSelect.value = voiceId;
    }
    
    saveAgentBtn.disabled = false;
    saveAgentBtn.innerHTML = 'Save Changes';
  } catch (error) {
    console.error("Error loading agent:", error);
    alert("Failed to load agent details");
    editModal.classList.add("hidden");
  }
};

// Close edit modal
window.closeEditModal = function() {
  editModal.classList.add("hidden");
};

// Save agent changes
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const agentId = editAgentId.value;
  if (!agentId) return;
  
  saveAgentBtn.disabled = true;
  saveAgentBtn.innerHTML = '<span class="loading"></span>Saving...';
  
  try {
    const response = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editAgentName.value.trim() || undefined,
        prompt: editAgentPrompt.value.trim() || undefined,
        firstMessage: editFirstMessage.value.trim(),
        voiceId: editVoiceSelect.value || undefined,
        language: editLanguageSelect.value || undefined,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details?.detail?.message || error.error || "Failed to update agent");
    }
    
    log(`Updated agent: ${agentId}`);
    window.closeEditModal();
    loadAgents();
    
  } catch (error) {
    console.error("Error updating agent:", error);
    alert(`Failed to update agent: ${error.message}`);
  } finally {
    saveAgentBtn.disabled = false;
    saveAgentBtn.innerHTML = 'Save Changes';
  }
});

// Delete agent
deleteAgentBtn.addEventListener("click", async () => {
  const agentId = editAgentId.value;
  if (!agentId) return;
  
  const confirmed = confirm("Are you sure you want to delete this agent? This action cannot be undone.");
  if (!confirmed) return;
  
  deleteAgentBtn.disabled = true;
  deleteAgentBtn.innerHTML = '<span class="loading"></span>Deleting...';
  
  try {
    const response = await fetch(`/api/agents/${agentId}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete agent");
    }
    
    log(`Deleted agent: ${agentId}`);
    
    // If the deleted agent was selected, clear the selection
    if (currentAgentId === agentId) {
      currentAgentId = null;
      activeAgentEl.textContent = "None selected";
      conversationSection.classList.add("hidden");
      startBtn.disabled = true;
    }
    
    window.closeEditModal();
    loadAgents();
    
  } catch (error) {
    console.error("Error deleting agent:", error);
    alert(`Failed to delete agent: ${error.message}`);
  } finally {
    deleteAgentBtn.disabled = false;
    deleteAgentBtn.innerHTML = 'Delete Agent';
  }
});

// Close modal on backdrop click
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) {
    window.closeEditModal();
  }
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !editModal.classList.contains("hidden")) {
    window.closeEditModal();
  }
});

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
