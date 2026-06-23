/* =====================================================================
   Café of Life SOP — Form + Pencil Layer
   - Real checkbox inputs (auto-injected into .checklist li)
   - Text + textarea + contenteditable persistence
   - Apple Pencil drawing layer (pointerType === 'pen')
   - Toolbar: color, eraser, undo, clear
   - Auto-save to localStorage per page
   ===================================================================== */

(function () {
  'use strict';

  const PAGE_FILE = location.pathname.split('/').pop() || 'index.html';
  const PAGE_ID = PAGE_FILE + (location.search || '');
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function currentTrackerDate() {
    if (PAGE_FILE !== '13-huddle-sheet.html') return '';
    const p = new URLSearchParams(location.search);
    const qDate = p.get('date');
    return /^\d{4}-\d{2}-\d{2}$/.test(qDate || '') ? qDate : todayISO();
  }

  let STORAGE_KEY = PAGE_FILE === '13-huddle-sheet.html'
    ? 'command-center-' + currentTrackerDate()
    : 'cofl_sop_' + PAGE_ID;

  // ---------- NOTES REGISTRY ----------
  const NOTES_PAGE = '14-notes.html';
  const NOTES_INDEX_KEY = 'cofl_sop_notes_index_v1';
  const HUDDLE_PAGE = '13-huddle-sheet.html';
  const HUDDLE_INDEX_KEY = 'cofl_sop_huddle_index_v1';
  const SEARCH_PAGES = [
    { title: 'Contents', href: 'index.html' },
    { title: 'Office Information', href: '01-office-info.html' },
    { title: 'Opening Procedures', href: '02-opening.html' },
    { title: 'New Patient Phone Call', href: '03-new-patient-call.html' },
    { title: 'Day 1 - First Visit', href: '04-day-1.html' },
    { title: 'Day 2 - ROF', href: '05-day-2-rof.html' },
    { title: 'Day 3 - Onboarding', href: '06-day-3.html' },
    { title: 'Adjustment Visit', href: '07-adjustment.html' },
    { title: 'SoftWave', href: '08-softwave.html' },
    { title: 'Checkout', href: '09-checkout.html' },
    { title: 'Closing Procedures', href: '10-closing.html' },
    { title: 'Systems & Forms', href: '11-systems-forms.html' },
    { title: 'Rules & Color Guide', href: '12-rules-colors.html' },
    { title: 'Daily Shift Tracker', href: '13-huddle-sheet.html' },
    { title: 'Notes', href: '14-notes.html' },
  ];

  function getNotesIndex() {
    try {
      const v = JSON.parse(localStorage.getItem(NOTES_INDEX_KEY));
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  function saveNotesIndex(idx) {
    try { localStorage.setItem(NOTES_INDEX_KEY, JSON.stringify(idx)); } catch {}
  }
  function newNoteId() {
    return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function addNote() {
    const idx = getNotesIndex();
    const id = newNoteId();
    idx.push({ id: id, created: Date.now() });
    saveNotesIndex(idx);
    return id;
  }
  function deleteNote(id) {
    saveNotesIndex(getNotesIndex().filter(n => n.id !== id));
    try { localStorage.removeItem('cofl_sop_' + NOTES_PAGE + '?id=' + id); } catch {}
  }
  function getHuddleIndex() {
    try {
      const v = JSON.parse(localStorage.getItem(HUDDLE_INDEX_KEY));
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  function saveHuddleIndex(idx) {
    try { localStorage.setItem(HUDDLE_INDEX_KEY, JSON.stringify(idx)); } catch {}
  }
  function newHuddleId() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function addHuddle() {
    const idx = getHuddleIndex();
    const id = newHuddleId();
    idx.unshift({ id: id, created: Date.now() });
    saveHuddleIndex(idx);
    return id;
  }
  function deleteHuddle(id) {
    saveHuddleIndex(getHuddleIndex().filter(h => h.id !== id));
    try { localStorage.removeItem('cofl_sop_' + HUDDLE_PAGE + '?id=' + id); } catch {}
  }
  function getHuddleTitle(id, fallback) {
    try {
      const data = JSON.parse(localStorage.getItem('cofl_sop_' + HUDDLE_PAGE + '?id=' + id));
      const date = data && typeof data.in_huddle_date === 'string' ? data.in_huddle_date.trim() : '';
      const day = data && typeof data.in_huddle_day === 'string' ? data.in_huddle_day.trim() : '';
      const shift = data && typeof data.sel_huddle_shift_type === 'string' ? data.sel_huddle_shift_type.trim() : '';
      const title = [date, day, shift].filter(Boolean).join(' - ');
      if (title) return title;
    } catch {}
    return fallback;
  }
  function getNoteTitle(id, fallback) {
    try {
      const data = JSON.parse(localStorage.getItem('cofl_sop_' + NOTES_PAGE + '?id=' + id));
      const t = data && typeof data.in_note_title === 'string' ? data.in_note_title.trim() : '';
      if (t) return t;
    } catch {}
    return fallback;
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---------- STATE ----------
  let state = loadState();
  let saveTimeout = null;
  let lastSaveTooBigWarned = false;

  function loadState(key = STORAGE_KEY) {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch { return {}; }
  }

  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        flashSavedIndicator();
      } catch (e) {
        if (!lastSaveTooBigWarned) {
          lastSaveTooBigWarned = true;
          alert('Storage is full. Some new annotations may not save. Try clearing a page.');
        }
      }
    }, 200);
  }

  function flashSavedIndicator() {
    const el = document.querySelector('.sb-status');
    if (!el) return;
    el.classList.add('saved');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('saved'), 600);
  }

  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  }

  // ---------- CHECKBOXES ----------
  function initCheckboxes() {
    document.querySelectorAll('ul.checklist').forEach((ul, listIdx) => {
      ul.querySelectorAll(':scope > li').forEach((li, itemIdx) => {
        const text = li.textContent.trim();
        if (!text) return;
        const key = 'cb_' + listIdx + '_' + itemIdx + '_' + slugify(text);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'sop-check';
        input.dataset.key = key;
        input.contentEditable = 'false';
        input.checked = !!state[key];
        if (input.checked) li.classList.add('checked');
        input.addEventListener('change', () => {
          state[key] = input.checked;
          li.classList.toggle('checked', input.checked);
          scheduleSave();
        });
        li.insertBefore(input, li.firstChild);
        li.classList.add('with-checkbox');
      });
    });
  }

  function initStandaloneCheckboxes(root = document) {
    root.querySelectorAll('input.sop-bool[type="checkbox"]').forEach((el, idx) => {
      if (el.dataset.key) return;
      const key = 'bool_' + (el.name || el.id || idx);
      el.dataset.key = key;
      el.checked = !!state[key];
      el.addEventListener('change', () => {
        state[key] = el.checked;
        scheduleSave();
      });
    });
  }

  function initSelects(root = document) {
    root.querySelectorAll('select.sop-select').forEach((el) => {
      if (el.dataset.key) return;
      if (el.dataset.huddleSavedDays != null) return;
      const key = 'sel_' + (el.name || el.id || 'select');
      el.dataset.key = key;
      if (state[key] != null) el.value = state[key];
      el.addEventListener('change', () => {
        state[key] = el.value;
        scheduleSave();
      });
    });
  }

  // ---------- TEXT INPUTS + TEXTAREAS ----------
  function initInputs(root = document) {
    root.querySelectorAll('input.sop-text, textarea.sop-text').forEach((el) => {
      if (el.dataset.key) return;
      if (el.dataset.huddleDate != null || el.dataset.huddleDay != null) return;
      const key = 'in_' + (el.name || slugify(el.placeholder || el.id || 'field'));
      el.dataset.key = key;
      if (state[key] != null) el.value = state[key];
      el.addEventListener('input', () => {
        state[key] = el.value;
        scheduleSave();
        autoGrow(el);
      });
      autoGrow(el);
    });
  }

  function autoGrow(el) {
    if (!el.matches || !el.matches('textarea.autogrow')) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 40) + 'px';
  }

  // ---------- CONTENTEDITABLE ----------
  function initEditables() {
    document.querySelectorAll('[contenteditable="true"]').forEach((el, idx) => {
      const key = 'ed_' + idx + '_' + slugify(el.getAttribute('data-name') || el.id || '');
      el.dataset.key = key;
      if (state[key]) el.innerHTML = state[key];
      el.addEventListener('input', () => {
        // Strip any injected, non-editable widgets (like .sop-check) before saving
        const clone = el.cloneNode(true);
        clone.querySelectorAll('input.sop-check').forEach(n => n.remove());
        state[key] = clone.innerHTML;
        scheduleSave();
      });
    });
  }

  // ---------- PENCIL CANVAS ----------
  const CURRENT = {
    color: '#330C15',
    eraser: false,
    width: 1.6
  };

  function initPencil() {
    document.querySelectorAll('.page').forEach((page, idx) => setupPageCanvas(page, idx));
  }

  function setupPageCanvas(page, idx) {
    const canvas = document.createElement('canvas');
    canvas.className = 'pencil-layer';
    page.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const STROKES_KEY = 'strokes_' + idx;
    let strokes = Array.isArray(state[STROKES_KEY]) ? state[STROKES_KEY] : [];
    let currentStroke = null;
    let drawing = false;

    function resize() {
      const rect = page.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      redraw();
    }

    function redraw() {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      strokes.forEach(drawStroke);
    }

    function drawStroke(s) {
      if (!s || !s.points || s.points.length < 1) return;
      ctx.save();
      ctx.globalCompositeOperation = s.eraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      if (s.points.length === 1) {
        const [x, y] = s.points[0];
        ctx.beginPath();
        ctx.arc(x, y, s.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(s.points[0][0], s.points[0][1]);
        for (let i = 1; i < s.points.length; i++) {
          const p = s.points[i];
          ctx.lineWidth = (s.width) * (0.45 + (p[2] || 0.5) * 1.4);
          ctx.lineTo(p[0], p[1]);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
        }
      }
      ctx.restore();
    }

    function getPoint(e) {
      const rect = canvas.getBoundingClientRect();
      return [
        +(e.clientX - rect.left).toFixed(1),
        +(e.clientY - rect.top).toFixed(1),
        +(e.pressure || 0.5).toFixed(2)
      ];
    }

    page.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'pen') return;
      e.preventDefault();
      drawing = true;
      currentStroke = {
        color: CURRENT.eraser ? '#000' : CURRENT.color,
        width: CURRENT.eraser ? 18 : CURRENT.width,
        eraser: CURRENT.eraser,
        points: [getPoint(e)]
      };
      try { page.setPointerCapture(e.pointerId); } catch {}
    }, { passive: false });

    page.addEventListener('pointermove', (e) => {
      if (!drawing || e.pointerType !== 'pen') return;
      e.preventDefault();
      currentStroke.points.push(getPoint(e));
      // incremental render
      const s = currentStroke;
      const n = s.points.length;
      if (n >= 2) {
        ctx.save();
        ctx.globalCompositeOperation = s.eraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = s.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = s.width * (0.45 + (s.points[n - 1][2] || 0.5) * 1.4);
        ctx.beginPath();
        ctx.moveTo(s.points[n - 2][0], s.points[n - 2][1]);
        ctx.lineTo(s.points[n - 1][0], s.points[n - 1][1]);
        ctx.stroke();
        ctx.restore();
      }
    }, { passive: false });

    function finishStroke(e) {
      if (!drawing) return;
      drawing = false;
      if (currentStroke && currentStroke.points.length >= 1) {
        strokes.push(currentStroke);
        state[STROKES_KEY] = strokes;
        scheduleSave();
      }
      currentStroke = null;
    }

    page.addEventListener('pointerup', finishStroke);
    page.addEventListener('pointercancel', finishStroke);
    page.addEventListener('pointerleave', finishStroke);

    page._sopCanvas = {
      undo() {
        if (!strokes.length) return;
        strokes.pop();
        state[STROKES_KEY] = strokes;
        scheduleSave();
        redraw();
      },
      clear() {
        strokes = [];
        state[STROKES_KEY] = strokes;
        scheduleSave();
        redraw();
      }
    };

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    });
    // Initial sizing — delay so layout is settled
    requestAnimationFrame(() => requestAnimationFrame(resize));
  }

  // ---------- TOOLBAR ----------
  function initToolbar() {
    if (document.querySelector('.sop-toolbar')) return;
    const bar = document.createElement('div');
    bar.className = 'sop-toolbar';
    bar.innerHTML =
      '<button class="tb-color active" data-color="#330C15" style="--c:#330C15" aria-label="Plum"></button>' +
      '<button class="tb-color" data-color="#662C39" style="--c:#662C39" aria-label="Burgundy"></button>' +
      '<button class="tb-color" data-color="#1d4d8f" style="--c:#1d4d8f" aria-label="Blue"></button>' +
      '<button class="tb-color" data-color="#1a1a1a" style="--c:#1a1a1a" aria-label="Black"></button>' +
      '<div class="tb-sep"></div>' +
      '<button class="tb-eraser" aria-label="Eraser" title="Eraser">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3 3 16l5 5h13M8 21l8-8M11 6l7 7"/></svg>' +
      '</button>' +
      '<button class="tb-undo" aria-label="Undo" title="Undo">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7"/></svg>' +
      '</button>' +
      '<button class="tb-clear" aria-label="Clear page" title="Clear pencil notes">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>' +
      '</button>';
    document.body.appendChild(bar);

    bar.querySelectorAll('.tb-color').forEach(btn => {
      btn.addEventListener('click', () => {
        CURRENT.color = btn.dataset.color;
        CURRENT.eraser = false;
        bar.querySelectorAll('.tb-color').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        bar.querySelector('.tb-eraser').classList.remove('active');
      });
    });

    bar.querySelector('.tb-eraser').addEventListener('click', (e) => {
      CURRENT.eraser = !CURRENT.eraser;
      bar.querySelector('.tb-eraser').classList.toggle('active', CURRENT.eraser);
    });

    bar.querySelector('.tb-undo').addEventListener('click', () => {
      document.querySelectorAll('.page').forEach(p => p._sopCanvas && p._sopCanvas.undo());
    });

    bar.querySelector('.tb-clear').addEventListener('click', () => {
      if (confirm('Clear all pencil notes on this page?')) {
        document.querySelectorAll('.page').forEach(p => p._sopCanvas && p._sopCanvas.clear());
      }
    });
  }

  // ---------- SAVE BAR ----------
  function initSaveBar() {
    if (document.querySelector('.sop-savebar')) return;
    const bar = document.createElement('div');
    bar.className = 'sop-savebar';
    bar.innerHTML =
      '<span class="sb-status"><span class="dot"></span>Auto-saved</span>' +
      '<button class="sb-reset" data-scope="page">Reset page</button>' +
      '<button class="sb-reset sb-reset-all" data-scope="all">Reset all</button>';
    document.body.appendChild(bar);

    bar.querySelectorAll('.sb-reset').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.scope === 'page') {
          if (confirm('Clear all form fields AND pencil notes on this page?')) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
          }
          return;
        }
        if (confirm('Clear EVERYTHING across the entire binder — every page\'s checkboxes, text, and pencil notes? This cannot be undone.')) {
          Object.keys(localStorage)
            .filter(k => k.startsWith('cofl_sop_') && k !== 'cofl_sop_hint_v1')
            .forEach(k => localStorage.removeItem(k));
          location.reload();
        }
      });
    });
  }

  function initPageResetButtons() {
    document.querySelectorAll('[data-reset-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const message = btn.getAttribute('data-reset-message') || 'Clear all saved fields on this page?';
        if (!confirm(message)) return;
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      });
    });
  }

  // ---------- QUICK SEARCH ----------
  function stripHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, nav, .sop-toolbar, .sop-savebar').forEach(el => el.remove());
    return (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').trim();
  }

  let searchCache = null;
  function loadSearchIndex() {
    if (searchCache) return searchCache;
    searchCache = Promise.all(SEARCH_PAGES.map(page => {
      return fetch(page.href)
        .then(r => r.ok ? r.text() : '')
        .then(html => ({
          title: page.title,
          href: page.href,
          text: stripHTML(html || '')
        }))
        .catch(() => ({ title: page.title, href: page.href, text: page.title }));
    }));
    return searchCache;
  }

  function excerpt(text, needle) {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(needle.toLowerCase());
    if (idx < 0) return text.slice(0, 130);
    const start = Math.max(0, idx - 55);
    const end = Math.min(text.length, idx + needle.length + 90);
    return (start ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
  }

  function initQuickSearch() {
    if (document.querySelector('.sop-search')) return;
    const wrap = document.createElement('div');
    wrap.className = 'sop-search';
    wrap.innerHTML =
      '<button class="sop-search-toggle" type="button" aria-label="Search SOP" title="Search SOP">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>' +
      '</button>' +
      '<div class="sop-search-panel" role="search">' +
        '<input class="sop-search-input" type="search" placeholder="Search SOP..." autocomplete="off" aria-label="Search SOP">' +
        '<div class="sop-search-results" aria-live="polite"></div>' +
      '</div>';
    document.body.appendChild(wrap);

    const toggle = wrap.querySelector('.sop-search-toggle');
    const panel = wrap.querySelector('.sop-search-panel');
    const input = wrap.querySelector('.sop-search-input');
    const results = wrap.querySelector('.sop-search-results');

    function openSearch() {
      wrap.classList.add('open');
      loadSearchIndex();
      setTimeout(() => input.focus(), 0);
    }
    function closeSearch() {
      wrap.classList.remove('open');
      input.blur();
    }
    function render(items, q) {
      if (!q) {
        results.innerHTML = '<div class="sop-search-empty">Type a keyword, page name, fee, color, or task.</div>';
        return;
      }
      if (!items.length) {
        results.innerHTML = '<div class="sop-search-empty">No matches yet.</div>';
        return;
      }
      results.innerHTML = items.slice(0, 8).map(item =>
        '<a class="sop-search-result" href="' + item.href + '">' +
          '<span class="search-result-title">' + escapeHTML(item.title) + '</span>' +
          '<span class="search-result-excerpt">' + escapeHTML(excerpt(item.text, q)) + '</span>' +
        '</a>'
      ).join('');
    }
    function runSearch() {
      const q = input.value.trim();
      loadSearchIndex().then(index => {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        const matches = index
          .map(item => {
            const titleHay = item.title.toLowerCase();
            const textHay = item.text.toLowerCase();
            const score = terms.reduce((sum, term) => {
              let s = 0;
              if (titleHay.includes(term)) s += 5;
              if (textHay.includes(term)) s += 1;
              return sum + s;
            }, 0);
            return { ...item, score };
          })
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
        render(matches, q);
      });
    }

    toggle.addEventListener('click', () => {
      if (wrap.classList.contains('open')) closeSearch();
      else openSearch();
    });
    input.addEventListener('input', runSearch);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape' && wrap.classList.contains('open')) closeSearch();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!wrap.classList.contains('open')) return;
      if (wrap.contains(e.target)) return;
      closeSearch();
    });
    render([], '');
  }

  // ---------- HAMBURGER DRAWER ----------
  const SECTIONS = [
    { num: '',   title: 'Cover',                  sub: 'Contents · welcome',          href: 'index.html' },
    { num: '01', title: 'Daily Shift Tracker',    sub: 'One live daily workspace',    href: '13-huddle-sheet.html' },
    { num: '02', title: 'Opening Procedures',     sub: 'Before the first patient',    href: '02-opening.html' },
    { num: '03', title: 'New Patient Phone Call', sub: 'Smile before you answer',     href: '03-new-patient-call.html' },
    { num: '04', title: 'Day 1 — First Visit',    sub: 'New patient · green block',   href: '04-day-1.html' },
    { num: '05', title: 'Day 2 — ROF',            sub: 'Report of Findings · $55',    href: '05-day-2-rof.html' },
    { num: '06', title: 'Day 3 — Onboarding',     sub: 'Auto debit · app · schedule', href: '06-day-3.html' },
    { num: '07', title: 'Adjustment Visit',       sub: '$65 · fee schedule',          href: '07-adjustment.html' },
    { num: '08', title: 'SoftWave',               sub: 'Call to confirm · deposit',   href: '08-softwave.html' },
    { num: '09', title: 'Checkout — Every Visit', sub: 'Check · Collect · Schedule',  href: '09-checkout.html' },
    { num: '10', title: 'Closing Procedures',     sub: 'After the last patient',      href: '10-closing.html' },
    { num: '11', title: 'Systems & Forms',        sub: 'Quick lookup',                href: '11-systems-forms.html' },
    { num: '12', title: 'Rules & Color Guide',    sub: 'Appt colors · alerts',        href: '12-rules-colors.html' },
    { num: 'Info', title: 'Office Information',   sub: 'Contact · schedule · systems',href: '01-office-info.html' }
  ];

  function initDrawer() {
    const existingBtn = document.querySelector('.sop-hamburger');
    const existingDrawer = document.querySelector('.sop-drawer');

    if (existingBtn && existingDrawer) {
      const existingBackdrop = document.querySelector('.sop-backdrop');
      existingBtn.classList.remove('hidden');
      existingDrawer.classList.remove('open');
      if (existingBackdrop) existingBackdrop.classList.remove('open');
      document.body.classList.remove('sop-drawer-open');
      return;
    }

    document.querySelectorAll('.sop-hamburger, .sop-backdrop, .sop-drawer').forEach(el => el.remove());

    // Remove old "Contents" link in topnav since the hamburger replaces it
    document.querySelectorAll('.topnav .nav-links a').forEach(a => {
      if (a.getAttribute('href') === 'index.html' && a.textContent.trim() === 'Contents') {
        a.remove();
      }
    });

    // Hamburger button
    const btn = document.createElement('button');
    btn.className = 'sop-hamburger';
    btn.setAttribute('aria-label', 'Open contents menu');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<line x1="4" y1="7" x2="20" y2="7"/>' +
      '<line x1="4" y1="12" x2="20" y2="12"/>' +
      '<line x1="4" y1="17" x2="20" y2="17"/>' +
      '</svg>';
    document.body.appendChild(btn);

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sop-backdrop';
    document.body.appendChild(backdrop);

    // Drawer
    const drawer = document.createElement('aside');
    drawer.className = 'sop-drawer';
    drawer.setAttribute('aria-label', 'Contents');
    const items = SECTIONS.map(s => {
      const isCurrent = s.href === PAGE_ID || (PAGE_ID === '' && s.href === 'index.html');
      return (
        '<a href="' + s.href + '" class="sop-drawer-item' + (isCurrent ? ' current' : '') + '">' +
          '<span class="drawer-num">' + (s.num || '✿') + '</span>' +
          '<span class="drawer-text">' +
            '<span class="drawer-title">' + s.title + '</span>' +
            '<span class="drawer-sub">' + s.sub + '</span>' +
          '</span>' +
        '</a>'
      );
    }).join('');
    const huddleIdx = getHuddleIndex();
    const huddleItems = huddleIdx.map((h, i) => {
      const fallback = 'Shift ' + (huddleIdx.length - i);
      const title = getHuddleTitle(h.id, fallback);
      const href = HUDDLE_PAGE + '?id=' + h.id;
      const isCurrent = href === PAGE_ID;
      return (
        '<a href="' + href + '" class="sop-drawer-item huddle-item' + (isCurrent ? ' current' : '') + '">' +
          '<span class="drawer-num">01</span>' +
          '<span class="drawer-text">' +
            '<span class="drawer-title">' + escapeHTML(title) + '</span>' +
            '<span class="drawer-sub">Saved shift</span>' +
          '</span>' +
        '</a>'
      );
    }).join('');
    const huddleSection =
      '<div class="sop-drawer-section-label">Shift Journal</div>' +
      huddleItems +
      '<button class="sop-drawer-add sop-drawer-add-huddle" type="button" aria-label="Add a new shift">' +
        '<span class="add-plus">+</span><span>New shift</span>' +
      '</button>';
    const notesIdx = getNotesIndex();
    const notesItems = notesIdx.map((n, i) => {
      const fallback = 'Note ' + (i + 1);
      const title = getNoteTitle(n.id, fallback);
      const href = NOTES_PAGE + '?id=' + n.id;
      const isCurrent = href === PAGE_ID;
      return (
        '<a href="' + href + '" class="sop-drawer-item notes-item' + (isCurrent ? ' current' : '') + '">' +
          '<span class="drawer-num">✎</span>' +
          '<span class="drawer-text">' +
            '<span class="drawer-title">' + escapeHTML(title) + '</span>' +
            '<span class="drawer-sub">Blank notes</span>' +
          '</span>' +
        '</a>'
      );
    }).join('');
    const notesSection =
      '<div class="sop-drawer-section-label">Notes</div>' +
      notesItems +
      '<button class="sop-drawer-add sop-drawer-add-note" type="button" aria-label="Add a new note">' +
        '<span class="add-plus">+</span><span>Add a note</span>' +
      '</button>';

    drawer.innerHTML =
      '<header class="sop-drawer-head">' +
        '<div class="drawer-brand">' +
          '<span class="drawer-bloom">✿</span>' +
          '<span class="drawer-name">Café of Life<em>Chiropractic &amp; Wellness</em></span>' +
        '</div>' +
        '<button class="sop-drawer-close" aria-label="Close menu">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
        '</button>' +
      '</header>' +
      '<nav class="sop-drawer-nav">' + items + huddleSection + notesSection + '</nav>';
    document.body.appendChild(drawer);

    drawer.querySelector('.sop-drawer-add-huddle').addEventListener('click', (e) => {
      e.preventDefault();
      const id = addHuddle();
      location.href = HUDDLE_PAGE + '?id=' + id;
    });

    drawer.querySelector('.sop-drawer-add-note').addEventListener('click', (e) => {
      e.preventDefault();
      const id = addNote();
      location.href = NOTES_PAGE + '?id=' + id;
    });

    function outsideHandler(e) {
      if (drawer.contains(e.target)) return;
      if (btn.contains(e.target)) return;
      close();
    }

    function open() {
      drawer.classList.add('open');
      backdrop.classList.add('open');
      btn.classList.add('hidden');
      document.body.classList.add('sop-drawer-open');
      // Defer so the opening tap itself doesn't trigger the outside handler
      setTimeout(() => {
        document.addEventListener('pointerdown', outsideHandler, true);
      }, 0);
    }
    function close() {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      btn.classList.remove('hidden');
      document.body.classList.remove('sop-drawer-open');
      document.removeEventListener('pointerdown', outsideHandler, true);
    }

    btn.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    drawer.querySelector('.sop-drawer-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  // ---------- FIRST-RUN HINT ----------
  function initHint() {
    const HINT_KEY = 'cofl_sop_hint_v1';
    if (localStorage.getItem(HINT_KEY)) return;
    const hint = document.createElement('div');
    hint.className = 'sop-hint';
    hint.innerHTML =
      '<strong>Tap</strong> checkboxes to fill them in.<br>' +
      '<strong>Write</strong> anywhere with your Apple Pencil. ✿<br>' +
      '<button class="hint-dismiss">Got it</button>';
    document.body.appendChild(hint);
    hint.querySelector('.hint-dismiss').addEventListener('click', () => {
      localStorage.setItem(HINT_KEY, '1');
      hint.remove();
    });
  }

  // ---------- STYLUS SCROLL BLOCK ----------
  // On iPad Safari, the pencil produces touch events that start scrolling
  // BEFORE the pointerdown handler runs. preventDefault on touchstart/move
  // when touchType === 'stylus' stops the scroll without affecting finger scroll.
  function blockStylusScroll() {
    const handler = (e) => {
      const touches = e.touches || [];
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].touchType === 'stylus') {
          e.preventDefault();
          return;
        }
      }
    };
    document.addEventListener('touchstart', handler, { passive: false });
    document.addEventListener('touchmove', handler, { passive: false });
  }

  // ---------- HUDDLE SHEET ----------
  // Appt types pulled from §12 Rules & Colors + §07 fee schedule.
  // `charge` is the default that auto-fills; null = no fixed default.
  const APPT_TYPES = [
    { key: 'newpt',     name: 'New Patient / NP Day 1', short: 'NP D1', chip: 'chip-green',     charge: 'Deposit' },
    { key: 'adj',       name: 'Adjustment',          short: 'Adj',     chip: 'chip-blue',      charge: 65   },
    { key: 'reexam',    name: 'Re-Exam',             short: 'Re-Exam', chip: 'chip-yellow',    charge: 45   },
    { key: 'rof',       name: 'ROF / Day 2',         short: 'ROF/D2',  chip: 'chip-red',       charge: 55   },
    { key: 'day3',      name: 'Day 3',               short: 'Day 3',   chip: 'chip-burgundy',  charge: null },
    { key: 'swdisc',    name: 'SoftWave Discovery',  short: 'SW Disc', chip: 'chip-purple',    charge: 25   },
    { key: 'softwave',  name: 'SoftWave Follow-Up',  short: 'SW F/U',  chip: 'chip-purple',    charge: null },
    { key: 'exercise',  name: 'Exercise Consult',    short: 'Exerc.',  chip: 'chip-grey',      charge: 95   },
    { key: 'maint',     name: 'Wellness / Maintenance', short: 'Well.', chip: 'chip-pink',     charge: null }
  ];
  const APPT_BY_KEY = Object.fromEntries(APPT_TYPES.map(t => [t.key, t]));
  const APPT_REQUIREMENTS = {
    newpt: {
      title: 'New Patient / NP Day 1',
      groups: [
        { title: 'Before Patient Arrives', items: ['Forms received / imported', 'Review Wave checked', 'CT patient created or updated', 'Insurance / ID ready if applicable', 'NP file/card ready'] },
        { title: 'During Appointment', items: ['Meet and greet warmly', 'Collect Day 1 payment before services', 'Copy insurance card / photo ID if needed', 'Give Day 1 handout', 'Take patient photo', 'Office tour / video handled'] },
        { title: 'Before Patient Leaves', items: ['ROF scheduled', 'ROF handout given', 'Receipt signed/scanned/shredded if applicable', 'CT notes updated', 'File placed in ROF holder', 'Next appointment confirmed out loud', 'Done'] }
      ]
    },
    adj: {
      title: 'Adjustment',
      groups: [
        { title: 'Before Patient Arrives', items: ['Ledger checked', 'Balance checked', 'Alerts/red letters checked', 'Future appointments checked'] },
        { title: 'During Appointment', items: ['Collect payment if due before service', 'Ask permission to use card on file if applicable', 'Doctor performs adjustment'] },
        { title: 'Before Patient Leaves', items: ['Receipt signed/scanned/shredded if applicable', 'Next appointment scheduled', 'Date/time confirmed out loud', 'Notes/action items completed', 'Done'] }
      ]
    },
    reexam: {
      title: 'Re-Exam',
      groups: [
        { title: 'Before Patient Arrives', items: ['Re-exam confirmed', 'Fee/payment status checked', 'Notes/progress reviewed'] },
        { title: 'During Appointment', items: ['Fee collected if due', 'Doctor completes re-exam', 'Progress/next phase discussed'] },
        { title: 'Before Patient Leaves', items: ['Next appointments scheduled', 'Notes completed', 'Date/time confirmed out loud', 'Done'] }
      ]
    },
    rof: {
      title: 'ROF / Day 2',
      groups: [
        { title: 'Before Patient Arrives', items: ['ROF confirmed on schedule', 'Care plan prepared', 'Insurance / coverage reviewed if applicable', 'Room/video ready'] },
        { title: 'During Appointment', items: ['Collect $55 ROF fee', 'Give Day 2 handout', 'Patient reads handout', 'Start video / prepare room', 'Notify doctor patient is ready'] },
        { title: 'Before Patient Leaves', items: ['Care plan signed', 'Payment option selected', 'First payment collected', 'ROF note entered', 'Future adjustments scheduled', 'Re-exam scheduled', 'Exercise consult scheduled', 'Day 3 scheduled', 'Schedule copy given', 'Date/time confirmed out loud', 'Done'] }
      ]
    },
    maint: {
      title: 'Wellness / Maintenance',
      groups: [
        { title: 'Before Patient Arrives', items: ['Ledger checked', 'Balance checked', 'Wellness plan/status checked', 'Future appointments checked'] },
        { title: 'During Appointment', items: ['Payment handled if due', 'Adjustment/wellness visit completed'] },
        { title: 'Before Patient Leaves', items: ['Next appointment scheduled', 'Date/time confirmed out loud', 'Notes/action items completed', 'Done'] }
      ]
    },
    exercise: {
      title: 'Exercise Consult',
      groups: [
        { title: 'Before Patient Arrives', items: ['Consult confirmed', 'Fee/payment status checked', 'Patient file reviewed'] },
        { title: 'During Appointment', items: ['Fee collected if due', 'Exercise consult completed', 'Home exercises reviewed'] },
        { title: 'Before Patient Leaves', items: ['Next appointment scheduled', 'Notes completed', 'Date/time confirmed out loud', 'Done'] }
      ]
    },
    day3: {
      title: 'Day 3',
      groups: [
        { title: 'Before Patient Arrives', items: ['Care plan/payment terms reviewed', 'Auto-debit/EZ Pay ready', 'CT file reviewed', 'Schedule needs reviewed'] },
        { title: 'During Appointment', items: ['Auto-debit setup', 'Authorization signed', 'PIN assigned', 'App shown/sent', 'Office flow reviewed', 'Cancellation policy reviewed'] },
        { title: 'Before Patient Leaves', items: ['Schedule built 1-6 months', 'Schedule copy printed/given', 'CT payment type updated', 'Alerts/packages updated if needed', 'Next appointment confirmed out loud', 'Done'] }
      ]
    },
    swdisc: {
      title: 'SoftWave Discovery',
      groups: [
        { title: 'Before Patient Arrives', items: ['Appointment confirmed by call, not text only', 'Deposit verified', 'Forms completed', 'Treatment area confirmed', 'Cancellation policy confirmed'] },
        { title: 'During Appointment', items: ['Payment collected if needed', 'Discovery completed', 'Approx. 500 pulses if applicable', 'Recommendation discussed'] },
        { title: 'Before Patient Leaves', items: ['Next SoftWave scheduled', 'Aftercare reviewed', 'No ice / Advil / ibuprofen reminder', 'Avoid intense exercise 2-3 days', 'Date/time confirmed out loud', 'Done'] }
      ]
    },
    softwave: {
      title: 'SoftWave Follow-Up',
      groups: [
        { title: 'Before Patient Arrives', items: ['Session/package checked', 'Payment status checked', 'Treatment area confirmed', 'Cancellation policy checked'] },
        { title: 'During Appointment', items: ['Payment collected if due', 'Treatment completed', '600-800 pulses if applicable'] },
        { title: 'Before Patient Leaves', items: ['Next SoftWave scheduled', 'Aftercare reviewed', 'Date/time confirmed out loud', 'Done'] }
      ]
    }
  };
  const UNIVERSAL_PATIENT_CHECKS = ['Payment handled', 'Ledger checked', 'Balance checked', 'Alerts checked', 'Next appointment scheduled', 'Date/time confirmed out loud', 'Notes/action items completed'];

  // Pay cycle: blank -> card -> cash -> PIF -> owes -> blank
  const PAY_STATES = [
    { key: 0, icon: '',   short: '',     full: 'Not set' },
    { key: 1, icon: 'CC', short: 'Card', full: 'Card on file / charge card' },
    { key: 2, icon: '$',  short: 'Cash', full: 'Cash / check' },
    { key: 3, icon: '0',  short: 'PIF',  full: 'Paid in full / no charge today' },
    { key: 4, icon: '!',  short: 'Owes', full: 'Owes balance' }
  ];

  function buildTimeSlots() {
    const slots = [];
    for (let h = 6; h <= 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 20 && m > 0) break;
        const hh = h % 12 || 12;
        const ampm = h < 12 ? 'AM' : 'PM';
        const mm = m === 0 ? '00' : String(m);
        slots.push(hh + ':' + mm + ' ' + ampm);
      }
    }
    return slots;
  }
  const TIME_SLOTS = buildTimeSlots();
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) return dateStr;
    const y = +m[1], mo = +m[2], d = +m[3];
    const date = new Date(y, mo - 1, d);
    const thisYear = new Date().getFullYear();
    return DAYS_SHORT[date.getDay()] + ', ' + MONTHS_SHORT[mo - 1] + ' ' + d + (y === thisYear ? '' : ', ' + y);
  }
  function formatNextAppt(obj) {
    if (!obj) return '';
    const parts = [];
    if (obj.date) parts.push(formatDateShort(obj.date));
    if (obj.time) parts.push(obj.time);
    return parts.join(' · ');
  }

  function applyApptToButton(btn, apptKey) {
    btn.innerHTML = '';
    btn.classList.remove('is-empty');
    if (!apptKey) {
      btn.classList.add('is-empty');
      return;
    }
    const type = APPT_BY_KEY[apptKey];
    if (!type) {
      btn.classList.add('is-empty');
      return;
    }
    const chipClass = type.chip === 'chip-black'
      ? 'appt-chip'
      : 'appt-chip ' + type.chip;
    const chip = document.createElement('span');
    chip.className = chipClass;
    if (type.chip === 'chip-black') chip.style.background = '#1d1d1d';
    const label = document.createElement('span');
    label.className = 'appt-label';
    label.textContent = type.short;
    btn.appendChild(chip);
    btn.appendChild(label);
  }

  function formatChargeValue(charge) {
    if (charge == null) return '';
    if (typeof charge === 'number') return '$' + charge;
    return String(charge);
  }

  function applyChargeDefault(rowIdx, apptKey) {
    const input = document.querySelector('.charge-input[data-row="' + rowIdx + '"]');
    if (!input) return;
    const type = APPT_BY_KEY[apptKey];
    const value = type ? formatChargeValue(type.charge) : '';
    input.value = value;
    state['in_huddle_charge_' + rowIdx] = value;
    input.classList.toggle('has-default-charge', !!value);
    scheduleSave();
  }

  function refreshChargeDefault(rowIdx, apptKey) {
    const input = document.querySelector('.charge-input[data-row="' + rowIdx + '"]');
    if (!input) return;
    const type = APPT_BY_KEY[apptKey];
    const value = type ? formatChargeValue(type.charge) : '';
    const key = 'in_huddle_charge_' + rowIdx;
    if (state[key] == null || state[key] === '') {
      input.value = value;
      state[key] = value;
    } else {
      input.value = state[key];
    }
    input.classList.toggle('has-default-charge', !!input.value);
  }

  function applyPayState(btn, stateIdx) {
    const s = PAY_STATES[stateIdx] || PAY_STATES[0];
    if (s.icon) {
      btn.innerHTML =
        '<span class="pay-icon">' + s.icon + '</span>' +
        '<span class="pay-label">' + s.short + '</span>';
    } else {
      btn.innerHTML = '';
    }
    btn.title = s.full;
    btn.classList.remove('state-1', 'state-2', 'state-3', 'state-4');
    if (stateIdx > 0) btn.classList.add('state-' + stateIdx);
  }

  function applyTimeToButton(btn, timeStr) {
    btn.textContent = timeStr || '';
    btn.classList.toggle('is-empty', !timeStr);
  }
  function applyNextApptToButton(btn, obj) {
    const text = formatNextAppt(obj);
    btn.textContent = text;
    btn.classList.toggle('is-empty', !text);
  }

  function huddleRowCount() {
    return document.querySelectorAll('.huddle-table .appt-type-btn[data-row]').length;
  }

  function huddleBaseRowCount() {
    const tbody = document.querySelector('tbody[data-huddle-rows]');
    return tbody ? (+tbody.dataset.huddleRows || 15) : 15;
  }

  function huddleRowKeys(rowIdx) {
    const keys = [
      'in_huddle_patient_' + rowIdx,
      'in_huddle_balance_' + rowIdx,
      'in_huddle_notes_' + rowIdx,
      'bool_huddle_status_' + rowIdx,
      'huddle_appt_' + rowIdx,
      'huddle_time_' + rowIdx
    ];
    Object.keys(APPT_REQUIREMENTS).forEach(apptKey => {
      APPT_REQUIREMENTS[apptKey].groups.forEach((group, groupIdx) => {
        group.items.forEach((_, itemIdx) => {
          keys.push(rowRequirementKey(rowIdx, apptKey, groupIdx + '_' + itemIdx));
        });
      });
    });
    UNIVERSAL_PATIENT_CHECKS.forEach((_, itemIdx) => {
      keys.push(rowRequirementKey(rowIdx, 'universal', itemIdx));
    });
    return keys;
  }

  function getHuddleRowState(rowIdx) {
    return huddleRowKeys(rowIdx).map(key => ({
      hasValue: Object.prototype.hasOwnProperty.call(state, key),
      value: state[key]
    }));
  }

  function clearHuddleRowState(rowIdx) {
    huddleRowKeys(rowIdx).forEach(key => delete state[key]);
  }

  function isHuddleRowEmpty(rowIdx) {
    return !huddleRowKeys(rowIdx).some(key => {
      const v = state[key];
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'boolean') return v;
      return !!v;
    });
  }

  function copyHuddleRowState(fromIdx, toIdx) {
    const fromKeys = huddleRowKeys(fromIdx);
    const toKeys = huddleRowKeys(toIdx);
    clearHuddleRowState(toIdx);
    fromKeys.forEach((fromKey, idx) => {
      if (Object.prototype.hasOwnProperty.call(state, fromKey)) state[toKeys[idx]] = state[fromKey];
    });
  }

  function restoreHuddleRowState(rowIdx, values) {
    clearHuddleRowState(rowIdx);
    const keys = huddleRowKeys(rowIdx);
    keys.forEach((key, idx) => {
      if (values[idx] && values[idx].hasValue) state[key] = values[idx].value;
    });
  }

  function refreshHuddleRow(rowIdx) {
    ['patient', 'balance', 'notes'].forEach(field => {
      const el = document.querySelector('[name="huddle_' + field + '_' + rowIdx + '"]');
      const key = 'in_huddle_' + field + '_' + rowIdx;
      if (el) el.value = state[key] || '';
    });
    const apptKey = state['huddle_appt_' + rowIdx] || null;
    const apptBtn = document.querySelector('.appt-type-btn[data-row="' + rowIdx + '"]');
    if (apptBtn) applyApptToButton(apptBtn, apptKey);
    const timeBtn = document.querySelector('.time-btn[data-row="' + rowIdx + '"]');
    if (timeBtn) applyTimeToButton(timeBtn, state['huddle_time_' + rowIdx] || '');
    const status = document.querySelector('[name="huddle_status_' + rowIdx + '"]');
    if (status) status.checked = !!state['bool_huddle_status_' + rowIdx];
    renderRowRequirements(rowIdx, apptKey);
  }

  function swapHuddleRows(a, b) {
    if (a < 0 || b < 0 || a >= huddleRowCount() || b >= huddleRowCount()) return;
    const aValues = getHuddleRowState(a);
    const bValues = getHuddleRowState(b);
    restoreHuddleRowState(a, bValues);
    restoreHuddleRowState(b, aValues);
    refreshHuddleRow(a);
    refreshHuddleRow(b);
    scheduleSave();
  }

  function removeLastHuddleRow(tbody) {
    const lastReq = tbody.querySelector('.huddle-requirements-row:last-child');
    if (lastReq) lastReq.remove();
    const lastMain = tbody.querySelector('tr:last-child');
    if (lastMain) lastMain.remove();
  }

  function deleteHuddleRow(rowIdx) {
    const total = huddleRowCount();
    if (rowIdx < 0 || rowIdx >= total) return;
    if (!isHuddleRowEmpty(rowIdx) && !confirm('Remove this patient row?')) return;
    for (let i = rowIdx; i < total - 1; i++) copyHuddleRowState(i + 1, i);
    clearHuddleRowState(total - 1);
    const tbody = document.querySelector('tbody[data-huddle-rows]');
    if (tbody && total > 1 && total > huddleBaseRowCount()) {
      removeLastHuddleRow(tbody);
      state.huddle_row_count = total - 1;
    } else {
      state.huddle_row_count = Math.max(total, huddleBaseRowCount());
    }
    for (let i = rowIdx; i < huddleRowCount(); i++) refreshHuddleRow(i);
    updateHuddleNotDone();
    scheduleSave();
  }

  let pickerEls = null;
  function buildPicker() {
    if (pickerEls) return pickerEls;
    const backdrop = document.createElement('div');
    backdrop.className = 'appt-picker-backdrop';
    const modal = document.createElement('div');
    modal.className = 'appt-picker';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Pick appointment type');

    let gridHtml = '';
    APPT_TYPES.forEach(t => {
      const chipStyle = t.chip === 'chip-black' ? ' style="background:#1d1d1d;"' : '';
      const chipClass = t.chip === 'chip-black' ? 'appt-chip' : 'appt-chip ' + t.chip;
      const price = formatChargeValue(t.charge) || '-';
      gridHtml +=
        '<button type="button" class="appt-pick" data-key="' + t.key + '">' +
          '<span class="' + chipClass + '"' + chipStyle + '></span>' +
          '<span class="appt-pick-text">' +
            '<span class="appt-pick-name">' + t.name + '</span>' +
            '<span class="appt-pick-price">' + price + '</span>' +
          '</span>' +
        '</button>';
    });
    gridHtml += '<button type="button" class="appt-pick-clear">Clear this row</button>';

    modal.innerHTML =
      '<header class="appt-picker-head">' +
        '<h3>Pick appointment type</h3>' +
        '<button type="button" class="appt-picker-close" aria-label="Close">✕</button>' +
      '</header>' +
      '<div class="appt-picker-grid">' + gridHtml + '</div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    pickerEls = { backdrop, modal, currentRow: null };

    function close() {
      modal.classList.remove('open');
      backdrop.classList.remove('open');
      pickerEls.currentRow = null;
    }

    backdrop.addEventListener('click', close);
    modal.querySelector('.appt-picker-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });

    modal.querySelectorAll('.appt-pick').forEach(b => {
      b.addEventListener('click', () => {
        if (pickerEls.currentRow == null) return close();
        setRowAppt(pickerEls.currentRow, b.dataset.key);
        close();
      });
    });
    modal.querySelector('.appt-pick-clear').addEventListener('click', () => {
      if (pickerEls.currentRow == null) return close();
      setRowAppt(pickerEls.currentRow, null);
      close();
    });

    pickerEls.close = close;
    pickerEls.open = (rowIdx) => {
      pickerEls.currentRow = rowIdx;
      backdrop.classList.add('open');
      modal.classList.add('open');
    };
    return pickerEls;
  }

  function setRowAppt(rowIdx, apptKey) {
    state['huddle_appt_' + rowIdx] = apptKey || '';
    scheduleSave();
    const btn = document.querySelector('.appt-type-btn[data-row="' + rowIdx + '"]');
    if (btn) applyApptToButton(btn, apptKey);
    renderRowRequirements(rowIdx, apptKey);
    updateHuddleNotDone();
  }

  function setRowPay(rowIdx, stateIdx) {
    state['huddle_pay_' + rowIdx] = stateIdx;
    scheduleSave();
    const btn = document.querySelector('.pay-btn[data-row="' + rowIdx + '"]');
    if (btn) applyPayState(btn, stateIdx);
  }

  function setRowTime(rowIdx, timeStr) {
    state['huddle_time_' + rowIdx] = timeStr || '';
    scheduleSave();
    const btn = document.querySelector('.time-btn[data-row="' + rowIdx + '"]');
    if (btn) applyTimeToButton(btn, timeStr);
  }

  function setRowNextAppt(rowIdx, obj) {
    state['huddle_nextappt_' + rowIdx] = obj || null;
    scheduleSave();
    const btn = document.querySelector('.nextappt-btn[data-row="' + rowIdx + '"]');
    if (btn) applyNextApptToButton(btn, obj);
  }

  // ---- Time picker modal ----
  let timePickerEls = null;
  function buildTimePicker() {
    if (timePickerEls) return timePickerEls;
    const backdrop = document.createElement('div');
    backdrop.className = 'cell-picker-backdrop time-picker-backdrop';
    const modal = document.createElement('div');
    modal.className = 'cell-picker time-picker';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Pick time');

    let gridHtml = '';
    TIME_SLOTS.forEach(t => {
      gridHtml += '<button type="button" class="time-pick" data-time="' + t + '">' + t + '</button>';
    });

    modal.innerHTML =
      '<header class="cell-picker-head">' +
        '<h3>Pick time</h3>' +
        '<button type="button" class="cell-picker-close" aria-label="Close">✕</button>' +
      '</header>' +
      '<div class="time-picker-grid">' + gridHtml + '</div>' +
      '<button type="button" class="cell-picker-clear">Clear time</button>';

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    timePickerEls = { backdrop, modal, currentRow: null };
    function close() {
      modal.classList.remove('open');
      backdrop.classList.remove('open');
      timePickerEls.currentRow = null;
    }
    backdrop.addEventListener('click', close);
    modal.querySelector('.cell-picker-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
    modal.querySelectorAll('.time-pick').forEach(b => {
      b.addEventListener('click', () => {
        if (timePickerEls.currentRow == null) return close();
        setRowTime(timePickerEls.currentRow, b.dataset.time);
        close();
      });
    });
    modal.querySelector('.cell-picker-clear').addEventListener('click', () => {
      if (timePickerEls.currentRow == null) return close();
      setRowTime(timePickerEls.currentRow, '');
      close();
    });

    timePickerEls.open = (rowIdx) => {
      timePickerEls.currentRow = rowIdx;
      backdrop.classList.add('open');
      modal.classList.add('open');
      const saved = state['huddle_time_' + rowIdx] || '';
      modal.querySelectorAll('.time-pick').forEach(b => {
        b.classList.toggle('selected', b.dataset.time === saved);
      });
      const sel = modal.querySelector('.time-pick.selected');
      if (sel) {
        setTimeout(() => sel.scrollIntoView({ block: 'center', behavior: 'instant' }), 0);
      }
    };
    return timePickerEls;
  }

  // ---- Next-appt picker (native date + time grid) ----
  let nextApptPickerEls = null;
  function buildNextApptPicker() {
    if (nextApptPickerEls) return nextApptPickerEls;
    const backdrop = document.createElement('div');
    backdrop.className = 'cell-picker-backdrop nextappt-picker-backdrop';
    const modal = document.createElement('div');
    modal.className = 'cell-picker nextappt-picker';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Pick next appointment');

    let gridHtml = '';
    TIME_SLOTS.forEach(t => {
      gridHtml += '<button type="button" class="time-pick" data-time="' + t + '">' + t + '</button>';
    });

    modal.innerHTML =
      '<header class="cell-picker-head">' +
        '<h3>Pick next appt</h3>' +
        '<button type="button" class="cell-picker-close" aria-label="Close">✕</button>' +
      '</header>' +
      '<div class="nextappt-date-row">' +
        '<label for="nextappt-date-input">Date</label>' +
        '<input id="nextappt-date-input" type="date" class="nextappt-date-input">' +
      '</div>' +
      '<div class="nextappt-time-label">Time <span>(tap to confirm)</span></div>' +
      '<div class="time-picker-grid">' + gridHtml + '</div>' +
      '<button type="button" class="cell-picker-clear">Clear next appt</button>';

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    const dateInput = modal.querySelector('.nextappt-date-input');

    nextApptPickerEls = { backdrop, modal, dateInput, currentRow: null };

    function close() {
      modal.classList.remove('open');
      backdrop.classList.remove('open');
      nextApptPickerEls.currentRow = null;
    }
    backdrop.addEventListener('click', close);
    modal.querySelector('.cell-picker-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
    dateInput.addEventListener('input', () => {
      if (nextApptPickerEls.currentRow == null) return;
      const current = state['huddle_nextappt_' + nextApptPickerEls.currentRow] || {};
      setRowNextAppt(nextApptPickerEls.currentRow, {
        date: dateInput.value,
        time: current.time || ''
      });
    });
    modal.querySelectorAll('.time-pick').forEach(b => {
      b.addEventListener('click', () => {
        if (nextApptPickerEls.currentRow == null) return close();
        setRowNextAppt(nextApptPickerEls.currentRow, {
          date: dateInput.value || '',
          time: b.dataset.time
        });
        close();
      });
    });
    modal.querySelector('.cell-picker-clear').addEventListener('click', () => {
      if (nextApptPickerEls.currentRow == null) return close();
      setRowNextAppt(nextApptPickerEls.currentRow, null);
      dateInput.value = '';
      close();
    });

    nextApptPickerEls.open = (rowIdx) => {
      nextApptPickerEls.currentRow = rowIdx;
      const saved = state['huddle_nextappt_' + rowIdx] || {};
      dateInput.value = saved.date || '';
      backdrop.classList.add('open');
      modal.classList.add('open');
      modal.querySelectorAll('.time-pick').forEach(b => {
        b.classList.toggle('selected', b.dataset.time === (saved.time || ''));
      });
      const sel = modal.querySelector('.time-pick.selected');
      if (sel) {
        setTimeout(() => sel.scrollIntoView({ block: 'center', behavior: 'instant' }), 0);
      }
    };
    return nextApptPickerEls;
  }

  function huddleRowHTML(i) {
    return (
      '<tr>' +
        '<td class="time-cell"><button class="time-btn cell-btn is-empty" type="button" data-row="' + i + '" aria-label="Pick time"></button></td>' +
        '<td class="input-cell"><textarea class="sop-text cell-input autogrow" name="huddle_patient_' + i + '" autocomplete="off" enterkeyhint="next" aria-label="Patient name row ' + (i + 1) + '"></textarea></td>' +
        '<td class="appt-cell"><button class="appt-type-btn is-empty" type="button" data-row="' + i + '" aria-label="Pick appointment type"></button></td>' +
        '<td class="input-cell"><textarea class="sop-text cell-input autogrow" name="huddle_balance_' + i + '" autocomplete="off" aria-label="Balance or payment note row ' + (i + 1) + '"></textarea></td>' +
        '<td class="input-cell"><textarea class="sop-text cell-input autogrow" name="huddle_notes_' + i + '" autocomplete="off" aria-label="Huddle note row ' + (i + 1) + '"></textarea></td>' +
        '<td class="huddle-status-cell"><label class="huddle-status-done"><input class="sop-bool huddle-done-check" name="huddle_status_' + i + '" type="checkbox" data-row="' + i + '"> Done</label></td>' +
        '<td class="huddle-row-actions">' +
          '<button type="button" data-huddle-row-delete data-row="' + i + '" aria-label="Remove row">Remove</button>' +
        '</td>' +
      '</tr>' +
      '<tr class="huddle-requirements-row" data-req-row="' + i + '" hidden>' +
        '<td class="huddle-requirements-cell" colspan="7"></td>' +
      '</tr>'
    );
  }

  function rowRequirementKey(rowIdx, apptKey, itemId) {
    return 'huddle_req_' + rowIdx + '_' + apptKey + '_' + itemId;
  }

  function renderRowRequirements(rowIdx, apptKey) {
    const row = document.querySelector('.huddle-requirements-row[data-req-row="' + rowIdx + '"]');
    if (!row) return;
    const cell = row.querySelector('.huddle-requirements-cell');
    const req = APPT_REQUIREMENTS[apptKey];
    if (!cell || !req) {
      row.hidden = true;
      if (cell) cell.innerHTML = '';
      return;
    }

    const groupHtml = req.groups.map((group, groupIdx) => {
      const items = group.items.map((item, itemIdx) => {
        const key = rowRequirementKey(rowIdx, apptKey, groupIdx + '_' + itemIdx);
        const checked = state[key] ? ' checked' : '';
        return (
          '<label class="huddle-req-item">' +
            '<input class="huddle-req-check" type="checkbox" data-key="' + key + '"' + checked + '>' +
            '<span>' + escapeHTML(item) + '</span>' +
          '</label>'
        );
      }).join('');
      return '<div class="huddle-req-group"><h4>' + escapeHTML(group.title) + '</h4>' + items + '</div>';
    }).join('');

    const universalHtml = UNIVERSAL_PATIENT_CHECKS.map((item, itemIdx) => {
      const key = rowRequirementKey(rowIdx, 'universal', itemIdx);
      const checked = state[key] ? ' checked' : '';
      return (
        '<label class="huddle-req-item huddle-req-universal">' +
          '<input class="huddle-req-check" type="checkbox" data-key="' + key + '"' + checked + '>' +
          '<span>' + escapeHTML(item) + '</span>' +
        '</label>'
      );
    }).join('');

    cell.innerHTML =
      '<div class="huddle-req-panel">' +
        '<div class="huddle-req-title">' +
          '<strong>' + escapeHTML(req.title) + '</strong>' +
          '<span>Patient-specific checklist</span>' +
        '</div>' +
        '<div class="huddle-req-items">' + groupHtml + '<div class="huddle-req-group universal"><h4>Universal Checks</h4>' + universalHtml + '</div></div>' +
      '</div>';
    row.hidden = false;

    cell.querySelectorAll('.huddle-req-check').forEach(input => {
      input.addEventListener('change', () => {
        state[input.dataset.key] = input.checked;
        scheduleSave();
      });
    });
  }

  // ---------- COMMAND CENTER ----------
  const COMMAND_APPT_TYPES = [
    { key: 'np', name: 'NP', chip: 'chip-green' },
    { key: 'rof', name: 'ROF', chip: 'chip-red' },
    { key: 'day3', name: 'Day 3', chip: 'chip-burgundy' },
    { key: 'adjustment', name: 'Adjustment', chip: 'chip-blue' },
    { key: 'swdisc', name: 'SoftWave Discovery', chip: 'chip-purple' },
    { key: 'swfollow', name: 'SoftWave Follow-Up', chip: 'chip-purple' },
    { key: 'reexam', name: 'Re-Exam', chip: 'chip-yellow' },
    { key: 'exercise', name: 'Exercise Consult', chip: 'chip-grey' },
    { key: 'wellness', name: 'Wellness', chip: 'chip-lightblue' }
  ];
  const COMMAND_APPT_BY_KEY = Object.fromEntries(COMMAND_APPT_TYPES.map(t => [t.key, t]));
  const COMMAND_REQUIREMENTS = {
    np: ['Appt/person entered to schedule & CT', 'NP intake imported/linked/scanned', 'Welcome email + confirmation call', 'Day 1 handout/tour/video ready', 'ROF next visit ready'],
    rof: ['$55 ROF payment handled', 'Spouse/significant other expectation checked', 'Care plan offered', 'Commitment noted: PPV/PIF/monthly/undecided', 'ROF note + Day 3/future visits set'],
    day3: ['EZ-Pay / signature-on-file handled', 'Auto debit/payment setup checked', 'PIN/app expectations handled', 'CT notes/alerts updated', 'Future schedule confirmed'],
    adjustment: ['Payment/ledger/balance checked', 'Alerts/red letters checked', 'Next adjustment scheduled', 'Doctor instruction completed'],
    swdisc: ['Confirmed by call, not text', '$25 deposit/payment checked', 'Treatment area + cancellation policy confirmed', 'SoftWave handout/aftercare ready', 'Next SoftWave scheduled'],
    swfollow: ['Package/payment status checked', 'Treatment area/timer ready', 'Aftercare covered', 'Next SoftWave scheduled'],
    reexam: ['Re-exam chart/paperwork ready', 'Payment/ledger checked', 'Doctor note/action captured', 'Next visit scheduled'],
    exercise: ['$95 exercise consult status checked', 'Forms/tools ready', 'Instructions documented', 'Next action scheduled'],
    wellness: ['Wellness/Maint case status checked', 'Payment/package checked', 'Care plan note if needed', 'Next wellness visit scheduled']
  };
  const COMMAND_UNIVERSAL_CHECKS = [
    ['payment', 'Payment handled'],
    ['ledger', 'Ledger checked'],
    ['balance', 'Balance checked'],
    ['alerts', 'Alerts checked'],
    ['nextappt', 'Next appointment scheduled'],
    ['confirmed', 'Date/time confirmed out loud'],
    ['notesdone', 'Notes/action items completed'],
    ['done', 'DONE']
  ];

  function commandTypeOptionsHTML() {
    let html = '<option value="">Appt type</option>';
    COMMAND_APPT_TYPES.forEach(type => {
      html += '<option value="' + type.key + '">' + escapeHTML(type.name) + '</option>';
    });
    return html;
  }

  function commandRowHTML(i) {
    const rowNum = i + 1;
    const universalChecks = COMMAND_UNIVERSAL_CHECKS.map(([key, label]) => (
      '<label class="' + (key === 'done' ? 'done-check' : '') + '">' +
        '<input class="sop-bool command-row-check" name="command_row_' + key + '_' + rowNum + '" type="checkbox" data-command-check="' + key + '" data-command-row="' + rowNum + '"> ' +
        escapeHTML(label) +
      '</label>'
    )).join('');

    return (
      '<article class="command-patient-card" data-command-row="' + rowNum + '">' +
        '<div class="patient-card-head command-tracker-head">' +
          '<input class="sop-text command-time-input" name="command_time_' + rowNum + '" type="text" placeholder="Time" autocomplete="off">' +
          '<input class="sop-text command-name-input" name="command_patient_' + rowNum + '" type="text" placeholder="Patient" autocomplete="off">' +
          '<select class="sop-select command-type-select" name="command_type_' + rowNum + '" data-command-type="' + rowNum + '">' + commandTypeOptionsHTML() + '</select>' +
          '<div class="command-type-badge" data-command-badge="' + rowNum + '"></div>' +
        '</div>' +
        '<div class="patient-update-row command-field-row">' +
          '<textarea class="sop-text autogrow" name="command_balance_note_' + rowNum + '" placeholder="Balance / payment note"></textarea>' +
          '<textarea class="sop-text autogrow" name="command_ct_note_' + rowNum + '" placeholder="CT alert / note"></textarea>' +
          '<textarea class="sop-text autogrow" name="command_huddle_note_' + rowNum + '" placeholder="Huddle note"></textarea>' +
          '<textarea class="sop-text autogrow" name="command_next_action_' + rowNum + '" placeholder="Next action"></textarea>' +
        '</div>' +
        '<div class="patient-flag-grid command-universal-grid">' + universalChecks + '</div>' +
        '<div class="command-type-requirements" data-command-requirements="' + rowNum + '" hidden></div>' +
      '</article>'
    );
  }

  function prepareCommandRows() {
    if (PAGE_FILE !== '15-command-center.html') return;
    const wrap = document.querySelector('[data-command-patient-rows]');
    if (!wrap || wrap.children.length) return;
    const n = Math.max(+wrap.dataset.commandPatientRows || 12, +state.command_row_count || 0);
    state.command_row_count = n;
    let html = '';
    for (let i = 0; i < n; i++) html += commandRowHTML(i);
    wrap.innerHTML = html;
  }

  function prepareHuddleRows() {
    if (PAGE_FILE !== HUDDLE_PAGE) return;
    const tbody = document.querySelector('tbody[data-huddle-rows]');
    if (!tbody || tbody.children.length) return;
    const baseCount = +tbody.dataset.huddleRows || 15;
    const n = Math.max(baseCount, +state.huddle_row_count || 0);
    let html = '';
    for (let i = 0; i < n; i++) html += huddleRowHTML(i);
    tbody.innerHTML = html;
  }

  function trackerDateKey(dateStr) {
    return 'command-center-' + dateStr;
  }

  function formatDayFromISO(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
    if (!m) return '';
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return DAYS_SHORT[d.getDay()];
  }

  function savedTrackerDates() {
    const dates = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const m = /^command-center-(\d{4}-\d{2}-\d{2})$/.exec(key || '');
        if (m) dates.push(m[1]);
      }
    } catch {}
    return dates.sort().reverse();
  }

  function saveCurrentTrackerNow() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function initHuddleDateControls() {
    const dateInput = document.querySelector('[data-huddle-date]');
    const dayInput = document.querySelector('[data-huddle-day]');
    const savedSelect = document.querySelector('[data-huddle-saved-days]');
    const meta = document.querySelector('.huddle-meta');
    const currentDate = currentTrackerDate();

    if (dateInput) dateInput.value = currentDate;
    if (dayInput) dayInput.value = formatDayFromISO(currentDate);
    if (meta) meta.textContent = 'Daily Shift Tracker · ' + currentDate;

    if (savedSelect) {
      const dates = savedTrackerDates();
      savedSelect.innerHTML = '<option value="">Saved days</option>' + dates.map(date => {
        const label = formatDayFromISO(date) + ' · ' + date;
        return '<option value="' + date + '"' + (date === currentDate ? ' selected' : '') + '>' + escapeHTML(label) + '</option>';
      }).join('');
      savedSelect.addEventListener('change', () => {
        if (!savedSelect.value || savedSelect.value === currentDate) return;
        saveCurrentTrackerNow();
        location.href = HUDDLE_PAGE + '?date=' + encodeURIComponent(savedSelect.value);
      });
    }

    if (dateInput && !dateInput.dataset.huddleBound) {
      dateInput.dataset.huddleBound = 'true';
      dateInput.addEventListener('change', () => {
        const nextDate = dateInput.value || todayISO();
        if (dayInput) dayInput.value = formatDayFromISO(nextDate);
        if (nextDate === currentDate) return;
        saveCurrentTrackerNow();
        location.href = HUDDLE_PAGE + '?date=' + encodeURIComponent(nextDate);
      });
    }
  }

  function updateShiftPanels() {
    const shift = document.querySelector('[data-huddle-shift]')?.value || 'morning';
    document.querySelectorAll('[data-shift-panel]').forEach(panel => {
      panel.hidden = panel.dataset.shiftPanel !== shift;
    });
  }

  function initHuddleShiftPanels() {
    const shiftSelect = document.querySelector('[data-huddle-shift]');
    if (shiftSelect) {
      if (!shiftSelect.value) {
        shiftSelect.value = 'morning';
        state.sel_huddle_shift_type = 'morning';
      }
      if (!shiftSelect.dataset.huddlePanelBound) {
        shiftSelect.dataset.huddlePanelBound = 'true';
        shiftSelect.addEventListener('change', () => {
          updateShiftPanels();
        });
      }
    }
    updateShiftPanels();
  }

  function rowHasVisibleHuddleContent(rowIdx) {
    return ['in_huddle_patient_', 'in_huddle_balance_', 'in_huddle_notes_', 'huddle_appt_', 'huddle_time_'].some(prefix => {
      const v = state[prefix + rowIdx];
      return typeof v === 'string' ? v.trim() !== '' : !!v;
    });
  }

  function updateHuddleNotDone() {
    const box = document.querySelector('[data-huddle-not-done]');
    if (!box) return;
    const missing = [];
    for (let i = 0; i < huddleRowCount(); i++) {
      if (!rowHasVisibleHuddleContent(i)) continue;
      if (state['bool_huddle_status_' + i]) continue;
      const name = (state['in_huddle_patient_' + i] || '').trim() || 'Row ' + (i + 1);
      const time = (state['huddle_time_' + i] || '').trim();
      missing.push((time ? time + ' · ' : '') + name);
    }
    box.hidden = missing.length === 0;
    box.innerHTML = missing.length
      ? '<strong>Patients not marked Done:</strong> ' + missing.map(escapeHTML).join(' · ')
      : '';
  }

  function initHuddle() {
    if (PAGE_FILE !== HUDDLE_PAGE) return;
    const table = document.querySelector('table[data-huddle="true"]');
    if (!table) return;
    initHuddleDateControls();
    initHuddleJournal();
    initHuddleShiftPanels();
    initHuddleLeaveGuard();
    buildPicker();
    buildTimePicker();

    function initHuddleControls(root) {
      root.querySelectorAll('.appt-type-btn').forEach(btn => {
        if (btn.dataset.huddleBound) return;
        btn.dataset.huddleBound = 'true';
      const row = +btn.dataset.row;
      const saved = state['huddle_appt_' + row] || null;
      applyApptToButton(btn, saved);
      renderRowRequirements(row, saved);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pickerEls.open(row);
      });
    });

      root.querySelectorAll('.time-btn').forEach(btn => {
        if (btn.dataset.huddleBound) return;
        btn.dataset.huddleBound = 'true';
      const row = +btn.dataset.row;
      const saved = state['huddle_time_' + row] || '';
      applyTimeToButton(btn, saved);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        timePickerEls.open(row);
      });
    });

      root.querySelectorAll('.huddle-done-check').forEach(btn => {
        if (btn.dataset.huddleBound) return;
        btn.dataset.huddleBound = 'true';
        btn.addEventListener('change', () => {
          updateHuddleNotDone();
        });
      });

      root.querySelectorAll('[name^="huddle_patient_"], [name^="huddle_balance_"], [name^="huddle_notes_"]').forEach(el => {
        if (el.dataset.huddleContentBound) return;
        el.dataset.huddleContentBound = 'true';
        el.addEventListener('input', () => {
          updateHuddleNotDone();
        });
      });

      root.querySelectorAll('[data-huddle-row-delete]').forEach(btn => {
        if (btn.dataset.huddleBound) return;
        btn.dataset.huddleBound = 'true';
        btn.addEventListener('click', () => {
          deleteHuddleRow(+btn.dataset.row);
        });
      });
    }

    initHuddleControls(table);

    const addRowBtn = document.querySelector('[data-huddle-add-row]');
    const tbody = table.querySelector('tbody[data-huddle-rows]');
    if (addRowBtn && tbody && !addRowBtn.dataset.huddleBound) {
      addRowBtn.dataset.huddleBound = 'true';
      addRowBtn.addEventListener('click', () => {
        const nextIndex = tbody.querySelectorAll('.appt-type-btn').length;
        tbody.insertAdjacentHTML('beforeend', huddleRowHTML(nextIndex));
        state.huddle_row_count = nextIndex + 1;
        scheduleSave();
        initInputs(tbody);
        initStandaloneCheckboxes(tbody);
        initHuddleControls(tbody);
        const nextPatient = tbody.querySelector('[name="huddle_patient_' + nextIndex + '"]');
        if (nextPatient) {
          nextPatient.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nextPatient.focus({ preventScroll: true });
        }
      });
    }
    updateHuddleNotDone();
  }

  function hasHuddleContent() {
    return Object.keys(state).some(k => {
      if (k.indexOf('strokes_') === 0) return Array.isArray(state[k]) && state[k].length > 0;
      const v = state[k];
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      if (v && typeof v === 'object') return Object.keys(v).some(key => v[key]);
      return !!v;
    });
  }

  function currentHuddleId() {
    return new URLSearchParams(location.search).get('id');
  }

  let skipHuddleLeaveGuard = false;

  function initHuddleJournal() {
    const newBtn = document.querySelector('.huddle-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        if (!confirm('Start this date fresh? This clears the daily sheet for the selected date.')) return;
        skipHuddleLeaveGuard = true;
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      });
    }

    const deleteBtn = document.querySelector('.huddle-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (!confirm('Clear this saved date? This removes the checkboxes, text, and patient rows for this day.')) return;
        skipHuddleLeaveGuard = true;
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      });
    }
  }

  function initHuddleLeaveGuard() {
    const message = 'Leave this shift tracker? Your work is auto-saved, but this catches accidental taps.';
    document.addEventListener('click', (e) => {
      if (skipHuddleLeaveGuard) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || !hasHuddleContent()) return;
      const href = a.getAttribute('href') || '';
      if (!href || href[0] === '#' || href.startsWith('javascript:')) return;
      if (a.target && a.target !== '_self') return;
      if (!confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    window.addEventListener('beforeunload', (e) => {
      if (skipHuddleLeaveGuard) return;
      if (!hasHuddleContent()) return;
      e.preventDefault();
      e.returnValue = message;
      return message;
    });
  }

  // ---------- NOTES PAGE ----------
  function getCurrentNoteId() {
    const p = new URLSearchParams(location.search);
    return p.get('id');
  }

  // Returns true if the page is being redirected and init should bail out.
  function ensureNoteRouted() {
    if (PAGE_FILE !== NOTES_PAGE) return false;
    const id = getCurrentNoteId();
    if (id) return false;
    const idx = getNotesIndex();
    const targetId = idx.length ? idx[0].id : addNote();
    location.replace(NOTES_PAGE + '?id=' + targetId);
    return true;
  }

  function initNotesPage() {
    if (PAGE_FILE !== NOTES_PAGE) return;
    const id = getCurrentNoteId();
    if (!id) return;
    const idx = getNotesIndex();
    const pos = idx.findIndex(n => n.id === id);
    const num = pos >= 0 ? pos + 1 : idx.length + 1;
    const meta = document.querySelector('.notes-meta');
    if (meta) meta.textContent = 'Note ' + num + ' of ' + Math.max(idx.length, 1);
    const delBtn = document.querySelector('.notes-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (!confirm('Delete this note? Pencil strokes and title will be cleared.')) return;
        deleteNote(id);
        const remaining = getNotesIndex();
        if (remaining.length) {
          location.href = NOTES_PAGE + '?id=' + remaining[0].id;
        } else {
          location.href = NOTES_PAGE;
        }
      });
    }
  }

  // ---------- COMMAND CENTER ----------
  function initCommandCenter() {
    if (PAGE_FILE !== '15-command-center.html') return;
    const page = document.querySelector('.command-page');
    if (!page) return;
    const rowsWrap = page.querySelector('[data-command-patient-rows]');

    function accordionKey(details) {
      return 'command_acc_' + (details.dataset.commandAccordion || details.id || 'section');
    }

    page.querySelectorAll('details[data-command-accordion]').forEach(details => {
      const key = accordionKey(details);
      if (state[key] != null) details.open = !!state[key];
      details.addEventListener('toggle', () => {
        state[key] = details.open;
        scheduleSave();
      });
    });

    function typeFromRow(rowNum) {
      const select = page.querySelector('[data-command-type="' + rowNum + '"]');
      return select ? select.value : '';
    }

    function applyCommandBadge(rowNum, apptKey) {
      const badge = page.querySelector('[data-command-badge="' + rowNum + '"]');
      const type = COMMAND_APPT_BY_KEY[apptKey];
      if (!badge) return;
      badge.innerHTML = '';
      badge.className = 'command-type-badge';
      if (!type) {
        badge.textContent = 'No type';
        return;
      }
      badge.classList.add('has-type');
      badge.innerHTML =
        '<span class="appt-chip ' + type.chip + '"></span>' +
        '<span>' + escapeHTML(type.name) + '</span>';
    }

    function commandReqKey(rowNum, apptKey, itemIdx) {
      return 'command_type_req_' + rowNum + '_' + apptKey + '_' + itemIdx;
    }

    function renderCommandRequirements(rowNum, apptKey) {
      const wrap = page.querySelector('[data-command-requirements="' + rowNum + '"]');
      const type = COMMAND_APPT_BY_KEY[apptKey];
      const items = COMMAND_REQUIREMENTS[apptKey];
      if (!wrap || !type || !items) {
        if (wrap) {
          wrap.hidden = true;
          wrap.innerHTML = '';
        }
        return;
      }

      wrap.innerHTML =
        '<div class="command-type-req-head">' +
          '<span class="appt-chip ' + type.chip + '"></span>' +
          '<strong>' + escapeHTML(type.name) + '</strong>' +
        '</div>' +
        '<div class="command-type-req-grid">' +
          items.map((item, itemIdx) => {
            const key = commandReqKey(rowNum, apptKey, itemIdx);
            const checked = state[key] ? ' checked' : '';
            return (
              '<label>' +
                '<input class="command-type-req-check" type="checkbox" data-key="' + key + '"' + checked + '> ' +
                escapeHTML(item) +
              '</label>'
            );
          }).join('') +
        '</div>';
      wrap.hidden = false;

      wrap.querySelectorAll('.command-type-req-check').forEach(input => {
        input.addEventListener('change', () => {
          state[input.dataset.key] = input.checked;
          scheduleSave();
          refreshCommandReview();
        });
      });
    }

    function initCommandRow(card) {
      initInputs(card);
      initSelects(card);
      initStandaloneCheckboxes(card);
      const select = card.querySelector('.command-type-select');
      if (!select) return;
      const rowNum = select.dataset.commandType;
      applyCommandBadge(rowNum, select.value);
      renderCommandRequirements(rowNum, select.value);
      select.addEventListener('change', () => {
        applyCommandBadge(rowNum, select.value);
        renderCommandRequirements(rowNum, select.value);
        refreshCommandReview();
      });
      refreshRowComplete(card);
    }

    function rowHasContent(card) {
      return Array.from(card.querySelectorAll('input.sop-text, textarea.sop-text, select.sop-select')).some(el => {
        return (el.value || '').trim() !== '';
      });
    }

    function rowLabel(card) {
      const rowNum = card.dataset.commandRow;
      const time = card.querySelector('[name="command_time_' + rowNum + '"]')?.value.trim() || '';
      const patient = card.querySelector('[name="command_patient_' + rowNum + '"]')?.value.trim() || '';
      return [time, patient || 'Row ' + rowNum].filter(Boolean).join(' - ');
    }

    function checked(card, key) {
      const input = card.querySelector('[data-command-check="' + key + '"]');
      return !!(input && input.checked);
    }

    function refreshRowComplete(card) {
      card.classList.toggle('is-done', checked(card, 'done'));
    }

    function refreshCommandReview() {
      const list = page.querySelector('[data-command-review-list]');
      if (!list) return;
      const issues = [];
      page.querySelectorAll('.command-patient-card[data-command-row]').forEach(card => {
        if (!rowHasContent(card)) return;
        refreshRowComplete(card);
        const label = rowLabel(card);
        if (!checked(card, 'done')) issues.push(label + ': not marked DONE');
        if (!checked(card, 'payment')) issues.push(label + ': payment not checked');
        if (!checked(card, 'nextappt')) issues.push(label + ': next appointment not checked');
      });

      const callbacks = (state.in_command_callbacks || '').trim();
      const doctor = (state.in_command_doctor || '').trim();
      const money = (state.in_command_money || '').trim();
      const scheduling = (state.in_command_scheduling_issues || '').trim();
      if (callbacks) issues.push('Open callbacks still listed');
      if (doctor) issues.push('Waiting on doctor still listed');
      if (money) issues.push('Cash Practice / payment issues still listed');
      if (scheduling) issues.push('Scheduling issues still listed');

      if (!issues.length) {
        list.innerHTML = '<p class="command-review-empty">Nothing flagged yet.</p>';
        return;
      }
      list.innerHTML = issues.map(item => '<div class="command-review-item">' + escapeHTML(item) + '</div>').join('');
    }

    page.querySelectorAll('.command-patient-card[data-command-row]').forEach(card => {
      initCommandRow(card);
    });

    const addRowBtn = page.querySelector('[data-command-add-row]');
    if (addRowBtn && rowsWrap) {
      addRowBtn.addEventListener('click', () => {
        const nextRow = rowsWrap.querySelectorAll('.command-patient-card[data-command-row]').length + 1;
        state.command_row_count = nextRow;
        rowsWrap.insertAdjacentHTML('beforeend', commandRowHTML(nextRow - 1));
        const card = rowsWrap.querySelector('.command-patient-card[data-command-row="' + nextRow + '"]');
        if (card) initCommandRow(card);
        scheduleSave();
        refreshCommandReview();
        if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }

    const tabButtons = Array.from(page.querySelectorAll('[data-command-tab]'));
    const tabPanels = Array.from(page.querySelectorAll('[data-command-tab-panel]'));
    function applyCommandTab(tabName) {
      const active = tabName || 'np';
      tabButtons.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.commandTab === active);
      });
      tabPanels.forEach(panel => {
        panel.classList.toggle('is-active', panel.dataset.commandTabPanel === active);
      });
      state.command_active_tab = active;
      scheduleSave();
    }
    if (tabButtons.length && tabPanels.length) {
      applyCommandTab(state.command_active_tab || 'np');
      tabButtons.forEach(btn => {
        btn.addEventListener('click', () => applyCommandTab(btn.dataset.commandTab));
      });
    }

    page.addEventListener('input', (e) => {
      if (e.target.matches('input.sop-text, textarea.sop-text, select.sop-select')) {
        refreshCommandReview();
      }
    });
    page.addEventListener('change', (e) => {
      if (e.target.matches('input[type="checkbox"], select.sop-select')) {
        const card = e.target.closest('.command-patient-card[data-command-row]');
        if (card) refreshRowComplete(card);
        refreshCommandReview();
      }
    });

    refreshCommandReview();
  }

  // ---------- INIT ----------
  function runInit(label, fn) {
    try {
      fn();
    } catch (err) {
      console.error('Cafe SOP init failed: ' + label, err);
    }
  }

  function init() {
    let routed = false;
    try {
      routed = ensureNoteRouted();
    } catch (err) {
      console.error('Cafe SOP init failed: ensureNoteRouted', err);
    }
    if (routed) return;

    runInit('initDrawer', initDrawer);
    runInit('blockStylusScroll', blockStylusScroll);
    // Huddle rows must exist before initInputs binds their text fields
    runInit('prepareHuddleRows', prepareHuddleRows);
    // Command tracker rows must exist before generic autosave binding
    runInit('prepareCommandRows', prepareCommandRows);
    // Order matters: restore contenteditable text first, THEN inject checkboxes
    runInit('initEditables', initEditables);
    runInit('initCheckboxes', initCheckboxes);
    runInit('initStandaloneCheckboxes', initStandaloneCheckboxes);
    runInit('initSelects', initSelects);
    runInit('initInputs', initInputs);
    runInit('initPencil', initPencil);
    runInit('initToolbar', initToolbar);
    runInit('initSaveBar', initSaveBar);
    runInit('initPageResetButtons', initPageResetButtons);
    runInit('initQuickSearch', initQuickSearch);
    runInit('initHuddle', initHuddle);
    runInit('initNotesPage', initNotesPage);
    runInit('initCommandCenter', initCommandCenter);
    runInit('initHint', initHint);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
