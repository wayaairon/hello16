import { list, put } from "@vercel/blob";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const PHOTO_PREFIX = "uploads/";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function expectedWriteKey() {
  return process.env.HELLO16_WRITE_KEY || "";
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.HELLO16_BLOB_READ_WRITE_TOKEN || "";
}

function isAuthorized(request, bodyKey = "") {
  const expected = expectedWriteKey();
  if (!expected) return false;
  const headerKey = request.headers.get("x-hello16-key") || "";
  return (bodyKey || headerKey) === expected;
}

function safeExtension(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

async function listAllUploadedPhotos() {
  const photos = [];
  let cursor;

  do {
    const page = await list({
      prefix: PHOTO_PREFIX,
      limit: 1000,
      cursor,
      token: blobToken()
    });

    photos.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);

  return photos
    .sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt))
    .map((photo) => ({
      url: photo.url,
      pathname: photo.pathname,
      uploadedAt: photo.uploadedAt
    }));
}

export async function GET() {
  try {
    const photos = await listAllUploadedPhotos();
    return json({ photos, storageReady: true });
  } catch (error) {
    return json({
      photos: [],
      storageReady: false,
      error: "照片存储还没有配置好。"
    });
  }
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const photo = form.get("photo");

    if (!blobToken()) {
      return json({ error: "Blob 读写 token 还没有配置。" }, 503);
    }

    if (!expectedWriteKey()) {
      return json({ error: "上传口令还没有配置。" }, 503);
    }

    if (!isAuthorized(request, form.get("writeKey"))) {
      return json({ error: "没有上传权限。" }, 401);
    }

    if (!photo || typeof photo === "string") {
      return json({ error: "请选择一张照片。" }, 400);
    }

    if (!ALLOWED_TYPES.has(photo.type)) {
      return json({ error: "只支持 JPG、PNG 或 WebP 图片。" }, 400);
    }

    if (photo.size > MAX_UPLOAD_BYTES) {
      return json({ error: "照片太大，请压缩到 4MB 以内再上传。" }, 400);
    }

    const date = new Date().toISOString().slice(0, 10);
    const ext = safeExtension(photo.type);
    const pathname = `${PHOTO_PREFIX}${date}/${Date.now()}-${randomId()}.${ext}`;
    const blob = await put(pathname, photo, {
      access: "public",
      addRandomSuffix: true,
      token: blobToken()
    });

    return json({
      photo: {
        url: blob.url,
        pathname: blob.pathname
      }
    }, 201);
  } catch (error) {
    return json({
      error: "照片上传失败，请确认 Vercel Blob 已经配置。"
    }, 500);
  }
}
