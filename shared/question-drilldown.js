/* ════════════════════════════════════════════════════════════
   question-drilldown.js — 逐題彙整（單一大題＋單一選項，全範圍集中檢視）
   版本：Ver. 1.3.0 ｜ 建立：2026-07-08
   依賴：core-utils.js（esc）、photo-viewer.js（_renderPhotoChip，因為填寫內容
        可能是照片網址，要用同一套縮圖／燈箱樣式呈現，不要另外做一套）

   給哪些看板用：所有有「彙整看板」（pivot-dialog.js）的看板，作為其中一個
   分頁（tab）掛進去，跟人員/單位/店家/照片牆並列（本次是加在 audit /
   contract / coverage 三個看板）。

   【要解決的問題】
   使用者手上的問卷，同一個大題底下可能有十幾個選項，一個專案裡又有好幾份
   不同的問卷分頁/分類。原本只能「一家店一家店點開來看」，如果想知道「所有
   業務員在『開瓶有獎(海報)可複選』這個選項底下，到底填了什麼」，得把每一
   家店的明細都點開來自己找，非常沒效率。這支解決的就是「鎖定一題、一次看
   所有人怎麼填」的彙整檢視。

   【對外介面 — 呼叫端（各板）使用方式】
   各板只需要準備好一份「標準化 entries 陣列」（下面「資料格式約定」），
   組好之後呼叫：
     el.innerHTML = _qdBuildTabHtml(entries);
   就會拿到完整的「左側選題／右側結果」介面 HTML，不需要再額外呼叫任何
   初始化函式（結果面板的空狀態已經內含在回傳的 HTML 裡）。

   entries 要怎麼組出來是各板自己的事——因為每個板抓資料的機制都不一樣
   （audit/contract 是逐店連到不同來源分頁、要非同步抓好幾份分頁；coverage
   是單一分頁、直接吃現成的 _qSheetCache 就好），所以「組 entries」這一步
   刻意留在各板自己的 _buildDrilldownTab()／_buildDrilldownEntries() 裡，
   跟照片牆一貫的作法一致（這支只管『選題→看結果』這段共用 UI，不管資料
   從哪來，這跟 photo-viewer.js 的分工原則完全一樣）。

   【資料格式約定 — entries 陣列】
     entries = [
       {
         label: '一品活蝦市府店',       // 卡片標題，通常是店名
         meta:  '北部 · 行銷課 · 鄒奇蒼-1051035', // 卡片副標題，通常是單位/人員
         timeText: '2026/07/03',       // 用來排序＋顯示，沒有就傳空字串，畫面會退回顯示「未知時間」
         category: '菸品 › 陳列查核',   // 選填，比大題再高一層的分類/來源標籤，
                                        // 沒有就不傳（或傳空字串），畫面上完全不會
                                        // 多一層、行為跟舊版一模一樣。
         sections: [ { section:'大題名稱', picks:[ {option, value}, ... ] }, ... ]
       }, ...
     ]
   sections 的形狀跟 photo-viewer.js／_fetchSourceSheet 系列既有的格式完全
   一致，各板通常可以直接把既有 rowData.sections／rec.sections 塞進來，
   不需要另外轉換。

   【為什麼要加 category 這一層】
   audit 這種一個專案裡同時有好幾種「分類/子分類」問卷的板，原本選題清單
   只依「大題」分組，不同分類但剛好大題撞名（或使用者單純看不出這一題是
   哪個分類底下的）就會被混在一起，選了之後也不知道結果是從哪個分類來的。
   category 就是用來標明「這一題來自哪裡」，加了之後：
     1) 選題清單最外層多一層分類分組（沒有 category 的板完全不受影響）；
     2) 同一個大題+選項名稱如果出現在不同分類，會被當成兩個不同的選題
        （key 裡帶 category），不會誤合併成一項、也不會互相污染筆數；
     3) 結果卡片、燈箱資訊列都會一併帶出分類名稱，讓使用者確認「出處」。

   【選題清單怎麼來】
   不是每個板自己維護一份「有哪些大題/選項」的清單，而是直接掃描傳進來的
   entries，把裡面「實際出現過、且有填值」的 (大題,選項) 組合收集起來，
   附上出現筆數——這是使用者確認過的方向：所見即所選，最貼近目前篩選範圍
   內的真實資料，不用另外去對照問卷分類清單。

   【單題鎖定，不是複選彙整】
   使用者確認過操作模式是「一次只鎖定一題看結果」，所以這裡沒有「加入比較」
   或「多題並排」的機制——如果之後要做，選題清單這段（_qdBuildIndex／
   picker 渲染）可以留著，只要把 window._qdSelectedKey 從單一字串換成陣列、
   _qdRenderResults 改成逐一渲染每個選取項目即可，不需要動資料組裝那一段。

   【版本紀錄】
   1.4.0  2026-07-16  新增選填 category 分組層（見上方「為什麼要加 category
                       這一層」）：_qdBuildIndex 的 key 從「大題+選項」改成
                       「分類+大題+選項」，_qdGroupIndex／_qdBuildTabHtml 在
                       有 category 時多渲染一層 .qd-category-group／
                       .qd-category-title；結果卡片、_renderPhotoChip 的 ctx
                       都一併帶 category。沒有 category 的呼叫端（entries 都
                       不帶這個欄位，例如 coverage）行為、畫面完全不變——
                       這是這次修改唯一要保證的事，用「index 裡有沒有任何一筆
                       category 非空」判斷要不要多渲染那層，不是看呼叫端有沒有
                       宣告這個欄位。起因是 audit_board.html 的逐題彙整把所有
                       分類/子分類的問卷結果全部拉平在一起選，使用者反映「看不
                       出這一題是哪個分類、所有題目混在一起」。
   1.3.0  2026-07-08  _qdRenderValueInfo 新增第 3 參數 ctx（{store,section}），
                       呼叫 _renderPhotoChip 時一併帶入，讓逐題彙整結果裡的
                       照片也能在燈箱資訊列顯示「店名 › 大題 › 選項」，跟
                       照片牆／店家明細的燈箱體驗一致（見 shared/photo-viewer.js
                       1.2.0）。
   1.2.0  2026-07-08  結果卡片的 photo-store-meta 改用 shared/core-utils.js 的
                       _dateOnly() 只顯示日期（YYYY/MM/DD），不再顯示到時分秒——
                       跟照片牆（coverage_board.html _buildPhotoWall）的
                       photo-store-meta 顯示規則統一。找不到值時仍顯示
                       「未知時間」（時間值本身抓不抓得到是 _findTimeText
                       負責的事，這裡只管顯示格式）。
   1.1.0  2026-07-08  結果卡片一律顯示時間（🕒），timeText 空值時退回顯示
          「未知時間」，不再整個隱藏時間欄位——避免使用者看著一筆填寫內容
          卻完全不知道是何時填的（跟 photo-viewer.js／店家明細既有頁面的
          呈現方式看齊）
   1.0.0  2026-07-08  首版
   ════════════════════════════════════════════════════════════ */

