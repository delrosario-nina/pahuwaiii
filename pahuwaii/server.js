require("dotenv").config();

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = "supersecret";
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  // Prevent caching of authenticated pages
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  next();
});

// Create database
const db = new sqlite3.Database("todo.db", (err) => {
  if (err) {
    console.error("Failed to open DB:", err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT 'insert bio here',
      profile_picture TEXT DEFAULT 'avatar1.png',
      reset_token TEXT,
      reset_token_expiry INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // COMBINED COLLABORATIVE LISTS TABLE
  // member_ids stores JSON array of user IDs: [1, 2, 3]
  db.run(`
    CREATE TABLE IF NOT EXISTS collab_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      member_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // COLLABORATIVE TASKS TABLE
  db.run(`
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

  // PERSONAL TASKS TABLE
  db.run(`
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
});

// ========== HELPER FUNCTIONS ==========
function addMemberToList(memberIds, userId) {
  const members = JSON.parse(memberIds);
  if (!members.includes(userId)) {
    members.push(userId);
  }
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

// ========== JWT MIDDLEWARE ==========
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

// ========== PERSONAL TASKS API ==========
app.get("/tasks", verifyToken, (req, res) => {
  db.all(
    "SELECT * FROM tasks WHERE deleted_at IS NULL AND user_id = ?",
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get("/tasks/:id", verifyToken, (req, res) => {
  db.get(
    "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
    [req.params.id, req.userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Task not found" });
      res.json(row);
    }
  );
});

app.post("/tasks", verifyToken, (req, res) => {
  const name = req.body.name || req.body.title;
  const { due_date, due_time, priority, status } = req.body;
  if (!name) return res.status(400).json({ error: "Task name required" });

  const stmt = db.prepare(
    "INSERT INTO tasks (name, due_date, due_time, priority, status, date_added, deleted_at, user_id) VALUES (?, ?, ?, ?, ?, datetime('now'), NULL, ?)"
  );
  stmt.run(
    [name, due_date, due_time, priority, status || "to do", req.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: this.lastID,
        name,
        due_date,
        due_time,
        priority,
        status: status || "to do",
      });
    }
  );
  stmt.finalize();
});

app.patch("/tasks/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(", ");
  const values = Object.values(updates);
  if (!fields) return res.status(400).json({ error: "No fields to update" });

  db.run(
    `UPDATE tasks SET ${fields} WHERE id = ? AND user_id = ?`,
    [...values, id, req.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/tasks/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  db.get(
    "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
    [id, req.userId],
    (err, task) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!task) return res.status(404).json({ error: "Task not found" });
      db.run(
        "UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?",
        [id],
        function (deleteErr) {
          if (deleteErr)
            return res.status(500).json({ error: deleteErr.message });
          res.json(task);
        }
      );
    }
  );
});

app.post("/tasks/:id/undo", verifyToken, (req, res) => {
  const { id } = req.params;
  db.run(
    "UPDATE tasks SET deleted_at = NULL WHERE id = ? AND user_id = ?",
    [id, req.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ restored: this.changes });
    }
  );
});

// ========== COLLABORATIVE LISTS API ==========

// Get all collab lists user owns or is a member of
app.get("/collab-lists", verifyToken, (req, res) => {
  db.all(
    `SELECT cl.*, u.name as owner_name
     FROM collab_lists cl
     LEFT JOIN users u ON cl.owner_id = u.id
     WHERE cl.owner_id = ? OR json_array_contains(cl.member_ids, ?)
     ORDER BY cl.created_at DESC`,
    [req.userId, req.userId],
    (err, rows) => {
      if (err) {
        // Fallback if json_array_contains doesn't exist
        db.all(
          `SELECT cl.*, u.name as owner_name
           FROM collab_lists cl
           LEFT JOIN users u ON cl.owner_id = u.id
           ORDER BY cl.created_at DESC`,
          [],
          (err2, allRows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const filtered = allRows.filter(
              (row) =>
                row.owner_id === req.userId ||
                isMember(row.member_ids, req.userId)
            );
            res.json(filtered);
          }
        );
      } else {
        res.json(rows);
      }
    }
  );
});

// Create a new collaborative list
app.post("/collab-lists", verifyToken, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "List name required" });

  // Initialize with owner as first member
  const initialMembers = JSON.stringify([req.userId]);

  db.run(
    "INSERT INTO collab_lists (name, owner_id, member_ids) VALUES (?, ?, ?)",
    [name, req.userId, initialMembers],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: this.lastID,
        name,
        owner_id: req.userId,
        member_ids: initialMembers,
      });
    }
  );
});

// Get members of a collaborative list
app.get("/collab-lists/:id/members", verifyToken, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT member_ids FROM collab_lists WHERE id = ?`,
    [id],
    (err, list) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!list) return res.status(404).json({ error: "List not found" });

      const memberIds = JSON.parse(list.member_ids);
      if (memberIds.length === 0) return res.json([]);

      const placeholders = memberIds.map(() => "?").join(",");
      db.all(
        `SELECT id, name, email, profile_picture, created_at as joined_at
         FROM users
         WHERE id IN (${placeholders})
         ORDER BY id ASC`,
        memberIds,
        (err, users) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(users);
        }
      );
    }
  );
});

