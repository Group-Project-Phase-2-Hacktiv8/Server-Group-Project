# 🎮 Multiplayer Typing Race - Complete API Documentation

## 📑 Table of Contents

1. [Backend API (Socket.io)](#backend-api-socketio)
2. [Backend REST API](#backend-rest-api)
3. [Frontend API (React Context)](#frontend-api-react-context)
4. [Data Structures](#data-structures)
5. [Error Handling](#error-handling)
6. [AI Service API](#ai-service-api)

---

# 🔧 Backend API (Socket.io)

Base URL: `http://localhost:5000`

## Socket Connection

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});
```

---

## 📤 Client → Server Events

### 1. `create_room`

Create a new game room.

**Payload:**

```typescript
{
  username: string; // Player's username (max 20 characters)
  roomCode: string; // 6-character uppercase room code (e.g., "ABC123")
}
```

**Example:**

```javascript
socket.emit("create_room", {
  username: "Player1",
  roomCode: "ABC123",
});
```

**Response Events:**

- `room_created` - Room successfully created
- `error` - Room already exists or validation error

---

### 2. `join_room`

Join an existing game room.

**Payload:**

```typescript
{
  username: string; // Player's username (max 20 characters)
  roomCode: string; // 6-character room code
}
```

**Example:**

```javascript
socket.emit("join_room", {
  username: "Player2",
  roomCode: "ABC123",
});
```

**Response Events:**

- `room_joined` - Successfully joined
- `player_joined` - Broadcast to all players in room
- `error` - Room not found, full, or already started

**Possible Errors:**

- Room not found
- Room is full (max 3 players)
- Game already started

---

### 3. `change_language`

Change the game language (Room Master only).

**Payload:**

```typescript
{
  roomCode: string; // Room code
  language: "Indonesia" | "Inggris"; // Selected language
}
```

**Example:**

```javascript
socket.emit("change_language", {
  roomCode: "ABC123",
  language: "Indonesia",
});
```

**Response Events:**

- `language_changed` - Broadcast to all players

**Authorization:**

- Only room master can change language
- Returns `error` if unauthorized

---

### 4. `start_game`

Start the game (Room Master only).

**Payload:**

```typescript
{
  roomCode: string; // Room code
}
```

**Example:**

```javascript
socket.emit("start_game", {
  roomCode: "ABC123",
});
```

**Response Events:**

- `game_started` - Broadcast to all players with game text
- `error` - Not authorized or not enough players

**Requirements:**

- Minimum 2 players in room
- Only room master can start
- Generates text via AI API

---

### 5. `update_progress`

Update player's typing progress.

**Payload:**

```typescript
{
  roomCode: string; // Room code
  progress: number; // Progress percentage (0-100)
}
```

**Example:**

```javascript
socket.emit("update_progress", {
  roomCode: "ABC123",
  progress: 45.5,
});
```

**Response Events:**

- `progress_updated` - Broadcast to all players

**Frequency:**

- Emit after each correctly typed word
- Real-time synchronization

---

### 6. `player_finished`

Notify that player has finished typing.

**Payload:**

```typescript
{
  roomCode: string; // Room code
}
```

**Example:**

```javascript
socket.emit("player_finished", {
  roomCode: "ABC123",
});
```

**Response Events:**

- `player_finished` - Broadcast with leaderboard

**Note:**

- Only first finish triggers winner announcement
- Updates leaderboard for all players

---

## 📥 Server → Client Events

### 1. `room_created`

Room successfully created.

**Payload:**

```typescript
{
  roomCode: string;           // Created room code
  isRoomMaster: boolean;      // Always true for creator
  players: Player[];          // Array of players (creator only)
}
```

**Example:**

```javascript
socket.on("room_created", (data) => {
  console.log("Room created:", data.roomCode);
  console.log("Players:", data.players);
});
```

---

### 2. `room_joined`

Player successfully joined room.

**Payload:**

```typescript
{
  roomCode: string;           // Room code
  isRoomMaster: boolean;      // false for joiners
  players: Player[];          // Current players in room
  language: 'Indonesia' | 'Inggris';  // Current language setting
}
```

**Example:**

```javascript
socket.on("room_joined", (data) => {
  console.log("Joined room:", data.roomCode);
  console.log("Room master:", data.isRoomMaster);
  console.log("Language:", data.language);
});
```

---

### 3. `player_joined`

Broadcast when new player joins (to existing players).

**Payload:**

```typescript
{
  players: Player[];          // Updated player list
  newPlayer: string;          // Name of player who joined
}
```

**Example:**

```javascript
socket.on("player_joined", (data) => {
  console.log(`${data.newPlayer} joined the room`);
  updatePlayerList(data.players);
});
```

---

### 4. `player_left`

Broadcast when player disconnects.

**Payload:**

```typescript
{
  playerName: string;         // Name of player who left
  players: Player[];          // Updated player list
}
```

**Example:**

```javascript
socket.on("player_left", (data) => {
  console.log(`${data.playerName} left the room`);
  updatePlayerList(data.players);
});
```

**Note:**

- If room master leaves, new master is assigned (first in list)
- Room deleted if all players leave

---

### 5. `language_changed`

Language setting changed by room master.

**Payload:**

```typescript
{
  language: "Indonesia" | "Inggris"; // New language
}
```

**Example:**

```javascript
socket.on("language_changed", (data) => {
  console.log("Language changed to:", data.language);
  setLanguage(data.language);
});
```

---

### 6. `game_started`

Game has started with generated text.

**Payload:**

```typescript
{
  gameText: string; // Text to type (30-40 words)
}
```

**Example:**

```javascript
socket.on("game_started", (data) => {
  console.log("Game started!");
  console.log("Text:", data.gameText);
  startRace(data.gameText);
});
```

**Text Format:**

- 30-40 words in selected language
- Plain text, no special formatting
- Generated by AI or fallback text

---

### 7. `progress_updated`

Player progress update (broadcast to all).

**Payload:**

```typescript
{
  playerId: string; // Socket ID of player
  playerName: string; // Player's username
  progress: number; // Progress percentage (0-100)
}
```

**Example:**

```javascript
socket.on("progress_updated", (data) => {
  console.log(`${data.playerName}: ${data.progress}%`);
  updateRaceTrack(data.playerName, data.progress);
});
```

**Frequency:**

- Real-time updates after each word
- Used for race track visualization

---

### 8. `player_finished`

Player has finished typing (first player wins).

**Payload:**

```typescript
{
  playerName: string;         // Winner's name
  leaderboard: LeaderboardEntry[];  // Final standings
}
```

**LeaderboardEntry:**

```typescript
{
  name: string; // Player name
  progress: number; // Final progress (0-100)
}
```

**Example:**

```javascript
socket.on("player_finished", (data) => {
  console.log("Winner:", data.playerName);
  showLeaderboard(data.leaderboard);
});
```

---

### 9. `error`

Error occurred during operation.

**Payload:**

```typescript
{
  message: string; // Error description
}
```

**Example:**

```javascript
socket.on("error", (data) => {
  console.error("Error:", data.message);
  alert(data.message);
});
```

**Common Error Messages:**

- "Room not found"
- "Room is full"
- "Game already started"
- "Not authorized"
- "Need at least 2 players"

---

### 10. Built-in Events

#### `connect`

Socket connected to server.

```javascript
socket.on("connect", () => {
  console.log("Connected to server");
  console.log("Socket ID:", socket.id);
});
```

#### `disconnect`

Socket disconnected from server.

```javascript
socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
  if (reason === "io server disconnect") {
    // Server disconnected, manual reconnection needed
    socket.connect();
  }
});
```

#### `connect_error`

Connection error occurred.

```javascript
socket.on("connect_error", (error) => {
  console.error("Connection error:", error.message);
});
```

---

# 🌐 Backend REST API

## Health Check

### GET `/health`

Check if server is running.

**Request:**

```bash
GET http://localhost:5000/health
```

**Response:**

```json
{
  "status": "OK",
  "message": "Server is running"
}
```

**Status Codes:**

- `200` - Server is healthy

---

# ⚛️ Frontend API (React Context)

## GameContext

### Provider Setup

```javascript
import { GameProvider, useGame } from "./context/GameContext";

function App() {
  return (
    <GameProvider>
      <YourComponents />
    </GameProvider>
  );
}
```

---

## State Variables

### Game State

```typescript
gameState: "login" | "lobby" | "waiting" | "racing" | "finished";
```

Current game screen/phase.

**Example:**

```javascript
const { gameState, setGameState } = useGame();

// Navigate to lobby
setGameState("lobby");
```

---

### User Data

```typescript
username: string                  // Current user's name
setUsername: (name: string) => void
```

**Example:**

```javascript
const { username, setUsername } = useGame();

setUsername("Player1");
console.log(username); // "Player1"
```

---

### Room Data

```typescript
roomCode: string                  // Current room code
setRoomCode: (code: string) => void

players: Player[]                 // List of players in room
setPlayers: (players: Player[]) => void

isRoomMaster: boolean             // Is current user room master?
setIsRoomMaster: (isMaster: boolean) => void
```

**Example:**

```javascript
const { roomCode, players, isRoomMaster } = useGame();

console.log("Room:", roomCode);
console.log("Players:", players.length);
console.log("I am master:", isRoomMaster);
```

---

### Game Settings

```typescript
language: 'Indonesia' | 'Inggris'
setLanguage: (lang: string) => void
```

**Example:**

```javascript
const { language, setLanguage } = useGame();

setLanguage("Indonesia");
```

---

### Game Data

```typescript
gameText: string                  // Text to type
setGameText: (text: string) => void

currentWordIndex: number          // Current word being typed
setCurrentWordIndex: (index: number) => void

typedText: string                 // Current input text
setTypedText: (text: string) => void
```

**Example:**

```javascript
const { gameText, currentWordIndex, typedText } = useGame();

const words = gameText.split(" ");
const currentWord = words[currentWordIndex];
```

---

### Progress Tracking

```typescript
progress: { [playerName: string]: number }  // Player progress map
setProgress: (progress: object) => void

winner: string | null             // Winner's name
setWinner: (name: string | null) => void
```

**Example:**

```javascript
const { progress, winner } = useGame();

console.log("My progress:", progress[username]);
console.log("Winner:", winner);
```

---

## Action Methods

### `createRoom(roomCode: string)`

Create a new room.

**Example:**

```javascript
const { createRoom, username } = useGame();

const code = "ABC123";
createRoom(code);
// Emits socket event: create_room
```

---

### `joinRoom(roomCode: string)`

Join an existing room.

**Example:**

```javascript
const { joinRoom } = useGame();

joinRoom("ABC123");
// Emits socket event: join_room
```

---

### `changeLanguage(language: string)`

Change game language (Room Master only).

**Example:**

```javascript
const { changeLanguage, isRoomMaster } = useGame();

if (isRoomMaster) {
  changeLanguage("Indonesia");
  // Emits socket event: change_language
}
```

---

### `startGame()`

Start the game (Room Master only).

**Example:**

```javascript
const { startGame, isRoomMaster, players } = useGame();

if (isRoomMaster && players.length >= 2) {
  startGame();
  // Emits socket event: start_game
}
```

---

### `updateProgress(progress: number)`

Update player's typing progress.

**Example:**

```javascript
const { updateProgress } = useGame();

// After typing a word correctly
updateProgress(45.5);
// Emits socket event: update_progress
```

---

### `finishGame()`

Notify that player has finished.

**Example:**

```javascript
const { finishGame } = useGame();

// When progress reaches 100%
finishGame();
// Emits socket event: player_finished
```

---

## Custom Hooks

### `useSocket()`

Get socket instance.

**Location:** `src/hooks/useSocket.js`

**Usage:**

```javascript
import { useSocket } from "../hooks/useSocket";

function MyComponent() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("custom_event", (data) => {
      console.log(data);
    });

    return () => {
      socket.off("custom_event");
    };
  }, [socket]);
}
```

**Returns:**

- Socket.io client instance
- `null` until connection established

---

### `useGame()`

Access game context.

**Usage:**

```javascript
import { useGame } from "../context/GameContext";

