#!/usr/bin/env node
// 小工具本地预览：手机外框 + 模拟小红书返回/分享按钮 + 模拟 window.xhs，保存即刷新。
// 用法：node preview.mjs <目录>... [--port 5178] [--open]
//   目录可以是单个小工具（含 index.html），也可以是装着多个小工具的父目录（自动找 */src|dist/index.html），预览页里切换
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', 'assets');
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dirArgs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--port');
if (!dirArgs.length) { console.error('用法：node preview.mjs <小工具目录或其父目录>... [--port 5178] [--open]'); process.exit(2); }

// 找出所有小工具：name -> { root, title }
const APPS = new Map();
function addApp(root, name) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = html.match(/<title>([^<]*)<\/title>/i);
  let key = name, n = 2;
  while (APPS.has(key)) key = name + '-' + n++;
  APPS.set(key, { root, title: m ? m[1].trim() : name });
}
for (const d of dirArgs) {
  const dir = path.resolve(d);
  if (fs.existsSync(path.join(dir, 'index.html'))) {
    addApp(dir, ['src', 'dist'].includes(path.basename(dir)) ? path.basename(path.dirname(dir)) : path.basename(dir));
    continue;
  }
  let found = 0;
  for (const sub of fs.readdirSync(dir).sort()) {
    if (sub.startsWith('.')) continue;
    for (const leaf of ['src', 'dist', '']) {
      const root = path.join(dir, sub, leaf);
      if (fs.existsSync(path.join(root, 'index.html'))) { addApp(root, sub); found++; break; }
    }
  }
  if (!found) { console.error('找不到小工具：' + dir); process.exit(2); }
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8'
};

// 改动推送给外框页，外框只重载当前在看的那个
const clients = new Set();
for (const [name, app] of APPS) {
  let pending = null;
  fs.watch(app.root, { recursive: true }, (_e, file) => {
    if (file && /(^|\/)\./.test(file)) return;
    clearTimeout(pending);
    pending = setTimeout(() => {
      for (const res of clients) res.write(`data: ${JSON.stringify({ app: name, file })}\n\n`);
      console.log(`[reload] ${name} ${file || ''}`);
    }, 120);
  });
}

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveApp(res, name, rel) {
  const app = APPS.get(name);
  if (!app) return send(res, 404, '没有这个小工具：' + name);
  const ROOT = app.root;
  const file = path.resolve(ROOT, '.' + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, '404 ' + rel + '\n（小工具里引用了包内不存在的文件）');
    const ext = path.extname(file).toLowerCase();
    if (ext === '.html') {
      // 只在预览时注入模拟容器，源码不改
      const html = buf.toString('utf8').replace(/<head([^>]*)>/i, '<head$1><script src="/__shell/xhs-mock.js"></script>');
      return send(res, 200, html, MIME[ext]);
    }
    send(res, 200, buf, MIME[ext] || 'application/octet-stream');
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '/index.html') {
    const list = [...APPS].map(([name, a]) => ({ name, title: a.title }));
    const html = fs.readFileSync(path.join(ASSETS, 'shell.html'), 'utf8').split('__APPS_JSON__').join(JSON.stringify(list).replace(/</g, '\\u003c'));
    return send(res, 200, html, MIME['.html']);
  }
  if (p === '/__events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': hi\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (p.startsWith('/__shell/')) {
    const name = path.basename(p);
    return fs.readFile(path.join(ASSETS, name), (err, buf) => err ? send(res, 404, '404') : send(res, 200, buf, MIME[path.extname(name)]));
  }
  const m = p.match(/^\/app\/([^/]+)(\/.*)$/);
  if (m) return serveApp(res, m[1], m[2]);
  send(res, 404, '404');
});

let port = Number(flag('--port')) || 5178;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && !flag('--port')) { port += 1; server.listen(port, '127.0.0.1'); }
  else { console.error(e.message); process.exit(1); }
});
server.on('listening', () => {
  const u = `http://127.0.0.1:${port}/`;
  console.log(`PREVIEW_URL:${u}`);
  for (const [name, a] of APPS) console.log(`  ${name}  ${a.title}  ${a.root}`);
  console.log(`共 ${APPS.size} 个小工具，预览页顶部切换；保存文件自动刷新，Ctrl+C 结束`);
  if (args.includes('--open')) {
    const cmd = process.platform === 'win32' ? `start "" "${u}"` : process.platform === 'darwin' ? `open "${u}"` : `xdg-open "${u}"`;
    exec(cmd);
  }
});
server.listen(port, '127.0.0.1');