// Add member to collaborative list
app.post("/collab-lists/:id/members", verifyToken, (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  // Check if requester owns the list
  db.get(
    "SELECT * FROM collab_lists WHERE id = ? AND owner_id = ?",
    [id, req.userId],
    (err, list) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!list)
        return res.status(403).json({ error: "Only owner can add members" });

      // Find user by email
      db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Check if already a member
        if (isMember(list.member_ids, user.id)) {
          return res.status(400).json({ error: "User already a member" });
        }

        // Add member to array
        const updatedMembers = addMemberToList(list.member_ids, user.id);

        db.run(
          "UPDATE collab_lists SET member_ids = ? WHERE id = ?",
          [updatedMembers, id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, member_ids: updatedMembers });
          }
        );
      });
    }
  );
});

// Remove member from collaborative list
app.delete("/collab-lists/:id/members/:userId", verifyToken, (req, res) => {
  const { id, userId } = req.params;
  const userIdNum = parseInt(userId, 10);

  // Check if requester owns the list
  db.get(
    "SELECT * FROM collab_lists WHERE id = ? AND owner_id = ?",
    [id, req.userId],
    (err, list) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!list)
        return res.status(403).json({ error: "Only owner can remove members" });

      // Can't remove owner
      if (userIdNum === list.owner_id) {
        return res.status(400).json({ error: "Cannot remove owner from list" });
      }

      // Remove member from array
      const updatedMembers = removeMemberFromList(list.member_ids, userIdNum);

      db.run(
        "UPDATE collab_lists SET member_ids = ? WHERE id = ?",
        [updatedMembers, id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, member_ids: updatedMembers });
        }
      );
    }
  );
});

// Get tasks for a collaborative list
app.get("/collab-lists/:id/tasks", verifyToken, (req, res) => {
  const { id } = req.params;

  // Verify user is a member
  db.get(
    "SELECT member_ids FROM collab_lists WHERE id = ?",
    [id],
    (err, list) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!list) return res.status(404).json({ error: "List not found" });
      if (!isMember(list.member_ids, req.userId)) {
        return res.status(403).json({ error: "Not a member" });
      }

      db.all(
        "SELECT * FROM collab_tasks WHERE list_id = ? AND deleted_at IS NULL ORDER BY date_added ASC",
        [id],
        (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(rows);
        }
      );
    }
  );
});

// Create task in collaborative list
app.post("/collab-lists/:id/tasks", verifyToken, (req, res) => {
  const { id } = req.params;
  const name = req.body.name || req.body.title;
  const { due_date, due_time, priority, status } = req.body;

  if (!name) return res.status(400).json({ error: "Task name required" });

  // Verify user is a member
  db.get(
    "SELECT member_ids FROM collab_lists WHERE id = ?",
    [id],
    (err, list) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!list) return res.status(404).json({ error: "List not found" });
      if (!isMember(list.member_ids, req.userId)) {
        return res.status(403).json({ error: "Not a member" });
      }

      db.run(
        "INSERT INTO collab_tasks (name, due_date, due_time, priority, status, list_id, created_by, date_added) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        [name, due_date, due_time, priority, status || "to do", id, req.userId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({
            id: this.lastID,
            name,
            due_date,
            due_time,
            priority,
            status: status || "to do",
            list_id: id,
          });
        }
      );
    }
  );
});

// Update collaborative task
app.patch("/collab-tasks/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Verify user is a member of the list
  db.get(
    `SELECT ct.*, cl.member_ids 
     FROM collab_tasks ct
     JOIN collab_lists cl ON ct.list_id = cl.id
     WHERE ct.id = ?`,
    [id],
    (err, task) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (!isMember(task.member_ids, req.userId)) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const fields = Object.keys(updates)
        .map((k) => `${k} = ?`)
        .join(", ");
      const values = Object.values(updates);

      db.run(
        `UPDATE collab_tasks SET ${fields} WHERE id = ?`,
        [...values, id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ updated: this.changes });
        }
      );
    }
  );
});

