(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const root = document.documentElement;

  const sidebar = $('#sidebar');
  const menuToggle = $('#menuToggle');
  const overlay = $('#overlay');
  const searchBox = $('#searchBox');
  const noResults = $('#noResults');
  const toTop = $('#toTop');
  const live = $('#live');
  const themeBtn = $('#themeToggle');
  const mobileMQ = window.matchMedia('(max-width: 900px)');
  const THEME_KEY = 'docs-theme';

  const announce = (msg) => { if (live) live.textContent = msg; };

  /* ---------- Index pencarian (dibuat sebelum DOM dimodifikasi) ---------- */
  const tocLinks = $$('#toc a');
  const searchIndex = tocLinks.map((a) => {
    const sec = document.getElementById(a.getAttribute('href').slice(1));
    return {
      li: a.parentElement,
      link: a,
      text: (a.textContent + ' ' + (sec ? sec.textContent : '')).toLowerCase(),
    };
  });

  /* ---------- Tema ---------- */
  const currentTheme = () =>
    root.getAttribute('data-theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

  function renderThemeButton() {
    if (!themeBtn) return;
    const dark = currentTheme() === 'dark';
    themeBtn.textContent = dark ? '\u2600' : '\u263E';
    themeBtn.setAttribute('aria-label', dark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage diblokir */ }
      renderThemeButton();
    });
    renderThemeButton();
  }

  /* ---------- Syntax highlight ringan ---------- */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Setiap regex TIDAK boleh punya capture group.
  const GRAMMARS = {
    bash: [
      ['cm', /#.*$/],
      ['str', /"(?:\\.|[^"\\])*"|'[^']*'/],
      ['var', /\$\{[^}]*\}|\$[A-Za-z_]\w*|\$\(/],
      ['flag', /\B--?[A-Za-z][\w-]*/],
      ['kw', /\b(?:export|cd|if|then|fi|else|for|do|done|exit|case|esac)\b/],
    ],
    c: [
      ['cm', /\/\/.*$|\/\*[\s\S]*?\*\//],
      ['pp', /^[ \t]*#[ \t]*(?:ifdef|ifndef|if|elif|else|endif|define|include)\b[^\n]*/],
      ['str', /"(?:\\.|[^"\\\n])*"/],
      ['kw', /\b(?:extern|int|void|bool|struct|const|unsigned|char|return|static|__user|__read_mostly|__attribute__|unlikely)\b/],
      ['num', /\b(?:0x[0-9a-fA-F]+|\d+)\b/],
    ],
  };

  function highlight(src, lang) {
    const rules = GRAMMARS[lang];
    if (!rules) return esc(src);
    const re = new RegExp(rules.map((r) => '(' + r[1].source + ')').join('|'), 'gm');
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(src))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      const idx = rules.findIndex((_, i) => m[i + 1] !== undefined);
      out += esc(src.slice(last, m.index)) +
        '<span class="tok-' + rules[idx][0] + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(src.slice(last));
  }

  /* ---------- Copy ---------- */
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback untuk file:// atau HTTP biasa
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = typeof document.execCommand === 'function' && document.execCommand('copy'); }
    finally { ta.remove(); }
    if (!ok) throw new Error('copy gagal');
  }

  function flashButton(btn, text, cls) {
    clearTimeout(btn._timer);
    btn.textContent = text;
    btn.classList.remove('copied', 'failed');
    btn.classList.add(cls);
    btn._timer = setTimeout(() => {
      btn.textContent = 'Salin';
      btn.classList.remove('copied', 'failed');
    }, 1600);
  }

  /* ---------- Code block: header (bahasa + tombol salin) ---------- */
  $$('main pre').forEach((pre) => {
    const code = pre.querySelector('code') || pre;
    const isOutput = pre.classList.contains('output');
    const m = /language-(\w+)/.exec(code.className);
    const lang = isOutput ? 'output' : (m ? m[1] : 'bash');
    const raw = code.textContent.replace(/\n$/, '');

    if (!isOutput) code.innerHTML = highlight(raw, lang);

    const wrap = document.createElement('div');
    wrap.className = 'code-block' + (isOutput ? ' is-output' : '');

    const head = document.createElement('div');
    head.className = 'code-head';
    const label = document.createElement('span');
    label.className = 'code-lang';
    label.textContent = lang;
    head.appendChild(label);

    if (!isOutput) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = 'Salin';
      btn.setAttribute('aria-label', 'Salin kode ke clipboard');
      btn.addEventListener('click', async () => {
        try {
          await copyText(raw);
          flashButton(btn, 'Tersalin!', 'copied');
          announce('Kode tersalin');
        } catch (e) {
          flashButton(btn, 'Gagal', 'failed');
          announce('Gagal menyalin kode');
        }
      });
      head.appendChild(btn);
    }

    pre.parentNode.insertBefore(wrap, pre);
    wrap.append(head, pre);
  });

  /* ---------- Anchor di setiap h3 ---------- */
  const usedIds = new Set($$('[id]').map((el) => el.id));
  $$('main section h3').forEach((h) => {
    if (!h.id) {
      const base = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bagian';
      let id = base;
      for (let n = 2; usedIds.has(id); n++) id = base + '-' + n;
      usedIds.add(id);
      h.id = id;
    }
    const a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + h.id;
    a.textContent = '#';
    a.setAttribute('aria-label', 'Tautan ke bagian ini');
    h.appendChild(a);
  });

  /* ---------- Sidebar mobile ---------- */
  function setSidebarOpen(open) {
    sidebar.classList.toggle('open', open);
    overlay.classList.toggle('show', open && mobileMQ.matches);
    document.body.classList.toggle('no-scroll', open && mobileMQ.matches);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Tutup daftar isi' : 'Buka daftar isi');
    menuToggle.textContent = open ? '\u2715' : '\u2630';
  }

  menuToggle.addEventListener('click', () => setSidebarOpen(!sidebar.classList.contains('open')));
  overlay.addEventListener('click', () => setSidebarOpen(false));
  tocLinks.forEach((a) => a.addEventListener('click', () => { if (mobileMQ.matches) setSidebarOpen(false); }));
  if (mobileMQ.addEventListener) mobileMQ.addEventListener('change', () => setSidebarOpen(false));

  /* ---------- Pencarian (judul + isi dokumen) ---------- */
  function runSearch() {
    const q = searchBox.value.trim().toLowerCase();
    let visible = 0;
    searchIndex.forEach(({ li, text }) => {
      const show = !q || text.includes(q);
      li.hidden = !show;
      if (show) visible++;
    });
    noResults.hidden = visible !== 0;
  }

  searchBox.addEventListener('input', runSearch);
  searchBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = searchIndex.find((x) => !x.li.hidden);
      if (first) { e.preventDefault(); first.link.click(); }
    }
  });

  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag);

    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (mobileMQ.matches) setSidebarOpen(true);
      searchBox.focus();
      return;
    }
    if (e.key === 'Escape') {
      if (document.activeElement === searchBox && searchBox.value) {
        searchBox.value = '';
        runSearch();
      } else if (sidebar.classList.contains('open')) {
        setSidebarOpen(false);
        menuToggle.focus();
      }
    }
  });

  /* ---------- Scroll-spy + tombol ke atas (rAF throttle) ---------- */
  const sections = $$('main section[id]');
  const linkById = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  let activeId = '';

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    linkById.forEach((a, key) => {
      const on = key === id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    const a = linkById.get(id);
    if (a) {
      const top = a.offsetTop;
      const bottom = top + a.offsetHeight;
      if (top < sidebar.scrollTop || bottom > sidebar.scrollTop + sidebar.clientHeight) {
        sidebar.scrollTop = Math.max(0, top - sidebar.clientHeight / 2);
      }
    }
  }

  function update() {
    if (sections.length) {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0].id;
      if (atBottom) {
        current = sections[sections.length - 1].id;
      } else {
        for (const s of sections) {
          if (s.getBoundingClientRect().top <= 120) current = s.id;
          else break;
        }
      }
      setActive(current);
    }
    toTop.hidden = window.scrollY < 600;
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }, { passive: true });
  window.addEventListener('resize', update);

  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0 });
    searchBox.blur();
  });

  update();
})();