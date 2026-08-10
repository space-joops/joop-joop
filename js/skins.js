/**
 * skins.js — 줍 친구들(스킨) 정의와 해금 로직
 *
 * 6색 변형은 원작 joop-03 스프라이트의 JOOP_SHEET_COLORS 를 그대로 계승했다
 * (docs/04-아트디자인.md §3-2). accent = 눈·입·화염 색,
 * screen = CRT 화면 배경(검정이 아니라 액센트 hue 틴트 근흑색 — 원작 규칙).
 */

export const SKINS = [
  { id: "joobi",   name: "주비", accent: "#39ff14", screen: "#0b290d", price: 0,
    tagline: "첫 반려 줍" },
  { id: "amber",   name: "앰버", accent: "#ffb000", screen: "#18240c", price: 100,
    tagline: "호박색 계기판 감성" },
  { id: "cyan",    name: "시아", accent: "#2de2e6", screen: "#0a271b", price: 250,
    tagline: "시원한 성격" },
  { id: "magenta", name: "마젠", accent: "#ff2e97", screen: "#181b16", price: 450,
    tagline: "새침한 멋쟁이" },
  { id: "lime",    name: "라임", accent: "#a0ff70", screen: "#122913", price: 700,
    tagline: "라임 소다처럼 통통" },
  { id: "gold",    name: "골디", accent: "#ffd25e", screen: "#182612", price: 1000,
    tagline: "전설의 청소 요원" },
];

/** id로 스킨을 찾는다. 저장 데이터가 깨져 있어도 기본 줍으로 안전하게 폴백. */
export function skinById(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/**
 * 스킨 구매를 시도한다. 성공하면 profile 을 직접 갱신하고 true 를 반환.
 * (조각 부족·이미 보유 시 false — 호출 쪽 UI가 흔들기 연출 등으로 알린다)
 */
export function tryUnlock(profile, skinId) {
  const skin = skinById(skinId);
  if (profile.unlockedSkins.includes(skin.id)) return false;
  if (profile.shards < skin.price) return false;

  profile.shards -= skin.price;
  profile.unlockedSkins.push(skin.id);
  return true;
}
