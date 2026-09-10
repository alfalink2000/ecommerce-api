from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class AuthData(BaseModel):
    email: str
    password: str
