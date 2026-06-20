/* hydrate.js — pull latest content from PocketBase and override the baked HTML.
   Runs early (head) so window.__hydrated exists before the inline IIFE.
   Fail-closed: on any error/timeout, the baked content stays untouched. */
(function () {
  "use strict";
  var PB = location.origin.indexOf('dhf.io.vn') > -1 ? '' : 'http://127.0.0.1:8091';
  var ALLOW = { STRONG:1, BR:1, EM:1, SPAN:1, I:1, B:1 };

  function clean(html) {
    var t = document.createElement('template');
    t.innerHTML = (html == null ? '' : String(html));
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 1) {
          if (!ALLOW[n.tagName]) { n.replaceWith(document.createTextNode(n.textContent)); return; }
          [].slice.call(n.attributes).forEach(function (a) { n.removeAttribute(a.name); });
          walk(n);
        }
      });
    })(t.content);
    return t.innerHTML;
  }
  var A = function (x) { return clean(x).replace(/"/g, '&quot;'); };      // for data-vi attributes
  function esc(s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; }
  function attr(s) { return esc(s).replace(/"/g, '&quot;'); }
  function safeUrl(u) { u = String(u || ''); return /^https?:\/\//.test(u) ? u.replace(/"/g, '%22') : '#'; }

  function getJSON(path) {
    var ctl = new AbortController(); var to = setTimeout(function () { ctl.abort(); }, 2500);
    return fetch(PB + path, { credentials: 'omit', signal: ctl.signal })
      .then(function (r) { clearTimeout(to); if (!r.ok) throw 0; return r.json(); });
  }
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var resolveH; window.__hydrated = new Promise(function (res) { resolveH = res; });
  function finish(state) { if (document.body) document.body.dataset.cms = state; resolveH(); }

  function setNode(sel, en, vi) {
    var el = document.querySelector(sel); if (!el) return;
    var e = clean(en), v = clean(vi == null ? en : vi);
    if (el.innerHTML !== e) el.innerHTML = e;
    el.dataset.en = e; el.dataset.vi = v;   // refresh applyLang's cache so EN/VI toggle stays correct
  }

  function singleton(c) {
    setNode('[data-cms="hero_status"]', c.hero_status_en, c.hero_status_vi);
    setNode('[data-cms="lede"]', c.lede_en, c.lede_vi);
    setNode('[data-cms="hero_meta"]', c.hero_meta_en, c.hero_meta_vi);
    setNode('[data-cms="story_eyebrow"]', c.story_eyebrow_en, c.story_eyebrow_vi);
    setNode('[data-cms="story_h2"]', c.story_h2_en, c.story_h2_vi);
    setNode('[data-cms="story_p1"]', c.story_p1_en, c.story_p1_vi);
    setNode('[data-cms="story_p2"]', c.story_p2_en, c.story_p2_vi);
    setNode('[data-cms="story_p3"]', c.story_p3_en, c.story_p3_vi);
    setNode('[data-cms="story_pull"]', c.story_pull_en, c.story_pull_vi);
    setNode('[data-cms="story_p4"]', c.story_p4_en, c.story_p4_vi);
    setNode('[data-cms="contact_eyebrow"]', c.contact_eyebrow_en, c.contact_eyebrow_vi);
    setNode('[data-cms="contact_h2"]', c.contact_h2_en, c.contact_h2_vi);
    setNode('[data-cms="contact_body"]', c.contact_body_en, c.contact_body_vi);
    setNode('[data-cms="footer"]', c.footer_en, c.footer_vi);
    setNode('[data-cms="role_sr"]', c.role_sr_en, c.role_sr_vi);
    var nm = document.querySelector('[data-cms="hero_name"]');
    if (nm && c.name_line1) nm.innerHTML = esc(c.name_line1) + '<br><span class="name-accent">' + esc(c.name_accent || '') + '</span>';
    var eb = document.getElementById('emailBtn'); if (eb && c.contact_email) eb.dataset.email = c.contact_email;
    if (c.role_swap_a_en) window.__ROLE_OVERRIDE = {
      en: { pre: c.role_pre_en || '', swap: [c.role_swap_a_en, c.role_swap_b_en], suf: c.role_suf_en || '' },
      vi: { pre: c.role_pre_vi || '', swap: [c.role_swap_a_vi, c.role_swap_b_vi], suf: c.role_suf_vi || '' }
    };
  }
  function tagCls(c) { return c === 'amber' ? 'tag amber' : c === 'green' ? 'tag green' : 'tag'; }

  function journey(items) {
    var log = document.querySelector('#journey .log'); if (!log) return;
    items = (items || []).filter(function (e) { return (e.title_en || '').trim(); });
    if (!items.length) return;
    var h = '<div class="live" aria-hidden="true"><span class="caret"></span> monitoring…</div><div class="line" aria-hidden="true"></div>';
    items.forEach(function (e) {
      h += '<article class="entry"><div class="ts">' + clean(e.ts_main || '') + '<b data-vi="' + A(e.ts_sub_vi) + '">' + clean(e.ts_sub_en) + '</b></div>'
        + '<div class="body"><span class="' + tagCls(e.tag_color) + '" data-vi="' + A(e.tag_vi) + '">' + clean(e.tag_en) + '</span>'
        + '<h3 data-vi="' + A(e.title_vi) + '">' + clean(e.title_en) + '</h3>'
        + '<p data-vi="' + A(e.body_vi) + '">' + clean(e.body_en) + '</p></div></article>';
    });
    log.innerHTML = h;
  }
  function projects(items) {
    var grid = document.querySelector('#work .grid'); if (!grid) return;
    items = (items || []).filter(function (p) { return ((p.title || '') + (p.role_line_en || '')).trim(); });
    if (!items.length) return;
    grid.innerHTML = items.map(function (p) {
      var ce = Array.isArray(p.chips_en) ? p.chips_en : [], cv = Array.isArray(p.chips_vi) ? p.chips_vi : ce;
      var chips = ce.map(function (c, i) { return '<span class="chip" data-vi="' + A(cv[i] != null ? cv[i] : c) + '">' + clean(c) + '</span>'; }).join('');
      var link = (p.link_kind === 'live' && p.link_url)
        ? '<a class="card-link" href="' + safeUrl(p.link_url) + '" target="_blank" rel="noopener" data-vi="' + A(p.link_label_vi) + '">' + clean(p.link_label_en) + '</a>'
        : '<span class="card-link is-soon" data-vi="' + A(p.link_label_vi) + '">' + clean(p.link_label_en) + '</span>';
      var tvi = p.title_vi ? ' data-vi="' + A(p.title_vi) + '"' : '';
      return '<article class="card reveal in"><div class="role-line" data-vi="' + A(p.role_line_vi) + '">' + clean(p.role_line_en) + '</div>'
        + '<h3' + tvi + '>' + clean(p.title) + '</h3>'
        + '<p data-vi="' + A(p.body_vi) + '">' + clean(p.body_en) + '</p>'
        + '<div class="chips">' + chips + '</div>' + link + '</article>';
    }).join('');
  }
  function skills(items) {
    var sk = document.querySelector('#focus .skills'); if (!sk) return;
    items = (items || []).filter(function (s) { return (s.label_en || '').trim(); });
    if (!items.length) return;
    sk.innerHTML = items.map(function (s) { return '<span class="skill" data-vi="' + A(s.label_vi || s.label_en) + '">' + clean(s.label_en) + '</span>'; }).join('');
  }
  function creds(items) {
    var ul = document.querySelector('#focus .creds ul'); if (!ul || !items.length) return;
    ul.innerHTML = items.map(function (c) { return '<li><b>' + clean(c.name) + '</b><span class="meta" data-vi="' + A(c.meta_vi) + '">' + clean(c.meta_en) + '</span></li>'; }).join('');
  }
  function posts(items) {
    var sec = document.getElementById('writing'), list = document.getElementById('writing-list'), nl = document.getElementById('navWriting');
    var pub = (items || []).filter(function (p) { return p.published; });
    if (nl) nl.style.display = pub.length ? '' : 'none';
    if (!sec || !list || !pub.length) return;
    sec.classList.remove('hidden');
    window.__POSTS = {};
    list.innerHTML = pub.map(function (p) {
      window.__POSTS[p.slug] = p;
      var cover = p.cover ? '<img class="post-cover" src="' + PB + '/api/files/posts/' + p.id + '/' + p.cover + '?thumb=600x0" alt="">' : '';
      var d = p.published_at ? new Date(p.published_at) : null;
      var ds = d ? (d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)) : '';
      return '<article class="card post-card reveal in" data-slug="' + attr(p.slug) + '">' + cover +
        '<div class="post-date">' + esc(ds) + '</div>' +
        '<h3 data-vi="' + A(p.title_vi) + '">' + clean(p.title_en) + '</h3>' +
        '<p data-vi="' + A(p.excerpt_vi) + '">' + clean(p.excerpt_en) + '</p>' +
        '<span class="card-link" data-vi="Đọc →">Read →</span></article>';
    }).join('');
    [].forEach.call(list.querySelectorAll('.post-card'), function (c) {
      c.addEventListener('click', function () { openReader(window.__POSTS[c.getAttribute('data-slug')]); });
    });
  }
  function openReader(p) {
    if (!p) return;
    var vi = document.documentElement.lang === 'vi';
    var title = vi ? (p.title_vi || p.title_en) : p.title_en;
    var body = vi ? (p.body_vi || p.body_en) : p.body_en;
    var paras = String(body || '').split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean)
      .map(function (s) { return '<p>' + clean(s.replace(/\n/g, '<br>')) + '</p>'; }).join('');
    var cover = p.cover ? '<img class="reader-cover" src="' + PB + '/api/files/posts/' + p.id + '/' + p.cover + '?thumb=1200x630" alt="">' : '';
    var ov = document.createElement('div'); ov.className = 'reader';
    ov.innerHTML = '<div class="reader-card"><button class="reader-close" aria-label="Đóng">✕</button>' + cover +
      '<h2>' + clean(title) + '</h2><div class="post-body">' + paras + '</div></div>';
    function close() { ov.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; }
    function onKey(e) { if (e.key === 'Escape') close(); }
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.classList.contains('reader-close')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(ov);
  }

  var data = Promise.all([
    getJSON("/api/collections/site_content/records?filter=(key='main')&perPage=1"),
    getJSON("/api/collections/journey/records?sort=order&perPage=50"),
    getJSON("/api/collections/projects/records?sort=order&perPage=20"),
    getJSON("/api/collections/skills/records?sort=order&perPage=50"),
    getJSON("/api/collections/credentials/records?sort=order&perPage=20"),
    getJSON("/api/collections/posts/records?filter=(published=true)&sort=-published_at&perPage=12")
  ]);
  var dom = new Promise(function (r) { ready(r); });

  Promise.all([data, dom]).then(function (res) {
    var r = res[0];
    var sc = r[0] && r[0].items && r[0].items[0];
    if (sc) singleton(sc);
    journey((r[1] && r[1].items) || []);
    projects((r[2] && r[2].items) || []);
    skills((r[3] && r[3].items) || []);
    creds((r[4] && r[4].items) || []);
    posts((r[5] && r[5].items) || []);
    finish('live');
  }).catch(function () { finish('baked'); });
})();
