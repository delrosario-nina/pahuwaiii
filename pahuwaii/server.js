//imports
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());              //cors is needed for local testing with live server extension 
app.use(express.json());      // for parsing application/json

// serve static frontend from "public" folder
app.use(express.static(path.join(__dirname, "public")));

//create a database
const db = new sqlite3.Database("todo.db", (err) => {
  if (err) {
    console.error("Failed to open DB:", err.message);
    process.exit(1);
  }
});


db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE IF NOT EXISTS recovery_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      recovery_question_id INTEGER NOT NULL,
      recovery_answer TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(recovery_question_id) REFERENCES recovery_questions(id)
    )
  `);
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
      user_id INTEGER
    )
  `);

  // Seed questions if empty
  db.all("SELECT COUNT(*) as cnt FROM recovery_questions", (err, rows) => {
    if (!err && rows[0].cnt === 0) {
      const questions = [
        "What is your favorite color?",
        "What is your mother's maiden name?",
        "What was the name of your first pet?",
        "What city were you born in?",
        "What is your favorite food?"
      ];
      questions.forEach(q => {
        db.run("INSERT INTO recovery_questions (question) VALUES (?)", [q]);
      });
    }
  });
});

// Endpoint to get all recovery questions
app.get("/recovery-questions", (req, res) => {
  db.all("SELECT id, question FROM recovery_questions", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ========== USER REGISTRATION ==========
app.post("/register", async (req, res) => {
  const { email, password, recovery_question_id, recovery_answer } = req.body;
  if (!email || !password || !recovery_question_id || !recovery_answer)
    return res.status(400).json({ error: "Missing fields" });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(recovery_answer, 10);
    db.run(
      `INSERT INTO users (email, password, recovery_question_id, recovery_answer) VALUES (?, ?, ?, ?)`,
      [email, hashedPassword, recovery_question_id, hashedAnswer],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, email });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PASSWORD RECOVERY ==========
app.post("/recover", async (req, res) => {
  const { email, recovery_answer, new_password } = req.body;
  if (!email || !recovery_answer || !new_password)
    return res.status(400).json({ error: "Missing fields" });

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err || !user)
        return res.status(404).json({ error: "User not found" });

      const match = await bcrypt.compare(recovery_answer, user.recovery_answer);
      if (!match)
        return res.status(401).json({ error: "Incorrect recovery answer" });

      const hashedNewPassword = await bcrypt.hash(new_password, 10);
      db.run(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashedNewPassword, user.id],
        function (updateErr) {
          if (updateErr)
            return res.status(500).json({ error: updateErr.message });
          res.json({ success: true });
        }
      );
    }
  );
});

// Get recovery question for a user by email
app.post("/get-recovery-question", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });
  db.get(
    `SELECT q.question FROM users u JOIN recovery_questions q ON u.recovery_question_id = q.id WHERE u.email = ?`,
    [email],
    (err, row) => {
      if (err || !row)
        return res.status(404).json({ error: "User not found" });
      res.json({ recovery_question: row.question });
    }
  );
});

// ========== API ==========

// get all active tasks (deleted_at IS NULL)
app.get("/tasks", (req, res) => {
  db.all("SELECT * FROM tasks WHERE deleted_at IS NULL", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// get single task
app.get("/tasks/:id", (req, res) => {
  db.get("SELECT * FROM tasks WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Task not found" });
    res.json(row); 
  });
});

// create task
app.post("/tasks", (req, res) => {
  const { name, due_date, due_time, priority, status } = req.body;
  const stmt = db.prepare(
    "INSERT INTO tasks (name, due_date, due_time, priority, status, date_added, deleted_at) VALUES (?, ?, ?, ?, ?, datetime('now'), NULL)"
  );
  stmt.run([name, due_date, due_time, priority, status], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, due_date, due_time, priority, status });
  });
  stmt.finalize(); 
});

// update task 
app.patch("/tasks/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(", ");
  const values = Object.values(updates);
  if (!fields) return res.status(400).json({ error: "No fields to update" });

  db.run(`UPDATE tasks SET ${fields} WHERE id = ?`, [...values, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

// soft delete a task and return the deleted row
app.delete("/tasks/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: "Task not found" });

    db.run("UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?", [id], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message });
      // return the original row for frontend undo
      res.json(task);
    });
  });
});

// undo delete
app.post("/tasks/:id/undo", (req, res) => {
  const { id } = req.params;
  db.run("UPDATE tasks SET deleted_at = NULL WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ restored: this.changes });
  });
});

//for debugging (ma-show sa console)
app.post("/debug", (req, res) => {
  console.log("DEBUG POST body:", req.body);
  res.json({ received: req.body });
});

// fallback to serve index.html for any other route to ensure it stays a single page
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server on PORT env or 3000 by default
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
