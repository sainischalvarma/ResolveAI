import { createServer } from "node:http";
import dotenv from "dotenv";
import { buildApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { initQdrant } from "./config/qdrant.js";
import { createNotificationGateway } from "./services/notifications/notificationGateway.js";

import { seedDefaultUsers } from "./services/seedUsers.js";
import { seedMongoKnowledge } from "./services/rag/RagService.js";

dotenv.config();

const port = Number(process.env.PORT ?? 4000);
const app = buildApp();
const server = createServer(app);

createNotificationGateway(server);

await connectDatabase(process.env.MONGODB_URI);
await seedDefaultUsers();
await seedMongoKnowledge();
await initQdrant();

server.listen(port, () => {
  console.log(`ResolveAI API listening on port ${port}`);
});
