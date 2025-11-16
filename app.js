const { program } = require('commander');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Конфігурація Commander.js
program
    .requiredOption('-h, --host <host>', 'Server host')
    .requiredOption('-p, --port <port>', 'Server port')
    .requiredOption('-c, --cache <path>', 'Cache directory path')
    .parse(process.argv);

const options = program.opts();

// Перевірка та створення cache директорії
if (!fs.existsSync(options.cache)) {
    fs.mkdirSync(options.cache, { recursive: true });
    console.log(`Created cache directory: ${options.cache}`);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Налаштування multer для завантаження файлів
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, options.cache);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Сховище даних (in memory)
let inventory = [];
let nextId = 1;

// Swagger документація
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Inventory Service API',
            version: '1.0.0',
            description: 'API для системи інвентаризації'
        },
        servers: [
            {
                url: `http://${options.host}:${options.port}`,
                description: 'Development server'
            }
        ]
    },
    apis: ['./app.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * components:
 *   schemas:
 *     Inventory:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Унікальний ідентифікатор
 *         inventory_name:
 *           type: string
 *           description: Назва інвентаря
 *         description:
 *           type: string
 *           description: Опис інвентаря
 *         photo_url:
 *           type: string
 *           description: URL фото
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація нового пристрою
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Назва інвентаря
 *               description:
 *                 type: string
 *                 description: Опис інвентаря
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Фото інвентаря
 *     responses:
 *       201:
 *         description: Пристрій успішно зареєстрований
 *       400:
 *         description: Відсутня назва інвентаря
 */
app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
        return res.status(400).json({ error: 'Inventory name is required' });
    }

    const newItem = {
        id: nextId++,
        inventory_name,
        description: description || '',
        photo_filename: req.file ? req.file.filename : null
    };

    inventory.push(newItem);
    res.status(201).json({ message: 'Device registered successfully', id: newItem.id });
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати список всіх інвентаризованих речей
 *     responses:
 *       200:
 *         description: Список інвентаря
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Inventory'
 */
app.get('/inventory', (req, res) => {
    const inventoryWithUrls = inventory.map(item => ({
        ...item,
        photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null
    }));
    res.status(200).json(inventoryWithUrls);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати інформацію про конкретну річ
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID інвентаря
 *     responses:
 *       200:
 *         description: Інформація про інвентар
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Inventory'
 *       404:
 *         description: Інвентар не знайдено
 */
app.get('/inventory/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(item => item.id === id);

    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }

    const itemWithUrl = {
        ...item,
        photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null
    };

    res.status(200).json(itemWithUrl);
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Оновити ім'я або опис конкретної речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID інвентаря
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Інвентар оновлено
 *       404:
 *         description: Інвентар не знайдено
 */
app.put('/inventory/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(item => item.id === id);

    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }

    const { inventory_name, description } = req.body;

    if (inventory_name) item.inventory_name = inventory_name;
    if (description !== undefined) item.description = description;

    res.status(200).json({ message: 'Item updated successfully', item });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото зображення конкретної речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID інвентаря
 *     responses:
 *       200:
 *         description: Фото інвентаря
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Фото або інвентар не знайдено
 */
app.get('/inventory/:id/photo', (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(item => item.id === id);

    if (!item || !item.photo_filename) {
        return res.status(404).json({ error: 'Photo not found' });
    }

    const photoPath = path.join(options.cache, item.photo_filename);
    if (!fs.existsSync(photoPath)) {
        return res.status(404).json({ error: 'Photo file not found' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.sendFile(photoPath);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновити фото зображення конкретної речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID інвентаря
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       404:
 *         description: Інвентар не знайдено
 */
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(item => item.id === id);

    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'Photo is required' });
    }

    // Видаляємо старе фото якщо воно існує
    if (item.photo_filename) {
        const oldPhotoPath = path.join(options.cache, item.photo_filename);
        if (fs.existsSync(oldPhotoPath)) {
            fs.unlinkSync(oldPhotoPath);
        }
    }

    item.photo_filename = req.file.filename;
    res.status(200).json({ message: 'Photo updated successfully' });
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Видалити інвентаризовану річ зі списку
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID інвентаря
 *     responses:
 *       200:
 *         description: Інвентар видалено
 *       404:
 *         description: Інвентар не знайдено
 */
app.delete('/inventory/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const itemIndex = inventory.findIndex(item => item.id === id);

    if (itemIndex === -1) {
        return res.status(404).json({ error: 'Item not found' });
    }

    const item = inventory[itemIndex];

    // Видаляємо фото якщо воно існує
    if (item.photo_filename) {
        const photoPath = path.join(options.cache, item.photo_filename);
        if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
        }
    }

    inventory.splice(itemIndex, 1);
    res.status(200).json({ message: 'Item deleted successfully' });
});

// HTML форми
app.get('/RegisterForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук пристрою за ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 description: ID інвентаря
 *               includePhoto:
 *                 type: boolean
 *                 description: Додати посилання на фото до опису
 *     responses:
 *       200:
 *         description: Інформація про знайдений інвентар
 *       404:
 *         description: Інвентар не знайдено
 */
app.post('/search', (req, res) => {
    const { id, includePhoto } = req.body;
    const itemId = parseInt(id);
    const item = inventory.find(item => item.id === itemId);

    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }

    let responseItem = { ...item };

    if (includePhoto === 'on' && item.photo_filename) {
        responseItem.description += ` [Photo: /inventory/${item.id}/photo]`;
    }

    responseItem.photo_url = item.photo_filename ? `/inventory/${item.id}/photo` : null;

    res.status(200).json(responseItem);
});

// Обробка недозволених методів
app.use((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
});

// Запуск сервера
app.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}`);
    console.log(`Swagger documentation available at http://${options.host}:${options.port}/docs`);
});