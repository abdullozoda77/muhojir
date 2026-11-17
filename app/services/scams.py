from app.services.notify import notify

APPROVED_TITLE = "Огоҳии шумо нашр шуд"
APPROVED_TEXT = "Ташаккур! Огоҳии шумо дар бораи «{0}» тасдиқ шуд ва ҳоло дигарон онро мебинанд."
REJECTED_TITLE = "Огоҳии шумо нашр нашуд"
REJECTED_TEXT = "Огоҳии шумо дар бораи «{0}» нашр нашуд."


async def send_decision(db, report):
    if report.status not in ("approved", "rejected"):
        return
    approved = report.status == "approved"
    text = (APPROVED_TEXT if approved else REJECTED_TEXT).format(report.value)
    if report.note:
        text += f"\n{report.note}"
    await notify(db, report.user, APPROVED_TITLE if approved else REJECTED_TITLE, text)
