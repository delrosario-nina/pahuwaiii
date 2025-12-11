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

// Track active toasts by key
const activeToasts = new Set();
const activeToastElements = [];

function showToast(message, bgColor = "#7c69bd", duration = 3000) {
  const key = message;
  // prevent duplicate toasts
  if (activeToasts.has(key)) return;
  activeToasts.add(key);

  const toastElement = document.createElement("div");
  toastElement.className =
    "fixed z-50 bottom-10 left-1/2 transform -translate-x-1/2 text-white px-4 py-2 rounded-lg shadow-lg";
  toastElement.textContent = message;
  toastElement.style.backgroundColor = bgColor;
  toastElement.style.setProperty("background-color", bgColor, "important");
  toastElement.style.transition = "opacity 300ms, bottom 300ms ease-in-out";

  // multiple toasts
  const offset = document.querySelectorAll(".toastElement").length * 60;
  toastElement.style.bottom = `${60 + offset}px`;
  toastElement.classList.add("toastElement");
  document.body.appendChild(toastElement);
  activeToastElements.push(toastElement);

  // fade in - fade out
  setTimeout(() => {
    toastElement.style.opacity = "1";
  }, 10);
  setTimeout(() => {
    toastElement.style.opacity = "0";
    setTimeout(() => {
      toastElement.remove();
      activeToasts.delete(key);
      // Remove from tracking array
      const index = activeToastElements.indexOf(toastElement);
      if (index > -1) {
        activeToastElements.splice(index, 1);
      }
      // Reposition remaining toasts
      repositionToasts();
    }, 300);
  }, duration);
}

function repositionToasts() {
  activeToastElements.forEach((toast, index) => {
    const newBottom = 60 + index * 60;
    toast.style.bottom = `${newBottom}px`;
  });
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  const hasMinLength = password.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return {
    isValid: hasMinLength && hasLetter && hasNumber,
    errors: {
      minLength: !hasMinLength,
      hasLetter: !hasLetter,
      hasNumber: !hasNumber,
    },
  };
}

function getPasswordErrorMessage(validation) {
  const errors = [];
  if (validation.errors.minLength) errors.push("at least 6 characters");
  if (validation.errors.hasLetter) errors.push("at least one letter");
  if (validation.errors.hasNumber) errors.push("at least one number");

  return `Password must contain ${errors.join(", ")}.`;
}

