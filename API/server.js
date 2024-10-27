const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const { Pool } = require('pg');
require('dotenv').config();
const path = require('path');
const { auth, requiresAuth } = require('express-openid-connect'); 
const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    }
});

const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_CLIENT_SECRET,
    baseURL: `https://web-lab1-qrcode-app-backend.onrender.com`,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
};


app.use(auth(config));

const client = jwksClient({
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

function checkJwt(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).send('Unauthorized: No token provided');
    }

    jwt.verify(token, getKey, {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256']
    }, (err, decoded) => {
        if (err) {
            console.error('JWT verification failed:', err);
            return res.status(401).send('Unauthorized: Invalid token');
        }
        req.decoded = decoded;
        next();
    });
}

app.post('/tickets',checkJwt , async (req, res) => {
    const { vatin, firstName, lastName } = req.body;
    console.log("Received request to generate ticket:", req.body);

    if (!vatin || !firstName || !lastName) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const { rows } = await pool.query('SELECT COUNT(*) AS count FROM tickets WHERE vatin = $1', [vatin]);
        const ticketCount = parseInt(rows[0].count, 10);

        if (ticketCount >= 3) {
            console.log("Maximum number of tickets reached for this OIB:", vatin);
            return res.status(400).json({ message: 'Maximum number of tickets reached for this OIB' });
        }

        const ticketId = uuidv4();
        console.log("Generated ticket ID:", ticketId);

        const insertResult = await pool.query(
            'INSERT INTO tickets (id, vatin, first_name, last_name, created_at) VALUES ($1, $2, $3, $4, NOW())',
            [ticketId, vatin, firstName, lastName]
        );

        if (insertResult.rowCount === 0) {
            console.error("Failed to insert ticket into database.");
            return res.status(500).json({ message: 'Failed to generate ticket' });
        }

       const qrCodeUrl = `https://web-lab1-qrcode-app-backend.onrender.com/tickets/${ticketId}`;

       const qrCodeBuffer = await QRCode.toBuffer(qrCodeUrl, { type: 'png' });

       res.set({
           'Content-Type': 'image/png',
           'Content-Length': qrCodeBuffer.length,
       });

       res.status(201).send(qrCodeBuffer);

    } catch (error) {
        console.error('Error generating ticket:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/tickets/:id' ,requiresAuth() ,async (req, res) => {
    console.log("User is authenticated:", req.oidc.isAuthenticated());
    console.log("Session data:", req.oidc);
    const ticketId = req.params.id;
    console.log("Fetching details for ticket ID:", ticketId);

    try {
        const { rows } = await pool.query(
            'SELECT id, vatin, first_name, last_name, created_at FROM tickets WHERE id = $1',
            [ticketId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        const ticket = rows[0];

        const currentUser = req.oidc.user ? req.oidc.user.name : 'Unknown User';
        const ticketHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Ticket Details</title>
            </head>
            <body>
                <h1>Ticket Details</h1>
                <p>ID: ${ticket.id}</p>
                <p>OIB: ${ticket.vatin}</p>
                <p>First Name: ${ticket.first_name}</p>
                <p>Last Name: ${ticket.last_name}</p>
                <p>Created At: ${new Date(ticket.created_at).toLocaleString()}</p>
                <p>Logged in User: ${currentUser}</p>
            </body>
            </html>
        `;
        res.send(ticketHtml);

    } catch (error) {
        console.error('Error fetching ticket details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


app.get('/ticketCount', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT COUNT(*) AS totalcount FROM tickets');

        if (rows.length > 0 && rows[0].totalcount) {
            const totalCount = parseInt(rows[0].totalcount, 10);
            return res.status(200).json({ totalCount }); 
        } else {
            return res.status(200).json({ totalCount: 0 });
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});


const port = process.env.PORT_BACKEND || 4001;
app.listen(port, () => {
    console.log(`API running at http://localhost:${port}`);
});
