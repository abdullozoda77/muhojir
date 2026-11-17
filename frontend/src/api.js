import { lang, t } from "./i18n.js";

const API = "/api";

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    return null;
  }
}

export const tokens = {
  get access() {
    return store("access");
  },
  get refresh() {
    return store("refresh");
  },
  save({ access, refresh }) {
    if (access) store("access", access);
    if (refresh) store("refresh", refresh);
  },
  clear() {
    store("access", null);
    store("refresh", null);
  },
};

let onLogout = () => {};
export function setLogoutHandler(handler) {
  onLogout = handler;
}

let refreshing = null;

function refreshAccessToken() {
  refreshing ??= (async () => {
    if (!tokens.refresh) return false;
    const res = await fetch(`${API}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!res.ok) return false;
    tokens.save(await res.json());
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

const SERVER_MESSAGES = {
  "A code was just sent. Wait a minute before asking for a new one.": "Рамз ҳозир фиристода шуд. Як дақиқа интизор шавед.",
  "The email could not be sent. Try again in a few minutes.": "Мактуб фиристода нашуд. Баъд аз чанд дақиқа боз кӯшиш кунед.",
  "The code has expired. Ask for a new one.": "Мӯҳлати рамз гузашт. Рамзи нав гиред.",
  "Too many wrong tries. Ask for a new code.": "Кӯшишҳои хато зиёд шуданд. Рамзи нав гиред.",
  "Wrong code.": "Рамз нодуруст аст.",
  "The code is 6 digits.": "Рамз 6 рақам дорад.",
  "This account is blocked.": "Ин ҳисоб баста шудааст.",
  "This phone number is already used by another account.": "Ин рақами телефон аллакай дар ҳисоби дигар ҳаст.",
  "The end date must be after the issue date.": "Санаи анҷом бояд баъд аз санаи додан бошад.",
  "You already reviewed this employer. Edit that review instead.": "Шумо аллакай ба ин корфармо баҳо додаед.",
  "This job belongs to another employer.": "Ин ҷойи кор аз корфармои дигар аст.",
  "This complaint comes from your review. Change the review instead.": "Ин шикоят аз шарҳи шумост. Шарҳро иваз кунед.",
  "Wrong email or password.": "Почта ё парол нодуруст аст.",
  "This email is already registered. Log in or reset the password.": "Ин почта аллакай сабти ном шудааст. Ворид шавед ё паролро барқарор кунед.",
  "Confirm your email first. We sent you a code.": "Аввал почтаро тасдиқ кунед. Мо рамз фиристодем.",
  "This email is already confirmed or not registered.": "Ин почта аллакай тасдиқ шудааст ё сабти ном нашудааст.",
  "Введённый пароль слишком короткий. Он должен состоять из как минимум 8 символов.": "Парол кӯтоҳ аст: ҳадди ақал 8 аломат лозим.",
  "Введённый пароль слишком широко распространён.": "Ин парол хеле оддӣ аст. Пароли дигар созед.",
  "Введённый пароль состоит только из цифр.": "Парол набояд танҳо аз рақамҳо иборат бошад.",
  "Введённый пароль слишком похож на email.": "Парол ба почтаи электронӣ хеле монанд аст.",
  "Введите правильный адрес электронной почты.": "Суроғаи дурусти почтаи электрониро нависед.",
  "Write the text or add a photo of the document.": "Матнро нависед ё сурати ҳуҷҷатро илова кунед.",
  "Choose a different language to translate into.": "Забони дигарро барои тарҷума интихоб кунед.",
  "Send a photo (jpg, png, webp) or a PDF.": "Сурат (jpg, png, webp) ё PDF фиристед.",
  "Write a phone number so the translator can reach you.": "Рақами телефонро нависед, то тарҷумон бо шумо тамос гирад.",
  "The translator is already working on it; this order cannot be cancelled.": "Тарҷумон аллакай кор мекунад — фармоишро бекор карда намешавад.",
  "Cancel the order first.": "Аввал фармоишро бекор кунед.",
  "Certificate not found.": "Сертификат ёфт нашуд.",
  "Tickets are only between Tajikistan and Russia (either way).": "Чиптаҳо танҳо байни Тоҷикистон ва Русия (ба ҳар ду тараф).",
  "Level not found.": "Сатҳ ёфт нашуд.",
  "Lesson not found.": "Дарс ёфт нашуд.",
  "File not found.": "Файл ёфт нашуд.",
  "Not found.": "Ёфт нашуд.",
  "You can leave one review a day. Bug reports can be sent any time.": "Дар як рӯз як фикр навиштан мумкин. Хатои сайтро ҳар вақт фиристода метавонед.",
  "Could not sign in with Google. Try again.": "Бо Google ворид шуда нашуд. Боз кӯшиш кунед.",
  "Google login is not set up.": "Воридшавӣ бо Google ҳоло танзим нашудааст.",
  "Wrong phone number or password.": "Рақами телефон ё парол нодуруст аст.",
  "Telegram is not connected.": "Telegram пайваст нашудааст.",
  "Address search is not available now. Tap the shop on the map.": "Ҷустуҷӯи суроға ҳоло кор намекунад. Ҷойи мағозаро дар харита пахш кунед.",
  "The AI assistant is busy. Try again in a minute.": "Ёрдамчии AI банд аст. Баъд аз як дақиқа боз кӯшиш кунед.",
  "The AI assistant is not available right now.": "Ёрдамчии AI ҳоло дастрас нест.",
  "Add a photo of the place and a photo of the goods first.": "Аввал сурати ҷой ва сурати молҳоро илова кунед.",
  "Add a photo of the place.": "Сурати ҷойро илова кунед.",
  "Confirm that the place is real and the information is true.": "Тасдиқ кунед, ки ҷой воқеӣ аст ва маълумот дуруст аст.",
  "Confirm that the place really exists.": "Тасдиқ кунед, ки ин ҷой воқеан ҳаст.",
  "Enter the phone number with the country code, e.g. +79991234567.": "Рақамро бо рамзи кишвар нависед, масалан +79991234567.",
  "Finish all lessons of this level first.": "Аввал ҳамаи дарсҳои ин сатҳро хатм кунед.",
  "Finish the previous lesson first.": "Аввал дарси пешинаро хатм кунед.",
  "Give at least one contact: phone, WhatsApp or Telegram.": "Ақаллан як роҳи тамос нависед: телефон, WhatsApp ё Telegram.",
  "Mark where the place is on the map.": "Ҷойро дар харита нишон диҳед.",
  "Mark where the shop is on the map.": "Ҷойи мағозаро дар харита нишон диҳед.",
  "Send a photo: jpg, png or webp.": "Сурат фиристед: jpg, png ё webp.",
  "Telegram is not set up on this site yet.": "Telegram дар ин сайт ҳоло танзим нашудааст.",
  "The question is too long (1000 characters at most).": "Савол хеле дароз аст (ҳадди аксар 1000 аломат).",
  "This day is already over.": "Ин рӯз аллакай гузашт.",
  "This exam is already finished.": "Ин имтиҳон аллакай тамом шуд.",
  "This is not your document.": "Ин ҳуҷҷати шумо нест.",
  "This month is already over.": "Ин моҳ аллакай гузашт.",
  "This phone number is already registered. Log in.": "Ин рақам аллакай сабт шудааст. Ворид шавед.",
  "Use a 3-letter IATA code, e.g. DYU or MOW.": "Рамзи 3-ҳарфаи IATA нависед, масалан DYU ё MOW.",
  "Use the month as YYYY-MM, e.g. 2026-11.": "Моҳро чун YYYY-MM нависед, масалан 2026-11.",
  "Write the Telegram username, e.g. @dukoni_mo.": "Номи корбари Telegram-ро нависед, масалан @dukoni_mo.",
  "Write the address: city, street and house.": "Суроғаро нависед: шаҳр, кӯча ва хона.",
  "Write the answer.": "Ҷавобро нависед.",
  "Write the reason in a few words (at least 10 letters).": "Сабабро бо чанд калима нависед (ақаллан 10 ҳарф).",
  "You already passed this level.": "Шумо ин сатҳро аллакай супоридаед.",
  "You can try the exam again later.": "Имтиҳонро баъдтар боз супорида метавонед.",
  "You log in with this phone number, so it cannot be removed.": "Шумо бо ин рақам ворид мешавед, бинобар ин онро нест кардан мумкин нест.",
  "A review cannot be moved to another employer.": "Шарҳро ба корфармои дигар гузарондан мумкин нест.",
  "Введите правильное число.": "Рақами дурустро нависед.",
  "Должно быть булево значение.": "Ҷавоби «ҳа» ё «не» лозим аст.",
  "Загруженный файл пуст.": "Файли боршуда холӣ аст.",
  "Значения нет среди допустимых вариантов.": "Ин қимат дар байни вариантҳо нест.",
  "Неправильный формат date. Используйте формат YYYY-MM-DD.": "Санаи нодуруст. Санаро чун YYYY-MM-DD нависед.",
  "Обязательное поле.": "Ин майдонро пур кунед.",
  "Слишком длинное значение.": "Хеле дароз аст.",
  "У вас недостаточно прав для выполнения данного действия.": "Барои ин амал иҷозат надоред.",
  "Choose at least one filter for the alert.": "Барои огоҳӣ ақаллан як филтр интихоб кунед.",
  "The owner has not sent this shop for checking yet.": "Соҳиб ин мағозаро ҳоло ба санҷиш нафиристодааст.",
  "The shop is already sent for checking.": "Мағоза аллакай ба санҷиш фиристода шудааст.",
  "You can have at most 10 job alerts.": "Ҳадди аксар 10 огоҳии кор доштан мумкин аст.",
  "You cannot review your own shop.": "Ба мағозаи худ баҳо додан мумкин нест.",
  "Неправильное значение.": "Қимати нодуруст.",
  "Ticket prices are not available right now. Try again later.": "Нархи чиптаҳо ҳоло дастрас нест. Баъдтар боз кӯшиш кунед.",
};

const SERVER_PATTERNS = [
  [/^Убедитесь, что это значение содержит не менее (\d+) символов\.$/, "Ақаллан {0} аломат нависед."],
  [/^Убедитесь, что это значение больше либо равно (\S+)\.$/, "Қимат набояд аз {0} кам бошад."],
  [/^Убедитесь, что это значение меньше либо равно (\S+)\.$/, "Қимат набояд аз {0} зиёд бошад."],
  [/^Убедитесь, что это значение больше (\S+)\.$/, "Қимат бояд аз {0} зиёд бошад."],
  [/^Убедитесь, что это значение меньше (\S+)\.$/, "Қимат бояд аз {0} кам бошад."],
  [/^A shop can have at most (\d+) products\.$/, "Дар мағоза ҳадди аксар {0} мол."],
  [/^At most (\d+) photos\.$/, "Ҳадди аксар {0} сурат."],
  [/^At most (\d+) files\.$/, "Ҳадди аксар {0} файл."],
  [/^You already have (\d+) listings waiting for checking\.$/, "Шумо аллакай {0} эълон дар навбати санҷиш доред."],
  [/^You already have (\d+) places waiting for checking\.$/, "Шумо аллакай {0} ҷой дар навбати санҷиш доред."],
  [/^You can have at most (\d+) shops\.$/, "Ҳадди аксар {0} мағоза доштан мумкин аст."],
  [/^You can have at most (\d+) price alerts\.$/, "Ҳадди аксар {0} огоҳии нарх доштан мумкин аст."],
  [/^At least (\d+)% is needed to finish the lesson\.$/, "Барои хатми дарс ақаллан {0}% лозим аст."],
  [/^Unknown airport or city: (\S+)\.$/, "Фурудгоҳ ё шаҳри номаълум: {0}."],
  [/^The file is too big\. The limit is (\d+) MB\.$/, "Файл хеле калон аст. Ҳадди аксар {0} МБ."],
];

export function errorText(data) {
  if (!data) return "";
  if (typeof data === "string") {
    if (SERVER_MESSAGES[data]) return t(SERVER_MESSAGES[data]);
    if (/^No \w+ matches the given query\.$/.test(data)) return t("Ёфт нашуд.");
    for (const [pattern, text] of SERVER_PATTERNS) {
      const found = data.match(pattern);
      if (found) return t(text, found[1]);
    }
    return data;
  }
  if (Array.isArray(data)) return data.map(errorText).join(" ");
  if (data.detail) return errorText(data.detail);
  return Object.values(data).map(errorText).join(" ");
}

export async function api(path, { method = "GET", body, raw = false } = {}) {
  const isForm = body instanceof FormData;
  let sentWith = null;
  const send = () => {
    const headers = { "Accept-Language": lang === "ru" ? "ru" : "tg" };
    if (body && !isForm) headers["Content-Type"] = "application/json";
    sentWith = tokens.access;
    if (sentWith) headers.Authorization = `Bearer ${sentWith}`;
    return fetch(API + path, { method, headers, ...(body ? { body: isForm ? body : JSON.stringify(body) } : {}) });
  };

  let res;
  try {
    res = await send();
  } catch {
    throw Object.assign(new Error(t("Интернет нест ё сервер ҷавоб намедиҳад.")), { status: 0 });
  }
  if (res.status === 401) {
    const hadToken = Boolean(tokens.access);
    if (hadToken && tokens.access !== sentWith) {
      res = await send();
    } else if (hadToken && (await refreshAccessToken())) {
      res = await send();
    } else {
      tokens.clear();
      onLogout();
      if (hadToken) res = await send();
    }
  }

  if (raw && res.ok) return res;
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message = res.status === 401 && !path.startsWith("/auth/") ? t("Лутфан аз нав ворид шавед.") : errorText(data);
    const error = new Error(message || t("Хатогӣ {0}", res.status));
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function apiAll(path) {
  const sep = path.includes("?") ? "&" : "?";
  let page = await api(`${path}${sep}page_size=100`);
  const results = [...page.results];
  while (page.next) {
    page = await api(page.next.slice(page.next.indexOf(API) + API.length));
    results.push(...page.results);
  }
  return results;
}

export async function openPrivateFile(path) {
  const tab = window.open("", "_blank");
  try {
    const res = await api(path, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export function fileProblem(file) {
  if (!file) return null;
  if (!/\.(jpe?g|png|webp|pdf)$/i.test(file.name)) return t("Танҳо сурат (jpg, png, webp) ё PDF.");
  if (file.size > 10 * 1024 * 1024) return t("Файл аз 10 МБ калон аст.");
  return null;
}
