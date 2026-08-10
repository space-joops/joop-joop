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
    ctx.fillStyle = `rgba(228, 242, 233, ${alpha})`; // 연한 그린 화이트 (CSS --text 와 동일 계열)
    ctx.fillRect(x, y, size, size);
  }
  return canvas;
}

/**
 * 배경 전체를 그린다: 별 → (배경 위상) → 궤도 링 → 지구.
 *
 * @param {number} time        누적 시간(초) — 지구 자전·반짝임 연출용
 * @param {boolean} fever      피버 중이면 배경을 화려하게
 * @param {number} runElapsed  이번 판 경과 시간(초) — 배경 위상의 입력. 메뉴에서는 0
 */
export function drawWorld(ctx, layout, starfield, time, fever, runElapsed = 0) {
  const { width, height } = layout;

  // 1) 우주 배경 — 피버 중에는 살짝 보라빛 그라데이션
  if (fever) {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#150a1e");
    grad.addColorStop(1, "#030a05");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = "#030a05";
  }
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(starfield, 0, 0);

  // 1.5) 배경 위상: 오래 버틸수록 하늘이 변한다 (게임디자인 §9-3).
  //      피버 연출이 더 강하므로 피버 중에는 쉰다 (이슈 #17 우선순위).
  if (!fever) drawBackdropPhases(ctx, layout, runElapsed);

  // 2) 궤도 링 — 점선 원. 줍이 다니는 길이 항상 보이게
  for (const radius of layout.laneRadius) {
    ctx.beginPath();
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = -time * 40; // 점선이 흐르며 "세계가 도는" 느낌을 준다
    ctx.arc(layout.earthX, layout.earthY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = fever ? "rgba(240, 171, 252, 0.35)" : "rgba(53, 224, 122, 0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3) 지구 — 원작 브랜드 심볼을 따른 "경위도 그리드 관제 화면 지구"
  //    (파란 바다 지구가 아니라, CRT 콘솔에 표시된 지구. 아트디자인 §5)
  const { earthX, earthY, earthR } = layout;

  // 대기광: 지구 림의 형광 그린 빛
  const glow = ctx.createRadialGradient(earthX, earthY, earthR * 0.92, earthX, earthY, earthR * 1.12);
  glow.addColorStop(0, "rgba(53, 224, 122, 0)");
  glow.addColorStop(0.75, "rgba(53, 224, 122, 0.22)");
  glow.addColorStop(1, "rgba(53, 224, 122, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthR * 1.12, 0, Math.PI * 2);
  ctx.fill();

  // 본체: surface 색 원판 + 그린 윤곽선
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
  ctx.fillStyle = "#0a1c10";
  ctx.fill();
  ctx.strokeStyle = "rgba(53, 224, 122, 0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 경위도 그리드 — 그리드 색 #1e5a46 (원작 --color-grid).
  // 경도선은 자전(spin)에 따라 흐르고, 위도선은 고정된 동심 타원.
  const spin = time * 0.15;
  ctx.save();
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
  ctx.clip(); // 그리드가 지구 원 밖으로 새지 않게
  ctx.strokeStyle = "#1e5a46";
  ctx.lineWidth = 1.5;

  // 위도선: 지구 중심을 지나는 납작한 타원 4개
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.ellipse(earthX, earthY, earthR, earthR * (i / 5), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 경도선: 세로로 긴 타원. 자전에 따라 폭이 늘었다 줄며 "구가 도는" 착시를 만든다
  for (let i = 0; i < 6; i++) {
    const phase = spin + (i * Math.PI) / 6;
    const rx = Math.abs(Math.cos(phase)) * earthR;
    if (rx < 4) continue; // 정측면을 지나는 순간은 선이 사라진다
    ctx.beginPath();
    ctx.ellipse(earthX, earthY, rx, earthR, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 배경 위상 오버레이. 각 위상은 start 이후 fadeSeconds 에 걸쳐 나타나고,
 * 다음 위상이 나타나는 만큼 물러난다 — 급격한 색 변화 없이 하늘이 흐른다.
 */
function drawBackdropPhases(ctx, layout, runElapsed) {
  const { phases, fadeSeconds } = CONFIG.backdrop;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  for (let i = 0; i < phases.length; i++) {
    let alpha = clamp01((runElapsed - phases[i].start) / fadeSeconds);
    if (i + 1 < phases.length) {
      // 다음 위상이 등장한 만큼 이번 위상은 자리를 내준다
      alpha *= 1 - clamp01((runElapsed - phases[i + 1].start) / fadeSeconds);
    }
    if (alpha <= 0) continue;

    const grad = ctx.createLinearGradient(0, 0, 0, layout.height);
    grad.addColorStop(0, phases[i].top);
    grad.addColorStop(0.55, "rgba(0, 0, 0, 0)"); // 화면 중앙(플레이 영역)은 맑게 유지
    grad.addColorStop(1, phases[i].bottom);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.globalAlpha = 1;
  }
}