function MyComponent() {
  const { gameState, username, players, createRoom, joinRoom, startGame } =
    useGame();

  // Use context values and methods
}
```

**Throws:**

- Error if used outside `GameProvider`

---

# 📊 Data Structures

## Player

```typescript
interface Player {
  id?: string; // Socket ID (backend only)
  name: string; // Player username
  progress: number; // Typing progress (0-100)
  finished: boolean; // Has player finished?
}
```

**Example:**

```json
{
  "id": "socket_abc123",
  "name": "Player1",
  "progress": 75.5,
  "finished": false
}
```

---

## Room

```typescript
interface Room {
  players: Player[]; // List of players
  language: "Indonesia" | "Inggris"; // Game language
  gameText: string; // Generated text
  started: boolean; // Has game started?
  masterId: string; // Socket ID of room master
}
```

**Example:**

```json
{
  "players": [
    { "name": "Player1", "progress": 0, "finished": false },
    { "name": "Player2", "progress": 0, "finished": false }
  ],
  "language": "Indonesia",
  "gameText": "",
  "started": false,
  "masterId": "socket_abc123"
}
```

---

## LeaderboardEntry

```typescript
interface LeaderboardEntry {
  name: string; // Player name
  progress: number; // Final progress percentage
}
```

**Example:**

```json
{
  "name": "Player1",
  "progress": 100
}
```

---

# ⚠️ Error Handling

## Backend Errors

### Socket Event Errors

All errors emitted via `error` event:

```javascript
socket.on("error", (data) => {
  console.error(data.message);
  // Handle error (show alert, redirect, etc.)
});
```

**Error Types:**

1. **Room Not Found**

   ```json
   { "message": "Room not found" }
   ```

2. **Room Full**

   ```json
   { "message": "Room is full" }
   ```

3. **Game Already Started**

   ```json
   { "message": "Game already started" }
   ```

4. **Not Authorized**

   ```json
   { "message": "Not authorized" }
   ```

5. **Not Enough Players**
   ```json
   { "message": "Need at least 2 players" }
   ```

---

## AI Service Errors

### API Call Failures

If AI API fails, server uses fallback text:

**Fallback Texts:**

```javascript
const fallbackTexts = {
  Indonesia: "Teknologi berkembang pesat di era digital ini...",
  Inggris: "Technology advances rapidly in our modern world...",
};
```

**Error Handling:**

```javascript
try {
  const text = await generateGameText(language);
  return text;
} catch (error) {
  console.error("AI API Error:", error);
  return fallbackTexts[language];
}
```

---

## Frontend Error Handling

### Context Hook Error

```javascript
try {
  const game = useGame();
} catch (error) {
  console.error("useGame must be used within GameProvider");
}
```

### Socket Connection Error

```javascript
socket.on("connect_error", (error) => {
  console.error("Failed to connect:", error.message);
  // Show connection error UI
  setConnectionStatus("error");
});
```

### Validation Errors

```javascript
// Username validation
if (!username.trim()) {
  alert("Username cannot be empty");
  return;
}

