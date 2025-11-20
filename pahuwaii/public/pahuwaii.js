const priorityColors = {
  "do now": "bg-[#ef8e8e] text-black",
  "do next": "bg-[#F1BA7E] text-black",
  "do later": "bg-[#b6b3e6] text-black",
  "do last": "bg-[#99c2a5] text-black",
};

let sessionUserId = null;

function getCurrentUserId() {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  try {
    const decoded = JSON.parse(atob(token.split(".")[1]));
    return decoded.user_id;
  } catch (err) {
    console.error("Error decoding token:", err);
    return null;
  }
}

function validateSession() {
  const currentId = getCurrentUserId();

  if (!currentId) {
    // No token, redirect to auth
    window.location.replace("/auth.html");
    return false;
  }

  if (sessionUserId === null) {
    // First load, set the session
    sessionUserId = currentId;
    sessionStorage.setItem("sessionUserId", currentId);
    return true;
  }

  if (sessionUserId !== currentId) {
    // User switched accounts, clear and redirect
    console.warn("Session user mismatch detected");
    window.location.replace("/auth.html");
    return false;
  }

  return true;
}

let authToken = localStorage.getItem("authToken") || null;
let allTasks = [];
let currentCollabListId = null;
let isCollabMode = false;
let deletedTaskId = null;
let lastDeletedTask = null;
let undoTimeout = null;

function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + authToken,
  };
}

// Define handler functions BEFORE DOMContentLoaded
function handleSelectCollabList(list) {
  return async () => {
    console.log("Selecting collab list:", list.name, list.id);
    isCollabMode = true;
    currentCollabListId = list.id;

    allTasks = [];
    renderBoard();

    try {
      await fetchCollabTasks(list.id);
      console.log("Fetched collab tasks for list:", list.id);
    } catch (err) {
      console.error("Failed fetching collab tasks:", err);
    }

    const titleToggle = document.getElementById("titleToggle");
    if (titleToggle) titleToggle.textContent = `pahuwaii : 3 - ${list.name}`;

    document.getElementById("sidebar").classList.add("-translate-x-full");
    document.getElementById("sidebarOverlay").classList.add("hidden");

    updateListSelection(list.id);
  };
}

async function handleSelectPersonalList() {
  console.log("Selecting personal task list");
  isCollabMode = false;
  currentCollabListId = null;

  allTasks = [];
  renderBoard();

  try {
    await fetchTasks();
    console.log("Fetched personal tasks");
  } catch (err) {
    console.error("Failed fetching personal tasks:", err);
  }

  const titleToggle = document.getElementById("titleToggle");
  if (titleToggle) titleToggle.textContent = "pahuwaii : 3 - My Personal List";

  document.getElementById("sidebar").classList.add("-translate-x-full");
  document.getElementById("sidebarOverlay").classList.add("hidden");

  updateListSelection("personal");
}

