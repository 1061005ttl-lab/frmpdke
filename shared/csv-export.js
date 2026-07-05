/* ════════════════════════════════════════════════════════════
   csv-export.js — CSV 下載共用工具
   版本：Ver. 1.0.0 ｜ 建立：2026-07-04
   依賴：無

   給哪些看板用：所有有「下載 CSV」按鈕的看板。
   內容：只負責「csv 字串 → 觸發瀏覽器下載」這個機械動作，
        CSV 內容本身（欄位定義、資料列組裝）跟各板資料模型綁很深，
        故意不放在這裡，留在各板自己的 buildCsvContent() 裡。

   【版本紀錄】
   1.0.0  2026-07-04  首版，從 coverage_board.html Ver.3.0.0 抽出，兩支函式完全相同
   ════════════════════════════════════════════════════════════ */

/* 檔名格式：標題_YYYYMMDD_HHMM.csv，標題內的路徑不合法字元換成底線 */
function buildCsvFilename(title) {
  var now=new Date(),p=function(n){return String(n).padStart(2,'0');};
  return (title||'export').replace(/[\\/:*?"<>|]/g,'_')+'_'+now.getFullYear()+p(now.getMonth()+1)+p(now.getDate())+'_'+p(now.getHours())+p(now.getMinutes())+'.csv';
}

/* 觸發瀏覽器下載 CSV 檔（\uFEFF BOM 要由呼叫端自己加在 csv 字串開頭，確保 Excel 開啟中文不亂碼） */
function _triggerCsvDownload(csv, title) {
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=buildCsvFilename(title);
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}