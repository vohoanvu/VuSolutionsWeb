// Mobile navigation toggle
(function () {
    const toggle = document.querySelector(".navbar__toggle");
    const links = document.getElementById("nav-links");
    if (!toggle || !links) return;

    const setOpen = (open) => {
        toggle.setAttribute("aria-expanded", String(open));
        links.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    links.addEventListener("click", (event) => {
        if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setOpen(false);
    });
})();
