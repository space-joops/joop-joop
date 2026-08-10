/**
 * main.js — 진입점: 게임 루프와 상태 전환만 담당한다 (파이썬의 __main__ 감각)
 *
 * 상태 기계는 단 3개: "title" → "playing" → "gameover" → (반복)
 * 상태 전환은 반드시 이 파일의 startRun / endRun / gotoTitle 로만 일어난다.
 *
 * 프레임마다: update(dt) → draw(). 모든 움직임은 dt(초) 기반이라
 * 프레임레이트가 달라도 같은 플레이가 된다 (기술설계 §4).
 */

import { CONFIG } from "./config.js";
import { createRunState, isFever } from "./state.js";
import { loadProfile, saveProfile } from "./storage.js";
import { createLayout, createStarfield, drawWorld } from "./world.js";
import { Joop } from "./joop.js";
import { skinById, tryUnlock } from "./skins.js";
import {
  updateSpawning, updateObjects, objectGeometry, drawObjects,
} from "./debris.js";
import {
  createEffects, spawnBurst, spawnPopup, addShake,
  updateEffects, drawEffects, shakeOffset,
} from "./effects.js";
import { shareScore } from "./share.js";
import { claimDailyBonus } from "./daily.js";
import {
  bondPoints, bondTier, greeting, petReaction, renameReaction,
  tierUpLine, sleepLine, wakeLine,
} from "./bond.js";
import * as sound from "./sound.js";
import * as ui from "./ui.js";

/* ── 전역 상태 ── */
const canvas = document.getElementById("game-canvas");
const stage = document.getElementById("stage");
const ctx = canvas.getContext("2d");

let screenState = "title";      // title | playing | gameover
const profile = loadProfile();  // 영구 저장 데이터 (조각·스킨·최고기록)
let joop = new Joop();
const titleJoop = new Joop();   // 첫 화면의 대형 인사 줍 (쓰다듬기 대상)
let run = createRunState();     // 타이틀에서도 빈 run 을 둬서 draw 가 분기 없이 돈다
let effects = createEffects();
let layout = null;
let starfield = null;
let elapsedTotal = 0;           // 앱 시작 후 누적 시간 (연출용 시계)
let gameOverAt = 0;             // 게임 오버 시각 — 직후 오탭으로 인한 즉시 재시작 방지
let titleIdleSeconds = 0;       // 첫 화면 무입력 시간 — 20초면 줍이 잠든다 (§10-6)
let sleepZzTimer = 0;           // 다음 💤 까지 남은 시간
let pendingTierUp = null;       // 판에서 유대 단계가 올랐으면 기지 복귀 때 축하 (§10-5)

const SLEEP_AFTER_SECONDS = 20;

/* ── 캔버스 크기 설정: CSS 픽셀 × devicePixelRatio (기술설계 §5) ── */
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout = createLayout(width, height);
  starfield = createStarfield(width, height);
}

/* ── 상태 전환 ── */

function startRun() {
  run = createRunState();
  joop = new Joop();
  effects = createEffects();
  screenState = "playing";
  ui.showScreen("playing");
  sound.playStart();
}

function endRun() {
  // 이번 판의 조각을 지갑에 합산하고 최고기록을 갱신한다
  profile.shards += run.shardsEarned;
  const tierBefore = bondTier(bondPoints(profile));
  profile.totalDebris += run.debrisCollected; // 유대 점수의 몸통 (§10-2)
  const tierAfter = bondTier(bondPoints(profile));
  // 판 도중 축하로 흐름을 끊지 않는다 — 기지에서 줍과 마주 봤을 때 (§10-5)
  if (tierAfter.id !== tierBefore.id) pendingTierUp = tierAfter;
  run.isNewBest = run.score > profile.best;
  if (run.isNewBest) profile.best = run.score;
  saveProfile(profile);

  screenState = "gameover";
  gameOverAt = elapsedTotal;
  ui.showResult(run, profile);
  ui.showScreen("gameover");
  sound.playGameOver();
}