/* 目前這個分頁正在用的資料／選取狀態（跟 _pivotMode 一樣是模組層級的單一全域
   狀態——同一時間只會有一個逐題彙整分頁被使用者看著，不需要多實例並存） */
window._qdEntries = window._qdEntries || [];
window._qdSelectedKey = window._qdSelectedKey || null;

/* 掃描 entries，收集「實際出現過、且有填值」的 (分類,大題,選項) 組合，
   保留「第一次出現」的順序（通常就是問卷欄位原本的排列順序，使用者比較好對照），
   同時附上這個組合在目前範圍內總共出現幾筆，方便使用者判斷「這題填的人多不多」。
   key 刻意把 category 也編進去（category 沒有就當空字串），這樣同一個大題+
   選項名稱如果出現在不同分類底下，會被當成兩個獨立的選題，不會被誤合併、
   筆數也不會互相污染——這是加 category 分組的核心理由，不只是加個標籤而已。 */
function _qdBuildIndex(entries){
  var map = {}, order = [];
  (entries||[]).forEach(function(e){
    var cat = e.category || '';
    (e.sections||[]).forEach(function(sec){
      (sec.picks||[]).forEach(function(p){
        if(!String(p.value||'').trim()) return; /* 沒填值不列入選題清單 */
        var key = cat + '\u0002' + sec.section + '\u0001' + p.option;
        if(!map[key]){ map[key] = { category:cat, section:sec.section, option:p.option, count:0 }; order.push(key); }
        map[key].count++;
      });
    });
  });
  return order.map(function(k){ return map[k]; });
}

