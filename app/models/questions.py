from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

QUESTION_TOPICS = {
    "documents": "Ҳуҷҷатҳо ва патент",
    "work": "Кор ва маош",
    "housing": "Манзил",
    "health": "Саломатӣ",
    "money": "Пул ва интиқол",
    "travel": "Роҳ ва чипта",
    "life": "Зиндагӣ дар Русия",
    "other": "Дигар",
}


class Question(Base):

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(10), default="other", index=True)
    title: Mapped[str] = mapped_column(String(150))
    body: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    answers_count: Mapped[int] = mapped_column(Integer, default=0)
    best_answer_id: Mapped[int | None] = mapped_column(Integer)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    active_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user = relationship("User", lazy="joined")

    @property
    def topic_label(self):
        return QUESTION_TOPICS.get(self.topic, self.topic)

    def __str__(self):
        return self.title


class Answer(Base):

    __tablename__ = "answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user = relationship("User", lazy="joined")
    question = relationship("Question", lazy="joined")

    def __str__(self):
        return self.body[:80]


class AnswerLike(Base):

    __tablename__ = "answer_likes"
    __table_args__ = (UniqueConstraint("answer_id", "user_id", name="uq_answer_like"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    answer_id: Mapped[int] = mapped_column(ForeignKey("answers.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
