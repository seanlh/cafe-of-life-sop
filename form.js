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

  const PAGE_ID = location.pathname.split('/').pop() || 'index.html';
  const STORAGE_KEY = 'cofl_sop_' + PAGE_ID;

  // ---------- STATE ----------
  let state = loadState();
  let saveTimeout = null;
  let lastSaveTooBigWarned = false;

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
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

  // ---------- TEXT INPUTS + TEXTAREAS ----------
  function initInputs() {
    document.querySelectorAll('input.sop-text, textarea.sop-text').forEach((el) => {
      const key = 'in_' + (el.name || slugify(el.placeholder || el.id || 'field'));
      el.dataset.key = key;
      if (state[key] != null) el.value = state[key];
      el.addEventListener('input', () => {
        state[key] = el.value;
        scheduleSave();
      });
    });
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
      '<span class="sb-status"><span class="dot"></span>Auto-saved on this iPad</span>' +
      '<button class="sb-reset">Reset page</button>';
    document.body.appendChild(bar);
    bar.querySelector('.sb-reset').addEventListener('click', () => {
      if (confirm('Clear all form fields AND pencil notes on this page?')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    });
  }

  // ---------- HAMBURGER DRAWER ----------
  const SECTIONS = [
    { num: '',   title: 'Cover',                  sub: 'Contents · welcome',          href: 'index.html' },
    { num: '01', title: 'Office Information',     sub: 'Contact · schedule · systems',href: '01-office-info.html' },
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
    { num: '13', title: 'Daily Huddle Sheet',     sub: 'Printable form',              href: '13-huddle-sheet.html' }
  ];

  function initDrawer() {
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
      '<nav class="sop-drawer-nav">' + items + '</nav>';
    document.body.appendChild(drawer);

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

  // ---------- INIT ----------
  function init() {
    blockStylusScroll();
    // Order matters: restore contenteditable text first, THEN inject checkboxes
    initEditables();
    initCheckboxes();
    initInputs();
    initPencil();
    initToolbar();
    initSaveBar();
    initDrawer();
    initHint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