function gotoTitle() {
  screenState = "title";
  run = createRunState();
  joop = new Joop();
  wakeTitleJoop();
  const tier = bondTier(bondPoints(profile));
  ui.updateTitle(profile, tier.label);
  ui.renderSkinPicker(profile, onSkinClick);
  if (pendingTierUp) {
    celebrateTierUp(pendingTierUp); // 판에서 유대가 올랐다 — 지금이 축하할 순간
    pendingTierUp = null;
  } else {
    ui.showSpeech(greeting(tier, profile.joopName !== "줍이", profile.selectedSkin));
  }
  ui.showScreen("title");
}

/** 유대 단계 상승 축하: 대사 + 폭죽 + 팡파레 + 바운스 (§10-5) */
function celebrateTierUp(tier) {
  const pose = titlePose();
  titleJoop.setMood("happy", 2);
  titleJoop.squash = 0.6;
  spawnBurst(effects, pose.x, pose.y, "#35e07a", 18, 260);
  spawnBurst(effects, pose.x, pose.y, "#ffb23e", 18, 220);
  spawnPopup(effects, pose.x, pose.y - layout.unit * 0.2, "🎉", "#ffb23e");
  sound.playUnlock();
  ui.showSpeech(tierUpLine(tier));
  ui.updateTitle(profile, tier.label);
}

/** 잠든 줍을 깨우고 방치 타이머를 리셋한다. (모든 첫 화면 상호작용이 부른다) */
function wakeTitleJoop() {
  titleIdleSeconds = 0;
  titleJoop.sleeping = false;
}

/** 첫 화면 대형 줍의 위치·크기 (그리기와 쓰다듬기 판정이 공유) */
function titlePose() {
  // y 0.26: 하단 패널에 노즐·화염이 가려지지 않는 높이 (플레이테스트로 조정)
  return { x: layout.width / 2, y: layout.height * 0.26, scale: 3.0 };
}

/** 첫 화면에서 줍 근처를 탭하면 쓰다듬기 — 애착의 핵심 인터랙션 (§10-3) */
function tryPet(event) {
  const wasSleeping = titleJoop.sleeping;
  wakeTitleJoop(); // 어떤 탭이든 잠은 깬다

  const rect = stage.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const pose = titlePose();
  const reach = CONFIG.joop.radius * layout.unit * pose.scale * 2; // 판정은 넉넉하게
  if (Math.hypot(x - pose.x, y - pose.y) > reach) return;

  // 자던 줍을 탭했으면 이번 탭은 "깨우기" — 쓰다듬기 카운트 없음 (§10-6, 미안하니까)
  if (wasSleeping) {
    titleJoop.setMood("happy", 0.8);
    sound.playPet();
    ui.showSpeech(wakeLine());
    return;
  }

  const tierBefore = bondTier(bondPoints(profile));
  titleJoop.setMood("happy", 0.8);
  titleJoop.squash = 0.5; // 기분 좋은 바운스
  profile.pets += 1;
  saveProfile(profile);

  spawnPopup(effects, pose.x + (Math.random() * 60 - 30), pose.y - reach * 0.55, "💗", "#ff5c77");
  spawnBurst(effects, x, y, "#ff5c77", 8, 180);
  sound.playPet();

  const tierAfter = bondTier(bondPoints(profile));
  if (tierAfter.id !== tierBefore.id) {
    celebrateTierUp(tierAfter); // 쓰다듬다 단계가 올랐다 — 그 자리에서 축하 (§10-5)
    return;
  }
  ui.showSpeech(petReaction(tierAfter));
  ui.updateTitle(profile, tierAfter.label);
}

/* ── 입력 ── */

