const HOUSE_TYPES = [
  { id: "home-1", name: "赤い葉っぱの家", description: "大きな葉っぱと、まあるい窓。" },
  { id: "home-2", name: "どんぐりの家", description: "小さな灯りが迎えてくれる家。" },
  { id: "home-3", name: "丸太の家", description: "木のぬくもりに包まれて。" },
  { id: "home-4", name: "きのこの家", description: "きのこの屋根で、ひと休み。" },
  { id: "home-5", name: "花のつぼみの家", description: "やわらかな花びらのおうち。" },
];
const clamp = (value) => Math.min(1, Math.max(0, value));
export const HOUSE_MESSAGE_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function latestHouseMessages(posts, now = Date.now()) {
  const messages = new Map();
  for (const post of posts) {
    if (!post || typeof post.uid !== "string" || !post.uid ||
        typeof post.text !== "string" || !post.text.trim()) continue;
    const timestamp = post.createdAt;
    const createdAtMs = typeof timestamp?.toMillis === "function"
      ? timestamp.toMillis()
      : timestamp instanceof Date ? timestamp.getTime() : NaN;
    if (!Number.isFinite(createdAtMs) || createdAtMs > now ||
        createdAtMs + HOUSE_MESSAGE_LIFETIME_MS <= now) continue;
    if ((messages.get(post.uid)?.createdAtMs ?? -Infinity) >= createdAtMs) continue;
    messages.set(post.uid, {
      text: post.text.trim(), createdAtMs,
      expiresAtMs: createdAtMs + HOUSE_MESSAGE_LIFETIME_MS,
    });
  }
  return messages;
}

// One home per profile. Older grid placements keep their first valid house.
export function normalizeSpaceHouses(value) {
  if (!Array.isArray(value)) return [];
  for (const house of value) {
    if (!house || typeof house.id !== "string" || !house.id ||
        !HOUSE_TYPES.some((type) => type.id === house.type)) continue;
    let { layer, x, y } = house;
    if (!Number.isInteger(layer) || layer < 1 || layer > 3 ||
        !Number.isFinite(x) || !Number.isFinite(y)) {
      if (!Number.isInteger(house.slot) || house.slot < 0 || house.slot >= 18) continue;
      layer = Math.floor(house.slot / 6) + 1;
      x = ((house.slot % 3) + 0.5) / 3;
      y = (house.slot % 6) < 3 ? 0.3 : 0.75;
    }
    return [{ id: house.id, type: house.type, layer, x: clamp(x), y: clamp(y), flipped: house.flipped === true }];
  }
  return [];
}

export function houseLocation(house) {
  if (!house) return "まだ家がありません";
  const [position] = normalizeSpaceHouses([house]);
  if (!position) return "まだ家がありません";
  return `第${position.layer}層・${position.x < 0.34 ? "左" : position.x > 0.66 ? "右" : "中央"}${position.y < 0.5 ? "上" : "下"}エリア`;
}

