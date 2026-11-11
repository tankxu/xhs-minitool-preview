/* 示例小工具：演示顶部避让、平台 Storage、保存相册和发笔记。按 Chrome 61 / ES2017 写。 */
(function () {
'use strict';

const KEY = 'demo:count';
const $ = (id) => document.getElementById(id);
const mt = () => window.xhs && window.xhs.miniTool;
const has = (name) => !!mt() && typeof mt()[name] === 'function';
let count = 0;

// 内容排在原生返回/分享按钮下方
async function reserveTop() {
    if (!has('getWindowInfo')) return;
    try {
        const info = await mt().getWindowInfo();
        const buttons = (info && info.menuButtons) || {};
        const bottoms = Object.keys(buttons).map((k) => buttons[k] && buttons[k].bottom).filter(Number.isFinite);
        if (bottoms.length) document.documentElement.style.setProperty('--top-reserve', (Math.max.apply(null, bottoms) + 8) + 'px');
    } catch (_) {}
}

async function load() {
    try {
        const raw = has('getStorage') ? (await mt().getStorage({ key: KEY })).data : localStorage.getItem(KEY);
        count = Number(raw) || 0;
    } catch (_) {}
    $('count').textContent = count;
}

function save() {
    const data = String(count);
    if (has('setStorage')) mt().setStorage({ key: KEY, data }).catch(() => {});
    else try { localStorage.setItem(KEY, data); } catch (_) {}
}

function poster() {
    const c = document.createElement('canvas');
    c.width = 720; c.height = 960;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff6f2'; ctx.fillRect(0, 0, 720, 960);
    ctx.fillStyle = '#ff2442'; ctx.font = '600 44px sans-serif'; ctx.fillText('示例小工具', 60, 120);
    ctx.fillStyle = '#2b2523'; ctx.font = '36px sans-serif'; ctx.fillText('今天点了', 60, 420);
    ctx.fillStyle = '#ff2442'; ctx.font = '700 180px sans-serif'; ctx.fillText(String(count), 60, 600);
    ctx.fillStyle = '#8a7f7b'; ctx.font = '28px sans-serif'; ctx.fillText('来自本地预览模拟器', 60, 880);
    return c.toDataURL('image/png');
}

async function tempPath(dataUrl) {
    if (has('writeTempFile')) {
        try { return (await mt().writeTempFile({ data: dataUrl })).filePath; } catch (_) {}
    }
    return dataUrl;
}

async function share(kind) {
    if (!has(kind === 'post' ? 'postNote' : 'saveImageToPhotosAlbum')) { $('msg').textContent = '当前环境不支持，可截图保存。'; return; }
    try {
        const filePath = await tempPath(poster());
        if (kind === 'post') {
            await mt().postNote({ title: `今天点了 ${count} 次`, content: '用示例小工具点的。', pageType: 'photo_publish', mediaInfo: { image_resources: [{ url: filePath }] } });
            $('msg').textContent = '已打开发笔记。';
        } else {
            await mt().saveImageToPhotosAlbum({ filePath });
            $('msg').textContent = '已保存到相册。';
        }
    } catch (err) {
        $('msg').textContent = '没成功：' + ((err && err.errMsg) || '未知错误');
    }
}

$('tap').addEventListener('click', () => { count += 1; $('count').textContent = count; save(); });
$('post').addEventListener('click', () => share('post'));
$('save').addEventListener('click', () => share('save'));
reserveTop();
load();
})();
