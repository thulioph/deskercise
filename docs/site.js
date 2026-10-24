// Deskercise landing page interactions: benefit-card reveal,
// interactive terminal demo, and install tabs / copy buttons.
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----- Benefit cards: reveal on scroll ----- */
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  if (cards.length > 0) {
    if ("IntersectionObserver" in window && !reduceMotion) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      cards.forEach(function (card, i) {
        card.style.transitionDelay = i * 70 + "ms";
        io.observe(card);
      });
    } else {
      cards.forEach(function (card) {
        card.classList.add("in");
      });
    }
  }

  /* ----- Interactive terminal demo ----- */
  var term = document.getElementById("term");
  var body = document.getElementById("term-body");

  if (term && body && !reduceMotion) {
    var caret = '<span class="term-caret"></span>';
    var mode = "idle";

    function print(text, cls) {
      var el = document.createElement("div");
      el.className = "tl" + (cls ? " " + cls : "");
      el.innerHTML = text;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
      return el;
    }

    function clearLines() {
      while (body.firstChild) {
        body.removeChild(body.firstChild);
      }
    }

    function headerSync() {
      var el = document.createElement("div");
      el.className = "tl key";
      el.textContent = "$ deskercise start";
      body.appendChild(el);
    }

    function typeHeader(cb) {
      var el = document.createElement("div");
      el.className = "tl key";
      el.textContent = "$ ";
      body.appendChild(el);
      var word = "deskercise start";
      var i = 0;
      var iv = window.setInterval(function () {
        el.textContent = "$ " + word.slice(0, ++i);
        if (i >= word.length) {
          window.clearInterval(iv);
          if (cb) cb();
        }
      }, 45);
    }

    function waiting() {
      mode = "idle";
      clearLines();
      headerSync();
      print("waiting 45m …" + caret, "dim");
      window.setTimeout(function () {
        if (mode === "idle") {
          breakScreen();
        }
      }, 1500);
    }

    function boot() {
      mode = "idle";
      clearLines();
      typeHeader(function () {
        if (mode !== "idle") return;
        print("waiting 45m …" + caret, "dim");
        window.setTimeout(function () {
          if (mode === "idle") {
            breakScreen();
          }
        }, 1500);
      });
    }

    function breakScreen() {
      mode = "break";
      clearLines();
      headerSync();
      print("Break · Gentle neck turns", "hl");
      print("  [1] start   [2] skip   [3] snooze" + caret, "key");
    }

    function pauseThenReset(text, cls) {
      mode = "pause";
      clearLines();
      headerSync();
      print(text, cls);
      window.setTimeout(function () {
        if (mode === "pause") {
          waiting();
        }
      }, 1500);
    }

    // Demo countdown runs faster than the real 60 seconds so visitors
    // can experience the full start → confirm loop in a few seconds.
    function startCountdown() {
      mode = "count";
      clearLines();
      headerSync();
      print("Break · Gentle neck turns", "hl");
      var timerLine = print("");
      print("  sit upright · look gently left, then right", "dim");
      var t = 60;
      var iv = window.setInterval(function () {
        t--;
        if (t <= 0) {
          window.clearInterval(iv);
          timerLine.innerHTML = "&#9654; 0:00";
          mode = "confirm";
          print("Completed?  [y] / [n]" + caret, "hl");
          return;
        }
        timerLine.innerHTML = "&#9654; 0:" + (t < 10 ? "0" + t : t);
      }, 70);
    }

    function onKey(e) {
      if (document.activeElement !== term) return;
      var k = e.key.toLowerCase();

      if (mode === "break") {
        if (k === "1") {
          e.preventDefault();
          startCountdown();
        } else if (k === "2") {
          e.preventDefault();
          pauseThenReset("  skipped — next break in 45m", "dim");
        } else if (k === "3") {
          e.preventDefault();
          pauseThenReset("  snoozed — same exercise returns in 10m", "dim");
        }
      } else if (mode === "count") {
        if (k === "s") {
          e.preventDefault();
          pauseThenReset("stopped early — no minutes added", "dim");
        }
      } else if (mode === "confirm") {
        if (k === "y") {
          e.preventDefault();
          pauseThenReset("&#10003; completed — 60 seconds confirmed", "hl");
        } else if (k === "n") {
          e.preventDefault();
          pauseThenReset("unconfirmed — no minutes added", "dim");
        }
      }
    }

    term.addEventListener("keydown", onKey);
    term.addEventListener("click", function () {
      term.focus();
    });
    boot();
  }

  /* ----- Install tabs + copy ----- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var cmdEl = document.getElementById("install-cmd");
  var copyBtn = document.getElementById("copy-btn");

  var commands = {
    npm: "npm install --global @thulioph/deskercise",
    pnpm: "pnpm add --global @thulioph/deskercise",
    yarn: "yarn global add @thulioph/deskercise",
    bun: "bun add --global @thulioph/deskercise",
  };

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      var pm = tab.getAttribute("data-pm");
      if (cmdEl && commands[pm]) {
        cmdEl.textContent = commands[pm];
      }
      if (copyBtn) {
        copyBtn.textContent = "copy";
        copyBtn.classList.remove("done");
      }
    });
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = cmdEl ? cmdEl.textContent.trim() : commands.npm;
      var done = function () {
        copyBtn.textContent = "copied ✓";
        copyBtn.classList.add("done");
        window.setTimeout(function () {
          copyBtn.textContent = "copy";
          copyBtn.classList.remove("done");
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(done)
          .catch(function () {
            if (fallbackCopy(text)) done();
          });
      } else if (fallbackCopy(text)) {
        done();
      }
    });
  }
})();
