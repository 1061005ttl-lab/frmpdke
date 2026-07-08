/* ==========================================================================
   重構版：雙下拉式選單（先選問卷/分頁 → 後選大題_選項），不計算筆數，不佔空間
   ========================================================================== */

// 儲存目前問卷與選項的對應結構
window._qdSurveyMap = {};

function _qdBuildTabHtml(entries) {
  window._qdEntries = entries || [];
  window._qdSelectedKey = null;
  window._qdSurveyMap = {};

  if (!window._qdEntries.length) {
    return '<div class="empty">目前篩選範圍內沒有任何填寫內容</div>';
  }

  // 1. 建立「問卷 -> 大題_選項」的對應表（不重複、不計筆數）
  window._qdEntries.forEach(function(e) {
    // 假設 e.survey 或 e.sheetName 代表問卷分頁名稱，若無則預設為 "標準問卷"
    var surveyName = e.survey || e.sheetName || '未分類問卷'; 
    
    if (!window._qdSurveyMap[surveyName]) {
      window._qdSurveyMap[surveyName] = new Set();
    }

    (e.sections || []).forEach(function(sec) {
      (sec.picks || []).forEach(function(p) {
        if (!String(p.value || '').trim()) return; // 沒填值不列入
        var displayKey = sec.section + ' ── ' + p.option; // 大題_選項不拆分
        window._qdSurveyMap[surveyName].add(displayKey);
      });
    });
  });

  var surveyNames = Object.keys(window._qdSurveyMap);
  if (!surveyNames.length) {
    return '<div class="empty">目前篩選範圍內沒有填寫內容</div>';
  }

  // 2. 產生雙下拉選單的 HTML 結構（改為置頂、輕量、上下排列）
  var surveyOptions = surveyNames.map(function(name) {
    return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
  }).join('');

  var html = '<div class="qd-dropdown-control-bar" style="display: flex; gap: 10px; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">'
    + '  <div class="qd-select-group">'
    + '    <label style="margin-right: 5px; font-weight: bold;">1. 選擇問卷分頁：</label>'
    + '    <select id="qd-select-survey" onchange="_qdOnSurveyChange(this.value)" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc;">'
    + '      <option value="">-- 請選擇問卷 --</option>'
    +        surveyOptions
    + '    </select>'
    + '  </div>'
    + '  <div class="qd-select-group">'
    + '    <label style="margin-right: 5px; font-weight: bold;">2. 選擇大題與選項：</label>'
    + '    <select id="qd-select-question" disabled onchange="_qdOnQuestionChange(this.value)" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; min-width: 250px;">'
    + '      <option value="">-- 請先選擇問卷 --</option>'
    + '    </select>'
    + '  </div>'
    + '</div>'
    + '<div class="qd-results" id="qd-results" style="width: 100%;">'
    + '  <div class="qd-results-empty" style="color: #666; padding: 20px 0;">上方選擇完題目後，此處將直接呈現所有人填寫的結果內容。</div>'
    + '</div>';

  return html;
}

// 第一層選單變更：連動第二層
function _qdOnSurveyChange(surveyName) {
  var qSelect = document.getElementById('qd-select-question');
  var resEl = document.getElementById('qd-results');
  if (!qSelect) return;

  // 重置結果區與第二層
  window._qdSelectedKey = null;
  resEl.innerHTML = '<div class="qd-results-empty" style="color: #666; padding: 20px 0;">上方選擇完題目後，此處將直接呈現所有人填寫的結果內容。</div>';

  if (!surveyName || !window._qdSurveyMap[surveyName]) {
    qSelect.innerHTML = '<option value="">-- 請先選擇問卷 --</option>';
    qSelect.disabled = true;
    return;
  }

  // 填充第二層選項（大題_選項，不計筆數）
  var questions = Array.from(window._qdSurveyMap[surveyName]);
  var qOptions = '<option value="">-- 請選擇大題 ─ 選項 --</option>' + questions.map(function(qKey) {
    return '<option value="' + esc(qKey) + '">' + esc(qKey) + '</option>';
  }).join('');

  qSelect.innerHTML = qOptions;
  qSelect.disabled = false;
}

// 第二層選單變更：觸發結果渲染
function _qdOnQuestionChange(qKey) {
  window._qdSelectedKey = qKey; // 格式為 "大題名稱 ── 選項名稱"
  _qdRenderResults();
}

// 修改原有的結果渲染邏輯，配合新的 key 格式
function _qdRenderResults() {
  var resEl = document.getElementById('qd-results');
  if (!resEl) return;
  
  var key = window._qdSelectedKey;
  if (!key) {
    resEl.innerHTML = '<div class="qd-results-empty" style="color: #666; padding: 20px 0;">上方選擇完題目後，此處將直接呈現所有人填寫的結果內容。</div>';
    return;
  }

  // 拆解出大題與選項
  var parts = key.split(' ── ');
  var section = parts[0], option = parts[1];

  var matched = [];
  (window._qdEntries || []).forEach(function(e) {
    var p = _qdFindPick(e, section, option);
    if (p && String(p.value || '').trim()) matched.push({ entry: e, value: p.value });
  });

  if (!matched.length) {
    resEl.innerHTML = '<div class="qd-results-empty">目前篩選範圍內，沒有任何一筆針對「' + esc(option) + '」的填寫內容</div>';
    return;
  }

  // 排序：新到舊
  matched.sort(function(a, b) {
    var ta = String(a.entry.timeText || ''), tb = String(b.entry.timeText || '');
    if (ta !== tb) return ta > tb ? -1 : 1;
    return String(a.entry.label || '').localeCompare(String(b.entry.label || ''), 'zh-TW');
  });

  // 渲染結果內容（移除了清除選擇按鈕，因為直接切換下拉選單即可）
  var html = '<div class="photo-gallery-summary" style="margin-bottom:15px; font-size:15px;">📋 ' + esc(section) + ' ── <strong>' + esc(option) + '</strong></div>';

  matched.forEach(function(m) {
    var e = m.entry;
    var info = _qdRenderValueInfo(option, m.value);
    html += '<div class="photo-store-card">'
      + '<div class="photo-store-head">'
      +   '<span class="photo-store-name">🏪 ' + esc(e.label || '—') + '</span>'
      +   '<span class="photo-store-meta">' + (e.timeText ? '🕒 ' + esc(String(e.timeText)) + ' ' : '') + esc(e.meta || '') + '</span>'
      + '</div>'
      + '<div class="' + (info.hasPhoto ? 'raw-quiz-photos' : 'raw-quiz-picks') + '" style="margin-top:6px;">' + info.html + '</div>'
      + '</div>';
  });
  resEl.innerHTML = html;
}
