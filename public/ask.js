/*
 * The question box, while it waits.
 *
 * A question can take five seconds, and for five seconds the old page sat there
 * looking exactly like a page that had ignored the click. This shows the
 * question, then three named steps, and the last one waits for the answer.
 *
 * No framework, no build step, and nothing here is required: with JavaScript off
 * the form posts and the server answers with the same page.
 */
(function () {
  "use strict";

  var STEPS = ["Reading the question", "Finding the place", "Pulling the number"];
  var STEP_AT = [0, 900, 2200];

  function panel(question) {
    var wrap = document.createElement("div");
    wrap.className = "ask-loading";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");
    wrap.innerHTML =
      '<p class="crumb">You asked</p>' +
      '<p class="ask-q"></p>' +
      '<p class="ask-step"></p>';
    wrap.querySelector(".ask-q").textContent = question;
    return wrap;
  }

  function announce(wrap, step) {
    var line = wrap.querySelector(".ask-step");
    if (line) line.textContent = STEPS[step] + "\u2026";
  }

  function fail(wrap, message) {
    wrap.innerHTML =
      '<p class="crumb">You asked</p>' +
      '<p class="ask-q"></p>' +
      '<p class="ask-step"></p>';
    wrap.querySelector(".ask-q").textContent = wrap.dataset.question || "";
    var line = wrap.querySelector(".ask-step");
    if (line) line.textContent = message;
    wrap.classList.add("ask-failed");
  }

  function replace(html) {
    document.open();
    document.write(html);
    document.close();
  }

  function intercept(form) {
    form.addEventListener("submit", function (event) {
      if (event.defaultPrevented) return;
      var field = form.querySelector('input[name="q"]');
      var question = field && field.value ? field.value.trim() : "";
      if (!question) return; // let the server redirect to the front page

      event.preventDefault();

      var shell = document.querySelector(".wrap") || document.body;
      var existing = document.querySelector(".ask-loading");
      if (existing) existing.remove();

      var still = panel(question);
      still.dataset.question = question;
      var hero = document.querySelector(".hero");
      if (hero) hero.style.display = "none";
      shell.insertBefore(still, shell.firstChild);
      announce(still, 0);

      var step = 0;
      var timer = setInterval(function () {
        if (step < STEPS.length - 1) {
          step += 1;
          announce(still, step);
        }
      }, STEP_AT[Math.min(step + 1, STEP_AT.length - 1)] || 900);

      // The last step waits. Nothing here claims the answer has arrived.
      var url = "/ask?q=" + encodeURIComponent(question);
      fetch(url, { headers: { accept: "text/html" } })
        .then(function (response) {
          return response.text().then(function (html) {
            clearInterval(timer);
            if (html && html.indexOf("<html") !== -1) {
              if (window.history && window.history.pushState) {
                window.history.pushState({ q: question }, "", url);
              }
              replace(html);
            } else {
              fail(still, "The server sent something unreadable. Reload and try again.");
            }
          });
        })
        .catch(function () {
          clearInterval(timer);
          fail(still, "We could not reach the server. Check your connection and try again.");
        });
    });
  }

  var forms = document.querySelectorAll('form[action="/ask"]');
  for (var i = 0; i < forms.length; i += 1) intercept(forms[i]);
})();
