/*
  Логика мини-приложения «Жильё Финашки».
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

let screen = "home";     // какой экран сейчас открыт
let draft = loadDraft(); // что введено в анкету (запоминается на телефоне)

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

// Текст из texts.py (в нём бывают <b>жирные</b> слова)
const rich = (html, cls = "") => h("div", { class: "rich " + cls, html });

const stripTags = (s) => s.replace(/<[^>]+>/g, "");

function alertBox(text) {
  if (tg && tg.isVersionAtLeast("6.2")) tg.showAlert(stripTags(text));
  else alert(stripTags(text));
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

// Шаблон экрана: заголовок, содержимое и кнопка «⬅️ Назад в меню»
function page(title, ...content) {
  return h("div", { class: "screen" },
    h("h2", {}, title),
    ...content,
    h("button", { class: "btn secondary", onclick: () => go("home") }, T.back),
  );
}

// «🏠 Партнёрская аренда» → ["🏠", "Партнёрская аренда"]
function splitEmoji(label) {
  const i = label.indexOf(" ");
  return [label.slice(0, i), label.slice(i + 1)];
}

// ---------- Экраны ----------

const SCREENS = {

  home() {
    const items = ["rent", "roommate", "contract", "checklist", "about"].map((key) => {
      const [emoji, title] = splitEmoji(T.menu[key]);
      return h("button", { class: "menu-item", onclick: () => go(key) },
        h("span", { class: "menu-icon" }, emoji),
        h("span", { class: "menu-text" }, h("b", {}, title), h("span", { class: "hint" }, T.menu_hints[key])),
        h("span", { class: "chev" }, "›"),
      );
    });
    return h("div", { class: "screen" },
      h("header", { class: "hero" },
        h("div", { class: "logo" }, "🏡"),
        h("h1", {}, T.title),
        h("p", { class: "hint" }, T.subtitle),
      ),
      h("nav", { class: "menu" }, items),
    );
  },

  rent() {
    return page(splitEmoji(T.menu.rent)[1],
      h("div", { class: "card" }, rich(T.rent)),
      D.partners.map((p) =>
        h("div", { class: "card partner" },
          h("div", { class: "partner-info" },
            h("div", { class: "partner-name" }, p.name),
            h("div", { class: "hint" }, p.conditions),
          ),
          h("button", { class: "btn small", onclick: () => (tg ? tg.openLink(p.url) : window.open(p.url)) }, "Перейти"),
        ),
      ),
    );
  },

  roommate() {
    return page(splitEmoji(T.menu.roommate)[1],
      h("div", { class: "card" }, rich(T.roommate)),
      profileForm(),
    );
  },

  contract() {
    return page(splitEmoji(T.menu.contract)[1],
      h("div", { class: "card" }, rich(T.consent)),
      h("button", { class: "btn", onclick: () => sendToBot({ action: "contract" }) }, T.agree_contract),
      h("p", { class: "hint center" }, T.contract_note),
    );
  },

  checklist() {
    const saved = loadChecks();
    const total = D.checklist.length;
    const done = () => Object.values(saved).filter(Boolean).length;
    const progressText = () => T.checklist_progress.replace("{done}", done()).replace("{total}", total);
    const bar = h("div", { class: "progress" }, h("div", { style: `width:${(done() / total) * 100}%` }));
    const counter = h("div", { class: "hint" }, progressText());

    const items = D.checklist.map(([title, text], i) => {
      const box = h("input", { type: "checkbox" });
      box.checked = !!saved[i];
      const row = h("label", { class: "card check" + (box.checked ? " on" : "") },
        box,
        h("div", {}, h("div", { class: "check-title" }, `${i + 1}. ${title}`), h("div", { class: "hint" }, text)),
      );
      box.addEventListener("change", () => {
        saved[i] = box.checked;
        saveChecks(saved);
        row.classList.toggle("on", box.checked);
        bar.firstChild.style.width = `${(done() / total) * 100}%`;
        counter.textContent = progressText();
        if (box.checked && done() === total) haptic("success");
      });
      return row;
    });

    return page(splitEmoji(T.menu.checklist)[1], counter, bar, items);
  },

  about() {
    return page(splitEmoji(T.menu.about)[1],
      h("div", { class: "card" },
        h("div", { class: "logo" }, "🏡"),
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

  const chipField = (key) => {
    const chips = D.options[key].map((option) =>
      h("button", {
        type: "button",
        class: "chip" + (draft[key] === option ? " on" : ""),
        onclick: (e) => {
          draft[key] = option;
          saveDraft();
          for (const c of e.target.parentNode.children) c.classList.toggle("on", c === e.target);
        },
      }, option));
    return h("div", { class: "field" }, h("label", {}, T.labels[key]), h("div", { class: "chips" }, chips));
  };

  const send = () => {
    // Контакт можно не заполнять — бот возьмёт @username из Telegram
    const required = ["name", "course", "budget", "area", "campus", "schedule", "smoking", "about"];
    if (required.some((k) => !(draft[k] || "").trim())) {
      errorBox.textContent = T.fill_all;
      haptic("error");
      return;
    }
    errorBox.textContent = "";
    sendToBot({ action: "profile", ...draft });
  };

  return h("div", { class: "card" },
    textField("name"),
    textField("course"),
    chipField("budget"),
    textField("area"),
    chipField("campus"),
    chipField("schedule"),
    chipField("smoking"),
    textField("about", true),
    textField("contact"),
    h("div", { class: "field" },
      errorBox,
      h("button", { class: "btn", onclick: send }, T.send_profile),
      h("p", { class: "hint center" }, T.profile_note),
    ),
  );
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

if (tg) {
  tg.ready();
  tg.expand();
  if (tg.isVersionAtLeast("6.1")) {
    tg.setHeaderColor("secondary_bg_color");
    tg.setBackgroundColor("secondary_bg_color");
    tg.BackButton.onClick(() => go("home"));
  }
}
render();
