const landing = document.getElementById("landing");
const authModal = document.getElementById("authModal");
const profileCard = document.getElementById("profileCard");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const showLoginBtn = document.getElementById("showLoginBtn");
const showSignupBtn = document.getElementById("showSignupBtn");
const signupPrompt = document.getElementById("signupPrompt");
const switchToSignup = document.getElementById("switchToSignup");
const closeAuthModal = document.getElementById("closeAuthModal");

let authToken = localStorage.getItem("authToken") || null;
let currentUser = null;

// Check if coming from password reset link
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get("token");

// Initialize all DOM elements and set up event listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("auth.js DOMContentLoaded fired");

  // If token exists, try to load profile
  if (authToken) {
    fetch("/profile", {
      method: "GET",
      headers: { Authorization: "Bearer " + authToken },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        currentUser = data;
        showProfile();
      })
      .catch(() => {
        // Invalid token, show landing
        localStorage.removeItem("authToken");
        authToken = null;
        currentUser = null;
        landing.classList.remove("hidden");
        profileCard.classList.add("hidden");
      });
  } else if (resetToken) {
    // Show password reset modal
    landing.classList.add("hidden");
    authModal.classList.add("hidden");
    profileCard.classList.add("hidden");
    document.getElementById("setPasswordModal").classList.remove("hidden");
  } else {
    // Show landing page
    landing.classList.remove("hidden");
    profileCard.classList.add("hidden");
  }

  // Get started button - show auth modal
  const getStartedBtn = document.getElementById("getStartedBtn");
  if (getStartedBtn) {
    getStartedBtn.addEventListener("click", () => {
      console.log("Get started clicked");
      authModal.classList.remove("hidden");
      landing.classList.add("hidden");
      showLogin();
    });
  }

  // Close auth modal
  closeAuthModal.addEventListener("click", () => {
    authModal.classList.add("hidden");
    landing.classList.remove("hidden");
  });

  showLoginBtn.addEventListener("click", activateLogin);
  showSignupBtn.addEventListener("click", activateSignup);
  switchToSignup.addEventListener("click", (e) => {
    e.preventDefault();
    activateSignup();
  });

  activateLogin();

  // Setup form handlers
  loginForm.addEventListener("submit", handleLogin);
  signupForm.addEventListener("submit", handleSignup);

  // Password reset handlers
  document
    .getElementById("forgotPasswordLink")
    .addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("resetModal").classList.remove("hidden");
      authModal.classList.add("hidden");
    });

  document.getElementById("closeResetModal").addEventListener("click", () => {
    document.getElementById("resetModal").classList.add("hidden");
    authModal.classList.remove("hidden");
  });

  document
    .getElementById("resetRequestForm")
    .addEventListener("submit", handleResetRequest);

  document
    .getElementById("closeSetPasswordModal")
    .addEventListener("click", () => {
      document.getElementById("setPasswordModal").classList.add("hidden");
      landing.classList.remove("hidden");
    });

  document
    .getElementById("setPasswordForm")
    .addEventListener("submit", handleSetPassword);

  // Edit field modal handlers
  const editFieldModal = document.getElementById("editFieldModal");
  const editFieldTitle = document.getElementById("editFieldTitle");
  const editFieldInput = document.getElementById("editFieldInput");
  const cancelEditFieldBtn = document.getElementById("cancelEditFieldBtn");
  const saveEditFieldBtn = document.getElementById("saveEditFieldBtn");

  cancelEditFieldBtn.addEventListener("click", () => {
    editFieldModal.classList.add("hidden");
  });

  saveEditFieldBtn.addEventListener("click", handleEditFieldSave);

  // Edit buttons
  document.getElementById("editNameBtn").addEventListener("click", () => {
    openEditFieldModal("name", currentUser.name);
  });

  document.getElementById("editEmailBtn").addEventListener("click", () => {
    openEditFieldModal("email", currentUser.email);
  });

  document.getElementById("editBioBtn").addEventListener("click", () => {
    openEditFieldModal("bio", currentUser.bio || "");
  });

  // Change password button
  document
    .getElementById("changePasswordBtn")
    .addEventListener("click", handleChangePassword);

  // Delete account handlers
  const deleteBtn = document.getElementById("deleteAccountBtn");
  const modal = document.getElementById("deleteModal");
  const cancelBtn = document.getElementById("cancelDelete");
  const confirmBtn = document.getElementById("confirmDelete");

  deleteBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));
  confirmBtn.addEventListener("click", handleDeleteAccount);

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    window.location.href = "/auth.html";
  });

  // Accessibility Settings
  const darkToggle = document.getElementById("darkModeToggle");
  const catToggle = document.getElementById("catModeToggle");
  let catMode = localStorage.getItem("catMode") === "true";

  if (catMode) {
    document.body.classList.add("cat-mode");
  }

  catToggle.addEventListener("click", () => {
    catMode = !catMode;
    if (catMode) {
      document.body.classList.add("cat-mode");
      const meow = new Audio(
        "https://www.myinstants.com/media/sounds/gary_meow.mp3"
      );
      meow.play();
      const catToast = document.getElementById("catToast");
      catToast.classList.remove("hidden");
      setTimeout(() => catToast.classList.add("hidden"), 2000);
    } else {
      document.body.classList.remove("cat-mode");
    }
    localStorage.setItem("catMode", catMode);
  });
});

