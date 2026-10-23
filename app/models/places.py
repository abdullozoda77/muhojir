from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

# Kinds of places a migrant looks for (the Tajik names are on the site).
PLACE_CATEGORIES = (
    "migration",    # migration centers (ММЦ, МВД)
    "medical",      # clinics for the migrants' medical exam
    "notary",       # notaries (translations of the passport are certified there)
    "translation",  # translation bureaus
    "embassy",      # the embassy and consulates of Tajikistan
    "mosque",
    "food",         # Tajik / Uzbek / Central Asian cafes, choyxona
    "halal",        # halal shops
    "money",        # money transfers and exchange
)


class Place(Base):
    """A useful place on the map. Most come from OpenStreetMap (source "osm", refreshed by the import);
    users may suggest new ones (source "user"), which appear after an editor approves them."""

    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(200))
    region: Mapped[str] = mapped_column(String(100), index=True)  # region of Russia, e.g. Москва, Московская область
    city: Mapped[str] = mapped_column(String(100), default="", index=True)
    address: Mapped[str] = mapped_column(String(255), default="")
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    phone: Mapped[str] = mapped_column(String(60), default="")
    website: Mapped[str] = mapped_column(String(300), default="")
    opening_hours: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(10), default="osm")  # osm, user, editor
    external_id: Mapped[str | None] = mapped_column(String(40), unique=True)  # e.g. osm:node/123
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    def __str__(self):
        return self.name


class PlaceReview(Base):
    """A visitor's rating (1-5) and words about a place; one per person per place."""

    __tablename__ = "place_reviews"
    __table_args__ = (UniqueConstraint("place_id", "author_id", name="one_review_per_place"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    place: Mapped[Place] = relationship()
    author = relationship("User", lazy="joined")
