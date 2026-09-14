// BuildSight / ボリュームパース PWA service worker
// ───────────────────────────────────────────────
//  キャッシュ戦略：
//   ・アプリ本体（HTML/JS/CSS/manifest）= Network First
//       → GitHub更新が「強制リロード無し」で次回アクセス時に反映される
//   ・CDNの重いライブラリ = Cache First（速度優先・滅多に変わらない）
//   ・SW更新時は skipWaiting + clients.claim で即時有効化
//       → index.html 側の controllerchange で1回だけ自動リロード
// ───────────────────────────────────────────────
const VERSION = "v7";                 // ★更新時はここだけ上げる
const CACHE   = "vp-" + VERSION;

// アプリ本体（毎回ネットワーク優先で取りに行く）
const APP_SHELL = [
  "./", "./index.html", "./style.css", "./app.js",
  "./vendor_dxf-parser.js", "./manifest.json"
];
// CDN（キャッシュ優先・バージョン固定で変わらない）
const CDN_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://unpkg.com/three@0.128.0/examples/js/exporters/OBJExporter.js",
  "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled([...APP_SHELL, ...CDN_ASSETS].map(u => c.add(u))))
      .then(() => self.skipWaiting())   // 新SWを待たせず即 waiting → activate へ
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())  // 開いている全タブを即この新SWの管理下へ
  );
});

// 手動更新トリガ（index.html から postMessage("SKIP_WAITING") で呼べる）
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

// CDNかどうか判定
function isCDN(url) {
  return /cdnjs\.cloudflare\.com|unpkg\.com/.test(url);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // CDN：Cache First（あればキャッシュ、無ければ取得してキャッシュ）
  if (isCDN(req.url)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // アプリ本体：Network First（ネット優先 → 取れたらキャッシュ更新 → 失敗時のみキャッシュ）
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200 && res.type !== "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(req).then(hit => hit || caches.match("./index.html"))
    )
  );
});
