/* 预览专用：在小工具 iframe 里模拟 window.xhs。只在本地预览服务里注入，不进 zip。 */
(function () {
  var shell = window.parent !== window && window.parent.__shell;
  if (!shell) return;
  var cfg = shell.config();
  var prefix = 'mtp:' + cfg.app + ':';
  var temp = {};
  var seq = 0;

  function done(name, arg, result) {
    shell.log(name, arg, result);
    return new Promise(function (r) { setTimeout(function () { r(result); }, 30); });
  }
  function fail(name, arg, msg) {
    shell.log(name, arg, 'FAIL ' + msg);
    return Promise.reject({ errMsg: name + ':fail ' + msg });
  }
  function resolveImage(p) { return temp[p] || p; }

  var buildVersion = 9530000;
  var mt = {
    getWindowInfo: function () { return done('getWindowInfo', null, shell.windowInfo()); },
    getLaunchOptions: function () { return done('getLaunchOptions', null, { miniToolEnv: { buildVersion: buildVersion } }); },
    writeTempFile: function (o) {
      if (!o || typeof o.data !== 'string') return fail('writeTempFile', o, 'data 必须是字符串');
      var p = 'wxfile://tmp/preview-' + (++seq) + '.png';
      temp[p] = o.data;
      return done('writeTempFile', o.data.slice(0, 30) + '…', { filePath: p });
    },
    saveImageToPhotosAlbum: function (o) {
      if (!o || !o.filePath) return fail('saveImageToPhotosAlbum', o, '缺少 filePath');
      shell.showImage('已保存到相册（模拟）', resolveImage(o.filePath));
      return done('saveImageToPhotosAlbum', o.filePath);
    },
    postNote: function (o) {
      o = o || {};
      var imgs = (o.mediaInfo && o.mediaInfo.image_resources) || [];
      if (!imgs.length) return fail('postNote', o, '缺少 mediaInfo.image_resources');
      if (o.title && Array.from(o.title).length > 20) return fail('postNote', o.title, '标题超过 20 字');
      shell.showNote(o.title || '', o.content || '', imgs.map(function (x) { return resolveImage(x.url); }));
      return done('postNote', { title: o.title, pageType: o.pageType, images: imgs.length });
    }
  };
  mt.getStorage = function (o) {
    var v = null;
    try { v = localStorage.getItem(prefix + o.key); } catch (_) {}
    return done('getStorage', o.key, { data: v });
  };
  mt.setStorage = function (o) {
    try { localStorage.setItem(prefix + o.key, o.data); } catch (_) {}
    return done('setStorage', o.key + ' = ' + String(o.data).slice(0, 80));
  };
  mt.removeStorage = function (o) {
    try { localStorage.removeItem(prefix + o.key); } catch (_) {}
    return done('removeStorage', o.key);
  };
  window.xhs = { launchOptions: { miniToolEnv: { buildVersion: buildVersion } }, miniTool: mt };

  // iframe 里 env(safe-area-inset-*) 恒为 0，改用变量提供安全区
  var insets = shell.cssInsets();
  Object.keys(insets).forEach(function (k) {
    document.documentElement.style.setProperty('--safe-area-inset-' + k, insets[k] + 'px');
  });

  // 容器禁用的能力：调用时在面板里标红
  function banned(name) { return function () { shell.log(name, null, 'BANNED 容器内不可用'); }; }
  window.open = banned('window.open');
  window.prompt = banned('window.prompt');
  if (navigator.clipboard) navigator.clipboard.writeText = function () { shell.log('clipboard.writeText', null, 'BANNED 容器内不可用'); return Promise.reject(new Error('banned')); };
  var realFetch = window.fetch;
  window.fetch = function (u) {
    if (/^https?:/i.test(String(u)) && String(u).indexOf(location.origin) !== 0) shell.log('fetch', String(u), 'BANNED 容器内不能联网');
    return realFetch.apply(this, arguments);
  };
  window.addEventListener('error', function (e) { shell.log('error', e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno, 'ERROR'); });
  window.addEventListener('unhandledrejection', function (e) { shell.log('unhandledrejection', String(e.reason && (e.reason.errMsg || e.reason.message) || e.reason), 'ERROR'); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && (a.hasAttribute('download') || /^https?:/i.test(a.getAttribute('href')))) shell.log('a[href]', a.getAttribute('href'), 'BANNED 外链/下载不可用');
  }, true);
})();
