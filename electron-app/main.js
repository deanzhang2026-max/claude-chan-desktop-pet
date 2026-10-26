// ============================================================
//  Claude娘 桌宠  --  Electron 宿主
//
//  读 Claude Code hook（hooks/pet-hook.js）写的状态文件
//    $CLAUDE_PET_STATE  ->  %USERPROFILE%\.claude\pet\state.json
//
//  状态由主进程读文件、走 IPC 推给页面。不要让页面自己 fetch() 文件：
//  Chromium 会拦 file:// 请求（即使 webSecurity:false），气泡会一直显示默认文字。
//
//  交互：
//    - 在桌宠身上拖动可以移动窗口（拖动由页面发 IPC、主进程跟随光标，
//      不用 -webkit-app-region: drag：Windows 上它会吞掉右键，菜单就弹不出来）
//    - 右键菜单：置顶、固定位置（锁住不能拖）、大小、重新载入、关闭
//    - 位置、大小、置顶、固定位置会记在 userData/settings.json，下次启动沿用
// ============================================================

const { app, BrowserWindow, screen, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const W = 380;
const H = 600;
const MARGIN = 24;

// 右键菜单“大小”里的档位；窗口按比例缩放，页面用 zoomFactor 跟着放大缩小
const SCALES = [
  { label: '小', value: 0.6 },
  { label: '较小', value: 0.8 },
  { label: '标准', value: 1 },
  { label: '较大', value: 1.25 },
  { label: '大', value: 1.5 },
  { label: '特大', value: 2 }
];

const STATE_FILE = (process.env.CLAUDE_PET_STATE || '').trim() ||
  path.join(os.homedir(), '.claude', 'pet', 'state.json');

// 页面经本机 http 打开，不用 file://：2.5D 模式（web/rig-driver.js）靠同源 BroadcastChannel
// 控制 iframe 里的角色，file:// 页面彼此不算同源。只监听 127.0.0.1、随机端口、只读 web/ 目录。
const WEB_ROOT = path.join(__dirname, '..', 'web');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.psd': 'application/octet-stream', '.moc3': 'application/octet-stream', '.wasm': 'application/wasm'
};

function startWebServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { rel = '/'; }
      const file = path.normalize(path.join(WEB_ROOT, rel === '/' ? 'pet.html' : rel));
      // 只许读 web/ 里面的文件
      if (!file.startsWith(WEB_ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
                             'Cache-Control': 'no-cache' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

let win = null;
let pinned = true;    // 置顶：始终显示在其他窗口上面
let locked = false;   // 固定位置：不能再拖动
let scale = 1;
let pos = null;       // 上次的窗口左上角 { x, y }；没有就放右上角
let lastRaw = '';

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    const s = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'));
    if (typeof s.pinned === 'boolean') pinned = s.pinned;
    if (typeof s.locked === 'boolean') locked = s.locked;
    if (SCALES.some((o) => o.value === s.scale)) scale = s.scale;
    if (Number.isFinite(s.x) && Number.isFinite(s.y)) pos = { x: s.x, y: s.y };
  } catch (e) { /* 第一次启动，用默认值 */ }
}

function saveSettings() {
  try {
    if (win && !win.isDestroyed()) {
      const b = win.getBounds();
      pos = { x: b.x, y: b.y };
    }
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(Object.assign({ pinned, locked, scale }, pos)), 'utf8');
  } catch (e) { /* 存不下也不影响使用 */ }
}

// 把窗口挪回 (x, y) 所在（或最近的）屏幕的工作区里，外接显示器拔了、分辨率变了也不会丢
function fitToScreen(x, y, width, height) {
  const wa = screen.getDisplayMatching({ x, y, width, height }).workArea;
  return {
    x: Math.max(wa.x, Math.min(x, wa.x + wa.width - width)),
    y: Math.max(wa.y, Math.min(y, wa.y + wa.height - height))
  };
}

function applyPinned() {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(pinned, 'screen-saver');
  // 取消置顶后窗口可能被别的窗口盖住；任务栏里留一个按钮，才有办法把她叫回来
  win.setSkipTaskbar(pinned);
}

// 以脚底（窗口下边中点）为锚点缩放，并保证不跑出所在屏幕的工作区
function applyScale() {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  const width = Math.round(W * scale);
  const height = Math.round(H * scale);
  const { x, y } = fitToScreen(Math.round(b.x + b.width / 2 - width / 2), b.y + b.height - height, width, height);
  win.webContents.setZoomFactor(scale);
  win.setBounds({ x, y, width, height });
  syncUiScale();
}

