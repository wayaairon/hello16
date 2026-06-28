const config = window.HELLO16_CONFIG || {};
const MAX_CLIENT_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1800;
const IMAGE_QUALITY = 0.82;

let uploadedPhotos = [];
let visitorMessages = [];
let flipbookPages = [];
let flipbookSpread = 0;
let flipbookSpreadCount = 0;
let flipbookIsTurning = false;
let musicContext = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let musicIsPlaying = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hideSection(selector) {
  const section = $(selector);
  if (section) section.hidden = true;
}

function getWriteKey() {
  return sessionStorage.getItem("hello16-write-key") || "";
}

function setStatus(selector, text, type = "") {
  const status = $(selector);
  if (!status) return;
  status.textContent = text;
  status.dataset.type = type;
}

function initBasics() {
  document.title = `${config.siteName || "hello16"}｜${config.nickname || "16"} 的成长记录`;
  $("#childName").textContent = config.childName || "曾洲宁";
  $("#nickname").textContent = config.nickname || "16";
  $("#birthDate").textContent = config.birthDate || "";
  $("#heroPhoto").src = config.heroPhoto || "";
  $("#year").textContent = new Date().getFullYear();
}

function initLock() {
  const lockScreen = $("#lockScreen");
  const input = $("#passcodeInput");
  const btn = $("#unlockBtn");
  const hint = $("#lockHint");
  const expected = config.passcode || "hello16";

  if (
    sessionStorage.getItem("hello16-unlocked") === "yes" &&
    sessionStorage.getItem("hello16-write-key")
  ) {
    lockScreen.classList.add("hidden");
  }

  const unlock = () => {
    if (input.value.trim() === expected) {
      sessionStorage.setItem("hello16-unlocked", "yes");
      sessionStorage.setItem("hello16-write-key", input.value.trim());
      lockScreen.classList.add("hidden");
      return;
    }
    hint.textContent = "口令不对，再试一次。";
    hint.classList.add("error");
  };

  btn.addEventListener("click", unlock);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") unlock();
  });
}

function openPhoto(src, altText) {
  const dialog = $("#photoDialog");
  $("#dialogImage").src = src;
  $("#dialogImage").alt = altText || "照片预览";
  if (typeof dialog.showModal === "function") dialog.showModal();
}

