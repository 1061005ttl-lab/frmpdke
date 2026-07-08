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
   1.1.0  2026-07-08  燈箱三項優化（智慧滿版／左右熱區／鍵盤方向鍵）：
                       A) 智慧滿版：.photo-lightbox-img 改成填滿固定尺寸的
                          .photo-lightbox-stage（96vw×94vh）＋object-fit:contain，
                          不管原始照片解析度多小多大都會自動縮放到「在不變形的
                          前提下盡量佔滿畫面」，不用再手動 Ctrl+滾輪縮放。
                       B) 左右熱區：燈箱左右各 1/3 寬度是可點擊的切換熱區
                          （hover 會浮現 ‹ › 箭頭），點圖片本身或中間背景維持
                          原本「關閉」行為不變。
                       C) 鍵盤左右鍵：燈箱開著時按 ←/→ 切換上一張/下一張，
                          Esc 關閉（沿用原本邏輯）。
                       D) 同一個瀏覽範圍（一次拜訪紀錄／照片牆一張店卡／逐題
                          彙整結果）內的所有縮圖，開燈箱時會自動組成一份清單
                          （靠 data-lightbox-url/data-lightbox-alt 屬性 + 動態
                          掃描同容器內的縮圖，不是另外維護一份清單設定檔），
                          右上角會顯示「3 / 12」這樣的張數計數，只有 1 張時
                          不顯示熱區/計數，避免誤導使用者以為還有其他張。
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
  /* data-lightbox-url／data-lightbox-alt：燈箱要做「左右鍵/熱區切換上一張下一張」，
     開燈箱當下才動態去掃同一個容器內所有縮圖組成清單（見 _openPhotoLightboxFromImg），
     所以每張縮圖把自己的大圖網址／說明文字存在 data 屬性上，不要只塞進 onclick
     字串裡——那樣燈箱就只知道「這一張」，沒辦法回頭去問「旁邊還有哪些」。 */
  return '<span class="raw-quiz-chip raw-quiz-photo">'
    + '<span class="raw-quiz-chip-q">'+esc(optionName)+'</span>'
    +   '<img id="'+uid+'" class="raw-quiz-photo-img" src="'+esc(url)+'" alt="'+esc(optionName)+'" '
    +   'data-lightbox-url="'+esc(bigUrl)+'" data-lightbox-alt="'+esc(optionName)+'" '
    +   'loading="lazy" crossorigin="anonymous" '
    +   'onclick="event.stopPropagation();_openPhotoLightboxFromImg(this);" '
    +   'onerror="this.style.display=\'none\';this.insertAdjacentHTML(\'afterend\',\'<span class=&quot;raw-quiz-photo-fail&quot;>⚠️ 圖片載入失敗</span>\');">'
    +   noteHtml
    + '</span>';
}

/* 燈箱要在哪個範圍內找「上一張/下一張」，刻意用容器邊界圈住，而不是抓全頁所有照片——
   一次拜訪紀錄（.raw-quiz-list）、照片牆一張卡片（.photo-gallery-sections）、
   逐題彙整結果（#qd-results）各自是一組合理的瀏覽範圍，跨這些範圍切換上一張/下一張
   使用者會看不懂「怎麼跳到別家店去了」，所以找不到明確容器才退回整頁。 */
var _PHOTO_GALLERY_SCOPE_SELECTOR = '.raw-quiz-list, .photo-gallery-sections, #qd-results';

