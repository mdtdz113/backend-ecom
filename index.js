import express from 'express';
import cors from 'cors';
import { connectDb } from './db.js';
import {
  AuthRouter,
  ProductRouter,
  CartRouter,
  UserRouter,
  OrderRouter,
  PaymentRouter,
} from './routers/index.js';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

const app = express();
app.use(express.json());
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const options = {
  customCssUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.css',
};

const spec = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'swagger.json'), 'utf8')
);

const cspDefaults = helmet.contentSecurityPolicy.getDefaultDirectives();
delete cspDefaults['upgrade-insecure-requests'];

app.use(
  helmet({
    contentSecurityPolicy: { directives: cspDefaults },
  })
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, options));
app.use('/api/v1', AuthRouter);
app.use('/api/v1', ProductRouter);
app.use('/api/v1', CartRouter);
app.use('/api/v1', UserRouter);
app.use('/api/v1', OrderRouter);
app.use('/api/v1', PaymentRouter);
app.use('/index', (req, res) => {
  return res.body('OK');
});

const start = () => {
  connectDb(app);
};

start();
