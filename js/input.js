let timerInterval;
let startTime;
let typing = false;
let sampleText = "";
let sampleWindow = null;

const LIMIT = 600;

// ★ 判定済みフラグ
let isFinished = false;

const inputArea = document.getElementById("inputArea");
const timeDisplay = document.getElementById("time");
const typedCharsDisplay = document.getElementById("typedChars");
const mistakesDisplay = document.getElementById("mistakes");
const netCharsDisplay = document.getElementById("netChars");
const rankDisplay = document.getElementById("rank");
const message = document.getElementById("message");
const highlight = document.getElementById("highlight");
const startBtn = document.getElementById("startBtn");

// ★ 初期状態でスタートボタン無効
startBtn.disabled = true;

// -----------------------------
// ★ 貼り付け禁止
// -----------------------------
inputArea.addEventListener("paste", (e) => {
  e.preventDefault();
});

// -----------------------------
// 段級判定
// -----------------------------
function getRank(net) {
  if (net >= 2000) return "特段";
  if (net >= 1500) return "初段";
  if (net >= 1000) return "1級";
  if (net >= 800) return "準1級";
  if (net >= 600) return "2級";
  if (net >= 450) return "準2級";
  if (net >= 350) return "3級";
  if (net >= 250) return "4級";
  if (net >= 100) return "5級";
  if (net >= 50) return "6級";
  return "未満";
}

// -----------------------------
// 40文字自動改行
// -----------------------------
function insertLineBreaks(text, maxCount = 40) {
  let count = 0;
  let newText = "";
  let skipSpace = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (skipSpace && (char === " " || char === "　")) continue;

    count += /[ -~]/.test(char) ? 0.5 : 1;
    newText += char;
    skipSpace = false;

    if (count >= maxCount) {
      newText += "\n";
      count = 0;
      skipSpace = true;
    }
  }
  return newText;
}

// -----------------------------
document.getElementById("sampleBtn").addEventListener("click", openSample);
document.getElementById("startBtn").addEventListener("click", startTyping);
document
  .getElementById("stopBtn")
  .addEventListener("click", () => stopTyping(false));
document.getElementById("resetBtn").addEventListener("click", resetTyping);

// -----------------------------
// ★ sample受信
// -----------------------------
window.addEventListener("message", (event) => {
  if (event.data.type === "sampleTextLoaded") {
    sampleText = event.data.text;
    resetTyping();

    // ★ スタートボタン有効化
    startBtn.disabled = false;
    message.textContent = "見本を読み込みました！スタートできます。";
  }
});

// -----------------------------
// ハイライト処理（変更なし）
// -----------------------------
function renderHighlight(input, correct) {
  highlight.innerHTML = "";

  const a = input.replace(/\n/g, "");
  const b = correct.replace(/\n/g, "");

  const n = a.length;
  const m = b.length;

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 2);
      }
    }
  }

  let best = Number.MAX_SAFE_INTEGER;
  let bestJ = 0;

  for (let j = 0; j <= m; j++) {
    if (dp[n][j] < best) {
      best = dp[n][j];
      bestJ = j;
    }
  }

  let i = n;
  let j = bestJ;
  const result = [];

  let lackCount = 0;
  let mistakes = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      if (lackCount > 0) {
        result.push(`<span class="lack">${a[i - 1]}</span>`);
        lackCount--;
        mistakes++;
      } else {
        result.push(`<span>${a[i - 1]}</span>`);
      }
      i--;
      j--;
    } else if (
      i > 1 &&
      j > 1 &&
      a[i - 1] === b[j - 2] &&
      a[i - 2] === b[j - 1]
    ) {
      result.push(`<span class="miss">${a[i - 1]}</span>`);
      result.push(`<span class="miss">${a[i - 2]}</span>`);
      i -= 2;
      j -= 2;
      mistakes += 2;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      result.push(`<span class="miss">${a[i - 1]}</span>`);
      i--;
      j--;
      mistakes++;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      result.push(`<span class="miss">${a[i - 1]}</span>`);
      i--;
      mistakes++;
    } else {
      lackCount++;
      j--;
    }
  }

  result.reverse();

  let html = "";
  let index = 0;

  for (let char of input) {
    if (char === "\n") {
      html += "<br>";
    } else {
      html += result[index] || `<span>${char}</span>`;
      index++;
    }
  }

  highlight.innerHTML = html;

  mistakesDisplay.textContent = mistakes;

  const typedLen = a.length;
  const net = Math.max(typedLen - mistakes, 0);

  netCharsDisplay.textContent = net;
  rankDisplay.textContent = getRank(net);
}

