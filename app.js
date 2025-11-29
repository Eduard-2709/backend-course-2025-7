const { program } = require('commander');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { Pool } = require('pg');
require('dotenv').config();

// Ініціалізація підключення до БД
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Конфігурація Commander.js
program
    .option('-h, --host <host>', 'Server host', process.env.SERVER_HOST || '0.0.0.0')
    .option('-p, --port <port>', 'Server port', process.env.SERVER_PORT || 3000)
    .option('-c, --cache <path>', 'Cache directory path', process.env.CACHE_DIR || './uploads')
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

// CORS для коректної роботи з браузером та Swagger
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
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

// Swagger компоненти та схеми
const swaggerComponents = {
    schemas: {
        Inventory: {
            type: 'object',
            properties: {
                id: {
                    type: 'integer',
                    description: 'Унікальний ідентифікатор',
                    example: 1
                },
                inventory_name: {
                    type: 'string',
                    description: 'Назва інвентаря',
                    example: 'MacBook Pro'
                },
                description: {
                    type: 'string',
                    description: 'Опис інвентаря',
                    example: 'Ноутбук для розробки'
                },
                photo_url: {
                    type: 'string',
                    description: 'URL фото',
                    example: '/inventory/1/photo'
                },
                created_at: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Дата створення',
                    example: '2025-11-29T10:00:00.000Z'
                }
            }
        },
        Error: {
            type: 'object',
            properties: {
                error: {
                    type: 'string',
                    description: 'Повідомлення про помилку',
                    example: 'Item not found'
                }
            }
        }
    }
};

// Swagger документація
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Inventory Service API',
            version: '1.0.0',
            description: 'API для системи інвентаризації - Лабораторна робота №7',
            contact: {
                name: "Student",
                email: "student@example.com"
            }
        },
        servers: [
            {
                url: `http://localhost:${options.port}`,
                description: 'Development server'
            }
        ],
        components: swaggerComponents
    },
    apis: ['./app.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI з коректною конфігурацією
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
        persistAuthorization: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        docExpansion: 'none'
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Inventory API Documentation'
}));

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
    console.log(`📨 ${req.method} ${req.path}`);
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
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
}

// HTML форми
app.get('/RegisterForm.html', (req, res) => {
    const filePath = path.join(__dirname, 'RegisterForm.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'RegisterForm.html not found' });
    }
});

app.get('/SearchForm.html', (req, res) => {
    const filePath = path.join(__dirname, 'SearchForm.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'SearchForm.html not found' });
    }
});

// Головна сторінка
app.get('/', (req, res) => {
    res.json({
        message: "Inventory Service API with Docker & PostgreSQL is running!",
        environment: process.env.NODE_ENV || 'development',
        database: "PostgreSQL",
        endpoints: {
            documentation: "/docs",
            register_form: "/RegisterForm.html",
            search_form: "/SearchForm.html",
            register: "/register (POST)",
            inventory: "/inventory (GET)",
            search: "/search (POST)"
        }
    });
});

/**
 * @swagger
 * /test:
 *   get:
 *     summary: Тестовий endpoint для перевірки роботи API
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Успішна відповідь
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/test', (req, res) => {
    res.json({
        message: "API is working correctly!",
        timestamp: new Date().toISOString(),
        server: `localhost:${options.port}`
    });
});

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація нового пристрою
 *     description: Додає новий інвентарний предмет з можливістю завантаження фото
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
 *                   example: "Device registered successfully"
 *                 id:
 *                   type: integer
 *                   example: 4
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
app.post('/register', upload.single('photo'), async (req, res) => {
    try {
        console.log('📝 Registration request received');
        console.log('📦 Request body:', req.body);
        console.log('📷 File:', req.file);

        const { inventory_name, description } = req.body;

        if (!inventory_name) {
            console.log('❌ Registration failed: Missing inventory name');
            return res.status(400).json({ error: 'Inventory name is required' });
        }

        const result = await pool.query(
            'INSERT INTO inventory (inventory_name, description, photo_filename) VALUES ($1, $2, $3) RETURNING *',
            [inventory_name, description || '', req.file ? req.file.filename : null]
        );

        const newItem = result.rows[0];

        console.log('✅ New item registered successfully:', {
            id: newItem.id,
            name: newItem.inventory_name,
            has_photo: !!newItem.photo_filename
        });

        const responseItem = {
            id: newItem.id,
            inventory_name: newItem.inventory_name,
            description: newItem.description,
            photo_url: newItem.photo_filename ? `/inventory/${newItem.id}/photo` : null,
            created_at: newItem.created_at
        };

        res.status(201).json({
            message: 'Device registered successfully',
            id: newItem.id,
            item: responseItem
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
app.get('/inventory', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventory ORDER BY id');
        console.log(`📋 Inventory list request - ${result.rows.length} items total`);

        const inventoryWithUrls = result.rows.map(item => ({
            id: item.id,
            inventory_name: item.inventory_name,
            description: item.description,
            photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null,
            created_at: item.created_at
        }));

        console.log(`✅ Sending ${inventoryWithUrls.length} items`);
        res.status(200).json(inventoryWithUrls);
    } catch (error) {
        console.error('💥 Error fetching inventory:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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
app.get('/inventory/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        console.log(`🔍 Get item request - ID: ${id}`);

        const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            console.log(`❌ Item ${id} not found.`);
            return res.status(404).json({ error: `Item with ID ${id} not found` });
        }

        const item = result.rows[0];
        const itemWithUrl = {
            id: item.id,
            inventory_name: item.inventory_name,
            description: item.description,
            photo_url: item.photo_filename ? `/inventory/${item.id}/photo` : null,
            created_at: item.created_at
        };

        console.log(`✅ Item found: ${item.inventory_name}`);
        res.status(200).json(itemWithUrl);
    } catch (error) {
        console.error('💥 Error fetching item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото зображення конкретної речі
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
 *         description: Фото інвентаря
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Фото або інвентар не знайдено
 */
