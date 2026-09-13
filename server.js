const express = require('http');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let units = {};

io.on('connection', (socket) => {
    console.log('ئەلفا پەیوەندی بە سێرڤەرەوە کرد:', socket.id);

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
