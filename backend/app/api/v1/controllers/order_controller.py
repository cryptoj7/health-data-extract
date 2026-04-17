"""Controller layer for the Order resource. Routes call into here; here we
delegate to the repository for persistence.
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.order import OrderStatus
from app.repositories.order_repository import (
    OrderRepository,
    OrderRepositoryProtocol,
)
from app.schemas.order import OrderCreate, OrderListResponse, OrderRead, OrderUpdate


def _repo(db: Session) -> OrderRepositoryProtocol:
    return OrderRepository(db)


class OrderController:
    @staticmethod
    def create(db: Session, payload: OrderCreate) -> OrderRead:
        order = _repo(db).create(payload)
        return OrderRead.model_validate(order)

    @staticmethod
    def get(db: Session, order_id: str) -> OrderRead:
        order = _repo(db).get(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found"
            )
        return OrderRead.model_validate(order)

    @staticmethod
    def list(
        db: Session,
        *,
        limit: int,
        offset: int,
        status_filter: Optional[OrderStatus],
        search: Optional[str],
    ) -> OrderListResponse:
        items, total = _repo(db).list(
            limit=limit, offset=offset, status=status_filter, search=search
        )
        return OrderListResponse(
            items=[OrderRead.model_validate(o) for o in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def update(db: Session, order_id: str, payload: OrderUpdate) -> OrderRead:
        repo = _repo(db)
        order = repo.get(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found"
            )
        updated = repo.update(order, payload)
        return OrderRead.model_validate(updated)

    @staticmethod
    def delete(db: Session, order_id: str) -> None:
        repo = _repo(db)
        order = repo.get(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found"
            )
        repo.delete(order)
