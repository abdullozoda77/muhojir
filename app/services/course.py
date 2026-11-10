import json
import random
from collections import Counter
from functools import cached_property
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parents[1] / "seed"
RETRY_MINUTES = 60
GRACE_SECONDS = 60


class Course:

    def __init__(self, key, folder, levels, lessons_per_level, exam_size, exam_from_lessons, exam_minutes,
                 pass_percent, lesson_pass, prefix, name, page):
        self.key, self.folder = key, SEED_DIR / folder
        self.total_levels, self.lessons_per_level = levels, lessons_per_level
        self.exam_size, self.exam_from_lessons, self.exam_minutes = exam_size, exam_from_lessons, exam_minutes
        self.pass_percent, self.lesson_pass = pass_percent, lesson_pass
        self.prefix, self.name, self.page = prefix, name, page

    @cached_property
    def data(self):
        result = {}
        for number in range(1, self.total_levels + 1):
            path = self.folder / f"level{number}.json"
            if path.exists():
                result[number] = json.loads(path.read_text(encoding="utf-8")) | {"level": number}
        return result

    @cached_property
    def pools(self):
        return {n: data["exam"] + [{"q": e["q"], "ru": e.get("ru", ""), "sign": e.get("sign", ""),
                                    "options": e["options"], "answer": e["answer"]}
                                   for lesson in data["lessons"] for e in lesson["exercises"]
                                   if e.get("type") == "choice"]
                for n, data in self.data.items()}

    def level(self, number):
        return self.data.get(number)

    def levels(self):
        return list(self.data.values())

    def lesson(self, level_number, number):
        data = self.level(level_number)
        if not data or not 1 <= number <= len(data["lessons"]):
            return None
        return data["lessons"][number - 1]

    def exam_pool(self, level_number):
        return self.pools[level_number]

    def exam_question(self, level_number, index):
        return self.exam_pool(level_number)[index]

    def pick_exam(self, level_number, seen=()):
        pool = self.exam_pool(level_number)
        split = len(self.level(level_number)["exam"])
        seen = Counter(seen)
        picked, answers, rest = [], set(), []
        groups = ((range(split), self.exam_size - self.exam_from_lessons),
                  (range(split, len(pool)), self.exam_from_lessons))
        for group, want in groups:
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
        picked += rest[:max(0, self.exam_size - len(picked))]
        random.shuffle(picked)
        return picked


def answer_key(question):
    return question["options"][question["answer"]].strip().lower()


RU = Course("ru", "course", levels=7, lessons_per_level=10, exam_size=20, exam_from_lessons=10, exam_minutes=30,
            pass_percent=80, lesson_pass=60, prefix="MJ-RU", name="курси забони русӣ", page="Курси забони русӣ")
DRIVE = Course("drive", "driving", levels=5, lessons_per_level=5, exam_size=20, exam_from_lessons=10,
               exam_minutes=20, pass_percent=90, lesson_pass=70, prefix="MJ-PDD", name="курси ронандагӣ (ҚҲР)",
               page="Курси ронандагӣ")
COURSES = {c.key: c for c in (RU, DRIVE)}

LEVELS = RU.total_levels
LESSONS_PER_LEVEL = RU.lessons_per_level
EXAM_SIZE = RU.exam_size
EXAM_FROM_LESSONS = RU.exam_from_lessons
EXAM_MINUTES = RU.exam_minutes
PASS_PERCENT = RU.pass_percent
LESSON_PASS = RU.lesson_pass
level = RU.level
levels = RU.levels
lesson = RU.lesson
exam_pool = RU.exam_pool
exam_question = RU.exam_question
pick_exam = RU.pick_exam


def warm_up():
    for c in COURSES.values():
        c.pools
