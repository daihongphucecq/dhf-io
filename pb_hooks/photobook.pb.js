/// <reference path="../pb_data/types.d.ts" />
// Photobook ULAW — queue/ticketing endpoints. Collections are locked; all access
// flows through these hooks (server-side, bypass collection rules).
// NOTE: PocketBase runs each handler in an isolated VM — handlers CANNOT call
// top-level helper functions, so every handler is fully self-contained below.
//   POST /api/photobook/take   { device }            -> { number }   (public)
//   GET  /api/photobook/state                        -> summary+list (public)
//   POST /api/photobook/admin  { mkey, action, ... }                 (manager, needs PHOTOBOOK_KEY)

// ---- public: take a number ----
routerAdd("POST", "/api/photobook/take", (e) => {
  let info; try { info = e.requestInfo(); } catch (_) { info = {}; }
  const body = info.body || {};
  const device = ("" + (body.device || "")).trim();
  if (!device) return e.json(400, { error: "Thiếu mã thiết bị." });

  let cfg = null;
  try { cfg = $app.findFirstRecordByFilter("photobook_config", "key = 'main'"); } catch (_) { cfg = null; }
  if (!cfg) return e.json(500, { error: "Chưa cấu hình sự kiện." });
  if (!cfg.getBool("active")) return e.json(403, { error: "Sự kiện đang tạm đóng nhận khách." });

  let exist = null;
  try { exist = $app.findFirstRecordByFilter("photobook_tickets", "device = {:d}", { d: device }); } catch (_) {}
  if (exist) return e.json(200, { number: exist.getInt("number"), already: true });

  const col = $app.findCollectionByNameOrId("photobook_tickets");
  for (let i = 0; i < 6; i++) {
    let c = cfg;
    try { c = $app.findFirstRecordByFilter("photobook_config", "key = 'main'"); } catch (_) { c = cfg; }
    const next = c.getInt("last_number") + 1;
    try {
      const t = new Record(col);
      t.set("number", next);
      t.set("device", device);
      t.set("status", "waiting");
      t.set("photos", 0);
      t.set("amount", 0);
      $app.save(t);
      c.set("last_number", next);
      $app.save(c);
      return e.json(200, { number: next });
    } catch (err) { /* number collision — retry */ }
  }
  return e.json(503, { error: "Hệ thống bận, thử lại." });
});

// ---- public: live state ----
routerAdd("GET", "/api/photobook/state", (e) => {
  let cfg = null;
  try { cfg = $app.findFirstRecordByFilter("photobook_config", "key = 'main'"); } catch (_) { cfg = null; }
  if (!cfg) return e.json(200, { active: false });

  let rows = [];
  try { rows = $app.findRecordsByFilter("photobook_tickets", "number > 0", "number", 5000, 0); } catch (_) { rows = []; }
  const nsv = cfg.getInt("now_serving");
  let waiting = 0, served = 0, absent = 0;
  const processed = [];
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const st = t.getString("status");
    if (st === "served") { served++; processed.push({ number: t.getInt("number"), status: "served", photos: t.getInt("photos"), at: t.getString("served_at") }); }
    else if (st === "absent") { absent++; processed.push({ number: t.getInt("number"), status: "absent", at: t.getString("served_at") }); }
    else if (t.getInt("number") > nsv) { waiting++; }
  }
  return e.json(200, {
    active: cfg.getBool("active"),
    title: cfg.getString("event_title"),
    subtitle: cfg.getString("event_subtitle"),
    now_serving: cfg.getInt("now_serving"),
    last_number: cfg.getInt("last_number"),
    minutes: cfg.getInt("minutes_per_person") || 3,
    waiting: waiting, served: served, absent: absent,
    processed: processed,
  });
});

