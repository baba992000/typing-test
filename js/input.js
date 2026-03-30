let timerInterval;
let startTime;
let typing = false;
let sampleText = "";
let sampleWindow = null;
let warningTimer = null;

const LIMIT = 600;
const inputArea = document.getElementById("inputArea");
const timeDisplay = document.getElementById("time");
const typedCharsDisplay = document.getElementById("typedChars");
const mistakesDisplay = document.getElementById("mistakes");
const message = document.getElementById("message");
const highlight = document.getElementById("highlight");

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
window.addEventListener("message", (event) => {
  if (event.data.type === "sampleTextLoaded") {
    sampleText = event.data.text;
    resetTyping();
  }
});

// -----------------------------
// ★ 改良版ハイライト（不足→次文字を赤）
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
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
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

  let markNextAsMiss = false;

  while (i > 0 || j > 0) {
    // 一致
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      if (markNextAsMiss) {
        result.push(`<span class="miss">${a[i - 1]}</span>`);
        markNextAsMiss = false;
      } else {
        result.push(`<span>${a[i - 1]}</span>`);
      }
      i--;
      j--;
    }
    // 置換
    else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      result.push(`<span class="miss">${a[i - 1]}</span>`);
      i--;
      j--;
    }
    // 削除（余分）
    else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      result.push(`<span class="miss">${a[i - 1]}</span>`);
      i--;
    }
    // ★ 挿入（不足）→ 次を赤にする
    else {
      markNextAsMiss = true;
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
}

// -----------------------------
function detectAndBlockHalfWidth(input, cursorPos) {
  const halfWidthRegex = /[\u0020-\u007E\uFF61-\uFF9F]/;

  if (!halfWidthRegex.test(input)) {
    return { text: input, cursor: cursorPos, blocked: false };
  }

  const removed = input.replace(/[\u0020-\u007E\uFF61-\uFF9F]/g, "");
  return { text: removed, cursor: removed.length, blocked: true };
}

// -----------------------------
function showWarning(msg) {
  message.textContent = msg;

  if (warningTimer) clearTimeout(warningTimer);

  warningTimer = setTimeout(() => {
    message.textContent = "";
  }, 5000);
}

// -----------------------------
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
function startTyping() {
  if (typing) return;
  typing = true;

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
  const mistakes = calcMistakes(typed, sampleText);

  typedCharsDisplay.textContent = typedLen;
  mistakesDisplay.textContent = mistakes;

  message.textContent = timeout
    ? `時間切れです！ 入力文字数：${typedLen} 誤字数：${mistakes}`
    : `ストップしました！ 入力文字数：${typedLen} 誤字数：${mistakes}`;
}

// -----------------------------
function resetTyping() {
  typing = false;
  clearInterval(timerInterval);

  inputArea.disabled = true;
  inputArea.value = "";

  timeDisplay.textContent = "00:00";
  typedCharsDisplay.textContent = "0";
  mistakesDisplay.textContent = "0";
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

  let text = inputArea.value;
  const cursor = inputArea.selectionStart;

  const halfCheck = detectAndBlockHalfWidth(text, cursor);
  if (halfCheck.blocked) {
    inputArea.value = halfCheck.text;
    inputArea.selectionStart = inputArea.selectionEnd = halfCheck.cursor;

    showWarning("※ 半角文字は入力できません。全角で入力してください。");

    processing = false;
    return;
  }

  const noBreak = text.replace(/\n/g, "");
  const formatted = insertLineBreaks(noBreak);

  inputArea.value = formatted;
  inputArea.selectionStart = inputArea.selectionEnd = formatted.length;

  if (typing) {
    const typedLen = formatted.replace(/\n/g, "").length;
    const mistakes = calcMistakes(formatted, sampleText);

    typedCharsDisplay.textContent = typedLen;
    mistakesDisplay.textContent = mistakes;
  }

  renderHighlight(formatted, sampleText);

  processing = false;
}
