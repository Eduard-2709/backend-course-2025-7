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
    console.log(`✅ Created cache directory: ${options.cache}`);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS для коректної роботи з браузером
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Налаштування multer для завантаження файлів
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, options.cache);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Сховище даних (in memory) з тестовими даними
let inventory = [
    {
        id: 1,
        inventory_name: "Dell XPS 15 Laptop",
        description: "Потужний ноутбук для розробки та дизайну",
        photo_filename: null,
        created_at: new Date().toISOString()
    },
    {
        id: 2,
        inventory_name: "iPhone 15 Pro",
        description: "Флагманський смартфон для тестування мобільних додатків",
        photo_filename: null,
        created_at: new Date().toISOString()
    },
    {
        id: 3,
        inventory_name: "Samsung 4K Monitor",
        description: "27-дюймовий 4K монітор для професійної роботи",
        photo_filename: null,
        created_at: new Date().toISOString()
    }
];
let nextId = 4;

// Swagger документація
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Inventory Service API',
            version: '1.0.0',
            description: 'API для системи інвентаризації - Лабораторна робота №6',
            contact: {
                name: "Student",
                email: "student@example.com"
            }
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

// Обробка помилок Multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'Maximum file size is 10MB'
            });
        }
    }
    next(error);
});

// Middleware для логування запитів
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} | Body:`, req.body);
    next();
});

// Допоміжна функція для визначення MIME типу
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'image/jpeg';
}

// HTML форми
app.get('/RegisterForm.html', (req, res) => {
    const filePath = path.join(__dirname, 'RegisterForm.html');
    console.log(`📄 Serving RegisterForm.html`);
    res.sendFile(filePath);
});

app.get('/SearchForm.html', (req, res) => {
    const filePath = path.join(__dirname, 'SearchForm.html');
    console.log(`📄 Serving SearchForm.html`);
    res.sendFile(filePath);
});

// Головна сторінка
app.get('/', (req, res) => {
    res.json({
        message: "Inventory Service API is running!",
        endpoints: {
            documentation: "/docs",
            register_form: "/RegisterForm.html",
            search_form: "/SearchForm.html",
            register: "/register (POST)",
            inventory: "/inventory (GET)",
            search: "/search (POST)"
        },
        test_data: "Available item IDs: 1, 2, 3"
    });
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Inventory:
 *       type: object
 *       required:
 *         - id
 *         - inventory_name
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
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Дата створення
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Повідомлення про помилку
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація нового пристрою
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_name
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Назва інвентаря
 *                 example: "MacBook Pro"
 *               description:
 *                 type: string
 *                 description: Опис інвентаря
 *                 example: "Ноутбук для розробки"
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Фото інвентаря
 *     responses:
 *       201:
 *         description: Пристрій успішно зареєстрований
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 id:
 *                   type: integer
 *                 item:
 *                   $ref: '#/components/schemas/Inventory'
 *       400:
 *         description: Відсутня назва інвентаря
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутрішня помилка сервера
 */
app.post('/register', upload.single('photo'), (req, res) => {
    try {
        console.log('📝 Registration request received');
        console.log('📦 Request body:', req.body);
        console.log('📷 File:', req.file);

        const { inventory_name, description } = req.body;

        if (!inventory_name) {
            console.log('❌ Registration failed: Missing inventory name');
            return res.status(400).json({ error: 'Inventory name is required' });
        }

        const newItem = {
            id: nextId++,
            inventory_name,
            description: description || '',
            photo_filename: req.file ? req.file.filename : null,
            created_at: new Date().toISOString()
        };

        inventory.push(newItem);

        console.log('✅ New item registered successfully:', {
            id: newItem.id,
            name: newItem.inventory_name,
            has_photo: !!newItem.photo_filename
        });

        res.status(201).json({
            message: 'Device registered successfully',
            id: newItem.id,
            item: {
                ...newItem,
                photo_url: newItem.photo_filename ? `/inventory/${newItem.id}/photo` : null
            }
        });
    } catch (error) {
        console.error('💥 Registration error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати список всіх інвентаризованих речей
 *     tags: [Inventory]
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
    console.log(`📋 Inventory list request - ${inventory.length} items total`);

    const inventoryWithUrls = inventory.map(item => ({
        id: item.id,
        inventory_name: item.inventory_name,
        description: item.description,
        photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null,
        created_at: item.created_at
    }));

    console.log(`✅ Sending ${inventoryWithUrls.length} items`);
    res.status(200).json(inventoryWithUrls);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати інформацію про конкретну річ
 *     tags: [Inventory]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/inventory/:id', (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`🔍 Get item request - ID: ${id}`);

    const item = inventory.find(item => item.id === id);

    if (!item) {
        console.log(`❌ Item ${id} not found. Available IDs: ${inventory.map(i => i.id).join(', ')}`);
        return res.status(404).json({ error: `Item with ID ${id} not found` });
    }

    const itemWithUrl = {
        id: item.id,
        inventory_name: item.inventory_name,
        description: item.description,
        photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null,
        created_at: item.created_at
    };

    console.log(`✅ Item found: ${item.inventory_name}`);
    res.status(200).json(itemWithUrl);
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

    const photoPath = path.join(__dirname, options.cache, item.photo_filename);

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
        const oldPhotoPath = path.join(__dirname, options.cache, item.photo_filename);
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
 *   put:
 *     summary: Оновити ім'я або опис конкретної речі
 *     tags: [Inventory]
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

    res.status(200).json({
        message: 'Item updated successfully',
        item: {
            id: item.id,
            inventory_name: item.inventory_name,
            description: item.description,
            photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null
        }
    });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновити фото зображення конкретної речі
 *     tags: [Inventory]
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
 *     tags: [Inventory]
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

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук пристрою за ID
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *                 description: ID інвентаря
 *                 example: 1
 *               includePhoto:
 *                 type: boolean
 *                 description: Додати посилання на фото до опису
 *                 example: true
 *     responses:
 *       200:
 *         description: Інформація про знайдений інвентар
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Inventory'
 *       404:
 *         description: Інвентар не знайдено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/search', (req, res) => {
    console.log('🔍 Search request received:', req.body);

    const { id, includePhoto } = req.body;
    const itemId = parseInt(id);

    console.log(`🔎 Searching for item ID: ${itemId}`);
    console.log(`📦 Available items: ${inventory.map(item => `ID ${item.id}: "${item.inventory_name}"`).join(', ')}`);

    const item = inventory.find(item => item.id === itemId);

    if (!item) {
        console.log(`❌ SEARCH FAILED: Item ${itemId} not found!`);
        console.log(`📋 Available IDs: ${inventory.map(i => i.id).join(', ')}`);
        return res.status(404).json({ error: `Item with ID ${itemId} not found` });
    }

    let responseItem = {
        id: item.id,
        inventory_name: item.inventory_name,
        description: item.description,
        photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null,
        created_at: item.created_at
    };

    if (includePhoto && item.photo_filename) {
        responseItem.description += ` [Photo: /inventory/${item.id}/photo]`;
        console.log(`📷 Photo included in description for item ${itemId}`);
    }

    console.log(`✅ SEARCH SUCCESS: Found "${item.inventory_name}" (ID: ${item.id})`);
    res.status(200).json(responseItem);
});

// Додатковий endpoint для отримання статистики
app.get('/stats', (req, res) => {
    const stats = {
        total_items: inventory.length,
        items_with_photos: inventory.filter(item => item.photo_filename).length,
        available_ids: inventory.map(item => item.id),
        server_uptime: process.uptime(),
        cache_directory: options.cache
    };
    res.json(stats);
});

// Додатковий endpoint для перевірки стану фото
app.get('/inventory/:id/photo-info', (req, res) => {
    const id = parseInt(req.params.id);
    const item = inventory.find(item => item.id === id);

    if (!item) {
        return res.status(404).json({ error: 'Item not found' });
    }

    const photoInfo = {
        item_id: item.id,
        item_name: item.inventory_name,
        photo_filename: item.photo_filename,
        has_photo: !!item.photo_filename
    };

    if (item.photo_filename) {
        const photoPath = path.join(options.cache, item.photo_filename);
        photoInfo.file_exists = fs.existsSync(photoPath);

        if (photoInfo.file_exists) {
            const stats = fs.statSync(photoPath);
            photoInfo.file_size = stats.size;
            photoInfo.file_path = photoPath;
            photoInfo.mime_type = getMimeType(photoPath);
        }
    }

    res.json(photoInfo);
});

// Обробка недозволених методів
app.use((req, res, next) => {
    console.log(`❌ Method not allowed: ${req.method} ${req.path}`);
    res.status(405).json({ error: 'Method not allowed' });
});

// Обробка 404 для неіснуючих маршрутів
app.use((req, res, next) => {
    console.log(`❌ Endpoint not found: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('💥 Global error handler:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Запуск сервера
app.listen(options.port, options.host, () => {
    console.log(`\n🚀 ==========================================`);
    console.log(`🚀 Inventory Service API Started Successfully!`);
    console.log(`🚀 ==========================================`);
    console.log(`✅ Server running at http://${options.host}:${options.port}`);
    console.log(`📚 Swagger documentation: http://${options.host}:${options.port}/docs`);
    console.log(`📝 Register form: http://${options.host}:${options.port}/RegisterForm.html`);
    console.log(`🔍 Search form: http://${options.host}:${options.port}/SearchForm.html`);
    console.log(`📋 Inventory list: http://${options.host}:${options.port}/inventory`);
    console.log(`📊 Stats: http://${options.host}:${options.port}/stats`);
    console.log(`📁 Cache directory: ${path.resolve(options.cache)}`);
    console.log(`\n🎯 TEST DATA AVAILABLE:`);
    console.log(`   Items with IDs: ${inventory.map(item => item.id).join(', ')}`);
    console.log(`   Try: POST /search with id=1 and includePhoto=on`);
    console.log(`\n💡 TROUBLESHOOTING:`);
    console.log(`   If search fails, check available IDs at /inventory`);
    console.log(`   Check photo info: GET /inventory/{id}/photo-info`);
    console.log(`   Check console logs for detailed information`);
    console.log(`==========================================\n`);
});