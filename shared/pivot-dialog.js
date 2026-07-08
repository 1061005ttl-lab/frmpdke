/* ════════════════════════════════════════════════════════════
   pivot-dialog.js — 彙整看板 Pivot Dialog 的分頁／滑動框架
   版本：Ver. 1.1.0 ｜ 建立：2026-07-05
   依賴：無（呼叫端需自備 DOM：#summary-dialog / #sum-title /
             #pivot-slides / #pivot-slide-{mode} / .pivot-tab）
   軟依賴：shared/photo-viewer.js 的 _isPhotoLightboxOpen()（有載入才會生效，
             沒載入的看板不受影響，Escape 行為退回原本「直接關 Dialog」）

   給哪些看板用：所有有「彙整看板」多分頁橫向滑動 dialog 的看板
   （目前 coverage 4 分頁：人員/單位/店家/照片牆，audit 4 分頁：
   人員/單位/分類/店家）。

   【這支檔案管的範圍——只管「切頁」跟「開關 dialog」的機械動作】
   各分頁裡面要渲染什麼內容（人員視角的統計表長怎樣、店家視角要不要
   放拜訪明細展開）完全是各板的業務邏輯，這支不管、也不該管——
   coverage 的 _buildStaffPivot 跟 audit 的 _buildStaffPivot 雖然
   函式名稱一樣，內部算的東西完全不同（一個是 B/C 桶家數統計，一個是
   分類/子分類的時間軸彙總），硬要共用會被迫在裡面塞 if(isAudit)，
   這正是一開始討論時說好要避免的事。

   【對外介面 — 呼叫端使用方式】
   各板載入時，先宣告好自己的分頁設定（沿用原本各板既有的變數名稱，
   這支檔案直接讀這三個全域變數，不用額外包一層 config 物件）：
     var _pivotMode      = 'staff';                 // 目前分頁
     var _pivotTabIndex  = { staff:0, office:1, ... };// 分頁對應的滑動索引
     var PIVOT_TITLES    = { staff:'人員視角', ... };  // dialog 標題文字

   然後在板專屬程式碼裡實作一支 _renderPivotSlide(mode)，
   負責把該 mode 的內容渲染進 #pivot-slide-{mode}（這支維持在各板，
   因為內容完全是業務邏輯）。

   共用層提供：
     openSummaryDialog(mode, getRowsFn)
       getRowsFn() 由呼叫端提供，回傳這次要彙整的 rows 陣列
       （coverage 是 applyGradeFilter(getCurrentRows())，
        audit 是自己的篩選邏輯）。開啟後會把結果存進全域 _pivotRows，
        呼叫 _renderPivotSlide 渲染所有分頁，並定位到指定 mode。
     closeSummaryDialog()
     switchPivotTab(mode, tabEl)
     _setPivotSlide(mode, animate)

   分頁數量 _pivotTabCount 不用另外宣告，這支會自動用
   Object.keys(_pivotTabIndex).length 算出來，避免板兩邊各自維護一個
   數字、改分頁數時忘記同步更新其中一處。

   【版本紀錄】
   1.1.0  2026-07-08  Escape 監聽器加上燈箱狀態判斷：照片牆/店家明細裡的
                       燈箱開著時按 Escape，原本會把燈箱跟彙整看板 Dialog
                       一起關掉（使用者要看下一張照片誤按 Esc，結果整個
                       彙整看板都不見了），現在會先讓燈箱自己關，Dialog
                       維持開著。
   1.0.0  2026-07-05  首版，從 coverage_board.html 抽出，
                       _pivotTabCount 從「各板手動寫死的數字」改成
                       自動從 _pivotTabIndex 算出，讓分頁數一般化成 N
   ════════════════════════════════════════════════════════════ */

var _pivotRows = [];

function _pivotTabCount(){
  return Object.keys(window._pivotTabIndex || {}).length || 1;
}

/* getRowsFn: () => rows[]，由呼叫端決定這次彙整要用哪些資料
   （篩選條件、目前 drill 範圍等都是板專屬邏輯，這裡不碰） */
function openSummaryDialog(mode, getRowsFn){
  window._pivotMode = mode || Object.keys(window._pivotTabIndex || {})[0];
  _pivotRows = getRowsFn ? (getRowsFn() || []) : [];

  var titleEl = document.getElementById('sum-title');
  if(titleEl) titleEl.textContent = '彙整看板 ─ ' + ((window.PIVOT_TITLES||{})[window._pivotMode] || '');

  document.querySelectorAll('.pivot-tab').forEach(function(t, i){
    t.classList.toggle('active', i === (window._pivotTabIndex||{})[window._pivotMode]);
  });

  /* 逐一渲染每個分頁——_renderPivotSlide 是各板自己實作的業務邏輯 */
  Object.keys(window._pivotTabIndex || {}).forEach(function(m){
    if(typeof _renderPivotSlide === 'function') _renderPivotSlide(m);
  });
  _setPivotSlide(window._pivotMode, false);

  var dlg = document.getElementById('summary-dialog');
  if(!dlg) return;
  dlg.style.display = 'flex';
  setTimeout(function(){ dlg.classList.add('open'); }, 10);
}

function closeSummaryDialog(){
  var dlg = document.getElementById('summary-dialog');
  if(!dlg) return;
  dlg.classList.remove('open');
  setTimeout(function(){ dlg.style.display = 'none'; }, 220);
}

function switchPivotTab(mode, tabEl){
  window._pivotMode = mode;
  document.querySelectorAll('.pivot-tab').forEach(function(t){ t.classList.remove('active'); });
  if(tabEl) tabEl.classList.add('active');
  var titleEl = document.getElementById('sum-title');
  if(titleEl) titleEl.textContent = '彙整看板 ─ ' + ((window.PIVOT_TITLES||{})[mode] || '');
  _setPivotSlide(mode, true);
}

function _setPivotSlide(mode, animate){
  var idx = (window._pivotTabIndex||{})[mode] || 0;
  var slides = document.getElementById('pivot-slides');
  if(!slides) return;
  var count = _pivotTabCount();
  if(!animate) slides.style.transition = 'none';
  slides.style.transform = 'translateX(-' + (idx * 100/count) + '%)';
  if(!animate) setTimeout(function(){ slides.style.transition = ''; }, 30);
}

/* 燈箱開著時按 Escape，應該只關燈箱、不要連彙整看板 Dialog 一起關掉。
   _isPhotoLightboxOpen() 來自 shared/photo-viewer.js（查詢燈箱目前是否顯示），
   這裡用「查詢狀態」而不是靠 stopPropagation，因為燈箱的 keydown 監聽器是
   開燈箱當下才動態掛上去的，比這支在頁面載入時就掛好的監聽器晚註冊，事件
   一定會先跑到這裡——只有主動查詢燈箱狀態才能保證不管註冊順序都正確。 */
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  if(typeof _isPhotoLightboxOpen === 'function' && _isPhotoLightboxOpen()) return;
  closeSummaryDialog();
});
