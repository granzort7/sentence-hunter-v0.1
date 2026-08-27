"use strict";

const GAME_DURATION_SECONDS = 90;
const STARTING_HEARTS = 3;
const STORAGE_KEY = "sentenceHunterHighScoreV01";

const CATEGORY_LABELS = {
  agreement: "주어·동사 수일치",
  verb_form: "동사 형태",
  tense: "시제",
  noun_plural: "명사 복수형",
  article: "관사",
  preposition: "전치사",
  quantifier: "수량 표현",
  comparison: "비교 표현",
  modal: "조동사",
  verb_pattern: "동사 구문",
  word_order: "어순·간접의문문",
  conditionals: "조건문",
  inversion: "도치",
  subjunctive: "요구·제안 구문",
  perfect_tense: "완료 시제"
};

const DIFFICULTY_BONUS = {
  starter: 0,
  everyday: 25,
  challenger: 50
};

const BUG_NAMES = [
  ["Tense Bug", "🪲"],
  ["Verb Virus", "🦠"],
  ["Article Ant", "🐜"],
  ["Syntax Spider", "🕷️"],
  ["Preposition Wasp", "🐝"],
  ["Inversion Imp", "👾"]
];

const QUESTIONS = window.SENTENCE_HUNTER_QUESTIONS;

if (!Array.isArray(QUESTIONS)) {
  throw new Error("questions.js must be loaded before app.js");
}


const ALLOWED_DIFFICULTIES = new Set(["starter", "everyday", "challenger"]);
const ALLOWED_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));

function validateQuestionBank(questions) {
  const errors = [];
  const ids = new Set();

  questions.forEach((question, index) => {
    const label = question?.id || `index:${index}`;
    if (!question || typeof question !== "object") {
      errors.push(`${label}: question must be an object`);
      return;
    }
    if (!question.id || ids.has(question.id)) {
      errors.push(`${label}: id is missing or duplicated`);
    }
    ids.add(question.id);
    if (!ALLOWED_DIFFICULTIES.has(question.difficulty)) {
      errors.push(`${label}: invalid difficulty '${question.difficulty}'`);
    }
    if (!ALLOWED_CATEGORIES.has(question.category)) {
      errors.push(`${label}: invalid category '${question.category}'`);
    }
    if (!Array.isArray(question.segments) || question.segments.length < 2) {
      errors.push(`${label}: segments must contain at least two items`);
    }
    if (!Number.isInteger(question.errorIndex) || question.errorIndex < 0 || question.errorIndex >= (question.segments?.length || 0)) {
      errors.push(`${label}: errorIndex is outside the segments range`);
    }
    if (!Array.isArray(question.choices) || question.choices.length !== 3) {
      errors.push(`${label}: choices must contain exactly three items`);
    }
    const answerCount = question.choices?.filter((choice) => choice === question.correctAnswer).length || 0;
    if (answerCount !== 1) {
      errors.push(`${label}: correctAnswer must appear exactly once in choices`);
    }
    ["correctAnswer", "correctSentence", "explanation"].forEach((field) => {
      if (typeof question[field] !== "string" || !question[field].trim()) {
        errors.push(`${label}: ${field} must be a non-empty string`);
      }
    });
    if (question.segments?.some((segment) => typeof segment !== "string" || !segment.trim())) {
      errors.push(`${label}: every segment must be a non-empty string`);
    }
  });

  if (errors.length) {
    errors.forEach((error) => console.error(`[Question validation] ${error}`));
  } else {
    console.info(`[Question validation] ${questions.length} questions passed.`);
  }
  return errors;
}

const QUESTION_VALIDATION_ERRORS = validateQuestionBank(QUESTIONS);
if (QUESTION_VALIDATION_ERRORS.length) {
  throw new Error(`Question bank validation failed with ${QUESTION_VALIDATION_ERRORS.length} error(s).`);
}

