import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(resolve(projectRoot, name), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const EXPECTED_QUESTIONS_SHA = "44cec71ad8ede22d290f616e8d365a211baf7d6d529e4c0fcaec98fd37177550";

const betaSource = read("beta.js");
const appSource = read("app.js");
const indexSource = read("index.html");
const stylesSource = read("styles.css");
const questionsSource = read("questions.js");

new vm.Script(betaSource, { filename: "beta.js" });
new vm.Script(appSource, { filename: "app.js" });
new vm.Script(questionsSource, { filename: "questions.js" });

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

  contains(name) {
    return this.values.has(name);
  }
}

function createMockDocument() {
  let document;

  class MockElement {
    constructor(tagName = "div", id = "") {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.className = "";
      this.classList = new MockClassList();
      this.children = [];
      this.parentElement = null;
      this.attributes = new Map();
      this.listeners = new Map();
      this.textContent = "";
      this.value = "";
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
      this.readOnly = false;
      this.required = false;
      this.type = "";
      this.name = "";
      this.maxLength = -1;
      this.rows = 0;
      this.tabIndex = 0;
      this.selectedByTest = false;
    }

    appendChild(child) {
      if (this.tagName === "SELECT" && child.tagName === "OPTION" && this.children.length === 0) {
        this.value = child.value;
      }
      child.parentElement = this;
      this.children.push(child);
      return child;
    }

    prepend(child) {
      child.parentElement = this;
      this.children.unshift(child);
      return child;
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    dispatch(type, event = { preventDefault() {} }) {
      const results = (this.listeners.get(type) || []).map((listener) => listener(event));
      if (this.parentElement) results.push(...this.parentElement.dispatch(type, event));
      return results;
    }

    click() {
      if (!this.disabled) this.dispatch("click");
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    focus() {
      document.activeElement = this;
    }

    select() {
      this.selectedByTest = true;
    }

    reset() {
      walk(this).forEach((element) => {
        if (element.tagName === "INPUT" && element.type === "radio") element.checked = false;
        if (element.tagName === "TEXTAREA") element.value = "";
        if (element.tagName === "SELECT") element.value = element.children[0]?.value || "";
      });
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
      return walk(this).slice(1).filter((element) => matchesSelector(element, selector));
    }
  }

  function walk(root) {
    return [root, ...root.children.flatMap((child) => walk(child))];
  }

  function matchesSelector(element, selector) {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return element.className.split(/\s+/).includes(className) || element.classList.contains(className);
    }

    const inputMatch = selector.match(/^input\[name="([^"]+)"\](:checked)?$/);
    if (inputMatch) {
      return element.tagName === "INPUT"
        && element.name === inputMatch[1]
        && (!inputMatch[2] || element.checked);
    }

    return element.tagName.toLowerCase() === selector.toLowerCase();
  }

  const startScreen = new MockElement("section", "start-screen");
  const startPanel = new MockElement("div");
  startPanel.className = "start-panel";
  startScreen.appendChild(startPanel);
  const resultScreen = new MockElement("section", "result-screen");
  let createdCount = 0;

  document = {
    activeElement: null,
    createElement(tagName) {
      createdCount += 1;
      return new MockElement(tagName);
    },
    getElementById(id) {
      if (id === "start-screen") return startScreen;
      if (id === "result-screen") return resultScreen;
      return null;
    }
  };

  return {
    document,
    roots: { startScreen, startPanel, resultScreen },
    getCreatedCount: () => createdCount
  };
}

function createBetaRuntime(search = "", navigatorOverrides = {}) {
  const mock = createMockDocument();
  const pageUrl = new URL(`https://preview.test/game/${search}`);
  const navigator = { ...navigatorOverrides };
  const fakeWindow = {
    innerWidth: 390,
    innerHeight: 844,
    location: {
      href: pageUrl.toString(),
      search: pageUrl.search
    },
    navigator
  };
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console: { error() {}, info() {}, warn() {} },
    document: mock.document,
    navigator,
    window: fakeWindow
  });
  vm.runInContext(betaSource, context, { filename: "beta.js" });
  return {
    ...mock,
    api: fakeWindow.SENTENCE_HUNTER_BETA,
    navigator,
    window: fakeWindow
  };
}

