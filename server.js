const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// پێشاندانی فایلەکان لە فۆڵدەری سەرەکی 📁
app.use(express.static(__dirname));

// لیستێک بۆ هەڵگرتنی زانیاری هێزەکان 📊
let units = {};
const VALID_API_KEY = "Alpha_one_cyber_surche";

io.on('connection', (socket) => {
    
    // ١. تۆمارکردنی هێزی ئەلفا 🔑
    socket.on('register_alpha', (data) => {
        if (data.apiKey === VALID_API_KEY) {
            socket.alphaName = data.alphaName;
            units[data.alphaName] = {
                id: data.alphaName,
                lat: null,
                lon: null,
                heading: 0,
                status: 'ئامادەباش',
                lastSeen: Date.now()
            };
            socket.emit('registration_status', { success: true });
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
            units[socket.alphaName].heading = data.heading;
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

    // ٤. ناردنی فەرمان لەلایەن فەرماندەوە 📢
    socket.on('presidentBroadcast', (data) => {
        io.emit('receiveMessage', data);
    });

    // ٥. کاتی پچڕانی پەیوەندی 🔴
    socket.on('disconnect', () => {
        if (socket.alphaName && units[socket.alphaName]) {
            delete units[socket.alphaName];
            io.emit('updateUnitsList', units);
        }
    });
});

// دیاریکردنی پۆرت بە شێوەی ئۆتۆماتیکی بۆ Railway 🌐
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`سێرڤەر چالاکە لەسەر پۆرتی ${PORT}`);
});