const elements = {
  screens: {
    start: document.getElementById("start-screen"),
    game: document.getElementById("game-screen"),
    result: document.getElementById("result-screen")
  },
  startButton: document.getElementById("start-button"),
  retryButton: document.getElementById("retry-button"),
  homeButton: document.getElementById("home-button"),
  soundToggles: [...document.querySelectorAll(".sound-toggle")],
  startHighScore: document.getElementById("start-high-score"),
  timerValue: document.getElementById("timer-value"),
  timerPill: document.getElementById("timer-pill"),
  scoreValue: document.getElementById("score-value"),
  hearts: document.getElementById("hearts"),
  comboBadge: document.getElementById("combo-badge"),
  arena: document.getElementById("arena"),
  feverLabel: document.getElementById("fever-label"),
  enemyWrap: document.getElementById("enemy-wrap"),
  enemyName: document.getElementById("enemy-name"),
  enemyEmoji: document.getElementById("enemy-emoji"),
  enemyHealthFill: document.getElementById("enemy-health-fill"),
  projectileLayer: document.getElementById("projectile-layer"),
  questionCard: document.getElementById("question-card"),
  difficultyChip: document.getElementById("difficulty-chip"),
  questionCount: document.getElementById("question-count"),
  phasePrompt: document.getElementById("phase-prompt"),
  sentenceSegments: document.getElementById("sentence-segments"),
  answerOptions: document.getElementById("answer-options"),
  feedback: document.getElementById("feedback"),
  solvedCount: document.getElementById("solved-count"),
  defeatedCount: document.getElementById("defeated-count"),
  bestComboLive: document.getElementById("best-combo-live"),
  resultReason: document.getElementById("result-reason"),
  resultGrade: document.getElementById("result-grade"),
  resultScore: document.getElementById("result-score"),
  resultAccuracy: document.getElementById("result-accuracy"),
  resultCombo: document.getElementById("result-combo"),
  resultSolved: document.getElementById("result-solved"),
  resultDefeated: document.getElementById("result-defeated"),
  resultWeakness: document.getElementById("result-weakness"),
  newRecordLabel: document.getElementById("new-record-label")
};

let state = createInitialState();
let audioContext = null;
let soundEnabled = true;

function createInitialState() {
  return {
    active: false,
    ended: false,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hearts: STARTING_HEARTS,
    solved: 0,
    correctAnswers: 0,
    wrongAttempts: 0,
    defeated: 0,
    enemyHp: 3,
    enemyMaxHp: 3,
    currentQuestion: null,
    currentQuestionNumber: 0,
    phase: "find",
    questionStartedAt: 0,
    gameStartedAt: 0,
    timerId: null,
    timeLeft: GAME_DURATION_SECONDS,
    usedIds: new Set(),
    categoryMistakes: {},
    locked: false,
    pendingTimeouts: []
  };
}

function showScreen(name) {
  Object.entries(elements.screens).forEach(([key, screen]) => {
    screen.classList.toggle("active", key === name);
  });
}

function getHighScore() {
  try {
    const value = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10);
    return Number.isFinite(value) ? value : 0;
  } catch (error) {
    console.warn("High score storage is unavailable in this browser context.", error);
    return 0;
  }
}

function setHighScore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch (error) {
    console.warn("High score could not be saved in this browser context.", error);
  }
}

function formatScore(value) {
  return Math.max(0, Math.round(value)).toLocaleString("ko-KR");
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function schedule(callback, delay) {
  const id = window.setTimeout(() => {
    state.pendingTimeouts = state.pendingTimeouts.filter((timeoutId) => timeoutId !== id);
    callback();
  }, delay);
  state.pendingTimeouts.push(id);
  return id;
}

function clearPendingTimeouts() {
  state.pendingTimeouts.forEach((id) => window.clearTimeout(id));
  state.pendingTimeouts = [];
}

function initAudio() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) audioContext = new AudioCtor();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
}

