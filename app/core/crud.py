"""The routes of a simple list that everyone reads and staff change (guides, regions, news, exam questions...):
GET list/ (paged, filtered), GET <id>/, and for staff POST list/, PUT/PATCH <id>/, DELETE <id>/."""
from typing import Annotated

from fastapi import Depends, Request, Response

from app.core.deps import DB, OptionalUser
from app.core.errors import ApiError
from app.core.pagination import Paginate


def add_content_routes(router, path, *, model, to_json, Create, Update, query, writer, check=None, before_save=None, tag=None):
    """query(request, user) -> the select() of what this visitor may see, already filtered by the query string.
    writer: a dependency that lets only staff in. check(db, obj, data): extra validation before saving (async).
    before_save(obj, data, user, created): fills fields like published_at (sync)."""
    Writer = Annotated[object, Depends(writer)]
    name = model.__name__

    async def get_one(db, request, user, item_id):
        item = (await db.execute(query(request, user).where(model.id == item_id))).unique().scalar_one_or_none()
        if item is None:
            raise ApiError(f"No {name} matches the given query.", 404)
        return item

    async def save(db, item, data, user, created):
        if check:
            await check(db, item, data)
        if before_save:
            before_save(item, data, user, created)
        await db.commit()
        query_saved = query(None, user).where(model.id == item.id).execution_options(populate_existing=True)
        item = (await db.execute(query_saved)).unique().scalar_one()
        return to_json(item)

    @router.get(f"/{path}/", name=f"{path}-list")
    async def list_items(request: Request, db: DB, user: OptionalUser, page: Paginate):
        return await page.respond(db, query(request, user), to_json)

    @router.post(f"/{path}/", status_code=201, name=f"{path}-create")
    async def create_item(data: Create, db: DB, user: Writer):
        values = data.model_dump(exclude={"document_types"})
        item = model(**values)
        db.add(item)
        await db.flush()
        return await save(db, item, data, user, True)

    @router.get(f"/{path}/{{item_id}}/", name=f"{path}-detail")
    async def get_item(item_id: int, request: Request, db: DB, user: OptionalUser):
        return to_json(await get_one(db, request, user, item_id))

    async def change(item_id, data, request, db, user, partial):
        item = await get_one(db, None, user, item_id)
        values = data.model_dump(exclude_unset=partial, exclude={"document_types"})
        for field, value in values.items():
            setattr(item, field, value)
        return await save(db, item, data, user, False)

    @router.put(f"/{path}/{{item_id}}/", name=f"{path}-update")
    async def put_item(item_id: int, data: Create, request: Request, db: DB, user: Writer):
        return await change(item_id, data, request, db, user, False)

    @router.patch(f"/{path}/{{item_id}}/", name=f"{path}-partial-update")
    async def patch_item(item_id: int, data: Update, request: Request, db: DB, user: Writer):
        return await change(item_id, data, request, db, user, True)

    @router.delete(f"/{path}/{{item_id}}/", status_code=204, name=f"{path}-delete")
    async def delete_item(item_id: int, db: DB, user: Writer):
        await db.delete(await get_one(db, None, user, item_id))
        await db.commit()
        return Response(status_code=204)


def apply_ordering(request, query, allowed, default):
    """?ordering=expires_at or ?ordering=-created_at, like DRF's OrderingFilter."""
    value = request.query_params.get("ordering", "") if request else ""
    columns = []
    for part in [p.strip() for p in value.split(",") if p.strip()]:
        field = part.lstrip("-")
        if field in allowed:
            column = allowed[field]
            columns.append(column.desc() if part.startswith("-") else column.asc())
    return query.order_by(*(columns or default))