/* 把「編碼 key」拆回 {category, section, option} 三個欄位，跟 _qdBuildIndex
   組 key 的規則對稱，兩處改動要一起改，不要各自寫一份切割邏輯 */
function _qdParseKey(key){
  var k = String(key||'');
  var i1 = k.indexOf('\u0002');
  var category = i1===-1 ? '' : k.substring(0, i1);
  var rest = i1===-1 ? k : k.substring(i1+1);
  var i2 = rest.indexOf('\u0001');
  return { category:category, section: i2===-1?rest:rest.substring(0,i2), option: i2===-1?'':rest.substring(i2+1) };
}

/* 先依分類分組、分類底下再依大題分組，picker 要「分類 → 大題 → 選項」三層
   列出，而不是把所有選項全部拉平。沒有 category 的呼叫端全部落在同一個
   空字串分類底下，渲染那層（_qdBuildTabHtml）會偵測到「根本沒有任何非空
   category」而整個跳過分類標題，畫面跟舊版完全一樣。 */
function _qdGroupIndex(index){
  var byCat = {}, catOrder = [];
  index.forEach(function(it){
    var cat = it.category || '';
    if(!byCat[cat]){ byCat[cat] = { order:[], bySection:{} }; catOrder.push(cat); }
    var grp = byCat[cat];
    if(!grp.bySection[it.section]){ grp.bySection[it.section]=[]; grp.order.push(it.section); }
    grp.bySection[it.section].push(it);
  });
  return { catOrder:catOrder, byCat:byCat };
}

/* 產生整個逐題彙整分頁的 HTML（左側選題／右側結果），供各板 _renderPivotSlide
   直接塞進 #pivot-slide-drilldown。呼叫時會重置選取狀態（每次重新篩選/重開
   dialog，選過的題目理論上還在，但範圍內的資料可能已經不同，保守起見清空
   選取，避免使用者誤以為右側結果跟目前篩選範圍是對得上的）。 */
function _qdBuildTabHtml(entries){
  window._qdEntries = entries || [];
  window._qdSelectedKey = null;
  var index = _qdBuildIndex(window._qdEntries);
  if(!index.length){
    return '<div class="empty">目前篩選範圍內沒有偵測到任何「大題／選項」有填寫內容</div>';
  }
  var grouped = _qdGroupIndex(index);
  /* 只要 index 裡有任何一筆帶了非空 category，才多渲染分類這層；呼叫端完全
     不使用 category 欄位時（例如 coverage），這裡永遠是 false，畫面跟舊版
     一模一樣，不會平白多一層空標題 */
  var hasCategories = index.some(function(it){ return !!it.category; });
  var pickerHtml = grouped.catOrder.map(function(cat){
    var grp = grouped.byCat[cat];
    var sectionHtml = grp.order.map(function(sec){
      var rowsHtml = grp.bySection[sec].map(function(it){
        var key = (it.category||'') + '\u0002' + it.section + '\u0001' + it.option;
        var searchKey = ((it.category||'') + ' ' + it.section + ' ' + it.option).toLowerCase();
        return '<div class="qd-option-row" data-qd-key="'+esc(key)+'" data-qd-search="'+esc(searchKey)+'" onclick="_qdSelect(this)">'
          + '<span class="qd-option-name">'+esc(it.option)+'</span>'
          + '<span class="qd-option-count">'+it.count+' 筆</span>'
          + '</div>';
      }).join('');
      return '<div class="qd-section-group">'
        + '<div class="qd-section-title">📋 '+esc(sec)+'</div>'
        + rowsHtml
        + '</div>';
    }).join('');
    if(!hasCategories) return sectionHtml; /* 沒有分類資料，維持原本兩層結構 */
    return '<div class="qd-category-group">'
      + '<div class="qd-category-title">📂 '+esc(cat||'未分類')+'</div>'
      + sectionHtml
      + '</div>';
  }).join('');

  return '<div class="qd-wrap">'
    + '<div class="qd-picker">'
    +   '<input class="qd-search" type="text" placeholder="🔍 搜尋分類／大題／選項…" oninput="_qdFilterPicker(this.value)">'
    +   '<div class="qd-picker-list" id="qd-picker-list">'+pickerHtml+'</div>'
    + '</div>'
    + '<div class="qd-results" id="qd-results"><div class="qd-results-empty">👈 請先從左側選擇一個題目，查看目前範圍內所有人怎麼填</div></div>'
    + '</div>';
}

