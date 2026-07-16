/* ════════════════════════════════════════════════════════════
   core-utils.js — 業務王看板系統共用核心工具
   版本：Ver. 1.0.5 ｜ 建立：2026-07-04

   給哪些看板用：所有看板（audit / coverage / achievement / award...）
   內容：跟資料模型完全無關的最底層工具函式，其他 shared/*.js 都可能依賴這支，
        務必排在所有其他 shared script 之前載入。

   【版本紀錄】
   1.0.5  2026-07-16  修正 1.0.4 的第三層 fallback 誤判「店家代碼」為時間值：
                       實測發現「1505-2-0121」這種「4碼-1~2碼-1~2碼」格式的
                       店家代碼，會被舊版寬鬆的日期正則（同時接受「/」「-」
                       分隔、且不要求比對到字串結尾）誤判成日期，前半段
                       「1505-2-01」就滿足條件被直接當成時間值抓走，而且
                       店家代碼在 base 物件裡常排在真正時間欄位前面，一命中
                       就直接回傳，真正的時間欄位反而沒機會被看到。改成只認
                       「/」分隔（gviz 轉出的日期格式固定用「/」，店家代碼固定
                       用「-」，兩者本來就分得開），並拆出獨立的
                       _looksLikeTimeValue(s) 一併檢查年份 1990~2099、月份
                       1~12、日期 1~31 是否合理，日期數字後面也不能再接數字
                       （避免比對到更長數字序列的前半段）。
   1.0.4  2026-07-16  修正「明明資料有值，畫面卻一直顯示未知時間」的問題：
                       A) _findTimeText 常見欄名清單擴充（新增 提交時間／
                          回覆時間／訪視時間／執行時間／完成時間／上傳時間／
                          登記時間／時間戳記／時間戳／日期時間），關鍵字掃描
                          也加上「時刻」「時戳」，涵蓋更多問卷實際會取的欄名。
                       B) 新增第三層 fallback：欄名關鍵字全部對不上時，改成
                          直接看「值本身長不長得像日期/時間」（開頭是
                          YYYY/M/D 或 YYYY-MM-DD，或含「上午/下午」＋時:分），
                          cellVal() 對 gviz Date 型別欄位本來就會轉成這種
                          格式，就算欄位被取一個完全猜不到的名字（例如
                          「時戳」「Timestamp」），只要值長得像日期時間，
                          還是能正確抓到，不會整個顯示成「未知時間」。
   1.0.3  2026-07-08  新增 _findTimeText／_dateOnly 兩支共用小工具：
                       A) _findTimeText(base)：coverage_board.html 裡「店家拜訪
                          時間軸」「照片牆」「逐題彙整」三處都各自寫死
                          base['打卡時間']||base['回報時間']||base['月份']，
                          只要問卷分頁欄名跟這三個字完全不一樣（哪怕只是多一個
                          空格、全形字、或欄位其實叫「拜訪時間」），就會直接
                          抓空、永遠顯示「未知時間」，而且三處是各自複製貼上、
                          修一處不會連動另外兩處。統一成這支之後：先照優先序
                          比對常見欄名，比對不到再退而求其次，掃描 base 底下
                          所有欄名，只要欄名裡有「時間」或「日期」或「月份」
                          字樣且該欄有值就採用——不要求欄名完全相同，才不會
                          再被問卷欄位命名的細微差異卡住。
                       B) _dateOnly(str)：只取日期部份（YYYY/MM/DD），時分秒
                          一律捨棄，給「只想看日期、不需要看到時分秒」的畫面
                          （目前是 photo-store-meta）用；抓不到日期格式就照
                          原字串顯示，不會讓資料整個消失不見。
   1.0.2  2026-07-08  parseGvizDate 再加強（實測 "Date(2026,6,3)" 已可
                       正確解析成 2026/07/03，見下方測試備註）：
                       A) 呼叫前先 String(v).trim()，清掉頭尾不可見空白
                          （全形空白／\u00A0 等複製貼上常見雜訊），避免
                          極端情況下影響比對。
                       B) 秒數後面允許多一組「毫秒」數字（部分環境的
                          gviz 回應會多帶第 7 個數字），原本 regex 只認到
                          第 6 個數字為止，後面若還有逗號＋數字，會導致
                          整串 Date(...) 比對失敗、直接原樣印出。毫秒抓到
                          但不使用（畫面仍只顯示到秒）。
                       【重要】若畫面仍顯示未解析的原始字串 "Date(...)"，
                       代表瀏覽器當下載入的 shared/core-utils.js 不是這個
                       版本，通常是快取或部署資料夾沒更新到，不是本檔邏輯
                       問題（用 Node 直接測試 parseGvizDate('Date(2026,6,3)')
                       已確認回傳 '2026/07/03'）。排查順序：
                       1) 瀏覽器強制重新整理（Ctrl/Cmd+Shift+R）；
                       2) 「檢視原始碼」開 shared/core-utils.js 確認檔頭
                          版本號確實是 1.0.2；
                       3) 確認部署的 shared/ 資料夾裡沒有同名但內容不同的
                          舊檔案殘留。
   1.0.1  2026-07-08  parseGvizDate 修正：改成可接受 Date(y,m,d) 純日期
                       格式（不再強制要求 6 個數字才算合法），修好
                       contract_board「上次回報」「拜訪／登記時間軸」
                       顯示成原始字串 "Date(2026,6,3)" 沒被解析的問題。
                       純日期不補時分秒文字；有時分秒的欄位行為不變。
   1.0.0  2026-07-04  首版，從 coverage_board.html Ver.3.0.0 抽出
                       esc / _rid / parseGvizDate 三支完全相同，
                       另外新增 gvizParse / gvizFetchJson 取代各板重複 5 次以上的
                       「JSON.parse(txt.replace(/^[^\(]+\(/,'')...)」樣板程式碼。
   ════════════════════════════════════════════════════════════ */

