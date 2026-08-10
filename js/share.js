/**
 * share.js — 점수 공유: 공유 카드 이미지 + Web Share + 클립보드 폴백
 *
 * 시장분석 §5의 발견성 리스크 대응 — "점수 자랑 + URL 공유" 바이럴 루프.
 *
 * 3단 폴백 사다리 (위에서부터 시도, 안 되면 아래로):
 *   1. 이미지 파일 공유  — 모바일 (Web Share API Level 2)
 *   2. 텍스트+URL 공유   — 파일 공유 미지원 브라우저
 *   3. 클립보드 복사     — 데스크톱 등 Web Share 자체가 없는 환경
 *
 * 반환값은 UI 연출용 상태 문자열: "shared" | "copied" | "cancelled" | "failed"
 */

import { drawJoopPortrait } from "./joop.js";
import { skinById } from "./skins.js";

const GAME_URL = "https://joop-joop.vercel.app";

/** 공유 문구. 점수 자랑 + 세계관 한 스푼. */
function shareText(run) {
  return `🛰️ 줍줍!에서 우주 쓰레기 ${run.debrisCollected}개를 주웠어요! `
    + `점수 ${run.score.toLocaleString()}점 — 함께 지구 궤도를 청소해요!`;
}

/**
 * 공유 카드 이미지(1080×1080 PNG)를 만든다.
 * 아이콘과 같은 방식: 게임의 실제 렌더 코드로 그려서 브랜드가 일치한다.
 */
async function makeShareCard(run, skin) {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // 배경: 딥스페이스 + 별 + 궤도 아크
  ctx.fillStyle = "#030a05";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const s = 2 + Math.random() * 4;
    ctx.fillStyle = `rgba(228, 242, 233, ${0.25 + Math.random() * 0.5})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  ctx.strokeStyle = "rgba(53, 224, 122, 0.4)";
  ctx.lineWidth = 6;
  ctx.setLineDash([28, 40]);
  ctx.beginPath();
  ctx.arc(size / 2, size * 1.7, size * 1.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 줍 초상화 (중앙 상단)
  const portraitSize = 460;
  const tmp = document.createElement("canvas");
  tmp.width = portraitSize;
  tmp.height = portraitSize;
  drawJoopPortrait(tmp.getContext("2d"), portraitSize, skin);
  ctx.drawImage(tmp, (size - portraitSize) / 2, 90);

  // 텍스트 — 원작 규칙대로 캔버스 fillText + 모노스페이스
  ctx.textAlign = "center";
  ctx.fillStyle = "#35e07a";
  ctx.shadowColor = "#35e07a";
  ctx.shadowBlur = 30;
  ctx.font = "bold 110px ui-monospace, monospace";
  ctx.fillText("줍줍!", size / 2, 660);

  ctx.fillStyle = "#ffb23e";               // 수치는 앰버 (투톤 위계)
  ctx.shadowColor = "#ffb23e";
  ctx.font = "bold 150px ui-monospace, monospace";
  ctx.fillText(`${run.score.toLocaleString()}점`, size / 2, 820);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#e4f2e9";
  ctx.font = "44px ui-monospace, monospace";
  ctx.fillText(`우주 쓰레기 ${run.debrisCollected}개 수거 완료`, size / 2, 900);

  ctx.fillStyle = "#8a9e92";
  ctx.font = "36px ui-monospace, monospace";
  ctx.fillText(GAME_URL.replace("https://", ""), size / 2, 990);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** 공유 실행. 실패해도 게임이 죽지 않도록 모든 단계를 감싼다. */
export async function shareScore(run, profile) {
  const text = shareText(run);

  // 1) 이미지 파일 공유 (모바일)
  try {
    const blob = await makeShareCard(run, skinById(profile.selectedSkin));
    const file = new File([blob], "joopjoop-score.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "줍줍!", text, url: GAME_URL });
      return "shared";
    }
  } catch (error) {
    if (error.name === "AbortError") return "cancelled"; // 사용자가 공유 시트를 닫음
  }

  // 2) 텍스트+URL 공유
  try {
    if (navigator.share) {
      await navigator.share({ title: "줍줍!", text, url: GAME_URL });
      return "shared";
    }
  } catch (error) {
    if (error.name === "AbortError") return "cancelled";
  }

  // 3) 클립보드 복사 (데스크톱 최종 폴백)
  try {
    await navigator.clipboard.writeText(`${text} ${GAME_URL}`);
    return "copied";
  } catch {
    return "failed";
  }
}