/* 搜尋框：分類/大題/選項名稱都納入比對，符合就顯示、大題底下全部選項都被濾掉時
   整個大題區塊也一併隱藏，大題全部被濾掉時分類區塊也一併隱藏，避免留下一堆
   空標題（沒有分類那層的板，qd-category-group 選擇器就是選不到東西，
   forEach 直接是空陣列，不影響原本行為） */
function _qdFilterPicker(text){
  var q = String(text||'').trim().toLowerCase();
  var list = document.getElementById('qd-picker-list');
  if(!list) return;
  list.querySelectorAll('.qd-option-row').forEach(function(row){
    var hit = !q || (row.getAttribute('data-qd-search')||'').indexOf(q) !== -1;
    row.style.display = hit ? '' : 'none';
  });
  list.querySelectorAll('.qd-section-group').forEach(function(grp){
    var anyVisible = false;
    grp.querySelectorAll('.qd-option-row').forEach(function(row){ if(row.style.display !== 'none') anyVisible = true; });
    grp.style.display = anyVisible ? '' : 'none';
  });
  list.querySelectorAll('.qd-category-group').forEach(function(grp){
    var anyVisible = false;
    grp.querySelectorAll('.qd-option-row').forEach(function(row){ if(row.style.display !== 'none') anyVisible = true; });
    grp.style.display = anyVisible ? '' : 'none';
  });
}

/* 使用者點選一個題目：標記高亮、記住選取狀態、渲染結果 */
function _qdSelect(el){
  window._qdSelectedKey = el.getAttribute('data-qd-key');
  var list = document.getElementById('qd-picker-list');
  if(list) list.querySelectorAll('.qd-option-row').forEach(function(row){ row.classList.toggle('active', row===el); });
  _qdRenderResults();
}

function _qdClearSelection(){
  window._qdSelectedKey = null;
  var list = document.getElementById('qd-picker-list');
  if(list) list.querySelectorAll('.qd-option-row').forEach(function(row){ row.classList.remove('active'); });
  _qdRenderResults();
}

/* 在某一筆 entry 裡找出「該分類、該大題、該選項」對應的那一筆 pick（找不到
   回傳 null）。category 為空字串時（呼叫端沒有用 category 分組）比對永遠
   成立，行為跟舊版一樣；category 非空時，entry.category 必須也相符才算，
   避免不同分類但剛好大題+選項同名時互相污染彼此的結果。 */
function _qdFindPick(entry, category, section, option){
  if(category && (entry.category||'') !== category) return null;
  var secs = (entry.sections||[]).filter(function(s){ return s.section===section; });
  if(!secs.length) return null;
  var picks = secs[0].picks || [];
  var hit = picks.filter(function(p){ return p.option===option; });
  return hit.length ? hit[0] : null;
}

/* 單一填寫內容渲染成 chip：跟 photo-viewer.js._renderQuizSections 同一套判斷規則
   （純打勾不算有意義文字、有網址就是照片、其餘當文字顯示），差別只在這裡已經
   鎖定單一選項，不需要再顯示一次選項名稱標籤。
   ctx：選填 {store, section}，讓燈箱資訊列能顯示「店名 › 大題 › 選項」，不用切換
   出燈箱就知道這張照片是誰、哪一題填的（跟 photo-viewer.js._renderQuizSections
   的 storeName 參數是同一套機制）。
   回傳 { html, hasPhoto }：hasPhoto 決定外層要用「並排 wrap」還是「獨立一行」
   容器——這是 dashboard-common.css 裡明文記錄的設計決定（文字答案永遠獨立
   一行、只有照片才並排），這裡沿用，不要圖方便都用同一種容器。 */
