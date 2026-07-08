/* ════════════════════════════════════════════════════════════
   ui-chrome.js — 看板系統共用 UI 骨架（sticky 疊層／tooltip／手機漢堡選單）
   版本：Ver. 1.1.0 ｜ 建立：2026-07-08

   ⚠️ 這支檔案上一次上傳完全缺席（8 份 shared 檔案的檔名跟內容全部錯位了
   一個位置），曾經先依 audit_board.html／contract_board.html 的呼叫方式
   重建過一版；這次比對 coverage_board.html 實際的呼叫方式後，發現重建版
   跟真正部署的行為有兩處對不上（見下方 1.1.0 changelog），已一併修正。

     - window._STICKY_IDS：sticky 元素 id 陣列，由各板在自己的 <script>
       開頭宣告（例：['timenav','quicknav'] 或 ['crumbnav','filterbar']）。
     - updateStickyTops()：讀 _STICKY_IDS，依序疊加高度設定各元素的
       style.top，讓多層 sticky bar 疊在固定 toolbar（52px）下方不互相
       蓋住。畫面重新渲染、内容高度可能改變時呼叫（例如 render() 尾端
       setTimeout(updateStickyTops,0)）。
     - _stickyStackHeight()：回傳目前整個 sticky 疊層（toolbar + 所有
       _STICKY_IDS 元素）的總高度，供 bindTooltip 判斷 tooltip 該往上
       還是往下展開時使用，跟 updateStickyTops 用同一份計算，兩處數字
       保證一致。
     - bindTooltip(triggerEl, tooltipEl, containerEl)：滑鼠 hover 或手機
       長按 triggerEl 時顯示 tooltipEl，並依 tooltipEl 相對頁面頂端的
       位置決定要不要加 .flip（貼齊 stat-item 頂端往下展開，避免被上方
       sticky bar 擋住）。
     - toggleMobileMenu(e) / closeMobileMenu()：手機版把 .toolbar-controls
       收進漢堡選單，點擊 .hamburger-btn 切換顯示/隱藏＋按鈕 active 樣式；
       各選單項目點擊後呼叫 closeMobileMenu() 收合選單。

   若這支檔案的實際行為跟你原本部署的 ui-chrome.js 有出入，請直接用你
   原本的檔案覆蓋——這裡只保證「呼叫得到、不會噴 ReferenceError、視覺上
   大致正確」，不保證跟原始實作逐行一致。

   【版本紀錄】
   1.1.0  2026-07-08  比對 coverage_board.html 實際呼叫方式後修正兩個問題：
                       A) class 名稱從 'mobile-open' 改成 'open'——
                          coverage_board.html 的 <style> 裡寫的是
                          .toolbar-controls.open，跟重建版當初猜的
                          'mobile-open' 對不上，導致手機漢堡選單「點了
                          沒反應」（JS 有切換 class，但 CSS 沒有對應規則
                          會顯示，看起來像整個按鈕沒作用，其實是兩邊 class
                          名稱沒對齊）。
                       B) 新增 closeMobileMenu()——coverage_board.html
                          裡所有選單項目（view-toggle／彙整看板／LINE／
                          CSV／截圖…）的 onclick 都會接一句
                          closeMobileMenu()，但重建版只宣告了
                          toggleMobileMenu，這支函式完全不存在，手機版
                          點任何一個選單項目都會噴 ReferenceError（前面
                          真正要做的動作通常來得及先執行，但選單不會
                          自動收合，且 console 會一直紅字）。
   1.0.0  2026-07-08（重建版）首版。
   ════════════════════════════════════════════════════════════ */

var TOOLBAR_HEIGHT = 52;

/* 依 window._STICKY_IDS 疊加設定每個 sticky 元素的 top，
   固定 toolbar 高度算第一層，之後每個元素疊加前一個的實際高度 */
