/**
 * world.js — 배경 세계 그리기: 별, 지구, 궤도 링
 *
 * 게임의 좌표 규약 (기술설계 §4):
 *  - 게임 공간은 "지구 중심 극좌표"다. 오브젝트는 (angle, lane)로 산다.
 *  - 그릴 때만 직교좌표로 바꾼다. 변환 함수 polarToXy() 하나로 통일한다.
 *  - 길이 단위는 "캔버스 CSS 너비 대비 비율" (기기 독립적).
 */

import { CONFIG } from "./config.js";

/**
 * 화면 크기에 따라 달라지는 배치 정보를 계산한다.
 * 리사이즈 때마다 새로 만들어 모든 모듈에 넘긴다.
 *
 * @returns {{width, height, earthX, earthY, earthR, laneRadius: number[], unit}}
 */
export function createLayout(width, height) {
  const w = CONFIG.world;
  return {
    width,
    height,
    unit: width,                        // "화면 너비 대비 비율" → 픽셀 환산 계수
    earthX: width / 2,
    earthY: height * w.earthCenterY,    // 지구는 화면 아래 바깥에 걸쳐 있다
    earthR: width * w.earthRadius,
    // lane 0 = 안쪽 궤도, lane 1 = 바깥 궤도
    laneRadius: [width * w.orbitInner, width * w.orbitOuter],
  };
}

/** 극좌표(지구 기준 각도, 반지름 px) → 캔버스 직교좌표 */
export function polarToXy(layout, angle, radiusPx) {
  return {
    x: layout.earthX + Math.cos(angle) * radiusPx,
    y: layout.earthY + Math.sin(angle) * radiusPx,
  };
}

/**
 * 별 배경을 오프스크린 캔버스에 1회만 그린다 (기술설계 §5).
 * 매 프레임 90개의 별을 다시 그리는 낭비를 피한다.
 */
export function createStarfield(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < CONFIG.world.starCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.6 + 0.4;
    const alpha = Math.random() * 0.6 + 0.25;
    ctx.fillStyle = `rgba(217, 251, 228, ${alpha})`; // 연한 그린 화이트 (CSS --text 와 동일 계열)
    ctx.fillRect(x, y, size, size);
  }
  return canvas;
}

/**
 * 배경 전체를 그린다: 별 → 궤도 링 → 지구.
 *
 * @param {number} time      누적 시간(초) — 지구 자전·반짝임 연출용
 * @param {boolean} fever    피버 중이면 배경을 화려하게
 */
export function drawWorld(ctx, layout, starfield, time, fever) {
  const { width, height } = layout;

  // 1) 우주 배경 — 피버 중에는 살짝 보라빛 그라데이션
  if (fever) {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#150a1e");
    grad.addColorStop(1, "#070b07");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = "#070b07";
  }
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(starfield, 0, 0);

  // 2) 궤도 링 — 점선 원. 줍이 다니는 길이 항상 보이게
  for (const radius of layout.laneRadius) {
    ctx.beginPath();
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = -time * 40; // 점선이 흐르며 "세계가 도는" 느낌을 준다
    ctx.arc(layout.earthX, layout.earthY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = fever ? "rgba(240, 171, 252, 0.35)" : "rgba(74, 222, 128, 0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3) 지구 — 화면 아래에 걸친 커다란 원. 디테일은 대륙 몇 덩어리로 충분
  const { earthX, earthY, earthR } = layout;

  // 대기광(글로우): 지구 테두리의 옅은 빛
  const glow = ctx.createRadialGradient(earthX, earthY, earthR * 0.92, earthX, earthY, earthR * 1.12);
  glow.addColorStop(0, "rgba(96, 165, 250, 0)");
  glow.addColorStop(0.7, "rgba(96, 165, 250, 0.25)");
  glow.addColorStop(1, "rgba(96, 165, 250, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthR * 1.12, 0, Math.PI * 2);
  ctx.fill();

  // 바다
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
  ctx.fillStyle = "#1e3a5f";
  ctx.fill();

  // 대륙 — 지구가 천천히 자전하는 것처럼 각도를 시간에 따라 민다
  const spin = time * 0.05;
  ctx.save();
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
  ctx.clip(); // 대륙이 지구 원 밖으로 새지 않게
  ctx.fillStyle = "#2f6b4f";
  for (let i = 0; i < 5; i++) {
    const a = spin + (i * Math.PI * 2) / 5;
    const cx = earthX + Math.cos(a) * earthR * 0.55;
    const cy = earthY + Math.sin(a) * earthR * 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, cy, earthR * 0.28, earthR * 0.18, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