function tone(frequency, duration = 0.08, type = "sine", volume = 0.05, delay = 0) {
  if (!soundEnabled || !audioContext) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playCorrectSound(critical = false) {
  tone(critical ? 620 : 520, 0.1, "triangle", 0.055);
  tone(critical ? 930 : 760, 0.13, "triangle", 0.05, 0.07);
}

function playWrongSound() {
  tone(190, 0.18, "sawtooth", 0.045);
}

function playDefeatSound() {
  tone(440, 0.08, "square", 0.045);
  tone(660, 0.08, "square", 0.045, 0.07);
  tone(880, 0.13, "square", 0.045, 0.14);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  elements.soundToggles.forEach((button) => {
    button.textContent = soundEnabled ? "🔊" : "🔇";
  });
  if (soundEnabled) {
    initAudio();
    tone(520, 0.06, "sine", 0.035);
  }
}

function startGame() {
  initAudio();
  clearPendingTimeouts();
  if (state.timerId) window.clearInterval(state.timerId);
  state = createInitialState();
  state.active = true;
  state.gameStartedAt = performance.now();
  selectNewBug(true);
  showScreen("game");
  renderHud();
  nextQuestion();
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 100);
  tone(420, 0.07, "square", 0.04);
  tone(620, 0.1, "square", 0.04, 0.08);
}

function updateTimer() {
  if (!state.active || state.ended) return;
  const elapsed = (performance.now() - state.gameStartedAt) / 1000;
  const remaining = Math.max(0, GAME_DURATION_SECONDS - elapsed);
  state.timeLeft = Math.ceil(remaining);
  elements.timerValue.textContent = String(state.timeLeft);

  const fever = remaining <= 15 && remaining > 0;
  elements.timerPill.classList.toggle("danger", fever);
  elements.feverLabel.classList.toggle("active", fever);
  document.body.classList.toggle("fever-mode", fever);
  if (fever) elements.feverLabel.textContent = `FEVER ${Math.ceil(remaining)}`;

  if (remaining <= 0) endGame("time");
}

function chooseDifficulty() {
  if (state.solved < 3) return "starter";
  const roll = Math.random();
  if (state.solved < 8) return roll < 0.42 ? "starter" : "everyday";
  if (roll < 0.2) return "starter";
  if (roll < 0.72) return "everyday";
  return "challenger";
}

function pickQuestion() {
  if (state.usedIds.size >= QUESTIONS.length - 2) state.usedIds.clear();

  let difficulty = chooseDifficulty();
  let candidates = QUESTIONS.filter(
    (question) => question.difficulty === difficulty && !state.usedIds.has(question.id)
  );

  if (!candidates.length) {
    candidates = QUESTIONS.filter((question) => !state.usedIds.has(question.id));
  }

  const question = candidates[Math.floor(Math.random() * candidates.length)];
  state.usedIds.add(question.id);
  return question;
}

function nextQuestion() {
  if (!state.active || state.ended) return;
  state.locked = false;
  state.phase = "find";
  state.currentQuestion = pickQuestion();
  state.currentQuestionNumber += 1;
  state.questionStartedAt = performance.now();

  elements.answerOptions.classList.add("hidden");
  elements.answerOptions.innerHTML = "";
  elements.feedback.className = "feedback";
  elements.feedback.textContent = "";
  elements.phasePrompt.textContent = "틀린 부분을 터치하세요";
  elements.questionCount.textContent = `Q ${state.currentQuestionNumber}`;
  renderDifficulty(state.currentQuestion.difficulty);
  renderSentence();
}

function renderDifficulty(difficulty) {
  elements.difficultyChip.className = "difficulty-chip";
  if (difficulty !== "starter") elements.difficultyChip.classList.add(difficulty);
  elements.difficultyChip.textContent = difficulty.toUpperCase();
}

function renderSentence() {
  const question = state.currentQuestion;
  elements.sentenceSegments.innerHTML = "";

  question.segments.forEach((segment, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.textContent = segment;
    button.dataset.index = String(index);
    button.disabled = state.phase !== "find";

    if (state.phase === "fix" && index === question.errorIndex) {
      button.classList.add("selected-error");
    }

    button.addEventListener("click", () => handleSegmentTap(index));
    elements.sentenceSegments.appendChild(button);
  });
}

function handleSegmentTap(index) {
  if (!state.active || state.ended || state.locked || state.phase !== "find") return;
  initAudio();

  if (index === state.currentQuestion.errorIndex) {
    state.phase = "fix";
    elements.phasePrompt.textContent = "올바른 표현으로 교정하세요";
    renderSentence();
    renderChoices();
    tone(460, 0.055, "sine", 0.03);
    return;
  }

  registerMistake();
  state.combo = 0;
  playWrongSound();
  vibrate([70]);
  animateMiss();
  elements.feedback.className = "feedback error";
  elements.feedback.textContent = "MISS! 다른 부분을 찾아보세요.";
  loseHeart();
  renderHud();

  if (!state.ended) {
    state.locked = true;
    schedule(() => {
      state.locked = false;
      elements.feedback.className = "feedback";
      elements.feedback.textContent = "";
    }, 520);
  }
}

