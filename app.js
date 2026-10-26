(function () {
  'use strict';

  var QS = window.QUESTIONS, SECS = window.SECTIONS;
  var KEY = 'se-assessment-v1';
  var LETTERS = 'abcdefg';

  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { store = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

  var view = { sec: 'all', status: 'all' };
  var list = [], pos = 0;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function qid(q) { return q.sec + '-' + q.num; }
  function secName(id) {
    for (var i = 0; i < SECS.length; i++) if (SECS[i].id === id) return SECS[i].name;
    return id;
  }
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  /* ---------- state per question ---------- */
  function info(q) {
    var st = store[qid(q)];
    if (!st || (!st.picks.length && !st.done)) return { state: 'new', score: 0, picks: [] };
    var right = st.picks.filter(function (l) { return q.answer.indexOf(l) > -1; }).length;
    var wrong = st.picks.length - right;
    if (!st.done) return { state: 'progress', score: 0, picks: st.picks };
    var perfect = wrong === 0 && right === q.answer.length;
    var score = perfect ? 1 : Math.max(0, (right - wrong) / q.answer.length);
    var state = perfect ? 'correct' : (score > 0 ? 'partial' : 'wrong');
    return { state: state, score: score, picks: st.picks, done: true };
  }

  function pick(q, letter) {
    var id = qid(q);
    var st = store[id] || (store[id] = { picks: [], done: false });
    if (st.done || st.picks.indexOf(letter) > -1) return;
    st.picks.push(letter);
    if (!q.multi) st.done = true;
    else if (q.answer.every(function (a) { return st.picks.indexOf(a) > -1; })) st.done = true;
    save();
    render();
  }

  function reveal(q) {
    var id = qid(q);
    var st = store[id] || (store[id] = { picks: [], done: false });
    st.done = true;
    save();
    render();
  }

  /* ---------- filtering ---------- */
  function applyFilter(keepId) {
    list = QS.filter(function (q) {
      if (view.sec !== 'all' && q.sec !== view.sec) return false;
      var s = info(q).state;
      if (view.status === 'new') return s === 'new' || s === 'progress';
      if (view.status === 'review') return s === 'wrong' || s === 'partial';
      return true;
    });
    if (keepId) {
      for (var i = 0; i < list.length; i++) if (qid(list[i]) === keepId) { pos = i; return; }
    }
    if (pos >= list.length) pos = Math.max(0, list.length - 1);
  }

  /* ---------- rendering ---------- */
  function renderScore() {
    var total = QS.length, pts = 0, answered = 0;
    QS.forEach(function (q) {
      var i = info(q);
      pts += i.score;
      if (i.state !== 'new' && i.state !== 'progress') answered++;
    });
    $('scoreNow').textContent = fmt(pts);
    $('scoreMax').textContent = total;
    $('doneCount').textContent = answered;
    $('totalCount').textContent = total;
    $('barFill').style.width = (answered / total * 100) + '%';
  }

  function renderGrid() {
    var g = $('grid');
    g.innerHTML = '';
    $('listCount').textContent = '(' + list.length + ')';
    list.forEach(function (q, i) {
      var b = document.createElement('button');
      b.className = 'chip ' + info(q).state + (i === pos ? ' current' : '');
      b.textContent = i + 1;
      b.title = secName(q.sec) + ' · Q' + q.num;
      b.addEventListener('click', function () { pos = i; render(); });
      g.appendChild(b);
    });
  }

  function badge(q) {
    if (q.p) return '<span class="badge portal">✓ Matches your portal’s accepted answer</span>';
    if (q.chk) return '<span class="badge check">⚠ Not confirmed by your portal — double-check this one</span>';
    return '<span class="badge">Answer worked out from the course material</span>';
  }

  function renderCard() {
    var card = $('card');
    if (!list.length) {
      card.innerHTML = '<div class="empty">No questions match this filter.<br>Change the topic or the “Show” option on the left.</div>';
      $('posLabel').textContent = '';
      $('prevBtn').disabled = true; $('nextBtn').disabled = true;
      return;
    }
    var q = list[pos], i = info(q), done = !!i.done;
    var html = '';
    html += '<div class="tags"><span class="tag">' + esc(secName(q.sec)) + '</span>' +
            '<span class="tag kind">Q' + q.num + ' · ' + (q.multi ? 'Select all that apply' : 'Choose one') + '</span></div>';
    html += '<p class="qtext">' + esc(q.text) + '</p><div class="opts">';

    q.options.forEach(function (text, idx) {
      var l = LETTERS[idx];
      var picked = i.picks.indexOf(l) > -1, isAns = q.answer.indexOf(l) > -1;
      var cls = 'opt', mark = '';
      if (picked) { cls += isAns ? ' correct' : ' wrong'; mark = isAns ? '✓' : '✗'; }
      else if (done && isAns) { cls += ' missed'; mark = 'correct answer'; }
      html += '<button class="' + cls + '" data-l="' + l + '"' + ((done || picked) ? ' disabled' : '') + '>' +
              '<span class="ltr">' + l + '</span><span class="txt">' + esc(text) + '</span>' +
              '<span class="mark">' + mark + '</span></button>';
    });
    html += '</div>';

    if (q.multi && !done) {
      var found = i.picks.filter(function (l) { return q.answer.indexOf(l) > -1; }).length;
      html += '<div class="actions"><button class="btn" id="revealBtn">Reveal answer</button>' +
              '<span class="helper">Each choice is marked as soon as you click it. ' + found + ' of the correct options found.</span></div>';
    }

    if (done) {
      var vcls = i.state, verdict;
      if (i.state === 'correct') verdict = '✓ Correct';
      else if (i.state === 'partial') verdict = 'Partly right — ' + fmt(i.score) + ' of 1 point';
      else verdict = '✗ Not quite';
      html += '<div class="feedback ' + vcls + '"><div class="verdict">' + verdict + '</div>' +
              '<div class="key"><strong>Correct answer: ' + q.answer.join(', ') + '</strong></div>' +
              (q.why ? '<p class="why">' + esc(q.why) + '</p>' : '') + badge(q) + '</div>';
    }
    card.innerHTML = html;

    Array.prototype.forEach.call(card.querySelectorAll('.opt'), function (b) {
      b.addEventListener('click', function () { pick(q, b.getAttribute('data-l')); });
    });
    var rb = $('revealBtn');
    if (rb) rb.addEventListener('click', function () { reveal(q); });

    $('posLabel').textContent = 'Question ' + (pos + 1) + ' of ' + list.length;
    $('prevBtn').disabled = pos === 0;
    $('nextBtn').disabled = pos >= list.length - 1;
  }

  function render() {
    renderScore();
    renderGrid();
    renderCard();
  }

  /* ---------- results dialog ---------- */
  function showResults() {
    var total = QS.length, pts = 0, answered = 0, perfect = 0;
    var rows = SECS.map(function (s) {
      var qs = QS.filter(function (q) { return q.sec === s.id; });
      var p = 0, a = 0;
      qs.forEach(function (q) {
        var i = info(q);
        p += i.score;
        if (i.state !== 'new' && i.state !== 'progress') a++;
        if (i.state === 'correct') perfect++;
      });
      pts += p; answered += a;
      return '<tr><td>' + esc(s.name) + '</td><td>' + fmt(p) + ' / ' + qs.length + ' (' + a + ' answered)</td></tr>';
    }).join('');
    var pct = Math.round(pts / total * 100);
    $('resultsBody').innerHTML =
      '<div class="big">' + fmt(pts) + ' / ' + total + ' <small>(' + pct + '%)</small></div>' +
      '<div class="helper">' + perfect + ' fully correct · ' + answered + ' answered · ' + (total - answered) + ' remaining</div>' +
      '<table><thead><tr><th>Topic</th><th>Score</th></tr></thead><tbody>' + rows + '</tbody></table>';
    var d = $('resultsDlg');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }

  /* ---------- wiring ---------- */
  function buildSelect() {
    var s = $('secSel');
    s.innerHTML = '<option value="all">All topics (' + QS.length + ')</option>' +
      SECS.map(function (x) {
        var n = QS.filter(function (q) { return q.sec === x.id; }).length;
        return '<option value="' + x.id + '">' + esc(x.name) + ' (' + n + ')</option>';
      }).join('');
  }

  $('secSel').addEventListener('change', function () { view.sec = this.value; pos = 0; applyFilter(); render(); });
  $('statusSel').addEventListener('change', function () { view.status = this.value; pos = 0; applyFilter(); render(); });
  $('prevBtn').addEventListener('click', function () { if (pos > 0) { pos--; render(); } });
  $('nextBtn').addEventListener('click', function () { if (pos < list.length - 1) { pos++; render(); } });
  $('resultsBtn').addEventListener('click', showResults);
  $('closeDlg').addEventListener('click', function () { $('resultsDlg').close(); });
  $('reviewBtn').addEventListener('click', function () {
    $('resultsDlg').close();
    view.status = 'review'; $('statusSel').value = 'review';
    pos = 0; applyFilter(); render();
  });
  $('resetBtn').addEventListener('click', function () {
    var n = list.length;
    if (!n) return;
    if (!confirm('Clear your answers for the ' + n + ' question(s) currently shown?')) return;
    list.forEach(function (q) { delete store[qid(q)]; });
    save();
    var keep = list[0] ? qid(list[0]) : null;
    view.status = 'all'; $('statusSel').value = 'all';
    applyFilter(keep); render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target && e.target.tagName;
    if (t === 'SELECT' || t === 'INPUT' || t === 'TEXTAREA') return;
    if ($('resultsDlg').open) return;
    var k = e.key.toLowerCase();
    if (k === 'arrowright') { if (pos < list.length - 1) { pos++; render(); } return; }
    if (k === 'arrowleft') { if (pos > 0) { pos--; render(); } return; }
    if (!list.length) return;
    var q = list[pos];
    if (k === 'r' && q.multi && !info(q).done) { reveal(q); return; }
    var idx = LETTERS.indexOf(k);
    if (k.length === 1 && idx > -1 && idx < q.options.length) pick(q, k);
  });

  buildSelect();
  applyFilter();
  render();
})();
