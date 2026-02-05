import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import mysql from "mysql2/promise";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const PORT = Number(process.env.WS_PORT ?? "3001");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env vars");
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const rooms = new Map();

function getRoom(pid) {
  if (!rooms.has(pid)) rooms.set(pid, new Set());
  return rooms.get(pid);
}

function broadcast(pid, payload) {
  const room = rooms.get(pid);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

async function requireProjectAdmin(token, pid) {
  const decoded = await admin.auth().verifyIdToken(token);
  const docId = `${pid}_${decoded.uid}`;
  const snap = await admin.firestore().collection("project_members").doc(docId).get();
  const role = snap.exists ? snap.data()?.role : undefined;
  if (role !== "admin") {
    throw new Error("Project admin only");
  }
  return decoded.uid;
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", async (ws, req) => {
  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token") ?? "";
    const pid = url.searchParams.get("projectId") ?? "";
    if (!token || !pid) {
      ws.close(1008, "Missing token or projectId");
      return;
    }

    const uid = await requireProjectAdmin(token, pid);
    ws.userId = uid;
    ws.projectId = pid;

    const room = getRoom(pid);
    room.add(ws);

    ws.on("close", () => {
      room.delete(ws);
      if (room.size === 0) rooms.delete(pid);
    });

    ws.on("message", async (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!payload || payload.projectId !== pid) return;

      if (payload.type === "message") {
        const text = String(payload.text ?? "").trim();
        if (!text) return;
        const priority = payload.priority ?? "normal";
        const attachmentUrl = payload.attachmentUrl ?? null;
        const attachmentName = payload.attachmentName ?? null;

        const [result] = await pool.execute(
          "INSERT INTO project_admin_chat (project_id, sender_id, text, attachment_url, attachment_name, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
          [pid, uid, text, attachmentUrl, attachmentName, priority]
        );

        const id = String(result.insertId ?? Date.now());
        const message = {
          id,
          senderId: uid,
          text,
          createdAt: new Date().toISOString(),
          attachmentUrl,
          attachmentName,
          priority,
          clientId: payload.clientId ?? null,
          tempId: payload.clientId ?? null,
        };

        broadcast(pid, { type: "message", message });
        return;
      }

      if (payload.type === "reaction") {
        const messageId = String(payload.messageId ?? "");
        const emoji = String(payload.emoji ?? "").trim();
        if (!messageId || !emoji) return;

        const [existing] = await pool.execute(
          "SELECT id FROM project_admin_chat_reactions WHERE project_id = ? AND message_id = ? AND sender_id = ? AND emoji = ? LIMIT 1",
          [pid, messageId, uid, emoji]
        );

        let action = "added";
        if (existing.length > 0) {
          await pool.execute(
            "DELETE FROM project_admin_chat_reactions WHERE project_id = ? AND message_id = ? AND sender_id = ? AND emoji = ?",
            [pid, messageId, uid, emoji]
          );
          action = "removed";
        } else {
          await pool.execute(
            "INSERT INTO project_admin_chat_reactions (project_id, message_id, sender_id, emoji, created_at) VALUES (?, ?, ?, ?, NOW())",
            [pid, messageId, uid, emoji]
          );
        }

        broadcast(pid, { type: "reaction", messageId, emoji, action, userId: uid });
        return;
      }

      if (payload.type === "pin") {
        const messageId = String(payload.messageId ?? "");
        if (!messageId) return;

        const [existing] = await pool.execute(
          "SELECT message_id FROM project_admin_chat_pins WHERE project_id = ? AND message_id = ? LIMIT 1",
          [pid, messageId]
        );

        let action = "pinned";
        if (existing.length > 0) {
          await pool.execute(
            "DELETE FROM project_admin_chat_pins WHERE project_id = ? AND message_id = ?",
            [pid, messageId]
          );
          action = "unpinned";
        } else {
          await pool.execute(
            "INSERT INTO project_admin_chat_pins (project_id, message_id, pinned_by, created_at) VALUES (?, ?, ?, NOW())",
            [pid, messageId, uid]
          );
        }

        broadcast(pid, { type: "pin", messageId, action, userId: uid });
        return;
      }

      if (payload.type === "read") {
        const messageId = String(payload.messageId ?? "");
        if (!messageId) return;
        const readUserId = (process.env.NODE_ENV !== "production" && payload.testUserId) ? String(payload.testUserId) : uid;

        await pool.execute(
          "INSERT INTO project_admin_chat_reads (project_id, message_id, user_id, read_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)",
          [pid, messageId, readUserId]
        );

        const [rows] = await pool.execute(
          "SELECT COUNT(DISTINCT r.user_id) as count FROM project_admin_chat_reads r JOIN project_admin_chat m ON m.id = r.message_id WHERE r.project_id = ? AND r.message_id = ? AND r.user_id <> m.sender_id",
          [pid, messageId]
        );
        const count = Number(rows?.[0]?.count ?? 0);
        broadcast(pid, { type: "read", messageId, count, userId: readUserId });
        return;
      }
      if (payload.type === "typing") {
        broadcast(pid, { type: "typing", userId: uid, isTyping: !!payload.isTyping });
      }
    });
  } catch (e) {
    ws.close(1008, "Unauthorized");
  }
});

console.log(`WS server running on :${PORT}`);