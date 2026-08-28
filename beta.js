"use strict";

(function setupSentenceHunterBeta() {
  const BETA_VERSION = "v0.2.1 candidate";
  const params = new URLSearchParams(window.location.search);
  const active = params.get("beta") === "1";

  function sanitizeTester(value) {
    return String(value || "")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 12);
  }

  const tester = sanitizeTester(params.get("tester")) || "ANON";
  const inactiveApi = Object.freeze({
    active: false,
    tester: "ANON",
    mount() {},
    onGameStart() {},
    onResult() {},
    onRetry() {},
    onHome() {},
    getRetryCount() { return 0; },
    buildFeedbackText() { return ""; }
  });

  if (!active) {
    window.SENTENCE_HUNTER_BETA = inactiveApi;
    return;
  }

  const state = {
    tester,
    retryCount: 0,
    result: null,
    mounted: false,
    getSoundEnabled: () => true,
    elements: {}
  };

  const CONFUSING_PARTS = [
    ["NONE", "없음"],
    ["FIND", "틀린 부분 찾기"],
    ["FIX", "올바른 표현 고르기"],
    ["TOUCH", "터치 조작"],
    ["ATTACK_COMBO", "공격·콤보"],
    ["RESULT", "결과 화면"]
  ];

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createChoiceField(legendText, name, choices) {
    const fieldset = createElement("fieldset", "beta-fieldset");
    const legend = createElement("legend", "beta-question", legendText);
    const group = createElement("div", "beta-choice-group");
    fieldset.appendChild(legend);

    choices.forEach(([value, labelText]) => {
      const label = createElement("label", "beta-choice");
      const input = createElement("input");
      const visual = createElement("span", "beta-choice-label", labelText);
      input.type = "radio";
      input.name = name;
      input.value = value;
      input.required = true;
      label.appendChild(input);
      label.appendChild(visual);
      group.appendChild(label);
    });

    fieldset.appendChild(group);
    return fieldset;
  }

  function createTextareaField(labelText, id, maxLength) {
    const wrapper = createElement("label", "beta-text-field");
    const label = createElement("span", "beta-question", labelText);
    const textarea = createElement("textarea");
    textarea.id = id;
    textarea.name = id;
    textarea.maxLength = maxLength;
    textarea.rows = id === "beta-comment" ? 3 : 2;
    textarea.addEventListener("input", () => {
      if (textarea.value.length > maxLength) textarea.value = textarea.value.slice(0, maxLength);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(textarea);
    return { wrapper, textarea };
  }

  function createManualCopyArea(className) {
    const textarea = createElement("textarea", className);
    textarea.readOnly = true;
    textarea.hidden = true;
    textarea.setAttribute("aria-label", "직접 복사할 텍스트");
    textarea.rows = 5;
    return textarea;
  }

  function setStatus(element, message) {
    if (!element) return;
    element.textContent = message;
  }

  function normalizeFreeText(value, maxLength) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  function buildBetaUrl(includeTester) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("beta", "1");
    if (includeTester && state.tester !== "ANON") {
      url.searchParams.set("tester", state.tester);
    }
    return url.toString();
  }

  function readFeedback() {
    const form = state.elements.form;
    if (!form) return { valid: false, firstMissing: null, values: null };

    const requiredNames = ["howClear", "howFun", "findFixClarity", "playAgain"];
    for (const name of requiredNames) {
      const selected = form.querySelector(`input[name="${name}"]:checked`);
      if (!selected) {
        return {
          valid: false,
          firstMissing: form.querySelector(`input[name="${name}"]`),
          values: null
        };
      }
    }

    return {
      valid: true,
      firstMissing: null,
      values: {
        howClear: form.querySelector('input[name="howClear"]:checked').value,
        howFun: form.querySelector('input[name="howFun"]:checked').value,
        findFixClarity: form.querySelector('input[name="findFixClarity"]:checked').value,
        playAgain: form.querySelector('input[name="playAgain"]:checked').value,
        confusingPart: state.elements.confusingPart.value,
        ambiguousSentence: normalizeFreeText(state.elements.ambiguousSentence.value, 100),
        comment: normalizeFreeText(state.elements.comment.value, 200)
      }
    };
  }

  function buildFeedbackText() {
    if (!state.result) return "";
    const feedback = readFeedback();
    if (!feedback.valid) return "";

    const viewport = `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`;
    const sound = state.getSoundEnabled() ? "ON" : "OFF";
    const values = feedback.values;

    return [
      "Sentence Hunter Beta Feedback",
      `Version: ${BETA_VERSION}`,
      `Tester: ${state.tester}`,
      `Score: ${state.result.score}`,
      `Accuracy: ${state.result.accuracy}%`,
      `Best Combo: ${state.result.bestCombo}`,
      `Solved: ${state.result.solved}`,
      `Defeated Bugs: ${state.result.defeated}`,
      `End Reason: ${state.result.endReason}`,
      `Retries: ${state.retryCount}`,
      `Viewport: ${viewport}`,
      `Sound: ${sound}`,
      "",
      `How clear: ${values.howClear}/5`,
      `How fun: ${values.howFun}/5`,
      `FIND/FIX clarity: ${values.findFixClarity}/5`,
      `Play again: ${values.playAgain}`,
      `Confusing part: ${values.confusingPart}`,
      `Ambiguous sentence: ${values.ambiguousSentence}`,
      `Comment: ${values.comment}`,
      "",
      "Game:",
      buildBetaUrl(true)
    ].join("\n");
  }

  function focusFirstMissing(firstMissing) {
    setStatus(state.elements.feedbackStatus, "필수 평가 4개를 먼저 선택해 주세요.");
    if (firstMissing) firstMissing.focus();
  }

  function showManualCopy(text, textarea, status) {
    textarea.value = text;
    textarea.hidden = false;
    textarea.focus();
    textarea.select();
    setStatus(status, "아래 텍스트를 직접 선택해 복사해 주세요.");
  }

  function clearManualCopy(textarea, status) {
    textarea.hidden = true;
    textarea.value = "";
    setStatus(status, "");
  }

  async function copyText(text, textarea, status, successMessage = "피드백이 복사되었습니다.") {
    clearManualCopy(textarea, status);
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      textarea.hidden = true;
      textarea.value = "";
      setStatus(status, successMessage);
      return true;
    } catch (error) {
      showManualCopy(text, textarea, status);
      return false;
    }
  }

  async function shareText(title, text, textarea, status, copySuccessMessage) {
    clearManualCopy(textarea, status);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text });
        textarea.hidden = true;
        textarea.value = "";
        setStatus(status, "공유 창을 열었습니다.");
        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          setStatus(status, "");
          return;
        }
      }
    }
    await copyText(text, textarea, status, copySuccessMessage);
  }

  async function runAction(button, action) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await action();
    } finally {
      button.disabled = false;
    }
  }

  function requireFeedbackText() {
    const feedback = readFeedback();
    if (!feedback.valid) {
      focusFirstMissing(feedback.firstMissing);
      return "";
    }
    return buildFeedbackText();
  }

  function resetFeedbackUi() {
    const { form, feedbackPanel, feedbackToggle, feedbackStatus, feedbackManual } = state.elements;
    if (form) form.reset();
    if (feedbackPanel) feedbackPanel.hidden = true;
    if (feedbackToggle) feedbackToggle.setAttribute("aria-expanded", "false");
    if (feedbackStatus) feedbackStatus.textContent = "";
    if (feedbackManual) {
      feedbackManual.hidden = true;
      feedbackManual.value = "";
    }
  }

  function resetStartShareUi() {
    const { startStatus, startManual } = state.elements;
    if (startStatus) startStatus.textContent = "";
    if (startManual) {
      startManual.hidden = true;
      startManual.value = "";
    }
  }

  function createStartTools(startScreen) {
    const tools = createElement("div", "beta-start-tools");
    const fallback = createElement("div", "beta-start-feedback");
    const badge = createElement("p", "beta-badge", `BETA TEST · ${state.tester}`);
    const shareButton = createElement("button", "beta-link-button", "테스트 링크 공유");
    const status = createElement("p", "beta-status");
    const manual = createManualCopyArea("beta-manual-copy beta-link-manual");
    shareButton.type = "button";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    shareButton.addEventListener("click", () => {
      runAction(shareButton, () => shareText(
        "Sentence Hunter Beta Test",
        buildBetaUrl(false),
        manual,
        status,
        "테스트 링크가 복사되었습니다."
      ));
    });
    tools.appendChild(badge);
    tools.appendChild(shareButton);
    fallback.appendChild(status);
    fallback.appendChild(manual);
    startScreen.prepend(tools);
    (startScreen.querySelector(".start-panel") || startScreen).appendChild(fallback);
    startScreen.classList.add("beta-mode");
    state.elements.startStatus = status;
    state.elements.startManual = manual;
  }

  function createFeedbackTools(resultScreen) {
    const shell = createElement("section", "beta-feedback-shell");
    const toggle = createElement("button", "beta-feedback-toggle", "20초 피드백 남기기");
    const panel = createElement("div", "beta-feedback-panel glass-card");
    const heading = createElement("h3", "beta-panel-title", "BETA FEEDBACK");
    const intro = createElement(
      "p",
      "beta-panel-intro",
      "필수 4개만 선택하면 바로 공유할 수 있어요. 이름·이메일 등 개인정보는 입력하지 마세요."
    );
    const form = createElement("form", "beta-feedback-form");
    form.autocomplete = "off";

    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "beta-feedback-panel");
    panel.id = "beta-feedback-panel";
    panel.hidden = true;
    shell.hidden = true;

    form.appendChild(createChoiceField("1. 게임 방법 이해도 (필수)", "howClear", [1, 2, 3, 4, 5].map((value) => [String(value), String(value)])));
    form.appendChild(createChoiceField("2. 게임 재미 (필수)", "howFun", [1, 2, 3, 4, 5].map((value) => [String(value), String(value)])));
    form.appendChild(createChoiceField("3. FIND와 FIX 구분 (필수)", "findFixClarity", [1, 2, 3, 4, 5].map((value) => [String(value), String(value)])));
    form.appendChild(createChoiceField("4. 다시 플레이할 의향 (필수)", "playAgain", [
      ["YES", "예"],
      ["MAYBE", "아마도"],
      ["NO", "아니요"]
    ]));

    const confusingLabel = createElement("label", "beta-text-field");
    const confusingTitle = createElement("span", "beta-question", "5. 가장 헷갈린 부분 (선택)");
    const confusingPart = createElement("select");
    confusingPart.id = "beta-confusing-part";
    confusingPart.name = "confusingPart";
    CONFUSING_PARTS.forEach(([value, labelText]) => {
      const option = createElement("option", "", labelText);
      option.value = value;
      confusingPart.appendChild(option);
    });
    confusingLabel.appendChild(confusingTitle);
    confusingLabel.appendChild(confusingPart);
    form.appendChild(confusingLabel);

    const ambiguous = createTextareaField("6. 애매하거나 이상했던 문장 (선택·최대 100자)", "beta-ambiguous-sentence", 100);
    const comment = createTextareaField("7. 기타 의견 (선택·최대 200자)", "beta-comment", 200);
    form.appendChild(ambiguous.wrapper);
    form.appendChild(comment.wrapper);

    const actions = createElement("div", "beta-feedback-actions");
    const shareButton = createElement("button", "beta-share-button", "결과와 피드백 공유");
    const copyButton = createElement("button", "beta-copy-button", "텍스트 복사");
    shareButton.type = "button";
    copyButton.type = "button";
    actions.appendChild(shareButton);
    actions.appendChild(copyButton);

    const status = createElement("p", "beta-status beta-feedback-status");
    const manual = createManualCopyArea("beta-manual-copy beta-feedback-manual");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
      if (!expanded) heading.focus();
    });
    shareButton.addEventListener("click", () => {
      const text = requireFeedbackText();
      if (text) runAction(shareButton, () => shareText("Sentence Hunter Beta Feedback", text, manual, status));
    });
    copyButton.addEventListener("click", () => {
      const text = requireFeedbackText();
      if (text) runAction(copyButton, () => copyText(text, manual, status));
    });
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("input", () => clearManualCopy(manual, status));
    form.addEventListener("change", () => clearManualCopy(manual, status));

    heading.tabIndex = -1;
    panel.appendChild(heading);
    panel.appendChild(intro);
    panel.appendChild(form);
    panel.appendChild(actions);
    panel.appendChild(status);
    panel.appendChild(manual);
    shell.appendChild(toggle);
    shell.appendChild(panel);
    resultScreen.appendChild(shell);
    resultScreen.classList.add("beta-mode");

    Object.assign(state.elements, {
      shell,
      feedbackToggle: toggle,
      feedbackPanel: panel,
      form,
      confusingPart,
      ambiguousSentence: ambiguous.textarea,
      comment: comment.textarea,
      feedbackStatus: status,
      feedbackManual: manual
    });
  }

  function mount(options = {}) {
    if (state.mounted) return;
    const startScreen = document.getElementById("start-screen");
    const resultScreen = document.getElementById("result-screen");
    if (!startScreen || !resultScreen) return;
    if (typeof options.getSoundEnabled === "function") {
      state.getSoundEnabled = options.getSoundEnabled;
    }
    createStartTools(startScreen);
    createFeedbackTools(resultScreen);
    state.mounted = true;
  }

  function onGameStart() {
    state.result = null;
    if (state.elements.shell) state.elements.shell.hidden = true;
    resetStartShareUi();
    resetFeedbackUi();
  }

  function onResult(result) {
    state.result = {
      score: Math.max(0, Math.round(Number(result.score) || 0)),
      accuracy: Math.min(100, Math.max(0, Math.round(Number(result.accuracy) || 0))),
      bestCombo: Math.max(0, Math.round(Number(result.bestCombo) || 0)),
      solved: Math.max(0, Math.round(Number(result.solved) || 0)),
      defeated: Math.max(0, Math.round(Number(result.defeated) || 0)),
      endReason: result.endReason === "HEARTS" ? "HEARTS" : "TIME UP"
    };
    resetFeedbackUi();
    if (state.elements.shell) state.elements.shell.hidden = false;
  }

  function onRetry() {
    state.retryCount += 1;
  }

  function onHome() {
    state.retryCount = 0;
    state.result = null;
    if (state.elements.shell) state.elements.shell.hidden = true;
    resetStartShareUi();
    resetFeedbackUi();
  }

  window.SENTENCE_HUNTER_BETA = Object.freeze({
    active: true,
    tester: state.tester,
    mount,
    onGameStart,
    onResult,
    onRetry,
    onHome,
    getRetryCount() { return state.retryCount; },
    buildFeedbackText
  });
})();
