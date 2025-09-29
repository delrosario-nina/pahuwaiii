
const API_URL = "/tasks"; // Backend API endpoint

//
const statusOptions = [
  { value: "to do", label: "to do" },
  { value: "in progress", label: "in progress" },
  { value: "done", label: "done" }
];

const priorityColors = {
  "do now": "bg-[#ef8e8e] text-black",
  "do next": "bg-[#F1BA7E] text-black",
  "do later": "bg-[#b6b3e6] text-black",
  "do last": "bg-[#99c2a5] text-black"
};


let allTasks = [];         // holds all tasks from server
let editingTaskId = null;  // tracks task being edited
let deleteIdPending = null; // tracks task pending deletion
let lastDeletedTask = null; // stores deleted task for undo
let undoTimeout = null;     // timeout reference for undo banner

//DOM References
const taskModal = document.getElementById("taskModal");
const showFormBtn = document.getElementById("showFormBtn");
const cancelBtn = document.getElementById("cancelBtn");
const sortBy = document.getElementById("sortBy");

const editTaskModal = document.getElementById("editTaskModal");
const editTaskForm = document.getElementById("editTaskForm");
const cancelEditTaskBtn = document.getElementById("cancelEditTaskBtn");

const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const undoBanner = document.getElementById("undoBanner");
const undoBtn = document.getElementById("undoBtn");

const titleToggle = document.getElementById("titleToggle");

//sort helper function
function loadSortFilter() {
  const savedSort = localStorage.getItem("sortBy") || "date_added";
  sortBy.value = savedSort;
}

//task display
function renderBoard() {
  const sortValue = sortBy.value;
  let tasks = [...allTasks];

  // Sort tasks by selected filter
  if (sortValue === "date_added") {
    tasks.sort((a, b) => new Date(a.date_added) - new Date(b.date_added));
  } else if (sortValue === "due_date") {
    tasks.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
  } else if (sortValue === "priority") {
    const order = { "do now": 1, "do next": 2, "do later": 3, "do last": 4 };
    tasks.sort((a, b) => (order[a.priority] || 99) - (order[b.priority] || 99));
  }

  // Render into columns
  renderColumn("notStartedTasks", tasks.filter(t => t.status === "to do"));
  renderColumn("inProgressTasks", tasks.filter(t => t.status === "in progress"));
  renderColumn("doneTasks", tasks.filter(t => t.status === "done"));

  updateProgress(tasks);
}

