"""HTTP routes for the Order resource (CRUD)."""
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.v1.controllers.order_controller import OrderController
from app.core.security import require_api_key
from app.db.session import get_db
from app.models.order import OrderStatus
from app.schemas.order import OrderCreate, OrderListResponse, OrderRead, OrderUpdate

router = APIRouter(
    prefix="/orders",
    tags=["orders"],
    dependencies=[Depends(require_api_key)],
)


@router.post(
    "",
    response_model=OrderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new order",
)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)) -> OrderRead:
    return OrderController.create(db, payload)


@router.get("", response_model=OrderListResponse, summary="List orders")
def list_orders(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None, description="Search by patient first or last name"),
    db: Session = Depends(get_db),
) -> OrderListResponse:
    return OrderController.list(
        db, limit=limit, offset=offset, status_filter=status_filter, search=search
    )


@router.get("/{order_id}", response_model=OrderRead, summary="Get a single order by id")
def get_order(order_id: str, db: Session = Depends(get_db)) -> OrderRead:
    return OrderController.get(db, order_id)


@router.patch("/{order_id}", response_model=OrderRead, summary="Update an existing order")
def update_order(order_id: str, payload: OrderUpdate, db: Session = Depends(get_db)) -> OrderRead:
    return OrderController.update(db, order_id, payload)


@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an order",
)
def delete_order(order_id: str, db: Session = Depends(get_db)) -> Response:
    OrderController.delete(db, order_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
