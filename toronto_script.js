document.addEventListener('DOMContentLoaded', () => {
  let map = L.map('map').setView([43.7265, -79.3906], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  }).addTo(map);
  let currentUser = localStorage.getItem('torontoUsername');
  if (!currentUser) {
    currentUser = prompt("Enter your username to start or resume your game:");
    if (currentUser) {
      localStorage.setItem('torontoUsername', currentUser);
    } else {
      alert("You must enter a username to continue.");
      return;
    }
  }
  let guessed = new Set();
  let guessedAltNames = []; // For guessed LINEAR_4 values
  let guessedAltNameSet = new Set();
  let altNameCasing = new Map(); // lowercase → original casing
  let allStreets = new Map(); // name (LINEAR_5) → { layers: [...], length, altNames: Set }
  let totalLength = 0;
  let guessedLength = 0;
  let sortMode = 'recency';

  fetch("Toronto_Streets_Data_Final.json")
    .then(res => res.json())
    .then(data => {
      L.geoJSON(data, {
        style: { color: "#666", weight: 1 },
        onEachFeature: (feature, layer) => {
          const name = feature.properties.LINEAR_5?.trim().toLowerCase();
          const altName = feature.properties.LINEAR_4?.trim();
          const length = feature.properties.Length || 0;

          if (!name || name.length < 2) return;

          totalLength += length;

          if (!allStreets.has(name)) {
            allStreets.set(name, { layers: [], length: 0, altNames: new Set() });
          }

          const entry = allStreets.get(name);
          entry.layers.push(layer);
          entry.length += length;

          if (altName) {
            entry.altNames.add(altName);
          }
        },
        renderer: L.canvas(),
      }).addTo(map);
      loadProgress();
    });

  function addToGuessedList(name) {
    guessedAltNames.push(name);
    renderGuessedList();
  }

  function updateProgress() {
    const percent = (guessedLength / totalLength) * 100;
    document.getElementById('progress').textContent =
      `${guessedAltNameSet.size} segments guessed! That's ${percent.toFixed(2)}% of the road network.`;
    document.getElementById('progress-bar').style.width = `${percent}%`;
  }

  function renderGuessedList() {
    const list = document.getElementById('guessed-list');
    list.innerHTML = '';

    let sorted = [...guessedAltNames];
    if (sortMode === 'alphabetical') {
      sorted.sort((a, b) => {
        const aText = altNameCasing.get(a) || a;
        const bText = altNameCasing.get(b) || b;
        return aText.localeCompare(bText);
      });
    } else {
      sorted.reverse();
    }

    for (const name of sorted) {
      const item = document.createElement('li');
      item.textContent = altNameCasing.get(name) || name;
      list.appendChild(item);
    }
  }

  document.getElementById('sort-toggle').addEventListener('click', () => {
    sortMode = sortMode === 'recency' ? 'alphabetical' : 'recency';
    const nextMode = sortMode === 'recency' ? 'alphabetical' : 'recency';
    document.getElementById('sort-toggle').textContent = `Sort by: ${capitalize(nextMode)}`;
    renderGuessedList();
  });

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  document.getElementById('streetInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = e.target.value.trim().toLowerCase();
      if (allStreets.has(input) && !guessed.has(input)) {
        guessed.add(input);
        const { layers, length, altNames } = allStreets.get(input);
        guessedLength += length;

        layers.forEach(layer => {
          layer.setStyle({ color: "#007700", weight: 3 });
          const featureAlt = layer.feature.properties.LINEAR_4?.trim();
          if (featureAlt) {
            layer.bindTooltip(featureAlt, { sticky : true });
          }
        });
        for (const alt of altNames) {
          const altLower = alt.toLowerCase();
          if (!guessedAltNameSet.has(altLower)) {
            guessedAltNameSet.add(altLower);
          }
          if (!altNameCasing.has(altLower)) {
            altNameCasing.set(altLower, alt);
          }
          addToGuessedList(altLower);
        }
        updateProgress();
        saveProgress();
      }
      e.target.value = '';
    }
  });
  function saveProgress() {
    const state = {
      guessed: [...guessed],
      guessedAltNames,
      guessedAltNameSet: [...guessedAltNameSet],
      guessedLength
    };
    localStorage.setItem(`torontoProgress-${currentUser}`, JSON.stringify(state));
  }
  function loadProgress() {
    const state = JSON.parse(localStorage.getItem(`torontoProgress-${currentUser}`));
    if (!state) return;

    guessed = new Set(state.guessed);
    guessedAltNames = state.guessedAltNames || [];
    guessedAltNameSet = new Set(state.guessedAltNameSet || []);
    guessedLength = state.guessedLength || 0;

    for (const name of guessed) {
      const entry = allStreets.get(name);
      if (entry) {
        entry.layers.forEach(layer =>
          layer.setStyle({ color: "#007700", weight: 3 })
        );
      }
    }

    for (const alt of guessedAltNameSet) {
      if (!altNameCasing.has(alt)) {
        altNameCasing.set(alt, alt); // fallback
      }
    }

    renderGuessedList();
    updateProgress();
  }
});
