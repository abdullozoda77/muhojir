"""Lists come in pages, like the Django version: {"count", "next", "previous", "results"}.
?page=2&page_size=50 (10 by default, 100 at most)."""
from typing import Annotated

from fastapi import Depends, Query, Request
from sqlalchemy import func, select

from app.core.errors import ApiError

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100


class Page:
    def __init__(self, request: Request, page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int | None, Query(ge=1)] = None):
        self.request = request
        self.page = page
        self.size = min(page_size or DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

    def _link(self, page):
        if page is None:
            return None
        url = self.request.url.remove_query_params("page")
        return str(url if page == 1 else url.include_query_params(page=page))

    async def respond(self, db, query, to_dict):
        """query: a select(...) of the rows; to_dict(row) -> the JSON of one row."""
        count = await db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
        pages = max(1, -(-count // self.size))
        if self.page > pages:
            raise ApiError("Неправильная страница", 404)
        rows = (await db.execute(query.limit(self.size).offset((self.page - 1) * self.size))).unique().all()
        results = [to_dict(*row) if len(row) > 1 else to_dict(row[0]) for row in rows]
        return {
            "count": count,
            "next": self._link(self.page + 1 if self.page < pages else None),
            "previous": self._link(self.page - 1 if self.page > 1 else None),
            "results": results,
        }


Paginate = Annotated[Page, Depends()]
