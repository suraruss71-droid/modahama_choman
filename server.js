const expressModule = require('express');
const express = expressModule.default || expressModule;
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    pingTimeout: 60000,
    pingInterval: 25000
});
const path = require('path');

// پێشاندانی فایلەکان لە فۆڵدەری سەرەکی 📁
app.use(express.static(__dirname));

// ڕێڕەوی ڕاستەوخۆ بۆ دڵنیابوون لە کارکردنی فایلەکان 🌐
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/alpha.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'alpha.html'));
});

let units = {};
let activeAudioPeers = []; // لیستی بەشداربووانی دەنگی WebRTC
const VALID_KEYS = Array.from({ length: 30 }, (_, i) => `Alpha ${i + 1}`);

io.on('connection', (socket) => {
    console.log('⚡ ئامێرێکی نوێ بەستراوەتەوە:', socket.id);

    // 🎖️ ١. تۆمارکردنی هێزەکانی ئەلفا بە کۆدی نهێنی و پۆلێنکردنی تیپەکان
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
                battery: data.battery || 100,
                lastSeen: Date.now()
            };
            socket.emit('registration_status', { success: true, alphaName: socket.alphaName });
            io.emit('updateUnitsList', units);
            console.log(`✅ یەکە تۆمارکرا: ${socket.alphaName} لە ژووری ${squadRoom}`);
        } else {
            socket.emit('registration_status', { success: false, message: 'کلیلی سەربازی هەڵەیە!' });
        }
    });

    // 📍 ٢. تازەکردنەوەی شوێن و دۆخی مەیدانی (Location & Status Update)
    socket.on('updateLocation', (data) => {
        if (socket.alphaName && units[socket.alphaName]) {
            units[socket.alphaName].lat = data.lat;
            units[socket.alphaName].lon = data.lon;
            units[socket.alphaName].heading = data.heading || 0;
            units[socket.alphaName].status = data.status || 'ئامادەباش';
            units[socket.alphaName].battery = data.battery || units[socket.alphaName].battery;
            units[socket.alphaName].lastSeen = Date.now();
            io.emit('updateUnitsList', units);
        }
    });

    // 📡 ٣. پەخشکردنی فەرمانی فەرماندە (President Broadcast) بۆ گشت هێزەکان
    socket.on('presidentBroadcast', (data) => {
        io.emit('receiveMessage', data);
    });

    // ✉️ ٤. ناردنی پەیامی بەپەلە و ئاسایی میدانی
    socket.on('sendEmergencyMessage', (data) => {
        if (units[data.sender]) {
            units[data.sender].status = 'SOS';
            io.emit('updateUnitsList', units);
        }
        io.emit('receiveMessage', data);
    });

    // 🚨 ٥. هاواری بەپەلە (SOS Alert) - گوێگرتن لە هەردوو ناوەکە بە شێوەی زامنکراو
    const handleSOS = (data) => {
        const senderName = data.sender || socket.alphaName;
        if (senderName && units[senderName]) {
            units[senderName].status = 'SOS';
            io.emit('updateUnitsList', units);
        }
        io.emit('receiveSOS', data);
        io.emit('receiveMessage', {
            sender: senderName || 'نەناسراو',
            text: '🚨 ئاگاداری مەترسی و هاواری بەپەلە (SOS) ڕەوانەکرا!',
            type: 'SOS',
            time: new Date().toLocaleTimeString()
        });
    };
    socket.on('sosAlert', handleSOS);
    socket.on('receiveSOS', handleSOS);

    // 🎯 ٦. ئامانجی فەرماندەیی (Commander Target) و دیاریکردنی خاڵی هێرش/پشکنین
    const handleCommanderTarget = (targetData) => {
        io.emit('update_commander_target', targetData);
        io.emit('set_commander_target', targetData);
    };
    socket.on('set_commander_target', handleCommanderTarget);
    socket.on('president_target_location', handleCommanderTarget);

    // 🎙️ ٧. گواستنەوەی دەنگ (Voice Stream) کۆن و پشتگیری ڕەسەنی فۆرماتی بێسیم
    socket.on('voice_stream', (audioChunk) => {
        socket.broadcast.emit('receive_voice_stream', audioChunk);
    });

    socket.on('audio-offer', (data) => { socket.broadcast.emit('audio-offer', data); });
    socket.on('audio-answer', (data) => { socket.broadcast.emit('audio-answer', data); });
    socket.on('ice-candidate', (data) => { socket.broadcast.emit('ice-candidate', data); });

    // 🌟 ٨. سیستەمی پێشکەوتووی WebRTC Signaling بۆ پەیوەندییە دەنگییە ڕاستەوخۆکان (P2P / Mesh) باڵا
    socket.on('webrtc_join_audio', (data) => {
        socket.peerRole = data.role || socket.id;
        let otherPeers = activeAudioPeers.filter(p => p.socketId !== socket.id).map(p => p.socketId);
        socket.emit('webrtc_peer_list', otherPeers);
        activeAudioPeers.push({ socketId: socket.id, role: socket.peerRole });
        console.قرسی || console.log(`🎙️ یەکە بەشدار بوو لە دەنگی WebRTC: ${socket.peerRole}`);
    });

    socket.on('webrtc_offer', (data) => {
        io.to(data.target).emit('webrtc_offer', { from: socket.id, offer: data.offer });
    });

    socket.on('webrtc_answer', (data) => {
        io.to(data.target).emit('webrtc_answer', { from: socket.id, answer: data.answer });
    });

    socket.on('webrtc_ice_candidate', (data) => {
        io.to(data.target).emit('webrtc_ice_candidate', { from: socket.id, candidate: data.candidate });
    });

    socket.on('webrtc_leave_audio', () => {
        activeAudioPeers = activeAudioPeers.filter(p => p.socketId !== socket.id);
        socket.broadcast.emit('webrtc_peer_disconnected', socket.id);
    });

    // ❌ ٩. پچڕانی پەیوەندی گشتی و پاککردنەوەی ئۆتۆماتیکی یەکەکان
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
