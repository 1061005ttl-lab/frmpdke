/* ════════════════════════════════════════════════════════════
   capture-clipboard.js — 截圖直接複製到剪貼簿共用機制
   版本：Ver. 1.0.0 ｜ 建立：2026-07-04
   依賴：copy-utils.js（用到 _flashBtn）

   給哪些看板用：所有有「📸 截圖」按鈕的看板。

   【核心設計，改動前務必先讀完，這裡踩過的坑很貴】
   1. ClipboardItem 可以吃「還沒解析完成的 Promise」當內容值。只要
      navigator.clipboard.write() 這個呼叫本身是在使用者點擊的同一個事件
      處理常式裡「同步」呼叫（不等 html2canvas 跑完才呼叫），瀏覽器就仍然
      認得這是一次合法的使用者操作觸發的寫入，不會因為 html2canvas 需要
      運算時間就悄悄失敗、退回下載。這是「截圖=直接進剪貼簿、不要下載」
      這個需求唯一可靠的做法，不要為了「簡化」拿掉這個 Promise 寫法。
   2. canvas 尺寸有安全上限（_safeCanvasScale）。曾經真實發生過的 bug：
      螢幕截整份未篩選的巨大清單（上千列）時，scale:2 算出來的 canvas
      尺寸超過瀏覽器上限，html2canvas 靜默失敗、退回下載，表面上看起來
      像「剪貼簿失敗」，其實是圖片根本做不出來。_safeCanvasScale 沒有
      人為下限（只有防止 0/負值的極低地板 0.05），內容多高就該縮多小，
      唯一目的是保證絕對不超過上限——不要為了「畫質」加大這個下限，
      寧可縮圖也不要讓截圖整個失敗。
   3. canvasPromise 只建立一次，剪貼簿成功／失敗退回下載都共用同一份結果，
      不要為了程式碼「看起來獨立」而把 html2canvas 呼叫寫兩次，會讓大表格
      截圖多花一倍時間。

   【對外介面】
   _captureElement(el, btn, filename)
     最常用：把某個 DOM 元素整個截圖複製到剪貼簿。
   _clipboardFirstCapture(buildCanvasFn, btn, filename)
     進階版：buildCanvasFn 是 () => Promise<canvas>，自己決定怎麼產生 canvas
     （例如 audit/achievement 可能要先拼一個臨時 wrapper 再截，用這支）。
   _safeCanvasScale(width, height, desiredScale)
     單獨算安全縮放倍率，board 端自己組 html2canvas 參數時也可以直接呼叫。

   【版本紀錄】
   1.0.0  2026-07-04  首版，從 coverage_board.html Ver.3.0.0 抽出（含安全scale修正）
   ════════════════════════════════════════════════════════════ */

var _html2canvasLoading = null;
function _ensureHtml2Canvas(){
  if(window.html2canvas) return Promise.resolve();
  if(_html2canvasLoading) return _html2canvasLoading;
  _html2canvasLoading = new Promise(function(resolve, reject){
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload=function(){ resolve(); };
    s.onerror=function(){ _html2canvasLoading=null; reject(new Error('html2canvas 載入失敗')); };
    document.head.appendChild(s);
  });
  return _html2canvasLoading;
}

/* 依內容實際尺寸動態調整 scale，避免超大內容乘以 scale 後超過瀏覽器 canvas 尺寸上限。
   14000px 是跨瀏覽器/裝置都安全的保守值（Chrome 實際上限更高，但手機瀏覽器普遍較低）。 */
function _safeCanvasScale(width, height, desiredScale){
  var maxDim = 14000;
  var scale = desiredScale || 2;
  var w = width * scale, h = height * scale;
  if (w > maxDim || h > maxDim) {
    scale = Math.max(0.05, Math.min(maxDim / width, maxDim / height));
  }
  return scale;
}

/* buildCanvasFn: () => Promise<canvas>，呼叫時 html2canvas 保證已就緒
   opts.loadingHtml：截圖中要顯示的按鈕內容，預設是純文字「⏳ 截圖中...」。
   純圖示按鈕（例如按鈕裡只有一個表情符號、沒有文字）可以傳
   opts.loadingHtml='<span>⏳</span>'，不需要為了圖示按鈕另外寫一整套截圖函式——
   統一用 innerHTML 存取／還原按鈕內容，不管原本是純文字還是圖示，
   都能正確存下「原本長怎樣」再還原回去，不用把還原內容寫死在函式裡。 */
function _clipboardFirstCapture(buildCanvasFn, btn, filename, opts){
  opts = opts || {};
  var loadingHtml = opts.loadingHtml || '⏳ 截圖中...';
  var origHtml = btn ? btn.innerHTML : '';
  if(btn){ btn.classList.add('loading'); btn.innerHTML = loadingHtml; }
  function restore(){ if(btn){ btn.classList.remove('loading'); btn.innerHTML = origHtml; } }
  /* canvasPromise 只建立一次，clipboard 成功／失敗退回下載都共用同一份結果，
     不會因為重跑 html2canvas 而讓大表格screenshot多花一倍時間 */
  var canvasPromise = _ensureHtml2Canvas().then(buildCanvasFn);

  if (navigator.clipboard && window.ClipboardItem) {
    /* 立刻同步建立 ClipboardItem 並呼叫 write()，Blob 用 Promise 延後解析 */
    var blobPromise = canvasPromise.then(function(canvas){
      return new Promise(function(resolve){ canvas.toBlob(resolve, 'image/png'); });
    });
    try {
      navigator.clipboard.write([ new ClipboardItem({ 'image/png': blobPromise }) ])
        .then(function(){ restore(); _flashBtn(btn, '✅ 已複製！'); })
        .catch(function(){
          /* 真的被瀏覽器拒絕才退回下載（同一份運算結果，不重跑一次） */
          canvasPromise.then(function(canvas){ restore(); _downloadCanvas(canvas, filename, btn); })
            .catch(function(){ restore(); _flashBtn(btn, '⚠️ 截圖失敗'); });
        });
      return;
    } catch(e) { /* 落到下方 fallback */ }
  }
  canvasPromise.then(function(canvas){ restore(); _downloadCanvas(canvas, filename, btn); })
    .catch(function(){ restore(); _flashBtn(btn, '⚠️ 截圖失敗'); });
}

/* 通用元素截圖（只複製到剪貼簿），涵蓋大多數情境 */
function _captureElement(el, btn, filename, opts){
  _clipboardFirstCapture(function(){
    var scale = _safeCanvasScale(el.scrollWidth, el.scrollHeight, 2);
    return html2canvas(el, {
      scale:scale, backgroundColor:'#ffffff', useCORS:true,
      width:el.scrollWidth, height:el.scrollHeight,
      ignoreElements:function(node){ return node.getAttribute && node.getAttribute('data-screenshot-ignore')==='1'; }
    });
  }, btn, filename, opts);
}

/* 瀏覽器完全不支援 Clipboard API 時的最終備援：下載 PNG */
function _downloadCanvas(canvas,titleText,btn){
  var link=document.createElement('a');
  link.download=titleText.replace(/\s+/g,'_')+'.png';
  link.href=canvas.toDataURL('image/png'); link.click();
  if(btn){ btn.classList.remove('loading'); _flashBtn(btn,'✅ 已下載！'); }
}