/**
 * joop.js — 줍 캐릭터: 그리기 + 표정 상태기계 + 애니메이션
 *
 * 원작 정본 스프라이트(흉상형)를 Canvas 2D 벡터로 재구현한다
 * (docs/04-아트디자인.md §3). 구조는 위에서 아래로:
 *   안테나(끝 앰버 비콘, 고정색!) → CRT 헤드(귀 포드 포함) → 흉부(LED 3개) → 노즐(화염)
 *
 * 귀여움의 3요소가 전부 여기에 있다:
 *   1. 표정 — idle(깜빡임) / happy(^눈) / hurt(×눈) / fever(별눈)
 *   2. 호버링 — 둥실둥실 떠 있는 사인파 움직임
 *   3. 스쿼시&스트레치 — 궤도 전환 때 몸이 늘었다 줄어드는 탄성
 */

import { CONFIG } from "./config.js";
import { polarToXy } from "./world.js";

/* 섀시 고정색 — 원작 PNG 실측값 (스킨과 무관, 아트디자인 §3-1) */
const CHASSIS = {
  body: "#c8d2c4",
  highlight: "#dde4da",
  shade: "#8ba08c",
  outline: "#5c6b5e",
  bezel: "#414d43",
  darkest: "#2a332c",
  ledAmber: "#f7b51e",   // 흉부 LED 중 1개는 항상 앰버 = 브랜드 비콘
  beacon: "#ffb23e",     // 안테나 구슬 — 어떤 스킨에서도 고정 (세계관 불변 규칙 2)
};

export class Joop {
  constructor() {
    this.lane = 0;             // 현재 궤도 (0=안쪽, 1=바깥)
    this.laneProgress = 0;     // 0(안쪽)~1(바깥) 사이의 전환 진행도
    this.mood = "idle";        // idle | happy | hurt
    this.moodTimer = 0;        // 남은 표정 유지 시간
    this.blinkTimer = 2.5;     // 다음 깜빡임까지 남은 시간
    this.blinking = 0;         // 깜빡임 남은 시간 (0이면 눈 뜸)
    this.hoverPhase = Math.random() * Math.PI * 2;
    this.squash = 0;           // 스쿼시&스트레치 강도 (-1~1, 0으로 감쇠)
    this.shakeTimer = 0;       // 피격 셰이크 남은 시간
  }

  /** 궤도 전환 입력. 전환 "느낌"을 위해 스쿼시를 걸어준다. */
  switchLane() {
    this.lane = this.lane === 0 ? 1 : 0;
    // 바깥으로 갈 땐 위로 늘어나고, 안쪽으로 갈 땐 눌린다
    this.squash = this.lane === 1 ? 0.55 : -0.45;
  }

  /** 수집/피격 등 이벤트로 표정을 바꾼다. */
  setMood(mood, seconds) {
    this.mood = mood;
    this.moodTimer = seconds;
    if (mood === "hurt") this.shakeTimer = 0.4;
  }

  update(dt) {
    // 궤도 전환: laneProgress 가 목표 lane 을 이징으로 따라간다
    const target = this.lane;
    const speed = 1 / CONFIG.joop.laneSwitchSeconds; // 초당 진행량
    if (this.laneProgress < target) {
      this.laneProgress = Math.min(target, this.laneProgress + speed * dt);
    } else if (this.laneProgress > target) {
      this.laneProgress = Math.max(target, this.laneProgress - speed * dt);
    }

    // 표정 타이머
    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0) this.mood = "idle";
    }

    // 깜빡임: 2.5~5초마다 0.12초간 눈을 감는다
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 0.12;
      this.blinkTimer = 2.5 + Math.random() * 2.5;
    }
    if (this.blinking > 0) this.blinking -= dt;

    // 호버링·스쿼시·셰이크 감쇠
    this.hoverPhase += dt * 3;
    this.squash *= Math.pow(0.001, dt); // 약 0.7초 만에 소멸하는 지수 감쇠
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
  }

  /** 현재 화면 좌표 (충돌 판정·자석 목표점으로도 쓰인다) */
  screenPosition(layout) {
    const [inner, outer] = layout.laneRadius;
    // 전환 구간에 easeInOut 을 걸어 기계적 직선 이동을 없앤다
    const t = this.laneProgress;
    const eased = t * t * (3 - 2 * t); // smoothstep
    const radius = inner + (outer - inner) * eased;
    const pos = polarToXy(layout, CONFIG.joop.angleOnScreen, radius);
    // 호버링: 살짝 둥실둥실
    pos.y += Math.sin(this.hoverPhase) * layout.unit * 0.008;
    return pos;
  }

  /**
   * 줍을 그린다.
   * @param {object} skin  SKINS 항목 ({accent, screen})
   * @param {boolean} fever  피버 중이면 별눈 + 큰 화염
   * @param {boolean} invincible  무적 중이면 깜빡임(반투명 토글)
   */
  draw(ctx, layout, skin, time, fever, invincible) {
    const { x, y } = this.screenPosition(layout);
    const r = CONFIG.joop.radius * layout.unit; // 기준 반지름

    ctx.save();
    ctx.translate(x, y);

    // 피격 셰이크 — 원작 아케이드의 sin 셰이크 방식
    if (this.shakeTimer > 0) {
      ctx.translate(Math.sin(this.shakeTimer * 60) * r * 0.15, 0);
    }
    // 무적 중 점멸: 절반 주기로 반투명
    if (invincible && Math.floor(time * 10) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // 진행 방향(왼쪽)으로 살짝 기울여 "날고 있다"는 인상을 준다
    ctx.rotate(-0.06);

    // 스쿼시&스트레치: 세로로 늘면 가로는 줄여 부피 보존 (애니메이션 12원칙)
    const sq = this.squash;
    ctx.scale(1 - sq * 0.35, 1 + sq * 0.5);

    const accent = fever ? feverAccent(time) : skin.accent;

    drawFlame(ctx, r, accent, time, fever);
    drawAntenna(ctx, r, time);
    drawHead(ctx, r, skin, accent, this.faceState(fever), time);
    drawChest(ctx, r, accent, time);

    ctx.restore();
  }

  /** 지금 그려야 할 눈 상태를 정한다. 우선순위: hurt > fever > happy > blink > idle */
  faceState(fever) {
    if (this.mood === "hurt") return "hurt";
    if (fever) return "fever";
    if (this.mood === "happy") return "happy";
    if (this.blinking > 0) return "blink";
    return "idle";
  }
}