function _ensurePhotoLightbox(){
  var el = document.getElementById('photo-lightbox-backdrop');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'photo-lightbox-backdrop';
  el.className = 'photo-lightbox-backdrop';
  el.innerHTML = '<button class="photo-lightbox-close" onclick="event.stopPropagation();_closePhotoLightbox()">✕</button>'
    + '<div class="photo-lightbox-nav-zone photo-lightbox-nav-prev" onclick="event.stopPropagation();_photoLightboxNav(-1)"><span class="photo-lightbox-nav-arrow">‹</span></div>'
    + '<div class="photo-lightbox-nav-zone photo-lightbox-nav-next" onclick="event.stopPropagation();_photoLightboxNav(1)"><span class="photo-lightbox-nav-arrow">›</span></div>'
    + '<div class="photo-lightbox-stage">'
    +   '<img class="photo-lightbox-img" id="photo-lightbox-img" src="" alt="">'
    + '</div>'
    + '<div class="photo-lightbox-counter" id="photo-lightbox-counter"></div>';
  /* 點背景／點圖片本身＝關閉（cursor:zoom-out 就是在暗示這件事，維持原行為）；
     點左右熱區／關閉鈕都各自 stopPropagation，不會被這裡的關閉邏輯吃掉 */
  el.addEventListener('click', function(){ _closePhotoLightbox(); });
  document.body.appendChild(el);
  document.addEventListener('keydown', function(e){
    var box = document.getElementById('photo-lightbox-backdrop');
    if(!box || !box.classList.contains('show')) return;
    if(e.key === 'Escape') _closePhotoLightbox();
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); _photoLightboxNav(-1); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); _photoLightboxNav(1); }
  });
  return el;
}

/* 從被點擊的縮圖 <img> 出發，掃同一個瀏覽範圍內所有縮圖組成一份清單，
   一起交給 _openPhotoLightbox，讓燈箱知道「上一張/下一張」是誰 */
function _openPhotoLightboxFromImg(imgEl){
  var scope = imgEl.closest(_PHOTO_GALLERY_SCOPE_SELECTOR) || document;
  var imgs = Array.prototype.slice.call(scope.querySelectorAll('.raw-quiz-photo-img[data-lightbox-url]'));
  if(!imgs.length) imgs = [imgEl];
  var gallery = imgs.map(function(im){
    return { url: im.getAttribute('data-lightbox-url'), alt: im.getAttribute('data-lightbox-alt') || '' };
  });
  var idx = imgs.indexOf(imgEl);
  if(idx < 0) idx = 0;
  _openPhotoLightbox(gallery[idx].url, gallery[idx].alt, gallery, idx);
}

/* gallery/idx 為選填，不傳就退回「只有這一張」的單張模式，
   保留舊呼叫方式（_openPhotoLightbox(url, alt)）的相容性，不強迫呼叫端都要組清單 */
function _openPhotoLightbox(url, alt, gallery, idx){
  window._photoLightboxGallery = (gallery && gallery.length) ? gallery : [{ url:url, alt:alt||'' }];
  window._photoLightboxIndex = (typeof idx === 'number' && idx >= 0) ? idx : 0;
  var el = _ensurePhotoLightbox();
  _photoLightboxRender();
  el.classList.add('show');
}

/* 依目前 window._photoLightboxIndex 把圖片／計數器渲染出來，
   切換上一張/下一張只需要改 index 再呼叫這支，不用整個燈箱重開 */
function _photoLightboxRender(){
  var gallery = window._photoLightboxGallery || [];
  var idx = window._photoLightboxIndex || 0;
  var item = gallery[idx] || { url:'', alt:'' };
  var imgEl = document.getElementById('photo-lightbox-img');
  if(imgEl){ imgEl.src = item.url; imgEl.alt = item.alt; }
  var counterEl = document.getElementById('photo-lightbox-counter');
  if(counterEl) counterEl.textContent = gallery.length > 1 ? ((idx+1) + ' / ' + gallery.length) : '';
  var box = document.getElementById('photo-lightbox-backdrop');
  if(box) box.classList.toggle('has-multi', gallery.length > 1);
}

/* delta：-1 上一張／+1 下一張，頭尾循環（最後一張按下一張回到第一張），
   只有一張照片時直接略過（沒有「上一張/下一張」的意義） */
function _photoLightboxNav(delta){
  var gallery = window._photoLightboxGallery || [];
  if(gallery.length < 2) return;
  window._photoLightboxIndex = ((window._photoLightboxIndex || 0) + delta + gallery.length) % gallery.length;
  _photoLightboxRender();
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
