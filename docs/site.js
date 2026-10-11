const installCmd = document.getElementById("install-cmd");
const copyStatus = document.getElementById("copy-status");
const copyStatusCommands = document.getElementById("copy-status-commands");
const installPanel = document.getElementById("install-cmd-panel");
const installTabs = Array.from(document.querySelectorAll(".install-tab"));
const copyButtons = Array.from(document.querySelectorAll(".copy-cmd, #copy-install"));

function selectCommandText(codeEl) {
  if (!codeEl) return;
  const range = document.createRange();
  range.selectNodeContents(codeEl);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function statusForButton(button) {
  if (button.id === "copy-install" || button.closest(".chapel-install")) {
    return copyStatus;
  }
  return copyStatusCommands;
}

function resetCopyButton(button) {
  button.dataset.copied = "false";
  button.textContent = "Copy";
}

function resetAllCopyButtons() {
  for (const button of copyButtons) {
    resetCopyButton(button);
  }
  if (copyStatus) copyStatus.textContent = "";
  if (copyStatusCommands) copyStatusCommands.textContent = "";
}

function codeForButton(button) {
  const targetId = button.getAttribute("data-copy-target");
  if (targetId) return document.getElementById(targetId);
  if (button.id === "copy-install") return installCmd;
  return button.previousElementSibling?.tagName === "CODE"
    ? button.previousElementSibling
    : null;
}

async function copyFromButton(button) {
  const codeEl = codeForButton(button);
  const statusEl = statusForButton(button);
  const text = codeEl?.textContent?.trim() ?? "";

  try {
    await navigator.clipboard.writeText(text);
    for (const other of copyButtons) {
      if (other !== button) resetCopyButton(other);
    }
    if (copyStatus && statusEl !== copyStatus) copyStatus.textContent = "";
    if (copyStatusCommands && statusEl !== copyStatusCommands) {
      copyStatusCommands.textContent = "";
    }

    button.dataset.copied = "true";
    button.textContent = "Copied";
    if (statusEl) statusEl.textContent = "Copied";
    window.setTimeout(() => {
      if (button.dataset.copied === "true") {
        resetCopyButton(button);
        if (statusEl) statusEl.textContent = "";
      }
    }, 1600);
  } catch {
    selectCommandText(codeEl);
    button.textContent = "Copy";
    if (statusEl) {
      statusEl.textContent = "Select the command and copy it manually";
    }
  }
}

function selectInstaller(tab) {
  if (!tab || !installCmd || !installPanel) return;

  const command = tab.dataset.cmd?.trim() ?? "";
  installCmd.textContent = command;
  installPanel.setAttribute("aria-labelledby", tab.id);

  for (const item of installTabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", selected ? "true" : "false");
    item.tabIndex = selected ? 0 : -1;
  }

  resetAllCopyButtons();
}

if (installTabs.length > 0) {
  for (const tab of installTabs) {
    tab.addEventListener("click", () => {
      selectInstaller(tab);
      tab.focus();
    });

    tab.addEventListener("keydown", (event) => {
      const index = installTabs.indexOf(tab);
      if (index < 0) return;

      let nextIndex = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (index + 1) % installTabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (index - 1 + installTabs.length) % installTabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = installTabs.length - 1;
      }

      if (nextIndex < 0) return;
      event.preventDefault();
      const next = installTabs[nextIndex];
      selectInstaller(next);
      next.focus();
    });
  }
}

for (const button of copyButtons) {
  button.addEventListener("click", () => {
    void copyFromButton(button);
  });
}

const ritual = document.getElementById("ritual");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (ritual) {
  if (reduceMotion || !("IntersectionObserver" in window)) {
    ritual.classList.add("is-in");
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -5% 0px" }
    );
    io.observe(ritual);
  }
}
