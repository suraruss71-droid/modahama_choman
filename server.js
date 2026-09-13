const expressModule = require('express');
const express = expressModule.default || expressModule;
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// پێشاندانی فایلەکان لە فۆڵدەری سەرەکی 📁
app.use(express.static(__dirname));

// لیستێک بۆ هەڵگرتنی زانیاری هێزەکان 📊
let units = {};

// دروستکردنی کلیلەکانی Alpha 1 تا Alpha 30 بە ئۆتۆماتیکی 🔑
const VALID_KEYS = Array.from({ length: 30 }, (_, i) => `Alpha ${i + 1}`);

io.on('connection', (socket) => {
    
    // ١. تۆمارکردن و پشکنینی کلیلی ئەلفا 🔑
    socket.on('register_alpha', (data) => {
        if (VALID_KEYS.includes(data.apiKey)) {
            socket.alphaName = data.apiKey; // کلیلەکە دەبێتە ناوی یەکە
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
            socket.emit('registration_status', { 
                success: false, 
                message: 'کلیلی سەربازی هەڵەیە!' 
            });
        }
    });

    // ٢. وەرگرتنی شوێن (GPS) 📍
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

    // ٣. وەرگرتنی هۆشداری مەترسی SOS 🚨
    socket.on('sendEmergencyMessage', (data) => {
        if (units[data.sender]) {
            units[data.sender].status = 'SOS';
            io.emit('updateUnitsList', units);
        }
        io.emit('receiveMessage', data);
    });

    // ٤. ناردنی شوێنی دەستنیشانکراوی فەرماندە بۆ نەخشەی ئەلفاکان 🎯
    socket.on('president_target_location', (targetData) => {
        io.emit('update_commander_target', targetData);
    });

    // ٥. ناردنی فەرمانی گشتی 📢
    socket.on('presidentBroadcast', (data) => {
        io.emit('receiveMessage', data);
    });

    // ٦. کاتی پچڕانی پەیوەندی 🔴
    socket.on('disconnect', () => {
        if (socket.alphaName && units[socket.alphaName]) {
            delete units[socket.alphaName];
            io.emit('updateUnitsList', units);
        }
    });
});

// دیاریکردنی پۆرت بۆ Railway 🌐
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`سێرڤەر چالاکە لەسەر پۆرتی ${PORT}`);
});
