import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocketHandlers } from './socket/socketHandler.js';

if (process.env.NODE_ENV !== "production") {
    dotenv.config();
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173", // Vite default port
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Game state storage
const rooms = new Map(); // roomCode -> { players: [], language: 'Indonesia', gameText: '', started: false }

// Setup socket handlers
setupSocketHandlers(io, rooms);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on :  http://localhost:${PORT}`);
});