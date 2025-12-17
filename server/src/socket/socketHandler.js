import { generateGameText } from '../services/aiService.js';

// Bot AI simulation function
function startBotAI(io, roomCode, room, gameText) {
    const words = gameText.split(' ');
    const totalWords = words.length;

    room.bots.forEach(bot => {
        // Speed configuration (words per second)
        const speedConfig = {
            easy: 1.0,    // ~30 WPM
            medium: 2.0,  // ~50 WPM
            hard: 3.0     // ~80 WPM
        };

        const wordsPerSecond = speedConfig[bot.difficulty] || speedConfig.medium;
        const intervalMs = (1000 / wordsPerSecond);
        let wordsTyped = 0;

        const botInterval = setInterval(() => {
            if (!room || room.players.findIndex(p => p.id === bot.id) === -1) {
                clearInterval(botInterval);
                return;
            }

            wordsTyped++;
            const progress = (wordsTyped / totalWords) * 100;
            bot.progress = Math.min(progress, 100);

            // Broadcast bot progress
            io.to(roomCode).emit('progress_updated', {
                playerId: bot.id,
                playerName: bot.name,
                progress: bot.progress
            });

            // Bot finished
            if (wordsTyped >= totalWords) {
                clearInterval(botInterval);
                bot.finished = true;

                io.to(roomCode).emit('player_finished', {
                    playerName: bot.name,
                    leaderboard: room.players
                        .sort((a, b) => b.progress - a.progress)
                        .map(p => ({ name: p.name, progress: p.progress }))
                });

                console.log(`🤖 Bot ${bot.name} finished in room ${roomCode}`);
            }
        }, intervalMs);
    });
}

