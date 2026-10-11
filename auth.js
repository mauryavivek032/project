// Simple name sign-in (no Firebase, no Google, no phone OTP).
// script.js reads the saved name at start-up, so the page reloads after sign-in / sign-out.
(function () {
  const USER_KEY = "waste2power.currentUser.v1";
  const splash = document.getElementById("splashScreen");
  const loginScreen = document.getElementById("loginScreen");
  const appShell = document.getElementById("appShell");
  const form = document.getElementById("loginForm");
  const nameInput = document.getElementById("loginName");
  const errorBox = document.getElementById("loginError");

  function readUser() { try { return (localStorage.getItem(USER_KEY) || "").trim(); } catch (_) { return ""; } }
  function finishSplash() {
    splash.classList.add("done");
    setTimeout(() => { splash.hidden = true; }, 400);
  }

  // Keep the intro screen for about two seconds.
  setTimeout(() => {
    finishSplash();
    if (readUser()) {
      loginScreen.hidden = true;
      appShell.hidden = false;
    } else {
      appShell.hidden = true;
      loginScreen.hidden = false;
      nameInput.focus();
    }
  }, 2000);

  form.addEventListener("submit", e => {
    e.preventDefault();
    errorBox.textContent = "";
    const name = nameInput.value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);
    if (name.length < 2) { errorBox.textContent = "Please enter at least 2 characters."; return; }
    try { localStorage.setItem(USER_KEY, name); }
    catch (_) { errorBox.textContent = "Browser storage is blocked, so your name cannot be saved."; return; }
    location.reload();
  });

  window.addEventListener("w2p:signout", () => {
    try { localStorage.removeItem(USER_KEY); } catch (_) {}
    location.reload();
  });
})();
