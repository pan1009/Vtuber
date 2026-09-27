const express    = require('express');
const https      = require('https');
const path       = require('path');
const selfsigned = require('selfsigned');
const { networkInterfaces } = require('os');

const PORT = 8443;

// Auto-generate self-signed cert (accepted once in browser)
const pems = selfsigned.generate(
  [{ name: 'commonName', value: 'localhost' }],
  { days: 365, keySize: 2048 }
);

const app = express();
app.use(express.static(path.join(__dirname, '../public')));

const server = https.createServer({ key: pems.private, cert: pems.cert }, app);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n=== VTuber Web Server ===');
  console.log(`PC:     https://localhost:${PORT}`);

  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`iPhone: https://${iface.address}:${PORT}  ← 同じWi-Fiで接続`);
      }
    }
  }

  console.log('\n初回アクセス時: 証明書警告 →「詳細を表示」→「〜に進む」を選択');
  console.log('Ctrl+C で停止\n');
});
