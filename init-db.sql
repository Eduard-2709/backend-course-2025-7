-- Створення таблиці інвентаря
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    inventory_name VARCHAR(255) NOT NULL,
    description TEXT,
    photo_filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Додавання тестових даних
INSERT INTO inventory (inventory_name, description, photo_filename) VALUES
('Dell XPS 15 Laptop', 'Потужний ноутбук для розробки та дизайну', NULL),
('iPhone 15 Pro', 'Флагманський смартфон для тестування мобільних додатків', NULL),
('Samsung 4K Monitor', '27-дюймовий 4K монітор для професійної роботи', NULL)
ON CONFLICT (id) DO NOTHING;