from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.user import User, UserRole
from app.schemas.user import UserRead, UserUpdate, UserRoleUpdate
from app.services.auth import get_current_user, require_admin

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.get("/me", response_model=UserRead)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserRead)
def update_my_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.email is not None:
        existing = session.exec(select(User).where(User.email == data.email, User.id != current_user.id)).first()
        if existing:
            raise HTTPException(status_code=400, detail="El email ya esta en uso")
        current_user.email = data.email

    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.get("/", response_model=list[UserRead])
def list_users(
    page: int = 1,
    page_size: int = 10,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size
    users = session.exec(select(User).offset(offset).limit(page_size)).all()
    return users


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: int,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.put("/{user_id}/role", response_model=UserRead)
def change_user_role(
    user_id: int,
    data: UserRoleUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.role = data.role
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: int,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.is_active = False
    session.add(user)
    session.commit()