app.get('/inventory/:id/photo', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);

        if (result.rows.length === 0 || !result.rows[0].photo_filename) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        const item = result.rows[0];
        const photoPath = path.join(__dirname, options.cache, item.photo_filename);

        if (!fs.existsSync(photoPath)) {
            return res.status(404).json({ error: 'Photo file not found' });
        }

        const mimeType = getMimeType(photoPath);
        res.setHeader('Content-Type', mimeType);
        res.sendFile(photoPath);
    } catch (error) {
        console.error('💥 Error fetching photo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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
 *                 example: "Updated Device Name"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *     responses:
 *       200:
 *         description: Інвентар оновлено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 item:
 *                   $ref: '#/components/schemas/Inventory'
 *       404:
 *         description: Інвентар не знайдено
 */
app.put('/inventory/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { inventory_name, description } = req.body;

        // Перевіряємо існування елемента
        const checkResult = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Оновлюємо поля
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (inventory_name) {
            updateFields.push(`inventory_name = $${paramCount}`);
            updateValues.push(inventory_name);
            paramCount++;
        }

        if (description !== undefined) {
            updateFields.push(`description = $${paramCount}`);
            updateValues.push(description);
            paramCount++;
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateValues.push(id);
        const query = `UPDATE inventory SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

        const result = await pool.query(query, updateValues);
        const updatedItem = result.rows[0];

        const responseItem = {
            id: updatedItem.id,
            inventory_name: updatedItem.inventory_name,
            description: updatedItem.description,
            photo_url: updatedItem.photo_filename ? `/inventory/${updatedItem.id}/photo` : null,
            created_at: updatedItem.created_at
        };

        res.status(200).json({
            message: 'Item updated successfully',
            item: responseItem
        });
    } catch (error) {
        console.error('💥 Error updating item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Перевіряємо існування елемента
        const checkResult = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = checkResult.rows[0];

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

        // Оновлюємо запис в БД
        await pool.query(
            'UPDATE inventory SET photo_filename = $1 WHERE id = $2',
            [req.file.filename, id]
        );

        res.status(200).json({ message: 'Photo updated successfully' });
    } catch (error) {
        console.error('💥 Error updating photo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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
app.delete('/inventory/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Отримуємо інформацію про елемент перед видаленням
        const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = result.rows[0];

        // Видаляємо фото якщо воно існує
        if (item.photo_filename) {
            const photoPath = path.join(options.cache, item.photo_filename);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        // Видаляємо запис з БД
        await pool.query('DELETE FROM inventory WHERE id = $1', [id]);

        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('💥 Error deleting item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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
app.post('/search', async (req, res) => {
    try {
        console.log('🔍 Search request received:', req.body);

        const { id, includePhoto } = req.body;
        const itemId = parseInt(id);

        console.log(`🔎 Searching for item ID: ${itemId}`);

        const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [itemId]);

        if (result.rows.length === 0) {
            console.log(`❌ SEARCH FAILED: Item ${itemId} not found!`);
            return res.status(404).json({ error: `Item with ID ${itemId} not found` });
        }

        const item = result.rows[0];
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
    } catch (error) {
        console.error('💥 Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Додатковий endpoint для отримання статистики
app.get('/stats', async (req, res) => {
    try {
        const totalResult = await pool.query('SELECT COUNT(*) FROM inventory');
        const photosResult = await pool.query('SELECT COUNT(*) FROM inventory WHERE photo_filename IS NOT NULL');
        const idsResult = await pool.query('SELECT id FROM inventory');

        const stats = {
            total_items: parseInt(totalResult.rows[0].count),
            items_with_photos: parseInt(photosResult.rows[0].count),
            available_ids: idsResult.rows.map(row => row.id),
            server_uptime: process.uptime(),
            cache_directory: options.cache,
            database: "PostgreSQL"
        };
        res.json(stats);
    } catch (error) {
        console.error('💥 Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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
    console.log(`🚀 Inventory Service with Docker & PostgreSQL`);
    console.log(`🚀 ==========================================`);
    console.log(`✅ Server running at http://localhost:${options.port}`);
    console.log(`📚 Swagger documentation: http://localhost:${options.port}/docs`);
    console.log(`📝 Register form: http://localhost:${options.port}/RegisterForm.html`);
    console.log(`🔍 Search form: http://localhost:${options.port}/SearchForm.html`);
    console.log(`📋 Inventory list: http://localhost:${options.port}/inventory`);
    console.log(`📊 Stats: http://localhost:${options.port}/stats`);
    console.log(`📁 Cache directory: ${path.resolve(options.cache)}`);
    console.log(`🗄️  Database: PostgreSQL`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`==========================================\n`);
});