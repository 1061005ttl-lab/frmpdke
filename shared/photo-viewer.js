/* ════════════════════════════════════════════════════════════
   photo-viewer.js — 照片縮圖／燈箱／問卷區塊渲染共用工具
   版本：Ver. 1.0.0 ｜ 建立：2026-07-04
   依賴：core-utils.js（esc）
   CSS 依賴：dashboard-common.css 裡的
             .raw-quiz-*／.photo-lightbox-*／.photo-gallery-*／.photo-store-*

   給哪些看板用：任何需要顯示「原始問卷回答＋照片」的看板（目前 audit / coverage，
   未來 achievement 若要做逐店明細也適用）。

   【資料格式約定 — 這是這支檔案唯一在意的介面】
   _renderQuizSections() 吃的是「標準化格式」，不管資料原本長怎樣，
   呼叫端自己要先轉成這個形狀：
     sections = [
       { section: '大題名稱', picks: [ {option:'選項名稱', value:'回答內容或網址'}, ... ] },
       ...
     ]
   value 裡的網址規則（跟 audit_board 原始設計完全一致，不要改）：
     - 同一格可能是純文字／純網址（可多筆換行）／文字+網址混合
     - 一律用正則掃出所有 http(s):// 片段當照片
     - 純打勾標記（v／V／✓）不算有意義文字，若同時有照片就整個省略不顯示，
       只顯示照片；若沒有照片才顯示「✓ 選項名稱」的精簡小格子
     - 有意義的文字答案（非純打勾）永遠獨立一行顯示（.raw-quiz-picks 是
       flex-direction:column，故意的，不要改成 wrap 並排——只有照片才並排。
       這是 audit_board 2.7.0 就記錄下來的設計決定，coverage 曾經誤改成
       並排又改回來過一次，不要重蹈覆轍）

   誰去抓資料、怎麼從 gviz 原始列轉成上面這個格式，是各板自己的事
   （coverage 是 _fetchQuestionnaireSheet，audit 是 _fetchSourceSheet），
   這支檔案完全不管資料從哪來。

   【版本紀錄】
   1.0.0  2026-07-04  首版，從 coverage_board.html Ver.3.0.0 抽出
   ════════════════════════════════════════════════════════════ */

/* Google Drive 分享連結 → 可直接當 <img src> 用的大圖網址 */
function _driveBigUrl(url){
  var m = String(url).match(/\/d\/([^=\/]+)/);
  return m ? ('https://lh3.googleusercontent.com/d/'+m[1]+'=w1600') : url;
}

/* 單張照片縮圖 chip，點擊開燈箱看大圖 */
/* note：選填的附註文字（例如 audit 照片牆要顯示「這張照片旁邊寫了什麼」）。
   單獨一個 v／V／✓ 不算有意義的附註——這在原始資料裡只代表「這欄有填」，
   不是真的有話要說，所以自動排除、不會顯示成附註文字。 */
