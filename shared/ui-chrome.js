/* ════════════════════════════════════════════════════════════
   ui-chrome.js — 漢堡選單／Tooltip 綁定／sticky 堆疊高度共用工具
   版本：Ver. 1.0.0 ｜ 建立：2026-07-05
   依賴：無

   給哪些看板用：所有看板。目前實際會用到全部三塊的是 coverage_board；
   audit_board 目前沒有漢堡選單（toolbar 沒做手機收合），但 tooltip 綁定
   跟 sticky top 兩塊完全用得到，接上即可，不用連漢堡選單一起加。

   【核心設計，改動前務必先讀完】
   coverage 跟 audit 的 sticky 堆疊「疊的東西不一樣」：
     coverage：toolbar → lamp-row（燈號列）→ quicknav
     audit   ：toolbar → timenav（期間導覽列）→ quicknav
   audit 根本沒有 lamp-row 這個元素，如果把 id 寫死在共用層裡，
   audit 接上來就會整層抓空、版面全塌。
   所以這裡故意不認任何特定 id，只認各板自己宣告的
   window._STICKY_IDS = ['lamp-row','quicknav']（coverage）
   window._STICKY_IDS = ['timenav','quicknav']（audit）
   陣列順序就是由上而下的疊放順序，toolbar 永遠是最上層、不用列進去。
   以後 award_board/achievement_board 要接，只要照這個約定宣告一行即可，
   不需要改這支檔案。

   bindTooltip() 的上下翻轉判斷（stickyH）也是吃同一份 _STICKY_IDS，
   跟 updateStickyTops() 共用同一套「目前疊了多高」的計算邏輯
   （_stickyStackHeight()），這兩支以前在 coverage/audit 里各自把
   stickyH 算式手動疊加一次，這裡合併成一支，好處是以後疊放結構改了
   （例如 audit 想加一條篩選列），只要改 _STICKY_IDS 宣告，不用同時
   改 updateStickyTops 跟 bindTooltip 兩處。

   【對外介面】
   updateStickyTops()                 依 window._STICKY_IDS 動態設定 top
   toggleMobileMenu(e) / closeMobileMenu()
                                       漢堡選單開合（需要 DOM 有
                                       #toolbar-controls / #hamburger-btn）
   bindTooltip(triggerEl, ttEl, card)  桌機 hover／手機長按顯示 tooltip，
                                       含左右溢出防呆跟上下翻轉判斷

   【版本紀錄】
   1.0.0  2026-07-05  首版，從 coverage_board.html 抽出並把 sticky id
                       清單一般化，讓 audit_board（timenav 而非 lamp-row）
                       能共用同一套邏輯而不必各自維護一份
   ════════════════════════════════════════════════════════════ */

/* 各板載入時自行宣告，例如：
     coverage_board.html:  window._STICKY_IDS = ['lamp-row','quicknav'];
     audit_board.html:     window._STICKY_IDS = ['timenav','quicknav'];
   沒宣告就當只有 toolbar 一層，不會報錯，只是 sticky 堆疊只算 toolbar 高度。 */
window._STICKY_IDS = window._STICKY_IDS || [];

/* 目前「疊了多高」——updateStickyTops 跟 bindTooltip 共用同一份計算，
   避免兩處各自手動加總、改一邊忘了改另一邊 */
function _stickyStackHeight(){
  var toolbar = document.querySelector('.toolbar');
  var h = toolbar ? toolbar.offsetHeight : 52;
  (window._STICKY_IDS || []).forEach(function(id){
    var el = document.getElementById(id);
    if(el && el.style.display !== 'none') h += el.offsetHeight;
  });
  return h;
}

/* sticky 層疊 top 值：toolbar → _STICKY_IDS[0] → _STICKY_IDS[1] → ...
   每層緊接上一層，render/resize 後呼叫一次即可 */