/** 탭/클릭/스페이스 공통 처리: 지금 화면에서 "주 행동"을 한다 */
function primaryAction() {
  sound.unlock(); // 브라우저 오디오 정책: 첫 입력에서 깨워야 소리가 난다
  if (screenState === "playing") {
    joop.switchLane();
    sound.playSwitch(joop.lane === 1);
  } else if (screenState === "gameover") {
    // 죽는 순간의 다급한 연타가 곧바로 새 판을 시작하지 않도록 0.6초 여유
    if (elapsedTotal - gameOverAt > 0.6) startRun(); // "한 판 더"까지 1탭 (기획서 §4-2)
  }
  // title 에서는 시작 버튼/스페이스로만 시작 (스킨 선택 오조작 방지)
}

function toggleMute() {
  profile.muted = !profile.muted;
  sound.setMuted(profile.muted);
  saveProfile(profile);
  ui.updateMuteButton(profile.muted);
}

/** 결과 화면의 "자랑하기" — 성공 여부와 무관하게 게임은 계속 */
async function onShare() {
  sound.unlock();
  const status = await shareScore(run, profile);
  ui.showShareFeedback(status);
}

function onSkinClick(skinId) {
  sound.unlock();
  wakeTitleJoop(); // 스킨을 고르는 것도 상호작용 — 잠 깨움 (§10-6)
  if (profile.unlockedSkins.includes(skinId)) {
    profile.selectedSkin = skinId; // 보유 스킨 → 바로 장착
    sound.playSwitch(true);
  } else if (tryUnlock(profile, skinId)) {
    profile.selectedSkin = skinId; // 해금 성공 → 축하하며 바로 장착
    sound.playUnlock();
  } else {
    sound.playHit(); // 조각 부족
  }
  saveProfile(profile);
  ui.updateTitle(profile);
  ui.renderSkinPicker(profile, onSkinClick);
}

stage.addEventListener("pointerdown", (event) => {
  // 버튼·스킨 칩·입력창은 각자의 핸들러가 처리한다 — 게임 탭으로 오인하지 않기
  if (event.target.closest("button, input")) return;
  if (screenState === "title") {
    sound.unlock();
    tryPet(event); // 타이틀에서 탭 = 쓰다듬기 (시작은 발사 버튼/스페이스)
  } else {
    primaryAction();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault(); // 스페이스의 페이지 스크롤 방지
    if (screenState === "title") startRun();
    else primaryAction();
  } else if (event.code === "KeyM") {
    toggleMute();
  }
});

window.addEventListener("resize", resize);

/* ── 게임 로직 업데이트 ── */

/** 이름 편집 확정: 검증 후 저장. 빈 이름·같은 이름은 조용히 무시 (§10-1) */
function onRename(rawName) {
  wakeTitleJoop();
  const name = rawName.trim().slice(0, 12);
  const tier = bondTier(bondPoints(profile));
  if (!name || name === profile.joopName) {
    ui.updateTitle(profile, tier.label); // 입력창을 닫으며 원래 표시로 복구
    return;
  }
  profile.joopName = name;
  saveProfile(profile);
  ui.updateTitle(profile, tier.label);
  ui.showSpeech(renameReaction(name));
  sound.playPet();
}

function update(dt) {
  elapsedTotal += dt;
  joop.update(dt);
  if (screenState === "title") {
    titleJoop.update(dt);
    updateTitleSleep(dt);
  }
  updateEffects(effects, dt);

  if (screenState !== "playing") return;

  run.elapsedSeconds += dt;
  if (run.invincibleTimer > 0) run.invincibleTimer -= dt;

  updateFever(dt);
  updateSpawning(run, dt, layout);

  const joopPos = joop.screenPosition(layout);
  updateObjects(run, dt, layout, joopPos);
  handleCollisions(joopPos);

  ui.updateHud(run, isFever(run));
}

