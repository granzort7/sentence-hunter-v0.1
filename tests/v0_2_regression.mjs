import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// This dependency-free suite protects source/data/rule contracts. Real timer,
// focus, animation, and responsive behavior are verified separately in a browser.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(resolve(projectRoot, name), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const EXPECTED_QUESTIONS_SHA = "44cec71ad8ede22d290f616e8d365a211baf7d6d529e4c0fcaec98fd37177550";
const EXPECTED_STABLE_DATA_SHA = "abc8ed20532cfdacb4e36dbae5d19c51cfe58735bc0256be59f0701a8177679c";
const EXPECTED_ANSWER_KEY_SHA = "7a7c8659e6df2e5e2e16747221e7fe080f00779614f6e827511a36704ffe4755";

const questionsSource = read("questions.js");
const appSource = read("app.js");
const indexSource = read("index.html");
const stylesSource = read("styles.css");

new vm.Script(questionsSource, { filename: "questions.js" });
new vm.Script(appSource, { filename: "app.js" });

const questionContext = { window: {} };
vm.runInNewContext(questionsSource, questionContext, { filename: "questions.js" });
const questions = questionContext.window.SENTENCE_HUNTER_QUESTIONS;

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateQuestionData() {
  assert.equal(sha256(questionsSource), EXPECTED_QUESTIONS_SHA, "questions.js raw SHA-256 changed");
  assert.equal(questions.length, 30, "question count must stay 30");
  assert.deepEqual(
    Array.from(questions, (question) => question.id),
    Array.from({ length: 30 }, (_, index) => `g${String(index + 1).padStart(3, "0")}`),
    "question ids/order changed"
  );
  assert.equal(new Set(questions.map((question) => question.id)).size, 30, "question ids must be unique");

  const distribution = Object.fromEntries(["starter", "everyday", "challenger"].map((difficulty) => [
    difficulty,
    questions.filter((question) => question.difficulty === difficulty).length
  ]));
  assert.deepEqual(distribution, { starter: 12, everyday: 12, challenger: 6 }, "difficulty distribution changed");

  const expectedKeys = [
    "category",
    "choices",
    "correctAnswer",
    "correctSentence",
    "difficulty",
    "errorIndex",
    "explanation",
    "id",
    "segments"
  ];

  questions.forEach((question) => {
    assert.deepEqual(Object.keys(question).sort(), expectedKeys, `${question.id}: object keys changed`);
    assert.equal(question.choices.length, 3, `${question.id}: choices must stay at three`);
    assert.equal(new Set(question.choices).size, 3, `${question.id}: choices must be unique`);
    assert.equal(question.choices.filter((choice) => choice === question.correctAnswer).length, 1, `${question.id}: answer must occur once`);
    assert.ok(Number.isInteger(question.errorIndex), `${question.id}: errorIndex must be an integer`);
    assert.ok(question.errorIndex >= 0 && question.errorIndex < question.segments.length, `${question.id}: errorIndex is out of range`);
    assert.notEqual(question.segments[question.errorIndex], question.correctAnswer, `${question.id}: error token already equals answer`);
    assert.ok(question.segments.every((segment) => typeof segment === "string" && segment.trim()), `${question.id}: empty segment`);
    assert.ok(question.choices.every((choice) => typeof choice === "string" && choice.trim()), `${question.id}: empty choice`);
    ["id", "difficulty", "category", "correctAnswer", "correctSentence", "explanation"].forEach((field) => {
      assert.ok(typeof question[field] === "string" && question[field].trim(), `${question.id}: empty ${field}`);
    });
    const reconstructed = question.segments
      .map((segment, index) => index === question.errorIndex ? question.correctAnswer : segment)
      .join(" ");
    assert.equal(reconstructed, question.correctSentence, `${question.id}: corrected sentence mismatch`);
  });

  assert.equal(sha256(stableStringify(questions)), EXPECTED_STABLE_DATA_SHA, "semantic question data changed");
  const answerKey = questions.map(({ id, errorIndex, correctAnswer, correctSentence }) => ({
    id,
    errorIndex,
    correctAnswer,
    correctSentence
  }));
  assert.equal(sha256(stableStringify(answerKey)), EXPECTED_ANSWER_KEY_SHA, "answer key changed");
}

class MockClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class MockElement {
  constructor(id = "") {
    this.id = id;
    this.classList = new MockClassList();
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.attributes = new Map();
    this.textContent = "";
    this.innerHTML = "";
    this.className = "";
    this.hidden = false;
    this.disabled = false;
    this.offsetWidth = 100;
  }

  addEventListener() {}
  remove() {}

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  querySelector() {
    return this.children[0] || null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  focus() {}
  scrollIntoView() {}
}

function createRuntime() {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, new MockElement(id));
    return elements.get(id);
  };
  const body = new MockElement("body");
  const document = {
    activeElement: null,
    addEventListener() {},
    body,
    contains: () => true,
    createElement: () => new MockElement(),
    getElementById: getElement,
    querySelectorAll: () => []
  };
  const storage = {
    value: "0",
    writes: 0,
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = String(value);
      this.writes += 1;
    }
  };
  let nextTimerId = 1;
  const clock = { now: 0 };
  const timers = {
    intervals: new Set(),
    timeouts: new Set()
  };
  const fakeWindow = {
    SENTENCE_HUNTER_QUESTIONS: questions,
    localStorage: storage,
    requestAnimationFrame(callback) {
      callback();
      return nextTimerId++;
    },
    scrollTo() {},
    setInterval() {
      const id = nextTimerId++;
      timers.intervals.add(id);
      return id;
    },
    clearInterval(id) {
      timers.intervals.delete(id);
    },
    setTimeout() {
      const id = nextTimerId++;
      timers.timeouts.add(id);
      return id;
    },
    clearTimeout(id) {
      timers.timeouts.delete(id);
    }
  };
  const context = vm.createContext({
    console: { error() {}, info() {}, warn() {} },
    document,
    navigator: {},
    performance: { now: () => clock.now },
    window: fakeWindow
  });
  vm.runInContext(appSource, context, { filename: "app.js" });
  return { clock, context, elements, storage, timers };
}

function evaluate(context, source) {
  return vm.runInContext(source, context);
}

