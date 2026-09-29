/*
  Логика мини-приложения FA Housing («Жильё Финашки»).
  Приложение лежит на GitHub Pages, своего сервера у него нет.
  Все тексты берутся из data.js (его собирает build_webapp.command из texts.py).

  Данные боту передаются через Telegram (tg.sendData) — это работает, только если
  приложение открыто кнопкой «📱 Приложение» под полем ввода. После отправки
  приложение закрывается, а бот отвечает в чате.

  Экраны: home (меню), rent, roommate, contract, checklist, about.
*/

const tg = window.Telegram && window.Telegram.WebApp;
const app = document.getElementById("app");
const D = window.APP_DATA;
const T = D.texts;
const BRAND = "#005E65";

let screen = "home";     // какой экран сейчас открыт
let draft = loadDraft(); // что введено в анкету (запоминается на телефоне)

// ---------- Значки ----------
// Линейные значки 24×24. Класс "acc" — красная деталь, как крыша на логотипе.

const ICONS = {
  rent: '<path d="M5.5 11v8.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V11"/><path class="acc" d="M3 12.5 12 4.5l9 8"/><path d="M10 20.5v-5h4v5"/>',
  roommate: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.7-3.3 3.1-5.5 6-5.5s5.3 2.2 6 5.5"/><circle class="acc" cx="17" cy="8.5" r="2.6"/><path class="acc" d="M16.5 13.6c2.4.3 4 2.3 4.5 5.4"/>',
  contract: '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 10.5h6M9 13.5h4"/><path class="acc" d="m9.5 17.3 1.8 1.7 3.4-3.4"/>',
  checklist: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 3h6v3H9z"/><path class="acc" d="m8.3 11 1.4 1.4 2.5-2.6M8.3 16.2l1.4 1.4 2.5-2.6"/><path d="M14.2 11.3h1.8M14.2 16.5h1.8"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle class="acc-fill" cx="12" cy="7.6" r="1.25"/>',
  shield: '<path d="M12 3 19 6v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6z"/><path class="acc" d="m8.8 12 2.2 2.2 4.2-4.3"/>',
  building: '<path d="M3.5 20.5h17"/><path d="M6 20.5V6.5L12 3l6 3.5v14"/><path class="acc" d="M9.5 9h.01M14.5 9h.01M9.5 12.5h.01M14.5 12.5h.01" stroke-width="2.6"/><path d="M11 20.5V17h2v3.5"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path class="acc" d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
  moon: '<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/><path class="acc" d="M16.5 4.5v2.4M15.3 5.7h2.4"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};
const SCHEDULE_ICONS = ["sun", "moon"]; // для вариантов «Жаворонок» и «Сова»

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONS[name];
  return svg;
}

// ---------- Помощники ----------

// Создаёт элемент: h("div", {class: "card"}, "текст", другойЭлемент)
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "html") el.innerHTML = value;            // только для текстов из texts.py
    else if (key === "class") el.className = value;
    else if (value === true) el.setAttribute(key, "");
    else if (value !== false && value != null) el.setAttribute(key, value);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));     // текст пользователя — всегда как текст
  }
  return el;
}

// Убирает эмодзи из текстов (в чате они остаются, а в приложении вместо них значки)
const clean = (s) => s.replace(/\p{Extended_Pictographic}️?/gu, "").replace(/^[\s‍]+/, "").trim();

// Текст из texts.py (в нём бывают <b>жирные</b> слова)
const rich = (html, cls = "") => h("div", { class: "rich " + cls, html: clean(html) });

const stripTags = (s) => s.replace(/<[^>]+>/g, "");

function alertBox(text) {
  if (tg && tg.isVersionAtLeast("6.2")) tg.showAlert(stripTags(clean(text)));
  else alert(stripTags(clean(text)));
}

function haptic(type) {
  if (tg && tg.isVersionAtLeast("6.1")) tg.HapticFeedback.notificationOccurred(type);
}

// Отправка данных боту. Работает, только если приложение открыто кнопкой под полем ввода:
// тогда Telegram не передаёт initData (при открытии из меню или по ссылке он есть).
function sendToBot(data) {
  if (!tg || tg.initData || tg.platform === "unknown") {
    alertBox(T.need_keyboard);
    return false;
  }
  haptic("success");
  tg.sendData(JSON.stringify(data)); // приложение закроется само
  return true;
}

