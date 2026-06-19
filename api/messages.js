import { list, put } from "@vercel/blob";

const MESSAGE_PREFIX = "messages/";
const MAX_FROM_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 500;

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

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

async function listAllMessages() {
  const blobs = [];
  let cursor;

  do {
    const page = await list({
      prefix: MESSAGE_PREFIX,
      limit: 1000,
      cursor,
      token: blobToken()
    });

    blobs.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);

  const messages = await Promise.all(
    blobs.map(async (blob) => {
      try {
        const response = await fetch(blob.url, { cache: "no-store" });
        if (!response.ok) return null;
        return await response.json();
      } catch (error) {
        return null;
      }
    })
  );

  return messages
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function GET() {
  try {
    const messages = await listAllMessages();
    return json({ messages, storageReady: true });
  } catch (error) {
    return json({
      messages: [],
      storageReady: false,
      error: "留言存储还没有配置好。"
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!blobToken()) {
      return json({ error: "Blob 读写 token 还没有配置。" }, 503);
    }

    if (!expectedWriteKey()) {
      return json({ error: "留言口令还没有配置。" }, 503);
    }

    if (!isAuthorized(request, body.writeKey)) {
      return json({ error: "没有留言权限。" }, 401);
    }

    const from = cleanText(body.from || "家人").slice(0, MAX_FROM_LENGTH);
    const text = cleanText(body.text || "").slice(0, MAX_MESSAGE_LENGTH);

    if (!text) {
      return json({ error: "请先写一点想对 16 说的话。" }, 400);
    }

    const createdAt = new Date().toISOString();
    const message = {
      id: `${Date.now()}-${randomId()}`,
      from: from || "家人",
      text,
      createdAt
    };
    const pathname = `${MESSAGE_PREFIX}${createdAt.replace(/[:.]/g, "-")}-${message.id}.json`;

    await put(pathname, JSON.stringify(message), {
      access: "public",
      addRandomSuffix: false,
      token: blobToken()
    });

    return json({ message }, 201);
  } catch (error) {
    return json({
      error: "留言失败，请确认 Vercel Blob 已经配置。"
    }, 500);
  }
}
