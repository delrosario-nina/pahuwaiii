// server.js (complete, ready-to-run)
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");


const app = express();
app.use(cors());
app.use(express.json());

// serve static frontend from "public" folder
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("todo.db", (err) => {
  if (err) {
    console.error("Failed to open DB:", err.message);
    process.exit(1);
  }
});

// Ensure the deleted_at column exists (safe on restart)
db.serialize(() => {
  db.all("PRAGMA table_info(tasks);", [], (err, columns) => {
    if (err) {
      console.error("Error checking table info:", err.message);
      return;
    }
    const hasDeletedAt = columns.some((col) => col.name === "deleted_at");
    if (!hasDeletedAt) {
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          due_date TEXT,
          due_time TEXT,
          priority TEXT,
          status TEXT,
          date_added TEXT DEFAULT (datetime('now')),
          deleted_at TEXT
        )
      `);
    }
  });
});

// ========== API ==========

// Get all active tasks (not soft-deleted)
app.get("/tasks", (req, res) => {
  db.all("SELECT * FROM tasks WHERE deleted_at IS NULL", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get single task
app.get("/tasks/:id", (req, res) => {
  db.get("SELECT * FROM tasks WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Task not found" });
    res.json(row);
  });
});

// Create task
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

// Patch task
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

// Soft delete a task and return the deleted row
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

// Undo delete
app.post("/tasks/:id/undo", (req, res) => {
  const { id } = req.params;
  db.run("UPDATE tasks SET deleted_at = NULL WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ restored: this.changes });
  });
});

app.post("/debug", (req, res) => {
  console.log("DEBUG POST body:", req.body);
  res.json({ received: req.body });
});

// Fallback: let express.static serve index.html at /
// (No extra route needed. If you want a forced fallback for SPA routing:)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server on PORT env or 3000 by default
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
