import "./style.css";
import { createIcons, icons } from "lucide";
import {
  extractCards,
  grade,
  shuffled,
  validatePalace,
  PAGE_SIZE,
  MAX_CARDS,
  type Card,
  type Palace,
} from "./core";
import { listPalaces, savePalace, deletePalace } from "./storage";
import { readFiles } from "./import";
import { PalaceScene, ANCHOR_NAMES, CARNIVAL_NAMES } from "./scene";
const app = document.querySelector<HTMLDivElement>("#app")!;
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (name: string) => `<i data-lucide="${name}"></i>`;
const button = (label: string, id: string, cls = "button") =>
  `<button class="${cls}" id="${id}">${label}</button>`;
function refreshIcons() {
  createIcons({ icons });
}
function on(id: string, fn: (e: Event) => void) {
  document.getElementById(id)?.addEventListener("click", fn);
}
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  const el = document.querySelector<HTMLElement>("#toast")!;
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 6000);
}
function fail(error: unknown) {
  console.error(error);
  toast(error instanceof Error ? error.message : String(error));
}
let scene: PalaceScene | undefined;
let palaces: Palace[] = [];
let draft: Card[] = [];
let draftName = "";
let chosen: "house" | "carnival" = "house";
let active: Palace;
let wing = 0;
let mode: "learn" | "test" = "learn";
let queue: Card[] = [];
let answers: Record<string, number> = {};
let question = 0;
let near: number | null = null;
let quality: "high" | "balanced" =
  localStorage.getItem("palace-quality") === "high" ? "high" : "balanced";
