import json
import random
from collections import Counter
from functools import cache
from pathlib import Path

COURSE_DIR = Path(__file__).resolve().parents[1] / "seed" / "course"
LEVELS = 7
LESSONS_PER_LEVEL = 10
EXAM_SIZE = 20
EXAM_FROM_LESSONS = 10
EXAM_MINUTES = 30
PASS_PERCENT = 80
LESSON_PASS = 60
RETRY_MINUTES = 60
GRACE_SECONDS = 60


@cache
def level(number):
    path = COURSE_DIR / f"level{number}.json"
    if not 1 <= number <= LEVELS or not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    data["level"] = number
    return data


def levels():
    return [data for n in range(1, LEVELS + 1) if (data := level(n))]


def lesson(level_number, number):
    data = level(level_number)
    if not data or not 1 <= number <= len(data["lessons"]):
        return None
    return data["lessons"][number - 1]


@cache
def exam_pool(level_number):
    data = level(level_number)
    extra = [{"q": e["q"], "ru": e.get("ru", ""), "options": e["options"], "answer": e["answer"]}
             for lesson_data in data["lessons"] for e in lesson_data["exercises"] if e.get("type") == "choice"]
    return data["exam"] + extra


def exam_question(level_number, index):
    return exam_pool(level_number)[index]


def answer_key(question):
    return question["options"][question["answer"]].strip().lower()


def pick_exam(level_number, seen=()):
    pool = exam_pool(level_number)
    split = len(level(level_number)["exam"])
    seen = Counter(seen)
    picked, answers, rest = [], set(), []
    for group, want in ((range(split), EXAM_SIZE - EXAM_FROM_LESSONS), (range(split, len(pool)), EXAM_FROM_LESSONS)):
        group = random.sample(group, len(group))
        group.sort(key=lambda i: seen[i])
        taken = 0
        for i in group:
            if taken < want and answer_key(pool[i]) not in answers:
                picked.append(i)
                answers.add(answer_key(pool[i]))
                taken += 1
            else:
                rest.append(i)
    rest.sort(key=lambda i: (seen[i], answer_key(pool[i]) in answers))
    picked += rest[:max(0, EXAM_SIZE - len(picked))]
    random.shuffle(picked)
    return picked