function updateListSelection(selectedId) {
  const myListBtn = document.getElementById("myListBtn");
  const collabListItems = document.querySelectorAll(
    "#collabListsContainer > div[data-list-id]"
  );

  // Reset all styles
  myListBtn.classList.remove("bg-blue-500", "text-white", "font-bold");
  myListBtn.classList.add("bg-blue-100");

  collabListItems.forEach((item) => {
    item.classList.remove("bg-blue-500", "text-white", "font-bold");
    item.classList.add("hover:bg-gray-100", "border-gray-300");
  });

  // Apply selected styles
  if (selectedId === "personal") {
    myListBtn.classList.remove("bg-blue-100");
    myListBtn.classList.add("bg-blue-500", "text-white", "font-bold");
  } else {
    const selectedList = document.querySelector(
      `#collabListsContainer > div[data-list-id="${selectedId}"]`
    );
    if (selectedList) {
      selectedList.classList.remove("hover:bg-gray-100", "border-gray-300");
      selectedList.classList.add("bg-blue-500", "text-white", "font-bold");
    }
  }
}
async function loadUserProfilePicture() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  // Try to get local persisted avatar first so UI updates instantly
  try {
    const decoded = JSON.parse(atob(token.split(".")[1]));
    const uid = decoded.user_id || decoded.id;
    if (uid) {
      const saved = localStorage.getItem(`profilePic_${uid}`);
      if (saved) {
        const headerProfilePic = document.getElementById("headerProfilePic");
        if (headerProfilePic) headerProfilePic.src = saved;
      }
    }
  } catch (err) {
    console.warn("Error decoding token for local avatar", err);
  }

  // Then fetch server-side profile and overwrite/sync local copy if server has one
  try {
    const res = await fetch("/profile", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!res.ok) return;
    const data = await res.json();
    if (data && data.profile_picture) {
      const headerProfilePic = document.getElementById("headerProfilePic");
      if (headerProfilePic) headerProfilePic.src = data.profile_picture;
      try {
        const uid2 = data.id || data.user_id;
        if (uid2)
          localStorage.setItem(`profilePic_${uid2}`, data.profile_picture);
      } catch (e) {}
    }
  } catch (err) {
    console.error("Error loading profile picture:", err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize session tracking
  const storedSessionId = sessionStorage.getItem("sessionUserId");
  if (storedSessionId) {
    sessionUserId = parseInt(storedSessionId);
  }

  // Validate session on page load
  if (!validateSession()) {
    return;
  }

  // Check session on page visibility change (tab switching)
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      validateSession();
    }
  });

  // Check session periodically
  setInterval(() => {
    validateSession();
  }, 5000); // Check every 5 seconds

  if (!authToken) {
    window.location.replace("/auth.html");
    return;
  }

  await loadUserProfilePicture();

  // Setup sidebar toggle
  const showSidebarBtn = document.getElementById("showSidebarBtn");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  showSidebarBtn.addEventListener("click", () => {
    sidebar.classList.remove("-translate-x-full");
    sidebarOverlay.classList.remove("hidden");
  });

  closeSidebarBtn.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
    sidebarOverlay.classList.add("hidden");
  });

  sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
    sidebarOverlay.classList.add("hidden");
  });

  // Setup add task form
  const showFormBtn = document.getElementById("showFormBtn");
  const taskModal = document.getElementById("taskModal");
  const taskForm = document.getElementById("taskForm");
  const cancelBtn = document.getElementById("cancelBtn");

  showFormBtn.addEventListener("click", () => {
    taskModal.classList.remove("hidden");
    taskForm.reset();
    setTimeout(() => {
      const nf = document.getElementById("name");
      if (nf) nf.focus();
    }, 60);
  });

  cancelBtn.addEventListener("click", () => {
    taskModal.classList.add("hidden");
  });

  // Submit task form
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const task = {
      name: document.getElementById("name").value,
      due_date: document.getElementById("due_date").value || null,
      due_time: document.getElementById("due_time").value || null,
      priority: document.getElementById("priority").value,
      status: "to do",
    };

    const url = isCollabMode
      ? `/collab-lists/${currentCollabListId}/tasks`
      : "/tasks";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(task),
      });

      if (res.ok) {
        taskForm.reset();
        taskModal.classList.add("hidden");
        if (isCollabMode) {
          await fetchCollabTasks(currentCollabListId);
        } else {
          await fetchTasks();
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add task");
      }
    } catch (err) {
      console.error("Error adding task:", err);
      alert("Error adding task");
    }
  });

  // Edit task modal handlers
  const editTaskModal = document.getElementById("editTaskModal");
  const editTaskForm = document.getElementById("editTaskForm");
  const cancelEditTaskBtn = document.getElementById("cancelEditTaskBtn");

  cancelEditTaskBtn.addEventListener("click", () => {
    editTaskModal.classList.add("hidden");
  });

  editTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await updateTask(editTaskForm.dataset.taskId);
  });

  // Delete modal handlers
  const deleteModal = document.getElementById("deleteModal");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

  cancelDeleteBtn.addEventListener("click", () => {
    deleteModal.classList.add("hidden");
  });

  confirmDeleteBtn.addEventListener("click", async () => {
    deleteModal.classList.add("hidden");
    await deleteTask(deleteModal.dataset.taskId);
  });

  // Undo banner
  const undoBanner = document.getElementById("undoBanner");
  const undoBtn = document.getElementById("undoBtn");

  undoBtn.addEventListener("click", async () => {
    const endpoint = isCollabMode
      ? `/collab-tasks/${deletedTaskId}/undo`
      : `/tasks/${deletedTaskId}/undo`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        undoBanner.style.display = "none";
        lastDeletedTask = null;
        clearTimeout(undoTimeout);
        if (isCollabMode) {
          await fetchCollabTasks(currentCollabListId);
        } else {
          await fetchTasks();
        }
      }
    } catch (err) {
      console.error("Error undoing delete:", err);
    }
  });

  // Sort handler
  const sortBy = document.getElementById("sortBy");
  const savedSort = localStorage.getItem("sortBy") || "date_added";
  if (sortBy) sortBy.value = savedSort;

  sortBy.addEventListener("change", () => {
    localStorage.setItem("sortBy", sortBy.value);
    renderBoard();
  });

  // Setup My Personal List button - ADD ONCE HERE
  const myListBtn = document.getElementById("myListBtn");
  myListBtn.addEventListener("click", handleSelectPersonalList);

  // Load sidebar data
  await loadSidebarData();

  // Load initial tasks
  await fetchTasks();
});

