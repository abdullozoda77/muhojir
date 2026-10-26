import jwt

from app.core.config import settings

ISSUER = "https://appleid.apple.com"
keys = jwt.PyJWKClient(f"{ISSUER}/auth/keys", cache_keys=True, lifespan=86400)


def verify_apple_token(token):
    try:
        key = keys.get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=settings.apple_client_id, issuer=ISSUER)
    except jwt.PyJWTError:
        return None
    if not claims.get("email") or str(claims.get("email_verified", "true")).lower() != "true":
        return None
    return claims
