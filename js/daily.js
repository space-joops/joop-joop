/**
 * daily.js — 출석 보너스: 매일 첫 접속에 조각 지급
 *
 * 시장분석 §5의 리텐션 리스크 대응 — 웹은 푸시 알림이 없으니
 * "오늘도 들어올 이유"를 조각으로 만든다.
 *
 * 규칙 (게임디자인 §9-2):
 *   - 하루 1회. 기본 20조각, 연속 출석마다 +10, 상한 50.
 *   - 하루라도 건너뛰면 연속 기록이 1일차로 돌아간다.
 */

import { CONFIG } from "./config.js";

/** 로컬 기준 날짜 문자열 "YYYY-MM-DD" — 자정 넘김 판정의 기준 */
function dateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 오늘 몫의 보너스를 지급한다. profile 을 직접 갱신하며,
 * 저장(saveProfile)은 호출한 쪽의 책임이다.
 *
 * @returns {{granted: boolean, amount: number, streak: number}}
 */
export function claimDailyBonus(profile, now = new Date()) {
  const today = dateString(now);
  if (profile.lastBonusDate === today) {
    return { granted: false, amount: 0, streak: profile.bonusStreak };
  }

  const yesterday = dateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const isConsecutive = profile.lastBonusDate === yesterday;
  const streak = isConsecutive ? profile.bonusStreak + 1 : 1;

  const d = CONFIG.daily;
  const amount = Math.min(d.maxShards, d.baseShards + (streak - 1) * d.streakBonus);

  profile.lastBonusDate = today;
  profile.bonusStreak = streak;
  profile.shards += amount;
  return { granted: true, amount, streak };
}
