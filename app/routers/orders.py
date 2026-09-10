from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, func

from app.database import get_session
from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderItem, OrderStatus
from app.schemas.order import OrderCreate, OrderRead, OrderStatusUpdate, OrderItemRead
from app.schemas.common import PaginatedResponse
from app.services.auth import get_current_user, require_admin

router = APIRouter(prefix="/orders", tags=["Ordenes"])


@router.post("/", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not data.items:
        raise HTTPException(status_code=400, detail="La orden debe tener al menos un producto")

    total = Decimal("0.00")
    order_items = []

    for item in data.items:
        product = session.get(Product, item.product_id)
        if not product or not product.is_active:
            raise HTTPException(status_code=404, detail=f"Producto {item.product_id} no encontrado")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para {product.name}")

        subtotal = product.price * item.quantity
        total += subtotal

        order_items.append(OrderItem(
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price,
            subtotal=subtotal,
        ))
        product.stock -= item.quantity
        session.add(product)

    order = Order(user_id=current_user.id, total_amount=total)
    session.add(order)
    session.commit()
    session.refresh(order)

    for oi in order_items:
        oi.order_id = order.id
        session.add(oi)
    session.commit()
    session.refresh(order)

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    order_dict = OrderRead.model_validate(order)
    order_dict.items = items
    return order_dict


@router.get("/", response_model=PaginatedResponse[OrderRead])
def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Order)
    count_query = select(func.count()).select_from(Order)

    if current_user.role.value != "admin":
        query = query.where(Order.user_id == current_user.id)
        count_query = count_query.where(Order.user_id == current_user.id)

    total = session.exec(count_query).one()
    offset = (page - 1) * page_size
    orders = session.exec(query.order_by(Order.created_at.desc()).offset(offset).limit(page_size)).all()

    result = []
    for order in orders:
        items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
        order_dict = OrderRead.model_validate(order)
        order_dict.items = items
        result.append(order_dict)

    pages = (total + page_size - 1) // page_size

    return PaginatedResponse(items=result, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/{order_id}", response_model=OrderRead)
def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    if current_user.role.value != "admin" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta orden")

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    order_dict = OrderRead.model_validate(order)
    order_dict.items = items
    return order_dict


@router.put("/{order_id}/status", response_model=OrderRead)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    order.status = data.status
    session.add(order)
    session.commit()
    session.refresh(order)

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    order_dict = OrderRead.model_validate(order)
    order_dict.items = items
    return order_dict


@router.post("/{order_id}/cancel", response_model=OrderRead)
def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    if current_user.role.value != "admin" and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta orden")

    if order.status not in (OrderStatus.pending, OrderStatus.paid):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede cancelar una orden en estado {order.status.value}",
        )

    order.status = OrderStatus.cancelled
    session.add(order)
    session.commit()
    session.refresh(order)

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    order_dict = OrderRead.model_validate(order)
    order_dict.items = items
    return order_dict