export function createSpaceHousing({ onChange, canSave, ownerName = () => "私", ownerId = () => null, onPlacementStart = () => {} }) {
  const byId = (id) => document.getElementById(id);
  const viewport = byId("space-map-viewport");
  const wrapper = byId("space-map-wrapper");
  const picker = byId("house-picker");
  const status = byId("house-map-status");
  const grounds = [];
  let houses = [];
  let residents = [];
  let recentPosts = [];
  let houseMessages = new Map();
  let messageExpiryTimer = null;
  let mode = null;
  let pendingType = null;
  let revision = 0;
  let saveQueue = Promise.resolve();
  let hasSaveError = false;
  const message = (text) => { status.textContent = text; };

  function positionElement(element, house) {
    element.style.left = `clamp(95px, ${house.x * 100}%, calc(100% - 95px))`;
    element.style.top = `clamp(100px, ${house.y * 100}%, calc(100% - 100px))`;
  }

  function addSpeechBubble(element) {
    element.querySelector(".house-speech")?.remove();
    element.removeAttribute("aria-describedby");
    const post = houseMessages.get(element.dataset.ownerId);
    if (!post) return;
    const bubble = document.createElement("span");
    bubble.className = "house-speech";
    bubble.id = `house-speech-${element.dataset.ownerId}`;
    bubble.setAttribute("role", "note");
    bubble.setAttribute("aria-label", "24時間以内の最新のひとこと");
    const text = document.createElement("span");
    text.className = "house-speech-text";
    text.textContent = post.text;
    const time = document.createElement("time");
    time.className = "house-speech-time";
    time.dateTime = new Date(post.createdAtMs).toISOString();
    time.textContent = new Intl.DateTimeFormat("ja-JP", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(post.createdAtMs);
    bubble.append(text, time);
    element.appendChild(bubble);
    element.setAttribute("aria-describedby", bubble.id);
  }

  function refreshHouseMessages() {
    clearTimeout(messageExpiryTimer);
    messageExpiryTimer = null;
    const now = Date.now();
    houseMessages = latestHouseMessages(recentPosts, now);
    grounds.forEach((ground) => ground.querySelectorAll(".placed-house").forEach(addSpeechBubble));
    arrangeSpeechBubbles();
    const nextExpiry = Math.min(...Array.from(houseMessages.values(), (post) => post.expiresAtMs));
    if (Number.isFinite(nextExpiry)) {
      messageExpiryTimer = setTimeout(refreshHouseMessages, Math.max(1, nextExpiry - now));
    }
  }

  function arrangeSpeechBubbles() {
    grounds.forEach((ground) => {
      const bubbles = Array.from(ground.querySelectorAll(".house-speech"));
      bubbles.forEach((bubble) => bubble.style.setProperty("--speech-lift", "0px"));
      const occupied = [];
      bubbles.forEach((bubble) => {
        const rect = bubble.getBoundingClientRect();
        if (!rect.width) return;
        let top = rect.top;
        let bottom = rect.bottom;
        let lift = 0;
        let overlap;
        while ((overlap = occupied.find((other) =>
          rect.left < other.right + 8 && rect.right > other.left - 8 &&
          top < other.bottom + 10 && bottom > other.top - 10))) {
          const distance = Math.max(1, bottom - overlap.top + 10);
          lift += distance;
          top -= distance;
          bottom -= distance;
        }
        bubble.style.setProperty("--speech-lift", `${lift}px`);
        occupied.push({ left: rect.left, right: rect.right, top, bottom });
      });
    });
  }

  new ResizeObserver(arrangeSpeechBubbles).observe(viewport);

  // Background tabs can suspend timers; re-check the 24-hour cutoff when returning.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshHouseMessages();
  });
  window.addEventListener("pageshow", refreshHouseMessages);

  function houseElement(house, name, own, uid) {
    const type = HOUSE_TYPES.find((item) => item.id === house.type);
    const element = document.createElement(own ? "button" : "div");
    element.className = own ? "placed-house own-house" : "placed-house resident-house";
    element.dataset.ownerId = uid || "";
    if (own) {
      element.type = "button";
      element.setAttribute("aria-label", `私の家、${type.name}、${houseLocation(house)}`);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        if (mode) return;
        message("あなたの家です。移動やデザイン変更ができます。");
      });
    }
    const label = document.createElement("span");
    label.className = "house-nameplate";
    label.textContent = `${name}の家`;
    const image = document.createElement("img");
    image.src = `./images/${house.type}.png`;
    image.alt = own ? "" : `${name}の${type.name}`;
    image.draggable = false;
    image.style.transform = house.flipped ? "scaleX(-1)" : "";
    element.append(label, image);
    addSpeechBubble(element);
    positionElement(element, house);
    return element;
  }

  document.querySelectorAll(".stratum-layer").forEach((layer, index) => {
    const ground = document.createElement("div");
    ground.className = "house-ground";
    ground.dataset.houseLayerArea = String(index + 1);
    ground.addEventListener("click", (event) => {
      if (!mode || event.target.closest(".placed-house")) return;
      const rect = ground.getBoundingClientRect();
      placeHouse(index + 1, clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height));
    });
    ground.addEventListener("keydown", (event) => {
      if (!mode || event.target !== ground || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      const rect = ground.getBoundingClientRect();
      const view = viewport.getBoundingClientRect();
      placeHouse(index + 1, clamp((view.left + view.width / 2 - rect.left) / rect.width), clamp((view.top + view.height / 2 - rect.top) / rect.height));
    });
    layer.appendChild(ground);
    grounds.push(ground);
  });

  function render() {
    const house = houses[0];
    wrapper.classList.toggle("is-placing-house", Boolean(mode));
    grounds.forEach((ground, index) => {
      ground.replaceChildren();
      ground.tabIndex = mode ? 0 : -1;
      ground.setAttribute("role", mode ? "button" : "group");
      ground.setAttribute("aria-label", `第${index + 1}層${mode ? "に家を置く。クリックで位置を選ぶか、Enterで中央に置けます" : "の住人の家"}`);
      residents.filter((resident) => resident.house.layer === index + 1).forEach((resident) => {
        ground.appendChild(houseElement(resident.house, resident.name, false, resident.uid));
      });
      if (house?.layer === index + 1) ground.appendChild(houseElement(house, ownerName(), true, ownerId()));
    });
    arrangeSpeechBubbles();
    ["house-move", "house-flip", "house-remove", "move-house-btn"].forEach((id) => {
      byId(id).disabled = !house || Boolean(mode);
    });
    byId("house-add").disabled = Boolean(mode);
    byId("house-add").textContent = house ? "家を着せ替える" : "家を選ぶ";
    byId("house-cancel").hidden = !mode;
    byId("house-retry").hidden = !hasSaveError;
    const preview = byId("house-preview-image");
    preview.hidden = !house;
    byId("house-preview-empty").hidden = Boolean(house);
    if (house) {
      preview.src = `./images/${house.type}.png`;
      preview.alt = HOUSE_TYPES.find((type) => type.id === house.type).name;
      preview.style.transform = house.flipped ? "scaleX(-1)" : "";
    } else {
      preview.removeAttribute("src");
      preview.alt = "";
    }
    byId("house-location-text").textContent = houseLocation(house);
    byId("change-interior-btn").textContent = house ? "家のデザインを変更" : "家を選ぶ";
    byId("house-save-note").textContent = canSave()
      ? "あなたの家はひとつ。配置はアカウントに自動保存されます。"
      : "家はひとりひとつ。Google で登録すると、次回も続きから遊べます。";
  }

  function save(text) {
    const version = ++revision;
    const result = onChange(houses.map((house) => ({ ...house })), saveQueue);
    saveQueue = Promise.resolve(result).catch(() => {});
    message(canSave() ? `${text} 保存中…` : `${text}（ゲスト：今回のプレイのみ）`);
    Promise.resolve(result).then(() => {
      if (version !== revision) return;
      hasSaveError = false;
      render();
      message(canSave() ? `${text} 保存しました。` : `${text}（ゲスト：今回のプレイのみ）`);
    }).catch(() => {
      if (version !== revision) return;
      hasSaveError = true;
      render();
      message("家を保存できませんでした。通信を確認して「保存を再試行」を押してね。");
    });
  }

  function finishChange(text) {
    mode = null;
    pendingType = null;
    render();
    save(text);
  }

  function placeHouse(layer, x, y) {
    if (mode === "move" && houses[0]) {
      Object.assign(houses[0], { layer, x, y });
      finishChange("家を移動しました。");
    } else if (mode === "add" && pendingType && !houses.length) {
      houses = [{ id: crypto.randomUUID(), type: pendingType, layer, x, y, flipped: false }];
      finishChange("あなたの家を置きました。");
    }
  }

  function openPicker() {
    mode = null;
    pendingType = null;
    byId("house-picker-title").textContent = houses.length ? "家のデザインを変えよう" : "どの家にしよう？";
    render();
    picker.showModal();
  }

  HOUSE_TYPES.forEach((type) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "house-type-option";
    option.dataset.houseType = type.id;
    const image = document.createElement("img");
    image.src = `./images/${type.id}.png`;
    image.alt = "";
    const name = document.createElement("strong");
    name.textContent = type.name;
    const description = document.createElement("span");
    description.textContent = type.description;
    option.append(image, name, description);
    option.addEventListener("click", () => {
      picker.close();
      if (houses[0]) {
        houses[0].type = type.id;
        finishChange("家のデザインを変更しました。");
      } else {
        pendingType = type.id;
        mode = "add";
        render();
        onPlacementStart();
        message("マップの好きな場所をクリックして、家を置いてね。1〜3層から選べます。");
        grounds.find((ground) => {
          const rect = ground.getBoundingClientRect();
          return rect.bottom > viewport.getBoundingClientRect().top && rect.top < viewport.getBoundingClientRect().bottom;
        })?.focus({ preventScroll: true });
      }
    });
    byId("house-picker-options").appendChild(option);
  });

  function cancel() {
    mode = null;
    pendingType = null;
    render();
    message("配置をキャンセルしました。");
  }

  function startMove() {
    if (!houses[0]) return;
    mode = "move";
    render();
    onPlacementStart();
    message("移動したい場所をクリックしてね。1〜3層の好きな場所へ移動できます。");
    viewport.focus({ preventScroll: true });
    viewport.querySelector(".own-house")?.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
  }

  ["house-add", "edit-house-btn", "change-interior-btn"].forEach((id) => byId(id).addEventListener("click", openPicker));
  byId("house-picker-close").addEventListener("click", () => picker.close());
  picker.addEventListener("click", (event) => { if (event.target === picker) picker.close(); });
  ["house-move", "move-house-btn"].forEach((id) => byId(id).addEventListener("click", startMove));
  byId("house-flip").addEventListener("click", () => {
    if (!houses[0]) return;
    houses[0].flipped = !houses[0].flipped;
    finishChange("家の向きを変えました。");
  });
  byId("house-remove").addEventListener("click", () => {
    houses = [];
    finishChange("家をしまいました。いつでも置き直せます。");
  });
  byId("house-cancel").addEventListener("click", cancel);
  byId("house-retry").addEventListener("click", () => save("家を更新しました。"));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && mode) cancel(); });
  document.querySelectorAll("[data-house-layer]").forEach((button) => {
    button.addEventListener("click", () => viewport.scrollTo({
      top: grounds[Number(button.dataset.houseLayer) - 1].parentElement.offsetTop, behavior: "auto",
    }));
  });
  render();

  return {
    render(value) { houses = normalizeSpaceHouses(value); render(); },
    renderResidents(users, uid) {
      residents = users.filter((user) => user.id !== uid).flatMap((user) => {
        const [house] = normalizeSpaceHouses(user.spaceHouses);
        return house ? [{ house, uid: user.id, name: String(user.nickname || "地底の住人") }] : [];
      });
      render();
    },
    renderMessages(posts) {
      recentPosts = posts;
      refreshHouseMessages();
    },
    reset() {
      revision += 1;
      houses = [];
      residents = [];
      recentPosts = [];
      houseMessages = new Map();
      clearTimeout(messageExpiryTimer);
      messageExpiryTimer = null;
      mode = null;
      pendingType = null;
      hasSaveError = false;
      saveQueue = Promise.resolve();
      picker.close();
      render();
      viewport.scrollTo({ left: 0, top: 0 });
      message("「家を選ぶ」で、お気に入りの家をひとつ選んでね。");
    },
    cancel() { if (mode) cancel(); if (picker.open) picker.close(); },
  };
}
