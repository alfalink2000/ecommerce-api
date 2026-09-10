# Ecommerce API - Ejercicio Técnico

## Descripción

API REST para plataforma de comercio electrónico construida con FastAPI, SQLModel, SQLite, Redis, JWT y uv.

## Tecnologías utilizadas

| Tecnología | Versión | Uso |
|---|---|---|
| Python | 3.14.6 | Lenguaje de programación |
| uv | 0.12.5 | Gestor de paquetes |
| FastAPI | 0.141.1 | Framework web |
| SQLModel | 0.0.39 | ORM (modelos de BD) |
| Pydantic | 2.13.4 | Validación de datos |
| SQLite | - | Base de datos |
| Alembic | 1.19.1 | Migraciones |
| Redis | 5.0.14.1 | Caché y tokens |
| python-jose | 3.5.0 | Tokens JWT |
| passlib | 1.7.4 | Hashing de contraseñas |
| Pytest | 9.1.1 | Pruebas |

## Cómo ejecutar

> Requisitos: [Python](https://www.python.org/downloads/) 3.14+, [uv](https://docs.astral.sh/uv/#installation) y un servidor [Redis](https://redis.io/download/) (esta API usa Redis para almacenar los tokens JWT activos).

### 1. Configurar variables de entorno

Copia el archivo `.env` de ejemplo y ajusta los valores:

```powershell
Copy-Item .env.example .env
```

> Si no creas `.env`, la API usa valores por defecto seguros para desarrollo.

### 2. Instalar dependencias
```powershell
uv sync
```

### 3. Iniciar Redis
Asegúrate de tener `redis-server` corriendo en `127.0.0.1:6379`.

### 4. Ejecutar la API
```powershell
uv run uvicorn app.main:app --reload --port 8000
```

En el primer arranque se crean las tablas y se insertan datos de ejemplo automáticamente:

- **Admin:** `admin@gmail.com` / `admin123`
- **Productos:** Laptop, Mouse y Teclado de ejemplo

### 5. Abrir documentación
Visitar: http://127.0.0.1:8000/docs

### 6. Ejecutar pruebas
```powershell
uv run pytest -v
```

## Estructura del proyecto

```
ecommerce-api/
├── app/
│   ├── main.py              # Punto de entrada
│   ├── config.py             # Configuración
│   ├── database.py           # Conexión a BD
│   ├── models/               # Modelos de base de datos
│   │   ├── user.py
│   │   ├── product.py
│   │   └── order.py
│   ├── schemas/              # Schemas de validación
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── product.py
│   │   ├── order.py
│   │   └── common.py
│   ├── routers/              # Endpoints de la API
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── products.py
│   │   └── orders.py
│   ├── middleware/            # Middlewares
│   │   ├── auth.py
│   │   └── rate_limit.py
│   └── services/             # Lógica de negocio
│       ├── auth.py
│       └── redis.py
├── alembic/                  # Migraciones
├── tests/                    # Pruebas
├── pyproject.toml            # Dependencias
└── .env                      # Variables de entorno
```

## Endpoints principales

### Autenticación
- `POST /api/v1/auth/register` - Registrar usuario
- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/logout` - Cerrar sesión
- `POST /api/v1/auth/refresh` - Renovar token

### Usuarios
- `GET /api/v1/users/me` - Mi perfil
- `PUT /api/v1/users/me` - Actualizar mi perfil
- `GET /api/v1/users/` - Listar usuarios (admin)
- `PUT /api/v1/users/{id}/role` - Cambiar rol (admin)

### Productos
- `GET /api/v1/products/` - Listar productos (público)
- `GET /api/v1/products/{id}` - Detalle producto (público)
- `POST /api/v1/products/` - Crear producto (admin)
- `PUT /api/v1/products/{id}` - Actualizar producto (admin)
- `DELETE /api/v1/products/{id}` - Eliminar producto (admin)

### Órdenes
- `POST /api/v1/orders/` - Crear orden
- `GET /api/v1/orders/` - Listar órdenes
- `GET /api/v1/orders/{id}` - Detalle de orden
- `PUT /api/v1/orders/{id}/status` - Actualizar estado (admin)
- `POST /api/v1/orders/{id}/cancel` - Cancelar orden

## Frontend instructivo

El proyecto incluye un frontend interactivo (`frontend/`) que se sirve en `http://127.0.0.1:8000/`. Muestra en vivo cómo el middleware de autenticación protege cada endpoint, el flujo de tokens JWT (access/refresh), el control por roles (admin/customer) y una consola de peticiones HTTP para probar cada ruta.
