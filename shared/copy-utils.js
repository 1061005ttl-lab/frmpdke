/* ════════════════════════════════════════════════════════════
   copy-utils.js — 文字複製到剪貼簿共用工具
   版本：Ver. 1.0.0 ｜ 建立：2026-07-04
   依賴：無（core-utils.js 不是必要依賴，但慣例上排在它後面載入）

   給哪些看板用：所有有「複製 LINE 文字」「複製摘要」之類按鈕的看板。
   內容：純文字複製到剪貼簿的機制，跟截圖（capture-clipboard.js）是分開的兩件事，
        不要合併——文字複製用 writeText，圖片複製用 write([ClipboardItem])，
        API 完全不同。

   【版本紀錄】
   1.0.0  2026-07-04  首版，從 coverage_board.html Ver.3.0.0 抽出，三支函式完全相同
   ════════════════════════════════════════════════════════════ */

/* 按鈕上短暫顯示成功提示文字，2 秒後恢復原文字 */
function _flashBtn(btn,label){
  if(!btn) return;
  /* 用 innerHTML 讀取／還原，而不是 textContent——按鈕內部常是
     <span>圖示</span><span class="btn-txt">文字</span> 兩層結構（手機版靠
     CSS 把 .btn-txt 藏起來，只留圖示），textContent 會把這個結構打平成
     純文字，永久破壞手機版「只顯示圖示」的效果。用 innerHTML 才能完整
     保留／還原原本的標籤結構，純文字按鈕也不受影響。 */
  var orig=btn.innerHTML; btn.innerHTML=label; btn.classList.add('done');
  setTimeout(function(){ btn.innerHTML=orig; btn.classList.remove('done'); },2000);
}

/* Clipboard API 不可用時的備援：隱形 textarea + execCommand('copy') */
function fallbackCopy(text){
  var ta=document.createElement('textarea'); ta.value=text;
  ta.style.cssText='position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try{ document.execCommand('copy'); }catch(e){} document.body.removeChild(ta);
}

/* 複製純文字到剪貼簿，成功/備援都會 flash 按鈕提示 */
function _doCopy(text,btn){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ _flashBtn(btn,'✅ 已複製！'); })
      .catch(function(){ fallbackCopy(text); _flashBtn(btn,'✅ 已複製！'); });
  } else { fallbackCopy(text); _flashBtn(btn,'✅ 已複製！'); }
}