/** 피버 중 액센트: 시간에 따라 무지개빛으로 도는 hue */
function feverAccent(time) {
  return `hsl(${(time * 120) % 360}, 95%, 65%)`;
}

/* ── 부위별 그리기 (전부 로컬 좌표: 원점 = 몸 중심, r = 기준 반지름) ── */

/** 하부 노즐 + 분사 화염. 화염은 눈물방울형(원작 move 프레임의 형태). */
function drawFlame(ctx, r, accent, time, fever) {
  // 노즐: 사다리꼴
  ctx.fillStyle = CHASSIS.shade;
  ctx.strokeStyle = CHASSIS.bezel;
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, r * 0.78);
  ctx.lineTo(r * 0.4, r * 0.78);
  ctx.lineTo(r * 0.28, r * 1.05);
  ctx.lineTo(-r * 0.28, r * 1.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 화염: 크기가 파닥파닥 흔들린다. 피버 땐 1.8배
  const flicker = 0.8 + Math.sin(time * 22) * 0.2;
  const size = r * 0.45 * flicker * (fever ? 1.8 : 1);
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = r * 0.5;
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, r * 1.05);
  ctx.quadraticCurveTo(0, r * 1.05 + size * 1.6, size * 0.45, r * 1.05);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** 안테나 + 앰버 비콘. 비콘은 브랜드 마크 — 스킨 색을 따르지 않는다! */
