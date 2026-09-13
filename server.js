<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ئەلفا - سیستەمی مەیدانی</title>
    <style>
        body { background: #030712; color: #fff; font-family: sans-serif; padding: 20px; text-align: center; }
        .box { background: #0b132b; border: 2px solid #f59e0b; padding: 20px; border-radius: 10px; margin-top: 20px; }
        input, button { width: 100%; padding: 12px; margin: 10px 0; border-radius: 6px; border: 1px solid #1e293b; background: #020617; color: white; font-size: 16px; }
        .btn-connect { background: #10b981; font-weight: bold; cursor: pointer; }
        .btn-sos { background: #ef4444; font-weight: bold; cursor: pointer; }
        .status { margin-top: 15px; font-weight: bold; color: #3b82f6; }
    </style>
</head>
<body>
    <h2>⚡ بەشی هێزەکان (ئەلفا)</h2>
    <div class="box" id="loginBox">
        <p>زانیارییەکانی چوونەژوورەوە بنووسە:</p>
        <input type="text" id="serverIpInput" placeholder="ئایپی سێرڤەر (نموونە: 10.0.2.15)" value="10.0.2.15">
        <input type="text" id="alphaNameInput" placeholder="ناوی ئەلفا (نموونە: Alpha 1)">
        <input type="password" id="apiKeyInput" placeholder="کلیلی سەربازی (Alpha_one_cyber_surche)" value="Alpha_one_cyber_surche">
        <button class="btn-connect" onclick="connectAlpha()">چوونە ژوورەوە و پەیوەستبوون</button>
    </div>

    <div class="box" id="controlBox" style="display: none;">
        <h3 id="welcomeTitle" style="color: #10b981;"></h3>
        <div class="status" id="statusText">دۆخ: ئامادەباش (لۆکەیشن دەنێردرێت)</div>
        <button class="btn-sos" onclick="sendSOS()">🚨 ناردنی نیشانەی مەترسی (SOS)</button>
    </div>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script>
        let socket;
        let watchId = null;

        function connectAlpha() {
            const serverIp = document.getElementById('serverIpInput').value;
            const alphaName = document.getElementById('alphaNameInput').value;
            const apiKey = document.getElementById('apiKeyInput').value;

            if(!serverIp || !alphaName || !apiKey) {
                alert('تکایە هەموو خانەکان پڕ بکەرەوە!');
                return;
            }

            // بەستنەوە بە پۆرتی 3000 و ئایپی دیاریکراو
            socket = io(`http://${serverIp}:3000`);

            socket.on('connect', () => {
                socket.emit('register_alpha', { alphaName, apiKey });
            });

            socket.on('registration_status', (data) => {
                if(data.success) {
                    document.getElementById('loginBox').style.display = 'none';
                    document.getElementById('controlBox').style.display = 'block';
                    document.getElementById('welcomeTitle').innerText = alphaName + ' بە سەرکەوتوویی بەستراوەتەوە';
                    startLocationTracking(alphaName);
                } else {
                    alert(data.message);
                }
            });
            
            socket.on('connect_error', (err) => {
                alert('پەیوەستبوون بە سێرڤەر سەرکەوتوو نەبوو! دڵنیابە لە ئایپی و کراوەبوونی سێرڤەرەکە.');
            });
        }

        function startLocationTracking(alphaName) {
            if (navigator.geolocation) {
                watchId = navigator.geolocation.watchPosition((position) => {
                    let lat = position.coords.latitude;
                    let lon = position.coords.longitude;
                    let heading = position.coords.heading || 0;

                    socket.emit('updateLocation', {
                        lat: lat,
                        lon: lon,
                        heading: heading,
                        status: 'ئامادەباش'
                    });
                }, (error) => {
                    console.log('GPS Error: ', error);
                }, { enableHighAccuracy: true });
            } else {
                alert('جیۆلۆکەیشن لەم ئامێرەدا پشتگیری ناکرێت!');
            }
        }

        function sendSOS() {
            navigator.geolocation.getCurrentPosition((pos) => {
                socket.emit('sendEmergencyMessage', {
                    sender: document.getElementById('alphaNameInput').value,
                    text: `🚨 ئاگاداری مەترسی (SOS) لە شوێنی پانی: ${pos.coords.latitude.toFixed(4)} و درێژی: ${pos.coords.longitude.toFixed(4)}`,
                    type: 'SOS'
                });
                alert('نیشانەی مەترسی بە سەرکەوتوویی نێردرا بۆ ژووری ئۆپەراسیۆن!');
            });
        }
    </script>
</body>
</html>
