/* login.html and register.html */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const msg = $("message");
  const show = (text, type) => { msg.textContent = text; msg.className = "message show " + type; };
  $("year").textContent = new Date().getFullYear();
  if (HEC.sync.enabled) {          // online accounts: say so instead of the browser-only demo notice
    const note = document.querySelector(".security-note");
    if (note) note.textContent = "Your account is stored securely online, so you can sign in on any phone or computer.";
    const terms = document.querySelector('label[for="terms"]');
    if (terms) terms.textContent = "I understand that my results are saved to my online account.";
  }

  if ($("loginForm")) {
    const email = $("email"), password = $("password"), remember = $("rememberEmail");
    $("togglePassword").addEventListener("click", function () {
      const visible = password.type === "text";
      password.type = visible ? "password" : "text";
      this.textContent = visible ? "Show" : "Hide";
    });
    try { const saved = localStorage.getItem("hec_remembered_email"); if (saved) { email.value = saved; remember.checked = true; } } catch (e) { /* storage unavailable */ }
    $("loginForm").addEventListener("submit", async e => {
      e.preventDefault(); msg.className = "message";
      try {
        await HEC.auth.login(email.value, password.value);
        try {
          if (remember.checked) localStorage.setItem("hec_remembered_email", email.value.trim().toLowerCase());
          else localStorage.removeItem("hec_remembered_email");
        } catch (err) { /* ignore */ }
        show("Login successful. Opening your dashboard…", "success");
        location.href = "dashboard.html";
      } catch (err) { show(err.message || "Login failed. Please try again.", err.info ? "success" : "error"); }
    });
  }

  if ($("registerForm")) {
    document.querySelectorAll(".show-password").forEach(button => button.addEventListener("click", () => {
      const input = $(button.dataset.target), visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "Show" : "Hide";
    }));
    $("registerForm").addEventListener("submit", async e => {
      e.preventDefault(); msg.className = "message";
      const fullName = $("fullName").value.trim(), email = $("email").value.trim().toLowerCase(), grade = $("grade").value,
            password = $("password").value, confirm = $("confirmPassword").value;
      if (fullName.length < 2) return show("Please enter your full name.", "error");
      if (!email) return show("Please enter a valid email address.", "error");
      if (!["6", "8", "12"].includes(grade)) return show("Please choose Grade 6, Grade 8, or Grade 12.", "error");
      if (password.length < 8) return show("Your password must contain at least 8 characters.", "error");
      if (password !== confirm) return show("The passwords do not match.", "error");
      if (!$("terms").checked) return show("Please confirm the demo account notice.", "error");
      const submit = $("submitButton");
      submit.disabled = true;
      try {
        await HEC.auth.register({ fullName, email, grade, password });
        show("Account created. Opening your dashboard…", "success");
        location.href = "dashboard.html";
      } catch (err) { show(err.message || "Could not create your account. Please try again.", err.info ? "success" : "error"); }
      finally { submit.disabled = false; }
    });
  }
})();
