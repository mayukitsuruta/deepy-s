(() => {
  const preferenceKey = "deepys-font-preview";
  const fonts = {
    original: { label: "もとのフォント", family: null },
    tanuki: { label: "たぬき油性マジック", family: "Deepys Tanuki Magic" },
    dela: { label: "Dela Gothic One", family: "Deepys Dela Gothic One" },
    custom: { label: "ファイルで試す", family: "Deepys Local Preview" },
  };
  const fallback = '"Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';
  const root = document.documentElement;
  let state = { font: "original", scope: "all" };
  let generation = 0;
  let localFace = null;
  let localFileName = "";

  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    if (saved && Object.hasOwn(fonts, saved.font)) state.font = saved.font;
    if (saved?.scope === "headings") state.scope = saved.scope;
  } catch { /* Preview also works when browser storage is unavailable. */ }

  function apply() {
    root.dataset.previewFont = state.font;
    root.dataset.previewScope = state.scope;
    const family = fonts[state.font].family;
    root.style.setProperty("--preview-font-family", family ? `"${family}", ${fallback}` : fallback);
  }

  function save() {
    try { localStorage.setItem(preferenceKey, JSON.stringify(state)); } catch { /* Keep the current preview. */ }
  }

  // Apply the preference before the body is rendered, including across pages.
  apply();

  // Selected font files stay in this browser, outside the site assets.
  async function localFileStore(operation, file) {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("deepys-font-preview", 2);
      request.onupgradeneeded = () => {
        const store = request.result.objectStoreNames.contains("fonts")
          ? request.transaction.objectStore("fonts")
          : request.result.createObjectStore("fonts");
        // Discard the cached file from the removed preset.
        store.delete("aosagi");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction("fonts", operation === "read" ? "readonly" : "readwrite");
        const store = transaction.objectStore("fonts");
        const request = operation === "read" ? store.get("custom") : store.put(file, "custom");
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }

  async function loadLocalFile(file) {
    const face = await new FontFace(fonts.custom.family, await file.arrayBuffer()).load();
    if (localFace) document.fonts.delete(localFace);
    document.fonts.add(face);
    localFace = face;
    localFileName = file.name || "選んだフォント";
  }

  function mount() {
    const widget = document.createElement("aside");
    widget.className = "font-preview";
    widget.setAttribute("aria-label", "フォントのプレビュー");
    widget.innerHTML = `
      <div class="font-preview-panel" id="font-preview-panel" aria-busy="false" hidden>
        <div class="font-preview-header">
          <h2 class="font-preview-title">フォントを試す</h2>
          <button class="font-preview-close" type="button" aria-label="フォント設定を閉じる">×</button>
        </div>
        <fieldset>
          <legend>フォント</legend>
          <div class="font-preview-options">
            ${Object.entries(fonts).map(([key, font]) => `
              <label class="font-preview-choice">
                <input type="radio" name="preview-font" value="${key}" ${state.font === key ? "checked" : ""} />
                <span>${font.label}</span>
              </label>`).join("")}
          </div>
        </fieldset>
        <fieldset>
          <legend>適用するところ</legend>
          <div class="font-preview-options">
            <label class="font-preview-choice">
              <input type="radio" name="preview-scope" value="all" ${state.scope === "all" ? "checked" : ""} />
              <span>ページ全体</span>
            </label>
            <label class="font-preview-choice">
              <input type="radio" name="preview-scope" value="headings" ${state.scope === "headings" ? "checked" : ""} />
              <span>見出し・ボタン</span>
            </label>
          </div>
        </fieldset>
        <p class="font-preview-sample">地底の世界へようこそ！<br />DEEPY’s 0123</p>
        <div class="font-preview-local" hidden>
          <label class="font-preview-upload">
            フォントファイルを選ぶ
            <input class="font-preview-file" type="file" accept=".otf,.ttf,.woff,.woff2" aria-label="試すフォントファイル" aria-describedby="font-preview-local-note" />
          </label>
          <p class="font-preview-local-note" id="font-preview-local-note">OTF・TTF・WOFF・WOFF2（端末内でプレビュー）</p>
        </div>
        <p class="font-preview-status" role="status" aria-live="polite"></p>
      </div>
      <button class="font-preview-toggle" type="button" aria-expanded="false" aria-controls="font-preview-panel">
        <span class="font-preview-monogram" aria-hidden="true">Aa</span>
        <span>フォント</span>
      </button>`;
    document.body.append(widget);

    const panel = widget.querySelector(".font-preview-panel");
    const toggle = widget.querySelector(".font-preview-toggle");
    const status = widget.querySelector(".font-preview-status");
    const localSection = widget.querySelector(".font-preview-local");
    const fileInput = widget.querySelector(".font-preview-file");

    function setOpen(open, returnFocus = false) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) widget.querySelector('input[name="preview-font"]:checked').focus();
      else if (returnFocus) toggle.focus();
    }

    function sync() {
      widget.querySelectorAll('input[name="preview-font"]').forEach((input) => {
        input.checked = input.value === state.font;
      });
      localSection.hidden = state.font !== "custom";
    }

    async function selectFont(key) {
      const request = ++generation;
      state.font = key;
      apply();
      save();
      sync();
      if (key === "original") {
        panel.setAttribute("aria-busy", "false");
        status.textContent = "もとのフォントに戻しました。";
        return;
      }
      panel.setAttribute("aria-busy", "true");
      status.textContent = "フォントを読み込んでいます…";
      try {
        if (key === "custom" && !localFace) {
          const file = await localFileStore("read").catch(() => null);
          if (request !== generation) return;
          if (!file) {
            status.textContent = "";
            return;
          }
          await loadLocalFile(file);
        } else if (key !== "custom") {
          const faces = await document.fonts.load(`16px "${fonts[key].family}"`);
          if (!faces.length) throw new Error("Font unavailable");
        }
        if (request !== generation) return;
        status.textContent = `${key === "custom" ? localFileName : fonts[key].label}で表示しています。`;
      } catch {
        if (request !== generation) return;
        state.font = "original";
        apply();
        save();
        sync();
        status.textContent = "読み込めませんでした。もとのフォントに戻しました。もう一度試してね。";
      } finally {
        if (request === generation) panel.setAttribute("aria-busy", "false");
      }
    }

    toggle.addEventListener("click", () => setOpen(panel.hidden));
    widget.querySelector(".font-preview-close").addEventListener("click", () => setOpen(false, true));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        event.preventDefault();
        setOpen(false, true);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!panel.hidden && !widget.contains(event.target)) setOpen(false);
    });
    widget.addEventListener("change", (event) => {
      if (event.target.name === "preview-font") selectFont(event.target.value);
      if (event.target.name === "preview-scope") {
        state.scope = event.target.value;
        apply();
        save();
      }
    });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const request = ++generation;
      panel.setAttribute("aria-busy", "true");
      status.textContent = "この端末でフォントを読み込んでいます…";
      try {
        await loadLocalFile(file);
        if (request !== generation) return;
        state.font = "custom";
        apply();
        save();
        sync();
        const saved = await localFileStore("write", file).then(() => true, () => false);
        if (request !== generation) return;
        status.textContent = saved
          ? `${localFileName}で表示しています。次回もこの端末で使えます。`
          : `${localFileName}で表示しています。次のページではファイルを選び直してね。`;
      } catch {
        if (request !== generation) return;
        status.textContent = "ファイルを読み込めませんでした。フォントファイルを選び直してね。";
      } finally {
        fileInput.value = "";
        if (request === generation) panel.setAttribute("aria-busy", "false");
      }
    });

    if (state.font !== "original") selectFont(state.font);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
