/**
 * bond.js — 유대(Bond): 내 줍과 얼마나 정들었나
 *
 * 원작 joop-03의 유대 4단계 명칭을 그대로 계승한다 (게임디자인 §10-2).
 * 원작에서는 한 판 연출용(저장 안 됨)이던 것을, 여기서는 누적형으로
 * 영속화한다 — 파생작이 원작의 미해결 부채를 자산으로 만드는 두 번째 사례
 * (첫 번째는 gold 스킨).
 */

import { CONFIG } from "./config.js";

/* 4단계 — min 은 필요한 유대 점수. 원작 명칭 그대로. */
export const BOND_TIERS = [
  { id: "cold",  min: 0,    label: "아직 낯가려요" },
  { id: "warm",  min: 150,  label: "친해지는 중" },
  { id: "close", min: 500,  label: "든든한 동료" },
  { id: "best",  min: 1200, label: "한 몸처럼" },
];

/** 유대 점수 = 누적 수거 + 쓰다듬기×5 (§10-2). 감점은 없다. */
export function bondPoints(profile) {
  return profile.totalDebris + profile.pets * CONFIG.bond.petPoints;
}

/** 현재 점수가 속한 단계를 돌려준다. */
export function bondTier(points) {
  let current = BOND_TIERS[0];
  for (const tier of BOND_TIERS) {
    if (points >= tier.min) current = tier;
  }
  return current;
}

/* ── 대사 ── */

/* 유대 단계별 인사말 풀. 첫 화면에 들어올 때 하나를 뽑는다. */
const GREETINGS = {
  cold: [
    "…안녕하세요. 아직은 조금 낯설어요.",
    "궤도 청소, 같이 가주실 거죠?",
    "저는 우주 쓰레기를 줍는 로봇이에요.",
  ],
  warm: [
    "오셨네요! 기다리고 있었어요.",
    "오늘은 어떤 쓰레기를 주울까요?",
    "조금씩 친해지는 것 같아요. 히히.",
  ],
  close: [
    "든든한 파트너, 출동 준비 완료!",
    "당신이랑 청소하는 게 제일 재밌어요!",
    "오늘도 궤도를 반짝반짝하게 만들어요!",
  ],
  best: [
    "한 몸처럼! 오늘도 함께해요!",
    "당신과 함께라면 케슬러 신드롬도 무섭지 않아요!",
    "우리는 우주 최강의 청소 콤비예요!",
  ],
};

/* 쓰다듬었을 때의 반응. 단계가 높을수록 더 살가운 대사가 섞인다. */
const PET_REACTIONS = {
  common: ["히히, 간지러워요!", "삐링~♪", "기분 좋아요!", "한 번 더요!"],
  best: ["세상에서 제일 좋아해요!", "당신 손은 참 따뜻하네요."],
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 첫 화면 인사말. 아직 기본 이름("줍이")이면 가끔 이름을 지어달라고 조른다 —
 * 이름 짓기가 애착의 첫 단추라서, 기능을 설명하지 않고 캐릭터가 말하게 한다.
 */
export function greeting(tier, hasCustomName) {
  if (!hasCustomName && Math.random() < 0.4) {
    return "저에게 이름을 지어주시면 기뻐요! (✏️)";
  }
  return pick(GREETINGS[tier.id]);
}

/** 쓰다듬기 반응 대사 */
export function petReaction(tier) {
  const pool = tier.id === "best"
    ? PET_REACTIONS.common.concat(PET_REACTIONS.best)
    : PET_REACTIONS.common;
  return pick(pool);
}

/** 이름을 새로 지어줬을 때의 반응 */
export function renameReaction(name) {
  return `${name}… 마음에 들어요! 고마워요!`;
}
