from tests.conftest import get_auth_headers


def test_register_user(client):
    response = client.post("/api/v1/auth/register", json={
        "email": "nuevo@test.com",
        "password": "test123",
        "full_name": "Nuevo Usuario",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "nuevo@test.com"
    assert data["full_name"] == "Nuevo Usuario"
    assert data["role"] == "customer"


def test_register_duplicate_email(client):
    client.post("/api/v1/auth/register", json={
        "email": "dup@test.com",
        "password": "test123",
        "full_name": "Dup",
    })
    response = client.post("/api/v1/auth/register", json={
        "email": "dup@test.com",
        "password": "test456",
        "full_name": "Dup 2",
    })
    assert response.status_code == 400


def test_login_success(client):
    client.post("/api/v1/auth/register", json={
        "email": "login@test.com",
        "password": "test123",
        "full_name": "Login Test",
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "login@test.com",
        "password": "test123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "wrong@test.com",
        "password": "test123",
        "full_name": "Wrong Test",
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "wrong@test.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


def test_get_products_public(client):
    response = client.get("/api/v1/products/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data


def test_create_product_admin(client, admin_user):
    headers = get_auth_headers(client, "admin@test.com", "admin123")
    response = client.post("/api/v1/products/", json={
        "name": "Laptop",
        "description": "Laptop gamer",
        "price": 999.99,
        "stock": 10,
        "category": "tecnologia",
    }, headers=headers)
    assert response.status_code == 201
    assert response.json()["name"] == "Laptop"


def test_create_product_customer_forbidden(client, customer_user):
    headers = get_auth_headers(client, "cliente@test.com", "cliente123")
    response = client.post("/api/v1/products/", json={
        "name": "Laptop",
        "description": "Laptop gamer",
        "price": 999.99,
        "stock": 10,
    }, headers=headers)
    assert response.status_code == 403


def test_create_order(client, admin_user, customer_user, session):
    headers = get_auth_headers(client, "admin@test.com", "admin123")
    product = client.post("/api/v1/products/", json={
        "name": "Mouse",
        "description": "Mouse optico",
        "price": 25.00,
        "stock": 50,
    }, headers=headers)
    product_id = product.json()["id"]

    client_headers = get_auth_headers(client, "cliente@test.com", "cliente123")
    response = client.post("/api/v1/orders/", json={
        "items": [{"product_id": product_id, "quantity": 2}],
    }, headers=client_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["total_amount"] == "50.00"
    assert len(data["items"]) == 1
