// Service worker: talks to OpenRouter so the API key never touches the page.

const MODEL = "google/gemini-2.5-flash-lite";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
importScripts("config.local.js"); // defines OPENROUTER_API_KEY (gitignored)

function buildPrompt({ question, description, options, multiple }) {
  const list = options.map((o, i) => `${i + 1}. ${o}`).join("\n");
  return [
    "You are an expert in computer networks (OSI/TCP-IP models, IP addressing and subnetting,",
    "routing and switching, protocols such as TCP, UDP, HTTP, DNS, DHCP, ARP, VLANs, Wi-Fi, network security, Cisco IOS, etc.).",
    "The following is a quiz question about networks.",
    "",
    `Question: ${question}`,
    description ? `Additional info: ${description}` : "",
    "",
    "Possible answers:",
    list,
    "",
    multiple
      ? "This question allows MULTIPLE correct answers. Select ALL answers that are correct."
      : "This question has exactly ONE correct answer.",
    "",
    'Reply ONLY with JSON in this exact format, no other text: {"answers": [<numbers of the correct answers>]}',
    'Example: {"answers": [2]}'
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function buildTextPrompt({ question, description }) {
  return [
    "You are an expert in computer networks (OSI/TCP-IP models, IP addressing and subnetting,",
    "routing and switching, protocols such as TCP, UDP, HTTP, DNS, DHCP, ARP, VLANs, Wi-Fi, network security, Cisco IOS, etc.).",
    "The following is an open quiz question about networks.",
    "",
    `Question: ${question}`,
    description ? `Additional info: ${description}` : "",
    "",
    "Give ONLY the correct answer, as short as possible (a word, a number, a term or one short sentence).",
    "No explanation, no introduction, no quotes, no markdown.",
    "ALWAYS write the answer in Bulgarian (български език), even if the question is in English.",
    "Keep standard technical terms, acronyms, protocol names, commands and numbers as they are (e.g. TCP, OSI, 192.168.1.0/24, ping)."
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function cleanTextAnswer(text) {
  return text
    .replace(/^```[a-z]*\s*|```$/g, "")
    .replace(/^\s*(answer|отговор)\s*:\s*/i, "")
    .replace(/\*\*/g, "")
    .replace(/^["'„“]+|["'”“]+$/g, "")
    .trim();
}

function parseAnswer(text, optionCount) {
  let nums = [];
  const json = text.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const obj = JSON.parse(json[0]);
      if (Array.isArray(obj.answers)) nums = obj.answers.map(Number);
    } catch (_) {}
  }
  if (!nums.length) {
    nums = (text.match(/\d+/g) || []).map(Number);
  }
  return [...new Set(nums)].filter((n) => n >= 1 && n <= optionCount).map((n) => n - 1);
}

async function askAI(payload) {
  const stored = await chrome.storage.local.get("apiKey");
  const apiKey = OPENROUTER_API_KEY || stored.apiKey;
  if (!apiKey) throw new Error("No OpenRouter API key set.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Forms AI Answer"
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: payload.mode === "text" ? buildTextPrompt(payload) : buildPrompt(payload)
        }
      ]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";

  if (payload.mode === "text") {
    const answer = cleanTextAnswer(text);
    if (!answer) throw new Error("AI returned an empty answer.");
    return { text: answer, raw: text };
  }

  const indexes = parseAnswer(text, payload.options.length);
  if (!indexes.length) throw new Error("AI reply could not be parsed: " + text.slice(0, 120));
  return { indexes, raw: text };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "ASK_AI") return;
  askAI(msg.payload)
    .then((r) => sendResponse({ ok: true, ...r }))
    .catch((e) => sendResponse({ ok: false, error: e.message }));
  return true; // keep channel open for async response
});