// ---- manager (passphrase-gated) ----
routerAdd("POST", "/api/photobook/admin", (e) => {
  let info; try { info = e.requestInfo(); } catch (_) { info = {}; }
  const body = info.body || {};
  const key = $os.getenv("PHOTOBOOK_KEY");
  if (!key) return e.json(503, { error: "Chưa cấu hình PHOTOBOOK_KEY trên máy chủ." });
  if (typeof body.mkey !== "string" || body.mkey !== key) return e.json(401, { error: "Sai mật khẩu quản lý." });

  const action = "" + (body.action || "");
  let cfg = null;
  try { cfg = $app.findFirstRecordByFilter("photobook_config", "key = 'main'"); } catch (_) { cfg = null; }
  if (!cfg) return e.json(500, { error: "Chưa cấu hình sự kiện." });

  if (action === "list") {
    let rows = [];
    try { rows = $app.findRecordsByFilter("photobook_tickets", "number > 0", "number", 10000, 0); } catch (_) { rows = []; }
    const arr = [];
    for (let i = 0; i < rows.length; i++) {
      const t = rows[i];
      arr.push({ number: t.getInt("number"), status: t.getString("status"), photos: t.getInt("photos"), amount: t.getFloat("amount"), at: t.getString("served_at"), note: t.getString("note") });
    }
    return e.json(200, {
      config: { title: cfg.getString("event_title"), subtitle: cfg.getString("event_subtitle"), now_serving: cfg.getInt("now_serving"), last_number: cfg.getInt("last_number"), minutes: cfg.getInt("minutes_per_person"), active: cfg.getBool("active") },
      tickets: arr,
    });
  }

  if (action === "advance") {
    const n = (body.number != null) ? (parseInt(body.number) || 0) : (cfg.getInt("now_serving") + 1);
    cfg.set("now_serving", n);
    $app.save(cfg);
    return e.json(200, { now_serving: n });
  }

  if (action === "set_ticket") {
    const num = parseInt(body.number) || 0;
    let t = null;
    try { t = $app.findFirstRecordByFilter("photobook_tickets", "number = {:n}", { n: num }); } catch (_) {}
    if (!t) return e.json(404, { error: "Không thấy số " + num });
    if (body.status != null) {
      const st = "" + body.status;
      if (["waiting", "served", "absent"].indexOf(st) < 0) return e.json(400, { error: "Trạng thái không hợp lệ." });
      t.set("status", st);
      if ((st === "served" || st === "absent") && !t.getString("served_at")) t.set("served_at", (new Date()).toISOString());
      if (st === "waiting") t.set("served_at", "");
    }
    if (body.photos != null) t.set("photos", Math.max(0, parseInt(body.photos) || 0));
    if (body.amount != null) t.set("amount", Math.max(0, parseFloat(body.amount) || 0));
    if (body.note != null) t.set("note", "" + body.note);
    $app.save(t);
    return e.json(200, { ok: true });
  }

  if (action === "config") {
    if (body.title != null) cfg.set("event_title", ("" + body.title).replace(/[<>]/g, "").slice(0, 120));
    if (body.subtitle != null) cfg.set("event_subtitle", ("" + body.subtitle).replace(/[<>]/g, "").slice(0, 120));
    if (body.minutes != null) cfg.set("minutes_per_person", parseInt(body.minutes) || 3);
    if (body.active != null) cfg.set("active", body.active === true || body.active === 1 || body.active === "true" || body.active === "1");
    if (body.now_serving != null) cfg.set("now_serving", parseInt(body.now_serving) || 0);
    $app.save(cfg);
    return e.json(200, { ok: true });
  }

  if (action === "reset") {
    let rows = [];
    try { rows = $app.findRecordsByFilter("photobook_tickets", "number > 0", "number", 20000, 0); } catch (_) { rows = []; }
    for (let i = 0; i < rows.length; i++) { try { $app.delete(rows[i]); } catch (_) {} }
    cfg.set("now_serving", 0);
    cfg.set("last_number", 0);
    $app.save(cfg);
    return e.json(200, { ok: true });
  }

  if (action === "sample_del") {
    const id = "" + (body.id || "");
    let r = null;
    try { r = $app.findRecordById("photobook_samples", id); } catch (_) {}
    if (r) { try { $app.delete(r); } catch (_) {} }
    return e.json(200, { ok: true });
  }

  return e.json(400, { error: "Hành động không hợp lệ." });
});

// ---- public: pose-reference sample images ----
routerAdd("GET", "/api/photobook/samples", (e) => {
  let rows = [];
  try { rows = $app.findRecordsByFilter("photobook_samples", "id != ''", "order", 200, 0); } catch (_) { rows = []; }
  const arr = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fn = "" + (r.get("image") || "");
    if (!fn) continue;
    arr.push({ id: r.id, url: "/api/files/photobook_samples/" + r.id + "/" + fn, caption: r.getString("caption") });
  }
  return e.json(200, { samples: arr });
});

// ---- manager: upload a sample image (multipart; mkey + caption via query) ----
routerAdd("POST", "/api/photobook/sample", (e) => {
  let info; try { info = e.requestInfo(); } catch (_) { info = {}; }
  const q = info.query || {};
  const hdr = info.headers || {};
  const key = $os.getenv("PHOTOBOOK_KEY");
  if (!key) return e.json(503, { error: "Chưa cấu hình PHOTOBOOK_KEY trên máy chủ." });
  // accept the passphrase via header (preferred — keeps it out of URLs/logs); query is a transitional fallback
  const provided = "" + (hdr["x-manager-key"] || q.mkey || "");
  if (provided !== key) return e.json(401, { error: "Sai mật khẩu quản lý." });
  let files = [];
  try { files = e.findUploadedFiles("image"); } catch (_) { files = []; }
  if (!files || !files.length) return e.json(400, { error: "Chưa chọn ảnh." });
  const col = $app.findCollectionByNameOrId("photobook_samples");
  const r = new Record(col);
  r.set("caption", ("" + (q.caption || "")).replace(/[<>]/g, "").slice(0, 160));
  r.set("order", (new Date()).getTime());
  r.set("image", files[0]);
  $app.save(r);
  return e.json(200, { ok: true });
});
