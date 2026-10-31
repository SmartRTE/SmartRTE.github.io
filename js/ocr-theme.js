/* ==========================================================================
   成绩识图（ocr.html）· <head> 引导脚本（普通脚本，非 module）

   本文件原先是 ocr.html <head> 里的内联 <script>，2026-10 抽离到这里。
   ⚠️ 保持「普通脚本 + 放在 <head> 同步（不用 defer/async）」，首屏才不会
      先闪浅色再跳深色；同时下面的函数仍是全局的，页内 onclick="toggleTheme()"
      和主模块 js/ocr.js 里的 postToHost() 都依赖这一点。
   随 ocr.html 引入：<script src="js/ocr-theme.js"></script>
   ========================================================================== */

/* 主题系统：与 js/CommonFunctions.js 里那套保持一致（localStorage 键名 theme、按钮勾 .theme-toggle），
   但本页是独立 ES module 页面、不加载 CommonFunctions.js，所以这里单独抄一份。
   放在 <head> 里同步执行，首屏就不会先闪一下浅色再跳到深色。 */
(function () {
    var t;
    try { t = localStorage.getItem('theme'); } catch (e) { }
    if (!t || ['light', 'dark'].indexOf(t) === -1) t = 'light';
    document.documentElement.dataset.theme = t;
})();

/* 被别的页面用 iframe 嵌进「识图工具窗」时（ocr.html?embed=1）：
   - 打上 .embedded，把本页自己的顶栏收掉（宿主模态窗自带标题栏和关闭按钮）
   - 主题跟随宿主页面：宿主改 localStorage.theme 时本页会收到 storage 事件 */
var OCR_EMBEDDED = window.self !== window.top ||
    /(^|[?&])embed=1(&|$)/.test(window.location.search);
if (OCR_EMBEDDED) document.documentElement.classList.add('embedded');

/* 主题切换的动画窗口时长（ms），与 CommonFunctions.js 的 THEME_ANIM_MS 一致。
   要略大于 css 里 .theme-animating 的 0.25s，让过渡跑完再摘 class。 */
var THEME_ANIM_MS = 260;

/* 宿主页面切主题时，本页跟着换。这条路径同样走 .theme-animating 窗口，
   否则 iframe 内的整页重算会和宿主叠加。 */
window.addEventListener('storage', function (e) {
    if (e.key !== 'theme') return;
    var root = document.documentElement;
    root.dataset.theme = (e.newValue === 'dark') ? 'dark' : 'light';
    updateThemeButton();
    root.classList.add('theme-animating');
    clearTimeout(window.__themeAnimTimer);
    window.__themeAnimTimer = setTimeout(function () {
        root.classList.remove('theme-animating');
    }, THEME_ANIM_MS);
});

/** 给宿主页面发消息（没被嵌入时是空操作） */
function postToHost(type, payload) {
    if (!OCR_EMBEDDED) return;
    try {
        var msg = { type: type };
        if (payload) for (var k in payload) msg[k] = payload[k];
        window.parent.postMessage(msg, window.location.origin === 'null' ? '*' : window.location.origin);
    } catch (e) { }
}

function getCurrentTheme() {
    return document.documentElement.dataset.theme || 'light';
}

function updateThemeButton() {
    var t = getCurrentTheme();
    document.querySelectorAll('.theme-toggle').forEach(function (el) {
        el.textContent = t === 'dark' ? '\u2600\uFE0F \u6D45\u8272' : '\uD83C\uDF19 \u6DF1\u8272';
        el.setAttribute('data-theme-label', t);
    });
}

function toggleTheme() {
    var root = document.documentElement;
    var next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { }
    updateThemeButton();

    /* 2026-10-09 性能修复：过渡只在切换进行中的这 260ms 内存在
       （.theme-animating 同时让 css 临时关掉毛玻璃，见 css/theme.css）。 */
    root.classList.add('theme-animating');
    clearTimeout(window.__themeAnimTimer);
    window.__themeAnimTimer = setTimeout(function () {
        root.classList.remove('theme-animating');
    }, THEME_ANIM_MS);
}

document.addEventListener('DOMContentLoaded', function () {
    updateThemeButton();
    postToHost('arcaea-ocr:ready');
});
