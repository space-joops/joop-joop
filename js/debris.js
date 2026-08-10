/**
 * debris.js — 궤도 위 오브젝트: 우주 쓰레기 · 위험 파편 · 별조각
 *
 * 오브젝트의 생애: spawn(생성) → update(공전하며 줍에게 접근) → 충돌 or 화면 밖 → 제거
 *
 * 오브젝트 형태 (평범한 객체 — 파이썬 dict 감각):
 *   { kind: "debris"|"danger"|"star",  // 종류 (게임디자인 §2)
 *     variant: 0|1|2,                  // 쓰레기 시각 다양성용 (캔/볼트/파편)
 *     angle: number,                   // 지구 기준 각도 (rad)
 *     lane: 0|1,                       // 안쪽/바깥 궤도
 *     radiusPx: number,                // 현재 반지름 (자석 효과로 궤도를 벗어날 수 있음)
 *     nearMissChecked: boolean }       // 니어미스 중복 집계 방지
 */

import { CONFIG } from "./config.js";
import { polarToXy } from "./world.js";
import { isFever } from "./state.js";

/** 현재 경과 시간에 맞는 난이도 값을 계산한다 (게임디자인 §5의 선형 증가+상한). */
export function difficultyAt(elapsedSeconds) {
  const d = CONFIG.difficulty;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return {
    angularVelocity: clamp(
      d.angularVelocityStart + d.angularVelocityGain * elapsedSeconds,
      d.angularVelocityStart, d.angularVelocityMax),
    spawnInterval: clamp(
      d.spawnIntervalStart + d.spawnIntervalGain * elapsedSeconds,
      d.spawnIntervalMin, d.spawnIntervalStart),
    dangerRatio: elapsedSeconds < d.graceSeconds
      ? 0 // 첫 10초는 위험 없음 — 첫 판이 곧 튜토리얼 (기획서 §4-1)
      : clamp(d.dangerRatioStart + d.dangerRatioGain * elapsedSeconds,
              d.dangerRatioStart, d.dangerRatioMax),
  };
}

/**
 * 스폰 타이머를 돌리고, 시간이 되면 새 오브젝트를 만든다.
 * 줍은 화면 위쪽(-90도)에 고정되어 있으므로, 오브젝트는 진행 방향
 * 앞쪽(왼쪽 지평선 너머)에서 태어나 줍 쪽으로 흘러온다.
 */
export function updateSpawning(run, dt, layout) {
  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;

  const diff = difficultyAt(run.elapsedSeconds);
  run.spawnTimer = diff.spawnInterval;

  // 종류 결정: 위험 비율 → 남은 확률에서 별조각 → 나머지는 쓰레기
  let kind = "debris";
  const roll = Math.random();
  if (roll < diff.dangerRatio) kind = "danger";
  else if (roll < diff.dangerRatio + CONFIG.difficulty.starChance) kind = "star";

  const lane = Math.random() < 0.5 ? 0 : 1;
  run.objects.push({
    kind,
    variant: Math.floor(Math.random() * 3),
    // 줍(-90도)보다 반시계쪽으로 100~130도 앞에서 태어난다 → 화면 왼쪽 밖
    angle: CONFIG.joop.angleOnScreen - (Math.PI * (100 + Math.random() * 30)) / 180,
    lane,
    radiusPx: layout.laneRadius[lane],
    nearMissChecked: false,
  });
}

/**
 * 모든 오브젝트를 공전시키고, 수명이 다한 것을 제거한다.
 * 피버 중에는 수집물이 줍에게 빨려온다(자석 효과, 게임디자인 §4).
 *
 * @param {{x, y}} joopPos 줍의 현재 화면 좌표 (자석 목표점)
 */
export function updateObjects(run, dt, layout, joopPos) {
  const diff = difficultyAt(run.elapsedSeconds);
  const magnetRadius = CONFIG.joop.radius * layout.unit * CONFIG.fever.magnetRadiusRatio;

  for (const obj of run.objects) {
    obj.angle += diff.angularVelocity * dt; // 시계 방향(각도 증가)으로 줍을 지나쳐 간다

    if (isFever(run) && obj.kind !== "danger") {
      // 자석: 극좌표 대신 화면 좌표에서 줍 쪽으로 직진시키는 게 단순하고 자연스럽다
      const pos = polarToXy(layout, obj.angle, obj.radiusPx);
      const dx = joopPos.x - pos.x;
      const dy = joopPos.y - pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < magnetRadius && dist > 1) {
        const pull = CONFIG.fever.magnetPullSpeed * layout.unit * dt;
        // 화면 좌표에서 당긴 위치를 다시 극좌표로 환산해 저장한다
        const nx = pos.x + (dx / dist) * pull;
        const ny = pos.y + (dy / dist) * pull;
        obj.angle = Math.atan2(ny - layout.earthY, nx - layout.earthX);
        obj.radiusPx = Math.hypot(nx - layout.earthX, ny - layout.earthY);
      }
    }
  }

  // 줍을 한참 지나친 오브젝트는 제거 (줍 각도 + 60도 이상)
  const expireAngle = CONFIG.joop.angleOnScreen + Math.PI / 3;
  run.objects = run.objects.filter((obj) => obj.angle < expireAngle);
}

