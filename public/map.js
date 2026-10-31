/*
 * A small map: where this place is, and how it is shaped.
 *
 * MapLibre for the rendering, OpenFreeMap for the tiles, and the outline from
 * our own origin so it draws when the tiles do not. The style is written here
 * rather than fetched, because a style document from a third party is a third
 * party that can change what our page looks like.
 *
 * Nothing here is required. Without JavaScript the outline is not drawn and the
 * rest of the page is unchanged.
 */
(function () {
  "use strict";

  var host = document.querySelector("[data-map]");
  if (!host || !window.maplibregl) return;

  var geoid = host.getAttribute("data-geoid");
  var center = JSON.parse(host.getAttribute("data-center") || "null");
  if (!geoid || !center) return;

  var map;
  try {
    map = new maplibregl.Map({
      container: host,
      style: {
        version: 8,
        sources: {
          openfreemap: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
        },
        layers: [
          { id: "paper", type: "background", paint: { "background-color": "#FCFBF8" } },
          {
            id: "water",
            type: "fill",
            source: "openfreemap",
            "source-layer": "water",
            paint: { "fill-color": "#E6EDEF" },
          },
          {
            id: "roads",
            type: "line",
            source: "openfreemap",
            "source-layer": "transportation",
            filter: ["in", "class", "motorway", "trunk", "primary"],
            paint: { "line-color": "#D8D5CC", "line-width": 0.8 },
          },
        ],
      },
      center: center,
      zoom: host.getAttribute("data-zoom") ? Number(host.getAttribute("data-zoom")) : 8,
      attributionControl: false,
      interactive: false,
    });
  } catch (error) {
    // No WebGL, a blocked canvas, an old browser. Say so in the space the map
    // would have used rather than leaving a grey rectangle or nothing at all.
    host.classList.add("map-failed");
    host.innerHTML = '<p class="mapnote">This browser did not give the map a canvas to draw on. The outline is at <a href="/boundaries/' +
      geoid + '.json">/boundaries/' + geoid + '.json</a>.</p>';
    return;
  }

  map.on("load", function () {
    map.addSource("outline", { type: "geojson", data: "/boundaries/" + geoid + ".json" });
    map.addLayer({
      id: "outline-fill",
      type: "fill",
      source: "outline",
      paint: { "fill-color": "#009689", "fill-opacity": 0.08 },
    });
    map.addLayer({
      id: "outline-line",
      type: "line",
      source: "outline",
      paint: { "line-color": "#009689", "line-width": 1.4 },
    });
  });

  // With no tiles, the outline is still drawn: the source is ours.
  map.on("error", function () {
    host.classList.add("map-tiles-down");
  });
})();
