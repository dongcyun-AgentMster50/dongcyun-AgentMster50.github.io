// 의존성 없는 정적 서버.  node server.js
//  - http://localhost:5173          (PC 브라우저 테스트)
//  - https://<PC-IP>:5443           (휴대폰 테스트, certs/ 에 인증서가 있을 때)
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png',
};

function handler(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}certs${path.sep}`)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const lanIPs = Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

http.createServer(handler).listen(5173, '0.0.0.0', () => console.log('PC     → http://localhost:5173'));

const key = path.join(ROOT, 'certs', 'key.pem');
const cert = path.join(ROOT, 'certs', 'cert.pem');
if (fs.existsSync(key) && fs.existsSync(cert)) {
  https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, handler)
    .listen(5443, '0.0.0.0', () => lanIPs.forEach(ip => console.log(`휴대폰 → https://${ip}:5443  (경고 화면에서 '계속' 선택)`)));
} else {
  console.log('휴대폰용 HTTPS 인증서가 없습니다 → README.md 의 "휴대폰에서 실행" 참고');
}
