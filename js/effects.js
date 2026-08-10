/**
 * effects.js — 화면의 "손맛": 파티클, 점수 팝업, 화면 흔들림
 *
 * 게임성 체감의 절반은 피드백이다. 무언가 일어날 때마다
 * 눈에 보이는 반응(파티클·팝업)과 몸에 오는 반응(흔들림)을 함께 준다.
 *
 * 전부 짧은 수명의 일회성 객체 목록이므로, 파이썬의 list 다루듯
 * push 하고 수명이 다하면 filter 로 걷어낸다.
 */

/** 이펙트 상태 컨테이너를 만든다. (한 판 동안 유지) */
export function createEffects() {
  return {
    particles: [],  // {x, y, vx, vy, life, maxLife, color, size}
    popups: [],     // {x, y, text, color, life, maxLife}
    shake: 0,       // 화면 흔들림 세기 (px, 매 프레임 감쇠)
  };
}

/** 수집·충돌 지점에서 사방으로 튀는 파티클 폭죽 */
export function spawnBurst(effects, x, y, color, count = 10, speed = 160) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.4 + Math.random() * 0.6);
    effects.particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

/** "+120" 같은 떠오르는 점수 팝업 */
export function spawnPopup(effects, x, y, text, color) {
  effects.popups.push({ x, y, text, color, life: 0.8, maxLife: 0.8 });
}

/** 화면 흔들림 요청. 기존 흔들림보다 클 때만 갱신 (연타로 심해지지 않게) */
export function addShake(effects, amount) {
  effects.shake = Math.max(effects.shake, amount);
}

export function updateEffects(effects, dt) {
  for (const p of effects.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.05, dt); // 공기 저항처럼 감속
    p.vy *= Math.pow(0.05, dt);
    p.life -= dt;
  }
  effects.particles = effects.particles.filter((p) => p.life > 0);

  for (const pop of effects.popups) {
    pop.y -= 45 * dt; // 위로 떠오른다
    pop.life -= dt;
  }
  effects.popups = effects.popups.filter((p) => p.life > 0);

  effects.shake *= Math.pow(0.0005, dt); // 빠른 지수 감쇠
  if (effects.shake < 0.3) effects.shake = 0;
}

/**
 * 흔들림 오프셋을 반환한다. main.js 가 draw 직전에 ctx.translate 로 적용.
 */
export function shakeOffset(effects) {
  if (effects.shake === 0) return { x: 0, y: 0 };
  return {
    x: (Math.random() * 2 - 1) * effects.shake,
    y: (Math.random() * 2 - 1) * effects.shake,
  };
}

export function drawEffects(ctx, effects, unit) {
  // 파티클: 수명에 따라 투명해지며 사라진다
  for (const p of effects.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // 점수 팝업: 모노스페이스(세븐세그먼트 대체 원칙) + 글로우
  ctx.font = `bold ${Math.round(unit * 0.045)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  for (const pop of effects.popups) {
    ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
    ctx.fillStyle = pop.color;
    ctx.shadowColor = pop.color;
    ctx.shadowBlur = 8;
    ctx.fillText(pop.text, pop.x, pop.y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}
