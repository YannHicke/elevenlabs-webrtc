# ElevenLabs WebRTC Demo

Low-latency browser demo that talks to an ElevenLabs agent over WebRTC using the turnkey LiveKit stack described in the ElevenLabs documentation (see `openapi.json:1` → `/v1/convai/conversation/token`). The backend simply proxies the WebRTC token endpoint so your API key never leaves the server, and the frontend uses the official LiveKit JavaScript SDK to capture the microphone, join the LiveKit room, and stream audio both ways.

## Prerequisites

- Node.js 18+ (Node 20/22/24 work out of the box).
- An ElevenLabs API key with ConvAI access and the ID of the agent you want to talk to.
- The LiveKit URL associated with your ConvAI workspace (the docs list the `wss://…` URL you should use; add it to your `.env` alongside the key and agent id).

## Getting started

1. Copy `.env.example` to `.env` and fill in the values you received from ElevenLabs:

   ```bash
   cp .env.example .env
   # edit the file to set ELEVEN_API_KEY=..., ELEVEN_AGENT_ID=..., LIVEKIT_URL=wss://...
   ```

2. Install dependencies once:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000), type an optional display name, and click **Start conversation**. The page will:

   - Fetch `/api/config` to learn the LiveKit host the server exposes.
   - POST to `/api/webrtc-token`, which hits `GET https://api.elevenlabs.io/v1/convai/conversation/token` with your agent id and returns the JWT token documented in `openapi.json:1`.
   - Create a LiveKit room, publish your microphone, and subscribe to the agent’s remote audio stream.

The log panel shows room events so you can debug connection issues quickly.

## Project structure

| Path | Purpose |
| --- | --- |
| `server.js` | Minimal Express server that serves the static files, exposes `/api/config`, and securely exchanges WebRTC tokens with ElevenLabs. |
| `public/index.html`, `public/styles.css` | Simple UI to start/stop a session and show event logs. |
| `public/app.js` | Client logic that calls the backend, connects to LiveKit via `livekit-client@2.x`, and manages audio tracks. |
| `.env.example` | Documents the environment variables you must provide. |
| `openapi.json` | Offline copy of the ElevenLabs API schema used for reference. |

## Notes

- The token endpoint is rate-limited; don’t call it more often than necessary. Cache tokens client-side if you plan to reconnect quickly.
- All sensitive values stay on the server—only the short-lived LiveKit JWT is sent to the browser.
- You can extend the UI to show transcripts by subscribing to LiveKit data channels or ElevenLabs webhooks if needed.
