let timerInterval;
let startTime;
let typing = false;
let sampleText = "";
let sampleWindow = null;

const LIMIT = 600;
const inputArea = document.getElementById("inputArea");
const timeDisplay = document.getElementById("time");
const typedCharsDisplay = document.getElementById("typedChars");
const mistakesDisplay = document.getElementById("mistakes");
const message = document.getElementById("message");

// ✅ イベント登録
document.getElementById("sampleBtn").addEventListener("click", openSample);
document.getElementById("startBtn").addEventListener("click", startTyping);
document
  .getElementById("stopBtn")
  .addEventListener("click", () => stopTyping(false));
document.getElementById("resetBtn").addEventListener("click", resetTyping);

// --- 見本テキスト受信 ---
window.addEventListener("message", (event) => {
  if (event.data.type === "sampleTextLoaded") {
    sampleText = event.data.text.replace(/\r?\n/g, "");
    console.log("見本文受信:", sampleText.slice(0, 50) + "...");
  }
});

// ✅ 見本ボタンで sample.html を開く
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

// --- タイピング開始 ---
function startTyping() {
  if (typing) return;
  typing = true;
  inputArea.disabled = false;
  inputArea.focus();
  message.textContent = "";

  startTime = new Date();
  timerInterval = setInterval(updateTime, 1000);
}

function updateTime() {
  const now = new Date();
  const totalSeconds = Math.floor((now - startTime) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timeDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
  if (totalSeconds >= LIMIT) stopTyping(true);
}

function stopTyping(timeout = false) {
  if (!typing) return;
  clearInterval(timerInterval);
  typing = false;
  inputArea.disabled = true;

  const typed = inputArea.value;
  const mistakes = calcMistakes(typed, sampleText);
  const correctCount = Math.max(getTypedLength(typed) - mistakes, 0);

  typedCharsDisplay.textContent = getTypedLength(typed);
  mistakesDisplay.textContent = mistakes;

  message.innerHTML = timeout
    ? `時間切れです！ 入力文字数：${getTypedLength(
        typed
      )} 誤字数：${mistakes} 正解数：${correctCount}`
    : `ストップしました！ 入力文字数：${getTypedLength(
        typed
      )} 誤字数：${mistakes} 正解数：${correctCount}`;
}

function resetTyping() {
  clearInterval(timerInterval);
  typing = false;
  inputArea.disabled = true;
  inputArea.value = "";
  timeDisplay.textContent = "00:00";
  typedCharsDisplay.textContent = "0";
  mistakesDisplay.textContent = "0";
  message.textContent = "";
}

// --- 誤字数計算 ---
function calcMistakes(input, correct) {
  const typed = input.replace(/\n/g, "");
  const target = correct.replace(/\n/g, "");
  let count = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== target[i]) count++;
  }
  return count;
}

function getTypedLength(text) {
  return text.replace(/\n/g, "").length;
}

// --- 自動改行 ---
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
        if (chunk.length > 0) newLines.push(chunk);
        chunk = "";
        count = 0;
      }
    }
    if (chunk.length > 0 || line === "") newLines.push(chunk);
  }

  const newValue = newLines.join("\n");

  if (newValue !== oldValue) {
    const newCursor = computeNewCursor(oldValue, oldCursor);
    inputArea.value = newValue;
    inputArea.selectionStart = inputArea.selectionEnd = newCursor;
  }

  if (typing) {
    const typed = inputArea.value;
    const mistakes = calcMistakes(typed, sampleText);
    typedCharsDisplay.textContent = getTypedLength(typed);
    mistakesDisplay.textContent = mistakes;
  }

  processing = false;
}

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
        if (chunk.length > 0) newLines.push(chunk);
        chunk = "";
        count = 0;
      }
    }
    if (chunk.length > 0 || line === "") newLines.push(chunk);
  }

  return newLines.join("\n").length;
}
