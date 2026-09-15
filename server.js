const expressModule = require('express');
const express = expressModule.default || expressModule;
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/alpha.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'alpha.html'));
});

let units = {};
let activeAudioPeers = []; 
const VALID_KEYS = Array.from({ length: 30 }, (_, i) => `Alpha ${i + 1}`);

io.on('connection', (socket) => {
    console.log('⚡ ئامێرێکی نوێ بەستراوەتەوە:', socket.id);

    socket.on('register_alpha', (data) => {
        if (VALID_KEYS.includes(data.apiKey)) {
            socket.alphaName = data.apiKey;
            let num = parseInt(data.apiKey.replace("Alpha ", "")) || 1;
            let squadRoom = "Squad_Team_" + Math.ceil(num / 4);
            socket.join(squadRoom);

            units[socket.alphaName] = {
                id: socket.alphaName,
                lat: null,
                lon: null,
                heading: 0,
                status: 'ئامادەباش',
                lastSeen: Date.now()
            };
            socket.emit('registration_status', { success: true, alphaName: socket.alphaName });
            io.emit('updateUnitsList', units);
        } else {
            socket.emit('registration_status', { success: false, message: 'کلیلی سەربازی هەڵەیە!' });
        }
    });

    socket.on('updateLocation', (data) => {
        if (socket.alphaName && units[socket.alphaName]) {
            units[socket.alphaName].lat = data.lat;
            units[socket.alphaName].lon = data.lon;
            units[socket.alphaName].heading = data.heading || 0;
            units[socket.alphaName].status = data.status || 'ئامادەباش';
            units[socket.alphaName].lastSeen = Date.now();
            io.emit('updateUnitsList', units);
        }
    });

    socket.on('presidentBroadcast', (data) => {
        io.emit('receiveMessage', data);
    });

    socket.on('sendEmergencyMessage', (data) => {
        if (units[data.sender]) {
            units[data.sender].status = 'SOS';
            io.emit('updateUnitsList', units);
        }
        io.emit('receiveMessage', data);
    });

    const handleSOS = (data) => {
        const senderName = data.sender || socket.alphaName;
        if (senderName && units[senderName]) {
            units[senderName].status = 'SOS';
            io.emit('updateUnitsList', units);
        }
        io.emit('receiveSOS', data);
    };
    socket.on('sosAlert', handleSOS);
    socket.on('receiveSOS', handleSOS);

    const handleCommanderTarget = (targetData) => {
        io.emit('update_commander_target', targetData);
    };
    socket.on('set_commander_target', handleCommanderTarget);
    socket.on('president_target_location', handleCommanderTarget);

    socket.on('voice_stream', (audioChunk) => {
        socket.broadcast.emit('receive_voice_stream', audioChunk);
    });

    socket.on('audio-offer', (data) => {
        socket.broadcast.emit('audio-offer', data);
    });
    socket.on('audio-answer', (data) => {
        socket.broadcast.emit('audio-answer', data);
    });
    socket.on('ice-candidate', (data) => {
        socket.broadcast.emit('ice-candidate', data);
    });

    socket.on('webrtc_join_audio', (data) => {
        socket.peerRole = data.role || socket.id;
        let otherPeers = activeAudioPeers.filter(p => p.socketId !== socket.id).map(p => p.socketId);
        socket.emit('webrtc_peer_list', otherPeers);

        activeAudioPeers.push({ socketId: socket.id, role: socket.peerRole });
    });

    socket.on('webrtc_offer', (data) => {
        io.to(data.target).emit('webrtc_offer', {
            from: socket.id,
            offer: data.offer
        });
    });

    socket.on('webrtc_answer', (data) => {
        io.to(data.target).emit('webrtc_answer', {
            from: socket.id,
            answer: data.answer
        });
    });

    socket.on('webrtc_ice_candidate', (data) => {
        io.to(data.target).emit('webrtc_ice_candidate', {
            from: socket.id,
            candidate: data.candidate
        });
    });

    socket.on('webrtc_leave_audio', () => {
        activeAudioPeers = activeAudioPeers.filter(p => p.socketId !== socket.id);
        socket.broadcast.emit('webrtc_peer_disconnected', socket.id);
    });

    socket.on('disconnect', () => {
        if (socket.alphaName && units[socket.alphaName]) {
            delete units[socket.alphaName];
            io.emit('updateUnitsList', units);
        }
        
        activeAudioPeers = activeAudioPeers.filter(p => p.socketId !== socket.id);
        socket.broadcast.emit('webrtc_peer_disconnected', socket.id);

        console.log('❌ ئامێرێک پچڕا:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🚀 سێرڤەر بە سەرکەوتوویی لەسەر پۆرتی ${PORT} چالاک بوو`);
});
