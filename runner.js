/**
 * 泰国旅行 — 服务器 + 公网隧道持久运行脚本
 * 自动启动服务器、建立 Pinggy 公网隧道，断线重连
 * 使用: node runner.js
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const SERVER_SCRIPT = path.join(__dirname, 'server', 'server.js');
const LOG_FILE = path.join(__dirname, 'server.log');
const DATA_DIR = path.join(__dirname, 'server', 'data');
const URL_FILE = path.join(__dirname, 'public_url.txt');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function log(msg) {
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const line = `[${t}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch(e) {}
}

let serverProcess = null;
let tunnelProcess = null;
let currentUrl = null;

function startServer() {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  log('🚀 启动服务器...');
  serverProcess = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', d => log('[server] ' + d.toString().trim()));
  serverProcess.stderr.on('data', d => log('[server] ' + d.toString().trim()));
  serverProcess.on('exit', (code) => {
    log(`⚠️ 服务器退出 (code ${code})，5 秒后重启`);
    serverProcess = null;
    setTimeout(startServer, 5000);
  });
  // 等待服务器就绪
  return new Promise(resolve => {
    const check = () => {
      const req = http.get('http://localhost:3000/', res => { res.resume(); resolve(); });
      req.on('error', () => setTimeout(check, 500));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(check, 500); });
    };
    setTimeout(check, 1000);
  });
}

function startTunnel() {
  if (tunnelProcess) { tunnelProcess.kill(); tunnelProcess = null; }
  log('🔗 建立公网隧道...');
  tunnelProcess = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-p', '443',
    '-R', '0:localhost:3000',
    'a.pinggy.io'
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let urlFound = false;
  tunnelProcess.stdout.on('data', d => {
    const text = d.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.(run\.pinggy-free\.link|free\.pinggy\.net)/);
    if (match && !urlFound) {
      urlFound = true;
      currentUrl = match[0];
      log(`✅ 公网地址：${currentUrl}`);
      log(`📋 分享链接：${currentUrl}?server=${currentUrl}`);
      try { fs.writeFileSync(URL_FILE, currentUrl); } catch(e) {}
      // 测试 API
      testApi(currentUrl);
    }
  });
  tunnelProcess.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg && !msg.includes('Warning') && !msg.includes('warning')) log('[tunnel] ' + msg);
  });
  tunnelProcess.on('exit', (code) => {
    log(`⚠️ 隧道断开 (code ${code})，5 秒后重连`);
    tunnelProcess = null;
    currentUrl = null;
    urlFound = false;
    setTimeout(startTunnel, 5000);
  });
}

function testApi(baseUrl) {
  const u = new URL(baseUrl);
  const opts = {
    hostname: u.hostname,
    port: 443,
    path: '/api/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'thailand-trip' },
  };
  const req = https.request(opts, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      try {
        const j = JSON.parse(body);
        if (j.ok) log(`✅ API 测试通过（行程码 ${j.code}）`);
        else log(`⚠️ API 异常: ${body}`);
      } catch(e) { log(`⚠️ API 响应异常: ${body.slice(0,100)}`); }
    });
  });
  req.on('error', e => log(`⚠️ API 测试失败: ${e.message}`));
  req.end();
}

async function main() {
  log('='.repeat(50));
  log('🏝️ 泰国旅行同步服务器启动中...');
  log('='.repeat(50));
  await startServer();
  startTunnel();
  log('💡 按 Ctrl+C 停止服务器');
  log(`📝 日志文件：${LOG_FILE}`);
  if (currentUrl) log(`🔗 公网地址：${currentUrl}`);
}

process.on('SIGINT', () => {
  log('\n🛑 正在关闭...');
  if (tunnelProcess) tunnelProcess.kill();
  if (serverProcess) serverProcess.kill();
  process.exit(0);
});

// 前台启动需要 https 模块
const https = require('https');
main();
