//imports
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = "supersecret";
const nodemailer = require("nodemailer"); //



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
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      reset_token TEXT,
      reset_token_expiry INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
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



//
//No need to anything before this code nina >:(
//




//For signup (error checking bcoz its a bitch)
app.post("/signup", (req, res) => {
  const { name, email, password } = req.body;
  console.log("Signup request:", req.body);

  if (!name || !email || !password) {
    console.log("Missing fields");
    return res.status(400).json({ error: "Missing fields" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: err.message });
    }
    if (user) {
      console.log("Email already exists:", email);
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 10);
    console.log("Hashed password:", hashed);

    db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashed],
      function (insertErr) {
        if (insertErr) {
          console.error("Insert error:", insertErr);
          return res.status(500).json({ error: insertErr.message });
        }
        console.log("User inserted successfully:", name);
        res.json({ id: this.lastID, name, email });
      }
    );
  });
});



// For login
app.post("/login", (req, res) => {
  const { name, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE name = ?",
    [name],
    async (err, user) => {
      if (err || !user) return res.status(401).json({ error: "Invalid credentials" });
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });
      // Issue JWT
      const token = jwt.sign({ user_id: user.id }, JWT_SECRET, { expiresIn: "1d" });
      res.json({ token, name: user.name, email: user.email });
    }
  );
});


//Getting data to display for the profile
app.get("/profile", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });
  const token = authHeader.split(" ")[1];
  let userId;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    userId = decoded.user_id;
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
  db.get("SELECT name, email FROM users WHERE id = ?", [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });
});


// Editing the profile
app.patch("/profile", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });
  const token = authHeader.split(" ")[1];
  let userId;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    userId = decoded.user_id;
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { name, email, password } = req.body;
  let fields = [];
  let values = [];
  if (name) { fields.push("name = ?"); values.push(name); }
  if (email) { fields.push("email = ?"); values.push(email); }
  if (password) {
    bcrypt.hash(password, 10, (err, hashed) => {
      if (err) return res.status(500).json({ error: err.message });
      fields.push("password = ?"); values.push(hashed);
      values.push(userId);
      db.run(
        `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
        values,
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ updated: this.changes });
        }
      );
    });
    return;
  }
  if (!fields.length) return res.status(400).json({ error: "No fields to update" });
  values.push(userId);
  db.run(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    values,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});


// Request password reset
app.post("/request-reset", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err || !user) return res.status(404).json({ error: "User not found" });
    const token = require("crypto").randomBytes(32).toString("hex");
    const expiry = Date.now() + 1000 * 60 * 15; // 15 minutes
    db.run("UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?", [token, expiry, email]);
    // Send email with token link
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "nedelrosario@up.edu.ph",
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });
    const mailOptions = {
      from: "nedelrosario@up.edu.ph",
      to: email,
      subject: "Pahuwaii Password Reset",
      text: `Click this link to reset your password: http://localhost:3000/auth.html?token=${token}`
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to send email" });
      }
      res.json({ success: true, message: "Reset link sent to email" });
    });
  });
});

// Reset password
app.post("/reset-password", async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ error: "Missing fields" });
  db.get("SELECT * FROM users WHERE reset_token = ?", [token], async (err, user) => {
    if (err || !user || user.reset_token_expiry < Date.now())
      return res.status(400).json({ error: "Invalid or expired token" });
    const hashed = await bcrypt.hash(new_password, 10);
    db.run("UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?", [hashed, user.id]);
    res.json({ success: true });
  });
});

// fallback to serve index.html for any other route to ensure it stays a single page
// Start server on PORT env or 3000 by default
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running!`);
  console.log(`Login/Signup: http://localhost:${PORT}/auth.html`);
  console.log(`To-Do List:   http://localhost:${PORT}/index.html`);
});
