import httpx
import pytest

from app.core import cache
from app.db.session import SessionLocal
from app.services import rates

NBT = """<?xml version="1.0" encoding="windows-1251" ?>
<ValCurs Date="{day}" name="x">
<Valute ID="840"><CharCode>USD</CharCode><Nominal>1</Nominal><Name>x</Name><Value>9.2174</Value></Valute>
<Valute ID="364"><CharCode>IRR</CharCode><Nominal>1000</Nominal><Name>\xff\x00bad</Name><Value>0.0002</Value></Valute>
<Valute ID="810"><CharCode>RUB</CharCode><Nominal>1</Nominal><Name>x</Name><Value>0.1142</Value></Valute>
</ValCurs>"""
CBR = """<?xml version="1.0" encoding="windows-1251"?><ValCurs Date="{day}" name="Foreign Currency Market">
<Valute ID="R01670"><NumCode>972</NumCode><CharCode>TJS</CharCode><Nominal>10</Nominal><Name>x</Name><Value>87,7162</Value></Valute>
</ValCurs>"""


def fake_banks(monkeypatch, answer):
    real = httpx.AsyncClient
    monkeypatch.setattr(rates.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(answer), **kw))
    cache._memory.clear()


@pytest.fixture
def banks(monkeypatch):
    calls = []
    day = rates.today()

    def answer(request):
        calls.append(request.url.host)
        if request.url.host == "nbt.tj":
            return httpx.Response(200, content=NBT.format(day=day.isoformat()).encode("latin-1"))
        return httpx.Response(200, content=CBR.format(day=f"{day:%d.%m.%Y}").encode())

    fake_banks(monkeypatch, answer)
    return calls


async def test_rates_are_fetched_once_and_kept(client, banks):
    r = await client.get("/api/rates/")
    latest = r.json()["latest"]
    assert latest["nbt"]["value"] == 0.1142
    assert latest["cbr"]["value"] == pytest.approx(0.114004, abs=1e-6)
    assert r.json()["history"][-1]["nbt"] == 0.1142
    await client.get("/api/rates/")
    assert sorted(banks) == ["nbt.tj", "www.cbr.ru"]


async def test_rates_do_not_break_when_banks_are_down(monkeypatch):
    fake_banks(monkeypatch, lambda request: httpx.Response(502))
    async with SessionLocal() as db:
        assert await rates.update_rates(db) == {}
