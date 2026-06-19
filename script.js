const config = window.HELLO16_CONFIG || {};
const MAX_CLIENT_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1800;
const IMAGE_QUALITY = 0.82;

let uploadedPhotos = [];
let visitorMessages = [];

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

  if (sessionStorage.getItem("hello16-unlocked") === "yes") {
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
renderBirthday();
renderMessages();
loadUploadedPhotos();
loadVisitorMessages();
initPhotoClicks();
initMenu();
initPhotoUpload();
initMessageForm();