function validateRules() {
  assert.match(appSource, /const GAME_DURATION_SECONDS = 90;/, "90-second rule changed");
  assert.match(appSource, /const STARTING_HEARTS = 3;/, "three-heart rule changed");
  assert.match(appSource, /const STORAGE_KEY = "sentenceHunterHighScoreV01";/, "high-score key changed");
  assert.match(appSource, /starter: 0,[\s\S]*everyday: 25,[\s\S]*challenger: 50/, "difficulty bonuses changed");
  assert.match(appSource, /state\.combo % 10 === 0[\s\S]*damage = 3;[\s\S]*state\.combo % 5 === 0[\s\S]*damage = 2;/, "special attack damage changed");
  assert.match(appSource, /state\.score \+= 250;/, "Bug defeat bonus changed");
  assert.match(appSource, /state\.timeLeft <= 15 \? 1\.2 : 1;/, "Fever multiplier changed");
  assert.match(appSource, /critical \? 820 : 690/, "correct-answer pacing changed");
  assert.match(appSource, /nextQuestion\(\), 1150/, "wrong-fix pacing changed");
  assert.match(appSource, /\}, 520\);/, "wrong-find pacing changed");

  const { clock, context, elements, storage, timers } = createRuntime();
  assert.equal(evaluate(context, "getComboMultiplier(1)"), 1);
  assert.equal(evaluate(context, "getComboMultiplier(4)"), 1);
  assert.equal(evaluate(context, "getComboMultiplier(5)"), 1.25);
  assert.equal(evaluate(context, "getComboMultiplier(9)"), 1.25);
  assert.equal(evaluate(context, "getComboMultiplier(10)"), 1.5);
  assert.equal(evaluate(context, "getComboMultiplier(14)"), 1.5);
  assert.equal(evaluate(context, "getComboMultiplier(15)"), 2);

  const attackCases = [
    { comboBefore: 0, expectedCombo: 1, expectedScore: 160, expectedHp: 5 },
    { comboBefore: 4, expectedCombo: 5, expectedScore: 200, expectedHp: 4 },
    { comboBefore: 9, expectedCombo: 10, expectedScore: 240, expectedHp: 3 },
    { comboBefore: 14, expectedCombo: 15, expectedScore: 320, expectedHp: 4 },
    { comboBefore: 19, expectedCombo: 20, expectedScore: 320, expectedHp: 3 }
  ];

  attackCases.forEach(({ comboBefore, expectedCombo, expectedScore, expectedHp }) => {
    const result = evaluate(context, `
      state = createInitialState();
      state.active = true;
      state.currentQuestion = QUESTIONS[0];
      state.questionStartedAt = 0;
      state.timeLeft = 90;
      state.combo = ${comboBefore};
      state.enemyHp = 6;
      state.enemyMaxHp = 6;
      resolveCorrect();
      ({ combo: state.combo, score: state.score, hp: state.enemyHp });
    `);
    assert.equal(result.combo, expectedCombo, `combo transition from ${comboBefore} changed`);
    assert.equal(result.score, expectedScore, `score at combo ${expectedCombo} changed`);
    assert.equal(result.hp, expectedHp, `damage at combo ${expectedCombo} changed`);
  });

  const bugHpCases = [
    { defeated: 0, expectedHp: 3 },
    { defeated: 2, expectedHp: 3 },
    { defeated: 3, expectedHp: 4 },
    { defeated: 6, expectedHp: 5 },
    { defeated: 9, expectedHp: 6 },
    { defeated: 99, expectedHp: 6 }
  ];
  bugHpCases.forEach(({ defeated, expectedHp }) => {
    const result = evaluate(context, `
      state = createInitialState();
      state.defeated = ${defeated};
      selectNewBug(true);
      ({ hp: state.enemyHp, maxHp: state.enemyMaxHp });
    `);
    assert.equal(result.hp, expectedHp, `Bug HP at ${defeated} defeats changed`);
    assert.equal(result.maxHp, expectedHp, `Bug max HP at ${defeated} defeats changed`);
  });

  const difficultyCases = [
    { solved: 0, roll: 0.99, expected: "starter" },
    { solved: 3, roll: 0.419, expected: "starter" },
    { solved: 3, roll: 0.42, expected: "everyday" },
    { solved: 8, roll: 0.199, expected: "starter" },
    { solved: 8, roll: 0.2, expected: "everyday" },
    { solved: 8, roll: 0.719, expected: "everyday" },
    { solved: 8, roll: 0.72, expected: "challenger" }
  ];
  difficultyCases.forEach(({ solved, roll, expected }) => {
    const actual = evaluate(context, `
      state.solved = ${solved};
      originalRandomForTest = Math.random;
      Math.random = () => ${roll};
      difficultyForTest = chooseDifficulty();
      Math.random = originalRandomForTest;
      difficultyForTest;
    `);
    assert.equal(actual, expected, `difficulty boundary at solved=${solved}, roll=${roll} changed`);
  });

  const feverResult = evaluate(context, `
    state = createInitialState();
    state.active = true;
    state.currentQuestion = QUESTIONS[0];
    state.questionStartedAt = 0;
    state.timeLeft = 15;
    state.combo = 14;
    state.enemyHp = 6;
    state.enemyMaxHp = 6;
    resolveCorrect();
    ({ score: state.score, hp: state.enemyHp });
  `);
  assert.equal(feverResult.score, 384, "Fever scoring changed");
  assert.equal(feverResult.hp, 4, "Fever must not change attack damage");

  const heartResult = evaluate(context, `
    state = createInitialState();
    state.active = true;
    state.hearts = 1;
    loseHeart();
    ({ hearts: state.hearts, active: state.active, ended: state.ended });
  `);
  assert.equal(heartResult.hearts, 0, "hearts must clamp at zero");
  assert.equal(heartResult.active, false, "heart-zero must stop the game");
  assert.equal(heartResult.ended, true, "heart-zero must end the game");

  storage.value = "1000";
  storage.writes = 0;
  evaluate(context, "state = createInitialState(); state.active = true; state.score = 1000; endGame('time');");
  assert.equal(storage.writes, 0, "equal score must not overwrite high score");
  storage.value = "1000";
  storage.writes = 0;
  evaluate(context, "state = createInitialState(); state.active = true; state.score = 999; endGame('time');");
  assert.equal(storage.writes, 0, "lower score must not overwrite high score");
  storage.value = "1000";
  storage.writes = 0;
  evaluate(context, "state = createInitialState(); state.active = true; state.score = 1001; endGame('time');");
  assert.equal(storage.writes, 1, "new high score must be stored exactly once");
  assert.equal(storage.value, "1001", "new high score value mismatch");

  clock.now = 0;
  evaluate(context, `
    state = createInitialState();
    state.active = true;
    state.gameStartedAt = 0;
    feverEntryCount = 0;
    originalAnimateClassForTest = animateClass;
    animateClass = function (element, className) {
      if (className === "fever-enter") feverEntryCount += 1;
      return originalAnimateClassForTest(element, className);
    };
  `);
  clock.now = 74999;
  const beforeFever = evaluate(context, "updateTimer(); ({ timeLeft: state.timeLeft, triggered: state.feverTriggered, entries: feverEntryCount });");
  assert.equal(beforeFever.timeLeft, 16, "timer must still show 16 immediately before Fever");
  assert.equal(beforeFever.triggered, false, "Fever must not start before the final 15 seconds");
  assert.equal(beforeFever.entries, 0, "Fever entry effect must not run early");
  clock.now = 75000;
  evaluate(context, "updateTimer();");
  clock.now = 76000;
  const feverState = evaluate(context, "updateTimer(); ({ timeLeft: state.timeLeft, triggered: state.feverTriggered, entries: feverEntryCount });");
  assert.equal(feverState.timeLeft, 14, "Fever timer boundary changed");
  assert.equal(feverState.triggered, true, "Fever must be marked as entered");
  assert.equal(feverState.entries, 1, "Fever entry effect must run once");
  clock.now = 90000;
  evaluate(context, "updateTimer();");
  assert.equal(evaluate(context, "state.ended"), true, "90 seconds must end the game");
  assert.equal(elements.get("result-reason").textContent, "TIME UP", "time end reason changed");
  evaluate(context, "animateClass = originalAnimateClassForTest;");

  timers.intervals.clear();
  timers.timeouts.clear();
  for (let retry = 1; retry <= 3; retry += 1) {
    clock.now = 0;
    evaluate(context, "startGame();");
    assert.equal(evaluate(context, "state.active"), false, `retry ${retry}: timer started during countdown`);
    assert.equal(evaluate(context, "state.timeLeft"), 90, `retry ${retry}: initial time changed`);
    assert.equal(evaluate(context, "state.hearts"), 3, `retry ${retry}: hearts did not reset`);
    evaluate(context, "beginRound();");
    assert.equal(timers.intervals.size, 1, `retry ${retry}: interval count must be one`);
    evaluate(context, "endGame('hearts');");
    assert.equal(timers.intervals.size, 0, `retry ${retry}: interval was not cleared`);
    assert.equal(timers.timeouts.size, 0, `retry ${retry}: pending timeouts were not cleared`);
  }
}

