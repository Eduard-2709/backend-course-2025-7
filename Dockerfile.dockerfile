FROM node:18-alpine

WORKDIR /app

# Копіюємо файли залежностей
COPY package*.json ./

# Встановлюємо залежності
RUN npm install

# Копіюємо вихідний код
COPY . .

# Створюємо директорію для кешу
RUN mkdir -p uploads

# Відкриваємо порт
EXPOSE 3000

# Команда для запуску (буде перевизначена в docker-compose для розробки)
CMD ["npm", "start"]