/** 첫 화면 방치 감지: 20초 무입력이면 잠들고, 자는 동안 💤가 떠오른다 (§10-6) */
function updateTitleSleep(dt) {
  titleIdleSeconds += dt;
  if (!titleJoop.sleeping && titleIdleSeconds >= SLEEP_AFTER_SECONDS) {
    titleJoop.sleeping = true;
    ui.showSpeech(sleepLine());
    sleepZzTimer = 0;
  }
  if (titleJoop.sleeping) {
    sleepZzTimer -= dt;
    if (sleepZzTimer <= 0) {
      sleepZzTimer = 2.5;
      const pose = titlePose();
      spawnPopup(effects,
        pose.x + layout.unit * 0.18, pose.y - layout.unit * 0.2, "💤", "#8a9e92");
    }
  }
}

/** 피버 게이지 감쇠·타이머 진행 (게임디자인 §4) */
function updateFever(dt) {
  if (isFever(run)) {
    run.feverTimer -= dt;
    if (run.feverTimer <= 0) {
      run.feverTimer = 0;
      run.feverGauge = 0; // 피버가 끝나면 게이지 0부터 다시
    }
  } else if (run.feverGauge > 0) {
    run.feverGauge = Math.max(0, run.feverGauge - CONFIG.fever.gaugeDecayPerSecond * dt);
  }
}

/** 게이지가 가득 차면 피버 발동: 화면의 위험이 전부 별조각으로 변신한다 */
function triggerFever() {
  run.feverTimer = CONFIG.fever.durationSeconds;
  for (const obj of run.objects) {
    if (obj.kind === "danger") obj.kind = "star"; // "화면이 안전해진다" = 해방감
  }
  const joopPos = joop.screenPosition(layout);
  spawnPopup(effects, joopPos.x, joopPos.y - layout.unit * 0.12, "FEVER!", "#ffb23e");
  addShake(effects, 6);
  sound.playFeverStart();
}

/** 줍과 오브젝트의 충돌·수집·니어미스 판정 */
function handleCollisions(joopPos) {
  const joopR = CONFIG.joop.radius * layout.unit * 0.8; // 판정은 그림보다 후하게 살짝 작게
  const survivors = [];

  for (const obj of run.objects) {
    const geo = objectGeometry(obj, layout);
    const dist = Math.hypot(geo.x - joopPos.x, geo.y - joopPos.y);
    // 피버 중에는 위험 파편도 별조각 취급 (스폰 직후 변신 누락 대비 이중 안전망)
    const kind = isFever(run) && obj.kind === "danger" ? "star" : obj.kind;

    if (kind !== "danger" && dist < geo.r + joopR) {
      collect(kind, geo);
      continue; // 수집됨 — survivors 에 넣지 않는다
    }

    if (kind === "danger") {
      if (dist < geo.r * 0.9 + joopR && run.invincibleTimer <= 0) {
        hitDanger(geo);
        continue; // 부딪힌 파편은 터져서 사라진다
      }
      // 니어미스: 줍의 각도를 지나친 순간, 충분히 가까웠으면 보너스 (§3)
      if (!obj.nearMissChecked && obj.angle > CONFIG.joop.angleOnScreen) {
        obj.nearMissChecked = true;
        if (dist < geo.r * CONFIG.score.nearMissRadiusRatio + joopR) {
          run.score += CONFIG.score.nearMissPoints;
          run.shardsEarned += CONFIG.economy.shardPerNearMiss;
          run.nearMissCount += 1;
          spawnPopup(effects, joopPos.x, joopPos.y - layout.unit * 0.1, "아슬아슬!", "#38e0f0");
          sound.playNearMiss();
        }
      }
    }
    survivors.push(obj);
  }
  run.objects = survivors;
}