function validatePresentationContract() {
  assert.ok(indexSource.indexOf('<script src="questions.js"></script>') < indexSource.indexOf('<script src="app.js"></script>'), "script load order changed");
  [
    "countdown-overlay",
    "countdown-value",
    "phase-step",
    "player-wrap",
    "impact-label",
    "retry-button",
    "home-button"
  ].forEach((id) => assert.match(indexSource, new RegExp(`id="${id}"`), `missing #${id}`));
  assert.doesNotMatch(indexSource, /<main class="app-shell" aria-live=/, "timer must not sit inside a global live region");
  assert.match(indexSource, /id="countdown-overlay"[^>]*aria-live="polite"/, "countdown announcements must not interrupt one another");
  assert.match(appSource, /const COUNTDOWN_STEPS = \["3", "2", "1", "HUNT"\];/, "countdown sequence changed");
  assert.match(appSource, /state\.gameStartedAt = performance\.now\(\);[\s\S]*nextQuestion\(\);[\s\S]*setInterval\(updateTimer, 100\)/, "timer must start after countdown");
  assert.match(stylesSource, /min-width: 44px;[\s\S]*min-height: 44px;/, "44px token target missing");
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: 0\.01ms !important;/, "reduced-motion transitions are not disabled");
  assert.match(stylesSource, /overflow-x: hidden;/, "horizontal overflow guard missing");
  assert.match(stylesSource, /--shot-distance: clamp\(250px, 48vw, 405px\);/, "landscape projectile distance must remain responsive");
}

validateQuestionData();
validateRules();
validatePresentationContract();

console.log("PASS: JavaScript syntax");
console.log("PASS: 30 questions, ids, schema, 12/12/6 distribution");
console.log(`PASS: questions.js SHA-256 ${EXPECTED_QUESTIONS_SHA.toUpperCase()}`);
console.log("PASS: score/combo/special attack/Bug HP/difficulty/Fever/heart/high-score invariants");
console.log("PASS: countdown ordering and DOM/accessibility/reduced-motion source contracts");