// Delete collaborative task
app.delete("/collab-tasks/:id", verifyToken, (req, res) => {
  const { id } = req.params;

  // Verify user is a member
  db.get(
    `SELECT ct.*, cl.member_ids 
     FROM collab_tasks ct
     JOIN collab_lists cl ON ct.list_id = cl.id
     WHERE ct.id = ?`,
    [id],
    (err, task) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (!isMember(task.member_ids, req.userId)) {
        return res.status(403).json({ error: "Not authorized" });
      }

      db.run(
        "UPDATE collab_tasks SET deleted_at = datetime('now') WHERE id = ?",
        [id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json(task);
        }
      );
    }
  );
});

// ========== USER AUTHENTICATION ==========

app.post("/signup", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (user) return res.status(409).json({ error: "Email already in use" });

    const hashed = await bcrypt.hash(password, 10);
    db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashed],
      function (insertErr) {
        if (insertErr)
          return res.status(500).json({ error: insertErr.message });
        res.json({ id: this.lastID, name, email });
      }
    );
  });
});

app.post("/login", (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: "Please fill in all fields" });
  }

  db.get("SELECT * FROM users WHERE name = ?", [name], async (err, user) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!user) return res.status(404).json({ error: "No such account found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    const token = jwt.sign({ user_id: user.id }, JWT_SECRET, {
      expiresIn: "1d",
    });
    res.json({
      message: "Login successful",
      token,
      user_id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      profile_picture: user.profile_picture,
    });
  });
});

app.get("/profile", verifyToken, (req, res) => {
  db.get(
    "SELECT name, email, bio, profile_picture FROM users WHERE id = ?",
    [req.userId],
    (err, user) => {
      if (err || !user)
        return res.status(404).json({ error: "User not found" });
      res.json(user);
    }
  );
});

app.patch("/profile", verifyToken, (req, res) => {
  const { name, email, bio, profile_picture } = req.body;
  let fields = [];
  let values = [];

  if (name !== undefined) {
    fields.push("name = ?");
    values.push(name);
  }
  if (email !== undefined) {
    fields.push("email = ?");
    values.push(email);
  }
  if (bio !== undefined) {
    fields.push("bio = ?");
    values.push(bio);
  }
  if (profile_picture !== undefined) {
    fields.push("profile_picture = ?");
    values.push(profile_picture);
  }

  if (!fields.length)
    return res.status(400).json({ error: "No fields to update" });

  values.push(req.userId);
  db.run(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    values,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

app.patch("/profile/password", verifyToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Missing old or new password" });
  }

  db.get(
    "SELECT password FROM users WHERE id = ?",
    [req.userId],
    async (err, user) => {
      if (err || !user)
        return res.status(500).json({ error: "User not found" });

      const match = await bcrypt.compare(oldPassword, user.password);
      if (!match)
        return res.status(401).json({ error: "Old password incorrect" });

      const hashed = await bcrypt.hash(newPassword, 10);
      db.run(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashed, req.userId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Password updated successfully" });
        }
      );
    }
  );
});

// Password reset endpoints
app.post("/request-reset", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err || !user) return res.status(404).json({ error: "User not found" });

    const token = require("crypto").randomBytes(32).toString("hex");
    const expiry = Date.now() + 1000 * 60 * 15;

    db.run(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?",
      [token, expiry, email]
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: "ninacloudia29@gmail.com",
      to: email,
      subject: "Pahuwaii Password Reset",
      text: `Click this link to reset your password: http://localhost:3000/auth.html?token=${token}`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) return res.status(500).json({ error: "Failed to send email" });
      res.json({ success: true, message: "Reset link sent to email" });
    });
  });
});

app.post("/reset-password", async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password)
    return res.status(400).json({ error: "Missing fields" });

  db.get(
    "SELECT * FROM users WHERE reset_token = ?",
    [token],
    async (err, user) => {
      if (err || !user || user.reset_token_expiry < Date.now()) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      const hashed = await bcrypt.hash(new_password, 10);
      db.run(
        "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
        [hashed, user.id]
      );
      res.json({ success: true });
    }
  );
});

app.delete("/delete-account", verifyToken, (req, res) => {
  db.run("DELETE FROM users WHERE id = ?", [req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0)
      return res.status(404).json({ error: "User not found" });
    res.json({ success: true, deleted: this.changes });
  });
});

app.post("/debug", (req, res) => {
  console.log("DEBUG POST body:", req.body);
  res.json({ received: req.body });
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
