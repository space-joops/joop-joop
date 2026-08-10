/**
 * storage.js — localStorage 영구 저장
 *
 * 파이썬의 shelve 처럼 단순하게: 읽기 함수와 쓰기 함수만 제공한다.
 * 키에는 원작(joop-03)의 `joop_03_` 접두사 규칙을 따라
 * `joopjoop.` 네임스페이스를 붙인다 (docs/05-기술설계.md §6).
 *
 * 사파리 프라이빗 모드 등 localStorage 가 막힌 환경에서도
 * 게임이 죽지 않도록 모든 접근을 try/catch 로 감싼다.
 */

const PREFIX = "joopjoop.";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 저장 불가 환경 — 게임은 계속되어야 하므로 조용히 넘어간다 (세션 한정 플레이)
  }
}

/** 저장된 프로필 전체를 읽는다. 없으면 기본값. */
export function loadProfile() {
  return {
    best: read("best", 0),                       // 최고 점수
    shards: read("shards", 0),                   // 보유 조각 (영구 화폐)
    unlockedSkins: read("unlockedSkins", ["joobi"]), // 기본 줍 '주비'는 처음부터 보유
    selectedSkin: read("selectedSkin", "joobi"),
    muted: read("muted", false),
  };
}

/** 프로필 객체를 통째로 저장한다. (부분 저장으로 인한 불일치 방지) */
export function saveProfile(profile) {
  write("best", profile.best);
  write("shards", profile.shards);
  write("unlockedSkins", profile.unlockedSkins);
  write("selectedSkin", profile.selectedSkin);
  write("muted", profile.muted);
}
