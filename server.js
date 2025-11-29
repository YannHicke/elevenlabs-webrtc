const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ELEVEN_AGENT_ID = process.env.ELEVEN_AGENT_ID;

if (!ELEVEN_API_KEY || !ELEVEN_AGENT_ID) {
  console.warn(
    "Missing ELEVEN_API_KEY or ELEVEN_AGENT_ID. Check your .env file before starting the server.",
  );
}

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  if (!ELEVEN_AGENT_ID) {
    return res.status(500).json({ error: "Server missing agent configuration" });
  }
  res.json({
    agentId: ELEVEN_AGENT_ID,
  });
});

// Get a WebRTC conversation token
app.post("/api/webrtc-token", async (req, res) => {
  try {
    if (!ELEVEN_API_KEY || !ELEVEN_AGENT_ID) {
      return res.status(500).json({ error: "Server missing ElevenLabs configuration" });
    }

    const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
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
