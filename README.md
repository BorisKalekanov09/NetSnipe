# NetSnipe

A Chrome extension (Manifest V3) that uses AI to answer computer-networks questions in Google Forms. It sends the selected question to Gemini 2.5 Flash Lite through [OpenRouter](https://openrouter.ai) and fills in the answer.

## Features

- **Choice questions** (radio and checkbox): click the question, press **Ctrl** three times quickly, and the extension ticks the answer the AI picks. Questions that allow more than one answer get every option the AI selects.
- **Open text questions**: click the question, press **Shift** three times quickly, and a short answer is typed into the field. Text answers are written in Bulgarian; technical terms, acronyms and numbers stay as they are.
- The API call runs in the background service worker, so the API key is never exposed to the page.

## Installation

### 1. Download the code

Either clone the repository:

```bash
git clone https://github.com/BorisKalekanov09/NetSnipe.git
```

or, on the GitHub page, click **Code → Download ZIP** and extract it to a folder.

### 2. Get an OpenRouter API key

1. Sign up at [openrouter.ai](https://openrouter.ai).
2. Go to [openrouter.ai/keys](https://openrouter.ai/keys) and click **Create Key**.
3. Copy the key. It starts with `sk-or-v1-`.

### 3. Create the config file

In the project folder, copy `config.example.js` to a new file named `config.local.js` and paste your key into it:

```js
const OPENROUTER_API_KEY = "sk-or-v1-...";
```

The extension won't load without `config.local.js`. The file is gitignored, so your key stays out of the repository. If you'd rather enter the key in the extension popup, still create the file but leave the string empty (`""`).

### 4. Add the extension to Chrome

1. Open `chrome://extensions` in Chrome. Edge works too, at `edge://extensions`.
2. Turn on **Developer mode** (the switch in the top-right corner).
3. Click **Load unpacked** and select the project folder, the one that contains `manifest.json`.
4. Optional: click the puzzle-piece icon in the toolbar and pin **Forms AI Answer** so it's easy to reach.
5. If you left the key empty in step 3, click the extension icon, paste your key, and click **Save**.

If you change any file later, click the reload icon on the extension's card in `chrome://extensions`, then refresh the Google Form.

## Usage

1. Open a Google Form.
2. Click a question box.
3. Press **Ctrl** three times within one second for a choice question, or **Shift** three times for a text question.

## Configuration

| Setting | Location | Default |
|---|---|---|
| Model | `MODEL` in `background.js` | `google/gemini-2.5-flash-lite` |
| Key-press window | `PRESS_WINDOW_MS` in `content.js` | `1000` ms |
| Prompt / subject area | `buildPrompt` and `buildTextPrompt` in `background.js` | Computer networks |

## Project structure

```
manifest.json       Extension manifest (MV3)
background.js       Service worker: builds prompts and calls OpenRouter
content.js          Runs on Google Forms: tracks the selected question, detects the hotkeys, fills in answers
popup.html/.js      Popup for saving the API key
config.example.js   Template for config.local.js
```

## License

[MIT](LICENSE)
