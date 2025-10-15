
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

    // Show modal
    document.getElementById("getStartedBtn").onclick = () => {
      authModal.classList.remove("hidden");
      landing.classList.add("hidden");
      showLogin();
    };

    closeAuthModal.onclick = () => {
      authModal.classList.add("hidden");
      landing.classList.remove("hidden");
    };

    showLoginBtn.onclick = showLogin;
    showSignupBtn.onclick = showSignup;

    function showLogin() {
      loginForm.classList.remove("hidden");
      signupForm.classList.add("hidden");
    }
    function showSignup() {
      loginForm.classList.add("hidden");
      signupForm.classList.remove("hidden");
    }

    
  // --- Toggle buttons ---
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

    // Save profile
    document.getElementById("saveProfileBtn").onclick = async () => {
      try {
        const res = await fetch("/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + authToken
          },
          body: JSON.stringify({ name: currentUser.name, email: currentUser.email, bio: currentUser.bio })
        });
        const data = await res.json();
        if (res.ok) {
          alert("Profile updated!");
        } else {
          alert(data.error || "Profile update failed");
        }
      } catch (err) {
        alert("Profile update error");
      }
    };

    // Change password
    document.getElementById("changePasswordBtn").onclick = async () => {
      const newPassword = prompt("Enter new password:");
      if (!newPassword) return;
      try {
        const res = await fetch("/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + authToken
          },
          body: JSON.stringify({ password: newPassword })
        });
        const data = await res.json();
        if (res.ok) {
          alert("Password updated!");
        } else {
          alert(data.error || "Password update failed");
        }
      } catch (err) {
        alert("Password update error");
      }
    };

    // Delete account
    document.getElementById("deleteAccountBtn").onclick = async () => {
      if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
      try {
        const res = await fetch("/profile", {
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
        alert("Delete error");
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
      const field = editFieldTitle.textContent.split(" ")[1].toLowerCase();
      const newValue = editFieldInput.value;
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
          alert(field.charAt(0).toUpperCase() + field.slice(1) + " updated!");
          editFieldModal.classList.add("hidden");
          currentUser[field] = newValue;
          document.getElementById("profile_" + field + "_display").textContent = newValue;
        } else {
          alert(data.error || field.charAt(0).toUpperCase() + field.slice(1) + " update failed");
        }
      } catch (err) {
        alert(field.charAt(0).toUpperCase() + field.slice(1) + " update error");
      }
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