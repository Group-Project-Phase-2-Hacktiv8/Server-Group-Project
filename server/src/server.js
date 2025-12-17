import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import {
  setupSocketHandlers,
  getActiveRooms,
} from "./socket/socketHandlers.js";

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.io setup
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
});

// Setup socket handlers
setupSocketHandlers(io);

// REST API Routes
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Debug endpoint untuk lihat active rooms
app.get("/api/rooms", (req, res) => {
  const rooms = getActiveRooms();
  res.json({
    count: rooms.length,
    rooms,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// Start server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   🎮 Typing Race Server Running 🎮    ║");
  console.log("╠════════════════════════════════════════╣");
  console.log(`║   Port: http://localhost:${PORT}                           ║`);
  console.log(
    `║   Environment: ${process.env.NODE_ENV || "development"}         ║`
  );
  console.log(
    `║   Client URL: ${process.env.CLIENT_URL || "http://localhost:5173"} ║`
  );
  console.log("╚════════════════════════════════════════╝");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT received, shutting down gracefully...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
