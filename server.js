const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// بڵاوکردنەوەی فایلە HTML و فایلە ستاتیکەکان 📂
app.use(express.static(path.join(__dirname)));

let units = {};

io.on('connection', (socket) => {
    console.log('ئەلفا پەیوەندی بە سێرڤەرەوە کرد:', socket.id);

    // ناردنەوەی دوایین لیستی یەکەکان بۆ ئەوەی هەر کەسێک نوێبوەوە زانیارییەکە ببینێت
    socket.emit('updateUnitsList', units);

    socket.on('updateLocation', (data) => {
        units[data.id] = { ...data, lastSeen: Date.now() };
        io.emit('updateUnitsList', units);
    });

    socket.on('presidentBroadcast', (data) => {
        io.emit('receiveMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('پەیوەندی پچڕا:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`سێرڤەر لەسەر پۆرت ${PORT} کار دەکات`);
});