function _renderPhotoChip(optionName, url, note){
  var bigUrl = _driveBigUrl(url);
  var uid = 'photo_' + Math.random().toString(36).substring(2,9);
  var noteText = String(note||'').trim();
  var isJustMark = /^[vV✓]$/.test(noteText);
  var noteHtml = (noteText && !isJustMark) ? '<span class="raw-quiz-photo-note">📝 '+esc(noteText)+'</span>' : '';
  return '<span class="raw-quiz-chip raw-quiz-photo">'
    + '<span class="raw-quiz-chip-q">'+esc(optionName)+'</span>'
    +   '<img id="'+uid+'" class="raw-quiz-photo-img" src="'+esc(url)+'" alt="'+esc(optionName)+'" '
    +   'loading="lazy" crossorigin="anonymous" '
    +   'onclick="event.stopPropagation();_openPhotoLightbox(\''+esc(bigUrl).replace(/'/g,"\\'")+'\',\''+esc(optionName).replace(/'/g,"\\'")+'\');" '
    +   'onerror="this.style.display=\'none\';this.insertAdjacentHTML(\'afterend\',\'<span class=&quot;raw-quiz-photo-fail&quot;>⚠️ 圖片載入失敗</span>\');">'
    +   noteHtml
    + '</span>';
}

function _ensurePhotoLightbox(){
  var el = document.getElementById('photo-lightbox-backdrop');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'photo-lightbox-backdrop';
  el.className = 'photo-lightbox-backdrop';
  el.innerHTML = '<button class="photo-lightbox-close" onclick="_closePhotoLightbox()">✕</button>'
    + '<img class="photo-lightbox-img" id="photo-lightbox-img" src="" alt="">';
  el.addEventListener('click', function(){ _closePhotoLightbox(); });
  document.body.appendChild(el);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') _closePhotoLightbox(); });
  return el;
}
function _openPhotoLightbox(url, alt){
  var el = _ensurePhotoLightbox();
  document.getElementById('photo-lightbox-img').src = url;
  document.getElementById('photo-lightbox-img').alt = alt||'';
  el.classList.add('show');
}
function _closePhotoLightbox(){
  var el = document.getElementById('photo-lightbox-backdrop');
  if(el) el.classList.remove('show');
}

/* 渲染一整份「標準化格式」的問卷大題／選項（見檔頭說明），
   有網址畫縮圖、有文字純顯示文字、兩者都有則並存。 */
function _renderQuizSections(sections){
  if(!sections || !sections.length) return '<div style="font-size:12px;color:var(--sub);">（此筆未填寫任何題目）</div>';
  var html = '<div class="raw-quiz-list">';
  sections.forEach(function(sec){
    var picksHtml = '', photosHtml = '';
    sec.picks.forEach(function(p){
      var raw = String(p.value||'');
      var urlRe = /https?:\/\/\S+/gi;
      var urls = raw.match(urlRe) || [];
      var textOnly = raw.replace(urlRe, '').replace(/[\r\n]+/g, ' ').trim().replace(/[\u2192\-\u2013\u2014]+$/, '').trim();

      if(urls.length){
        urls.forEach(function(u, uIdx){
          var label = urls.length > 1 ? (p.option + '-' + (uIdx+1)) : p.option;
          photosHtml += _renderPhotoChip(label, u);
        });
        /* 純打勾標記（v/V/✓）不算有意義的文字內容，有照片時直接省略不顯示 */
        var isJustCheckmark = /^[vV✓]$/.test(textOnly);
        if(textOnly && !isJustCheckmark){
          picksHtml += '<span class="raw-quiz-chip"><span class="raw-quiz-chip-q">'+esc(p.option)+'</span>'
            + '<span class="raw-quiz-chip-a">→ '+esc(textOnly)+'</span></span>';
        }
        return;
      }

      var isCheckmarkOnly = (p.value==='v' || p.value==='V' || p.value==='✓');
      if(isCheckmarkOnly){
        picksHtml += '<span class="raw-quiz-chip is-simple"><span class="raw-quiz-chip-a">✓ '+esc(p.option)+'</span></span>';
      } else {
        picksHtml += '<span class="raw-quiz-chip"><span class="raw-quiz-chip-q">'+esc(p.option)+'</span>'
          + '<span class="raw-quiz-chip-a">→ '+esc(p.value)+'</span></span>';
      }
    });
    html += '<div class="raw-quiz-section">'
      + '<div class="raw-quiz-title">📋 '+esc(sec.section)+'</div>'
      + (picksHtml ? '<div class="raw-quiz-picks">'+picksHtml+'</div>' : '')
      + (photosHtml ? '<div class="raw-quiz-photos">'+photosHtml+'</div>' : '')
      + '</div>';
  });
  html += '</div>';
  return html;
}

/* 從「標準化格式」的 sections 裡只抽出有照片的項目，給照片牆／照片彙整類功能用 */
function _extractPhotosFromSections(sections){
  var out = [];
  (sections||[]).forEach(function(sec){
    sec.picks.forEach(function(p){
      var raw = String(p.value||'');
      var urlRe = /https?:\/\/\S+/gi;
      var urls = raw.match(urlRe) || [];
      if(!urls.length) return;
      urls.forEach(function(u, uIdx){
        var label = urls.length>1 ? (p.option+'-'+(uIdx+1)) : p.option;
        out.push({ section: sec.section, option: label, url: u });
      });
    });
  });
  return out;
}