function showLogin() {
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  signupPrompt.classList.remove("hidden");
}

function showSignup() {
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
  signupPrompt.classList.add("hidden");
}

function activateLogin() {
  showLoginBtn.classList.add(
    "bg-white",
    "shadow",
    "text-gray-900",
    "text-[#8c52ff]"
  );
  showSignupBtn.classList.remove(
    "bg-white",
    "shadow",
    "text-gray-900",
    "text-[#29810E]"
  );
  showSignupBtn.classList.add("text-gray-600");
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  signupPrompt.classList.remove("hidden");
}

function activateSignup() {
  showSignupBtn.classList.add(
    "bg-white",
    "shadow",
    "text-gray-900",
    "text-[#29810E]"
  );
  showLoginBtn.classList.remove(
    "bg-white",
    "shadow",
    "text-gray-900",
    "text-[#8c52ff]"
  );
  showLoginBtn.classList.add("text-gray-600");
  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  signupPrompt.classList.add("hidden");
}

// Login handler
async function handleLogin(e) {
  e.preventDefault();
  const name = document.getElementById("login_name").value;
  const password = document.getElementById("login_password").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });

    const data = await res.json();

    if (res.ok) {
      authToken = data.token;
      localStorage.setItem("authToken", authToken);
      currentUser = {
        id: data.user_id,
        name: data.name,
        email: data.email,
        bio: data.bio,
      };
      loginForm.reset();
      // After login, go to the to-do list page
      window.location.href = "/index.html";
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error("Login error:", err);
    alert("Login failed. Please try again.");
  }
}

// Signup handler
async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById("signup_name").value;
  const email = document.getElementById("signup_email").value;
  const password = document.getElementById("signup_password").value;
  const confirm_password = document.getElementById(
    "signup_confirm_password"
  ).value;

  if (password !== confirm_password) {
    alert("Passwords do not match");
    return;
  }

  try {
    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      alert("Registered! Please login.");
      signupForm.reset();
      activateLogin();
    } else {
      alert(data.error || "Registration failed");
    }
  } catch (err) {
    console.error("Signup error:", err);
    alert("Registration failed. Please try again.");
  }
}

// Show profile
function showProfile() {
  authModal.classList.add("hidden");
  landing.classList.add("hidden");
  profileCard.classList.remove("hidden");

  document.getElementById("profile_name_display_header").textContent =
    currentUser.name || "";
  document.getElementById("profile_name_display").textContent =
    currentUser.name || "";
  document.getElementById("profile_email_display").textContent =
    currentUser.email || "";
  document.getElementById("profile_bio_display").textContent =
    currentUser.bio || "insert bio here";
}

// Edit field modal functions
function openEditFieldModal(field, value) {
  const editFieldTitle = document.getElementById("editFieldTitle");
  const editFieldInput = document.getElementById("editFieldInput");
  const editFieldModal = document.getElementById("editFieldModal");

  editFieldTitle.textContent =
    "Edit " + field.charAt(0).toUpperCase() + field.slice(1);
  editFieldInput.value = value;
  editFieldInput.type = "text";
  editFieldModal.classList.remove("hidden");
  editFieldInput.focus();
}