// Fetch personal tasks
async function fetchTasks() {
  try {
    const res = await fetch("/tasks", {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      allTasks = await res.json();
      renderBoard();
      updateProgressBar();
    } else {
      console.error("Failed to fetch tasks");
    }
  } catch (err) {
    console.error("Error fetching tasks:", err);
  }
}

// Fetch collaborative tasks
async function fetchCollabTasks(listId) {
  try {
    const res = await fetch(`/collab-lists/${listId}/tasks`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      allTasks = await res.json();
      renderBoard();
      updateProgressBar();
    } else {
      console.error("Failed to fetch collab tasks");
    }
  } catch (err) {
    console.error("Error fetching collab tasks:", err);
  }
}

// Render task board
function renderBoard() {
  const notStartedTasks = document.getElementById("notStartedTasks");
  const inProgressTasks = document.getElementById("inProgressTasks");
  const doneTasks = document.getElementById("doneTasks");

  notStartedTasks.innerHTML = "";
  inProgressTasks.innerHTML = "";
  doneTasks.innerHTML = "";

  // Sort tasks
  const sortBy = document.getElementById("sortBy");
  const sortValue = sortBy ? sortBy.value : "date_added";
  let sortedTasks = [...allTasks];

  if (sortValue === "date_added") {
    sortedTasks.sort((a, b) => new Date(a.date_added) - new Date(b.date_added));
  } else if (sortValue === "due_date") {
    sortedTasks.sort(
      (a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0)
    );
  } else if (sortValue === "priority") {
    const order = { "do now": 1, "do next": 2, "do later": 3, "do last": 4 };
    sortedTasks.sort(
      (a, b) => (order[a.priority] || 99) - (order[b.priority] || 99)
    );
  }

  // Group by status
  const toDoTasks = sortedTasks.filter((t) => t.status === "to do");
  const inProgressTasksList = sortedTasks.filter(
    (t) => t.status === "in progress"
  );
  const doneTasks_List = sortedTasks.filter((t) => t.status === "done");

  // Render to do tasks
  toDoTasks.forEach((task) => {
    notStartedTasks.appendChild(createTaskCard(task));
  });

  // Render in progress tasks
  inProgressTasksList.forEach((task) => {
    inProgressTasks.appendChild(createTaskCard(task));
  });

  // Render done tasks
  doneTasks_List.forEach((task) => {
    doneTasks.appendChild(createTaskCard(task));
  });
}

// Create task card
function createTaskCard(task) {
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
    <span class="text-xs text-gray-500" id="task_date_${task.id}">Date Created:
      ${
        task.date_added
          ? new Date(task.date_added).toLocaleDateString()
          : "Unknown"
      }
    </span>
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
      <select id="priority_sel_${
        task.id
      }" class="border p-0.5 text-[10px] rounded ${
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

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("taskId", task.id);
  });
  card.setAttribute("draggable", "true");

  // Checkbox handler
  const cb = card.querySelector(`#cb_${task.id}`);
  if (cb) {
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
  }

  return card;
}