export function setupSocketHandlers(io, rooms) {
    // Store pending disconnects for grace period
    const pendingDisconnects = new Map();
    const DISCONNECT_GRACE_PERIOD = 5000; // 5 seconds to reconnect

    io.on('connection', (socket) => {
        console.log(`✅ User connected: ${socket.id}`);

        // CREATE ROOM
        socket.on('create_room', ({ username, roomCode }) => {
            if (!rooms.has(roomCode)) {
                rooms.set(roomCode, {
                    players: [{ id: socket.id, name: username, progress: 0, finished: false }],
                    language: 'Indonesia',
                    gameText: '',
                    started: false,
                    masterId: socket.id,
                    maxPlayers: 3,
                    bots: []
                });

                socket.join(roomCode);
                socket.emit('room_created', {
                    roomCode,
                    isRoomMaster: true,
                    players: rooms.get(roomCode).players,
                    maxPlayers: rooms.get(roomCode).maxPlayers
                });

                console.log(`🏠 Room created: ${roomCode} by ${username}`);
            }
        });

        // JOIN ROOM
        socket.on('join_room', ({ username, roomCode }) => {
            const room = rooms.get(roomCode);

            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            if (room.players.length >= room.maxPlayers) {
                socket.emit('error', { message: 'Room is full' });
                return;
            }

            if (room.started) {
                socket.emit('error', { message: 'Game already started' });
                return;
            }

            const newPlayer = {
                id: socket.id,
                name: username,
                progress: 0,
                finished: false
            };

            room.players.push(newPlayer);
            socket.join(roomCode);

            // Notify all players in room
            io.to(roomCode).emit('player_joined', {
                players: room.players,
                newPlayer: username
            });

            // Send room info to the new player
            socket.emit('room_joined', {
                roomCode,
                isRoomMaster: false,
                players: room.players,
                language: room.language,
                maxPlayers: room.maxPlayers
            });

            console.log(`👤 ${username} joined room ${roomCode}`);
        });

        // REJOIN ROOM (for refresh/reconnect)
        socket.on('rejoin_room', ({ username, roomCode }) => {
            console.log(`🔄 Rejoin request from ${username} for room ${roomCode}`);
            const room = rooms.get(roomCode);

            if (!room) {
                console.log(`❌ Room ${roomCode} not found`);
                socket.emit('rejoin_failed', {
                    message: 'Room no longer exists. Please create or join a new room.'
                });
                return;
            }

            console.log(`📋 Room ${roomCode} has ${room.players.length} players:`, room.players.map(p => p.name));

            // Cancel pending disconnect if exists
            const pendingKey = `${roomCode}:${username}`;
            if (pendingDisconnects.has(pendingKey)) {
                clearTimeout(pendingDisconnects.get(pendingKey));
                pendingDisconnects.delete(pendingKey);
                console.log(`⏳ Cancelled pending disconnect for ${username}`);
            }

            // Check if player already exists in room (by username)
            const existingPlayer = room.players.find(p => p.name === username && !p.isBot);

            if (existingPlayer) {
                // Update the socket ID for the existing player
                const oldSocketId = existingPlayer.id;
                existingPlayer.id = socket.id;

                // Update masterId if this player was the master
                if (room.masterId === oldSocketId) {
                    room.masterId = socket.id;
                }

                socket.join(roomCode);

                const payload = {
                    roomCode,
                    isRoomMaster: room.masterId === socket.id,
                    players: room.players,
                    language: room.language,
                    maxPlayers: room.maxPlayers
                };

                console.log(`📤 Sending room_joined to ${username}:`, payload);

                // Send room info back to the rejoining player
                socket.emit('room_joined', payload);

                console.log(`🔄 ${username} rejoined room ${roomCode} (isRoomMaster: ${room.masterId === socket.id})`);
            } else {
                // Player doesn't exist, treat as new join if room has space
                if (room.players.length >= room.maxPlayers) {
                    socket.emit('rejoin_failed', { message: 'Room is full' });
                    return;
                }

                if (room.started) {
                    socket.emit('rejoin_failed', { message: 'Game already started' });
                    return;
                }

                const newPlayer = {
                    id: socket.id,
                    name: username,
                    progress: 0,
                    finished: false
                };

                room.players.push(newPlayer);
                socket.join(roomCode);

                // Notify all players
                io.to(roomCode).emit('player_joined', {
                    players: room.players,
                    newPlayer: username
                });

                // Send room info
                socket.emit('room_joined', {
                    roomCode,
                    isRoomMaster: false,
                    players: room.players,
                    language: room.language,
                    maxPlayers: room.maxPlayers
                });

                console.log(`👤 ${username} joined room ${roomCode} (via rejoin)`);
            }
        });

        // CHANGE LANGUAGE (only room master)
        socket.on('change_language', ({ roomCode, language }) => {
            const room = rooms.get(roomCode);

            if (room && room.masterId === socket.id) {
                room.language = language;
                io.to(roomCode).emit('language_changed', { language });
                console.log(`🌐 Language changed to ${language} in room ${roomCode}`);
            }
        });

        // CHANGE MAX PLAYERS (only room master)
        socket.on('change_max_players', ({ roomCode, maxPlayers }) => {
            const room = rooms.get(roomCode);

            if (room && room.masterId === socket.id) {
                if (maxPlayers >= 2 && maxPlayers <= 5 && maxPlayers >= room.players.length) {
                    room.maxPlayers = maxPlayers;
                    io.to(roomCode).emit('max_players_changed', { maxPlayers });
                    console.log(`👥 Max players changed to ${maxPlayers} in room ${roomCode}`);
                } else {
                    socket.emit('error', { message: 'Invalid max players value' });
                }
            }
        });

        // ADD BOT (only room master)
        socket.on('add_bot', ({ roomCode, difficulty }) => {
            const room = rooms.get(roomCode);

            if (!room || room.masterId !== socket.id) {
                socket.emit('error', { message: 'Not authorized' });
                return;
            }

            if (room.players.length >= room.maxPlayers) {
                socket.emit('error', { message: 'Room is full' });
                return;
            }

            const botId = `bot_${Date.now()}`;
            const botNames = {
                easy: ['EasyBot', 'Slowy', 'Beginner'],
                medium: ['MedBot', 'Speedy', 'Racer'],
                hard: ['HardBot', 'Lightning', 'Pro']
            };
            const botName = botNames[difficulty][Math.floor(Math.random() * 3)] + '_' + room.bots.length;

            const bot = {
                id: botId,
                name: botName,
                progress: 0,
                finished: false,
                isBot: true,
                difficulty
            };

            room.bots.push(bot);
            room.players.push(bot);

            console.log(`🤖 Bot added: ${botName}, Room players: ${room.players.length}/${room.maxPlayers}`);

            io.to(roomCode).emit('bot_added', {
                bot,
                players: room.players
            });

            console.log(`🤖 Bot ${botName} (${difficulty}) added to room ${roomCode}`);
        });

        // REMOVE BOT (only room master)
        socket.on('remove_bot', ({ roomCode, botId }) => {
            const room = rooms.get(roomCode);

            if (room && room.masterId === socket.id) {
                room.bots = room.bots.filter(b => b.id !== botId);
                room.players = room.players.filter(p => p.id !== botId);

                io.to(roomCode).emit('bot_removed', {
                    botId,
                    players: room.players
                });

                console.log(`🤖 Bot removed from room ${roomCode}`);
            }
        });

        // LEAVE ROOM
        socket.on('leave_room', ({ roomCode }) => {
            const room = rooms.get(roomCode);

            if (room) {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);

                if (playerIndex !== -1) {
                    const playerName = room.players[playerIndex].name;

                    // Clear any pending disconnect for this player
                    const pendingKey = `${roomCode}:${playerName}`;
                    if (pendingDisconnects.has(pendingKey)) {
                        clearTimeout(pendingDisconnects.get(pendingKey));
                        pendingDisconnects.delete(pendingKey);
                    }

                    room.players.splice(playerIndex, 1);
                    socket.leave(roomCode);

                    // If room is empty, delete it
                    if (room.players.length === 0) {
                        rooms.delete(roomCode);
                        console.log(`🗑️ Room ${roomCode} deleted (empty)`);
                    } else {
                        // Assign new master if needed
                        if (room.masterId === socket.id) {
                            const humanPlayer = room.players.find(p => !p.isBot);
                            if (humanPlayer) {
                                room.masterId = humanPlayer.id;
                                io.to(roomCode).emit('new_master_assigned', {
                                    newMasterId: humanPlayer.id,
                                    newMasterName: humanPlayer.name
                                });
                            }
                        }

                        io.to(roomCode).emit('player_left', {
                            playerName,
                            players: room.players
                        });
                    }

                    console.log(`👋 ${playerName} left room ${roomCode}`);
                    socket.emit('left_room_success');
                }
            }
        });

        // START GAME (only room master)
        socket.on('start_game', async ({ roomCode }) => {
            const room = rooms.get(roomCode);

            if (!room || room.masterId !== socket.id) {
                socket.emit('error', { message: 'Not authorized' });
                return;
            }

            if (room.players.length < 2) {
                socket.emit('error', { message: 'Need at least 2 players' });
                return;
            }

            room.started = true;

            try {
                // Generate text using AI
                const gameText = await generateGameText(room.language);
                room.gameText = gameText;

                console.log(`✅ AI Generated text successfully (${room.language}):`);
                console.log(`   Full text: "${gameText}"`);
                console.log(`   Length: ${gameText.length} characters`);
                console.log(`   Sending to room: ${roomCode}`);

                // Send to all players
                io.to(roomCode).emit('game_started', { gameText });
                console.log(`🎮 Game started in room ${roomCode} - event sent!`);

                // Start bot AI simulation
                if (room.bots.length > 0) {
                    startBotAI(io, roomCode, room, gameText);
                }

            } catch (error) {
                console.error('AI generation error:', error.message);
                // Fallback texts
                const fallbackTexts = {
                    'Indonesia': 'Teknologi berkembang pesat di era digital ini. Kita harus terus belajar dan beradaptasi dengan perubahan yang terjadi setiap hari.',
                    'Inggris': 'Technology advances rapidly in our modern world. We must adapt quickly to stay relevant and competitive in this digital age.'
                };

                room.gameText = fallbackTexts[room.language] || fallbackTexts['Indonesia'];
                console.log(`📝 Using fallback text (${room.language}):`);
                console.log(`   Full text: "${room.gameText}"`);
                console.log(`   Length: ${room.gameText.length} characters`);
                console.log(`   Sending to room: ${roomCode}`);

                io.to(roomCode).emit('game_started', { gameText: room.gameText });
                console.log(`✅ game_started event sent to room ${roomCode}`);

                // Start bot AI simulation even with fallback text
                if (room.bots.length > 0) {
                    console.log(`🤖 Starting ${room.bots.length} bots with fallback text`);
                    startBotAI(io, roomCode, room, room.gameText);
                }
            }
        });

        // UPDATE PROGRESS
        socket.on('update_progress', ({ roomCode, progress }) => {
            const room = rooms.get(roomCode);

            if (room) {
                const player = room.players.find(p => p.id === socket.id);
                if (player) {
                    player.progress = progress;

                    // Broadcast to all players in room
                    io.to(roomCode).emit('progress_updated', {
                        playerId: socket.id,
                        playerName: player.name,
                        progress
                    });
                }
            }
        });

        // PLAYER FINISHED
        socket.on('player_finished', ({ roomCode }) => {
            const room = rooms.get(roomCode);

            if (room) {
                const player = room.players.find(p => p.id === socket.id);
                if (player && !player.finished) {
                    player.finished = true;

                    io.to(roomCode).emit('player_finished', {
                        playerName: player.name,
                        leaderboard: room.players
                            .sort((a, b) => b.progress - a.progress)
                            .map(p => ({ name: p.name, progress: p.progress }))
                    });

                    console.log(`🏁 ${player.name} finished in room ${roomCode}`);
                }
            }
        });

        // DISCONNECT
        socket.on('disconnect', () => {
            console.log(`❌ User disconnected: ${socket.id}`);

            // Find which room this player was in
            rooms.forEach((room, roomCode) => {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);

                if (playerIndex !== -1) {
                    const player = room.players[playerIndex];
                    const playerName = player.name;
                    const isBot = player.isBot;

                    // Bots are removed immediately
                    if (isBot) {
                        room.players.splice(playerIndex, 1);
                        io.to(roomCode).emit('player_left', {
                            playerName,
                            players: room.players
                        });
                        return;
                    }

                    // For human players, use grace period for potential reconnect
                    const pendingKey = `${roomCode}:${playerName}`;
                    console.log(`⏳ Starting grace period for ${playerName} in room ${roomCode}`);

                    const timeoutId = setTimeout(() => {
                        // Re-check if player still has the old socket ID (not reconnected)
                        const currentRoom = rooms.get(roomCode);
                        if (!currentRoom) return;

                        const currentPlayerIndex = currentRoom.players.findIndex(
                            p => p.name === playerName && p.id === socket.id
                        );

                        if (currentPlayerIndex !== -1) {
                            // Player didn't reconnect, remove them
                            currentRoom.players.splice(currentPlayerIndex, 1);
                            console.log(`👋 ${playerName} removed from room ${roomCode} after grace period`);

                            // If room is empty (only bots left or no players), delete it
                            const humanPlayers = currentRoom.players.filter(p => !p.isBot);
                            if (humanPlayers.length === 0) {
                                rooms.delete(roomCode);
                                console.log(`🗑️ Room ${roomCode} deleted (no human players)`);
                            } else {
                                // Assign new master if needed
                                if (currentRoom.masterId === socket.id) {
                                    const humanPlayer = currentRoom.players.find(p => !p.isBot);
                                    if (humanPlayer) {
                                        currentRoom.masterId = humanPlayer.id;
                                        io.to(roomCode).emit('new_master_assigned', {
                                            newMasterId: humanPlayer.id,
                                            newMasterName: humanPlayer.name
                                        });
                                    }
                                }

                                io.to(roomCode).emit('player_left', {
                                    playerName,
                                    players: currentRoom.players
                                });
                            }
                        }

                        pendingDisconnects.delete(pendingKey);
                    }, DISCONNECT_GRACE_PERIOD);

                    pendingDisconnects.set(pendingKey, timeoutId);
                }
            });
        });
    });
}