if (username.length > 20) {
  alert("Username too long (max 20 characters)");
  return;
}

// Room code validation
if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
  alert("Invalid room code format");
  return;
}
```

---

# 🤖 AI Service API

## Gemini API

### Generate Text

**Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`

**Headers:**

```
Content-Type: application/json
```

**Request:**

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Generate a random, interesting fact or short story paragraph in English with approximately 30-40 words for a typing test. Plain text only."
        }
      ]
    }
  ]
}
```

**Response:**

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "The quick brown fox jumps over the lazy dog..."
          }
        ]
      }
    }
  ]
}
```

**Usage:**

```javascript
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

const response = await axios.post(url, {
  contents: [
    {
      parts: [{ text: prompt }],
    },
  ],
});

const text = response.data.candidates[0].content.parts[0].text;
```

---

## OpenAI API

### Generate Text

**Endpoint:** `POST https://api.openai.com/v1/chat/completions`

**Headers:**

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request:**

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant that generates short text for typing tests."
    },
    {
      "role": "user",
      "content": "Generate a random paragraph in English with 30-40 words."
    }
  ],
  "max_tokens": 100,
  "temperature": 0.7
}
```

**Response:**

```json
{
  "choices": [
    {
      "message": {
        "content": "Technology advances rapidly in our modern world..."
      }
    }
  ]
}
```

**Usage:**

```javascript
const response = await axios.post(
  "https://api.openai.com/v1/chat/completions",
  {
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "Generate typing test text" },
      { role: "user", content: prompt },
    ],
    max_tokens: 100,
  },
  {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  }
);