function renderColumn(containerId, tasks) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  tasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "bg-white border shadow p-4 mb-1 flex flex-col gap-2 hover:shadow-md transition rounded-md";

    card.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <input type="checkbox" id="cb_${task.id}" ${task.status === "done" ? "checked" : ""} />
          <span class="font-semibold text-lg kanban-title" id="task_name_${task.id}">
            ${escapeHtml(task.name)}
          </span>
        </div>
        <div>
          <button onclick="openEditTaskModal(${task.id})" 
                  class="material-symbols-outlined text-base align-middle ml-1" 
                  title="Edit Task">edit</button>
          <button onclick="confirmDelete(${task.id})" 
                  class="text-red-500 hover:text-red-700 ml-2" 
                  title="Delete">&#128465;</button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs mt-1">
        <input type="date" value="${task.due_date || ''}" 
              class="border p-0.5 text-[10px] rounded w-[7em]"
              onchange="updateTaskField(${task.id}, 'due_date', this.value)" />
        <input type="time" value="${task.due_time || ''}" 
              class="border p-0.5 text-[10px] rounded w-[7em]"
              onchange="updateTaskField(${task.id}, 'due_time', this.value)" />
        <select id="status_sel_${task.id}" 
                class="border p-0.5 text-[10px] rounded bg-[#EAE9ED] text-black"
                onchange="updateTaskField(${task.id}, 'status', this.value)">
          <option value="to do" ${task.status === "to do" ? "selected" : ""}>To Do</option>
          <option value="in progress" ${task.status === "in progress" ? "selected" : ""}>In progress</option>
          <option value="done" ${task.status === "done" ? "selected" : ""}>Done</option>
        </select>
        <select class="border p-0.5 text-[10px] rounded ${priorityColors[task.priority] || 'bg-gray-200 text-black'}"
                onchange="updateTaskField(${task.id}, 'priority', this.value)">
          <option value="do now" ${task.priority === "do now" ? "selected" : ""}>Do Now</option>
          <option value="do next" ${task.priority === "do next" ? "selected" : ""}>Do Next</option>
          <option value="do later" ${task.priority === "do later" ? "selected" : ""}>Do Later</option>
          <option value="do last" ${task.priority === "do last" ? "selected" : ""}>Do Last</option>
        </select>
      </div>
    `;
    container.appendChild(card);

      // checkbox handler
    const cb = document.getElementById(`cb_${task.id}`);
    cb.addEventListener("change", async function () {
    cb.disabled = true;
      const newStatus = cb.checked ? "done" : "to do";
      try {
        await updateStatus(task.id, newStatus);
      } catch (err) {
        cb.checked = !cb.checked;
        alert("Failed to update status: " + err.message);
      } finally {
        cb.disabled = false;
      }
    });
  });
}

//API CALLS
async function loadTasks() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      const errText = await res.text();
      console.error("Failed to load tasks:", errText);
      allTasks = [];
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("Unexpected tasks response:", data);
      allTasks = [];
      return;
    }
    allTasks = data;
    renderBoard();
  } catch (err) {
    console.error("Failed to load tasks:", err);
    allTasks = [];
  }
}

//update status
async function updateStatus(id, status) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Server error");
  }
  await loadTasks();
}

//update any field
async function updateTaskField(id, field, value) {
  await fetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: value })
  });
  await loadTasks();
}

//utility functions
function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
  );
}

//update progress
function updateProgress(tasks) {
  const done = tasks.filter(t => t.status === "done").length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById("progressBar").style.width = percent + "%";
}

//EVENT HANDLERS
// sorting
loadSortFilter();
sortBy.addEventListener("change", function () {
  localStorage.setItem("sortBy", sortBy.value);
  renderBoard();
});

// add task
showFormBtn.addEventListener("click", () => {
  taskModal.classList.remove("hidden");
  setTimeout(() => document.getElementById("name").focus(), 60);
});
cancelBtn.addEventListener("click", () => taskModal.classList.add("hidden"));

// add task submit
document.getElementById("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const due_date = document.getElementById("due_date").value;
  const due_time = document.getElementById("due_time").value;
  const priority = document.getElementById("priority").value;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, due_date, due_time, priority, status: "to do" })
    });
    if (!res.ok) throw new Error("Failed to add task");
    document.getElementById("taskForm").reset();
    taskModal.classList.add("hidden");
    await loadTasks();
  } catch (err) {
    alert("Error adding task: " + err.message);
  }
});

// edit task 
window.openEditTaskModal = function(id) {
  const t = allTasks.find(x => x.id === id);
  if (!t) return;
  editingTaskId = id;
  document.getElementById("edit_name").value = t.name || "";
  document.getElementById("edit_due_date").value = t.due_date || "";
  document.getElementById("edit_due_time").value = t.due_time || "";
  document.getElementById("edit_priority").value = t.priority || "do now";
  document.getElementById("edit_status").value = t.status || "to do";
  editTaskModal.classList.remove("hidden");
  setTimeout(() => document.getElementById("edit_name").focus(), 60);
};

cancelEditTaskBtn.addEventListener("click", () => {
  editTaskModal.classList.add("hidden");
  editingTaskId = null;
});

editTaskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingTaskId) return;

  const name = document.getElementById("edit_name").value;
  const due_date = document.getElementById("edit_due_date").value;
  const due_time = document.getElementById("edit_due_time").value;
  const priority = document.getElementById("edit_priority").value;
  const status = document.getElementById("edit_status").value;

  await fetch(`${API_URL}/${editingTaskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, due_date, due_time, priority, status })
  });

  editTaskModal.classList.add("hidden");
  editingTaskId = null;
  await loadTasks();
});

// delete confirmation 
function confirmDelete(id) {
  deleteIdPending = id;
  deleteModal.classList.remove("hidden");
}
cancelDeleteBtn.addEventListener("click", () => {
  deleteIdPending = null;
  deleteModal.classList.add("hidden");
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!deleteIdPending) return;
  const id = deleteIdPending;
  deleteIdPending = null;
  deleteModal.classList.add("hidden");

  try {
    const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text();
      alert("Delete failed: " + text);
      return;
    }
    try {
      lastDeletedTask = await res.json();
    } catch (e) {
      lastDeletedTask = null;
    }
    await loadTasks();
    if (lastDeletedTask) showUndo();
  } catch (err) {
    alert("Delete failed: " + err.message);
  }
});

// undo 
function showUndo() {
  undoBanner.style.display = "flex";
  clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => {
    undoBanner.style.display = "none";
    lastDeletedTask = null;
  }, 5000);
}
undoBtn.addEventListener("click", async () => {
  if (!lastDeletedTask) return;
  try {
    await fetch(`${API_URL}/${lastDeletedTask.id}/undo`, { method: "POST" });
  } catch (err) {
    alert("Undo failed: " + err.message);
    return;
  }
  lastDeletedTask = null;
  undoBanner.style.display = "none";
  clearTimeout(undoTimeout);
  await loadTasks();
});

// night mode toggle
titleToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});

//INITIALIZATION
loadTasks();