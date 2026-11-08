const feeds = {
  north: {
    name: "North Ridge",
    location: "North Ridge · Sector A",
    camera: "CAM 01",
    surface: 68.4,
    ambient: 50.2,
    humidity: 24,
    materials: [
      {
        name: "Dry grasses",
        category: "FINE SURFACE FUEL",
        description: "Standing or fallen grasses that can dry quickly when exposed to sun and wind.",
        behavior: "When dry and continuous, grasses can carry a fast-moving surface fire.",
      },
      {
        name: "Leaf litter",
        category: "GROUND COVER",
        description: "Dead leaves and needles accumulated on the forest floor.",
        behavior: "Dry litter can support surface fire; depth, moisture and arrangement affect how it burns.",
      },
      {
        name: "Small twigs",
        category: "WOODY DEBRIS",
        description: "Fine fallen branches and woody pieces among the ground vegetation.",
        behavior: "Fine woody debris may contribute to surface fire, especially alongside dry grasses and litter.",
      },
    ],
    elevated: true,
  },
  pine: {
    name: "Pine Valley",
    location: "Pine Valley · Sector B",
    camera: "CAM 02",
    surface: 42.8,
    ambient: 36.1,
    humidity: 38,
    materials: [
      {
        name: "Pine needles",
        category: "GROUND COVER",
        description: "Fallen pine needles and other fine conifer litter on the forest floor.",
        behavior: "Dry needle litter can carry surface fire; moisture and continuity affect spread.",
      },
      {
        name: "Pine branches",
        category: "WOODY DEBRIS",
        description: "Fallen or downed branches beneath the pine canopy.",
        behavior: "Branch size and arrangement influence how woody debris contributes to a fire.",
      },
      {
        name: "Understory shrubs",
        category: "LOW VEGETATION",
        description: "Shrubs and other low-growing plants beneath the tree canopy.",
        behavior: "Dry or continuous understory can help surface fire reach lower tree branches.",
      },
    ],
    elevated: false,
  },
  east: {
    name: "East Lookout",
    location: "East Lookout · Sector C",
    camera: "CAM 03",
    surface: 31.6,
    ambient: 27.3,
    humidity: 46,
    materials: [
      {
        name: "Leaf litter",
        category: "GROUND COVER",
        description: "A mix of fallen leaves and needles from the area's varied tree cover.",
        behavior: "Dry ground litter can support surface fire; composition and moisture vary by location.",
      },
      {
        name: "Grasses",
        category: "FINE SURFACE FUEL",
        description: "Grasses growing in open patches and along the woodland floor.",
        behavior: "Dry, connected grass can carry surface fire; wind and fuel continuity affect spread.",
      },
      {
        name: "Shrubs and branches",
        category: "WOODY VEGETATION",
        description: "Low shrubs, fallen branches and other woody plants in the understory.",
        behavior: "The size and arrangement of woody plants can affect fire behavior and vertical fuel connection.",
      },
    ],
    elevated: false,
  },
};

const sourceStorageKey = "thermowatch.cameraSources";
const feedTabs = [...document.querySelectorAll(".feed-tab")];
const video = document.querySelector("#camera-video");
const videoFrame = document.querySelector("#video-frame");
const sourceDialog = document.querySelector("#source-dialog");
const sourceForm = document.querySelector("#source-form");
const sourceCamera = document.querySelector("#source-camera");
const sourceUrl = document.querySelector("#source-url");
const sourceError = document.querySelector("#source-error");
const toast = document.querySelector("#toast");
let selectedFeed = "north";
let toastTimeout;
let alertResolved = false;

function readSources() {
  try {
    const saved = localStorage.getItem(sourceStorageKey);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    throw new Error("Saved camera sources are not a valid object.");
  } catch (error) {
    console.error("Could not load saved camera sources.", error);
    showToast("Saved camera sources could not be loaded.");
    return {};
  }
}

let cameraSources = readSources();