/**
 * 오브젝트 하나의 화면 좌표와 반지름을 구한다. (충돌·그리기 공용)
 */
export function objectGeometry(obj, layout) {
  const key = { debris: "debrisRadius", danger: "dangerRadius", star: "starRadius" }[obj.kind];
  return {
    ...polarToXy(layout, obj.angle, obj.radiusPx),
    r: CONFIG.objects[key] * layout.unit,
  };
}

/**
 * 오브젝트를 그린다. 종류마다 실루엣이 뚜렷하게 다르게 —
 * "초록=줍는다, 빨강 가시=피한다"를 색약 유저도 형태로 구분할 수 있게 한다.
 */
export function drawObjects(ctx, run, layout, time) {
  for (const obj of run.objects) {
    const { x, y, r } = objectGeometry(obj, layout);
    ctx.save();
    ctx.translate(x, y);

    if (obj.kind === "debris") {
      drawDebris(ctx, r, obj.variant, time + obj.angle * 10);
    } else if (obj.kind === "danger") {
      drawDanger(ctx, r, time);
    } else {
      drawStar(ctx, r, time);
    }
    ctx.restore();
  }
}

/** 우주 쓰레기 3종: 0=음료캔, 1=볼트, 2=패널 조각. 전부 초록 계열 발광. */
function drawDebris(ctx, r, variant, wobble) {
  ctx.rotate(Math.sin(wobble) * 0.3); // 둥실둥실 떠다니는 느낌
  ctx.fillStyle = "#35e07a";
  ctx.shadowColor = "#35e07a";
  ctx.shadowBlur = 10;

  if (variant === 0) {
    // 음료캔: 둥근 사각형 + 뚜껑 선
    roundRect(ctx, -r * 0.55, -r * 0.8, r * 1.1, r * 1.6, r * 0.25);
    ctx.fill();
    ctx.fillStyle = "#7ce64b";
    ctx.fillRect(-r * 0.55, -r * 0.8, r * 1.1, r * 0.3);
  } else if (variant === 1) {
    // 볼트: 육각형
    polygonPath(ctx, 6, r * 0.85);
    ctx.fill();
    ctx.fillStyle = "#0d1a12";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 패널 조각: 찌그러진 삼각형
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.6);
    ctx.lineTo(r * 0.8, r * 0.3);
    ctx.lineTo(0, -r * 0.9);
    ctx.closePath();
    ctx.fill();
  }
}

/** 위험 파편: 빨간 가시 뭉치 — 한눈에 "만지면 아픈" 실루엣 */
function drawDanger(ctx, r, time) {
  // 점선 경고 링 — 원작 식별 훈련의 "색각 무관 형태 단서" 규칙 계승 (아트디자인 §4)
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(255, 92, 119, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.rotate(time * 2); // 위협적으로 빙글빙글
  ctx.fillStyle = "#ff5c77";
  ctx.shadowColor = "#ff5c77";
  ctx.shadowBlur = 12;
  polygonPath(ctx, 5, r, r * 0.45); // 5갈래 가시(별 모양 스파이크)
  ctx.fill();
  ctx.fillStyle = "#4a1520";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

/** 별조각: 노랑 반짝임 + 크기 맥동 */
function drawStar(ctx, r, time) {
  const pulse = 1 + Math.sin(time * 6) * 0.15;
  ctx.scale(pulse, pulse);
  ctx.rotate(time);
  ctx.fillStyle = "#ffb23e";
  ctx.shadowColor = "#ffb23e";
  ctx.shadowBlur = 14;
  polygonPath(ctx, 4, r, r * 0.4); // 4갈래 별
  ctx.fill();
}

/* ── 도형 헬퍼 ── */

/** 정다각형 또는 스파이크(innerR 지정 시) 경로를 만든다. */
function polygonPath(ctx, points, outerR, innerR = null) {
  ctx.beginPath();
  const total = innerR === null ? points : points * 2;
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const radius = innerR === null ? outerR : (i % 2 === 0 ? outerR : innerR);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 둥근 모서리 사각형 경로 (구형 브라우저 호환을 위해 직접 구현) */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
