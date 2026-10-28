import json
from functools import cache
from pathlib import Path

COURSE_DIR = Path(__file__).resolve().parents[1] / "seed" / "course"
LEVELS = 7
LESSONS_PER_LEVEL = 10
EXAM_SIZE = 20
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


def exam_question(level_number, index):
    return level(level_number)["exam"][index]