// Update task status (checkbox)
async function updateStatus(id, status) {
  const endpoint = isCollabMode ? `/collab-tasks/${id}` : `/tasks/${id}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Server error");
  }
  if (isCollabMode) {
    await fetchCollabTasks(currentCollabListId);
  } else {
    await fetchTasks();
  }
}

// Update task field (date, time, priority)
window.updateTaskField = async function (id, field, value) {
  const endpoint = isCollabMode ? `/collab-tasks/${id}` : `/tasks/${id}`;
  await fetch(endpoint, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ [field]: value }),
  });
  if (isCollabMode) {
    await fetchCollabTasks(currentCollabListId);
  } else {
    await fetchTasks();
  }
};

// Open edit task modal
window.openEditTaskModal = function (id) {
  const t = allTasks.find((x) => x.id === id);
  if (!t) return;
  const editTaskModal = document.getElementById("editTaskModal");
  const editTaskForm = document.getElementById("editTaskForm");
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
  editTaskForm.dataset.taskId = id;
  editTaskModal.classList.remove("hidden");
  setTimeout(() => {
    const en2 = document.getElementById("edit_name");
    if (en2) en2.focus();
  }, 60);
};

// Update task
async function updateTask(taskId) {
  const endpoint = isCollabMode
    ? `/collab-tasks/${taskId}`
    : `/tasks/${taskId}`;

  const updatedTask = {
    name: document.getElementById("edit_name").value,
    due_date: document.getElementById("edit_due_date").value || null,
    due_time: document.getElementById("edit_due_time").value || null,
    priority: document.getElementById("edit_priority").value,
    status: document.getElementById("edit_status").value,
  };

  try {
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(updatedTask),
    });

    if (res.ok) {
      document.getElementById("editTaskModal").classList.add("hidden");
      if (isCollabMode) {
        await fetchCollabTasks(currentCollabListId);
      } else {
        await fetchTasks();
      }
    } else {
      alert("Failed to update task");
    }
  } catch (err) {
    console.error("Error updating task:", err);
    alert("Error updating task");
  }
}

// Delete confirmation
window.confirmDelete = function (id) {
  const deleteModal = document.getElementById("deleteModal");
  deleteModal.dataset.taskId = id;
  deleteModal.classList.remove("hidden");
};

// Delete task
async function deleteTask(taskId) {
  const endpoint = isCollabMode
    ? `/collab-tasks/${taskId}`
    : `/tasks/${taskId}`;

  try {
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      deletedTaskId = taskId;
      try {
        lastDeletedTask = await res.json();
      } catch (e) {
        lastDeletedTask = null;
      }

      if (lastDeletedTask) {
        const undoBanner = document.getElementById("undoBanner");
        undoBanner.style.display = "flex";
        clearTimeout(undoTimeout);
        undoTimeout = setTimeout(() => {
          undoBanner.style.display = "none";
          lastDeletedTask = null;
        }, 2000);
      }

      if (isCollabMode) {
        await fetchCollabTasks(currentCollabListId);
      } else {
        await fetchTasks();
      }
    }
  } catch (err) {
    console.error("Error deleting task:", err);
  }
}

// Update progress bar
function updateProgressBar() {
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "done").length;
  const percentage = totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;

  const progressBar = document.getElementById("progressBar");
  if (progressBar) progressBar.style.width = percentage + "%";
}

// Utility function
function escapeHtml(text) {
  return String(text || "").replace(
    /[&<>\\\"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

// Load sidebar data
async function loadSidebarData() {
  try {
    const res = await fetch("/collab-lists", {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const lists = await res.json();
      renderSidebar(lists);
    }
  } catch (err) {
    console.error("Error loading sidebar data:", err);
  }
}

async function renderSidebar(lists) {
  const collabListsContainer = document.getElementById("collabListsContainer");
  collabListsContainer.innerHTML = "";

  const userId = getCurrentUserId();
  if (!userId) {
    console.error("User ID not found; cannot render sidebar properly.");
    return;
  }

  // Convert IDs to strings for robust matching
  const myLists = lists.filter(
    (list) => String(list.owner_id) === String(userId)
  );
  const sharedLists = lists.filter(
    (list) => String(list.owner_id) !== String(userId)
  );

  // Render My Collaborative Lists section
  if (myLists.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "text-sm text-gray-500 italic";
    emptyMsg.textContent = "No collaborative lists created yet";
    collabListsContainer.appendChild(emptyMsg);
  } else {
    for (const list of myLists) {
      const members = await fetchListMembers(list.id);
      const memberNames = members.map((m) => m.name).join(", ");

      const listItem = document.createElement("div");
      listItem.className =
        "mb-2 p-2 rounded hover:bg-gray-100 transition cursor-pointer border border-gray-300";
      listItem.setAttribute("data-list-id", list.id);
      listItem.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="font-semibold text-sm">${escapeHtml(list.name)}</div>
            <div class="text-xs text-gray-600 mt-1">Team Members: ${escapeHtml(
              memberNames
            )}</div>
          </div>
          
          <div class="flex items-center gap-2">
            <button 
              class="text-xs text-gray-600 hover:text-black"
              onclick="editCollabListName('${list.id}', '${escapeHtml(
        list.name
      )}'); event.stopPropagation();"
              title="Edit List Name">✎</button>
            <button
              class="text-xs text-blue-600 hover:text-blue-800"
              onclick="openAddMembersModal('${
                list.id
              }'); event.stopPropagation();"
              title="Manage Members">👥</button>
          </div>
        </div>
      `;
      listItem.addEventListener("click", () => handleSelectCollabList(list)());
      collabListsContainer.appendChild(listItem);
    }
  }

  // Render Shared With Me section
  if (sharedLists.length > 0) {
    const sharedHeader = document.createElement("h3");
    sharedHeader.className = "font-bold mt-6 mb-2";
    sharedHeader.textContent = "Shared with Me";
    collabListsContainer.appendChild(sharedHeader);

    for (const list of sharedLists) {
      const members = await fetchListMembers(list.id);
      const memberNames = members.map((m) => m.name).join(", ");

      const sharedListItem = document.createElement("div");
      sharedListItem.className =
        "mb-2 p-2 rounded hover:bg-gray-100 transition cursor-pointer border border-gray-300";
      sharedListItem.setAttribute("data-list-id", list.id);
      sharedListItem.innerHTML = `
        <div class="font-semibold text-sm">${escapeHtml(list.name)}</div>
        <div class="text-xs text-gray-600">Creator: ${escapeHtml(
          list.owner_name
        )}</div>
        <div class="text-xs text-gray-600">Team Members: ${escapeHtml(
          memberNames
        )}</div>
      `;
      sharedListItem.addEventListener("click", () =>
        handleSelectCollabList(list)()
      );
      collabListsContainer.appendChild(sharedListItem);
    }
  }
}

