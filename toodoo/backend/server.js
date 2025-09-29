const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("todo.db");

// Ensure the deleted_at column exists
db.serialize(() => {
  db.all("PRAGMA table_info(tasks);", [], (err, columns) => {
    if (err) {
      console.error("Error checking table info:", err.message);
      return;
    }
    const hasDeletedAt = columns.some((col) => col.name === "deleted_at");
    if (!hasDeletedAt) {
      db.run("ALTER TABLE tasks ADD COLUMN deleted_at TEXT", [], (alterErr) => {
        if (alterErr) {
          console.error("Error adding deleted_at column:", alterErr.message);
        } else {
          console.log("✅ Added deleted_at column to tasks table");
        }
      });
    }
  });
});

// Get all active tasks (exclude soft-deleted)
app.get("/tasks", (req, res) => {
  db.all("SELECT * FROM tasks WHERE deleted_at IS NULL", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add a task
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

// Update a task
app.patch("/tasks/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(updates);

  db.run(
    `UPDATE tasks SET ${fields} WHERE id = ?`,
    [...values, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

// Soft delete a task
app.delete("/tasks/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: "Task not found" });

    db.run(
      "UPDATE tasks SET deleted_at = datetime('now') WHERE id = ?",
      [id],
      function (deleteErr) {
        if (deleteErr) return res.status(500).json({ error: deleteErr.message });
        res.json(task); // return deleted task so frontend can undo
      }
    );
  });
});

// Undo delete (restore task)
app.post("/tasks/:id/undo", (req, res) => {
  const { id } = req.params;
  db.run("UPDATE tasks SET deleted_at = NULL WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ restored: this.changes });
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});