// Initialize all DOM elements and set up event listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("auth.js DOMContentLoaded fired");

  // Clear browser history to prevent going back to logged-in pages
  window.history.pushState(null, null, window.location.href);
  window.addEventListener("popstate", function (event) {
    window.history.pushState(null, null, window.location.href);
  });

  // If token exists, try to load profile
  if (authToken) {
    fetch("/profile", {
      method: "GET",
      headers: { Authorization: "Bearer " + authToken },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        currentUser = data;
        // persist server avatar into localStorage for this user (so other pages can read it)
        try {
          const uid = data.id || data.user_id;
          if (uid && data.profile_picture) {
            localStorage.setItem(`profilePic_${uid}`, data.profile_picture);
          }
        } catch (e) {
          console.warn("persist avatar failed", e);
        }

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
    // Transfer email from login to signup
    const loginEmail = document.getElementById("login_email").value;
    if (loginEmail) {
      document.getElementById("signup_email").value = loginEmail;
    }
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
    // Get current user ID before clearing
    const currentId = getCurrentUserId();

    // Clear all authentication data
    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");

    // Clear session tracking
    sessionStorage.removeItem("sessionUserId");

    // Clear any cached user data
    if (currentId) {
      localStorage.removeItem(`profilePic_${currentId}`);
    }

    // Clear sort preference (optional, but clean)
    // localStorage.removeItem("sortBy");

    // Force page reload to auth page, replacing history
    window.location.replace("/auth.html");
  });

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
  document
    .getElementById("changeProfilePicBtn")
    .addEventListener("click", () => {
      document.getElementById("profilePicModal").classList.remove("hidden");
    });

  document
    .getElementById("closeProfilePicModal")
    .addEventListener("click", () => {
      document.getElementById("profilePicModal").classList.add("hidden");
    });

  // Setup avatar selection
  const avatars = document.querySelectorAll(".avatar-option");
  avatars.forEach((avatar) => {
    avatar.addEventListener("click", async () => {
      const selectedAvatar = avatar.getAttribute("data-avatar");

      if (!selectedAvatar) {
        console.error("No avatar selected");
        return;
      }

      try {
        const res = await fetch("/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + authToken,
          },
          body: JSON.stringify({ profile_picture: selectedAvatar }),
        });

        const data = await res.json();

        if (res.ok) {
          // Update preview image
          document.getElementById("profilePicPreview").src = selectedAvatar;
          currentUser.profile_picture = selectedAvatar;

          // persist per-user selection locally so other pages see it immediately
          try {
            const uid = currentUser.id || currentUser.user_id;
            if (uid) localStorage.setItem(`profilePic_${uid}`, selectedAvatar);
          } catch (e) {
            console.warn("saving avatar to localStorage failed", e);
          }

          // Close modal
          document.getElementById("profilePicModal").classList.add("hidden");

          // Show success toast
          const updateProfileToast =
            document.getElementById("updateProfileToast");
          updateProfileToast.classList.remove("hidden");
          setTimeout(() => {
            updateProfileToast.classList.add("hidden");
          }, 1500);
        } else {
          showToast(
            data.error || "( °ㅁ° ) Can't update profile picture",
            "#ef8e8e"
          );
        }
      } catch (err) {
        console.error("Error updating profile picture:", err);
        showToast(
          "Can't update profile picture, try again? (˶°ㅁ°)⚠︎",
          "#ef8e8e"
        );
      }
    });
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
  const email = document.getElementById("login_email").value.trim();
  const password = document.getElementById("login_password").value.trim();

  if (!email || !password) {
    showToast("✘ Please fill in all fields", "#ef8e8e");
    return;
  }

  if (!validateEmail(email)) {
    showToast("✘ Please enter a valid email address", "#ef8e8e");
    return;
  }

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    console.log("Server response:", data);
    console.log("Response status:", res.status);

    if (res.ok) {
      authToken = data.token;
      localStorage.setItem("authToken", authToken);
      sessionStorage.setItem("sessionUserId", data.user_id);
      currentUser = {
        id: data.user_id,
        name: data.name,
        email: data.email,
        bio: data.bio,
        profile_picture: data.profile_picture,
      };
      // Persist profile picture
      try {
        if (data.user_id && data.profile_picture) {
          localStorage.setItem(
            `profilePic_${data.user_id}`,
            data.profile_picture
          );
        }
      } catch (e) {
        console.warn("persist avatar failed", e);
      }
      loginForm.reset();
      // After login, go to the to-do list page
      window.location.replace("/index.html");
      showToast("ദ്ദി( • ᴗ < )♡ Login successful ! ⋆·˚*", "#32AA0E");
    } else {
      showToast(data.error || "( °ㅁ° ) Login failed", "#ef8e8e");
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast("Couldn't log you in, try again? (˶°ㅁ°)⚠︎", "#ef8e8e");
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

  if (!name || !email || !password || !confirm_password) {
    showToast("✘ Please fill in all fields", "#ef8e8e");
    return;
  }

  if (!validateEmail(email)) {
    showToast("✘ Please enter a valid email address", "#ef8e8e");
    return;
  }
  if (password !== confirm_password) {
    showToast("✘ Passwords don't match ✘", "#ef8e8e");
    return;
  }

  const validation = validatePassword(password);
  if (!validation.isValid) {
    showToast(getPasswordErrorMessage(validation), "#ef8e8e");
    return;
  }

  try {
    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, confirm_password }),
    });

    const data = await res.json();

    if (res.ok) {
      authToken = data.token;
      localStorage.setItem("authToken", authToken);
      sessionStorage.setItem("sessionUserId", data.user_id);
      currentUser = {
        id: data.user_id,
        name: data.name,
        email: data.email,
        bio: data.bio,
        profile_picture: data.profile_picture,
      };
      signupForm.reset();
      // After signup, go to the to-do list page
      window.location.replace("/index.html");
      showToast("Registered ! (ﾉ^ヮ^)ﾉ*", "#32AA0E");
    } else {
      showToast(data.error || "( °ㅁ° ) Registration failed", "#ef8e8e");
    }
  } catch (err) {
    console.error("Signup error:", err);
    showToast("Couldn't register you, try again? (˶°ㅁ°)⚠︎", "#ef8e8e");
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
    currentUser.bio || "insert bio here :33";

  const previewEl = document.getElementById("profilePicPreview");
  const serverAvatar = currentUser.profile_picture || null;

  if (previewEl) {
    previewEl.src = serverAvatar || "profile-icons/user-modified.png";
  }
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
      showToast(data.error || "( °ㅁ° ) Couldn't update profile", "#ef8e8e");
    }
  } catch (err) {
    showToast("Couldn't update profile, try again? (˶°ㅁ°)⚠︎", "#ef8e8e");
  }
}

