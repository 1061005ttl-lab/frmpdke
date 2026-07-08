/* ════════════════════════════════════════════════════════════
   ui-chrome.js — 看板系統共用 UI 骨架（sticky 疊層／tooltip／手機漢堡選單）
   版本：Ver. 1.0.0（重建版）｜ 建立：2026-07-08

   ⚠️ 這支檔案在這次上傳裡完全缺席（8 份 shared 檔案的檔名跟內容全部
   錯位了一個位置，實際內容比檔名少一份，缺的正好是 ui-chrome.js），
   以下是依據 audit_board.html／contract_board.html 兩邊的呼叫方式與
   dashboard-common.css 的對應樣式（.hamburger-btn／.toolbar-controls／
   .tooltip／.tt-active）重建的版本，行為以「文件描述的介面」為準：
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
     - toggleMobileMenu(e)：手機版把 .toolbar-controls 收進漢堡選單，
       點擊 .hamburger-btn 切換顯示/隱藏＋按鈕 active 樣式。

   若這支檔案的實際行為跟你原本部署的 ui-chrome.js 有出入，請直接用你
   原本的檔案覆蓋這份重建版——這裡只保證「呼叫得到、不會噴
   ReferenceError、視覺上大致正確」，不保證跟原始實作逐行一致。
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

/* 手機漢堡選單：收納 .toolbar-controls，跟 .hamburger-btn 連動 active 樣式 */
function toggleMobileMenu(e){
  if(e) e.stopPropagation();
  var controls = document.getElementById('toolbar-controls');
  var btn = document.getElementById('hamburger-btn');
  if(!controls || !btn) return;
  var open = controls.classList.toggle('mobile-open');
  btn.classList.toggle('active', open);
}
document.addEventListener('click', function(e){
  var controls = document.getElementById('toolbar-controls');
  var btn = document.getElementById('hamburger-btn');
  if(!controls || !controls.classList.contains('mobile-open')) return;
  if(controls.contains(e.target) || (btn && btn.contains(e.target))) return;
  controls.classList.remove('mobile-open');
  if(btn) btn.classList.remove('active');
});

window.addEventListener('resize', function(){ updateStickyTops(); });