// Fetch list members
async function fetchListMembers(listId) {
  try {
    const res = await fetch(`/collab-lists/${listId}/members`, {
      headers: getAuthHeaders(),
    });
    return res.ok ? await res.json() : [];
  } catch (err) {
    console.error("Error fetching members:", err);
    return [];
  }
}

// Get current user ID from token
function getCurrentUserId() {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  try {
    const decoded = JSON.parse(atob(token.split(".")[1]));
    return decoded.user_id;
  } catch (err) {
    console.error("Error decoding token:", err);
    return null;
  }
}

// Edit collaborative list name
window.editCollabListName = function (listId, currentName) {
  const newName = prompt("Enter new list name:", currentName);
  if (newName && newName !== currentName) {
    alert("List name update feature coming soon");
  }
};

// Create collaborative list
async function createCollabList(name) {
  try {
    const res = await fetch("/collab-lists", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      await loadSidebarData();
      alert("Collaborative list created!");
    } else {
      alert("Failed to create list");
    }
  } catch (err) {
    console.error("Error creating list:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const createListModal = document.getElementById("createListModal");
  const createListForm = document.getElementById("createListForm");
  const newListNameInput = document.getElementById("newListName");
  const cancelCreateListBtn = document.getElementById("cancelCreateListBtn");
  const createListBtn = document.getElementById("createListBtn"); // Your sidebar button

  // Show modal on button click
  createListBtn.addEventListener("click", () => {
    createListModal.classList.remove("hidden");
    createListForm.reset();
    setTimeout(() => {
      newListNameInput.focus();
    }, 60);
  });

  // Hide modal on cancel
  cancelCreateListBtn.addEventListener("click", () => {
    createListModal.classList.add("hidden");
  });

  // Handle form submit to create new list
  createListForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = newListNameInput.value.trim();
    if (!name) {
      alert("Please enter a list name");
      return;
    }
    try {
      const res = await fetch("/collab-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        createListModal.classList.add("hidden");
        await loadSidebarData();
        alert("Collaborative list created!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create list");
      }
    } catch (err) {
      console.error("Error creating list:", err);
      alert("Error creating list");
    }
  });
});

