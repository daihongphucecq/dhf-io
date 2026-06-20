/* dhf.io.vn admin SPA — plain JS, talks to PocketBase REST. */
(function () {
  "use strict";
  var PB = location.origin.indexOf('dhf.io.vn') > -1 ? '' : 'http://127.0.0.1:8091';
  var TKEY = 'pbAdmTok', MKEY = 'pbAdmModel';
  var token = localStorage.getItem(TKEY) || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, attrs, html) { var e = document.createElement(tag); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; };
  var attr = function (s) { return esc(s).replace(/"/g, '&quot;'); };

  function toast(msg, type) {
    var t = el('div', { class: 'toast ' + (type || '') }, esc(msg));
    $('#toasts').appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 3200);
  }
  function humanErr(status) {
    if (status === 401 || status === 403) return 'Phiên đăng nhập đã hết hạn — hãy đăng nhập lại.';
    if (status === 404) return 'Không lưu được — phiên có thể đã hết hạn hoặc mục không còn. Thử tải lại trang / đăng nhập lại.';
    if (status === 0) return 'Không kết nối được máy chủ — kiểm tra mạng.';
    if (status === 400) return 'Có ô nhập chưa hợp lệ.';
    return 'Có lỗi xảy ra (mã ' + status + ').';
  }
  async function api(method, path, body, isForm) {
    var headers = {}; if (token) headers['Authorization'] = token;
    if (!isForm && body) headers['Content-Type'] = 'application/json';
    var res;
    try { res = await fetch(PB + path, { method: method, headers: headers, body: isForm ? body : (body ? JSON.stringify(body) : undefined) }); }
    catch (e) { return { ok: false, status: 0, data: null }; }
    var data = null; try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data: data };
  }

  // ---------- auth ----------
  async function boot() {
    if (token) {
      var r = await api('POST', '/api/collections/owners/auth-refresh');
      if (r.ok) { token = r.data.token; localStorage.setItem(TKEY, token); if (r.data.record) localStorage.setItem(MKEY, JSON.stringify(r.data.record)); return showApp(); }
      token = ''; localStorage.removeItem(TKEY);
    }
    showLogin();
  }
  function showLogin() {
    $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
    $('#loginForm').onsubmit = async function (e) {
      e.preventDefault();
      var b = $('#loginBtn'); b.disabled = true; b.textContent = 'Đang đăng nhập…';
      var r = await api('POST', '/api/collections/owners/auth-with-password', { identity: $('#le').value.trim(), password: $('#lp').value });
      b.disabled = false; b.textContent = 'Đăng nhập';
      if (r.ok) { token = r.data.token; localStorage.setItem(TKEY, token); localStorage.setItem(MKEY, JSON.stringify(r.data.record || {})); showApp(); }
      else toast(r.status === 400 ? 'Sai email hoặc mật khẩu.' : humanErr(r.status), 'err');
    };
  }
  function logout() { token = ''; localStorage.removeItem(TKEY); localStorage.removeItem(MKEY); location.hash = ''; showLogin(); }

  // ---------- nav / routing ----------
  var NAV = [
    { grp: '' , items: [['dashboard', '◧', 'Tổng quan']] },
    { grp: 'Nội dung trang', items: [
      ['hero', '⌂', 'Trang chủ'], ['story', '✎', 'Câu chuyện'], ['projects', '◫', 'Dự án'],
      ['journey', '☰', 'Nhật ký'], ['skills', '#', 'Kỹ năng'], ['credentials', '✓', 'Chứng chỉ'], ['contact', '✉', 'Liên hệ'] ] },
    { grp: 'Blog', items: [['posts', '✦', 'Bài viết']] },
  ];
  function renderNav() {
    var n = $('#nav'); n.innerHTML = '';
    NAV.forEach(function (g) {
      if (g.grp) n.appendChild(el('div', { class: 'navgrp' }, g.grp));
      g.items.forEach(function (it) {
        var b = el('button', { class: 'navlink', 'data-route': it[0] }, '<span class="ic">' + it[1] + '</span> ' + esc(it[2]));
        b.onclick = function () { location.hash = it[0]; };
        n.appendChild(b);
      });
    });
  }
  function setActive(route) {
    [].forEach.call(document.querySelectorAll('.navlink[data-route]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-route') === route);
    });
  }
  function route() {
    var r = (location.hash || '#dashboard').slice(1) || 'dashboard';
    setActive(r);
    if (r === 'dashboard') return viewDashboard();
    if (SINGLE[r]) return viewSingle(r);
    if (LIST[r]) return viewList(r);
    if (r === 'posts') return viewPosts();
    if (r.indexOf('post:') === 0) return viewPostEdit(r.slice(5));
    viewDashboard();
  }
  function showApp() {
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    renderNav(); $('#logout').onclick = logout;
    window.onhashchange = route; route();
  }

  // ---------- field metadata ----------
  var SINGLE = {
    hero: { title: 'Trang chủ', sub: 'Phần đầu trang: tên, dòng vai trò, đoạn mở đầu.', fields: [
      ['hero_status', 'Dòng trạng thái (chip xanh)', 'bi'],
      ['name_line1', 'Tên — dòng 1', 's'], ['name_accent', 'Tên — dòng 2 (gạch nhấn)', 's'],
      ['role_pre', 'Vai trò — tiền tố', 'bi'], ['role_swap_a', 'Vai trò — cụm đổi A (vd Computer Science)', 'bi'],
      ['role_swap_b', 'Vai trò — cụm đổi B (vd Cyber Security)', 'bi'], ['role_suf', 'Vai trò — hậu tố', 'bi'],
      ['role_sr', 'Vai trò — câu đầy đủ (cho trình đọc màn hình)', 'bi'],
      ['lede', 'Đoạn mở đầu', 'bia'], ['hero_meta', 'Dòng // status', 'bi'] ] },
    story: { title: 'Câu chuyện', sub: 'Giữ nguyên "P." và "E—" — không nhập tên thật / tên trường.', fields: [
      ['story_eyebrow', 'Nhãn nhỏ', 'bi'], ['story_h2', 'Tiêu đề (dùng <br> để xuống dòng)', 'bi'],
      ['story_p1', 'Đoạn 1', 'bia'], ['story_p2', 'Đoạn 2 (giữ P. và E—)', 'bia'], ['story_p3', 'Đoạn 3', 'bia'],
      ['story_pull', 'Câu trích', 'bia'], ['story_p4', 'Đoạn 4', 'bia'] ] },
    contact: { title: 'Liên hệ', sub: 'Thông tin liên hệ và chân trang.', fields: [
      ['contact_eyebrow', 'Nhãn nhỏ', 'bi'], ['contact_h2', 'Tiêu đề', 'bi'], ['contact_body', 'Nội dung', 'bia'],
      ['contact_email', 'Email', 's'], ['instagram_handle', 'Instagram (handle)', 's'], ['instagram_url', 'Instagram (URL)', 's'],
      ['footer', 'Chân trang (bên phải)', 'bi'] ] },
  };
  var LIST = {
    projects: { title: 'Dự án', coll: 'projects', sub: 'Các thẻ trong mục "Selected work".', fields: [
      ['role_line', 'Vai trò', 'bi'], ['title', 'Tên (EN)', 's'], ['title_vi', 'Tên (VI, tuỳ chọn)', 's'],
      ['body', 'Mô tả', 'bia'], ['chips', 'Thẻ kỹ thuật (mỗi dòng một thẻ)', 'chips'],
      ['link_kind', 'Kiểu liên kết', 'sel:live,soon'], ['link_url', 'URL (khi là live)', 's'], ['link_label', 'Nhãn liên kết', 'bi'] ] },
    journey: { title: 'Nhật ký', coll: 'journey', sub: 'Dòng thời gian (timeline).', fields: [
      ['ts_main', 'Mốc (vd 2025, 06.06.2023, "next →")', 's'], ['ts_sub', 'Nhãn nhỏ (vd lớp 10)', 'bi'],
      ['tag', 'Tag (vd // origin)', 'bi'], ['tag_color', 'Màu tag', 'sel:blue,amber,green'],
      ['title', 'Tiêu đề', 'bi'], ['body', 'Nội dung', 'bia'] ] },
    skills: { title: 'Kỹ năng', coll: 'skills', sub: 'Các thẻ kỹ năng.', fields: [ ['label', 'Nhãn', 'bi'] ] },
    credentials: { title: 'Chứng chỉ', coll: 'credentials', sub: 'Danh sách chứng chỉ.', fields: [
      ['name', 'Tên', 's'], ['status', 'Trạng thái', 'sel:certified,in_progress,targeting'], ['meta', 'Mô tả ngắn', 'bi'] ] },
  };

  function fieldInput(f, rec) {
    var k = f[0], lab = f[1], type = f[2];
    var wrap = el('div', { class: 'field' });
    wrap.appendChild(el('label', null, esc(lab)));
    if (type === 's') {
      var i = el('input', { class: 'inp', 'data-k': k, type: 'text' }); i.value = rec[k] || ''; wrap.appendChild(i);
    } else if (type && type.indexOf('sel:') === 0) {
      var sel = el('select', { class: 'inp', 'data-k': k });
      type.slice(4).split(',').forEach(function (o) { var op = el('option', { value: o }, o); if ((rec[k] || '') === o) op.selected = true; sel.appendChild(op); });
      wrap.appendChild(sel);
    } else if (type === 'chips') {
      var ce = Array.isArray(rec.chips_en) ? rec.chips_en.join('\n') : '';
      var cv = Array.isArray(rec.chips_vi) ? rec.chips_vi.join('\n') : '';
      var bi = el('div', { class: 'bi' });
      bi.innerHTML = '<div class="col"><span>EN</span><textarea class="inp" data-k="chips_en">' + esc(ce) + '</textarea></div>' +
        '<div class="col"><span>VI</span><textarea class="inp" data-k="chips_vi">' + esc(cv) + '</textarea></div>';
      wrap.appendChild(bi);
    } else { // bi or bia (bilingual)
      var area = type === 'bia';
      var ie = (rec[k + '_en'] || ''), iv = (rec[k + '_vi'] || '');
      var bi2 = el('div', { class: 'bi' });
      var tag = area ? 'textarea' : 'input';
      function box(lng, val) {
        return '<div class="col"><span>' + lng + '</span>' + (area
          ? '<textarea class="inp" data-k="' + k + '_' + lng.toLowerCase() + '">' + esc(val) + '</textarea>'
          : '<input class="inp" type="text" data-k="' + k + '_' + lng.toLowerCase() + '" value="' + attr(val) + '">') + '</div>';
      }
      var trr = el('div', { class: 'tr-row' });
      trr.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" data-tr="toVI">→ Dịch sang VI</button>' +
                      '<button type="button" class="btn btn-ghost btn-sm" data-tr="toEN">→ Dịch sang EN</button>';
      wrap.appendChild(trr);
      bi2.innerHTML = box('EN', ie) + box('VI', iv);
      wrap.appendChild(bi2);
    }
    return wrap;
  }
  function collectFields(container, fields) {
    var out = {};
    [].forEach.call(container.querySelectorAll('[data-k]'), function (i) {
      var k = i.getAttribute('data-k');
      if (k === 'chips_en' || k === 'chips_vi') out[k] = i.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      else out[k] = i.value;
    });
    return out;
  }

  // ---------- views ----------
  function viewDashboard() {
    var v = $('#view');
    v.innerHTML = '<div class="page-h">Tổng quan</div><div class="page-sub">Chọn một mục để chỉnh sửa. Lưu xong, mở lại trang web và tải lại để xem thay đổi.</div>';
    var grid = el('div', { class: 'dash-grid' });
    [['hero','Trang chủ','Tên, vai trò, mở đầu'],['story','Câu chuyện','Hành trình của bạn'],['projects','Dự án','Thẻ Selected work'],['journey','Nhật ký','Timeline'],['skills','Kỹ năng',''],['credentials','Chứng chỉ',''],['contact','Liên hệ',''],['posts','Bài viết','Blog / write-up']].forEach(function (d) {
      var c = el('a', { class: 'dash-card', href: '#' + d[0] }, '<div class="dt">' + esc(d[1]) + '</div><div class="dd">' + esc(d[2]) + '</div>');
      grid.appendChild(c);
    });
    v.appendChild(grid);
  }

  async function viewSingle(name) {
    var cfg = SINGLE[name], v = $('#view');
    v.innerHTML = '<div class="page-h">' + esc(cfg.title) + '</div><div class="page-sub">' + cfg.sub + '</div><div id="form"></div>';
    var r = await api('GET', "/api/collections/site_content/records?filter=(key='main')&perPage=1");
    if (!r.ok || !r.data.items.length) { toast('Không tải được nội dung.', 'err'); return; }
    var rec = r.data.items[0], form = $('#form');
    cfg.fields.forEach(function (f) { form.appendChild(fieldInput(f, rec)); });
    var bar = el('div', { class: 'save-bar' });
    var save = el('button', { class: 'btn' }, 'Lưu thay đổi');
    bar.appendChild(save); v.appendChild(bar);
    save.onclick = async function () {
      save.disabled = true; save.textContent = 'Đang lưu…';
      var patch = collectFields(form, cfg.fields);
      var rr = await api('PATCH', '/api/collections/site_content/records/' + rec.id, patch);
      save.disabled = false; save.textContent = 'Lưu thay đổi';
      if (rr.ok) toast('Đã lưu — mở lại trang web và tải lại để xem.', 'ok'); else toast(humanErr(rr.status), 'err');
    };
  }

  async function viewList(name) {
    var cfg = LIST[name], v = $('#view');
    v.innerHTML = '<div class="page-h">' + esc(cfg.title) + '</div><div class="page-sub">' + cfg.sub + '</div>' +
      '<div style="margin-bottom:14px"><button class="btn btn-sm" id="add">+ Thêm mục</button></div><div id="rows"></div>';
    var r = await api('GET', '/api/collections/' + cfg.coll + '/records?sort=order&perPage=200');
    var items = (r.data && r.data.items) || [];
    var rows = $('#rows');
    items.forEach(function (rec, idx) {
      var card = el('div', { class: 'card' });
      var top = el('div', { class: 'card-top' });
      top.appendChild(el('div', { class: 't' }, '#' + (rec.order || idx + 1) + ' · ' + esc(rec.title || rec.title_en || rec.name || rec.label_en || ('mục ' + (idx + 1)))));
      var acts = el('div', { class: 'row-acts' });
      var up = el('button', { class: 'btn btn-ghost btn-sm' }, '↑'), dn = el('button', { class: 'btn btn-ghost btn-sm' }, '↓');
      var del = el('button', { class: 'btn btn-danger btn-sm' }, 'Xoá');
      acts.appendChild(up); acts.appendChild(dn); acts.appendChild(del); top.appendChild(acts); card.appendChild(top);
      var body = el('div'); cfg.fields.forEach(function (f) { body.appendChild(fieldInput(f, rec)); }); card.appendChild(body);
      var sv = el('button', { class: 'btn btn-sm' }, 'Lưu mục này'); card.appendChild(sv);
      rows.appendChild(card);
      sv.onclick = async function () {
        sv.disabled = true; sv.textContent = 'Đang lưu…';
        var patch = collectFields(body, cfg.fields);
        var rr = await api('PATCH', '/api/collections/' + cfg.coll + '/records/' + rec.id, patch);
        sv.disabled = false; sv.textContent = 'Lưu mục này';
        if (rr.ok) toast('Đã lưu mục.', 'ok'); else toast(humanErr(rr.status), 'err');
      };
      del.onclick = async function () {
        if (!confirm('Xoá mục này? Hành động không thể hoàn tác.')) return;
        var rr = await api('DELETE', '/api/collections/' + cfg.coll + '/records/' + rec.id);
        if (rr.ok) { toast('Đã xoá.', 'ok'); viewList(name); } else toast(humanErr(rr.status), 'err');
      };
      up.onclick = function () { swap(cfg.coll, items, idx, idx - 1, name); };
      dn.onclick = function () { swap(cfg.coll, items, idx, idx + 1, name); };
    });
    if (!items.length) rows.appendChild(el('div', { class: 'page-sub' }, 'Chưa có mục nào.'));
    $('#add').onclick = async function () {
      var maxo = items.reduce(function (m, it) { return Math.max(m, it.order || 0); }, 0);
      var blank = { order: maxo + 1 };
      if (cfg.coll === 'projects') { blank.title = 'Dự án mới'; blank.link_kind = 'soon'; }
      if (cfg.coll === 'credentials') { blank.name = 'Chứng chỉ mới'; blank.status = 'targeting'; }
      if (cfg.coll === 'journey') { blank.title_en = 'Mục mới'; blank.tag_color = 'blue'; }
      if (cfg.coll === 'skills') { blank.label_en = 'Kỹ năng mới'; }
      var rr = await api('POST', '/api/collections/' + cfg.coll + '/records', blank);
      if (rr.ok) { toast('Đã thêm mục — cuộn xuống để chỉnh.', 'ok'); viewList(name); } else toast(humanErr(rr.status), 'err');
    };
  }
  async function swap(coll, items, a, b, name) {
    if (b < 0 || b >= items.length) return;
    var oa = items[a].order, ob = items[b].order;
    await api('PATCH', '/api/collections/' + coll + '/records/' + items[a].id, { order: ob });
    await api('PATCH', '/api/collections/' + coll + '/records/' + items[b].id, { order: oa });
    viewList(name);
  }

  // ---------- blog ----------
  function slugify(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  async function viewPosts() {
    var v = $('#view');
    v.innerHTML = '<div class="page-h">Bài viết</div><div class="page-sub">Viết và đăng bài / write-up. Bản nháp sẽ không hiện trên trang web.</div>' +
      '<div style="margin-bottom:14px"><button class="btn btn-sm" id="new">+ Viết bài mới</button></div><div id="plist"></div>';
    $('#new').onclick = function () { location.hash = 'post:new'; };
    var r = await api('GET', '/api/collections/posts/records?sort=-created&perPage=100');
    var items = (r.data && r.data.items) || [];
    var list = $('#plist');
    if (!items.length) list.appendChild(el('div', { class: 'page-sub' }, 'Chưa có bài viết nào.'));
    items.forEach(function (p) {
      var card = el('div', { class: 'card' });
      var thumb = p.cover ? '<img class="thumb" src="' + PB + '/api/files/posts/' + p.id + '/' + p.cover + '?thumb=600x0" alt="">' : '<div class="thumb"></div>';
      card.innerHTML = '<div class="post-row"><div style="display:flex;gap:12px;align-items:center;min-width:0">' + thumb +
        '<div style="min-width:0"><div style="font-weight:600">' + esc(p.title_en || '(chưa có tiêu đề)') + '</div>' +
        '<div class="page-sub" style="margin:2px 0 0">/' + esc(p.slug || '') + '</div></div></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<span class="badge ' + (p.published ? 'pub' : 'draft') + '">' + (p.published ? 'Đã đăng' : 'Nháp') + '</span>' +
        '<button class="btn btn-ghost btn-sm" data-edit>Sửa</button></div></div>';
      $('[data-edit]', card).onclick = function () { location.hash = 'post:' + p.id; };
      list.appendChild(card);
    });
  }
  async function viewPostEdit(id) {
    var v = $('#view'); var p = { title_en: '', title_vi: '', slug: '', excerpt_en: '', excerpt_vi: '', body_en: '', body_vi: '', published: false };
    if (id !== 'new') { var r = await api('GET', '/api/collections/posts/records/' + id); if (r.ok) p = r.data; }
    v.innerHTML = '<div class="page-h">' + (id === 'new' ? 'Viết bài mới' : 'Sửa bài') + '</div>' +
      '<div class="page-sub"><a href="#posts">← Về danh sách bài</a></div><div id="pf"></div>';
    var f = $('#pf');
    function bip(k, lab, area) {
      return '<div class="field"><label>' + esc(lab) + '</label>' +
        '<div class="tr-row"><button type="button" class="btn btn-ghost btn-sm" data-tr="toVI">→ Dịch sang VI</button><button type="button" class="btn btn-ghost btn-sm" data-tr="toEN">→ Dịch sang EN</button></div>' +
        '<div class="bi">' +
        '<div class="col"><span>EN</span>' + (area ? '<textarea class="inp" data-k="' + k + '_en">' + esc(p[k + '_en']) + '</textarea>' : '<input class="inp" data-k="' + k + '_en" value="' + attr(p[k + '_en']) + '">') + '</div>' +
        '<div class="col"><span>VI</span>' + (area ? '<textarea class="inp" data-k="' + k + '_vi">' + esc(p[k + '_vi']) + '</textarea>' : '<input class="inp" data-k="' + k + '_vi" value="' + attr(p[k + '_vi']) + '">') + '</div></div></div>';
    }
    f.innerHTML = bip('title', 'Tiêu đề') +
      '<div class="field"><label>Đường dẫn (slug)</label><input class="inp" id="slug" value="' + attr(p.slug) + '" placeholder="tu-dong-tu-tieu-de"><div class="hint">Chỉ chữ thường, số và dấu gạch ngang.</div></div>' +
      bip('excerpt', 'Tóm tắt (1–2 câu)') + bip('body', 'Nội dung (mỗi đoạn cách nhau một dòng trống)', true) +
      '<div class="field"><label>Ảnh bìa</label><input class="inp" id="cover" type="file" accept="image/png,image/jpeg,image/webp">' +
      (p.cover ? '<img class="cover-prev" src="' + PB + '/api/files/posts/' + p.id + '/' + p.cover + '?thumb=600x0" alt="">' : '') + '</div>' +
      '<div class="field"><label><input type="checkbox" id="pub"' + (p.published ? ' checked' : '') + '> Đã đăng (hiện trên trang web)</label></div>';
    // auto-slug from title_en if slug empty
    var te = f.querySelector('[data-k="title_en"]'), slug = $('#slug');
    te.addEventListener('input', function () { if (!slug.value || slug.dataset.auto) { slug.value = slugify(te.value); slug.dataset.auto = '1'; } });
    slug.addEventListener('input', function () { delete slug.dataset.auto; });
    var bar = el('div', { class: 'save-bar' });
    var save = el('button', { class: 'btn' }, 'Lưu'); bar.appendChild(save);
    if (id !== 'new') { var d = el('button', { class: 'btn btn-danger', style: 'margin-left:auto' }, 'Xoá bài'); bar.appendChild(d);
      d.onclick = async function () { if (!confirm('Xoá bài này?')) return; var rr = await api('DELETE', '/api/collections/posts/records/' + id); if (rr.ok) { toast('Đã xoá bài.', 'ok'); location.hash = 'posts'; } else toast(humanErr(rr.status), 'err'); }; }
    v.appendChild(bar);
    save.onclick = async function () {
      var vals = {}; [].forEach.call(f.querySelectorAll('[data-k]'), function (i) { vals[i.getAttribute('data-k')] = i.value; });
      vals.slug = slug.value.trim() || slugify(vals.title_en);
      var pub = $('#pub').checked; vals.published = pub;
      if (pub && !p.published) vals.published_at = new Date().toISOString();
      if (!vals.title_en.trim()) { toast('Cần nhập tiêu đề (EN).', 'err'); return; }
      if (!vals.title_vi.trim()) { toast('Cần nhập tiêu đề (VI).', 'err'); return; }
      save.disabled = true; save.textContent = 'Đang lưu…';
      var coverFile = $('#cover').files[0];
      var rr;
      if (coverFile) {
        var fd = new FormData(); for (var k in vals) fd.append(k, vals[k]); fd.append('cover', coverFile);
        rr = (id === 'new') ? await api('POST', '/api/collections/posts/records', fd, true)
                            : await api('PATCH', '/api/collections/posts/records/' + id, fd, true);
      } else {
        rr = (id === 'new') ? await api('POST', '/api/collections/posts/records', vals)
                            : await api('PATCH', '/api/collections/posts/records/' + id, vals);
      }
      save.disabled = false; save.textContent = 'Lưu';
      if (rr.ok) { toast(pub ? 'Đã đăng — bài đã xuất hiện trên trang web.' : 'Đã lưu nháp.', 'ok'); location.hash = 'posts'; }
      else toast(rr.status === 400 ? 'Lỗi: kiểm tra slug (có thể trùng) hoặc các ô nhập.' : humanErr(rr.status), 'err');
    };
  }

  function translate(text, to) {
    return api('POST', '/api/translate', { text: text, to: to }).then(function (r) {
      if (r.ok && r.data && r.data.text != null) return r.data.text;
      toast((r.data && r.data.error) ? r.data.error : 'Không dịch được.', 'err'); return null;
    });
  }
  document.addEventListener('click', async function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-tr]') : null; if (!b) return;
    var field = b.closest('.field'); if (!field) return;
    var enI = field.querySelector('[data-k$="_en"]'), viI = field.querySelector('[data-k$="_vi"]');
    if (!enI || !viI) return;
    var toVI = b.getAttribute('data-tr') === 'toVI';
    var src = toVI ? enI.value : viI.value;
    if (!src.trim()) { toast('Ô nguồn đang trống — nhập nội dung trước khi dịch.', 'err'); return; }
    var keep = b.textContent; b.disabled = true; b.textContent = 'Đang dịch…';
    var out = await translate(src, toVI ? 'vi' : 'en');
    b.disabled = false; b.textContent = keep;
    if (out == null) return;
    (toVI ? viI : enI).value = out;
    toast('Đã dịch xong — nhớ đọc lại cho đúng giọng.', 'ok');
  });
  boot();
})();
