from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings

ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
session = google_requests.Request()


def verify_google_token(credential):
    try:
        claims = id_token.verify_oauth2_token(credential, session, settings.google_client_id)
    except ValueError:
        return None
    if claims.get("iss") not in ISSUERS or not claims.get("email") or not claims.get("email_verified"):
        return None
    return claims
