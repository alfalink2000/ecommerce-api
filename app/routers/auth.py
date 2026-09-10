from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, TokenResponse, TokenRefreshRequest, UserRead
from app.services.auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, logout_user,
)
from app.services.redis import verify_token_exists, delete_token

router = APIRouter(prefix="/auth", tags=["Autenticacion"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == user_data.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya esta registrado")

    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == credentials.email)).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(access_token: str, refresh_token: str):
    logout_user(access_token, refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: TokenRefreshRequest, session: Session = Depends(get_session)):
    if not verify_token_exists(data.refresh_token, "refresh"):
        raise HTTPException(status_code=401, detail="Refresh token no valido")

    payload = decode_token(data.refresh_token)
    user_id = int(payload.get("sub"))

    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")

    delete_token(data.refresh_token, "refresh")

    new_access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)
