/**
 * The search combobox: type-ahead over /api/suggest.
 *
 * This is a progressive enhancement. With the file blocked or broken, every
 * search field is still a plain form that submits to /ask, and a name still
 * resolves. Nothing in the markup depends on the script.
 *
 * The field keeps focus while the list is open, and `aria-activedescendant`
 * names the highlighted row, so a screen reader reads the option without a
 * second focus ring. The pattern is the ARIA 1.2 combobox with a listbox popup.
 *
 * The popup's position is set here rather than in `views/css.ts`, because #7
 * may not touch that file: #33/#34 own it and the lane contract serialises it.
 * The rows reuse `.results`, `.rn` and `.rk`, so the typography still comes from
 * the one stylesheet; only the popup box and its open state live in this file.
 */
(() => {
  "use strict";

  const MIN_CHARS = 2;
  const DEBOUNCE_MS = 120;
  /** The track fill already in css.ts, reused so the highlight is not a new colour. */
  const ACTIVE_FILL = "#F0EEE6";

  let serial = 0;

  /** "PA · county · 1,579,706". Null fields drop out rather than print "null". */
  function metaText(suggestion) {
    const parts = [];
    if (suggestion.stateCode) parts.push(suggestion.stateCode);
    if (suggestion.kind) parts.push(suggestion.kind);
    if (typeof suggestion.population === "number") {
      parts.push(suggestion.population.toLocaleString("en-US"));
    }
    return parts.join(" · ");
  }

  function enhance(input) {
    if (input.dataset.combobox === "on") return;
    input.dataset.combobox = "on";

    const listId = `suggest-list-${(serial += 1)}`;
    let items = [];
    let active = -1;
    let timer = 0;
    let controller = null;
    /** What the box held when this session began: Escape puts it back. */
    let restoreValue = input.value;

    // The popup is positioned against the input, so the input needs a positioned
    // parent. A wrapping block is layout-neutral for a 100%-wide input.
    const anchor = document.createElement("div");
    anchor.style.position = "relative";
    input.parentNode.insertBefore(anchor, input);
    anchor.appendChild(input);

    const list = document.createElement("ul");
    list.className = "results";
    list.id = listId;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Places");
    list.style.position = "absolute";
    list.style.left = "0";
    list.style.right = "0";
    list.style.top = "calc(100% + 4px)";
    list.style.zIndex = "20";
    list.style.margin = "0";
    list.style.padding = ".2rem .65rem";
    list.style.background = "#fff";
    list.style.border = "1px solid var(--rule2)";
    list.style.borderRadius = "8px";
    list.style.maxHeight = "min(60vh, 22rem)";
    list.style.overflowY = "auto";
    list.style.display = "none";
    anchor.appendChild(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("autocomplete", "off");

    function paint() {
      const options = list.children;
      for (let i = 0; i < options.length; i += 1) {
        const on = i === active;
        options[i].setAttribute("aria-selected", on ? "true" : "false");
        options[i].style.background = on ? ACTIVE_FILL : "";
      }
      const chosen = active >= 0 ? options[active] : null;
      if (chosen) {
        input.setAttribute("aria-activedescendant", chosen.id);
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    function close() {
      list.style.display = "none";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
      paint();
    }

    function open() {
      list.style.display = "block";
      input.setAttribute("aria-expanded", "true");
    }

    function go(geoid) {
      window.location.assign(`/p/${encodeURIComponent(geoid)}`);
    }

    function render() {
      list.textContent = "";
      items.forEach((suggestion, index) => {
        const option = document.createElement("li");
        option.id = `${listId}-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.style.display = "flex";
        option.style.alignItems = "baseline";
        option.style.justifyContent = "space-between";
        option.style.gap = ".75rem";
        option.style.padding = ".55rem .2rem";
        option.style.cursor = "pointer";

        const name = document.createElement("span");
        name.className = "rn";
        name.textContent = suggestion.name;
        name.style.minWidth = "0";
        name.style.overflow = "hidden";
        name.style.textOverflow = "ellipsis";
        name.style.whiteSpace = "nowrap";

        const meta = document.createElement("span");
        meta.className = "rk";
        meta.textContent = metaText(suggestion);
        meta.style.flex = "none";

        option.append(name, meta);
        option.addEventListener("mouseenter", () => {
          active = index;
          paint();
        });
        option.addEventListener("click", () => go(suggestion.geoid));
        list.appendChild(option);
      });

      const last = list.lastElementChild;
      if (last) last.style.borderBottom = "0";
      if (items.length) open(); else close();
      paint();
    }

    function abort() {
      if (controller) {
        controller.abort();
        controller = null;
      }
    }

    async function fetchSuggestions(query) {
      abort();
      const mine = new AbortController();
      controller = mine;
      try {
        const response = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, {
          signal: mine.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (mine !== controller) return;
        if (input.value.trim() !== query) return;
        items = Array.isArray(data.suggestions) ? data.suggestions : [];
        active = -1;
        render();
      } catch (error) {
        if (error && error.name === "AbortError") return;
        items = [];
        close();
      }
    }

    input.addEventListener("input", () => {
      const query = input.value.trim();
      window.clearTimeout(timer);
      abort();
      items = [];
      close();
      if (query.length < MIN_CHARS) return;
      timer = window.setTimeout(() => {
        void fetchSuggestions(query);
      }, DEBOUNCE_MS);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!items.length) return;
        event.preventDefault();
        const count = items.length;
        active = event.key === "ArrowDown" ? (active + 1) % count : (active - 1 + count) % count;
        paint();
        return;
      }
      if (event.key === "Enter") {
        const chosen = active >= 0 ? items[active] : null;
        if (chosen) {
          event.preventDefault();
          go(chosen.geoid);
        }
        return;
      }
      if (event.key === "Escape") {
        // Escape cancels the edit: close the popup and put back what the box
        // held when this session began. On an empty box that clears the field,
        // which is what a search input does anyway.
        event.preventDefault();
        abort();
        window.clearTimeout(timer);
        items = [];
        list.textContent = "";
        input.value = restoreValue;
        close();
      }
    });

    input.addEventListener("focus", () => {
      restoreValue = input.value;
    });
    input.addEventListener("blur", close);
    // Keep focus in the input while a pointer drags the list's scrollbar.
    list.addEventListener("mousedown", (event) => event.preventDefault());
  }

  document.querySelectorAll('input[type="search"][name="q"]').forEach(enhance);
})();