/* HTML escape，避免使用者資料（店名/人名等）內含特殊字元破壞版面 */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* 把任意字串轉成安全的 DOM id 片段（中文/英數保留，其餘轉底線，截到24字避免id過長） */
function _rid(s){ return String(s).replace(/[^\w\u4e00-\u9fff]/g,'_').substring(0,24); }

/* 解析 gviz 回傳的 Date(...) 格式字串 → 人類可讀（台灣時區）
   gviz 依 Sheet 欄位格式不同，實際回傳兩種長相：
     - 該欄是「日期」格式：Date(y,m,d)          ← 只有 3 個數字，沒有時分秒
     - 該欄是「日期時間」格式：Date(y,m,d,h,i,s) ← 完整 6 個數字
   舊版正規式寫死要求 6 個數字，遇到純日期欄位（只有3個數字）會整個
   match 失敗、直接把原始字串 "Date(2026,6,3)" 原封不動吐回去顯示在
   畫面上（contract_board 的「上次回報」「拜訪／登記時間軸」都踩到這個
   坑）。後3個時分秒改成可省略，省略時視為純日期，不補時間文字。 */
function parseGvizDate(v) {
  var s = String(v).trim();
  /* 秒數後面的毫秒群組 (?:,\d+)? 允許有可以沒有，抓到但不使用，
     避免部分環境多帶第 7 個數字時讓整個 Date(...) 比對失敗 */
  var m = s.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+)(?:,\d+)?)?\)/);
  if (!m) return s;
  var y = +m[1], mo = +m[2], day = +m[3];
  var hasTime = m[4] !== undefined;
  var pad = function(n){ return String(n).padStart(2,'0'); };
  if (!hasTime) {
    /* 純日期沒有時間資訊，直接用年月日組字串即可，不需要經過
       Date 物件＋時區換算（省得反而因瀏覽器時區不同產生跨日誤差） */
    return y + '/' + pad(mo+1) + '/' + pad(day);
  }
  /* gviz 回傳的 Date() 已是本地時間（瀏覽器時區），直接用 Date constructor 即可
     但為確保不同時區的瀏覽器都顯示台灣時間（UTC+8），明確指定 timeZone */
  var d = new Date(y, mo, day, +m[4], +m[5], +m[6]);
  return d.toLocaleString('zh-TW', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit',
    timeZone:'Asia/Taipei'
  });
}