const text = response.data.choices[0].message.content;
```

---

# 📝 Usage Examples

## Complete Game Flow

### 1. Player 1 Creates Room

```javascript
// Login
setUsername("Player1");
setGameState("lobby");

// Create room
const roomCode = "ABC123";
socket.emit("create_room", { username: "Player1", roomCode });

// Wait for response
socket.on("room_created", (data) => {
  setRoomCode(data.roomCode);
  setIsRoomMaster(true);
  setPlayers(data.players);
  setGameState("waiting");
});
```

---

### 2. Player 2 Joins Room

```javascript
// Login
setUsername("Player2");
setGameState("lobby");

// Join room
socket.emit("join_room", { username: "Player2", roomCode: "ABC123" });

// Wait for response
socket.on("room_joined", (data) => {
  setRoomCode(data.roomCode);
  setPlayers(data.players);
  setGameState("waiting");
});
```

---

### 3. Room Master Starts Game

```javascript
// Change language (optional)
socket.emit("change_language", { roomCode, language: "Indonesia" });

// Start game
socket.emit("start_game", { roomCode });

// Wait for game to start
socket.on("game_started", (data) => {
  setGameText(data.gameText);
  setGameState("racing");
});
```

---

### 4. Players Type

```javascript
const handleTyping = (input) => {
  // Validate input
  const isCorrect = currentWord.startsWith(input);

  if (input.endsWith(" ") && input.trim() === currentWord) {
    // Word completed
    const newIndex = currentWordIndex + 1;
    const newProgress = (newIndex / totalWords) * 100;

    // Update local state
    setCurrentWordIndex(newIndex);
    setTypedText("");

    // Broadcast progress
    socket.emit("update_progress", { roomCode, progress: newProgress });

    // Check if finished
    if (newProgress >= 100) {
      socket.emit("player_finished", { roomCode });
    }
  }
};
```

---

### 5. Game Finishes

```javascript
socket.on("player_finished", (data) => {
  setWinner(data.playerName);
  setGameState("finished");
  showLeaderboard(data.leaderboard);
});
```

---

# 🔒 Security Considerations

## Input Validation

- Username: Max 20 characters, no special characters
- Room code: Exactly 6 alphanumeric characters
- Progress: Number between 0-100
- Language: Only 'Indonesia' or 'Inggris'

## Rate Limiting

- Implement rate limiting for socket events
- Prevent spam/abuse of game actions
- Limit AI API calls per room

## Authentication

- Basic username-based authentication
- Socket ID validation for room actions
- Room master verification for privileged actions

---

# 📚 Additional Resources

## Socket.io Documentation

https://socket.io/docs/v4/

## React Context API

https://react.dev/reference/react/useContext

## Gemini API

https://ai.google.dev/docs

## OpenAI API

https://platform.openai.com/docs/api-reference

---

**Last Updated:** December 2024  
**Version:** 1.0.0  
**Maintained by:** Typing Race Development Team