function updateStickyTops(){
  var ids = window._STICKY_IDS || [];
  var top = TOOLBAR_HEIGHT;
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.style.top = top + 'px';
    /* 元素目前不可見（例如篩選收合）就不疊加高度，避免後面的 bar 留空白 */
    if(el.offsetHeight > 0) top += el.offsetHeight;
  });
}

/* 跟 updateStickyTops 用同一份邏輯，回傳目前整個 sticky 疊層總高度 */
function _stickyStackHeight(){
  var ids = window._STICKY_IDS || [];
  var total = TOOLBAR_HEIGHT;
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if(el && el.offsetHeight > 0) total += el.offsetHeight;
  });
  return total;
}

/* 綁定單一組 tooltip：桌機 hover 顯示，手機長按顯示（配合
   dashboard-common.css 的 .stat-item.tt-active .tooltip 規則）。
   containerEl 用來判斷長按時要在哪個容器上加 .tt-active。 */
function bindTooltip(triggerEl, tooltipEl, containerEl){
  if(!triggerEl || !tooltipEl) return;
  var host = containerEl || triggerEl.closest('.stat-item') || triggerEl;

  function show(){
    tooltipEl.classList.add('show');
    var rect = tooltipEl.getBoundingClientRect();
    var stackH = _stickyStackHeight();
    if(rect.top < stackH){ tooltipEl.classList.add('flip'); }
    else { tooltipEl.classList.remove('flip'); }
  }
  function hide(){ tooltipEl.classList.remove('show'); }

  triggerEl.addEventListener('mouseenter', show);
  triggerEl.addEventListener('mouseleave', hide);

  /* 手機：長按 600ms 觸發，避免跟點擊鑽層／單擊卡片衝突 */
  var pressTimer = null;
  host.addEventListener('touchstart', function(){
    pressTimer = setTimeout(function(){
      host.classList.add('tt-active');
      window._lastLongPress = Date.now();
      show();
    }, 600);
  }, {passive:true});
  host.addEventListener('touchend', function(){
    clearTimeout(pressTimer);
    setTimeout(function(){ host.classList.remove('tt-active'); hide(); }, 1500);
  });
  host.addEventListener('touchmove', function(){ clearTimeout(pressTimer); });
}

/* 手機漢堡選單：收納 .toolbar-controls，跟 .hamburger-btn 連動 active 樣式。
   class 名稱用 'open'（不是 'mobile-open'）——要跟 dashboard-common.css／
   各板 <style> 裡實際寫的 .toolbar-controls.open 規則對上，兩邊只要有一邊
   打錯字，選單就會「點了沒反應」但 console 完全不報錯，很難查。 */
function toggleMobileMenu(e){
  if(e) e.stopPropagation();
  var controls = document.getElementById('toolbar-controls');
  var btn = document.getElementById('hamburger-btn');
  if(!controls || !btn) return;
  var open = controls.classList.toggle('open');
  btn.classList.toggle('active', open);
}
/* 各板選單項目（view-toggle／彙整看板／LINE／CSV／截圖…）的 onclick 裡
   都會接一句 closeMobileMenu()，點完動作後順手收合選單——原本這支只
   宣告了 toggleMobileMenu，沒有 closeMobileMenu，導致手機版每次點選單
   項目都會噴 ReferenceError（選單也不會自動收合）。 */
function closeMobileMenu(){
  var controls = document.getElementById('toolbar-controls');
  var btn = document.getElementById('hamburger-btn');
  if(controls) controls.classList.remove('open');
  if(btn) btn.classList.remove('active');
}
document.addEventListener('click', function(e){
  var controls = document.getElementById('toolbar-controls');
  var btn = document.getElementById('hamburger-btn');
  if(!controls || !controls.classList.contains('open')) return;
  if(controls.contains(e.target) || (btn && btn.contains(e.target))) return;
  closeMobileMenu();
});

window.addEventListener('resize', function(){ updateStickyTops(); });
