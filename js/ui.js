/**
 * ui.js — DOM 오버레이 관리: 화면 전환, HUD 갱신, 스킨 선택, 결과 화면
 *
 * 캔버스(게임 세계)와 DOM(HUD·메뉴)의 경계가 이 파일이다.
 * 게임 로직은 전혀 모르고, "받은 값을 화면에 보여주기"만 한다.
 */

import { SKINS } from "./skins.js";
import { drawJoopPortrait } from "./joop.js";

/* 자주 쓰는 요소를 한 번만 찾아둔다 (파이썬의 모듈 전역 캐시 감각) */
const els = {
  hud: document.getElementById("hud"),
  score: document.getElementById("hud-score"),
  lives: document.getElementById("hud-lives"),
  combo: document.getElementById("hud-combo"),
  comboCount: document.getElementById("hud-combo-count"),
  comboMult: document.getElementById("hud-combo-mult"),
  feverBar: document.getElementById("fever-bar"),
  feverFill: document.getElementById("fever-fill"),
  shardCount: document.getElementById("hud-shard-count"),
  title: document.getElementById("title-screen"),
  titleBest: document.getElementById("title-best"),
  skinPicker: document.getElementById("skin-picker"),
  result: document.getElementById("result-screen"),
  resultScore: document.getElementById("result-score"),
  resultDetail: document.getElementById("result-detail"),
  resultNewBest: document.getElementById("result-new-best"),
  startButton: document.getElementById("start-button"),
  retryButton: document.getElementById("retry-button"),
  shareButton: document.getElementById("share-button"),
  homeButton: document.getElementById("home-button"),
  muteButton: document.getElementById("mute-button"),
  dailyBonus: document.getElementById("daily-bonus"),
  speechBubble: document.getElementById("speech-bubble"),
  joopName: document.getElementById("joop-name"),
  bondChip: document.getElementById("bond-chip"),
  nameEdit: document.getElementById("name-edit"),
  nameInput: document.getElementById("name-input"),
  resultTitle: document.querySelector(".result-title"),
};

/** 버튼 이벤트를 연결한다. main.js 가 시작 시 한 번 호출. */
export function bindButtons({ onStart, onRetry, onShare, onHome, onMuteToggle }) {
  els.startButton.addEventListener("click", onStart);
  els.retryButton.addEventListener("click", onRetry);
  els.shareButton.addEventListener("click", onShare);
  els.homeButton.addEventListener("click", onHome);
  els.muteButton.addEventListener("click", onMuteToggle);
}

/** 3개 화면(title / playing / gameover) 중 하나만 보이게 전환한다. */
export function showScreen(name) {
  els.title.classList.toggle("hidden", name !== "title");
  els.hud.classList.toggle("hidden", name !== "playing");
  els.result.classList.toggle("hidden", name !== "gameover");
}

/** 타이틀 화면의 이름·유대·최고기록 줄 갱신 */
export function updateTitle(profile, bondTierLabel) {
  els.joopName.textContent = profile.joopName;
  els.bondChip.textContent = bondTierLabel;
  els.titleBest.textContent =
    profile.best > 0 ? `최고기록 ${profile.best.toLocaleString()} · 💠 ${profile.shards}` : "";
}

/** 줍의 말풍선에 대사를 띄운다. 같은 대사여도 팝 애니메이션을 다시 돈다. */
export function showSpeech(text) {
  els.speechBubble.textContent = text;
  els.speechBubble.classList.remove("hidden");
  // 애니메이션 재시작 트릭: 클래스를 뗐다 붙이면 안 되고, reflow 를 강제한다
  els.speechBubble.style.animation = "none";
  void els.speechBubble.offsetWidth;
  els.speechBubble.style.animation = "";
}

/**
 * 이름 편집 배선: ✏️ → 입력창으로 전환, Enter/포커스 이탈로 확정.
 * 검증(길이·공백)은 main.js 의 onRename 책임 — UI는 입력만 받는다.
 */
export function bindNameEdit(onRename) {
  const startEditing = () => {
    els.nameInput.value = els.joopName.textContent;
    els.nameInput.classList.remove("hidden");
    els.nameInput.focus();
    els.nameInput.select();
  };
  const finishEditing = () => {
    els.nameInput.classList.add("hidden");
    onRename(els.nameInput.value);
  };
  els.nameEdit.addEventListener("click", startEditing);
  els.nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") els.nameInput.blur(); // blur 가 finishEditing 을 부른다
    event.stopPropagation(); // 스페이스 입력이 게임 시작으로 새지 않게
  });
  els.nameInput.addEventListener("blur", finishEditing);
}

