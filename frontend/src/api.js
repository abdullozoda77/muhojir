import { lang, t } from "./i18n.js";

// API calls to the FastAPI server with JWT tokens. Tokens are stored in localStorage.
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

// Called when tokens are no longer valid, so the app can show the user as logged out.
let onLogout = () => {};
export function setLogoutHandler(handler) {
  onLogout = handler;
}

// A refresh token works only once (the server gives a new one and blocks the old), so when several requests
// find the access token expired at the same moment they all wait for one refresh instead of each sending theirs.
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

// The server answers in English; these are the messages people can meet, in Tajik (t() translates them when shown).
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
  "Wrong email or password.": "Почта ё парол нодуруст аст.",
  "This email is already registered. Log in or reset the password.": "Ин почта аллакай сабти ном шудааст. Ворид шавед ё паролро барқарор кунед.",
  "Confirm your email first. We sent you a code.": "Аввал почтаро тасдиқ кунед. Мо рамз фиристодем.",
  "This email is already confirmed or not registered.": "Ин почта аллакай тасдиқ шудааст ё сабти ном нашудааст.",
  // Password rules: the server writes these in Russian (the same texts as Django).
  "Введённый пароль слишком короткий. Он должен состоять из как минимум 8 символов.": "Парол кӯтоҳ аст: ҳадди ақал 8 аломат лозим.",
  "Введённый пароль слишком широко распространён.": "Ин парол хеле оддӣ аст. Пароли дигар созед.",
  "Введённый пароль состоит только из цифр.": "Парол набояд танҳо аз рақамҳо иборат бошад.",
  "Введённый пароль слишком похож на email.": "Парол ба почтаи электронӣ хеле монанд аст.",
  "Введите правильный адрес электронной почты.": "Суроғаи дурусти почтаи электрониро нависед.",
};

export function errorText(data) {
  if (!data) return "";
  if (typeof data === "string") return SERVER_MESSAGES[data] ? t(SERVER_MESSAGES[data]) : data;
  if (Array.isArray(data)) return data.map(errorText).join(" ");
  if (data.detail) return errorText(data.detail);
  return Object.values(data).map(errorText).join(" ");
}

// api("/jobs/jobs/") or api("/documents/my-documents/", { method: "POST", body: {...} }).
// body is sent as JSON, or as it is when it is FormData (for files: photos, receipts).
// raw: true returns the Response itself (for downloading files).
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
      // Another request has already got a new token while this one was on its way: just repeat it.
      res = await send();
    } else if (hadToken && (await refreshAccessToken())) {
      res = await send();
    } else {
      // The saved login is gone or expired: show the site as logged out and repeat as a guest,
      // so public data (jobs, news) still loads.
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

// Every list endpoint is paginated ({count, results}); this reads all pages (for short lists like regions).
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

// Private files (document photos, receipts) need the login token, so a plain <a href> can not open them.
// This downloads the file and opens it in a new tab.
export async function openPrivateFile(path) {
  const tab = window.open("", "_blank"); // opened right away, so the browser does not block it as a pop-up
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

// Checks a chosen file before uploading: the same limits as the server (jpg, png, webp, pdf; 10 MB).
export function fileProblem(file) {
  if (!file) return null;
  if (!/\.(jpe?g|png|webp|pdf)$/i.test(file.name)) return t("Танҳо сурат (jpg, png, webp) ё PDF.");
  if (file.size > 10 * 1024 * 1024) return t("Файл аз 10 МБ калон аст.");
  return null;
}