function initDialog() {
  const dialog = $("#photoDialog");
  $("#dialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function renderTimeline() {
  const list = $("#timelineList");
  const items = config.timeline || [];
  if (!items.length) {
    hideSection("#timeline");
    return;
  }

  list.innerHTML = items.map((item, index) => `
    <article class="timeline-item">
      <div class="timeline-dot">${index + 1}</div>
      <div>
        <p class="timeline-date">${escapeHtml(item.date)}</p>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
      </div>
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" data-preview />` : ""}
    </article>
  `).join("");
}

function renderAlbums() {
  const grid = $("#albumGrid");
  const photos = [
    ...(config.photos || []),
    ...uploadedPhotos.map((photo) => photo.url || photo)
  ];
  if (!photos.length) {
    hideSection("#album");
    return;
  }

  grid.innerHTML = photos.map((photo, index) => `
    <img
      class="album-photo"
      src="${escapeHtml(photo)}"
      alt="16 的成长照片 ${index + 1}"
      loading="lazy"
      data-preview
    />
  `).join("");
}

function videoType(src = "") {
  const lower = src.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

function renderVideos() {
  const grid = $("#videoGrid");
  if (!grid) return;

  const videos = config.videos || [];
  if (!videos.length) {
    hideSection("#videos");
    return;
  }

  grid.innerHTML = videos.map((video) => {
    const item = typeof video === "string" ? { src: video } : video;
    if (!item.src) return "";
    const poster = item.poster ? ` poster="${escapeHtml(item.poster)}"` : "";

    return `
      <article class="video-card">
        <video controls playsinline preload="metadata"${poster}>
          <source src="${escapeHtml(item.src)}" type="${videoType(item.src)}" />
          当前浏览器不支持视频播放。
        </video>
      </article>
    `;
  }).join("");
}

function renderFlipbookImage(src, altText, extraClass = "") {
  return `
    <img
      class="flipbook-image ${extraClass}"
      src="${escapeHtml(src)}"
      alt="${escapeHtml(altText)}"
      loading="lazy"
    />
  `;
}

function buildFlipbookPages() {
  const album = config.flipAlbum || {};
  const photos = (album.pages || []).filter(Boolean);
  if (!photos.length) return [];

  const pages = [
    { type: "cover", src: album.cover || photos[0], alt: "16 的翻页相册封面" },
    ...photos.map((src, index) => ({
      type: "photo",
      src,
      alt: `16 的成长照片 ${index + 1}`
    }))
  ];

  if (pages.length % 2 !== 0) pages.push({ type: "ending" });
  return pages;
}

function renderFlipbookFace(page = {}, sideClass = "") {
  const type = page.type || (page.src ? "photo" : "blank");
  const classes = `flipbook-face ${sideClass} flipbook-${type}`;

  if (type === "cover") {
    return `
      <div class="${classes}">
        ${renderFlipbookImage(page.src, page.alt || "16 的翻页相册封面", "cover-image")}
        <div class="flipbook-cover-text">
          <span>hello16</span>
          <strong>16 的成长相册</strong>
        </div>
      </div>
    `;
  }

  if (type === "ending" || type === "blank" || !page.src) {
    return `
      <div class="${classes} flipbook-ending">
        <span>hello16</span>
        <strong>慢慢长大</strong>
      </div>
    `;
  }

  return `
    <div class="${classes}">
      ${renderFlipbookImage(page.src, page.alt || "16 的成长照片")}
    </div>
  `;
}

function renderFlipbookPanel(page, side) {
  const action = side === "left" ? "prev" : "next";
  const label = side === "left" ? "往前翻一页" : "往后翻一页";
  const disabled = flipbookIsTurning ||
    (side === "left" && flipbookSpread <= 0) ||
    (side === "right" && flipbookSpread >= flipbookSpreadCount - 1);

  return `
    <button class="flipbook-panel flipbook-panel-${side}" type="button" data-flipbook-action="${action}" aria-label="${label}"${disabled ? " disabled" : ""}>
      ${renderFlipbookFace(page, `flipbook-face-${side}`)}
    </button>
  `;
}

function renderFlipbookSpread(leftPage, rightPage) {
  const spread = $("#flipbookSpread");
  if (!spread) return;

  spread.innerHTML = `
    ${renderFlipbookPanel(leftPage || { type: "blank" }, "left")}
    ${renderFlipbookPanel(rightPage || { type: "blank" }, "right")}
  `;
}

function renderFlipbookTurnPage(frontPage, backPage, direction) {
  const turnPage = $("#flipbookTurnPage");
  if (!turnPage) return;

  turnPage.className = `flipbook-turn-page is-${direction > 0 ? "forward" : "backward"}`;
  turnPage.innerHTML = `
    ${renderFlipbookFace(frontPage || { type: "blank" }, "flipbook-turn-front")}
    ${renderFlipbookFace(backPage || { type: "blank" }, "flipbook-turn-back")}
  `;
}

function renderFlipAlbum() {
  const book = $("#flipbookBook");
  if (!book) return;

  flipbookPages = buildFlipbookPages();
  if (!flipbookPages.length) {
    hideSection("#flipAlbum");
    return;
  }

  flipbookSpread = 0;
  flipbookSpreadCount = Math.ceil(flipbookPages.length / 2);
  book.innerHTML = `
    <div class="flipbook-spread" id="flipbookSpread"></div>
    <div class="flipbook-gutter" aria-hidden="true"></div>
    <div class="flipbook-turn-page" id="flipbookTurnPage" aria-hidden="true"></div>
  `;
  updateFlipbook();
}

function updateFlipbook() {
  const leftPage = flipbookPages[flipbookSpread * 2] || { type: "blank" };
  const rightPage = flipbookPages[flipbookSpread * 2 + 1] || { type: "blank" };
  renderFlipbookSpread(leftPage, rightPage);

  const prevButton = $("#flipbookPrev");
  const nextButton = $("#flipbookNext");
  if (prevButton) prevButton.disabled = flipbookIsTurning || flipbookSpread <= 0;
  if (nextButton) nextButton.disabled = flipbookIsTurning || flipbookSpread >= flipbookSpreadCount - 1;

  syncFlipbookMusicButton();
}

function completeFlipbookTurn(nextSpread) {
  flipbookSpread = nextSpread;
  flipbookIsTurning = false;

  const turnPage = $("#flipbookTurnPage");
  if (turnPage) {
    turnPage.className = "flipbook-turn-page";
    turnPage.innerHTML = "";
  }
  updateFlipbook();
}

function turnFlipbook(direction = 1) {
  if (!flipbookSpreadCount || flipbookIsTurning) return;

  const nextSpread = flipbookSpread + direction;
  if (nextSpread < 0 || nextSpread >= flipbookSpreadCount) return;

  const currentLeft = flipbookPages[flipbookSpread * 2] || { type: "blank" };
  const currentRight = flipbookPages[flipbookSpread * 2 + 1] || { type: "blank" };
  const nextLeft = flipbookPages[nextSpread * 2] || { type: "blank" };
  const nextRight = flipbookPages[nextSpread * 2 + 1] || { type: "blank" };

  flipbookIsTurning = true;

  if (direction > 0) {
    renderFlipbookSpread(currentLeft, nextRight);
    renderFlipbookTurnPage(currentRight, nextLeft, direction);
  } else {
    renderFlipbookSpread(nextLeft, currentRight);
    renderFlipbookTurnPage(currentLeft, nextRight, direction);
  }

  updateFlipbookControlsDuringTurn();
  if ((config.flipAlbum || {}).music && !musicIsPlaying) startFlipbookMusic();
  window.setTimeout(() => completeFlipbookTurn(nextSpread), 860);
}

function updateFlipbookControlsDuringTurn() {
  const prevButton = $("#flipbookPrev");
  const nextButton = $("#flipbookNext");
  if (prevButton) prevButton.disabled = true;
  if (nextButton) nextButton.disabled = true;
}

function syncFlipbookMusicButton() {
  const musicButton = $("#flipbookMusic");
  if (musicButton) musicButton.setAttribute("aria-pressed", String(musicIsPlaying));
}

function playMusicNote() {
  if (!musicContext || !musicGain) return;

  const notes = [261.63, 329.63, 392, 523.25, 392, 329.63];
  const note = notes[musicStep % notes.length];
  const now = musicContext.currentTime;
  const oscillator = musicContext.createOscillator();
  const gain = musicContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(note, now);
  oscillator.connect(gain);
  gain.connect(musicGain);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
  oscillator.start(now);
  oscillator.stop(now + 1.7);
  musicStep += 1;
}

function startFlipbookMusic() {
  if (musicIsPlaying || !(config.flipAlbum || {}).music) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!musicContext) {
    musicContext = new AudioContextClass();
    musicGain = musicContext.createGain();
    musicGain.gain.value = 0.045;
    musicGain.connect(musicContext.destination);
  }

  musicContext.resume();
  playMusicNote();
  musicTimer = window.setInterval(playMusicNote, 950);
  musicIsPlaying = true;
  if (flipbookIsTurning) syncFlipbookMusicButton();
  else updateFlipbook();
}

function stopFlipbookMusic() {
  if (musicTimer) window.clearInterval(musicTimer);
  musicTimer = null;
  musicIsPlaying = false;
  if (flipbookIsTurning) syncFlipbookMusicButton();
  else updateFlipbook();
}

function toggleFlipbookMusic() {
  if (musicIsPlaying) {
    stopFlipbookMusic();
    return;
  }
  startFlipbookMusic();
}

function initFlipAlbum() {
  const book = $("#flipbookBook");
  if (!book) return;

  book.addEventListener("click", (event) => {
    const panel = event.target.closest("[data-flipbook-action]");
    if (!panel) return;
    turnFlipbook(panel.dataset.flipbookAction === "prev" ? -1 : 1);
  });

  book.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      turnFlipbook(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      turnFlipbook(1);
    }
  });

  $("#flipbookPrev")?.addEventListener("click", () => turnFlipbook(-1));
  $("#flipbookNext")?.addEventListener("click", () => turnFlipbook(1));
  $("#flipbookMusic")?.addEventListener("click", toggleFlipbookMusic);
}

function renderBirthday() {
  const item = (config.birthdays || [])[0];
  if (!item) {
    hideSection("#birthday");
    return;
  }
  $("#birthdayCard").innerHTML = `
    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" data-preview />
    <div>
      <span class="birthday-badge">${escapeHtml(item.age)}</span>
      <h2>生日记录</h2>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
      <a class="btn ghost" href="#messages">去看家人留言</a>
    </div>
  `;
}

function renderMessages() {
  const grid = $("#messageGrid");
  const messages = [
    ...visitorMessages,
    ...(config.messages || [])
  ];
  if (!messages.length) {
    hideSection("#messages");
    return;
  }

  grid.innerHTML = messages.map((message) => `
    <article class="message-card">
      <p>“${escapeHtml(message.text)}”</p>
      <strong>—— ${escapeHtml(message.from)}</strong>
    </article>
  `).join("");
}

async function loadUploadedPhotos() {
  try {
    const response = await fetch("/api/photos", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    uploadedPhotos = data.photos || [];
    renderAlbums();
  } catch (error) {
    setStatus("#photoUploadStatus", "照片上传区暂时不可用。", "error");
  }
}

async function loadVisitorMessages() {
  try {
    const response = await fetch("/api/messages", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    visitorMessages = data.messages || [];
    renderMessages();
  } catch (error) {
    setStatus("#messageStatus", "留言板暂时不可用。", "error");
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("照片读取失败。"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

async function compressPhoto(file) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = await canvasToBlob(canvas, IMAGE_QUALITY);
  if (blob && blob.size > MAX_CLIENT_UPLOAD_BYTES) {
    blob = await canvasToBlob(canvas, 0.68);
  }
  if (!blob || blob.size > MAX_CLIENT_UPLOAD_BYTES) {
    throw new Error("照片太大，请换一张小一点的照片。");
  }

  const name = file.name.replace(/\.[^.]+$/, "") || "hello16-photo";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

function initPhotoUpload() {
  const form = $("#photoUploadForm");
  const input = $("#photoInput");
  if (!form || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const files = Array.from(input.files || []);
    if (!files.length) {
      setStatus("#photoUploadStatus", "先选择照片。", "error");
      return;
    }

    const button = form.querySelector("button");
    button.disabled = true;
    setStatus("#photoUploadStatus", `正在上传 ${files.length} 张照片...`);

    try {
      let uploadedCount = 0;
      for (const file of files) {
        const compressed = await compressPhoto(file);
        const body = new FormData();
        body.append("photo", compressed);
        body.append("writeKey", getWriteKey());

        const response = await fetch("/api/photos", {
          method: "POST",
          headers: {
            "x-hello16-key": getWriteKey()
          },
          body
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "上传失败。");

        uploadedPhotos.push(data.photo);
        uploadedCount += 1;
        renderAlbums();
      }

      input.value = "";
      setStatus("#photoUploadStatus", `已上传 ${uploadedCount} 张照片。`, "success");
    } catch (error) {
      setStatus("#photoUploadStatus", error.message || "上传失败。", "error");
    } finally {
      button.disabled = false;
    }
  });
}

function initMessageForm() {
  const form = $("#messageForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    const from = $("#messageFrom").value.trim();
    const text = $("#messageText").value.trim();

    if (!text) {
      setStatus("#messageStatus", "先写一点想说的话。", "error");
      return;
    }

    button.disabled = true;
    setStatus("#messageStatus", "正在提交留言...");

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hello16-key": getWriteKey()
        },
        body: JSON.stringify({
          from,
          text,
          writeKey: getWriteKey()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "留言失败。");

      visitorMessages.unshift(data.message);
      $("#messageText").value = "";
      renderMessages();
      setStatus("#messageStatus", "留言已经放好。", "success");
    } catch (error) {
      setStatus("#messageStatus", error.message || "留言失败。", "error");
    } finally {
      button.disabled = false;
    }
  });
}

function initPhotoClicks() {
  document.body.addEventListener("click", (event) => {
    const img = event.target.closest("img[data-preview]");
    if (!img) return;
    openPhoto(img.getAttribute("src"), img.getAttribute("alt"));
  });
}

function initMenu() {
  const menuBtn = $("#menuBtn");
  const nav = $("#nav");
  menuBtn.addEventListener("click", () => nav.classList.toggle("open"));
  $$(".nav a").forEach((link) => {
    link.addEventListener("click", () => nav.classList.remove("open"));
  });
}

initBasics();
initLock();
initDialog();
renderTimeline();
renderAlbums();
renderFlipAlbum();
renderVideos();
renderBirthday();
renderMessages();
loadUploadedPhotos();
loadVisitorMessages();
initPhotoClicks();
initMenu();
initFlipAlbum();
initPhotoUpload();
initMessageForm();
