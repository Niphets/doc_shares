// Import necessary modules
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MySQL Database Connection
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Niphets2001@',
  database: 'doc_share1',
});

// Test Database Connection
async function testConnection() {
  try {
    const connection = await db.getConnection();
    console.log('Connected to MySQL');
    connection.release();
  } catch (err) {
    console.error('MySQL connection error:', err);
  }
}
testConnection();

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });

// User Registration
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// User Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload Document
app.post('/upload', upload.array('document'), async (req, res) => {
  const { user_id } = req.body;
  if (!req.files || req.files.length === 0) return res.status(400).send('No files uploaded');

  const files = req.files;
  const values = files.map((file) => [file.originalname, path.join('uploads', file.filename), user_id]);

  try {
    await db.query('INSERT INTO documents (document_name, document_url, user_id) VALUES ?', [values]);
    res.json({ message: 'Documents uploaded successfully' });
  } catch (error) {
    console.error('Error saving documents:', error);
    res.status(500).send('Error saving documents');
  }
});

// Get All Documents
app.get('/documents/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM documents WHERE user_id = ?', [user_id]);
    res.status(200).json({ documents: rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Delete Applicant
app.delete('/api/applicants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM applicants WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Applicant not found' });
    res.status(200).json({ message: 'Applicant deleted successfully' });
  } catch (error) {
    console.error('Error deleting applicant:', error);
    res.status(500).json({ message: 'Error deleting applicant' });
  }
});

// POST: Add Applicant
app.post('/api/applicants', async (req, res) => {
  const { applicant_name } = req.body;
  console.log(applicant_name);

  try {
    const [result] = await db.query('INSERT INTO applicants (applicant_name) VALUES (?)', [applicant_name]);
    res.status(201).json({ id: result.insertId, name: applicant_name });
  } catch (err) {
    console.error('Error saving applicant:', err);

    // Handle duplicate entry (if the applicant name already exists)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Applicant name already exists' });
    }

    return res.status(500).json({ error: 'Failed to save applicant' });
  }
});

// GET: Fetch All Applicants
app.get('/api/applicants', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM applicants');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching applicants:', err);
    return res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
