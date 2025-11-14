const API_URL = "/tasks";

const statusOptions = [
  { value: "to do", label: "to do" },
  { value: "in progress", label: "in progress" },
  { value: "done", label: "done" },
];

const priorityColors = {
  "do now": "bg-[#ef8e8e] text-black",
  "do next": "bg-[#F1BA7E] text-black",
  "do later": "bg-[#b6b3e6] text-black",
  "do last": "bg-[#99c2a5] text-black",
};

let allTasks = [];
let editingTaskId = null;
let deleteIdPending = null;
let lastDeletedTask = null;
let undoTimeout = null;

let authToken = localStorage.getItem("authToken") || null;
let currentUser = null;

// Helper function to get auth headers with JWT token
function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

// DOM elements - will be initialized after DOM loads
let taskModal;
let showFormBtn;
let cancelBtn;
let sortBy;
let editTaskModal;
let editTaskForm;
let cancelEditTaskBtn;
let deleteModal;
let confirmDeleteBtn;
let cancelDeleteBtn;
let undoBanner;
let undoBtn;
let titleToggle;
let showViewBtn;

// --- Kanban Board Rendering ---
function loadSortFilter() {
  if (sortBy) sortBy.value = localStorage.getItem("sortBy") || "date_added";
}

//task display
function renderBoard() {
  const sortValue = sortBy ? sortBy.value : "date_added";
  let tasks = [...allTasks];

  // sort tasks first by selected filter
  if (sortValue === "date_added") {
    tasks.sort((a, b) => new Date(a.date_added) - new Date(b.date_added)); //oldest first
  } else if (sortValue === "due_date") {
    tasks.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0)); //earliest first
  } else if (sortValue === "priority") {
    const order = { "do now": 1, "do next": 2, "do later": 3, "do last": 4 }; //assign values to make it nominal
    tasks.sort((a, b) => (order[a.priority] || 99) - (order[b.priority] || 99)); //highest priority first
  }

  // then, render into columns
  renderColumn(
    "notStartedTasks",
    tasks.filter((t) => t.status === "to do")
  );
  renderColumn(
    "inProgressTasks",
    tasks.filter((t) => t.status === "in progress")
  );
  renderColumn(
    "doneTasks",
    tasks.filter((t) => t.status === "done")
  );

  updateProgress(tasks);
}

