  const landing = document.getElementById("landing");
  const authModal = document.getElementById("authModal");
  const profileCard = document.getElementById("profileCard");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const showLoginBtn = document.getElementById("showLoginBtn");
  const showSignupBtn = document.getElementById("showSignupBtn");
  const signupPrompt = document.getElementById('signupPrompt');
  const switchToSignup = document.getElementById('switchToSignup');
  const closeAuthModal = document.getElementById("closeAuthModal");

  let authToken = localStorage.getItem("authToken") || null;
  let currentUser = null;

  // pahuwaii hompage --> login when button is clicked
  document.getElementById("getStartedBtn").onclick = () => {
    authModal.classList.remove("hidden");
    landing.classList.add("hidden");
    showLogin();
  };

  //login --> pahuwaii homepage when cancel button is clicked
  closeAuthModal.onclick = () => {
    authModal.classList.add("hidden");
    landing.classList.remove("hidden");
  };

  showLoginBtn.onclick = showLogin;
  showSignupBtn.onclick = showSignup;

  //showing by removing hidden
  function showLogin() {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
  }

  //showing by removing hidden
  function showSignup() {
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
  }

  //toggle buttons
  function activateLogin() {
    showLoginBtn.classList.add('bg-white', 'shadow', 'text-gray-900');
    showSignupBtn.classList.remove('bg-white', 'shadow', 'text-gray-900');
    showSignupBtn.classList.add('text-gray-600');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    signupPrompt.classList.remove('hidden');
  }

  function activateSignup() {
    showSignupBtn.classList.add('bg-white', 'shadow', 'text-gray-900');
    showLoginBtn.classList.remove('bg-white', 'shadow', 'text-gray-900');
    showLoginBtn.classList.add('text-gray-600');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    signupPrompt.classList.add('hidden'); 
  }

  // Event listeners
  showLoginBtn.addEventListener('click', activateLogin);
  
  showSignupBtn.addEventListener('click', activateSignup);
  switchToSignup.addEventListener('click', (e) => {
    e.preventDefault();
    activateSignup();
  });

  // Default view
  activateLogin();

    // Login
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("login_name").value;
      const password = document.getElementById("login_password").value;

      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password })
      });
      const data = await res.json();
      if (res.ok) {
        authToken = data.token;
        localStorage.setItem("authToken", authToken);
        currentUser = data;
        document.getElementById("loginForm").reset();
        showProfile();
      } else {
        alert(data.error || "Login failed");
      }
    };

    // Signup
    signupForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("signup_name").value;
      const email = document.getElementById("signup_email").value;
      const password = document.getElementById("signup_password").value;
            const confirm_password = document.getElementById("signup_confirm_password").value;

      if (password !== confirm_password) {
        alert("Passwords do not match");
        return;
      }

      const res = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Registered! Please login.");
        document.getElementById("signupForm").reset();
        showLogin();
      } else {
        alert(data.error || "Registration failed");
      }
    };

    // Show profile info
    function showProfile() {
      authModal.classList.add("hidden");
      landing.classList.add("hidden");
      profileCard.classList.remove("hidden");
      document.getElementById("profile_name_display_header").textContent = currentUser.name || "";
      document.getElementById("profile_name_display").textContent = currentUser.name || "";
      document.getElementById("profile_email_display").textContent = currentUser.email || "";
      document.getElementById("profile_bio_display").textContent = currentUser.bio || "insert bio here";
    }


    // Edit name/email/bio
    document.getElementById("editNameBtn").onclick = () => {
      const newName = prompt("Enter new name:", currentUser.name);
      if (newName) currentUser.name = newName;
      document.getElementById("profile_name_display").textContent = currentUser.name;
    };

    document.getElementById("editEmailBtn").onclick = () => {
      const newEmail = prompt("Enter new email:", currentUser.email);
      if (newEmail) currentUser.email = newEmail;
      document.getElementById("profile_email_display").textContent = currentUser.email;
    };

    document.getElementById("editBioBtn").onclick = () => {
      const newBio = prompt("Enter new bio:", currentUser.bio || "");
      if (newBio !== null) currentUser.bio = newBio;
      document.getElementById("profile_bio_display").textContent = currentUser.bio;
    };

    // Change password
    document.getElementById("changePasswordBtn").onclick = async () => {
      const newPassword = prompt("Enter new password:");
      if (!newPassword) return;
      try {
        const res = await fetch("/profile/password", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + authToken
          },
          body: JSON.stringify({ password: newPassword })
        });
        const data = await res.json();
        if (res.ok) {
          const updateProfileToast = document.getElementById("updateProfileToast");
          updateProfileToast.classList.remove("hidden");
          setTimeout(() => updateProfileToast.classList.add("hidden"), 1500);
        } else {
          alert(data.error || "Password update failed");
        }
      } catch (err) {
        alert("Password update error");
      }
    };

    // Delete account
    // Delete Account Modal (Fixed)
  const deleteBtn = document.getElementById("deleteAccountBtn");
  const modal = document.getElementById("deleteModal");
  const cancelBtn = document.getElementById("cancelDelete");
  const confirmBtn = document.getElementById("confirmDelete");

  deleteBtn.onclick = () => modal.classList.remove("hidden");
  cancelBtn.onclick = () => modal.classList.add("hidden");

  confirmBtn.onclick = async () => {
    modal.classList.add("hidden");
    if (!authToken) {
      alert("You must be logged in to delete your account.");
      return;
    }

    try {
      const res = await fetch("/delete-account", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + authToken
        }
      });

      if (res.ok) {
        alert("Account deleted.");
        localStorage.removeItem("authToken");
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || "Delete failed");
      }
    } catch (err) {
      console.error(err);
      alert("Delete error. Please try again.");
    }
  };


    // Logout
    document.getElementById("logoutBtn").onclick = () => {
      authToken = null;
      currentUser = null;
      localStorage.removeItem("authToken");
      profileCard.classList.add("hidden");
      landing.classList.remove("hidden");
    };

    // If already logged in, show profile
    if (authToken) {
      // Try to fetch user info from backend
      fetch("/profile", {
        method: "GET",
        headers: { Authorization: "Bearer " + authToken }
      })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
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
    } else {
      landing.classList.remove("hidden");
      profileCard.classList.add("hidden");
    }

    // Show reset modal
    document.getElementById("forgotPasswordLink").onclick = (e) => {
      e.preventDefault();
      document.getElementById("resetModal").classList.remove("hidden");
      authModal.classList.add("hidden");
    };

    // Close reset modal
    document.getElementById("closeResetModal").onclick = () => {
      document.getElementById("resetModal").classList.add("hidden");
      authModal.classList.remove("hidden");
    };

    // Request password reset
    document.getElementById("resetRequestForm").onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById("reset_email").value;
      const res = await fetch("/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Check your email for a reset link. (In dev, check server console for the link.)");
        document.getElementById("resetModal").classList.add("hidden");
        document.getElementById("resetRequestForm").reset();
        authModal.classList.remove("hidden");
      } else {
        alert(data.error || "Reset request failed");
      }
    };

    // Show set password modal if token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (token) {
      landing.classList.add("hidden");
      authModal.classList.add("hidden");
      profileCard.classList.add("hidden");
      document.getElementById("setPasswordModal").classList.remove("hidden");
    }

    // Close set password modal
    document.getElementById("closeSetPasswordModal").onclick = () => {
      document.getElementById("setPasswordModal").classList.add("hidden");
      landing.classList.remove("hidden");
    };

    // Set new password
    document.getElementById("setPasswordForm").onsubmit = async (e) => {
      e.preventDefault();
      const new_password = document.getElementById("new_password").value;
      const res = await fetch("/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Password reset! Please login.");
        document.getElementById("setPasswordModal").classList.add("hidden");
        landing.classList.remove("hidden");
      } else {
        alert(data.error || "Reset failed");
      }
    };

    // Edit field modal
    const editFieldModal = document.getElementById("editFieldModal");
    const editFieldTitle = document.getElementById("editFieldTitle");
    const editFieldInput = document.getElementById("editFieldInput");
    const cancelEditFieldBtn = document.getElementById("cancelEditFieldBtn");
    const saveEditFieldBtn = document.getElementById("saveEditFieldBtn");

    // Open edit field modal
    function openEditFieldModal(field, value) {
      editFieldTitle.textContent = "Edit " + field.charAt(0).toUpperCase() + field.slice(1);
      editFieldInput.value = value;
      editFieldModal.classList.remove("hidden");
    }

    // Close edit field modal
    cancelEditFieldBtn.onclick = () => {
      editFieldModal.classList.add("hidden");
    };

    // Save edited field
    saveEditFieldBtn.onclick = async () => {
      const title = editFieldTitle.textContent;
      const isPassword = title.toLowerCase().includes("password");
      const field = editFieldTitle.textContent.split(" ")[1].toLowerCase();
      const newValue = editFieldInput.value;
        // Handle password change
      if (isPassword) {
        // re-query dynamic inputs
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
          const endpoints = ["/profile/password", "/profile"];
          let res, data;
          for (const ep of endpoints) {
            res = await fetch(ep, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + authToken
              },
              body: JSON.stringify({ oldPassword, newPassword })
            });
            data = await res.json().catch(() => ({}));
            // if server indicates route not found or method not allowed, try next
            if (res.status === 404 || res.status === 405) continue;
            break;
          }
          if (res.ok) {
            const updateProfileToast = document.getElementById("updateProfileToast");
            updateProfileToast.classList.remove("hidden");
            setTimeout(() => updateProfileToast.classList.add("hidden"), 1500);
            editFieldModal.classList.add("hidden");
            // clear inputs
            oldPasswordEl.value = "";
            newPasswordEl.value = "";
          } else {
            // show server message if present
            alert(data.error || data.message || "Password update failed");
          }
        } catch (err) {
          console.error("Password change error:", err);
          alert("Password update error (see console).");
        }
        return;
      }
      if (!newValue) return;
      try {
        const res = await fetch("/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + authToken
          },
          body: JSON.stringify({ [field]: newValue })
        });
        const data = await res.json();
        if (res.ok) {
          const updateProfileToast = document.getElementById("updateProfileToast");
          updateProfileToast.classList.remove("hidden");
          setTimeout(() => updateProfileToast.classList.add("hidden"), 1500);
          editFieldModal.classList.add("hidden");
          currentUser[field] = newValue;
          document.getElementById("profile_" + field + "_display").textContent = newValue;
          if (field === "name") {
            document.getElementById("profile_name_display_header").textContent = newValue;
          }
        } else {
          alert(data.error || field.charAt(0).toUpperCase() + field.slice(1) + " update failed");
        }
      } catch (err) {
        alert(field.charAt(0).toUpperCase() + field.slice(1) + " update error");
      }
    };

    // Change Password
    document.getElementById("changePasswordBtn").onclick = () => {
      editFieldTitle.textContent = "Change Password";
      // replace input with two password fields
      editFieldInput.outerHTML = `
        <div id="passwordFields" class="flex flex-col gap-3">
          <input type="password" id="oldPasswordInput" placeholder="Enter old password" class="border p-2 rounded">
          <input type="password" id="newPasswordInput" placeholder="Enter new password" class="border p-2 rounded">
        </div>
      `;
      // insert into modal body (replace the single input element)
      const parent = editFieldInput.parentElement || editFieldModal.querySelector('.p-8') || editFieldModal;
      // remove single input safely if exists
      if (editFieldInput && editFieldInput.parentElement) editFieldInput.remove();
      // append container (ensure not duplicated)
      const existing = document.getElementById("passwordFields");
      if (!existing) parent.insertAdjacentHTML("afterbegin", containerHtml);

      editFieldModal.classList.remove("hidden");
      // focus old password
      setTimeout(() => document.getElementById("oldPasswordInput")?.focus(), 50);
    };


    // Edit name
    document.getElementById("editNameBtn").onclick = () => {
      openEditFieldModal("name", currentUser.name);
    };

    // Edit email
    document.getElementById("editEmailBtn").onclick = () => {
      openEditFieldModal("email", currentUser.email);
    };

    // Edit bio
    document.getElementById("editBioBtn").onclick = () => {
      openEditFieldModal("bio", currentUser.bio || "");
    };

    // For Login-Signup toggle button colours
    document.addEventListener("DOMContentLoaded", function () {
      const loginBtn = document.getElementById("showLoginBtn");
      const signupBtn = document.getElementById("showSignupBtn");

      function setActive(isLoginActive) {
        if (isLoginActive) {
          loginBtn.classList.add("text-[#8c52ff]", "bg-white", "shadow");
          loginBtn.classList.remove("text-gray-600");
          signupBtn.classList.add("text-gray-600");
          signupBtn.classList.remove("text-[#29810E]", "bg-white", "shadow");
        } else {
          signupBtn.classList.add("text-[#29810E]", "bg-white", "shadow");
          signupBtn.classList.remove("text-gray-600");
          loginBtn.classList.add("text-gray-600");
          loginBtn.classList.remove("text-[#8c52ff]", "bg-white", "shadow");
        }
      }

      loginBtn.addEventListener("click", function () {
        setActive(true);
        // Show login form, hide signup form if needed
        document.getElementById("loginForm").classList.remove("hidden");
        document.getElementById("signupForm").classList.add("hidden");
      });

      signupBtn.addEventListener("click", function () {
        setActive(false);
        // Show signup form, hide login form if needed
        document.getElementById("signupForm").classList.remove("hidden");
        document.getElementById("loginForm").classList.add("hidden");
      });

      // Set initial state (Login active by default)
      setActive(true);
    });

    // Accessbility Settings
    document.addEventListener("DOMContentLoaded", () => {
      const darkToggle = document.getElementById("darkModeToggle");
      const catToggle = document.getElementById("catModeToggle");

      if (!darkToggle || !catToggle) return; // safety check

        // Dark Mode toggle
      // darkToggle.addEventListener("change", () => {
      //   document.documentElement.classList.toggle("dark", darkToggle.checked);
      //   localStorage.setItem("darkMode", darkToggle.checked);
      // });

      // Cat Mode toggle
      catToggle.addEventListener("change", () => {
        if (catToggle.checked) {
          document.body.classList.add("cat-mode");
          const meow = new Audio("https://www.myinstants.com/media/sounds/gary_meow.mp3");
          meow.play();
          const catToast = document.getElementById("catToast");
          catToast.classList.remove("hidden");
          setTimeout(() => catToast.classList.add("hidden"), 2000);
        } else {
          document.body.classList.remove("cat-mode");
        }
        localStorage.setItem("catMode", catToggle.checked);
      });

      // Load saved settings on page load
      // if (localStorage.getItem("darkMode") === "true") {
      //   darkToggle.checked = true;
      //   document.documentElement.classList.add("dark");
      // }
      if (localStorage.getItem("catMode") === "true") {
        catToggle.checked = true;
        document.body.classList.add("cat-mode");
      }
    });


    