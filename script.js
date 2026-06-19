const config = window.HELLO16_CONFIG || {};

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

  if (sessionStorage.getItem("hello16-unlocked") === "yes") {
    lockScreen.classList.add("hidden");
  }

  const unlock = () => {
    if (input.value.trim() === expected) {
      sessionStorage.setItem("hello16-unlocked", "yes");
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
  const photos = config.photos || [];
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
  const messages = config.messages || [];
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
renderBirthday();
renderMessages();
initPhotoClicks();
initMenu();
