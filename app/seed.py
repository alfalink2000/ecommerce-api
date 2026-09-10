from sqlmodel import Session, select

from app.database import engine
from app.models.user import User, UserRole
from app.models.product import Product
from app.services.auth import hash_password


def seed_database():
    with Session(engine) as session:
        admin_exists = session.exec(
            select(User).where(User.role == UserRole.admin)
        ).first()

        if not admin_exists:
            admin = User(
                email="admin@gmail.com",
                password_hash=hash_password("admin123"),
                full_name="Administrador",
                role=UserRole.admin,
            )
            session.add(admin)
            session.commit()
            print("  [SEED] Admin creado: admin@gmail.com / admin123")
        else:
            print("  [SEED] Ya existe un admin, saltando...")

        products_exist = session.exec(select(Product)).first()

        if not products_exist:
            products = [
                Product(
                    name="Laptop Gamer",
                    description="Laptop con 16GB RAM, GPU RTX 4060, SSD 512GB",
                    price=999.99,
                    stock=10,
                    category="tecnologia",
                ),
                Product(
                    name="Mouse Optico",
                    description="Mouse inalambrico 1600 DPI, ergonomico",
                    price=25.00,
                    stock=50,
                    category="accesorios",
                ),
                Product(
                    name="Teclado Mecanico",
                    description="Teclado mecanico RGB switches Blue",
                    price=45.00,
                    stock=30,
                    category="accesorios",
                ),
            ]
            for p in products:
                session.add(p)
            session.commit()
            print("  [SEED] 3 productos de ejemplo creados")
        else:
            print("  [SEED] Ya existen productos, saltando...")
