// Content script for Google Forms.
// 1) Remember which question box you clicked.
// 2) Press Ctrl three times quickly -> send question + options to AI -> tick the answer.

(() => {
  const PRESS_WINDOW_MS = 1000; // 3 Ctrl presses must happen within this time
  let activeQuestion = null;
  let ctrlTimes = [];
  let shiftTimes = [];
  let busy = false;

  // ---------- question tracking ----------
  function findQuestion(el) {
    return el?.closest?.('div[role="listitem"]') || null;
  }

  function setActive(q) {
    if (q) activeQuestion = q;
  }

  document.addEventListener("mousedown", (e) => setActive(findQuestion(e.target)), true);
  document.addEventListener("focusin", (e) => setActive(findQuestion(e.target)), true);

  // ---------- Ctrl x3 detection ----------
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Control" && e.key !== "Shift") {
        ctrlTimes = [];
        shiftTimes = [];
        return;
      }
      if (e.repeat) return;
      const now = Date.now();
      if (e.key === "Control") {
        shiftTimes = [];
        ctrlTimes = ctrlTimes.filter((t) => now - t < PRESS_WINDOW_MS);
        ctrlTimes.push(now);
        if (ctrlTimes.length >= 3) {
          ctrlTimes = [];
          run("choice");
        }
      } else {
        ctrlTimes = [];
        shiftTimes = shiftTimes.filter((t) => now - t < PRESS_WINDOW_MS);
        shiftTimes.push(now);
        if (shiftTimes.length >= 3) {
          shiftTimes = [];
          run("text");
        }
      }
    },
    true
  );

  // ---------- extraction ----------
  function cleanText(s) {
    return (s || "").replace(/\s+/g, " ").replace(/\*\s*$/, "").trim();
  }

  function optionLabel(el) {
    return cleanText(
      el.getAttribute("data-value") ||
        el.getAttribute("data-answer-value") ||
        el.getAttribute("aria-label") ||
        el.closest("label")?.innerText ||
        el.parentElement?.innerText
    );
  }

  function extract(q) {
    const heading = q.querySelector('[role="heading"]');
    const question = cleanText(heading?.innerText);

    // optional description under the title
    let description = "";
    const headingBlock = heading?.parentElement?.parentElement;
    if (headingBlock) {
      description = cleanText(headingBlock.innerText.replace(heading.innerText, ""));
    }

    const radios = [...q.querySelectorAll('[role="radio"]')];
    const checks = [...q.querySelectorAll('[role="checkbox"]')];
    const multiple = checks.length > 0 && radios.length === 0;
    const elements = multiple ? checks : radios;

    const items = elements
      .map((el) => ({ el, text: optionLabel(el) }))
      .filter((o) => o.text && !/^__other_option__$/.test(o.text));

    return { question, description, multiple, items };
  }

  // ---------- ticking ----------
  function isChecked(el) {
    return el.getAttribute("aria-checked") === "true";
  }

  function tick(el) {
    el.click();
  }

  function applyAnswer(data, indexes) {
    const wanted = new Set(indexes);
    data.items.forEach((o, i) => {
      if (wanted.has(i) && !isChecked(o.el)) tick(o.el);
      // for checkboxes, untick anything the AI says is wrong
      if (data.multiple && !wanted.has(i) && isChecked(o.el)) tick(o.el);
    });
  }

  // ---------- open (text) questions ----------
  function findTextField(q) {
    return q.querySelector('textarea, input[type="text"]');
  }

  function fillText(field, text) {
    const proto = field.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    field.focus();
    setter.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ---------- main (silent: nothing is shown on the page) ----------
  async function run(mode) {
    if (busy) return;
    const q = activeQuestion && document.contains(activeQuestion) ? activeQuestion : null;
    if (!q) return;

    const data = extract(q);
    if (!data.question) return;

    let payload;
    let field = null;
    if (mode === "text") {
      field = findTextField(q);
      if (!field) return;
      payload = { mode: "text", question: data.question, description: data.description };
    } else {
      if (data.items.length === 0) return;
      payload = {
        mode: "choice",
        question: data.question,
        description: data.description,
        options: data.items.map((o) => o.text),
        multiple: data.multiple
      };
    }

    busy = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: "ASK_AI", payload });
      if (!res?.ok) throw new Error(res?.error || "Unknown error");

      if (mode === "text") fillText(field, res.text);
      else applyAnswer(data, res.indexes);
    } catch (err) {
      console.debug("[Forms AI]", err.message);
    } finally {
      busy = false;
    }
  }
})();
