require("dotenv").config();

const express = require("express");
const { createClient } = require("@libsql/client");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Initialize Turso client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize database tables
async function initDatabase() {
  try {
    await db.execute("PRAGMA foreign_keys = ON");

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        bio TEXT NOT NULL DEFAULT 'insert bio here',
        profile_picture TEXT DEFAULT 'profile-icons/user-modified.png',
        reset_token TEXT,
        reset_token_expiry INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS collab_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        member_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS collab_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        due_date TEXT,
        due_time TEXT,
        priority TEXT,
        status TEXT,
        date_added TEXT DEFAULT (datetime('now')),
        deleted_at TEXT,
        list_id INTEGER NOT NULL,
        created_by INTEGER,
        FOREIGN KEY (list_id) REFERENCES collab_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        due_date TEXT,
        due_time TEXT,
        priority TEXT,
        status TEXT,
        date_added TEXT DEFAULT (datetime('now')),
        deleted_at TEXT,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log("✅ Database tables initialized");
  } catch (err) {
    console.error("❌ Failed to initialize database:", err.message);
    process.exit(1);
  }
}

initDatabase();

// Helper functions
function addMemberToList(memberIds, userId) {
  const members = JSON.parse(memberIds);
  if (!members.includes(userId)) members.push(userId);
  return JSON.stringify(members);
}

function removeMemberFromList(memberIds, userId) {
  const members = JSON.parse(memberIds);
  return JSON.stringify(members.filter((id) => id !== userId));
}

function isMember(memberIds, userId) {
  const members = JSON.parse(memberIds);
  return members.includes(userId);
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.user_id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
// PERSONAL TASKS API
app.get("/tasks", verifyToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM tasks WHERE deleted_at IS NULL AND user_id = ?",
      args: [req.userId],
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/tasks", verifyToken, async (req, res) => {
  const name = req.body.name || req.body.title;
  const { due_date, due_time, priority, status } = req.body;
  if (!name) return res.status(400).json({ error: "Task name required" });

  try {
    const result = await db.execute({
      sql: `INSERT INTO tasks (name, due_date, due_time, priority, status, date_added, deleted_at, user_id) 
            VALUES (?, ?, ?, ?, ?, datetime('now'), NULL, ?)`,
      args: [name, due_date, due_time, priority, status || "to do", req.userId],
    });
    res.json({
      id: result.lastInsertRowid,
      name, due_date, due_time, priority,
      status: status || "to do",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/tasks/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(updates);
  
  if (!fields) return res.status(400).json({ error: "No fields to update" });

  try {
    const result = await db.execute({
      sql: `UPDATE tasks SET ${fields} WHERE id = ? AND user_id = ?`,
      args: [...values, id, req.userId],
    });
    res.json({ updated: result.rowsAffected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/tasks/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const taskResult = await db.execute({
      sql: "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
      args: [id, req.userId],
    });
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    await db.execute({
      sql: "UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?",
      args: [id],
    });
    
    res.json(taskResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/tasks/:id/undo", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute({
      sql: "UPDATE tasks SET deleted_at = NULL WHERE id = ? AND user_id = ?",
      args: [id, req.userId],
    });
    res.json({ restored: result.rowsAffected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// USER AUTHENTICATION
app.post("/signup", async (req, res) => {
  const { name, email, password, confirm_password } = req.body;
  if (!name || !email || !password || !confirm_password) {
    return res.status(400).json({ error: "Please fill in all fields" });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ error: "✘ Passwords don't match" });
  }
  
  try {
    const userResult = await db.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });
    
    if (userResult.rows.length > 0) {
      return res.status(409).json({ error: "✘ Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const defaultProfilePic = "profile-icons/user-modified.png";

    const result = await db.execute({
      sql: "INSERT INTO users (name, email, password, profile_picture) VALUES (?, ?, ?, ?)",
      args: [name, email, hashed, defaultProfilePic],
    });
    
    const userId = result.lastInsertRowid;
    const token = jwt.sign({ user_id: userId }, JWT_SECRET, { expiresIn: "7d" });
    
    res.json({
      token, user_id: userId, name, email,
      bio: "insert bio here",
      profile_picture: defaultProfilePic,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Please fill in all fields" });
  }

  try {
    const userResult = await db.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Email not found (。_。;)" });
    }

    const user = userResult.rows[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) return res.status(401).json({ error: "Sorry! Wrong password (。_。;)" });

    const token = jwt.sign({ user_id: user.id }, JWT_SECRET, { expiresIn: "1d" });
    
    res.json({
      message: "Login successful",
      token, user_id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      profile_picture: user.profile_picture,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/profile", verifyToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT name, email, bio, profile_picture FROM users WHERE id = ?",
      args: [req.userId],
    });
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/profile", verifyToken, async (req, res) => {
  const { name, email, bio, profile_picture } = req.body;
  let fields = [];
  let values = [];

  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (email !== undefined) { fields.push("email = ?"); values.push(email); }
  if (bio !== undefined) { fields.push("bio = ?"); values.push(bio); }
  if (profile_picture !== undefined) { fields.push("profile_picture = ?"); values.push(profile_picture); }

  if (!fields.length) return res.status(400).json({ error: "No fields to update" });

  values.push(req.userId);
  
  try {
    const result = await db.execute({
      sql: `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      args: values,
    });
    res.json({ updated: result.rowsAffected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/delete-account", verifyToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [req.userId],
    });
    
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true, deleted: result.rowsAffected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});