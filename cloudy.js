/*
 * Cloudy – gemeinsame Live-Daten für Variante A und B
 * Holt beim Öffnen der Seite das aktuelle Wetter für Hamburg von Open-Meteo
 * (kein API-Schlüssel nötig) und schreibt die Werte in alle Elemente mit
 * data-w="…". Das Aussehen bestimmt jede Variante selbst über CSS.
 *
 * Test-Schalter für das KI-Logbuch (Kür):
 *   ?wetter=klar|wolken|nebel|regen|schnee   erzwingt einen Wetterzustand
 *   ?nacht=1  /  ?nacht=0                     erzwingt Nacht oder Tag
 *   ?fehler=1                                 simuliert eine kaputte API-Adresse
 *   ?laden=1                                  bleibt im Ladezustand stehen
 */
(function () {
  "use strict";

  var API_URL =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=53.55&longitude=9.99" +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation," +
    "weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day" +
    "&hourly=temperature_2m,precipitation_probability,weather_code,is_day" +
    "&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min" +
    "&forecast_hours=7&forecast_days=1&timezone=Europe%2FBerlin";

  var params = new URLSearchParams(location.search);
  var root = document.documentElement;

  /* ---------- Hilfsfunktionen ---------- */

  function num(v, digits) {
    if (typeof v !== "number" || isNaN(v)) return "–";
    return v.toLocaleString("de-DE", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0,
    });
  }

  function clock(iso) {
    // Open-Meteo liefert Ortszeit (timezone=Europe/Berlin) als "2026-11-11T14:15"
    return typeof iso === "string" && iso.length >= 16 ? iso.slice(11, 16) : "–";
  }

  function compass(deg) {
    if (typeof deg !== "number") return "–";
    var dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
    return dirs[Math.round(deg / 45) % 8];
  }

  // WMO-Wettercode → Zustand für das Design
  function stateFromCode(code) {
    if (code === 0 || code === 1) return "klar";
    if (code === 2 || code === 3) return "wolken";
    if (code === 45 || code === 48) return "nebel";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "schnee";
    if (code >= 51) return "regen";
    return "wolken";
  }

  var LABELS = {
    0: "Klar", 1: "Überwiegend klar", 2: "Teils bewölkt", 3: "Bedeckt",
    45: "Nebel", 48: "Reifnebel",
    51: "Leichter Niesel", 53: "Niesel", 55: "Starker Niesel",
    56: "Gefrierender Niesel", 57: "Gefrierender Niesel",
    61: "Leichter Regen", 63: "Regen", 65: "Starker Regen",
    66: "Gefrierender Regen", 67: "Gefrierender Regen",
    71: "Leichter Schnee", 73: "Schnee", 75: "Starker Schnee", 77: "Schneegriesel",
    80: "Regenschauer", 81: "Regenschauer", 82: "Heftige Schauer",
    85: "Schneeschauer", 86: "Schneeschauer",
    95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel",
  };

  var STATE_WORD = { klar: "Klar", wolken: "Wolken", nebel: "Nebel", regen: "Regen", schnee: "Schnee" };

  // Text + Angebot je Zustand (Kür: die Seite reagiert auf die Daten)
  var ADVICE = {
    klar: {
      title: "Raus an die Elbe.",
      text: "Klarer Himmel über Hamburg. Heute brauchst du eher eine Sonnenbrille als einen Schirm.",
    },
    wolken: {
      title: "Grau, aber trocken.",
      text: "Wolken über der Stadt, Regen ist gerade nicht in Sicht. Eine warme Jacke reicht.",
    },
    nebel: {
      title: "Hamburg im Nebel.",
      text: "Die Sicht ist kurz, die Stimmung lang. Auf dem Rad und am Wasser heute besonders vorsichtig sein.",
    },
    regen: {
      title: "Schirm nicht vergessen.",
      text: "Es regnet in Hamburg. Unten siehst du, wann die nächste trockene Stunde kommt.",
    },
    schnee: {
      title: "Schnee in der Stadt.",
      text: "Selten genug in Hamburg. Feste Schuhe an und lieber ein paar Minuten früher los.",
    },
  };

  var NIGHT_NOTE = "Es ist Nacht in Hamburg, die Seite ist auf Nachtmodus umgestellt.";

  function minutes(iso) {
    if (typeof iso !== "string" || iso.length < 16) return null;
    return parseInt(iso.slice(11, 13), 10) * 60 + parseInt(iso.slice(14, 16), 10);
  }

  function setText(key, value) {
    var els = document.querySelectorAll('[data-w="' + key + '"]');
    for (var i = 0; i < els.length; i++) els[i].textContent = value;
  }

  /* ---------- Darstellung ---------- */

  function render(data) {
    var c = data.current || {};
    var d = data.daily || {};
    var h = data.hourly || {};

    if (typeof c.temperature_2m !== "number") throw new Error("Unvollständige Antwort");

    var state = stateFromCode(c.weather_code);
    var isDay = c.is_day === 1;

    // Test-Schalter
    if (params.get("wetter") && STATE_WORD[params.get("wetter")]) state = params.get("wetter");
    if (params.get("nacht") === "1") isDay = false;
    if (params.get("nacht") === "0") isDay = true;
    var forced = params.has("wetter") || params.has("nacht");

    root.dataset.weather = state;
    root.dataset.daytime = isDay ? "tag" : "nacht";
    root.dataset.forced = forced ? "ja" : "nein";

    var bad = state === "regen" || state === "schnee" || state === "nebel";
    var advice = ADVICE[state];

    setText("temp", num(c.temperature_2m, 0));
    setText("temp1", num(c.temperature_2m, 1));
    setText("feels", num(c.apparent_temperature, 0));
    setText("humidity", num(c.relative_humidity_2m, 0));
    setText("precip", num(c.precipitation, 1));
    setText("cloud", num(c.cloud_cover, 0));
    setText("wind", num(c.wind_speed_10m, 0));
    setText("winddir", compass(c.wind_direction_10m));
    setText("cond", forced ? STATE_WORD[state] : LABELS[c.weather_code] || STATE_WORD[state]);
    setText("state", STATE_WORD[state]);
    setText("time", clock(c.time));
    setText("tmax", num((d.temperature_2m_max || [])[0], 0));
    setText("tmin", num((d.temperature_2m_min || [])[0], 0));
    setText("sunrise", clock((d.sunrise || [])[0]));
    setText("sunset", clock((d.sunset || [])[0]));
    setText("daytime", isDay ? "Tag" : "Nacht");
    setText("advice", advice.title);
    setText("advice-text", isDay ? advice.text : advice.text + " " + NIGHT_NOTE);
    // Werte für Grafiken (Windpfeil, Feuchte-Balken, Sonnenstand)
    root.style.setProperty("--wind-deg", (c.wind_direction_10m || 0) + "deg");
    root.style.setProperty("--hum", (c.relative_humidity_2m || 0) / 100);
    var rise = minutes((d.sunrise || [])[0]), set = minutes((d.sunset || [])[0]), now = minutes(c.time);
    if (rise !== null && set !== null && now !== null && set > rise) {
      var prog = Math.max(0, Math.min(1, (now - rise) / (set - rise)));
      root.style.setProperty("--sun", prog);
      var len = set - rise;
      setText("daylength", Math.floor(len / 60) + " h " + String(len % 60).padStart(2, "0") + " min");
      var left = set - now;
      setText("light-title", isDay && left > 0 ? "Noch " + Math.floor(left / 60) + " h " + String(left % 60).padStart(2, "0") + " min Tageslicht" : "Die Sonne ist untergegangen");
    }

    // Wichtigster Wert für Hervorhebungen (z. B. Karte in Variante B)
    var focus = "temp";
    if (state === "regen" || state === "schnee") focus = "precip";
    else if (c.wind_speed_10m >= 25) focus = "wind";
    else if (state === "nebel") focus = "humidity";
    root.dataset.focus = focus;

    // Stündliche Vorhersage
    var tpl = document.getElementById("hour-tpl");
    var list = document.querySelector("[data-hours]");
    if (tpl && list && h.time) {
      list.textContent = "";
      var temps = h.temperature_2m.slice(1, 7);
      var tmin = Math.min.apply(null, temps), tmax = Math.max.apply(null, temps);
      for (var i = 1; i < h.time.length && i <= 6; i++) {
        var node = tpl.content.firstElementChild.cloneNode(true);
        node.dataset.weather = stateFromCode(h.weather_code[i]);
        node.dataset.daytime = h.is_day[i] === 1 ? "tag" : "nacht";
        node.querySelector("[data-h=time]").textContent = clock(h.time[i]);
        node.querySelector("[data-h=temp]").textContent = num(h.temperature_2m[i], 0) + "°";
        node.querySelector("[data-h=pop]").textContent = num(h.precipitation_probability[i], 0) + " %";
        node.querySelector("[data-h=cond]").textContent = LABELS[h.weather_code[i]] || "–";
        node.style.setProperty("--bar", tmax > tmin ? 0.35 + 0.65 * (h.temperature_2m[i] - tmin) / (tmax - tmin) : 0.6);
        node.style.setProperty("--pop", (h.precipitation_probability[i] || 0) / 100);
        list.appendChild(node);
      }
    }

    root.dataset.status = "ok";
    document.dispatchEvent(new CustomEvent("cloudy:ready", { detail: { data: data, state: state, isDay: isDay } }));
  }

  function fail(err) {
    console.warn("Cloudy: Wetterdaten nicht erreichbar", err);
    root.dataset.status = "error";
    // Platzhalter statt leerer Boxen oder "undefined"
    var els = document.querySelectorAll("[data-w]");
    for (var i = 0; i < els.length; i++) {
      if (els[i].dataset.fallback !== undefined) els[i].textContent = els[i].dataset.fallback;
      else els[i].textContent = "–";
    }
    var list = document.querySelector("[data-hours]");
    if (list) list.textContent = "";
    // Ohne Daten: Tageszeit grob aus der Uhr des Besuchers ableiten
    var hour = new Date().getHours();
    root.dataset.daytime = hour >= 7 && hour < 17 ? "tag" : "nacht";
    root.dataset.weather = "wolken";
  }

  function load() {
    root.dataset.status = "loading";
    if (params.get("laden") === "1") return;

    var url = params.get("fehler") === "1" ? API_URL.replace("open-meteo", "open-meteoo") : API_URL;
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);

    fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(render)
      .catch(fail)
      .then(function () { clearTimeout(timer); });
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-retry]")) load();
  });

  window.Cloudy = { API_URL: API_URL, reload: load };
  load();
})();