// Переход на другой экран
function go(name) {
  screen = name;
  render();
  window.scrollTo(0, 0);
}

function render() {
  app.replaceChildren(SCREENS[screen]());
  // Системная кнопка «Назад» Telegram (вверху слева) — везде, кроме меню
  if (tg && tg.isVersionAtLeast("6.1")) {
    if (screen === "home") tg.BackButton.hide(); else tg.BackButton.show();
  }
}

// Шаблон экрана: бирюзовая шапка со значком, содержимое и кнопка «Назад в меню»
function page(key, ...content) {
  return h("div", {},
    h("header", { class: "page-head" },
      h("div", { class: "icon-tile" }, icon(key)),
      h("h2", {}, clean(T.menu[key])),
    ),
    h("div", { class: "content" },
      ...content,
      h("button", { class: "btn ghost", onclick: () => go("home") }, icon("back"), clean(T.back)),
    ),
  );
}

// ---------- Экраны ----------

const SCREENS = {

  home() {
    const items = ["rent", "roommate", "contract", "checklist", "about"].map((key) =>
      h("button", { class: "menu-item", onclick: () => go(key) },
        h("span", { class: "icon-tile" }, icon(key)),
        h("span", { class: "menu-text" }, h("b", {}, clean(T.menu[key])), h("span", { class: "hint" }, T.menu_hints[key])),
        h("span", { class: "chev" }, icon("chevron")),
      ));
    return h("div", {},
      h("header", { class: "hero" },
        h("img", { class: "hero-logo", src: "logo.webp", alt: T.title }),
        h("p", {}, T.subtitle),
      ),
      h("div", { class: "content" },
        h("nav", { class: "menu" }, items),
        h("div", { class: "brand-line" }, "Финансовый университет"),
      ),
    );
  },

  rent() {
    return page("rent",
      h("div", { class: "card" }, rich(T.rent)),
      D.partners.map((p) =>
        h("div", { class: "card partner" },
          h("div", { class: "icon-tile" }, icon("building")),
          h("div", { class: "partner-info" },
            h("div", { class: "partner-name" }, p.name),
            h("div", { class: "hint" }, p.conditions),
          ),
          h("button", { class: "btn small", onclick: () => (tg ? tg.openLink(p.url) : window.open(p.url)) },
            T.partner_open, icon("external")),
        ),
      ),
    );
  },

  roommate() {
    return page("roommate",
      h("div", { class: "card" }, rich(T.roommate, "hint")),
      profileForm(),
    );
  },

  contract() {
    return page("contract",
      h("div", { class: "card feature" },
        h("div", { class: "icon-tile" }, icon("shield")),
        rich(T.consent),
      ),
      h("button", { class: "btn", onclick: () => sendToBot({ action: "contract" }) }, icon("send"), clean(T.agree_contract)),
      h("p", { class: "hint center" }, T.contract_note),
    );
  },

  checklist() {
    const saved = loadChecks();
    const total = D.checklist.length;
    const done = () => Object.values(saved).filter(Boolean).length;
    const counter = h("b", {}, `${done()}/${total}`);
    const label = h("span", { class: "hint" }, T.checklist_progress.replace("{done}", done()).replace("{total}", total));
    const bar = h("div", { class: "progress" }, h("div", { style: `width:${(done() / total) * 100}%` }));

    const update = () => {
      counter.textContent = `${done()}/${total}`;
      label.textContent = T.checklist_progress.replace("{done}", done()).replace("{total}", total);
      bar.firstChild.style.width = `${(done() / total) * 100}%`;
    };

    const items = D.checklist.map(([title, text], i) => {
      const box = h("input", { type: "checkbox" });
      box.checked = !!saved[i];
      const row = h("label", { class: "card check" + (box.checked ? " on" : "") },
        box,
        h("span", { class: "box" }, icon("check")),
        h("div", {},
          h("div", { class: "check-title" }, h("span", { class: "check-num" }, String(i + 1).padStart(2, "0")), title),
          h("div", { class: "hint" }, text)),
      );
      box.addEventListener("change", () => {
        saved[i] = box.checked;
        saveChecks(saved);
        row.classList.toggle("on", box.checked);
        update();
        if (box.checked && done() === total) haptic("success");
      });
      return row;
    });

    return page("checklist",
      h("div", { class: "card progress-card" }, h("div", { class: "progress-top" }, label, counter), bar),
      items,
    );
  },

  about() {
    return page("about",
      h("div", { class: "card" },
        h("img", { class: "about-logo", src: "logo.webp", alt: T.title }),
        rich(T.about),
      ),
      h("div", { class: "card rich" }, T.team),
    );
  },
};

