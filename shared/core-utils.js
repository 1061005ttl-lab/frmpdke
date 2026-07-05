/* ════════════════════════════════════════════════════════════
   core-utils.js — 業務王看板系統共用核心工具
   版本：Ver. 1.0.0 ｜ 建立：2026-07-04

   給哪些看板用：所有看板（audit / coverage / achievement / award...）
   內容：跟資料模型完全無關的最底層工具函式，其他 shared/*.js 都可能依賴這支，
        務必排在所有其他 shared script 之前載入。

   【版本紀錄】
   1.0.0  2026-07-04  首版，從 coverage_board.html Ver.3.0.0 抽出
                       esc / _rid / parseGvizDate 三支完全相同，
                       另外新增 gvizParse / gvizFetchJson 取代各板重複 5 次以上的
                       「JSON.parse(txt.replace(/^[^\(]+\(/,'')...)」樣板程式碼。
   ════════════════════════════════════════════════════════════ */

/* HTML escape，避免使用者資料（店名/人名等）內含特殊字元破壞版面 */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* 把任意字串轉成安全的 DOM id 片段（中文/英數保留，其餘轉底線，截到24字避免id過長） */
function _rid(s){ return String(s).replace(/[^\w\u4e00-\u9fff]/g,'_').substring(0,24); }

/* 解析 gviz 回傳的 Date(y,m,d,h,i,s) 格式字串 → 人類可讀（台灣時區） */
function parseGvizDate(v) {
  var m = String(v).match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
  if (!m) return String(v);
  /* gviz 回傳的 Date() 已是本地時間（瀏覽器時區），直接用 Date constructor 即可
     但為確保不同時區的瀏覽器都顯示台灣時間（UTC+8），明確指定 timeZone */
  var d = new Date(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
  return d.toLocaleString('zh-TW', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit',
    timeZone:'Asia/Taipei'
  });
}

/* gviz API 回傳的是 "google.visualization.Query.setResponse({...});" 這種 JSONP 包裝，
   每支看板都各自寫了好幾次同樣的字串處理去拆包，這裡統一成一支。 */
function gvizParse(txt){
  return JSON.parse(txt.replace(/^[^\(]+\(/, '').replace(/\);?\s*$/, ''));
}

/* 打 gviz 端點並直接回傳解析後的 JSON（Promise 版），
   使用方式：gvizFetchJson(url).then(function(json){ ... }).catch(function(err){ ... }); */
function gvizFetchJson(url){
  return fetch(url).then(function(r){ return r.text(); }).then(gvizParse);
}