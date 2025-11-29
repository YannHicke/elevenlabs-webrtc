const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ELEVEN_AGENT_ID = process.env.ELEVEN_AGENT_ID; // Default agent (optional)

if (!ELEVEN_API_KEY) {
  console.warn(
    "Missing ELEVEN_API_KEY. Check your .env file before starting the server.",
  );
}

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  res.json({
    agentId: ELEVEN_AGENT_ID || null,
    hasApiKey: !!ELEVEN_API_KEY,
  });
});

// List available voices
app.get("/api/voices", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(500).json({ error: "Server missing ElevenLabs API key" });
    }

    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "Failed to fetch voices",
        details: safeJsonParse(errorBody),
      });
    }

    const data = await response.json();
    // Return simplified voice list
    const voices = data.voices.map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels,
    }));
    res.json({ voices });
  } catch (error) {
    console.error("Error fetching voices", error);
    res.status(500).json({ error: "Unexpected error fetching voices" });
  }
});

// Create a new agent
app.post("/api/agents", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(500).json({ error: "Server missing ElevenLabs API key" });
    }

    const { name, prompt, firstMessage, voiceId, language } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const agentConfig = {
      name: name || "Custom Agent",
      conversation_config: {
        agent: {
          prompt: {
            prompt: prompt,
            llm: "gemini-2.0-flash-001",
            temperature: 0.7,
          },
          first_message: firstMessage || "",
          language: language || "en",
        },
        tts: {
          voice_id: voiceId || "cjVigY5qzO86Huf0OWal", // Default voice
          model_id: "eleven_turbo_v2",
        },
      },
    };

    const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(agentConfig),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "Failed to create agent",
        details: safeJsonParse(errorBody),
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error creating agent", error);
    res.status(500).json({ error: "Unexpected error creating agent" });
  }
});

// List user's agents
app.get("/api/agents", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(500).json({ error: "Server missing ElevenLabs API key" });
    }

    const response = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
      method: "GET",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "Failed to fetch agents",
        details: safeJsonParse(errorBody),
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error fetching agents", error);
    res.status(500).json({ error: "Unexpected error fetching agents" });
  }
});

// Get a single agent's details
app.get("/api/agents/:agentId", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(500).json({ error: "Server missing ElevenLabs API key" });
    }

    const { agentId } = req.params;

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "GET",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "Failed to fetch agent",
        details: safeJsonParse(errorBody),
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error fetching agent", error);
    res.status(500).json({ error: "Unexpected error fetching agent" });
  }
});

// Update an existing agent
app.patch("/api/agents/:agentId", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(500).json({ error: "Server missing ElevenLabs API key" });
    }

    const { agentId } = req.params;
    const { name, prompt, firstMessage, voiceId, language } = req.body;

    const updateData = {};
    
    if (name !== undefined) {
      updateData.name = name;
    }

    // Build conversation_config if any relevant fields are provided
    const hasConversationUpdates = prompt !== undefined || firstMessage !== undefined || 
                                    voiceId !== undefined || language !== undefined;
    
    if (hasConversationUpdates) {
      updateData.conversation_config = {};
      
      if (prompt !== undefined || firstMessage !== undefined || language !== undefined) {
        updateData.conversation_config.agent = {};
        
        if (prompt !== undefined) {
          updateData.conversation_config.agent.prompt = {
            prompt: prompt,
          };
        }
        
        if (firstMessage !== undefined) {
          updateData.conversation_config.agent.first_message = firstMessage;
        }
        
        if (language !== undefined) {
          updateData.conversation_config.agent.language = language;
        }
      }
      
      if (voiceId !== undefined) {
        updateData.conversation_config.tts = {
          voice_id: voiceId,
        };
      }
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "Failed to update agent",
        details: safeJsonParse(errorBody),
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error updating agent", error);
    res.status(500).json({ error: "Unexpected error updating agent" });
  }
});

// Delete an agent
app.delete("/api/agents/:agentId", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(500).json({ error: "Server missing ElevenLabs API key" });
    }

    const { agentId } = req.params;

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "DELETE",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "Failed to delete agent",
        details: safeJsonParse(errorBody),
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent", error);
    res.status(500).json({ error: "Unexpected error deleting agent" });
  }
});

// Get a WebRTC conversation token
app.post("/api/webrtc-token", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(500).json({ error: "Server missing ElevenLabs API key" });
    }

    const agentId = req.body?.agentId || ELEVEN_AGENT_ID;
    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
    url.searchParams.set("agent_id", agentId);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "Failed to fetch WebRTC token",
        details: safeJsonParse(errorBody),
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error fetching WebRTC token", error);
    res.status(500).json({ error: "Unexpected error requesting WebRTC token" });
  }
});

// Get a signed URL for WebSocket-based conversation (fallback)
app.post("/api/signed-url", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY || !ELEVEN_AGENT_ID) {
      return res.status(500).json({ error: "Server missing ElevenLabs configuration" });
    }

    const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
    url.searchParams.set("agent_id", ELEVEN_AGENT_ID);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "Failed to fetch signed URL",
        details: safeJsonParse(errorBody),
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error fetching signed URL", error);
    res.status(500).json({ error: "Unexpected error requesting signed URL" });
  }
});

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
