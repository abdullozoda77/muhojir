import { api } from "./api.js";

const QUEUE = "offline-lessons";
const SAVED = "offline-saved-";
export const SYNCED = "offline-synced";

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

const same = (a, b) => a.api === b.api && a.level === b.level && a.number === b.number;

export function queueLesson(course, level, number, score) {
  const item = { api: course.api, level, number, score };
  const items = read(QUEUE, []);
  const old = items.find((i) => same(i, item));
  write(QUEUE, [...items.filter((i) => !same(i, item)), { ...item, score: Math.max(score, old?.score ?? 0) }]);
}

export function queuedLessons() {
  return read(QUEUE, []);
}

let flushing = null;

export function flushLessons() {
  flushing ??= (async () => {
    let sent = 0;
    for (const item of read(QUEUE, [])) {
      try {
        await api(`${item.api}/levels/${item.level}/lessons/${item.number}/complete/`, { method: "POST", body: { score: item.score } });
        sent += 1;
      } catch (error) {
        if (error.status === 0) break;
      }
      write(QUEUE, read(QUEUE, []).filter((i) => !same(i, item) || i.score > item.score));
    }
    if (sent) window.dispatchEvent(new Event(SYNCED));
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function savedForOffline(course) {
  return read(SAVED + course.store, null);
}

export async function saveForOffline(course, levels, user, onProgress) {
  const lessons = levels.flatMap((level) => level.lessons.filter((l) => l.unlocked).map((l) => [level.level, l.number]));
  let done = 0;
  for (const [level, number] of lessons) {
    await api(`${course.api}/levels/${level}/lessons/${number}/?u=${user?.id ?? ""}`);
    done += 1;
    onProgress?.(done, lessons.length);
  }
  const value = { at: new Date().toISOString(), lessons: done };
  write(SAVED + course.store, value);
  return value;
}
