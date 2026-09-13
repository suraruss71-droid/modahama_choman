const expressModule = require('express');
const express = expressModule.default || expressModule;
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
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
const VALID_KEYS = Array.from({ length: 30 }, (_, i) => `Alpha ${i + 1}`);

io.on('connection', (socket) => {
    console.log('⚡ ئامێرێکی نوێ بەستراوەتەوە:', socket.id);

    // 🎖️ ١. تۆمارکردنی هێزەکانی ئەلفا[span_4](start_span)[span_4](end_span)
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

    // 📍 ٢. تازەکردنەوەی شوێن (Location Update)[span_5](start_span)[span_5](end_span)
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

    // 📡 ٣. پەخشکردنی فەرمانی فەرماندە (President Broadcast)[span_6](start_span)[span_6](end_span)
    socket.on('presidentBroadcast', (data) => {
        io.emit('receiveMessage', data);
    });

    // ✉️ ٤. ناردنی پەیامی بەپەلە و ئاسایی[span_7](start_span)[span_7](end_span)
    socket.on('sendEmergencyMessage', (data) => {
        if (units[data.sender]) {
            units[data.sender].status = 'SOS';
            io.emit('updateUnitsList', units);
        }
        io.emit('receiveMessage', data);
    });

    // 🚨 ٥. هاواری بەپەلە (SOS Alert) - گوێگرتن لە هەردوو ناوەکە[span_8](start_span)[span_8](end_span)[span_9](start_span)[span_9](end_span)
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

    // 🎯 ٦. ئامانجی فەرماندەیی (Commander Target) - گوێگرتن لە هەردوو ناوەکە[span_10](start_span)[span_10](end_span)[span_11](start_span)[span_11](end_span)
    const handleCommanderTarget = (targetData) => {
        io.emit('update_commander_target', targetData);
    };
    socket.on('set_commander_target', handleCommanderTarget);
    socket.on('president_target_location', handleCommanderTarget);

    // 🎙️ ٧. گواستنەوەی دەنگ (Voice Stream) بە شێوازی پارچەی دەنگی (Audio Chunks)[span_12](start_span)[span_12](end_span)[span_13](start_span)[span_13](end_span)
    socket.on('voice_stream', (audioChunk) => {
        // ناردنی پارچە دەنگییەکە بۆ هەموو ئامێرەکانی تر
        socket.broadcast.emit('receive_voice_stream', audioChunk);
    });

    // WebRTC کۆنەکە وەک خۆی هێڵراوەتەوە نەوەک لە شوێنێکی تر پێویستت پێی بێت[span_14](start_span)[span_14](end_span)
    socket.on('audio-offer', (data) => {
        socket.broadcast.emit('audio-offer', data);
    });
    socket.on('audio-answer', (data) => {
        socket.broadcast.emit('audio-answer', data);
    });
    socket.on('ice-candidate', (data) => {
        socket.broadcast.emit('ice-candidate', data);
    });

    // ❌ ٨. پچڕانی پەیوەندی[span_15](start_span)[span_15](end_span)
    socket.on('disconnect', () => {
        if (socket.alphaName && units[socket.alphaName]) {
            delete units[socket.alphaName];
            io.emit('updateUnitsList', units);
        }
        console.log('❌ ئامێرێک پچڕا:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🚀 سێرڤەر بە سەرکەوتوویی لەسەر پۆرتی ${PORT} چالاک بوو`);
});