async function handleEditFieldSave() {
  const editFieldTitle = document.getElementById("editFieldTitle");
  const editFieldInput = document.getElementById("editFieldInput");
  const editFieldModal = document.getElementById("editFieldModal");

  const title = editFieldTitle.textContent.toLowerCase();
  const field = title.split(" ")[1];
  const newValue = editFieldInput.value;

  if (!newValue) return;

  try {
    const res = await fetch("/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + authToken,
      },
      body: JSON.stringify({ [field]: newValue }),
    });

    const data = await res.json();

    if (res.ok) {
      const updateProfileToast = document.getElementById("updateProfileToast");
      updateProfileToast.classList.remove("hidden");
      setTimeout(() => updateProfileToast.classList.add("hidden"), 1500);

      editFieldModal.classList.add("hidden");
      currentUser[field] = newValue;
      document.getElementById("profile_" + field + "_display").textContent =
        newValue;

      if (field === "name") {
        document.getElementById("profile_name_display_header").textContent =
          newValue;
      }
    } else {
      alert(data.error || "Update failed");
    }
  } catch (err) {
    alert("Update error");
  }
}

async function handleChangePassword() {
  const editFieldTitle = document.getElementById("editFieldTitle");
  const editFieldInput = document.getElementById("editFieldInput");
  const editFieldModal = document.getElementById("editFieldModal");
  const saveEditFieldBtn = document.getElementById("saveEditFieldBtn");

  editFieldTitle.textContent = "Change Password";

  editFieldInput.outerHTML = `
    <div id="passwordFields" class="flex flex-col gap-3">
      <input type="password" id="oldPasswordInput" placeholder="Enter old password" class="border p-2 rounded">
      <input type="password" id="newPasswordInput" placeholder="Enter new password" class="border p-2 rounded">
    </div>
  `;

  editFieldModal.classList.remove("hidden");
  setTimeout(() => document.getElementById("oldPasswordInput")?.focus(), 50);

  // Override save button
  saveEditFieldBtn.onclick = async () => {
    const oldPasswordEl = document.getElementById("oldPasswordInput");
    const newPasswordEl = document.getElementById("newPasswordInput");
    const oldPassword = oldPasswordEl?.value.trim();
    const newPassword = newPasswordEl?.value.trim();

    if (!oldPassword || !newPassword) {
      alert("Please fill out both fields.");
      return;
    }

    if (newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }

    try {
      const res = await fetch("/profile/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authToken,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        const updateProfileToast =
          document.getElementById("updateProfileToast");
        updateProfileToast.classList.remove("hidden");
        setTimeout(() => updateProfileToast.classList.add("hidden"), 1500);

        editFieldModal.classList.add("hidden");

        // Restore normal modal
        document.getElementById("passwordFields").outerHTML =
          '<input id="editFieldInput" type="text" class="border p-2 rounded" />';
        saveEditFieldBtn.onclick = handleEditFieldSave;
      } else {
        alert(data.error || "Password update failed");
      }
    } catch (err) {
      console.error("Password change error:", err);
      alert("Password update error");
    }
  };
}

async function handleDeleteAccount() {
  const modal = document.getElementById("deleteModal");
  modal.classList.add("hidden");

  if (!authToken) {
    alert("You must be logged in to delete your account.");
    return;
  }

  try {
    const res = await fetch("/delete-account", {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + authToken,
      },
    });

    if (res.ok) {
      alert("Account deleted.");
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
    } else {
      const data = await res.json();
      alert(data.error || "Delete failed");
    }
  } catch (err) {
    console.error(err);
    alert("Delete error. Please try again.");
  }
}

async function handleResetRequest(e) {
  e.preventDefault();
  const email = document.getElementById("reset_email").value;

  const res = await fetch("/request-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (res.ok) {
    alert("Check your email for a reset link.");
    document.getElementById("resetModal").classList.add("hidden");
    document.getElementById("resetRequestForm").reset();
    authModal.classList.remove("hidden");
  } else {
    alert(data.error || "Reset request failed");
  }
}

async function handleSetPassword(e) {
  e.preventDefault();
  const new_password = document.getElementById("new_password").value;

  const res = await fetch("/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, new_password }),
  });

  const data = await res.json();

  if (res.ok) {
    alert("Password reset! Please login.");
    window.location.href = "/auth.html";
  } else {
    alert(data.error || "Reset failed");
  }
}