/** 플레이 중 매 프레임 호출되는 HUD 갱신 */
export function updateHud(run, feverActive) {
  els.score.textContent = run.score.toLocaleString();
  els.lives.textContent = "♥".repeat(run.lives) + "♡".repeat(Math.max(0, 3 - run.lives));
  els.shardCount.textContent = run.shardsEarned;

  // 콤보는 2 이상일 때만 보여준다 (1은 정보가 아니라 소음)
  const showCombo = run.combo >= 2;
  els.combo.classList.toggle("hidden", !showCombo);
  if (showCombo) {
    els.comboCount.textContent = run.combo;
    els.comboMult.textContent = `x${run.comboMultiplier.toFixed(1)}`;
  }

  els.feverFill.style.width = `${Math.round(run.feverGauge * 100)}%`;
  els.feverBar.classList.toggle("fever-active", feverActive);
}

/** 게임 오버 결과 화면 채우기 */
export function showResult(run, profile) {
  els.resultTitle.textContent = `${profile.joopName}의 임무 종료`; // 이름 = 애착 (§10-1)
  els.resultScore.textContent = run.score.toLocaleString();
  els.resultNewBest.classList.toggle("hidden", !run.isNewBest);
  els.resultDetail.innerHTML = [
    `🗑️ 주운 쓰레기 ${run.debrisCollected}개`,
    `💠 획득 조각 +${run.shardsEarned} (보유 ${profile.shards})`,
    `😎 니어미스 ${run.nearMissCount}회`,
    `🏆 최고기록 ${profile.best.toLocaleString()}`,
  ].join("<br />");
}

/**
 * 스킨 선택 칩들을 렌더한다.
 * 클릭 처리는 main.js 의 onSkinClick(skinId) 에 위임한다
 * (해금 결제·저장은 게임 로직의 일 — UI는 모른다).
 */
export function renderSkinPicker(profile, onSkinClick) {
  els.skinPicker.innerHTML = "";
  const dpr = window.devicePixelRatio || 1;

  for (const skin of SKINS) {
    const unlocked = profile.unlockedSkins.includes(skin.id);
    const selected = profile.selectedSkin === skin.id;

    const chip = document.createElement("button");
    chip.className = "skin-chip" +
      (selected ? " selected" : "") +
      (unlocked ? "" : " locked");
    chip.title = `${skin.name} — ${skin.tagline}`;

    // 미니 초상화 캔버스 (레티나 대응)
    const portrait = document.createElement("canvas");
    const size = 40;
    portrait.width = size * dpr;
    portrait.height = size * dpr;
    portrait.style.width = `${size}px`;
    portrait.style.height = `${size}px`;
    const pctx = portrait.getContext("2d");
    pctx.scale(dpr, dpr);
    drawJoopPortrait(pctx, size, skin);
    chip.appendChild(portrait);

    const label = document.createElement("div");
    label.textContent = skin.name;
    chip.appendChild(label);

    if (!unlocked) {
      const price = document.createElement("div");
      price.className = "price";
      price.textContent = `💠${skin.price}`;
      chip.appendChild(price);
    }

    chip.addEventListener("click", () => onSkinClick(skin.id));
    els.skinPicker.appendChild(chip);
  }
}

/** 음소거 버튼 아이콘 갱신 */
export function updateMuteButton(muted) {
  els.muteButton.textContent = muted ? "🔇" : "🔊";
}

/** 출석 보너스 토스트를 타이틀 화면에 띄운다. (오늘 이미 받았으면 호출 안 됨) */
export function showDailyBonus(amount, streak) {
  els.dailyBonus.textContent =
    streak >= 2
      ? `🎁 출석 보너스 +${amount}💠 (연속 ${streak}일!)`
      : `🎁 출석 보너스 +${amount}💠`;
  els.dailyBonus.classList.remove("hidden");
}

/**
 * 공유 결과를 버튼 라벨로 알려준다.
 * 공유 시트가 뜨는 환경(모바일)은 시트 자체가 피드백이라 라벨을 안 바꾼다.
 */
export function showShareFeedback(status) {
  const label = {
    copied: "📋 링크를 복사했어요!",
    failed: "😢 공유 실패",
  }[status];
  if (!label) return;

  els.shareButton.textContent = label;
  setTimeout(() => {
    els.shareButton.textContent = "📡 자랑하기";
  }, 1800);
}