function renderChoices() {
  elements.answerOptions.innerHTML = "";
  elements.answerOptions.classList.remove("hidden");
  const choices = shuffle(state.currentQuestion.choices);

  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.textContent = choice;
    button.addEventListener("click", () => handleAnswer(choice, button));
    elements.answerOptions.appendChild(button);
  });
}

function handleAnswer(choice, button) {
  if (!state.active || state.ended || state.locked || state.phase !== "fix") return;
  state.locked = true;
  const isCorrect = choice === state.currentQuestion.correctAnswer;

  if (isCorrect) {
    button.classList.add("correct-choice");
    resolveCorrect();
  } else {
    button.classList.add("wrong-choice");
    [...elements.answerOptions.children].forEach((candidate) => {
      if (candidate.textContent === state.currentQuestion.correctAnswer) {
        candidate.classList.add("correct-choice");
      }
      candidate.disabled = true;
    });
    resolveWrongAnswer();
  }
}

function resolveCorrect() {
  const elapsedSeconds = (performance.now() - state.questionStartedAt) / 1000;
  state.correctAnswers += 1;
  state.solved += 1;
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);

  const speedBonus = Math.max(0, 60 - Math.floor(elapsedSeconds * 7));
  const difficultyBonus = DIFFICULTY_BONUS[state.currentQuestion.difficulty] || 0;
  const multiplier = getComboMultiplier(state.combo);
  const feverMultiplier = state.timeLeft <= 15 ? 1.2 : 1;
  const gained = Math.round((100 + speedBonus + difficultyBonus) * multiplier * feverMultiplier);
  state.score += gained;

  let damage = 1;
  let critical = false;
  if (state.combo % 10 === 0) {
    damage = 3;
    critical = true;
  } else if (state.combo % 5 === 0) {
    damage = 2;
    critical = true;
  }

  elements.feedback.className = "feedback success";
  elements.feedback.innerHTML = `${critical ? "CRITICAL!" : "PERFECT!"} +${gained}<br><strong>${state.currentQuestion.correctSentence}</strong>`;
  playCorrectSound(critical);
  vibrate(critical ? [40, 35, 70] : [35]);
  fireProjectile(critical);
  damageEnemy(damage);
  renderHud();

  schedule(() => nextQuestion(), critical ? 820 : 690);
}

function resolveWrongAnswer() {
  registerMistake();
  state.combo = 0;
  playWrongSound();
  vibrate([90]);
  animateMiss();
  elements.feedback.className = "feedback error";
  elements.feedback.innerHTML = `정답: <strong>${state.currentQuestion.correctAnswer}</strong><br>${state.currentQuestion.explanation}`;
  loseHeart();
  renderHud();

  if (!state.ended) schedule(() => nextQuestion(), 1150);
}

function getComboMultiplier(combo) {
  if (combo >= 15) return 2;
  if (combo >= 10) return 1.5;
  if (combo >= 5) return 1.25;
  return 1;
}

function registerMistake() {
  state.wrongAttempts += 1;
  const category = state.currentQuestion?.category;
  if (!category) return;
  state.categoryMistakes[category] = (state.categoryMistakes[category] || 0) + 1;
}

function loseHeart() {
  state.hearts = Math.max(0, state.hearts - 1);
  if (state.hearts <= 0) endGame("hearts");
}

function fireProjectile(critical) {
  const projectile = document.createElement("div");
  projectile.className = `projectile${critical ? " critical" : ""}`;
  elements.projectileLayer.appendChild(projectile);
  schedule(() => projectile.remove(), 430);
}

function damageEnemy(amount) {
  state.enemyHp -= amount;
  animateClass(elements.enemyWrap, "hit");

  if (state.enemyHp <= 0) {
    state.defeated += 1;
    state.score += 250;
    playDefeatSound();
    elements.enemyHealthFill.style.width = "0%";
    schedule(() => selectNewBug(false), 420);
  } else {
    updateEnemyHealth();
  }
}