function stopScene() {
  scene?.dispose();
  scene = undefined;
}
function shell(content: string, nav = "library") {
  stopScene();
  app.innerHTML = `<aside class="sidebar"><a href="#" id="brand" class="brand"><span class="brand-mark">${icon("landmark")}</span><span>memory<span class="brand-light">palace</span><small>A PLACE FOR EVERYTHING YOU KNOW</small></span></a><div class="workspace-label">YOUR WORKSPACE</div><nav>${button(icon("layout-grid") + " My palaces", "nav-library", `nav-item ${nav === "library" ? "active" : ""}`)}${button(icon("plus") + " Create a palace", "nav-create", `nav-item ${nav === "create" ? "active" : ""}`)}${button(icon("box") + " Environment library", "nav-assets", `nav-item ${nav === "assets" ? "active" : ""}`)}</nav><div class="sidebar-note"><span class="tiny-label">THE METHOD OF LOCI</span><p>Give your knowledge<br>a place to live.</p><span>Familiar places. Stronger memories.</span></div><div class="sidebar-bottom"><div class="local-badge">${icon("shield-check")} Private by design</div><p>Saved on this device · Works offline</p>${button(icon("settings-2") + " Settings & help", "nav-settings", "nav-item")}<div class="profile"><span>A</span><div>Your personal workspace<small>MEMORY PALACE · REFINED V2</small></div></div></div></aside><main class="main">${content}</main>`;
  on("brand", (e) => {
    e.preventDefault();
    void library();
  });
  on("nav-library", () => void library());
  on("nav-create", () => upload());
  on("nav-assets", () => environmentLibrary());
  on("nav-settings", () => settings());
  refreshIcons();
}
async function library() {
  try {
    palaces = await listPalaces();
    shell(
      `<header class="topbar"><span>Workspace <b>/</b> My palaces</span><span class="status-dot">All changes saved locally</span></header><section class="page"><div class="page-title"><div><div class="eyebrow">MAKE ROOM FOR WHAT MATTERS</div><h1>Your mind, beautifully organized.</h1><p>Turn study material into places you’ll remember.</p></div>${button(icon("plus") + " New palace", "new-palace", "button primary")}</div><div class="hero"><div class="hero-copy"><span class="pill">A DIFFERENT WAY TO LEARN</span><h2>Don’t just read it.<br><em>Walk through it.</em></h2><p>Bring your notes. Choose a world. Build connections that stay with you, one memorable place at a time.</p>${button("Create your first palace " + icon("arrow-up-right"), "hero-create", "button primary")}<div class="hero-foot">${icon("file-text")} Your material ${icon("arrow-right")} ${icon("building-2")} Your world ${icon("arrow-right")} ${icon("brain")} Your memory</div></div><div class="hero-art"><img src="${import.meta.env.BASE_URL}previews/house.jpg" alt="A sunlit virtual house filled with detailed furniture"><div class="image-caption"><span class="live-dot"></span> THE SUNLIT HOUSE <span>16 memory locations</span></div></div></div><div class="section-heading"><h2>My palaces <span class="count">${palaces.length}</span></h2><div class="section-tools">${button(icon("upload") + " Restore backup", "restore", "button subtle")}<input id="search" placeholder="Search your palaces…" aria-label="Search palaces"></div></div><div id="palace-grid" class="palace-grid"></div><div class="bottom-tip">${icon("sparkles")} <span><strong>A little imagination goes a long way.</strong> Picture each concept interacting with its object before moving to the next.</span></div></section>`,
    );
    renderPalaces(palaces);
    on("new-palace", () => upload());
    on("hero-create", () => upload());
    on("restore", () => restore());
    document
      .querySelector<HTMLInputElement>("#search")!
      .addEventListener("input", (e) =>
        renderPalaces(
          palaces.filter((p) =>
            p.name
              .toLowerCase()
              .includes((e.target as HTMLInputElement).value.toLowerCase()),
          ),
        ),
      );
  } catch (e) {
    fail(e);
  }
}
function renderPalaces(items: Palace[]) {
  const grid = document.querySelector("#palace-grid")!;
  grid.innerHTML = items.length
    ? items
        .map(
          (p) =>
            `<article class="palace-card"><button class="card-image" data-open="${esc(p.id)}"><img src="${import.meta.env.BASE_URL}previews/${p.environment}.jpg" alt="${p.environment === "house" ? "Sunlit house" : "Twilight carnival"}"><span class="pill">${p.environment === "house" ? "SUNLIT HOUSE" : "TWILIGHT CARNIVAL"}</span></button><div class="card-body"><div class="card-heading"><h3>${esc(p.name)}</h3><button class="icon-button" data-menu="${esc(p.id)}" aria-label="Manage ${esc(p.name)}">${icon("ellipsis")}</button></div><p>${p.cards.length} memories <span>·</span> ${Math.ceil(p.cards.length / PAGE_SIZE)} ${p.cards.length > PAGE_SIZE ? "wings" : "wing"}</p><div class="progress-line"><span style="width:${Math.round((p.seen.length / p.cards.length) * 100)}%"></span></div><div class="card-foot"><span>${p.seen.length} of ${p.cards.length} explored</span><button class="text-button" data-open="${esc(p.id)}">Enter palace ${icon("arrow-right")}</button></div></div></article>`,
        )
        .join("")
    : `<button class="empty-card" id="empty-create">${icon("plus")}<h3>${palaces.length ? "No matching palaces" : "Your next big idea belongs here"}</h3><p>${palaces.length ? "Try another search." : "Upload your notes and build your first memory palace."}</p><span>Create a palace ${icon("arrow-right")}</span></button>`;
  grid.querySelectorAll<HTMLElement>("[data-open]").forEach(
    (el) =>
      (el.onclick = () => {
        active = palaces.find((p) => p.id === el.dataset.open)!;
        wing = 0;
        mode = "learn";
        enter();
      }),
  );
  grid
    .querySelectorAll<HTMLElement>("[data-menu]")
    .forEach(
      (el) =>
        (el.onclick = () =>
          manage(palaces.find((p) => p.id === el.dataset.menu)!)),
    );
  on("empty-create", () => upload());
  refreshIcons();
}
function upload() {
  draft = [];
  shell(
    `<header class="topbar"><span>Workspace <b>/</b> Create a palace</span><span>01 / 03</span></header><section class="page narrow"><div class="steps"><span class="current">01 &nbsp; Add material</span><span>02 &nbsp; Review memories</span><span>03 &nbsp; Choose a world</span></div><div class="eyebrow">START WITH SOMETHING WORTH REMEMBERING</div><h1>What are we learning?</h1><p class="intro">Your lecture notes, exam prep, or that subject you’ve always wanted to master.</p><label class="field-label" for="palace-name">Palace name</label><input class="wide-input" id="palace-name" placeholder="e.g. Biology · Semester 2" maxlength="100" value="${esc(draftName)}"><label class="dropzone" id="dropzone"><input type="file" id="files" accept=".pdf,.txt,.md" multiple><span class="upload-icon">${icon("files")}</span><h2>Drop your study material here</h2><p>or <strong>browse files</strong> on your computer</p><small>PDF, TXT, Markdown · Up to 50 MB per file · 20 files</small></label><div class="divider"><span>OR START WITH TEXT</span></div><textarea id="pasted" placeholder="Paste your notes here. Definitions, explanations, dates, and key facts all work well." rows="6"></textarea><div class="privacy-note">${icon("lock-keyhole")} Your files stay on this device. Text is extracted locally; no cloud account needed.</div><div id="import-status" role="status"></div><div class="form-actions">${button("Back to library", "back", "button subtle")}${button("Extract memories " + icon("arrow-right"), "extract", "button primary")}</div><p class="fine-print">Extraction creates source-based passages for you to review, not AI-generated summaries. Scanned images require OCR first. Up to ${MAX_CARDS} memories per palace.</p></section>`,
    "create",
  );
  let files: File[] = [];
  const input = document.querySelector<HTMLInputElement>("#files")!;
  input.onchange = () => {
    files = Array.from(input.files || []);
    showFiles();
  };
  function showFiles() {
    const box = document.querySelector("#dropzone h2")!;
    box.textContent = files.length
      ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
      : "Drop your study material here";
    document.querySelector("#dropzone p")!.textContent = files
      .map((f) => f.name)
      .join(", ");
  }
  const drop = document.querySelector<HTMLElement>("#dropzone")!;
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("drag");
  };
  drop.ondragleave = () => drop.classList.remove("drag");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    files = Array.from(e.dataTransfer?.files || []);
    showFiles();
  };
  on("back", () => void library());
  on("extract", async () => {
    const btn = document.querySelector<HTMLButtonElement>("#extract")!;
    const status = document.querySelector("#import-status")!;
    try {
      draftName =
        document
          .querySelector<HTMLInputElement>("#palace-name")!
          .value.trim() ||
        files[0]?.name.replace(/\.[^.]+$/, "") ||
        "Untitled palace";
      const text = document
        .querySelector<HTMLTextAreaElement>("#pasted")!
        .value.trim();
      if (!files.length && !text)
        throw Error("Add a file or paste some study material first.");
      btn.disabled = true;
      const pages = files.length
        ? await readFiles(files, (s) => (status.textContent = s))
        : [];
      if (text) pages.push({ text, source: "Pasted notes", page: 1 });
      draft = extractCards(pages);
      if (!draft.length)
        throw Error(
          "No study passages found. Add more complete notes or check that the PDF contains selectable text.",
        );
      review();
    } catch (e) {
      fail(e);
      btn.disabled = false;
      status.textContent = "Import stopped. Your files have not been saved.";
    }
  });
}
function review() {
  shell(
    `<header class="topbar"><span>Create a palace <b>/</b> Review memories</span><span>02 / 03</span></header><section class="page"><div class="steps"><span>01 &nbsp; Add material</span><span class="current">02 &nbsp; Review memories</span><span>03 &nbsp; Choose a world</span></div><div class="page-title"><div><div class="eyebrow">CURATE WHAT STAYS WITH YOU</div><h1>Make each memory your own.</h1><p><strong id="draft-count">${draft.length}</strong> passages extracted. Refine titles, edit explanations, and remove what you don’t need.</p></div>${button(icon("plus") + " Add memory", "add-card", "button")}</div><div class="notice">${icon("info")} Every card keeps its source reference. Check the extraction against your notes before studying.${draft.length > MAX_CARDS ? ` Remove cards to reach the ${MAX_CARDS}-card limit; nothing has been discarded.` : ""}</div><div id="review-list" class="review-list"></div><div class="form-actions sticky-actions">${button("Start over", "start-over", "button subtle")}${button("Choose an environment " + icon("arrow-right"), "choose-env", "button primary")}</div></section>`,
    "create",
  );
  renderReview();
  on("add-card", () => {
    draft.push({
      id: crypto.randomUUID(),
      title: "New memory",
      body: "",
      source: "Personal notes",
      page: 1,
      anchor: draft.length,
    });
    renderReview();
    document
      .querySelector(".review-row:last-child")
      ?.scrollIntoView({ behavior: "smooth" });
  });
  on("start-over", () => upload());
  on("choose-env", () => {
    if (!draft.length || draft.length > MAX_CARDS) {
      toast(`Keep between 1 and ${MAX_CARDS} memories in each palace.`);
      return;
    }
    if (draft.some((c) => !c.title.trim() || !c.body.trim())) {
      toast("Give every memory a title and an explanation.");
      return;
    }
    chooseEnvironment();
  });
}
function renderReview() {
  document.querySelector("#draft-count")!.textContent = String(draft.length);
  const list = document.querySelector("#review-list")!;
  list.innerHTML = draft
    .map(
      (c, i) =>
        `<article class="review-row"><span class="memory-number">${String(i + 1).padStart(2, "0")}</span><div><input aria-label="Memory ${i + 1} title" data-title="${i}" value="${esc(c.title)}" maxlength="200"><textarea aria-label="Memory ${i + 1} explanation" data-body="${i}" rows="3" maxlength="10000">${esc(c.body)}</textarea><small>${icon("file-text")} ${esc(c.source)} · page ${c.page}</small></div><button class="icon-button" data-remove="${i}" aria-label="Remove memory ${i + 1}">${icon("trash-2")}</button></article>`,
    )
    .join("");
  list
    .querySelectorAll<HTMLInputElement>("[data-title]")
    .forEach(
      (el) => (el.oninput = () => (draft[+el.dataset.title!].title = el.value)),
    );
  list
    .querySelectorAll<HTMLTextAreaElement>("[data-body]")
    .forEach(
      (el) => (el.oninput = () => (draft[+el.dataset.body!].body = el.value)),
    );
  list.querySelectorAll<HTMLElement>("[data-remove]").forEach(
    (el) =>
      (el.onclick = () => {
        draft.splice(+el.dataset.remove!, 1);
        renderReview();
      }),
  );
  refreshIcons();
}
function environmentCards() {
  return `<div class="environment-grid">${(["house", "carnival"] as const).map((env) => `<button class="environment-card ${chosen === env ? "selected" : ""}" data-env="${env}"><div class="environment-image"><img src="${import.meta.env.BASE_URL}previews/${env}.jpg" alt="${env === "house" ? "Furnished sunlit house" : "Illuminated carnival"}"><span class="selection-check">${icon("check")}</span><span class="pill">${env === "house" ? "CALM & FAMILIAR" : "VIVID & PLAYFUL"}</span></div><div class="environment-copy"><h2>${env === "house" ? "The Sunlit House" : "The Twilight Carnival"}</h2><p>${env === "house" ? "Warm timber, a quiet reading corner, and sun-washed rooms. A familiar home for complex ideas." : "Glowing lanterns, colorful stalls, and a turning Ferris wheel. Make every memory an occasion."}</p><div class="environment-meta"><span>${icon("map-pin")} 16 distinct locations</span><span>${icon("box")} PBR assets</span></div></div></button>`).join("")}</div>`;
}
function chooseEnvironment() {
  shell(
    `<header class="topbar"><span>Create a palace <b>/</b> Choose a world</span><span>03 / 03</span></header><section class="page"><div class="steps"><span>01 &nbsp; Add material</span><span>02 &nbsp; Review memories</span><span class="current">03 &nbsp; Choose a world</span></div><div class="eyebrow">A SETTING THAT STICKS</div><h1>Where will your knowledge live?</h1><p class="intro">Choose somewhere you’ll enjoy coming back to. We’ll place your memories along a consistent route.</p>${environmentCards()}<div class="build-summary"><div>${icon("notebook-pen")}<span><strong>${esc(draftName)}</strong><small>${draft.length} memories · ${Math.ceil(draft.length / PAGE_SIZE)} wings · saved on this device</small></span></div><span>Ready to make it memorable?</span></div><div class="form-actions">${button(icon("arrow-left") + " Review memories", "back-review", "button subtle")}${button("Build my palace " + icon("arrow-right"), "build", "button primary")}</div></section>`,
    "create",
  );
  bindEnvironments();
  on("back-review", () => review());
  on("build", async () => {
    const btn = document.querySelector<HTMLButtonElement>("#build")!;
    btn.disabled = true;
    try {
      active = {
        id: crypto.randomUUID(),
        name: draftName,
        environment: chosen,
        created: new Date().toISOString(),
        cards: draft.map((c, i) => ({ ...c, anchor: i })),
        seen: [],
        attempts: [],
      };
      await savePalace(active);
      wing = 0;
      mode = "learn";
      enter();
    } catch (e) {
      fail(e);
      btn.disabled = false;
    }
  });
}
function bindEnvironments() {
  document.querySelectorAll<HTMLElement>("[data-env]").forEach(
    (el) =>
      (el.onclick = () => {
        chosen = el.dataset.env as typeof chosen;
        document
          .querySelectorAll("[data-env]")
          .forEach((e) => e.classList.toggle("selected", e === el));
      }),
  );
}
function environmentLibrary() {
  shell(
    `<header class="topbar"><span>Workspace <b>/</b> Environment library</span><span>Bundled for offline learning</span></header><section class="page"><div class="eyebrow">WORLDS TO MAKE YOUR OWN</div><h1>A place for every kind of mind.</h1><p class="intro">Two curated environments, sixteen detailed props, and a growing collection of memorable locations.</p>${environmentCards()}<div class="notice">${icon("box")} Both worlds ship with the app. Models and surface textures: Poly Haven, CC0. Environment architecture and carnival structures are built for Memory Palace.</div><div class="form-actions">${button("Create a palace " + icon("arrow-right"), "from-assets", "button primary")}</div></section>`,
    "assets",
  );
  bindEnvironments();
  on("from-assets", () => upload());
}
function wingCards() {
  return active.cards.filter((c) => Math.floor(c.anchor / PAGE_SIZE) === wing);
}
function nameAt(index: number) {
  return (active.environment === "house" ? ANCHOR_NAMES : CARNIVAL_NAMES)[
    index
  ];
}
function enter() {
  stopScene();
  near = null;
  const cards = wingCards();
  app.innerHTML = `<div class="experience"><div id="world"></div><header class="experience-bar">${button(icon("arrow-left") + " Library", "leave", "button glass")}<div class="experience-title"><strong>${esc(active.name)}</strong><small>${active.environment === "house" ? "The Sunlit House" : "The Twilight Carnival"} <span>·</span> Wing ${wing + 1}</small></div><div class="mode-switch">${button(icon("book-open") + " Learn", "learn-mode", `mode-button ${mode === "learn" ? "selected" : ""}`)}${button(icon("brain") + " Test recall", "test-mode", `mode-button ${mode === "test" ? "selected" : ""}`)}</div>${button(icon("settings-2"), "world-settings", "button glass icon-only")}</header><aside class="journey-panel glass-panel" id="journey"></aside><div id="world-loading" class="world-loading"><div class="spinner"></div><h2>Opening your palace</h2><p>Arranging light, objects, and memories…</p></div><div id="study-panel"></div><div id="crosshair">+</div><div class="interaction-hint" id="interaction-hint"></div><footer class="world-footer glass-panel"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move <b>·</b> Drag to look <b>·</b> <kbd>E</kbd> Interact</span><div>${button(icon("mouse-pointer-2") + " Capture mouse", "capture", "text-button")}${button(icon("locate-fixed") + " Reset position", "reset-position", "text-button")}</div></footer><div class="world-credit">Powered by Poly Haven</div></div>`;
  on("leave", () => void library());
  on("learn-mode", () => {
    mode = "learn";
    scene?.setTest(false);
    renderJourney();
    closePanel();
    updateMode();
  });
  on("test-mode", () => startTest());
  on("world-settings", () => worldSettings());
  on("capture", () => void scene?.lock());
  on("reset-position", () => {
    if (mode === "test") {
      toast("Return to Learn mode to use guided navigation.");
      return;
    }
    scene?.jump(0);
  });
  renderJourney();
  refreshIcons();
  try {
    scene = new PalaceScene(document.querySelector("#world")!, {
      environment: active.environment,
      count: cards.length,
      quality,
      onSelect: interact,
      onNear: (i) => {
        near = i;
        updateHint();
      },
      onReady: () => document.querySelector("#world-loading")?.remove(),
      onError: toast,
    });
    scene.setTest(mode === "test");
    scene.setVisited(
      cards
        .filter((c) => active.seen.includes(c.id))
        .map((c) => c.anchor % PAGE_SIZE),
    );
  } catch (e) {
    document.querySelector("#world-loading")!.innerHTML =
      "<h2>3D graphics could not start</h2><p>Update your graphics driver and make sure hardware acceleration is available. You can return to the library above.</p>";
    fail(e);
  }
}
function updateMode() {
  document
    .querySelector("#learn-mode")
    ?.classList.toggle("selected", mode === "learn");
  document
    .querySelector("#test-mode")
    ?.classList.toggle("selected", mode === "test");
  updateHint();
}
function renderJourney() {
  const el = document.querySelector("#journey")!;
  const cards = wingCards();
  if (mode === "learn") {
    el.innerHTML = `<span class="tiny-label">YOUR MEMORY ROUTE</span><h2>A walk through your knowledge.</h2><label for="wing">Choose a wing</label><select id="wing">${Array.from({ length: Math.ceil(active.cards.length / PAGE_SIZE) }, (_, i) => `<option value="${i}" ${i === wing ? "selected" : ""}>Wing ${i + 1} · memories ${i * PAGE_SIZE + 1}–${Math.min((i + 1) * PAGE_SIZE, active.cards.length)}</option>`).join("")}</select><div class="route-list">${cards.map((c, i) => `<button data-stop="${i}" class="route-stop ${active.seen.includes(c.id) ? "visited" : ""}"><span>${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(c.title)}</strong><small>${nameAt(i)}</small></div>${active.seen.includes(c.id) ? icon("check") : ""}</button>`).join("")}</div><p class="route-note">Select a stop for a guided visit, or walk freely and press E near an object.</p>`;
    el.querySelector<HTMLSelectElement>("#wing")!.onchange = (e) => {
      wing = +(e.target as HTMLSelectElement).value;
      enter();
    };
    el.querySelectorAll<HTMLElement>("[data-stop]").forEach(
      (b) =>
        (b.onclick = () => {
          scene?.jump(+b.dataset.stop!);
          showCard(cards[+b.dataset.stop!]);
        }),
    );
  } else {
    const current = queue[question];
    el.innerHTML = `<span class="tiny-label">SPATIAL RECALL · WING ${wing + 1}</span><div class="test-count">${question + 1}<span> / ${queue.length}</span></div><div class="progress-line"><span style="width:${(question / queue.length) * 100}%"></span></div><h2>Where did this memory live?</h2><div class="question-card"><span>FIND THE LOCATION OF</span><h3>${esc(current?.title || "Complete")}</h3></div><p>Walk to the object where you learned this concept. Press <kbd>E</kbd> to place it.</p><div class="notice compact">Study explanations, route numbers, and guided navigation are hidden until you finish.</div>${button("Skip this memory", "skip", "button glass full")}`;
    on("skip", () => answer(-1));
  }
  refreshIcons();
}
function updateHint() {
  const el = document.querySelector("#interaction-hint");
  if (!el) return;
  el.innerHTML =
    near === null
      ? "<span>Explore your surroundings</span>"
      : `<button id="interact-button"><kbd>E</kbd> ${mode === "test" ? "Place memory here" : "Discover memory"} <span>${esc(nameAt(near))}</span></button>`;
  on("interact-button", () => {
    if (near !== null) interact(near);
  });
}
function interact(index: number) {
  if (document.querySelector("#study-panel")?.childElementCount) return;
  if (mode === "test") answer(wing * PAGE_SIZE + index);
  else {
    const card = wingCards()[index];
    if (card) showCard(card);
  }
}
function closePanel() {
  document.querySelector("#study-panel")!.innerHTML = "";
  scene?.setInteractive(true);
}
function showCard(card: Card) {
  scene?.setInteractive(false);
  const i = card.anchor % PAGE_SIZE;
  document.querySelector("#study-panel")!.innerHTML =
    `<section class="study-card"><div class="study-top"><span class="tiny-label">MEMORY ${String(card.anchor + 1).padStart(2, "0")} · ${esc(nameAt(i))}</span>${button(icon("x"), "close-card", "icon-button")}</div><div class="study-symbol">${icon("sparkles")}</div><h2>${esc(card.title)}</h2><p class="study-body">${esc(card.body)}</p><div class="source-ref">${icon("file-text")} ${esc(card.source)} · page ${card.page}</div><div class="mnemonic"><strong>Make the connection</strong><p>Imagine this idea interacting with ${esc(nameAt(i).toLowerCase())}. Make it unusual, vivid, and personal.</p></div><div class="study-actions">${button(icon("check") + " I’ve explored this", "mark-seen", "button primary")}${button("Next stop " + icon("arrow-right"), "next-stop", "button subtle")}</div></section>`;
  on("close-card", closePanel);
  on("mark-seen", async () => {
    try {
      if (!active.seen.includes(card.id)) active.seen.push(card.id);
      await savePalace(active);
      scene?.setVisited(
        wingCards()
          .filter((c) => active.seen.includes(c.id))
          .map((c) => c.anchor % PAGE_SIZE),
      );
      renderJourney();
      closePanel();
    } catch (e) {
      fail(e);
    }
  });
  on("next-stop", () => {
    const next = wingCards()[(i + 1) % wingCards().length];
    scene?.jump(next.anchor % PAGE_SIZE);
    showCard(next);
  });
  refreshIcons();
}
function startTest() {
  mode = "test";
  queue = shuffled(wingCards());
  answers = {};
  question = 0;
  closePanel();
  scene?.setTest(true);
  scene?.jump(Math.floor(Math.random() * wingCards().length));
  renderJourney();
  updateMode();
  toast("Recall started. Find each memory’s original location.");
}
function answer(anchor: number) {
  if (mode !== "test" || question >= queue.length) return;
  const card = queue[question];
  answers[card.id] = anchor;
  question++;
  if (question < queue.length) {
    renderJourney();
    toast(anchor < 0 ? "Memory skipped." : "Placement recorded.");
  } else void finishTest();
}
async function finishTest() {
  const result = grade(queue, answers);
  const attempt = { date: new Date().toISOString(), ...result };
  active.attempts.push(attempt);
  try {
    await savePalace(active);
  } catch (e) {
    fail(e);
  }
  scene?.setInteractive(false);
  document.querySelector("#journey")!.innerHTML =
    '<span class="tiny-label">RECALL COMPLETE</span><h2>Every attempt strengthens the route.</h2>';
  document.querySelector("#study-panel")!.innerHTML =
    `<section class="study-card results"><span class="tiny-label">YOUR RECALL RESULTS · WING ${wing + 1}</span><div class="score">${Math.round((result.correct / result.total) * 100)}<span>%</span></div><h2>${result.correct === result.total ? "A place for every memory." : "Your next visit starts here."}</h2><p>${result.correct} of ${result.total} memories placed correctly.</p><div class="result-list">${queue.map((c) => `<div class="result-row">${icon(answers[c.id] === c.anchor ? "circle-check" : "circle-x")}<span><strong>${esc(c.title)}</strong><small>${nameAt(c.anchor % PAGE_SIZE)}${answers[c.id] !== c.anchor ? ` · You chose: ${answers[c.id] < 0 ? "Skipped" : nameAt(answers[c.id] % PAGE_SIZE)}` : ""}</small></span></div>`).join("")}</div><div class="study-actions">${button("Back to learning", "back-learning", "button primary")}${button("Try again", "retry", "button subtle")}</div></section>`;
  on("back-learning", () => {
    mode = "learn";
    closePanel();
    scene?.setTest(false);
    renderJourney();
    updateMode();
    if (result.missed.length) {
      const c = active.cards.find((c) => c.id === result.missed[0])!;
      scene?.jump(c.anchor % PAGE_SIZE);
      showCard(c);
    }
  });
  on("retry", () => startTest());
  refreshIcons();
}
function modal(content: string) {
  document.querySelector("#modal")?.remove();
  const el = document.createElement("div");
  el.id = "modal";
  el.className = "modal-backdrop";
  el.innerHTML = `<section class="modal" role="dialog" aria-modal="true"><button id="modal-close" class="icon-button modal-close" aria-label="Close">${icon("x")}</button>${content}</section>`;
  app.append(el);
  scene?.setInteractive(false);
  on("modal-close", () => {
    el.remove();
    scene?.setInteractive(
      !document.querySelector("#study-panel")?.childElementCount,
    );
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.getElementById("modal-close")?.click();
    if (e.key === "Tab") {
      const items = Array.from(
        el.querySelectorAll<HTMLElement>("button,input,select,a,textarea"),
      ).filter((x) => !(x as HTMLButtonElement).disabled);
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  refreshIcons();
  el.querySelector<HTMLButtonElement>("button")?.focus();
}
function manage(p: Palace) {
  modal(
    `<span class="eyebrow">MANAGE PALACE</span><h2>${esc(p.name)}</h2><label class="field-label" for="rename">Palace name</label><input id="rename" class="wide-input" value="${esc(p.name)}" maxlength="100"><p>${p.cards.length} memories · ${p.attempts.length} recall attempts</p>${p.attempts.length ? `<p>Last score: ${p.attempts.at(-1)!.correct}/${p.attempts.at(-1)!.total}</p>` : ""}<div class="modal-actions">${button("Save name", "save-name", "button primary")}${button(icon("download") + " Export backup", "export", "button")}${button(icon("trash-2") + " Delete palace", "delete", "button danger")}</div>`,
  );
  on("save-name", async () => {
    const name = document
      .querySelector<HTMLInputElement>("#rename")!
      .value.trim();
    if (!name) {
      toast("Enter a palace name.");
      return;
    }
    try {
      p.name = name;
      await savePalace(p);
      void library();
    } catch (e) {
      fail(e);
    }
  });
  on("export", () => {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ format: "memory-palace-v2", palace: p }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = p.name.replace(/[^\w -]/g, "") + ".palace.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  on("delete", () => {
    modal(
      `<h2>Delete ${esc(p.name)}?</h2><p>This removes the palace, its memories, and its test history from this device. Export a backup first if you want to keep it.</p>${button("Delete permanently", "confirm-delete", "button danger")}`,
    );
    on("confirm-delete", async () => {
      try {
        await deletePalace(p.id);
        void library();
      } catch (e) {
        fail(e);
      }
    });
  });
}
function restore() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async () => {
    try {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024)
        throw Error("Backup is too large (10 MB maximum).");
      const value = JSON.parse(await file.text());
      if (value.format !== "memory-palace-v2")
        throw Error("Choose a Memory Palace v2 backup.");
      const p = validatePalace(value.palace);
      p.id = crypto.randomUUID();
      p.name += " (restored)";
      await savePalace(p);
      void library();
      toast("Palace restored.");
    } catch (e) {
      fail(e);
    }
  };
  input.click();
}
function qualityOptions() {
  return `<label class="field-label" for="quality">Graphics quality</label><select id="quality"><option value="balanced" ${quality === "balanced" ? "selected" : ""}>Balanced · recommended for laptops</option><option value="high" ${quality === "high" ? "selected" : ""}>High · sharper rendering and shadows</option></select>`;
}
function settings() {
  modal(
    `<span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>Settings & help</h2>${qualityOptions()}<p>Quality changes apply when you next enter a palace.</p><h3>Learning in your palace</h3><p>Move with WASD or arrow keys. Drag to look around, or capture the mouse and press Escape to release it. Press E near an object to study or place a memory.</p><h3>Your data stays here</h3><p>Palaces are stored in this app on this device. Export backups from a palace’s menu before uninstalling or moving computers.</p><h3>Source fidelity</h3><p>Local extraction groups passages from your material. Review the cards for completeness. Image-only PDFs, diagrams, and complex tables need manual transcription or OCR.</p><small>Models and textures: Poly Haven (CC0). Powered by Poly Haven.</small>`,
  );
  document.querySelector<HTMLSelectElement>("#quality")!.onchange = (e) => {
    quality = (e.target as HTMLSelectElement).value as typeof quality;
    localStorage.setItem("palace-quality", quality);
  };
}
function worldSettings() {
  modal(
    `<h2>Palace settings</h2>${qualityOptions()}<p>Applying graphics settings restarts this wing and returns you to Learn mode.</p>${button("Apply settings", "apply-quality", "button primary")}`,
  );
  on("apply-quality", () => {
    quality = document.querySelector<HTMLSelectElement>("#quality")!
      .value as typeof quality;
    localStorage.setItem("palace-quality", quality);
    mode = "learn";
    enter();
  });
}
window.addEventListener("unhandledrejection", (event) => {
  fail(event.reason);
});
void library();