// 缩小时气泡、换装条保持标准大小，由页面里的 setUiScale 按 zoom 反向放回去
function syncUiScale() {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript('window.setUiScale && window.setUiScale(' + Number(scale) + ')').catch(() => {});
}

// 拖动：页面按下鼠标时通知主进程，之后主进程按光标位移移动窗口。
// 用 setBounds 而不是 setPosition：高 DPI 缩放下 setPosition 会让窗口尺寸一点点漂移。
let dragTimer = null;

function startDrag() {
  stopDrag();
  if (locked || !win || win.isDestroyed()) return;
  const start = screen.getCursorScreenPoint();
  const b = win.getBounds();
  dragTimer = setInterval(() => {
    if (!win || win.isDestroyed()) { stopDrag(); return; }
    const p = screen.getCursorScreenPoint();
    win.setBounds({ x: b.x + p.x - start.x, y: b.y + p.y - start.y, width: b.width, height: b.height });
  }, 8);
}

function stopDrag() {
  if (dragTimer) { clearInterval(dragTimer); dragTimer = null; saveSettings(); }   // 拖完记住位置
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    if (!raw || raw === lastRaw) return null;
    lastRaw = raw;
    return JSON.parse(raw);
  } catch (e) {
    return null;   // 文件还没有，或者正好在改名；跳过这一拍
  }
}

function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

function pushState() {
  const s = readState();
  if (!s || !win || win.isDestroyed()) return;
  // ts / turnStart 给 pet.html 的 watchdog 判断“长任务打瞌睡”和“被打断”
  const safe = {
    title: typeof s.title === 'string' ? s.title : 'Claude',
    bubble: typeof s.bubble === 'string' ? s.bubble : '',
    status: typeof s.status === 'string' ? s.status : 'idle',
    progress: num(s.progress, 0),
    tool: typeof s.tool === 'string' ? s.tool : '',
    ts: num(s.ts, Date.now()),
    turnStart: num(s.turnStart, 0)
  };
  win.webContents.send('pet-state', safe);
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: '置顶',
      type: 'checkbox',
      checked: pinned,
      click: (item) => { pinned = item.checked; applyPinned(); saveSettings(); }
    },
    {
      label: '固定位置',
      type: 'checkbox',
      checked: locked,
      click: (item) => { locked = item.checked; stopDrag(); saveSettings(); }
    },
    {
      label: '大小',
      submenu: SCALES.map((o) => ({
        label: o.label,
        type: 'radio',
        checked: o.value === scale,
        click: () => { scale = o.value; applyScale(); saveSettings(); }
      }))
    },
    { type: 'separator' },
    { label: '重新载入', click: () => win.webContents.reload() },
    { label: '关闭桌宠', click: () => app.quit() }
  ]);
}

function createWindow(port) {
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.round(W * scale);
  const height = Math.round(H * scale);
  const start = pos ? fitToScreen(pos.x, pos.y, width, height)
                    : { x: wa.x + wa.width - width - MARGIN, y: wa.y + MARGIN };

  win = new BrowserWindow({
    width,
    height,
    x: start.x,
    y: start.y,
    show: false,
    useContentSize: true,
    transparent: true,
    frame: false,
    alwaysOnTop: pinned,
    skipTaskbar: pinned,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  applyPinned();
  win.webContents.setBackgroundThrottling(false);

  win.webContents.on('context-menu', (event) => {
    event.preventDefault();
    buildMenu().popup({ window: win });
  });

  if (port) win.loadURL(`http://127.0.0.1:${port}/pet.html`);
  else win.loadFile(path.join(WEB_ROOT, 'pet.html'));   // 服务器起不来时退回 file://（立绘 / Live2D 模式仍可用）
  win.once('ready-to-show', () => win.show());

  // 每次载入都推一次，之后轮询
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(scale);   // 缩放按页面记，每次载入都要重设
    syncUiScale();
    lastRaw = '';          // 重新载入后强制重发
    setTimeout(pushState, 400);
  });
}

ipcMain.on('pet:quit', () => app.quit());
ipcMain.on('pet:drag-start', startDrag);
ipcMain.on('pet:drag-end', stopDrag);

// 双击两次启动脚本只开一只
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady()
    .then(() => { loadSettings(); return startWebServer().catch(() => 0); })
    .then((port) => {
      createWindow(port);
      setInterval(pushState, 300);
    });
}

app.on('window-all-closed', () => app.quit());
