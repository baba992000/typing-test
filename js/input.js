let timerInterval;
let startTime;
let typing = false;
let sampleText = "";
let sampleWindow = null;
let warningTimer = null; // ← 警告自動削除タイマー

const LIMIT = 600; // 制限時間（秒）
const inputArea = document.getElementById("inputArea");
const timeDisplay = document.getElementById("time");
const typedCharsDisplay = document.getElementById("typedChars");
const mistakesDisplay = document.getElementById("mistakes");
const message = document.getElementById("message");

document.getElementById("sampleBtn").addEventListener("click", openSample);
document.getElementById("startBtn").addEventListener("click", startTyping);
document
  .getElementById("stopBtn")
  .addEventListener("click", () => stopTyping(false));
document.getElementById("resetBtn").addEventListener("click", resetTyping);

// sample.html から見本文を受信
window.addEventListener("message", (event) => {
  if (event.data.type === "sampleTextLoaded") {
    sampleText = event.data.text;
    resetTyping();
  }
});

// ---------------------------------------------------
// 半角検出と除去（半角カタカナも禁止）
// ---------------------------------------------------
function detectAndBlockHalfWidth(input, cursorPos) {
  // 半角英数字・半角記号・半角スペース・半角カタカナ（FF61〜FF9F）
  const halfWidthRegex = /[\u0020-\u007E\uFF61-\uFF9F]/;

  if (!halfWidthRegex.test(input)) {
    return { text: input, cursor: cursorPos, blocked: false };
  }

  // 半角文字をすべて削除
  const removed = input.replace(/[\u0020-\u007E\uFF61-\uFF9F]/g, "");

  return { text: removed, cursor: removed.length, blocked: true };
}

// ---------------------------------------------------
// 警告メッセージ表示（5秒後に自動消去）
// ---------------------------------------------------
function showWarning(msg) {
  message.textContent = msg;

  // 既存タイマーがあればリセット
  if (warningTimer) clearTimeout(warningTimer);

  // 5秒後に消す
  warningTimer = setTimeout(() => {
    message.textContent = "";
  }, 5000);
}

// ---------------------------------------------------
// 誤字数計算
// ---------------------------------------------------
function calcMistakes(input, correct) {
  const inputPure = input.replace(/\n/g, "");
  const correctPure = correct.replace(/\n/g, "");

  const n = inputPure.length;
  const m = correctPure.length;

  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    dp[i] = new Array(m + 1).fill(Number.MAX_SAFE_INTEGER);
  }

  dp[0][0] = 0;
  for (let j = 1; j <= m; j++) dp[0][j] = 0;
  for (let i = 1; i <= n; i++) dp[i][0] = i;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (inputPure[i - 1] === correctPure[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 1][j - 1]);
      } else {
        dp[i][j] = Math.min(dp[i][j], dp[i - 1][j - 1] + 1);
      }

      dp[i][j] = Math.min(dp[i][j], dp[i][j - 1] + 1);
      dp[i][j] = Math.min(dp[i][j], dp[i - 1][j] + 1);
    }
  }

  let best = Number.MAX_SAFE_INTEGER;
  for (let j = 0; j <= m; j++) {
    if (dp[n][j] < best) best = dp[n][j];
  }
  return best === Number.MAX_SAFE_INTEGER ? 0 : best;
}

// ---------------------------------------------------
// 見本ウィンドウを開く
// ---------------------------------------------------
function openSample() {
  if (!sampleWindow || sampleWindow.closed) {
    sampleWindow = window.open(
      "sample.html",
      "sampleWindow",
      "width=800,height=800"
    );
  } else {
    sampleWindow.focus();
  }
}

// ---------------------------------------------------
// タイピング開始
// ---------------------------------------------------
function startTyping() {
  if (typing) return;
  typing = true;

  inputArea.disabled = false;
  inputArea.focus();
  message.textContent = "";

  startTime = new Date();
  timerInterval = setInterval(updateTime, 1000);
}

// ---------------------------------------------------
// 時間更新
// ---------------------------------------------------
function updateTime() {
  const now = new Date();
  const sec = Math.floor((now - startTime) / 1000);

  const m = Math.floor(sec / 60);
  const s = sec % 60;

  timeDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(
    2,
    "0"
  )}`;

  if (sec >= LIMIT) stopTyping(true);
}

// ---------------------------------------------------
// タイピング終了
// ---------------------------------------------------
function stopTyping(timeout = false) {
  if (!typing) return;
  typing = false;

  clearInterval(timerInterval);
  inputArea.disabled = true;

  const typed = inputArea.value;
  const typedLen = typed.replace(/\n/g, "").length;
  const mistakes = calcMistakes(typed, sampleText);

  typedCharsDisplay.textContent = typedLen;
  mistakesDisplay.textContent = mistakes;

  if (timeout) {
    message.textContent = `時間切れです！ 入力文字数：${typedLen} 誤字数：${mistakes}`;
  } else {
    message.textContent = `ストップしました！ 入力文字数：${typedLen} 誤字数：${mistakes}`;
  }
}

// ---------------------------------------------------
// リセット
// ---------------------------------------------------
function resetTyping() {
  typing = false;
  clearInterval(timerInterval);

  inputArea.disabled = true;
  inputArea.value = "";

  timeDisplay.textContent = "00:00";
  typedCharsDisplay.textContent = "0";
  mistakesDisplay.textContent = "0";
  message.textContent = "";
}

// ---------------------------------------------------
// 入力の自動改行処理
// ---------------------------------------------------
const maxCount = 40;
let processing = false;
let composing = false;

inputArea.addEventListener("compositionstart", () => (composing = true));
inputArea.addEventListener("compositionend", () => {
  composing = false;
  handleInput();
});
inputArea.addEventListener("input", handleInput);

function handleInput() {
  if (processing || composing) return;
  processing = true;

  const oldValue = inputArea.value;
  const oldCursor = inputArea.selectionStart;

  // ① 半角チェック（今回の強化版）
  const halfCheck = detectAndBlockHalfWidth(oldValue, oldCursor);
  if (halfCheck.blocked) {
    inputArea.value = halfCheck.text;
    inputArea.selectionStart = inputArea.selectionEnd = halfCheck.cursor;

    showWarning("※ 半角文字は入力できません。全角で入力してください。");

    processing = false;
    return;
  }

  // ② 自動改行
  const newLines = [];
  const lines = oldValue.split("\n");

  for (let line of lines) {
    let count = 0;
    let chunk = "";

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      count += /[ -~]/.test(ch) ? 0.5 : 1;
      chunk += ch;

      if (count >= maxCount) {
        newLines.push(chunk);
        chunk = "";
        count = 0;
      }
    }
    if (chunk.length || line === "") newLines.push(chunk);
  }

  const newValue = newLines.join("\n");

  if (newValue !== oldValue) {
    inputArea.value = newValue;
    inputArea.selectionStart = inputArea.selectionEnd = newValue.length;
  }

  // ③ リアルタイム誤字数
  if (typing) {
    const typed = inputArea.value;
    const typedLen = typed.replace(/\n/g, "").length;
    const mistakes = calcMistakes(typed, sampleText);

    typedCharsDisplay.textContent = typedLen;
    mistakesDisplay.textContent = mistakes;
  }

  processing = false;
}
