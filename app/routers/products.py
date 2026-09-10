from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductRead
from app.schemas.common import PaginatedResponse
from app.services.auth import get_current_user, require_admin

router = APIRouter(prefix="/products", tags=["Productos"])


@router.get("/", response_model=PaginatedResponse[ProductRead])
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = Query(None),
    category: str = Query(None),
    session: Session = Depends(get_session),
):
    query = select(Product).where(Product.is_active == True)

    if search:
        query = query.where(Product.name.contains(search))
    if category:
        query = query.where(Product.category == category)

    total = session.exec(select(func.count()).select_from(Product).where(Product.is_active == True)).one()
    offset = (page - 1) * page_size
    products = session.exec(query.offset(offset).limit(page_size)).all()
    pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        items=products, total=total, page=page, page_size=page_size, pages=pages
    )


@router.get("/{product_id}", response_model=ProductRead)
def get_product(product_id: int, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.post("/", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    product = Product(**data.model_dump())
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    data: ProductUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    product.is_active = False
    session.add(product)
    session.commit()
