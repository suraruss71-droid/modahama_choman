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
const VALID_KEYS = Array.from({ length: 30 }, (_, i) => `Alpha ${i + 1}`);

io.on('connection', (socket) => {
    
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

    // چارەسەرکردنی ناردنی پەیامی فەرماندە بۆ گشت هێزەکان 📡
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

    socket.on('president_target_location', (targetData) => {
        io.emit('update_commander_target', targetData);
    });

    // پەیوەندی دەنگی (WebRTC Signaling) 🎙️
    socket.on('voice_signal', (data) => {
        io.emit('voice_signal', data);
    });

    socket.on('disconnect', () => {
        if (socket.alphaName && units[socket.alphaName]) {
            delete units[socket.alphaName];
            io.emit('updateUnitsList', units);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`سێرڤەر چالاکە لەسەر پۆرتی ${PORT}`);
});
