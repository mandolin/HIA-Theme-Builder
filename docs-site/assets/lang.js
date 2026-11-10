// 文档子站语言切换（W-tb-P14 维护者反馈）：零依赖，body[data-docs-lang] 驱动 .zh/.en 显隐。
// 语言判定优先级：①URL ?lang=（主应用文档链接按界面语言携带，跨域/本地文件均生效）；
//   ②localStorage hia-docs-lang（站内上次选择）；③主应用 hia-locale（同源首次进入跟随首页语言）；
//   ④缺省 zh。按钮点击后写 hia-docs-lang 并即时切换。
// <lang en>Zero-dep switch: ?lang= param wins (app links carry it), then docs-local choice, then the
//   app's hia-locale (same-origin first visit follows the app), default zh. Button persists choice.</lang>
(function () {
  var KEY = 'hia-docs-lang';
  // detect：按优先级判定初始语言。
  function detect() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'zh') return q;
      var own = localStorage.getItem(KEY);
      if (own === 'en' || own === 'zh') return own;
      var app = localStorage.getItem('hia-locale');
      if (app === 'en') return 'en';
    } catch (e) { /* 隐私模式/本地文件忽略 */ }
    return 'zh';
  }
  // apply：应用语言到根属性并同步按钮文案与 <html lang>。
  function apply(lang) {
    document.documentElement.setAttribute('data-docs-lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    var btn = document.getElementById('docLangBtn');
    if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中文';
    try { localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ }
  }
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('docLangBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-docs-lang') === 'en' ? 'en' : 'zh';
        apply(cur === 'zh' ? 'en' : 'zh');
      });
    }
    apply(detect());
  });
})();
