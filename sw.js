/**
 * sw.js — 서비스 워커: 오프라인 플레이 + 홈 화면 설치의 기반
 *
 * 전략: **네트워크 우선, 캐시 폴백** (기술설계 §8)
 *  - 온라인이면 항상 최신 파일을 받아 캐시를 갱신한다
 *    → 수동 배포 후 버전 꼬임(옛 캐시가 계속 사는 문제)이 없다.
 *  - 오프라인이면 캐시로 응답한다 → 비행기 모드에서도 줍줍!
 *
 * 캐시 이름의 버전은 "정리용"이다. 프리캐시 목록이 바뀌면 올려서
 * activate 단계에서 옛 캐시 창고를 비운다.
 */

const CACHE_NAME = "joopjoop-v2"; // v2: share.js·daily.js 추가 (M5)

/* 첫 방문 때 미리 담아두는 앱 셸 — 이후엔 오프라인도 완주 가능 */
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/main.js",
  "./js/config.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/world.js",
  "./js/joop.js",
  "./js/skins.js",
  "./js/debris.js",
  "./js/effects.js",
  "./js/sound.js",
  "./js/ui.js",
  "./js/share.js",
  "./js/daily.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting(); // 새 버전이 오면 기다리지 않고 바로 교대
});

self.addEventListener("activate", (event) => {
  // 이름이 다른(=옛 버전) 캐시 창고를 청소한다. 줍은 청소 로봇이니까.
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // 게임 파일(같은 출처의 GET)만 다룬다. 그 외는 브라우저 기본 동작에 맡긴다
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 성공 응답은 다음 오프라인을 위해 복사해 캐시에 넣어둔다
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        // 네트워크 실패(오프라인) → 캐시. 그래도 없으면 앱 셸 진입점으로
        caches.match(request).then((cached) => cached ?? caches.match("./")),
      ),
  );
});
