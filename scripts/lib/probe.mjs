/**
 * What the gate measures inside the page.
 *
 * This function is serialised and evaluated in the browser, so it must be
 * self-contained: no imports, no closure over anything outside its own body.
 * It returns raw numbers; every judgement about them lives in design-check.mjs.
 */

export function probe() {
  const rgb = (value) => {
    const match = String(value).match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const ratio = (foreground, background) => {
    const a = luminance(foreground);
    const b = luminance(background);
    const [light, dark] = a > b ? [a, b] : [b, a];
    return (light + 0.05) / (dark + 0.05);
  };

  /** The first ancestor (or self) that actually paints a background. */
  const groundOf = (element) => {
    let node = element;
    while (node && node !== document.documentElement) {
      const colour = rgb(getComputedStyle(node).backgroundColor);
      if (colour && colour.a > 0.9) return colour;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const cls = typeof element.className === "string" && element.className.trim()
      ? `.${element.className.trim().split(/\s+/).join(".")}`
      : "";
    return `${element.tagName.toLowerCase()}${id}${cls}`;
  };

  /** Text a reader sees directly in this element, ignoring children's text. */
  const ownText = (element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent.trim())
      .join(" ")
      .trim();

  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((element) => {
    const style = getComputedStyle(element);
    return {
      element: describe(element),
      size: Math.round(parseFloat(style.fontSize) * 10) / 10,
      text: (element.textContent || "").trim().slice(0, 48),
      isPlace: /(^|\s)place(\s|$)/.test(element.className) || element.dataset.role === "place",
      isScore: /(^|\s)score(\s|$)/.test(element.className) || element.dataset.role === "score",
    };
  });

  const shadows = [];
  for (const element of document.querySelectorAll("body *")) {
    const style = getComputedStyle(element);
    if (style.boxShadow && style.boxShadow !== "none") {
      shadows.push({
        element: describe(element),
        shadow: style.boxShadow,
        isSearch: Boolean(element.closest("form.search")) || element.type === "search",
      });
    }
  }

  const charts = [...document.querySelectorAll("svg")].map((svg) => {
    const series = svg.querySelectorAll("polyline").length + svg.querySelectorAll("rect").length;
    const dashed = svg.querySelectorAll("[stroke-dasharray]").length;
    const parent = svg.parentElement;
    return {
      element: describe(svg),
      series,
      twoSeries: dashed > 0,
      legend: Boolean(parent && parent.querySelector(".legend,[data-legend]")),
      labelled: Boolean(
        svg.getAttribute("aria-label") ||
          svg.getAttribute("role") === "img" ||
          svg.getAttribute("aria-hidden") === "true",
      ),
    };
  });

  const panels = [...document.querySelectorAll(".metric,[data-panel]")].map((element) => ({
    element: describe(element),
    label: (element.querySelector(".label")?.textContent || "").trim().slice(0, 40),
    visual: Boolean(element.querySelector("svg,.compare,[data-visual]")),
    empty: Boolean(element.querySelector(".missing")),
  }));

  const numbers = [...document.querySelectorAll("[data-number]")].map((element) => ({
    element: describe(element),
    text: (element.textContent || "").trim().slice(0, 24),
    numeric: getComputedStyle(element).fontVariantNumeric,
    size: Math.round(parseFloat(getComputedStyle(element).fontSize) * 10) / 10,
  }));

  const contrast = [];
  for (const element of document.querySelectorAll("body *")) {
    const text = ownText(element);
    if (!text) continue;
    if (element.closest("svg")) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    const foreground = rgb(style.color);
    const background = groundOf(element);
    if (!foreground) continue;
    const blend = foreground.a < 1
      ? {
          r: foreground.r * foreground.a + background.r * (1 - foreground.a),
          g: foreground.g * foreground.a + background.g * (1 - foreground.a),
          b: foreground.b * foreground.a + background.b * (1 - foreground.a),
        }
      : foreground;
    contrast.push({
      element: describe(element),
      text: text.slice(0, 32),
      ratio: Math.round(ratio(blend, background) * 100) / 100,
      size: Math.round(parseFloat(style.fontSize) * 10) / 10,
      weight: style.fontWeight,
    });
  }
  contrast.sort((a, b) => a.ratio - b.ratio);

  const topbar = document.querySelector(".topbar,[data-topbar]");
  const smallest = contrast.reduce((min, row) => Math.min(min, row.size), 99);

  return {
    headings,
    shadows,
    charts,
    panels,
    numbers,
    contrast: contrast.slice(0, 8),
    contrastCount: contrast.length,
    topbarSearch: Boolean(topbar && topbar.querySelector("input[type=search]")),
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    smallestText: smallest,
    chartCount: charts.length,
  };
}
