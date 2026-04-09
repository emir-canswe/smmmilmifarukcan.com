(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var menuBtn = document.getElementById("menu-toggle");
  var nav = document.getElementById("site-nav");
  var yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  function setHeaderScrolled() {
    if (!header) return;
    if (window.scrollY > 24) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  }

  window.addEventListener("scroll", setHeaderScrolled, { passive: true });
  setHeaderScrolled();

  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var headerH = header ? header.offsetHeight : 72;
      var top = target.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo({ top: top, behavior: "smooth" });
    });
  });

  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      obs.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  var form = document.getElementById("contact-form");
  var statusEl = document.getElementById("form-status");
  var submitBtn = document.getElementById("submit-btn");

  if (!form || !statusEl) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.textContent = "";
    statusEl.className = "form-status";

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var payload = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      message: document.getElementById("message").value.trim(),
    };

    submitBtn.disabled = true;
    var prevLabel = submitBtn.textContent;
    submitBtn.textContent = "Gönderiliyor…";

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.ok) {
          statusEl.textContent = "Teşekkürler. Mesajınız alındı; en kısa sürede size dönüş yapılacaktır.";
          statusEl.classList.add("is-ok");
          form.reset();
        } else {
          var msg =
            result.data && result.data.error
              ? result.data.error
              : "Gönderim başarısız. Lütfen daha sonra tekrar deneyin.";
          statusEl.textContent = msg;
          statusEl.classList.add("is-error");
        }
      })
      .catch(function () {
        statusEl.textContent = "Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.";
        statusEl.classList.add("is-error");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = prevLabel;
      });
  });
})();