function updateStickyTops(){
  var toolbar = document.querySelector('.toolbar');
  var top = toolbar ? toolbar.offsetHeight : 52;
  (window._STICKY_IDS || []).forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.style.top = top + 'px';
    if(el.style.display !== 'none') top += el.offsetHeight;
  });
}
window.addEventListener('resize', updateStickyTops);

/* ── 手機漢堡選單 ──
   需要 DOM 上有 #toolbar-controls（收納面板）跟 #hamburger-btn（按鈕），
   沒有這兩個 id 的板（目前是 audit）就是單純不呼叫這兩支，不影響其他功能。 */
function toggleMobileMenu(e){
  if(e) e.stopPropagation();
  var panel = document.getElementById('toolbar-controls');
  var btn = document.getElementById('hamburger-btn');
  if(!panel) return;
  var willOpen = !panel.classList.contains('open');
  panel.classList.toggle('open', willOpen);
  if(btn) btn.classList.toggle('active', willOpen);
}
function closeMobileMenu(){
  var panel = document.getElementById('toolbar-controls');
  var btn = document.getElementById('hamburger-btn');
  if(!panel) return;
  panel.classList.remove('open');
  if(btn) btn.classList.remove('active');
}
document.addEventListener('click', function(e){
  var panel = document.getElementById('toolbar-controls');
  var btn = document.getElementById('hamburger-btn');
  if(!panel || !panel.classList.contains('open')) return;
  if(panel.contains(e.target) || (btn && btn.contains(e.target))) return;
  closeMobileMenu();
});

/* ── Tooltip 綁定 ──
   triggerEl：滑鼠/手指觸發的元素；ttEl：.tooltip 內容元素；
   card：用來量測目前卡片位置以決定要不要往上翻轉的參考元素。
   桌機 hover 顯示，手機長按 480ms 觸發（跟單純點擊區分，
   長按放開後用 window._lastLongPress 時間戳讓呼叫端攔截 click 事件，
   避免長按看完 tooltip 放開手指後又觸發下一層鑽層——這個攔截邏輯
   在各板的 click handler 自己做，這裡只負責蓋時間戳）。 */
function bindTooltip(triggerEl, ttEl, card){
  function positionTooltip(){
    var cardRect = card.getBoundingClientRect();
    var stickyH = _stickyStackHeight() + 20;
    ttEl.classList.toggle('flip', cardRect.top < stickyH + 120);
    ttEl.style.left = '';
    ttEl.style.right = '';
    ttEl.style.transform = '';
    var ttRect = ttEl.getBoundingClientRect();
    var vw = window.innerWidth;
    if(ttRect.right > vw - 8){
      ttEl.style.left = 'auto'; ttEl.style.right = '0'; ttEl.style.transform = 'none';
    } else if(ttRect.left < 8){
      ttEl.style.left = '0'; ttEl.style.transform = 'none';
    }
  }
  triggerEl.addEventListener('mouseenter', function(e){
    e.stopPropagation(); ttEl.classList.add('show'); positionTooltip();
  });
  triggerEl.addEventListener('mouseleave', function(){
    ttEl.classList.remove('show'); ttEl.classList.remove('flip');
  });
  var _pressTimer = null;
  triggerEl.addEventListener('touchstart', function(){
    _pressTimer = setTimeout(function(){
      window._lastLongPress = Date.now();
      document.querySelectorAll('.tooltip.show').forEach(function(el){ el.classList.remove('show'); });
      ttEl.classList.add('show'); positionTooltip();
      function dismissOnce(ev){
        if(!ttEl.contains(ev.target)){ ttEl.classList.remove('show'); document.removeEventListener('touchstart', dismissOnce); }
      }
      setTimeout(function(){ document.addEventListener('touchstart', dismissOnce); }, 50);
    }, 480);
  }, {passive:true});
  triggerEl.addEventListener('touchend', function(){ clearTimeout(_pressTimer); });
  triggerEl.addEventListener('touchmove', function(){ clearTimeout(_pressTimer); }, {passive:true});
}