function findByClass(root, className) {
  return root.querySelector(`.${className}`);
}

function choose(form, name, value) {
  const input = form.querySelectorAll(`input[name="${name}"]`).find((candidate) => candidate.value === value);
  assert.ok(input, `missing ${name}=${value}`);
  input.checked = true;
}

function prepareCompletedBeta(navigatorOverrides = {}, search = "?beta=1&tester=T01") {
  const runtime = createBetaRuntime(search, navigatorOverrides);
  runtime.api.mount({ getSoundEnabled: () => false });
  runtime.api.onResult({
    score: 1480,
    accuracy: 83,
    bestCombo: 7,
    solved: 9,
    defeated: 2,
    endReason: "HEARTS"
  });

  const shell = findByClass(runtime.roots.resultScreen, "beta-feedback-shell");
  const form = findByClass(shell, "beta-feedback-form");
  choose(form, "howClear", "4");
  choose(form, "howFun", "5");
  choose(form, "findFixClarity", "3");
  choose(form, "playAgain", "YES");
  findByClass(shell, "beta-feedback-toggle").click();
  return { ...runtime, shell, form };
}

async function flushAsyncActions() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

function validateStaticContracts() {
  assert.equal(sha256(questionsSource), EXPECTED_QUESTIONS_SHA, "questions.js SHA-256 changed");
  assert.ok(indexSource.indexOf('<script src="questions.js"></script>') < indexSource.indexOf('<script src="beta.js"></script>'), "questions.js must load before beta.js");
  assert.ok(indexSource.indexOf('<script src="beta.js"></script>') < indexSource.indexOf('<script src="app.js"></script>'), "beta.js must load before app.js");
  assert.match(indexSource, /<title>Sentence Hunter v0\.2\.0<\/title>/, "normal-mode release title changed");
  assert.doesNotMatch(indexSource, /BETA TEST|20초 피드백|테스트 링크 공유/, "beta UI must not be static normal-mode DOM");
  assert.doesNotMatch(betaSource, /innerHTML/, "beta input must never use innerHTML");
  assert.doesNotMatch(betaSource, /localStorage|sessionStorage/, "beta state must not use browser storage");
  assert.doesNotMatch(betaSource, /navigator\.(?:userAgent|geolocation)|sendBeacon|XMLHttpRequest|WebSocket|EventSource|(?:window\.)?fetch\s*\(|\[["']fetch["']\]|new\s+Image\s*\(|serviceWorker\s*\.\s*register/, "beta kit must not track or transmit data");
  assert.doesNotMatch(`${indexSource}\n${stylesSource}\n${appSource}\n${betaSource}`, /(?:src|href)=["']https?:|url\(\s*["']?https?:/i, "external asset request added");
  assert.doesNotMatch(stylesSource, /@import/i, "external CSS import surface added");
  assert.match(betaSource, /params\.get\("beta"\) === "1"/, "beta activation must require exact beta=1");
  assert.match(betaSource, /replace\(\/\[\^A-Za-z0-9_-\]\/g, ""\)[\s\S]*slice\(0, 12\)/, "tester allowlist or length limit changed");
  assert.match(betaSource, /textarea\.maxLength = maxLength/, "free-input maxlength contract missing");
  assert.match(appSource, /reason === "hearts" \? "HEARTS" : "TIME UP"/, "app end-reason mapping changed");
  assert.match(appSource, /if \(betaTools\.active\) betaTools\.onGameStart\(\);/, "game start is disconnected from beta session reset");
  assert.match(appSource, /betaTools\.onResult\(\{[\s\S]*score: state\.score,[\s\S]*accuracy,[\s\S]*bestCombo: state\.bestCombo,[\s\S]*solved: state\.solved,[\s\S]*defeated: state\.defeated,[\s\S]*endReason:/, "game result snapshot is disconnected from beta kit");
  assert.match(appSource, /betaTools\.onRetry\(\);[\s\S]*startGame\(\);/, "RETRY is disconnected from beta counter");
  assert.match(appSource, /function goHome\(\) \{[\s\S]*betaTools\.onHome\(\);/, "HOME is disconnected from beta session reset");
  assert.match(appSource, /if \(betaTools\.active\) betaTools\.mount\(\{ getSoundEnabled: \(\) => soundEnabled \}\);/, "beta kit mount or sound bridge is missing");
  assert.match(stylesSource, /\.beta-link-button,[\s\S]*min-height: 44px;/, "beta button touch target missing");
  assert.match(stylesSource, /\.beta-choice-label \{[\s\S]*min-height: 44px;/, "beta choice touch target missing");
}

function validateActivationAndTester() {
  ["", "?beta=0", "?beta=true", "?beta=01", "?tester=T01"].forEach((search) => {
    const runtime = createBetaRuntime(search);
    assert.equal(runtime.api.active, false, `${search || "normal URL"} must stay normal mode`);
    assert.equal(runtime.getCreatedCount(), 0, "normal mode must create no beta DOM");
  });

  assert.equal(createBetaRuntime("?beta=1").api.tester, "ANON");
  assert.equal(createBetaRuntime("?beta=1&tester=T01").api.tester, "T01");
  assert.equal(createBetaRuntime("?beta=1&tester=%3C%3E%20T-01!").api.tester, "T-01");
  assert.equal(createBetaRuntime("?beta=1&tester=ABCDEFGHIJKLMN").api.tester, "ABCDEFGHIJKL");
  assert.equal(createBetaRuntime("?beta=1&tester=%3Cscript%3E").api.tester, "script");
}

async function validateFormAndPayload() {
  const copied = [];
  const runtime = createBetaRuntime("?beta=1&tester=T01", {
    clipboard: { async writeText(text) { copied.push(text); } }
  });
  runtime.api.mount({ getSoundEnabled: () => false });
  assert.equal(findByClass(runtime.roots.startScreen, "beta-badge").textContent, "BETA TEST · T01");
  const shell = findByClass(runtime.roots.resultScreen, "beta-feedback-shell");
  assert.equal(shell.hidden, true, "feedback must be inaccessible before a result");

  runtime.api.onResult({ score: 1480, accuracy: 83, bestCombo: 7, solved: 9, defeated: 2, endReason: "HEARTS" });
  assert.equal(shell.hidden, false);
  const toggle = findByClass(shell, "beta-feedback-toggle");
  const panel = findByClass(shell, "beta-feedback-panel");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(panel.hidden, true, "feedback panel must start collapsed");
  toggle.click();
  assert.equal(panel.hidden, false);

  const copyButton = findByClass(shell, "beta-copy-button");
  copyButton.click();
  await flushAsyncActions();
  assert.equal(findByClass(shell, "beta-feedback-status").textContent, "필수 평가 4개를 먼저 선택해 주세요.");
  assert.equal(runtime.document.activeElement.name, "howClear");

  const form = findByClass(shell, "beta-feedback-form");
  choose(form, "howClear", "4");
  choose(form, "howFun", "5");
  choose(form, "findFixClarity", "3");
  choose(form, "playAgain", "YES");
  const confusing = form.querySelector("select");
  confusing.value = "TOUCH";
  const textareas = form.querySelectorAll("textarea");
  textareas[0].value = "x".repeat(120);
  textareas[0].dispatch("input");
  textareas[1].value = "<script>window.pwned=true</script>\n좋았습니다.";
  textareas[1].dispatch("input");
  assert.equal(textareas[0].value.length, 100, "ambiguous sentence must be capped at 100 chars");
  assert.ok(textareas[1].value.length <= 200, "comment must be capped at 200 chars");

  const expectedPayload = [
    "Sentence Hunter Beta Feedback",
    "Version: v0.2.1 candidate",
    "Tester: T01",
    "Score: 1480",
    "Accuracy: 83%",
    "Best Combo: 7",
    "Solved: 9",
    "Defeated Bugs: 2",
    "End Reason: HEARTS",
    "Retries: 0",
    "Viewport: 390x844",
    "Sound: OFF",
    "",
    "How clear: 4/5",
    "How fun: 5/5",
    "FIND/FIX clarity: 3/5",
    "Play again: YES",
    "Confusing part: TOUCH",
    `Ambiguous sentence: ${"x".repeat(100)}`,
    "Comment: <script>window.pwned=true</script> 좋았습니다.",
    "",
    "Game:",
    "https://preview.test/game/?beta=1&tester=T01"
  ].join("\n");
  const payload = runtime.api.buildFeedbackText();
  assert.equal(payload, expectedPayload, "shared payload fields, order or values changed");

  copyButton.click();
  await flushAsyncActions();
  assert.equal(copied[0], payload);
  assert.equal(findByClass(shell, "beta-feedback-status").textContent, "피드백이 복사되었습니다.");

  runtime.api.onResult({ score: 10, accuracy: 50, bestCombo: 1, solved: 1, defeated: 0, endReason: "TIME UP" });
  choose(form, "howClear", "3");
  choose(form, "howFun", "3");
  choose(form, "findFixClarity", "3");
  choose(form, "playAgain", "MAYBE");
  assert.match(runtime.api.buildFeedbackText(), /End Reason: TIME UP/, "time end reason must be preserved");

  runtime.api.onRetry();
  runtime.api.onGameStart();
  assert.equal(runtime.api.getRetryCount(), 1, "onGameStart must preserve retry count");
  assert.equal(shell.hidden, true, "new game must hide prior result tools");
  runtime.api.onHome();
  assert.equal(runtime.api.getRetryCount(), 0, "HOME must begin a new beta session");
}

async function validateSharingFallbacks() {
  const shareCalls = [];
  let clipboardCalls = 0;
  let runtime = prepareCompletedBeta({
    async share(payload) { shareCalls.push(payload); },
    clipboard: { async writeText() { clipboardCalls += 1; } }
  });
  const shareButton = findByClass(runtime.shell, "beta-share-button");
  shareButton.click();
  shareButton.click();
  await flushAsyncActions();
  assert.equal(shareCalls.length, 1, "Web Share must be preferred without duplicate pending calls");
  assert.deepEqual(Object.keys(shareCalls[0]).sort(), ["text", "title"]);
  assert.equal(shareCalls[0].title, "Sentence Hunter Beta Feedback");
  assert.equal(shareCalls[0].text, runtime.api.buildFeedbackText());
  assert.equal(clipboardCalls, 0, "successful Web Share must not copy");
  assert.equal(findByClass(runtime.shell, "beta-feedback-status").textContent, "공유 창을 열었습니다.");
  assert.equal(shareButton.disabled, false, "share button must re-enable after completion");

  clipboardCalls = 0;
  runtime = prepareCompletedBeta({
    async share() {
      const error = new Error("cancelled");
      error.name = "AbortError";
      throw error;
    },
    clipboard: { async writeText() { clipboardCalls += 1; } }
  });
  findByClass(runtime.shell, "beta-share-button").click();
  await flushAsyncActions();
  assert.equal(clipboardCalls, 0, "share cancellation must not copy or surface an error");
  assert.equal(findByClass(runtime.shell, "beta-feedback-status").textContent, "");

  const copied = [];
  runtime = prepareCompletedBeta({ clipboard: { async writeText(text) { copied.push(text); } } });
  findByClass(runtime.shell, "beta-share-button").click();
  await flushAsyncActions();
  assert.equal(copied.length, 1, "missing Web Share must fall back to clipboard");
  assert.equal(findByClass(runtime.shell, "beta-feedback-status").textContent, "피드백이 복사되었습니다.");

  clipboardCalls = 0;
  runtime = prepareCompletedBeta({
    async share() { throw new Error("share failed"); },
    clipboard: { async writeText() { clipboardCalls += 1; } }
  });
  findByClass(runtime.shell, "beta-share-button").click();
  await flushAsyncActions();
  assert.equal(clipboardCalls, 1, "non-cancel share failure must fall back to clipboard");

  runtime = prepareCompletedBeta({});
  const manual = findByClass(runtime.shell, "beta-feedback-manual");
  findByClass(runtime.shell, "beta-copy-button").click();
  await flushAsyncActions();
  assert.equal(manual.hidden, false, "missing clipboard must reveal manual fallback");
  assert.equal(manual.readOnly, true);
  assert.ok(manual.value.startsWith("Sentence Hunter Beta Feedback"));
  assert.equal(manual.selectedByTest, true, "manual fallback text must be selected");

  const feedbackStatus = findByClass(runtime.shell, "beta-feedback-status");
  const comment = runtime.form.querySelectorAll("textarea")[1];
  comment.value = "changed after fallback";
  comment.dispatch("input");
  assert.equal(manual.hidden, true, "changing feedback must hide a stale manual payload");
  assert.equal(manual.value, "", "changing feedback must clear a stale manual payload");
  assert.equal(feedbackStatus.textContent, "", "changing feedback must clear stale share status");

  findByClass(runtime.shell, "beta-copy-button").click();
  await flushAsyncActions();
  assert.equal(manual.hidden, false);
  runtime.navigator.share = async () => {
    const error = new Error("cancelled");
    error.name = "AbortError";
    throw error;
  };
  findByClass(runtime.shell, "beta-share-button").click();
  await flushAsyncActions();
  assert.equal(manual.hidden, true, "a new cancelled share must not leave an older manual payload visible");
  assert.equal(manual.value, "");
  assert.equal(feedbackStatus.textContent, "");

  runtime = prepareCompletedBeta({
    clipboard: { async writeText() { throw new Error("clipboard denied"); } }
  });
  const rejectedManual = findByClass(runtime.shell, "beta-feedback-manual");
  findByClass(runtime.shell, "beta-copy-button").click();
  await flushAsyncActions();
  assert.equal(rejectedManual.hidden, false, "rejected clipboard write must reveal manual fallback");

  const linkCopies = [];
  runtime = createBetaRuntime("?beta=1&tester=T01", {
    clipboard: { async writeText(text) { linkCopies.push(text); } }
  });
  runtime.api.mount();
  findByClass(runtime.roots.startScreen, "beta-link-button").click();
  await flushAsyncActions();
  assert.deepEqual(linkCopies, ["https://preview.test/game/?beta=1"], "tester must be removed from shared test link");
  assert.equal(findByClass(runtime.roots.startPanel, "beta-status").textContent, "테스트 링크가 복사되었습니다.");

  runtime = createBetaRuntime("?foo=x&beta=1&tester=T01#fragment", {});
  runtime.api.mount();
  const startManual = findByClass(runtime.roots.startPanel, "beta-link-manual");
  findByClass(runtime.roots.startScreen, "beta-link-button").click();
  await flushAsyncActions();
  assert.equal(startManual.hidden, false, "start-link clipboard failure must reveal manual fallback");
  assert.equal(startManual.value, "https://preview.test/game/?beta=1", "start link must remove tester, extra query and hash");
  runtime.api.onGameStart();
  assert.equal(startManual.hidden, true, "PLAY must clear prior start-link manual fallback");
  assert.equal(startManual.value, "");

  runtime.api.onResult({ score: 1, accuracy: 0, bestCombo: 0, solved: 0, defeated: 0, endReason: "HEARTS" });
  runtime.api.onHome();
  assert.equal(startManual.hidden, true, "HOME must keep start-link fallback reset");
}

validateStaticContracts();
validateActivationAndTester();
await validateFormAndPayload();
await validateSharingFallbacks();

console.log("PASS: v0.2.0 game/data/static presentation contracts preserved");
console.log("PASS: exact beta activation, ANON/tester sanitization and 12-char cap");
console.log("PASS: result snapshot, required feedback, maxlength, retry/HOME session semantics");
console.log("PASS: Web Share, cancel, clipboard and manual-copy fallback paths");
console.log(`PASS: questions.js SHA-256 ${EXPECTED_QUESTIONS_SHA.toUpperCase()}`);
