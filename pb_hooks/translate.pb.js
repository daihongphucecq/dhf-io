/// <reference path="../pb_data/types.d.ts" />
// POST /api/translate  { text, to: "vi"|"en" } -> { text }   (DeepL Free)
// Key from env DEEPL_API_KEY (free keys end in ":fx"). Never sent to browser.
routerAdd("POST", "/api/translate", (e) => {
  let info;
  try { info = e.requestInfo(); } catch (_) { info = {}; }
  const auth = e.auth || info.auth;
  if (!auth) return e.json(401, { error: "Cần đăng nhập." });

  const body = info.body || {};
  const text = (body.text == null ? "" : "" + body.text);
  const to = (body.to === "en") ? "en" : "vi";
  if (!text.trim()) return e.json(200, { text: "" });

  const key = $os.getenv("DEEPL_API_KEY");
  if (!key) {
    return e.json(503, { error: "Chưa cấu hình khoá DeepL (DEEPL_API_KEY)." });
  }
  const host = key.indexOf(":fx") > -1
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  const target = (to === "en") ? "EN-US" : "VI";

  try {
    const res = $http.send({
      url: host + "/v2/translate",
      method: "POST",
      headers: {
        "Authorization": "DeepL-Auth-Key " + key,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        text: [text],
        target_lang: target,
        preserve_formatting: true
      }),
      timeout: 30
    });
    if (res.statusCode !== 200) {
      return e.json(502, { error: "DeepL trả lỗi (" + res.statusCode + ")." });
    }
    const out = res.json;
    const t = (out && out.translations && out.translations[0]
      && out.translations[0].text)
      ? ("" + out.translations[0].text) : "";
    return e.json(200, { text: t });
  } catch (err) {
    return e.json(502, { error: "Không gọi được DeepL." });
  }
});
