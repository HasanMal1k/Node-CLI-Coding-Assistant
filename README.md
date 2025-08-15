<img width="1895" height="706" alt="image" src="https://github.com/user-attachments/assets/d5717ff8-1e2d-4e4d-a344-527d1b92456b" />

## VITA: You're AI coding assistant.

Built this project as an experiment to explore how Claude Code works and to create something similar.

It uses Vita to process codebases, which turned out to be very effective. This was my first large backend project, complete with a CLI interface, WebSocket-based streaming chat, and server-side integration with Ollama for LLM processing.

The architecture includes:

Client: Runs Vita, packages codebase context, compresses it with Brotli, and sends it to the server.

Server (Dockerized): Receives, decompresses, and feeds the codebase into Ollama, enabling contextual chat.

Real-time interaction: Communication happens via WebSockets for continuous, low-latency streaming.