/** 수집 처리: 점수·콤보·조각·게이지·연출을 한 번에 */
function collect(kind, geo) {
  const feverMult = isFever(run) ? CONFIG.fever.scoreMultiplier : 1;

  if (kind === "debris") {
    run.combo += 1;
    run.comboMultiplier = Math.min(
      CONFIG.score.comboMultMax,
      1 + Math.floor(run.combo / CONFIG.score.comboStep) * CONFIG.score.comboMultIncrement,
    );
    const points = Math.round(CONFIG.score.debrisPoints * run.comboMultiplier * feverMult);
    run.score += points;
    run.shardsEarned += CONFIG.economy.shardPerDebris;
    run.debrisCollected += 1;
    run.feverGauge = Math.min(1, run.feverGauge + CONFIG.fever.gaugePerDebris);
    spawnPopup(effects, geo.x, geo.y, `+${points}`, "#35e07a");
    spawnBurst(effects, geo.x, geo.y, "#35e07a", 8);
    sound.playCollect(run.combo);
  } else {
    // 별조각: 점수 대신 조각과 게이지를 크게 (§2)
    run.shardsEarned += CONFIG.economy.shardPerStar;
    run.feverGauge = Math.min(1, run.feverGauge + CONFIG.fever.gaugePerStar);
    spawnPopup(effects, geo.x, geo.y, `+${CONFIG.economy.shardPerStar}💠`, "#ffb23e");
    spawnBurst(effects, geo.x, geo.y, "#ffb23e", 14, 220);
    sound.playStar();
  }

  joop.setMood("happy", 0.35); // 원작 collect 상태 유지 시간과 동일
  if (!isFever(run) && run.feverGauge >= 1) triggerFever();
}

/** 위험 파편 피격: 생명·콤보를 잃고 잠시 무적 */
function hitDanger(geo) {
  run.lives -= 1;
  run.combo = 0;
  run.comboMultiplier = 1.0;
  run.invincibleTimer = CONFIG.joop.invincibleSeconds;
  joop.setMood("hurt", 0.6);
  spawnBurst(effects, geo.x, geo.y, "#ff5c77", 16, 240);
  addShake(effects, 10);
  sound.playHit();

  if (run.lives <= 0) endRun();
}

/* ── 그리기 ── */

function draw() {
  const fever = isFever(run);
  const shake = shakeOffset(effects);

  ctx.save();
  ctx.translate(shake.x, shake.y);

  // 배경 위상은 플레이 중에만 진행된다 (메뉴에서는 항상 기본 심우주)
  const runElapsed = screenState === "playing" ? run.elapsedSeconds : 0;
  drawWorld(ctx, layout, starfield, elapsedTotal, fever, runElapsed);
  drawObjects(ctx, run, layout, elapsedTotal);

  const skin = skinById(profile.selectedSkin);
  if (screenState === "title") {
    // 타이틀의 주인공: 큰 줍이 화면 상단에서 플레이어를 맞이한다
    titleJoop.draw(ctx, layout, skin, elapsedTotal, false, false, titlePose());
  } else {
    joop.draw(ctx, layout, skin, elapsedTotal, fever, run.invincibleTimer > 0);
  }

  drawEffects(ctx, effects, layout.unit);
  ctx.restore();
}

/* ── 메인 루프 ── */

let lastTimestamp = 0;

function frame(timestamp) {
  // dt 상한 0.05초: 탭 전환 후 복귀 시 거대한 dt 로 물리가 폭주하는 것을 막는다
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000 || 0);
  lastTimestamp = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(frame);
}

/* ── 부팅 ── */

// PWA: 서비스 워커 등록 — 오프라인 플레이와 홈 화면 설치의 기반.
// 실패해도 게임은 그대로 돌아가야 하므로 조용히 무시한다 (예: file:// 로 열었을 때)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

resize();
sound.setMuted(profile.muted);
ui.updateMuteButton(profile.muted);
ui.bindButtons({
  onStart: startRun,
  onRetry: startRun,
  onShare: onShare,
  onHome: gotoTitle,
  onMuteToggle: toggleMute,
});
ui.bindNameEdit(onRename);

// 출석 보너스: 오늘 첫 접속이면 조각을 지급하고 타이틀에 토스트를 띄운다
const bonus = claimDailyBonus(profile);
if (bonus.granted) {
  saveProfile(profile);
  ui.showDailyBonus(bonus.amount, bonus.streak);
}

gotoTitle();
requestAnimationFrame(frame);