/* 從一筆「標準化 base 物件」（gviz 問卷資料列，key 是欄位名稱）裡找出時間值。
   不要求欄名完全等於某個寫死的字串——先照優先序試常見欄名，都沒有再退而求其次，
   掃描所有欄名，只要欄名含「時間／日期／月份」等關鍵字且該欄有值就採用；如果
   連欄名都對不上（例如欄位被取成「時戳」「Timestamp」這類不含這幾個字的名稱），
   最後改成直接看「值本身長不長得像日期/時間」──cellVal() 對 gviz 的 Date 型別
   儲存格，本來就會轉成「2026/7/15 下午 9:05:19」這種台灣慣用格式（或
   2026/7/15、2026-07-15 這種純日期），這個格式本身就很獨特，不太可能跟其他
   一般文字欄位搞混，就算欄名完全猜不到也還是能正確抓到值，不會整個顯示成
   「未知時間」。
   這是 coverage_board.html 三個地方（店家拜訪時間軸／照片牆／逐題彙整）共用的
   唯一時間欄位判斷邏輯，改這裡三處會一起生效，不要在各板各自重寫一份判斷。 */
function _findTimeText(base){
  base = base || {};
  var exact = ['打卡時間','回報時間','拜訪時間','填寫時間','提交時間','回覆時間',
               '訪視時間','執行時間','完成時間','上傳時間','登記時間','時間戳記',
               '時間戳','日期時間','月份','日期'];
  for (var i=0;i<exact.length;i++){
    var v = base[exact[i]];
    if(v!==undefined && v!==null && String(v).trim()!=='') return String(v).trim();
  }
  var keys = Object.keys(base);
  for (var j=0;j<keys.length;j++){
    var k = keys[j];
    if(/時間|日期|月份|時刻|時戳/.test(k)){
      var v2 = base[k];
      if(v2!==undefined && v2!==null && String(v2).trim()!=='') return String(v2).trim();
    }
  }
  /* 欄名關鍵字都對不上時的最後防線：直接看值本身格式。
     【1.0.5 修正】舊版寫成「YYYY/M/D 或 YYYY-MM-DD 皆可、且不要求比對到字串
     結尾」，結果店家代碼「1505-2-0121」這種「4碼-1~2碼-1~2碼」的格式，前半段
     「1505-2-01」就已經滿足條件，被當成日期誤抓走（而且店家代碼在 base 物件
     key 順序上常排在真正時間欄位前面，一命中就直接回傳，真正的時間欄位
     反而沒機會被看到）。
     時間值跟店家代碼在格式上其實有清楚差異可以分辨：
       - cellVal() 對 gviz Date 型別欄位轉出來的格式一律用「/」分隔
         （見 parseGvizDate／_dateOnly），例如 2026/7/15、2026/7/15 下午 9:05:19
       - 店家代碼、其他業務代碼一律用「-」分隔，例如 1505-2-0121
     所以只認「/」分隔，不再接受「-」分隔；另外要求年份落在合理範圍
     （1990~2099）、月份 1~12、日期 1~31，且日期數字後面不能再接數字
     （避免比對到更長數字序列的前半段），多一層防呆。 */
  for (var n=0;n<keys.length;n++){
    var v3 = base[keys[n]];
    var s3 = (v3===undefined||v3===null) ? '' : String(v3).trim();
    if(s3 && _looksLikeTimeValue(s3)) return s3;
  }
  return '';
}

/* 判斷一個字串「值本身長不長得像日期/時間」，只給 _findTimeText 第三層
   fallback 用。刻意只認「/」分隔（gviz 轉出的日期格式固定用「/」），不接受
   「-」分隔，避免跟「1505-2-0121」這種「-」分隔的店家代碼／業務代碼搞混。 */
function _looksLikeTimeValue(s){
  var m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?!\d)/);
  if(m){
    var y=+m[1], mo=+m[2], d=+m[3];
    return y>=1990 && y<=2099 && mo>=1 && mo<=12 && d>=1 && d<=31;
  }
  return /(上午|下午)\s*\d{1,2}:\d{2}/.test(s);
}

/* 只取日期部份（YYYY/MM/DD），時分秒一律捨棄；抓不到日期格式（例如本來就是
   純文字備註）就照原字串顯示，不會讓資料整個消失。給「只需要看日期、不需要
   看到時分秒」的畫面用（例如 photo-store-meta），跟 _findTimeText 是分開兩件事——
   _findTimeText 負責「找得到值」，_dateOnly 負責「顯示格式要多精簡」。 */
function _dateOnly(str){
  var s = String(str||'').trim();
  if(!s) return s;
  var m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(!m) return s;
  var pad = function(n){ return String(n).padStart(2,'0'); };
  return m[1]+'/'+pad(m[2])+'/'+pad(m[3]);
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
