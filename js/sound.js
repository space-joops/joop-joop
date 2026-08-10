/**
 * sound.js — WebAudio 로 합성하는 칩튠 효과음
 *
 * 오디오 파일 에셋 없이 오실레이터로 모든 소리를 만든다 (기술설계 §1).
 * 원작 joop-03 도 같은 접근(코드 합성 사운드)을 쓴다.
 *
 * 설계:
 *  - AudioContext 는 브라우저 정책상 사용자 입력 이후에만 소리가 나므로,
 *    첫 탭에서 unlock() 을 호출해 깨운다.
 *  - 각 효과음은 "주파수 곡선 + 짧은 감쇠"의 조합. 통통 튀는 느낌(귀여움)을
 *    위해 사각파/삼각파 위주로 쓰고, 피치를 위로 벤딩한다.
 */

let ctx = null;      // AudioContext (lazy 생성)
let muted = false;

/** 첫 사용자 입력에서 호출 — 오디오 컨텍스트를 만들고 깨운다. */
export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

export function setMuted(value) {
  muted = value;
}

/**
 * 단음 하나를 재생하는 공통 헬퍼.
 *
 * @param {string} type   파형: "square" | "triangle" | "sine" | "sawtooth"
 * @param {number} from   시작 주파수(Hz)
 * @param {number} to     끝 주파수(Hz) — from 과 다르면 피치 벤딩
 * @param {number} duration 길이(초)
 * @param {number} volume 0~1
 * @param {number} delay  시작 지연(초) — 아르페지오용
 */
function tone(type, from, to, duration, volume = 0.15, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);

  // 짧은 어택 + 지수 감쇠 — "띠용" 하는 탄력 있는 소리의 핵심
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/* ── 효과음 사전 — 게임 이벤트마다 하나씩 ── */

/** 쓰레기 줍기: 콤보가 오를수록 음이 높아져 "상승감"을 준다. */
export function playCollect(combo) {
  // 콤보 12개마다 한 옥타브씩 올라가되 2옥타브에서 멈춤
  const step = Math.min(combo, 24);
  const base = 520 * Math.pow(2, step / 12);
  tone("square", base, base * 1.5, 0.09, 0.12);
}

/** 별조각: 반짝이는 2음 아르페지오 */
export function playStar() {
  tone("triangle", 880, 1320, 0.12, 0.16);
  tone("triangle", 1320, 1760, 0.14, 0.14, 0.07);
}

/** 궤도 전환: 짧은 "슝" (위/아래 방향에 따라 벤딩 방향이 다름) */
export function playSwitch(goingOut) {
  if (goingOut) tone("sine", 300, 520, 0.1, 0.1);
  else tone("sine", 520, 300, 0.1, 0.1);
}

/** 피격: 낮은 버저 — 아프지만 귀엽게 짧게 */
export function playHit() {
  tone("sawtooth", 220, 60, 0.25, 0.2);
  tone("square", 110, 55, 0.3, 0.12, 0.03);
}

/** 니어미스: 아슬아슬 "휙" */
export function playNearMiss() {
  tone("sine", 1500, 700, 0.08, 0.06);
}

/** 피버 발동: 팡파레 아르페지오 (도-미-솔-도) */
export function playFeverStart() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => tone("square", f, f, 0.12, 0.15, i * 0.07));
}

/** 게임 오버: 하강 3음 — 아쉽지만 무겁지 않게 */
export function playGameOver() {
  const notes = [392, 311, 261];
  notes.forEach((f, i) => tone("triangle", f, f * 0.97, 0.22, 0.16, i * 0.16));
}

/** 스킨 해금: 축하 팡파레 */
export function playUnlock() {
  const notes = [523, 659, 784, 1046, 1318];
  notes.forEach((f, i) => tone("triangle", f, f, 0.15, 0.15, i * 0.06));
}

/** 버튼/시작: 짧은 확인음 */
export function playStart() {
  tone("square", 440, 880, 0.12, 0.14);
}