function saveSources() {
  try {
    localStorage.setItem(sourceStorageKey, JSON.stringify(cameraSources));
    return true;
  } catch (error) {
    console.error("Could not save camera sources.", error);
    showToast("Could not save this camera source. Check browser storage settings.");
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function applyFeed(feedId) {
  const feed = feeds[feedId];
  if (!feed) return;
  selectedFeed = feedId;
  feedTabs.forEach((tab) => {
    const isSelected = tab.dataset.feed === feedId;
    tab.classList.toggle("selected", isSelected);
    tab.setAttribute("aria-selected", String(isSelected));
  });
  document.querySelectorAll(".map-pin").forEach((pin) => {
    pin.classList.toggle("active", pin.dataset.mapFeed === feedId);
  });

  const difference = feed.surface - feed.ambient;
  document.querySelector("#video-feed-name").textContent = feed.name.toUpperCase();
  document.querySelector("#video-temp").textContent = `${feed.surface.toFixed(1)}°C`;
  document.querySelector("#feed-location").textContent = feed.location;
  document.querySelector("#sensor-area-name").textContent = feed.name;
  document.querySelector("#sensor-surface").innerHTML = `${feed.surface.toFixed(1)}<span>°C</span>`;
  document.querySelector("#sensor-ambient").innerHTML = `${feed.ambient.toFixed(1)}<span>°C</span>`;
  document.querySelector("#sensor-humidity").innerHTML = `${feed.humidity}<span>%</span>`;
  document.querySelector("#sensor-material").textContent = feed.materials.map((material) => material.name).join(", ");
  renderMaterials(feed);
  document.querySelector("#highest-temp").textContent = feed.surface.toFixed(1);
  document.querySelector("#temperature-note").textContent = feed.name;
  document.querySelector("#temp-difference").textContent = `${difference >= 0 ? "+" : ""}${difference.toFixed(1)}`;
  document.querySelector("#ambient-note").textContent = `Ambient ${feed.ambient.toFixed(1)} °C`;
  const surfaceState = document.querySelector("#surface-state");
  surfaceState.classList.toggle("state-alert", feed.elevated);
  surfaceState.textContent = feed.elevated ? "ELEVATED" : "NORMAL";
  document.querySelector("#video-timecode").innerHTML = `${feed.camera} <b>·</b> 00:00:00`;

  const source = cameraSources[feedId];
  if (source) {
    if (video.src !== source) video.src = source;
    videoFrame.classList.add("has-video");
    video.play().catch((error) => {
      console.warn("Camera video could not autoplay; use the player controls.", error);
      showToast("Feed connected. Press play if the camera does not start automatically.");
    });
  } else {
    video.pause();
    video.removeAttribute("src");
    video.load();
    videoFrame.classList.remove("has-video");
  }
}

function renderMaterials(feed) {
  const materialList = document.querySelector("#material-list");
  const fragment = document.createDocumentFragment();

  feed.materials.forEach((material, index) => {
    const card = document.createElement("article");
    card.className = "material-card";

    const heading = document.createElement("div");
    heading.className = "material-card-heading";

    const icon = document.createElement("span");
    icon.className = "material-profile-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "◇";

    const titleGroup = document.createElement("div");
    const category = document.createElement("span");
    category.className = "material-category";
    category.textContent = material.category;
    const title = document.createElement("h3");
    title.textContent = material.name;
    titleGroup.append(category, title);
    heading.append(icon, titleGroup);

    const description = document.createElement("p");
    description.className = "material-description";
    description.textContent = material.description;

    const behavior = document.createElement("div");
    behavior.className = "material-behavior";
    const behaviorLabel = document.createElement("span");
    behaviorLabel.textContent = "GENERAL FIRE BEHAVIOR";
    const behaviorText = document.createElement("p");
    behaviorText.textContent = material.behavior;
    behavior.append(behaviorLabel, behaviorText);

    card.setAttribute("aria-label", `Material ${index + 1}: ${material.name}`);
    card.append(heading, description, behavior);
    fragment.append(card);
  });

  materialList.replaceChildren(fragment);
}

function resolveAlert() {
  if (alertResolved) return;
  alertResolved = true;
  document.querySelector("#alert-panel").classList.add("resolved");
  document.querySelector("#alert-title").textContent = "Alert acknowledged";
  document.querySelector("#alert-live-status").lastChild.textContent = " ACKNOWLEDGED";
  document.querySelector("#alert-description").textContent = "North Ridge · Alert acknowledged by site operator. Sensor readings remain visible.";
  document.querySelector("#active-alert-count").textContent = "00";
  document.querySelector("#alert-status-note").textContent = "No alerts need attention";
  document.querySelector(".tab-alert").hidden = true;
  document.querySelector("#resolve-alert").textContent = "Alert resolved";
  document.querySelector("#resolve-alert").disabled = true;
  showToast("Alert dismissed. This does not change or verify the sensor readings.");
}

feedTabs.forEach((tab) => tab.addEventListener("click", () => applyFeed(tab.dataset.feed)));
document.querySelectorAll(".map-pin").forEach((pin) => {
  pin.addEventListener("click", () => applyFeed(pin.dataset.mapFeed));
});

document.querySelector("#source-button").addEventListener("click", () => {
  sourceCamera.value = selectedFeed;
  sourceUrl.value = cameraSources[selectedFeed] || "";
  sourceError.hidden = true;
  sourceDialog.showModal();
});
document.querySelector("#close-source-dialog").addEventListener("click", () => sourceDialog.close());
document.querySelector("#configure-feed").addEventListener("click", () => {
  sourceCamera.value = selectedFeed;
  sourceUrl.value = cameraSources[selectedFeed] || "";
  sourceError.hidden = true;
  sourceDialog.showModal();
});
sourceCamera.addEventListener("change", () => {
  sourceUrl.value = cameraSources[sourceCamera.value] || "";
});

sourceForm.addEventListener("submit", (event) => {
  if (event.submitter?.id !== "save-source") return;
  event.preventDefault();
  const url = sourceUrl.value.trim();
  if (!url) {
    sourceError.textContent = "Enter a video URL to connect this camera.";
    sourceError.hidden = false;
    sourceUrl.focus();
    return;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    sourceError.textContent = "Enter a valid URL, including https://.";
    sourceError.hidden = false;
    sourceUrl.focus();
    return;
  }
  if (!["https:", "http:", "blob:"].includes(parsedUrl.protocol)) {
    sourceError.textContent = "Use an http, https, or browser-provided blob video URL.";
    sourceError.hidden = false;
    sourceUrl.focus();
    return;
  }
  const targetFeed = sourceCamera.value;
  cameraSources[targetFeed] = url;
  if (!saveSources()) return;
  sourceDialog.close();
  applyFeed(targetFeed);
  showToast(`${feeds[targetFeed].name} video source connected.`);
});

document.querySelector("#remove-source").addEventListener("click", () => {
  const targetFeed = sourceCamera.value;
  if (!cameraSources[targetFeed]) {
    showToast("There is no saved source for this camera.");
    return;
  }
  delete cameraSources[targetFeed];
  if (!saveSources()) return;
  sourceDialog.close();
  applyFeed(targetFeed);
  showToast(`${feeds[targetFeed].name} video source removed.`);
});

document.querySelector("#resolve-alert").addEventListener("click", resolveAlert);
document.querySelector("#dismiss-alert").addEventListener("click", resolveAlert);

document.querySelector("#refresh-button").addEventListener("click", () => {
  document.querySelector("#last-sync").textContent = "just now";
  document.querySelector("#last-frame").textContent = "Just now";
  showToast("Display refreshed. No new sensor data source is connected.");
});

document.querySelector("#view-readings").addEventListener("click", () => showToast("Detailed sensor history is not connected in this demo."));
document.querySelector("#view-activity").addEventListener("click", () => showToast("Full activity history is not connected in this demo."));
document.querySelector(".workspace-switch").addEventListener("click", () => showToast("Workspace switching is not connected in this demo."));
document.querySelector(".notification-button").addEventListener("click", () => showToast("No additional notifications."));
document.querySelector(".map-button").addEventListener("click", () => showToast("Area map is illustrative; connect a mapping source for live locations."));

const now = new Date();
document.querySelector("#current-date").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(now).toUpperCase();
document.querySelector(".page-heading .eyebrow").innerHTML = `${new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(now).toUpperCase()} <span class="eyebrow-dot"></span> LIVE MONITORING`;
document.querySelector("#video-timecode").innerHTML = `CAM 01 <b>·</b> ${new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(now)}`;

applyFeed(selectedFeed);
