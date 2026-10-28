from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow


class LessonProgress(Base):

    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("user_id", "level", "number", name="one_progress_per_lesson"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    level: Mapped[int] = mapped_column(Integer)
    number: Mapped[int] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User", lazy="joined")

    def __str__(self):
        return f"{self.level}.{self.number}"


class ExamAttempt(Base):

    __tablename__ = "exam_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    level: Mapped[int] = mapped_column(Integer)
    full_name: Mapped[str] = mapped_column(String(150))
    questions: Mapped[list] = mapped_column(JSON)
    answers: Mapped[list | None] = mapped_column(JSON)
    score: Mapped[int | None] = mapped_column(Integer)
    passed: Mapped[bool | None] = mapped_column(Boolean)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    ends_at: Mapped[datetime] = mapped_column(UTCDateTime)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    user = relationship("User", lazy="joined")

    def __str__(self):
        return f"{self.user_id} · {self.level}"


class Certificate(Base):

    __tablename__ = "certificates"
    __table_args__ = (UniqueConstraint("user_id", "level", name="one_certificate_per_level"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    number: Mapped[str] = mapped_column(String(30), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    attempt_id: Mapped[int | None] = mapped_column(ForeignKey("exam_attempts.id", ondelete="SET NULL"))
    level: Mapped[int] = mapped_column(Integer)
    full_name: Mapped[str] = mapped_column(String(150))
    percent: Mapped[int] = mapped_column(Integer)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    issued_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User", lazy="joined")

    def __str__(self):
        return self.number
