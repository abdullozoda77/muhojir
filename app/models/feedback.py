from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

FEEDBACK_KINDS = {
    "idea": "Пешниҳод",
    "bug": "Хато дар сайт",
    "praise": "Ташаккур",
    "other": "Дигар",
}

FEEDBACK_STATUSES = ("new", "read", "done")


class Feedback(Base):

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10), default="idea")
    rating: Mapped[int | None] = mapped_column(Integer)
    message: Mapped[str] = mapped_column(Text)
    page: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(10), default="new", index=True)
    reply: Mapped[str] = mapped_column(Text, default="")
    replied_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user = relationship("User", lazy="joined")

    @property
    def kind_label(self):
        return FEEDBACK_KINDS.get(self.kind, self.kind)

    def __str__(self):
        return f"{self.kind_label}: {self.message[:40]}"
