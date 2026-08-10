/**
 * config.js — 게임 밸런스의 단일 진실(Single Source of Truth)
 *
 * 모든 수치는 docs/03-게임디자인.md 와 1:1 로 대응한다.
 * 밸런스를 바꿀 때는 문서와 이 파일을 함께 고친다.
 *
 * 파이썬으로 치면 constants.py — 여기엔 로직이 없다.
 */

export const CONFIG = {
  // ── 공간: 지구 중심 극좌표. 반지름은 "화면 짧은 변 대비 비율"로 정의 ──
  // (기기마다 해상도가 달라도 같은 플레이가 되도록 절대 픽셀을 쓰지 않는다)
  world: {
    earthCenterY: 1.22,      // 지구 중심 y (화면 높이 대비. 1보다 크면 화면 아래 바깥)
    earthRadius: 0.52,       // 지구 반지름 (화면 너비 대비)
    orbitInner: 0.62,        // 안쪽 궤도 반지름 (화면 너비 대비)
    orbitOuter: 0.82,        // 바깥 궤도 반지름
    starCount: 90,           // 배경 별 개수
  },

  // ── 줍(플레이어) ──
  joop: {
    radius: 0.055,           // 몸통 반지름 (화면 너비 대비)
    angleOnScreen: -Math.PI / 2, // 줍이 화면에 고정되는 각도 (지구 기준 정면 위)
    laneSwitchSeconds: 0.18, // 궤도 전환에 걸리는 시간 (게임디자인 §1)
    invincibleSeconds: 1.5,  // 피격 후 무적 시간 (§2)
  },

  // ── 진행/난이도: 시작값 + 초당 증가, 상한 (§5) ──
  difficulty: {
    angularVelocityStart: 1.1,   // rad/s — 세계가 줍을 향해 흘러오는 속도
    angularVelocityGain: 0.018,  // rad/s 씩 매초 증가
    angularVelocityMax: 2.6,
    spawnIntervalStart: 0.9,     // 초
    spawnIntervalGain: -0.01,    // 매초 감소
    spawnIntervalMin: 0.45,
    dangerRatioStart: 0.15,      // 스폰 중 위험 파편 비율
    dangerRatioGain: 0.0045,     // 매초 +0.45%p
    dangerRatioMax: 0.4,
    graceSeconds: 10,            // 첫 10초는 위험 파편 없음 — 튜토리얼 대체 (§5)
    starChance: 0.08,            // 위험이 아닌 스폰 중 별조각 확률
  },

  // ── 점수·콤보 (§3) ──
  score: {
    debrisPoints: 10,        // 쓰레기 기본 점수
    comboStep: 5,            // 콤보 N개마다 배율 증가
    comboMultIncrement: 0.5, // 증가 폭
    comboMultMax: 5.0,
    nearMissPoints: 5,       // 니어미스 보너스 점수
    nearMissRadiusRatio: 1.6, // 위험 파편 반지름의 몇 배 안이면 니어미스인가
  },

  // ── 생명 ──
  lives: 3,

  // ── 피버 모드 (§4) ──
  fever: {
    gaugePerDebris: 0.06,    // 쓰레기 1개당 게이지 (0~1)
    gaugePerStar: 0.25,      // 별조각 1개당
    gaugeDecayPerSecond: 0.02,
    durationSeconds: 6,
    scoreMultiplier: 2,
    magnetRadiusRatio: 3.5,  // 줍 반지름의 몇 배 안 수집물을 끌어당기나
    magnetPullSpeed: 3.2,    // 끌려오는 속도 (화면 너비/초)
  },

  // ── 경제 (§6) ──
  economy: {
    shardPerDebris: 1,
    shardPerStar: 5,
    shardPerNearMiss: 1,
  },

  // ── 오브젝트 크기 (화면 너비 대비) ──
  objects: {
    debrisRadius: 0.032,
    dangerRadius: 0.038,
    starRadius: 0.03,
  },
};