let currentListForMemberAdd = null;

window.openAddMembersModal = function (listId) {
  currentListForMemberAdd = listId;
  const addMembersModal = document.getElementById("addMembersModal");
  const addMembersForm = document.getElementById("addMembersForm");
  addMembersForm.reset();
  addMembersModal.classList.remove("hidden");
  document.getElementById("memberEmails").focus();
};

document.addEventListener("DOMContentLoaded", () => {
  const addMembersModal = document.getElementById("addMembersModal");
  const addMembersForm = document.getElementById("addMembersForm");
  const cancelAddMembersBtn = document.getElementById("cancelAddMembersBtn");

  cancelAddMembersBtn.addEventListener("click", () => {
    addMembersModal.classList.add("hidden");
    currentListForMemberAdd = null;
  });

  addMembersForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("memberEmails").value.trim();

    if (!email) {
      alert("Please enter an email address.");
      return;
    }

    if (!currentListForMemberAdd) {
      alert("No list selected.");
      return;
    }

    try {
      const res = await fetch(
        `/collab-lists/${currentListForMemberAdd}/members`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ email }), // Single email string here
        }
      );

      if (res.ok) {
        alert("Member added successfully");
        addMembersModal.classList.add("hidden");
        currentListForMemberAdd = null;
        await loadSidebarData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add member");
      }
    } catch (err) {
      console.error("Error adding member:", err);
      alert("Error adding member");
    }
  });
});

// --- Drag & Drop: allow dragging tasks between columns ---
function allowDrop(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

async function handleDrop(e, targetStatus) {
  e.preventDefault();
  const taskId =
    e.dataTransfer.getData("taskId") || e.dataTransfer.getData("text");
  if (!taskId) return;
  try {
    // updateStatus will refresh the board after calling the API
    await updateStatus(taskId, targetStatus);
  } catch (err) {
    console.error("Failed to drop/update status", err);
  }
}

const dropTargets = [
  { id: "notStartedTasks", status: "to do" },
  { id: "inProgressTasks", status: "in progress" },
  { id: "doneTasks", status: "done" },
];

dropTargets.forEach((t) => {
  const el = document.getElementById(t.id);
  if (!el) return;
  el.addEventListener("dragover", allowDrop);
  el.addEventListener("drop", (e) => handleDrop(e, t.status));
});