function drawAntenna(ctx, r, time) {
  ctx.strokeStyle = CHASSIS.outline;
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.05);
  ctx.lineTo(0, -r * 1.45);
  ctx.stroke();

  // 비콘: 부드럽게 맥동하는 앰버 불빛
  const pulse = 0.75 + Math.sin(time * 4) * 0.25;
  ctx.fillStyle = CHASSIS.beacon;
  ctx.shadowColor = CHASSIS.beacon;
  ctx.shadowBlur = r * 0.45 * pulse;
  ctx.beginPath();
  ctx.arc(0, -r * 1.52, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** CRT 헤드: 귀 포드 → 몸판 → 베젤 → 화면 → 얼굴 순서로 쌓는다. */
function drawHead(ctx, r, skin, accent, face, time) {
  // 귀 포드 (헤드 좌우의 작은 돌출부)
  ctx.fillStyle = CHASSIS.shade;
  roundRectPath(ctx, -r * 1.18, -r * 0.35, r * 0.22, r * 0.6, r * 0.08);
  ctx.fill();
  roundRectPath(ctx, r * 0.96, -r * 0.35, r * 0.22, r * 0.6, r * 0.08);
  ctx.fill();

  // 헤드 본체
  ctx.fillStyle = CHASSIS.body;
  ctx.strokeStyle = CHASSIS.outline;
  ctx.lineWidth = r * 0.07;
  roundRectPath(ctx, -r, -r * 1.05, r * 2, r * 1.55, r * 0.35);
  ctx.fill();
  ctx.stroke();

  // 상단 하이라이트 (림 라이트)
  ctx.fillStyle = CHASSIS.highlight;
  roundRectPath(ctx, -r * 0.85, -r * 0.98, r * 1.7, r * 0.18, r * 0.09);
  ctx.fill();

  // CRT 베젤 + 화면 (화면 배경은 액센트 틴트 근흑색 — 세계관 불변 규칙 3)
  ctx.fillStyle = CHASSIS.bezel;
  roundRectPath(ctx, -r * 0.78, -r * 0.75, r * 1.56, r * 1.05, r * 0.22);
  ctx.fill();
  ctx.fillStyle = skin.screen;
  roundRectPath(ctx, -r * 0.68, -r * 0.66, r * 1.36, r * 0.87, r * 0.16);
  ctx.fill();

  drawFace(ctx, r, accent, face, time);
}

/** 화면 속 표정. 눈은 항상 진행 방향(왼쪽)으로 살짝 쏠려 있다 (원작 규칙). */
function drawFace(ctx, r, accent, face, time) {
  const eyeY = -r * 0.28;
  const eyeGap = r * 0.36;   // 눈 사이 절반 거리
  const lean = -r * 0.05;    // 진행 방향 쏠림
  const eyeSize = r * 0.22;

  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = r * 0.3;
  ctx.lineWidth = r * 0.09;
  ctx.lineCap = "round";

  for (const side of [-1, 1]) {
    const ex = side * eyeGap + lean;

    if (face === "idle") {
      // 네모 눈 (CRT 픽셀 느낌)
      roundRectPath(ctx, ex - eyeSize / 2, eyeY - eyeSize / 2, eyeSize, eyeSize, r * 0.05);
      ctx.fill();
    } else if (face === "blink") {
      // 가로 대시 — 원작 idle B 프레임의 깜빡임
      ctx.beginPath();
      ctx.moveTo(ex - eyeSize / 2, eyeY);
      ctx.lineTo(ex + eyeSize / 2, eyeY);
      ctx.stroke();
    } else if (face === "happy") {
      // ^ 웃는 눈 — 원작 수거 성공 표정
      ctx.beginPath();
      ctx.moveTo(ex - eyeSize / 2, eyeY + eyeSize * 0.25);
      ctx.lineTo(ex, eyeY - eyeSize * 0.3);
      ctx.lineTo(ex + eyeSize / 2, eyeY + eyeSize * 0.25);
      ctx.stroke();
    } else if (face === "hurt") {
      // × 눈 — 원작 피격 표정
      const s = eyeSize * 0.45;
      ctx.beginPath();
      ctx.moveTo(ex - s, eyeY - s); ctx.lineTo(ex + s, eyeY + s);
      ctx.moveTo(ex + s, eyeY - s); ctx.lineTo(ex - s, eyeY + s);
      ctx.stroke();
    } else if (face === "fever") {
      // 별눈 — 피버의 반짝임
      starPath(ctx, ex, eyeY, eyeSize * 0.7, time * 3);
      ctx.fill();
    }
  }

  // 입: 짧은 선. happy 면 웃는 곡선, hurt 면 물결
  const mouthY = eyeY + r * 0.42;
  ctx.beginPath();
  if (face === "happy" || face === "fever") {
    ctx.arc(lean, mouthY - r * 0.06, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  } else if (face === "hurt") {
    ctx.moveTo(lean - r * 0.15, mouthY);
    ctx.quadraticCurveTo(lean - r * 0.05, mouthY - r * 0.08, lean + r * 0.05, mouthY);
    ctx.quadraticCurveTo(lean + r * 0.12, mouthY + r * 0.06, lean + r * 0.15, mouthY);
  } else {
    ctx.moveTo(lean - r * 0.12, mouthY);
    ctx.lineTo(lean + r * 0.12, mouthY);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** 흉부: 작은 패널 + LED 3개. 가운데는 항상 앰버(브랜드), 양옆은 액센트 점멸. */
function drawChest(ctx, r, accent, time) {
  ctx.fillStyle = CHASSIS.body;
  ctx.strokeStyle = CHASSIS.outline;
  ctx.lineWidth = r * 0.06;
  roundRectPath(ctx, -r * 0.55, r * 0.5, r * 1.1, r * 0.34, r * 0.1);
  ctx.fill();
  ctx.stroke();

  const ledY = r * 0.67;
  const blinkOn = Math.floor(time * 2) % 2 === 0;
  const leds = [
    { x: -r * 0.3, color: blinkOn ? accent : CHASSIS.darkest },
    { x: 0,        color: CHASSIS.ledAmber },  // 항상 켜진 앰버 비콘
    { x: r * 0.3,  color: blinkOn ? CHASSIS.darkest : accent },
  ];
  for (const led of leds) {
    ctx.fillStyle = led.color;
    ctx.beginPath();
    ctx.arc(led.x, ledY, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 스킨 선택 UI용 미니 초상화. 작은 캔버스에 얼굴만 크게 그린다.
 * (ui.js 가 스킨 칩마다 호출)
 */
export function drawJoopPortrait(ctx, size, skin) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2 + size * 0.06);
  const r = size * 0.34;
  drawAntenna(ctx, r, 1);           // time 고정 = 정지 초상화
  drawHead(ctx, r, skin, skin.accent, "idle", 0);
  ctx.restore();
}

/* ── 도형 헬퍼 ── */

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx, cx, cy, outerR, rotation) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const radius = i % 2 === 0 ? outerR : outerR * 0.45;
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2 + rotation;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