function selectNewBug(initial) {
  const [name, emoji] = BUG_NAMES[Math.floor(Math.random() * BUG_NAMES.length)];
  state.enemyMaxHp = Math.min(3 + Math.floor(state.defeated / 3), 6);
  state.enemyHp = state.enemyMaxHp;
  elements.enemyName.textContent = name;
  elements.enemyEmoji.textContent = emoji;
  updateEnemyHealth();
  if (!initial) animateClass(elements.enemyWrap, "pop");
}

function updateEnemyHealth() {
  const percent = Math.max(0, (state.enemyHp / state.enemyMaxHp) * 100);
  elements.enemyHealthFill.style.width = `${percent}%`;
}

function animateMiss() {
  animateClass(elements.questionCard, "shake");
  animateClass(elements.enemyWrap, "lunge");
}

function animateClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  schedule(() => element.classList.remove(className), 460);
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function renderHud() {
  elements.scoreValue.textContent = formatScore(state.score);
  elements.comboBadge.textContent = `COMBO ×${state.combo}`;
  elements.comboBadge.classList.toggle("hot", state.combo >= 5);
  elements.hearts.innerHTML = Array.from({ length: STARTING_HEARTS }, (_, index) =>
    index < state.hearts ? "<span>♥</span>" : '<span class="lost">♥</span>'
  ).join(" ");
  elements.solvedCount.textContent = String(state.solved);
  elements.defeatedCount.textContent = String(state.defeated);
  elements.bestComboLive.textContent = String(state.bestCombo);
}

function calculateAccuracy() {
  const attempts = state.correctAnswers + state.wrongAttempts;
  return attempts > 0 ? Math.round((state.correctAnswers / attempts) * 100) : 0;
}

function calculateGrade(score, accuracy, solved) {
  if (score >= 3000 && accuracy >= 90 && solved >= 12) return "S";
  if (score >= 2000 && accuracy >= 80) return "A";
  if (score >= 1200 && accuracy >= 70) return "B";
  if (score >= 600) return "C";
  return "D";
}

function getWeaknessText() {
  const ranked = Object.entries(state.categoryMistakes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category]) => CATEGORY_LABELS[category] || category);
  return ranked.length ? ranked.join(" · ") : "없음 — 완벽한 플레이!";
}

function endGame(reason) {
  if (state.ended) return;
  state.ended = true;
  state.active = false;
  state.locked = true;
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
  clearPendingTimeouts();
  document.body.classList.remove("fever-mode");

  const accuracy = calculateAccuracy();
  const grade = calculateGrade(state.score, accuracy, state.solved);
  const previousHighScore = getHighScore();
  const isNewRecord = state.score > previousHighScore;
  if (isNewRecord) setHighScore(state.score);

  elements.resultReason.textContent = reason === "hearts" ? "GAME OVER" : "TIME UP";
  elements.resultGrade.textContent = grade;
  elements.resultScore.textContent = formatScore(state.score);
  elements.resultAccuracy.textContent = `${accuracy}%`;
  elements.resultCombo.textContent = `×${state.bestCombo}`;
  elements.resultSolved.textContent = String(state.solved);
  elements.resultDefeated.textContent = String(state.defeated);
  elements.resultWeakness.textContent = getWeaknessText();
  elements.newRecordLabel.classList.toggle("hidden", !isNewRecord);
  elements.startHighScore.textContent = formatScore(Math.max(previousHighScore, state.score));

  showScreen("result");
  if (grade === "S" || grade === "A") playDefeatSound();
}

function goHome() {
  clearPendingTimeouts();
  if (state.timerId) window.clearInterval(state.timerId);
  state.active = false;
  state.ended = true;
  document.body.classList.remove("fever-mode");
  elements.startHighScore.textContent = formatScore(getHighScore());
  showScreen("start");
}

elements.startButton.addEventListener("click", startGame);
elements.retryButton.addEventListener("click", startGame);
elements.homeButton.addEventListener("click", goHome);
elements.soundToggles.forEach((button) => button.addEventListener("click", toggleSound));

elements.startHighScore.textContent = formatScore(getHighScore());