function _qdRenderValueInfo(optionLabel, rawValue, ctx){
  var raw = String(rawValue||'');
  var urlRe = /https?:\/\/\S+/gi;
  var urls = raw.match(urlRe) || [];
  var textOnly = raw.replace(urlRe, '').replace(/[\r\n]+/g, ' ').trim().replace(/[\u2192\-\u2013\u2014]+$/, '').trim();

  if(urls.length){
    var isJustMark = /^[vV✓]$/.test(textOnly);
    var html = '';
    urls.forEach(function(u, idx){
      var label = urls.length > 1 ? (optionLabel + '-' + (idx+1)) : optionLabel;
      html += _renderPhotoChip(label, u, isJustMark ? '' : textOnly, ctx);
    });
    return { html:html, hasPhoto:true };
  }
  var isCheckmarkOnly = (raw==='v' || raw==='V' || raw==='✓');
  var html2 = isCheckmarkOnly
    ? '<span class="raw-quiz-chip is-simple"><span class="raw-quiz-chip-a">✓ 已勾選</span></span>'
    : '<span class="raw-quiz-chip"><span class="raw-quiz-chip-a">'+esc(raw)+'</span></span>';
  return { html:html2, hasPhoto:false };
}

/* 渲染右側結果：掃過目前 window._qdEntries，把「該分類+該大題+該選項」有填值的
   每一筆都列出來，新到舊排序（跟其他清單排序習慣一致），同日期再依標題排序。 */
function _qdRenderResults(){
  var resEl = document.getElementById('qd-results');
  if(!resEl) return;
  var key = window._qdSelectedKey;
  if(!key){
    resEl.innerHTML = '<div class="qd-results-empty">👈 請先從左側選擇一個題目，查看目前範圍內所有人怎麼填</div>';
    return;
  }
  var parsed = _qdParseKey(key);
  var category = parsed.category, section = parsed.section, option = parsed.option;

  var matched = [];
  (window._qdEntries||[]).forEach(function(e){
    var p = _qdFindPick(e, category, section, option);
    if(p && String(p.value||'').trim()) matched.push({ entry:e, value:p.value });
  });

  if(!matched.length){
    resEl.innerHTML = '<div class="qd-results-empty">目前篩選範圍內，沒有任何一筆針對「'+esc(option)+'」填寫內容'
      + '<div><span class="qd-clear-btn" onclick="_qdClearSelection()">✕ 清除選擇</span></div></div>';
    return;
  }

  matched.sort(function(a,b){
    var ta = String(a.entry.timeText||''), tb = String(b.entry.timeText||'');
    if(ta !== tb) return ta > tb ? -1 : 1;
    return String(a.entry.label||'').localeCompare(String(b.entry.label||''), 'zh-TW');
  });

  /* 分類非空才顯示「📂 分類 ──」這段前綴，沒有分類資料的板（category 永遠是
     空字串）畫面跟舊版完全一樣 */
  var catPrefix = category ? ('📂 '+esc(category)+' ── ') : '';
  var html = '<div class="photo-gallery-summary">'+catPrefix+'📋 '+esc(section)+' ── <strong>'+esc(option)+'</strong>'
    + '　共 <strong>'+matched.length+'</strong> 筆填寫內容'
    + '<span class="qd-clear-btn" onclick="_qdClearSelection()">✕ 清除選擇</span></div>';

  matched.forEach(function(m){
    var e = m.entry;
    var info = _qdRenderValueInfo(option, m.value, { store:e.label, section:section, category:category });
    /* 每張結果卡也帶一個「出處」tag，讓使用者不用回頭看左側選了什麼分類，
       卡片本身就能確認這筆填寫內容是哪個分類來的（category 為空就不顯示，
       不影響沒有分類概念的板） */
    var catTag = category ? '<span class="photo-store-tag">📂 '+esc(category)+'</span>' : '';
    html += '<div class="photo-store-card">'
      + '<div class="photo-store-head">'
      +   '<span class="photo-store-name">🏪 '+esc(e.label||'—')+'</span>'
      +   '<span class="photo-store-meta">🕒 '+esc(_dateOnly(e.timeText)||'未知時間')+'　'+esc(e.meta||'')+'</span>'
      +   catTag
      + '</div>'
      + '<div class="'+(info.hasPhoto?'raw-quiz-photos':'raw-quiz-picks')+'" style="margin-top:6px;">'+info.html+'</div>'
      + '</div>';
  });
  resEl.innerHTML = html;
}