// -----------------------------
function openSample() {
  if (!sampleWindow || sampleWindow.closed) {
    sampleWindow = window.open(
      "sample.html",
      "sampleWindow",
      "width=800,height=800",
    );
  } else {
    sampleWindow.focus();
  }
}

// -----------------------------
// ★ スタート処理（制限追加）
// -----------------------------
function startTyping() {
  if (typing) return;

  // ★ sample未読み込み禁止
  if (!sampleText) {
    message.textContent = "見本を読み込んでください！";
    return;
  }

  typing = true;
  isFinished = false;

  inputArea.disabled = false;
  inputArea.focus();
  message.textContent = "";

  startTime = new Date();
  timerInterval = setInterval(updateTime, 1000);
}

// -----------------------------
function updateTime() {
  const now = new Date();
  const sec = Math.floor((now - startTime) / 1000);

  const m = Math.floor(sec / 60);
  const s = sec % 60;

  timeDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  if (sec >= LIMIT) stopTyping(true);
}

// -----------------------------
function stopTyping(timeout = false) {
  if (!typing) return;
  typing = false;

  clearInterval(timerInterval);
  inputArea.disabled = true;

  const typed = inputArea.value;
  const typedLen = typed.replace(/\n/g, "").length;

  typedCharsDisplay.textContent = typedLen;

  isFinished = true;
  renderHighlight(inputArea.value, sampleText);

  message.textContent = timeout
    ? `時間切れです！ 判定：${rankDisplay.textContent}`
    : `ストップしました！ 判定：${rankDisplay.textContent}`;
}

// -----------------------------
function resetTyping() {
  typing = false;
  isFinished = false;

  clearInterval(timerInterval);

  inputArea.disabled = true;
  inputArea.value = "";

  timeDisplay.textContent = "00:00";
  typedCharsDisplay.textContent = "0";
  mistakesDisplay.textContent = "0";
  netCharsDisplay.textContent = "0";
  rankDisplay.textContent = "未判定";

  message.textContent = "";
  highlight.innerHTML = "";
}

// -----------------------------
let processing = false;
let composing = false;

inputArea.addEventListener("compositionstart", () => (composing = true));
inputArea.addEventListener("compositionend", () => {
  composing = false;
  handleInput();
});
inputArea.addEventListener("input", handleInput);

// -----------------------------
function handleInput() {
  if (processing || composing) return;
  processing = true;

  const value = inputArea.value;
  const cursor = inputArea.selectionStart;

  const before = value.slice(0, cursor);
  const after = value.slice(cursor);

  const lines = before.split("\n");
  let currentLine = lines.pop();

  const formattedLine = insertLineBreaks(currentLine);

  const newBefore = [...lines, formattedLine].join("\n");
  const newValue = newBefore + after;

  if (newValue !== value) {
    inputArea.value = newValue;

    const diff = newBefore.length - before.length;
    const newCursor = cursor + diff;

    inputArea.selectionStart = inputArea.selectionEnd = newCursor;
  }

  if (typing) {
    const typedLen = inputArea.value.replace(/\n/g, "").length;
    typedCharsDisplay.textContent = typedLen;
  }

  if (isFinished) {
    renderHighlight(inputArea.value, sampleText);
  }

  processing = false;
}
