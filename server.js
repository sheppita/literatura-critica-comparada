import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import rotas from './rotas.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static('public'));

app.use('/api', rotas);

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`🌸 Rodando na porta ${PORTA}`));