// ---------- Анкета ----------

function profileForm() {
  const errorBox = h("div", { class: "error" });

  const textField = (key, multiline) => {
    const props = {
      placeholder: T.placeholders[key] || "",
      oninput: (e) => { draft[key] = e.target.value; saveDraft(); },
    };
    const el = multiline ? h("textarea", props) : h("input", { ...props, type: "text" });
    el.value = draft[key] || "";
    return h("div", { class: "field" }, h("label", {}, T.labels[key]), el);
  };

  // Варианты-«таблетки». Для режима дня — значки солнца и луны.
  const chipField = (key) => {
    const chips = D.options[key].map((option, i) =>
      h("button", {
        type: "button",
        class: "chip" + (draft[key] === option ? " on" : ""),
        onclick: (e) => {
          draft[key] = option;
          saveDraft();
          for (const c of e.currentTarget.parentNode.children) c.classList.toggle("on", c === e.currentTarget);
        },
      }, key === "schedule" ? icon(SCHEDULE_ICONS[i]) : null, option));
    return h("div", { class: "field" }, h("label", {}, T.labels[key]), h("div", { class: "chips" }, chips));
  };

  // Корпуса — списком, с метро под адресом
  const campusField = () => {
    const rows = D.options.campus.map((option) => {
      const station = D.campus_metro[option];
      return h("button", {
        type: "button",
        class: "option" + (draft.campus === option ? " on" : ""),
        onclick: (e) => {
          draft.campus = option;
          saveDraft();
          for (const r of e.currentTarget.parentNode.children) r.classList.toggle("on", r === e.currentTarget);
        },
      },
        h("span", { class: "radio" }),
        h("span", { class: "option-text" },
          h("span", {}, option),
          station && h("span", { class: "metro" }, T.metro.replace("{station}", station))),
      );
    });
    return h("div", { class: "field" }, h("label", {}, T.labels.campus), h("div", { class: "options" }, rows));
  };

  const send = () => {
    // Контакт можно не заполнять — бот возьмёт @username из Telegram
    const required = ["name", "gender", "course", "budget", "area", "campus", "schedule", "smoking", "about"];
    if (required.some((k) => !(draft[k] || "").trim())) {
      errorBox.textContent = T.fill_all;
      haptic("error");
      return;
    }
    errorBox.textContent = "";
    sendToBot({ action: "profile", ...draft });
  };

  const S = T.form_sections;
  return [
    h("div", { class: "section-title" }, S.me),
    h("div", { class: "card" }, textField("name"), chipField("gender"), textField("course")),
    h("div", { class: "section-title" }, S.home),
    h("div", { class: "card" }, chipField("budget"), textField("area"), campusField()),
    h("div", { class: "section-title" }, S.habits),
    h("div", { class: "card" }, chipField("schedule"), chipField("smoking"), textField("about", true)),
    h("div", { class: "section-title" }, S.contact),
    h("div", { class: "card" }, textField("contact")),
    errorBox,
    h("button", { class: "btn", onclick: send }, icon("send"), T.send_profile),
    h("p", { class: "hint center" }, T.profile_note),
  ];
}

// ---------- Память на телефоне (черновик анкеты и отметки чек-листа) ----------

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* не страшно */ }
}
function loadDraft() { return load("draft"); }
function saveDraft() { save("draft", draft); }
function loadChecks() { return load("checklist"); }
function saveChecks(value) { save("checklist", value); }

// ---------- Запуск ----------

// Тёмная тема — как в Telegram (или как в системе, если открыто не в Telegram)
const dark = tg && tg.colorScheme ? tg.colorScheme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.dataset.theme = dark ? "dark" : "light";

if (tg) {
  tg.ready();
  tg.expand();
  // Верхняя панель Telegram — бирюзовая, сливается с шапкой приложения
  if (tg.isVersionAtLeast("6.9")) tg.setHeaderColor(BRAND);
  if (tg.isVersionAtLeast("6.1")) {
    tg.setBackgroundColor(dark ? "#0A1B1D" : "#F1F5F5");
    tg.BackButton.onClick(() => go("home"));
  }
}
render();