async function handleChangePassword() {
  const editFieldTitle = document.getElementById("editFieldTitle");
  const editFieldInput = document.getElementById("editFieldInput");
  const editFieldModal = document.getElementById("editFieldModal");
  const saveEditFieldBtn = document.getElementById("saveEditFieldBtn");

  editFieldTitle.textContent = "Change Password?";

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
      showToast("(´•︵•`) Please fill out both fields");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      showToast(getPasswordErrorMessage(validation), "#ef8e8e");
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
        const updatePasswordToast = document.getElementById(
          "updatePasswordToast"
        );
        updatePasswordToast.classList.remove("hidden");
        setTimeout(() => updatePasswordToast.classList.add("hidden"), 1500);

        editFieldModal.classList.add("hidden");

        // Restore normal modal
        document.getElementById("passwordFields").outerHTML =
          '<input id="editFieldInput" type="text" class="border p-2 rounded" />';
        saveEditFieldBtn.onclick = handleEditFieldSave;
      } else {
        showToast(data.error || "( °ㅁ° ) Couldn't update password", "#ef8e8e");
      }
    } catch (err) {
      console.error("Password change error:", err);
      showToast("Couldn't update password, try again? (˶°ㅁ°)", "#ef8e8e");
    }
  };
}

async function handleDeleteAccount() {
  const modal = document.getElementById("deleteModal");
  modal.classList.add("hidden");

  if (!authToken) {
    showToast(
      "✗ Hold on ! You need to login before deleting your account !",
      "#ef8e8e"
    );
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
      showToast("Your account has been deleted ૮(˶ㅠ︿ㅠ)ა");
      localStorage.removeItem("authToken");
      window.location.href = "/auth.html";
    } else {
      const data = await res.json();
      showToast(data.error || "( °ㅁ° ) Couldn't delete account", "#ef8e8e");
    }
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete account, try again? (˶°ㅁ°)⚠︎", "#ef8e8e");
  }
}

async function handleResetRequest(e) {
  e.preventDefault();
  const email = document.getElementById("reset_email").value;

  if (!email) {
    showToast("Please enter your ✉︎ email ✉︎");
    return;
  }
  if (!validateEmail(email)) {
    showToast("✘ Please enter a valid email address", "#ef8e8e");
    return;
  }

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending . . . ";
  submitBtn.style.backgroundColor = "#cccccc";

  try {
    const res = await fetch("/request-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (res.ok) {
      showToast(
        "જ⁀➴ ✉︎ Check your emails for the link reset link ᯓᡣ𐭩",
        "#32AA0E"
      );
      document.getElementById("resetModal").classList.add("hidden");
      document.getElementById("resetRequestForm").reset();
      authModal.classList.remove("hidden");
    } else {
      showToast(data.error || "Can't send reset email, try again? (˶°ㅁ°)⚠︎");
    }
  } catch (err) {
    console.error("Reset request error:", err);
    showToast("Network error, please try again (˶°ㅁ°)⚠︎", "#ef8e8e");
  } finally {
    // Restore button state
    submitBtn.disabled = false;
    submitBtn.style.backgroundColor = "#32AA0E";
    submitBtn.textContent = originalText;
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
    showToast("(ദ്ദി^ᗜ^) Password reset ✧ Login to continue!", "#32AA0E");
    window.location.href = "/auth.html";
  } else {
    showToast(data.error || "( °ㅁ° ) Password reset failed", "#ef8e8e");
  }
}
