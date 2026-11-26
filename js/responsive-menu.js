const mobileMenu = window.matchMedia("(max-width: 650px)");

document.querySelectorAll(".responsive-menu").forEach((menu) => {
  const toggle = menu.querySelector(".responsive-menu-toggle");
  const panel = document.getElementById(toggle.getAttribute("aria-controls"));

  function closeMenu(restoreFocus = false) {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (restoreFocus) toggle.focus({ preventScroll: true });
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    if (toggle.getAttribute("aria-expanded") === "true") {
      closeMenu(true);
      return;
    }
    toggle.setAttribute("aria-expanded", "true");
    toggle.focus({ preventScroll: true });
  });

  panel.addEventListener("click", (event) => {
    if (event.target.closest("a[href], button")) {
      closeMenu(panel.contains(document.activeElement));
    }
  });

  menu.addEventListener("focusout", (event) => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) closeMenu();
  });

  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true")
      return;
    event.preventDefault();
    closeMenu(true);
  });

  document.addEventListener("click", (event) => {
    if (!toggle.contains(event.target) && !panel.contains(event.target)) closeMenu();
  });

  mobileMenu.addEventListener("change", () => closeMenu());
  window.addEventListener("pagehide", () => closeMenu());
});
