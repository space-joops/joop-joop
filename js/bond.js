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

/* 스킨(도색)별 성격 대사 — 인사말에 30% 확률로 혼입 (§10-7).
   키는 skins.js 의 스킨 id 와 1:1. */
const SKIN_LINES = {
  joobi: [
    "당신의 첫 반려 줍이라는 게 자랑스러워요!",
    "처음 만난 날, 기억하세요? 저는 전부 기억해요.",
  ],
  amber: [
    "오늘은 계기판 바늘이 전부 '좋음'을 가리키고 있어요.",
    "앰버색은 마음이 따뜻해지는 색이래요.",
  ],
  cyan: [
    "시원하게 궤도 한 바퀴, 어때요?",
    "우주는 넓고, 쓰레기는 많죠. …가볼까요.",
  ],
  magenta: [
    "이 도색, 꽤 근사하죠? 후훗.",
    "멋진 로봇은 청소도 우아하게 한답니다.",
  ],
  lime: [
    "통통! 오늘도 에너지가 넘쳐요!",
    "라임 소다처럼 톡 쏘는 하루예요!",
  ],
  gold: [
    "전설의 청소 요원, 대기 중입니다.",
    "금빛은 아무에게나 어울리는 게 아니랍니다.",
  ],
};

/* 유대 최고 단계에서만, 그것도 10% 확률로만 나오는 진심 대사 (§10-7).
   자주 보이면 히든이 아니다 — 확률을 올리고 싶어져도 참는다. */
const HIDDEN_BEST_LINES = [
  "사실… 처음 만난 날부터 당신이 좋았어요.",
  "우주에서 제일 소중한 건, 쓰레기가 아니라 당신이에요.",
  "케슬러 신드롬이 다 끝나도, 곁에 있을게요.",
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 첫 화면 인사말. 우선순위:
 *   이름 조르기(기본 이름, 40%) → 히든(최고 단계, 10%) → 스킨 성격(30%) → 단계 기본
 * 이름 짓기가 애착의 첫 단추라서, 기능을 설명하지 않고 캐릭터가 말하게 한다.
 */
export function greeting(tier, hasCustomName, skinId) {
  if (!hasCustomName && Math.random() < 0.4) {
    return "저에게 이름을 지어주시면 기뻐요! (✏️)";
  }
  if (tier.id === "best" && Math.random() < 0.1) {
    return pick(HIDDEN_BEST_LINES);
  }
  if (SKIN_LINES[skinId] && Math.random() < 0.3) {
    return pick(SKIN_LINES[skinId]);
  }
  return pick(GREETINGS[tier.id]);
}

/** 유대 단계 상승 축하 대사 (§10-5) */
export function tierUpLine(tier) {
  return `🎉 유대가 깊어졌어요! 이제 "${tier.label}"!`;
}

/** 잠들 때 / 깰 때 대사 (§10-6) */
export function sleepLine() {
  return pick(["쿨… 쿨…", "zzZ…", "…음냐."]);
}

export function wakeLine() {
  return pick([
    "앗! 깜빡 잠들었어요…",
    "으음… 벌써 아침인가요?",
    "헉, 자는 거 보셨어요?",
  ]);
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
