let timerInterval;
let startTime;
let typing = false;
let sampleText = "";
let sampleWindow = null;

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
// 誤字数計算（入力に対して0から増やしていく形）
//
// 方針：ユーザーの入力 (inputPure) を、正解テキストの任意の接頭辞 (correctPure.slice(0,j))
// に合わせるのに必要な最小編集回数を求め、その最小値を誤字数とする。
// 初期条件で「入力が空のときは誤字0」となるように dp[0][j] = 0 としている。
// 操作コスト：置換 +1、欠落（正解を打たない）+1、余分入力 +1
// ---------------------------------------------------
function calcMistakes(input, correct) {
  const inputPure = input.replace(/\n/g, "");
  const correctPure = correct.replace(/\n/g, "");

  const n = inputPure.length;
  const m = correctPure.length;

  // dp[i][j] = inputPure の先頭 i 文字を correctPure の先頭 j 文字に変換する最小コスト
  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    dp[i] = new Array(m + 1).fill(Number.MAX_SAFE_INTEGER);
  }

  dp[0][0] = 0;
  // 入力が空のとき、正解の任意の接頭辞に対してコスト0（未入力の残りは誤字としない）
  for (let j = 1; j <= m; j++) dp[0][j] = 0;
  // 入力側に文字があるが正解が空の場合、余分入力は誤字としてカウント
  for (let i = 1; i <= n; i++) dp[i][0] = i;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      // 一致または置換
      if (inputPure[i - 1] === correctPure[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 1][j - 1]);
      } else {
        dp[i][j] = Math.min(dp[i][j], dp[i - 1][j - 1] + 1); // 置換
      }

      // 正解側の文字をスキップ（ユーザーがその文字を打たなかった） = 欠落（+1）
      dp[i][j] = Math.min(dp[i][j], dp[i][j - 1] + 1);

      // 入力側の文字をスキップ（ユーザーが余分に打った） = 余分入力（+1）
      dp[i][j] = Math.min(dp[i][j], dp[i - 1][j] + 1);
    }
  }

  // 入力を正解のどの接頭辞に合わせるのが最もコストが小さいかを取る
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
// 以下：入力中の自動改行処理
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
    const newCursor = computeNewCursor(oldValue, oldCursor);
    inputArea.value = newValue;
    inputArea.selectionStart = inputArea.selectionEnd = newCursor;
  }

  // リアルタイムに誤字・文字数を更新
  if (typing) {
    const typed = inputArea.value;
    const typedLen = typed.replace(/\n/g, "").length;
    const mistakes = calcMistakes(typed, sampleText);

    typedCharsDisplay.textContent = typedLen;
    mistakesDisplay.textContent = mistakes;
  }

  processing = false;
}

// ---------------------------------------------------
// カーソル位置を再計算
// ---------------------------------------------------
function computeNewCursor(oldValue, oldCursor) {
  const prefix = oldValue.slice(0, oldCursor);

  const newLines = [];
  const lines = prefix.split("\n");

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

  return newLines.join("\n").length;
}
