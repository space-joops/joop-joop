/**
 * state.js — 한 판(런)의 게임 상태
 *
 * 파이썬의 dataclass 처럼, "지금 판이 어떤 상황인가"를 담는 평범한 객체를
 * 만들어 주는 팩토리 함수 하나만 둔다. 로직은 각 모듈이 담당한다.
 */

import { CONFIG } from "./config.js";

/**
 * 새 판을 시작할 때의 초기 상태를 만든다.
 * 매 판 새로 만들어서 이전 판의 값이 새어 들어오는 버그를 원천 차단한다.
 */
export function createRunState() {
  return {
    // 시간
    elapsedSeconds: 0,       // 이번 판 경과 시간 — 난이도 곡선의 입력값

    // 점수·콤보
    score: 0,
    combo: 0,
    comboMultiplier: 1.0,
    shardsEarned: 0,         // 이번 판에 모은 조각 (판 끝나면 지갑에 합산)
    debrisCollected: 0,      // 결과 화면 통계용
    nearMissCount: 0,

    // 생명
    lives: CONFIG.lives,
    invincibleTimer: 0,      // 남은 무적 시간 (초). 0이면 맞을 수 있음

    // 피버
    feverGauge: 0,           // 0~1
    feverTimer: 0,           // 남은 피버 시간 (초). 0보다 크면 피버 중
    isNewBest: false,

    // 스폰
    spawnTimer: 0,           // 다음 스폰까지 남은 시간

    // 궤도 위 오브젝트 목록 (debris.js 가 채우고 비운다)
    objects: [],
  };
}

/** 피버 중인가? (여러 모듈이 물어보므로 헬퍼로 통일) */
export function isFever(run) {
  return run.feverTimer > 0;
}