function renderColumn(containerId, tasks) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className =
      "bg-white border shadow p-4 mb-1 flex flex-col gap-2 hover:shadow-md transition rounded-md";

    card.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <input type="checkbox" id="cb_${task.id}" ${
      task.status === "done" ? "checked" : ""
    } />
          <span class="font-semibold text-lg kanban-title" id="task_name_${
            task.id
          }">
          <span class="text-xs text-gray-500" id="task_date_${task.id}">
            ${
              task.date_added
                ? new Date(task.date_added).toLocaleDateString()
                : "Unknown"
            }
          </span>
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
        <input type="date" value="${task.due_date || ""}" 
              class="border p-0.5 text-[10px] rounded w-[7em]"
              onchange="updateTaskField(${task.id}, 'due_date', this.value)" />
        <input type="time" value="${task.due_time || ""}" 
              class="border p-0.5 text-[10px] rounded w-[7em]"
              onchange="updateTaskField(${task.id}, 'due_time', this.value)" />
        <select id="status_sel_${task.id}" 
                class="border p-0.5 text-[10px] rounded bg-[#EAE9ED] text-black"
                onchange="updateTaskField(${task.id}, 'status', this.value)">
          <option value="to do" ${
            task.status === "to do" ? "selected" : ""
          }>To Do</option>
          <option value="in progress" ${
            task.status === "in progress" ? "selected" : ""
          }>In progress</option>
          <option value="done" ${
            task.status === "done" ? "selected" : ""
          }>Done</option>
        </select>
        <select class="border p-0.5 text-[10px] rounded ${
          priorityColors[task.priority] || "bg-gray-200 text-black"
        }"
                onchange="updateTaskField(${task.id}, 'priority', this.value)">
          <option value="do now" ${
            task.priority === "do now" ? "selected" : ""
          }>Do Now</option>
          <option value="do next" ${
            task.priority === "do next" ? "selected" : ""
          }>Do Next</option>
          <option value="do later" ${
            task.priority === "do later" ? "selected" : ""
          }>Do Later</option>
          <option value="do last" ${
            task.priority === "do last" ? "selected" : ""
          }>Do Last</option>
        </select>
      </div>
    `;
    container.appendChild(card);

    // checkbox handler
    const cb = document.getElementById(`cb_${task.id}`);
    if (cb) {
      cb.addEventListener("change", async function () {
        cb.disabled = true;
        const newStatus = cb.checked ? "done" : "to do"; //done if checked and to-do if not checked
        try {
          await updateStatus(task.id, newStatus);
        } catch (err) {
          cb.checked = !cb.checked;
          alert("Failed to update status: " + err.message);
        } finally {
          cb.disabled = false;
        }
      });
    }
  });
}

//API CALLS
//get tasks from database thru server
async function loadTasks() {
  try {
    const res = await fetch(API_URL, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      //error handling
      const errText = await res.text();
      console.error("Failed to load tasks:", errText);
      allTasks = [];
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      //check if data is an array, if not then turn into an array
      console.error("Unexpected tasks response:", data);
      allTasks = [];
      return;
    }
    allTasks = data; //store tasks  and then display them
    renderBoard();
  } catch (err) {
    console.error("Failed to load tasks:", err);
    allTasks = [];
  }
}

//update for checkbox
async function updateStatus(id, status) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Server error");
  }
  await loadTasks(); //refresh tasks
}

//update for date, time, priority, name
async function updateTaskField(id, field, value) {
  await fetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ [field]: value }),
  });
  await loadTasks();
}

//update progress bar
function updateProgress(tasks) {
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById("progressBar");
  if (bar) bar.style.width = percent + "%";
}

//utility functions for safe rendering
function escapeHtml(text) {
  return String(text || "").replace(
    /[&<>\\\"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

//EVENT HANDLERS
document.addEventListener("DOMContentLoaded", () => {
  // Initialize DOM elements
  taskModal = document.getElementById("taskModal");
  showFormBtn = document.getElementById("showFormBtn");
  cancelBtn = document.getElementById("cancelBtn");
  sortBy = document.getElementById("sortBy");
  editTaskModal = document.getElementById("editTaskModal");
  editTaskForm = document.getElementById("editTaskForm");
  cancelEditTaskBtn = document.getElementById("cancelEditTaskBtn");
  deleteModal = document.getElementById("deleteModal");
  confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  undoBanner = document.getElementById("undoBanner");
  undoBtn = document.getElementById("undoBtn");
  titleToggle = document.getElementById("titleToggle");
  showViewBtn = document.getElementById("showViewBtn");

  // sorting
  loadSortFilter();
  if (sortBy) {
    sortBy.addEventListener("change", function () {
      localStorage.setItem("sortBy", sortBy.value); // save selected sort option
      renderBoard();
    });
  }

  // add task
  if (showFormBtn) {
    showFormBtn.addEventListener("click", () => {
      if (taskModal) taskModal.classList.remove("hidden");
      setTimeout(() => {
        const nf = document.getElementById("name");
        if (nf) nf.focus();
      }, 60);
    });
  }

  if (cancelBtn)
    cancelBtn.addEventListener(
      "click",
      () => taskModal && taskModal.classList.add("hidden")
    );

  // add task submit
  const taskForm = document.getElementById("taskForm");
  if (taskForm) {
    taskForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("name").value;
      const due_date = document.getElementById("due_date").value;
      const due_time = document.getElementById("due_time").value;
      const priority = document.getElementById("priority").value;

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name,
            due_date,
            due_time,
            priority,
            status: "to do",
          }),
        });
        if (!res.ok) throw new Error("Failed to add task");
        taskForm.reset(); //clear form
        if (taskModal) taskModal.classList.add("hidden"); //hide modal
        await loadTasks(); //refresh tasks so the newly added task shows up
      } catch (err) {
        alert("Error adding task: " + err.message);
      }
    });
  }
  // edit task
  window.openEditTaskModal = function (id) {
    const t = allTasks.find((x) => x.id === id);
    if (!t) return;
    editingTaskId = id;
    const en = document.getElementById("edit_name");
    if (en) en.value = t.name || "";
    const edd = document.getElementById("edit_due_date");
    if (edd) edd.value = t.due_date || "";
    const edt = document.getElementById("edit_due_time");
    if (edt) edt.value = t.due_time || "";
    const ep = document.getElementById("edit_priority");
    if (ep) ep.value = t.priority || "do now";
    const es = document.getElementById("edit_status");
    if (es) es.value = t.status || "to do";
    if (editTaskModal) editTaskModal.classList.remove("hidden");
    setTimeout(() => {
      const en2 = document.getElementById("edit_name");
      if (en2) en2.focus();
    }, 60);
  };

  if (cancelEditTaskBtn)
    cancelEditTaskBtn.addEventListener("click", () => {
      if (editTaskModal) editTaskModal.classList.add("hidden");
      editingTaskId = null;
    });

  if (editTaskForm) {
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
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, due_date, due_time, priority, status }),
      });

      if (editTaskModal) editTaskModal.classList.add("hidden");
      editingTaskId = null;
      await loadTasks();
    });
  }

  // delete confirmation
  function confirmDelete(id) {
    deleteIdPending = id;
    if (deleteModal) deleteModal.classList.remove("hidden");
  }
  window.confirmDelete = confirmDelete;

  if (cancelDeleteBtn)
    cancelDeleteBtn.addEventListener("click", () => {
      deleteIdPending = null;
      if (deleteModal) deleteModal.classList.add("hidden");
    });

  if (confirmDeleteBtn)
    confirmDeleteBtn.addEventListener("click", async () => {
      if (!deleteIdPending) return;
      const id = deleteIdPending;
      deleteIdPending = null;
      if (deleteModal) deleteModal.classList.add("hidden");

      try {
        const res = await fetch(`${API_URL}/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
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
    if (!undoBanner) return;
    undoBanner.style.display = "flex";
    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
      undoBanner.style.display = "none";
      lastDeletedTask = null;
    }, 2000);
  }
  window.showUndo = showUndo;

  if (undoBtn)
    undoBtn.addEventListener("click", async () => {
      if (!lastDeletedTask) return;
      try {
        await fetch(`${API_URL}/${lastDeletedTask.id}/undo`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
      } catch (err) {
        alert("Undo failed: " + err.message);
        return;
      }
      lastDeletedTask = null;
      if (undoBanner) undoBanner.style.display = "none";
      clearTimeout(undoTimeout);
      await loadTasks();
    });

  // night mode toggle
  if (titleToggle)
    titleToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
    });

  // responsive heights for kanban columns
  function refreshHeights() {
    const main = document.getElementById('mainContainer');
    if (!main) return;
    
    // Get the topbar height
    const topbar = document.querySelector('body > div:first-child');
    const topbarHeight = topbar ? topbar.offsetHeight : 80;
    
    // Get the toolbar height
    const toolbar = main.querySelector('[class*="border-b-2"]');
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 60;
    
    // Get the progress bar height
    const progressHeight = 36;
    
    // Calculate available height
    const mainTop = main.getBoundingClientRect().top;
    const available = window.innerHeight - mainTop - toolbarHeight - progressHeight - 32; // 32px padding/margin
    
    // Apply to kanban scroll containers
    document.querySelectorAll('.kanban-scroll').forEach(el => {
      el.style.maxHeight = Math.max(200, available) + 'px';
    });
  }

  // Call on load and window resize
  window.addEventListener('resize', refreshHeights);
  window.addEventListener('load', refreshHeights);
  setTimeout(refreshHeights, 200);

  // --- Initialization ---
  loadTasks();
});
