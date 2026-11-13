import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { KnowledgeChunkModel } from "../../models/KnowledgeChunk.js";
import { resolveEmbeddingProvider } from "./EmbeddingProvider.js";

const embeddingDimensions = 384;
const defaultVectorIndexName = "knowledge_embedding_index";
const defaultRetrievalLimit = 5;

export interface RagChunk {
  chunkId: string;
  documentId: string;
  title: string;
  category?: string;
  content: string;
  relevance: number;
  metadata: Record<string, unknown>;
}

export interface RagService {
  indexDocument(input: IndexKnowledgeDocumentInput): Promise<KnowledgeDocumentSummary>;
  listDocuments(): Promise<KnowledgeDocumentSummary[]>;
  retrieve(query: string, options?: RetrieveKnowledgeOptions): Promise<RagChunk[]>;
}

export interface IndexKnowledgeDocumentInput {
  title: string;
  content: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface RetrieveKnowledgeOptions {
  category?: string;
  limit?: number;
}

export interface KnowledgeDocumentSummary {
  documentId: string;
  title: string;
  category: string;
  chunkCount: number;
  storage: "memory" | "mongodb-vector";
  updatedAt: string;
}

interface StoredKnowledgeChunk extends Omit<RagChunk, "relevance"> {
  category: string;
  embedding: number[];
  updatedAt: string;
}

const developmentChunks: StoredKnowledgeChunk[] = [];

export function createRagService(): RagService {
  return isDatabaseConnected() ? new MongoVectorRagService() : new InMemoryVectorRagService();
}

export async function embedText(text: string) {
  const provider = resolveEmbeddingProvider();
  return provider.embed(text);
}

class InMemoryVectorRagService implements RagService {
  constructor() {
    seedDevelopmentKnowledge();
  }

  async indexDocument(input: IndexKnowledgeDocumentInput): Promise<KnowledgeDocumentSummary> {
    const documentId = randomUUID();
    const category = normalizeCategory(input.category);
    const chunksToInsert = [];
    const chunksRaw = chunkText(input.content);
    for (let index = 0; index < chunksRaw.length; index++) {
      const content = chunksRaw[index];
      const embedding = await embedText(`${input.title}\n${content}`);
      chunksToInsert.push({
        chunkId: `${documentId}:${index}`,
        documentId,
        title: input.title,
        category,
        content,
        embedding,
        metadata: { ...input.metadata, sourceType: "development", chunkIndex: index },
        updatedAt: new Date().toISOString()
      });
    }

    developmentChunks.push(...chunksToInsert);

    return summarizeChunks(chunksToInsert, "memory")[0];
  }

  async listDocuments(): Promise<KnowledgeDocumentSummary[]> {
    return summarizeChunks(developmentChunks, "memory");
  }

  async retrieve(query: string, options: RetrieveKnowledgeOptions = {}): Promise<RagChunk[]> {
    const queryEmbedding = await embedText(query);
    const category = options.category ? normalizeCategory(options.category) : undefined;
    const limit = clampLimit(options.limit);

    return developmentChunks
      .filter((chunk) => !category || chunk.category === category)
      .map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        title: chunk.title,
        category: chunk.category,
        content: chunk.content,
        relevance: cosineSimilarity(queryEmbedding, chunk.embedding),
        metadata: chunk.metadata
      }))
      .sort((left, right) => right.relevance - left.relevance)
      .slice(0, limit);
  }
}

class MongoVectorRagService implements RagService {
  async indexDocument(input: IndexKnowledgeDocumentInput): Promise<KnowledgeDocumentSummary> {
    const documentId = new mongoose.Types.ObjectId().toString();
    const category = normalizeCategory(input.category);
    const chunksToInsert = [];
    const chunksRaw = chunkText(input.content);
    for (let index = 0; index < chunksRaw.length; index++) {
      const content = chunksRaw[index];
      const embedding = await embedText(`${input.title}\n${content}`);
      chunksToInsert.push({
        documentId,
        chunkId: `${documentId}:${index}`,
        title: input.title,
        category,
        content,
        embedding,
        metadata: { ...input.metadata, chunkIndex: index }
      });
    }

    await KnowledgeChunkModel.insertMany(chunksToInsert);

    return {
      documentId,
      title: input.title,
      category,
      chunkCount: chunksToInsert.length,
      storage: "mongodb-vector",
      updatedAt: new Date().toISOString()
    };
  }

  async listDocuments(): Promise<KnowledgeDocumentSummary[]> {
    const documents = await KnowledgeChunkModel.aggregate<{
      _id: string;
      title: string;
      category: string;
      chunkCount: number;
      updatedAt: Date;
    }>([
      {
        $group: {
          _id: "$documentId",
          title: { $first: "$title" },
          category: { $first: "$category" },
          chunkCount: { $sum: 1 },
          updatedAt: { $max: "$updatedAt" }
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);

    return documents.map((document) => ({
      documentId: document._id,
      title: document.title,
      category: document.category,
      chunkCount: document.chunkCount,
      storage: "mongodb-vector",
      updatedAt: document.updatedAt.toISOString()
    }));
  }

  async retrieve(query: string, options: RetrieveKnowledgeOptions = {}): Promise<RagChunk[]> {
    const category = options.category ? normalizeCategory(options.category) : undefined;
    const limit = clampLimit(options.limit);
    const categoryFilter = category ? { category } : {};
    const approvalFilter = { "metadata.approvalStatus": { $ne: "REJECTED" } };

    // 1. Try MongoDB Atlas Vector Search native aggregation pipeline
    try {
      const queryVector = await embedText(query);
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: process.env.MONGODB_VECTOR_INDEX ?? defaultVectorIndexName,
            path: "embedding",
            queryVector,
            numCandidates: Math.max(limit * 20, 100),
            limit,
            ...(category ? { filter: { category } } : {})
          }
        },
        {
          $project: {
            _id: 0,
            chunkId: 1,
            documentId: 1,
            title: 1,
            category: 1,
            content: 1,
            metadata: 1,
            relevance: { $meta: "vectorSearchScore" }
          }
        }
      ];

      const results = await KnowledgeChunkModel.aggregate<RagChunk>(pipeline);
      if (results && results.length > 0) {
        return results.filter((r) => r.metadata?.approvalStatus !== "REJECTED");
      }
    } catch {
      // $vectorSearch index might not be configured on MongoDB Atlas yet, fall through to vector embedding search
    }

    // 2. Semantic Vector Embedding Search over MongoDB Atlas Chunks
    const queryEmbedding = await embedText(query);
    const candidateChunks = await KnowledgeChunkModel.find({
      ...categoryFilter,
      ...approvalFilter
    })
      .limit(100)
      .lean();

    if (candidateChunks.length > 0) {
      return candidateChunks
        .map((chunk) => ({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          title: chunk.title,
          category: chunk.category,
          content: chunk.content,
          relevance: cosineSimilarity(queryEmbedding, chunk.embedding),
          metadata: (chunk.metadata as Record<string, unknown>) ?? {}
        }))
        .sort((left, right) => right.relevance - left.relevance)
        .slice(0, limit);
    }

    return [];
  }
}

export async function seedMongoKnowledge() {
  if (!isDatabaseConnected()) return;
  try {
    const count = await KnowledgeChunkModel.countDocuments();
    if (count === 0) {
      const rag = new MongoVectorRagService();
      for (const doc of defaultKnowledgeDocuments) {
        await rag.indexDocument({
          title: doc.title,
          content: doc.content,
          category: doc.category,
          metadata: { actionId: "actionId" in doc ? (doc as any).actionId : undefined, id: doc.id }
        });
      }
      console.log(`Seeded ${defaultKnowledgeDocuments.length} IT knowledge base documents into MongoDB.`);
    }
  } catch (err) {
    console.warn("Could not seed knowledge to MongoDB:", (err as Error).message);
  }
}

async function seedDevelopmentKnowledge() {
  if (developmentChunks.length > 0) {
    return;
  }

  for (const document of defaultKnowledgeDocuments) {
    const documentId = document.id;
    const chunksRaw = chunkText(document.content);
    for (let index = 0; index < chunksRaw.length; index++) {
      const content = chunksRaw[index];
      const embedding = await embedText(`${document.title}\n${content}`);
      developmentChunks.push({
        chunkId: `${documentId}:${index}`,
        documentId,
        title: document.title,
        category: document.category,
        content,
        embedding,
        metadata: { sourceType: "seed", actionId: document.actionId, chunkIndex: index },
        updatedAt: new Date(0).toISOString()
      });
    }
  }
}

function chunkText(text: string) {
  // Split by headings (e.g. PROBLEM:, TROUBLESHOOTING STEPS:, EXPECTED RESULT:, ESCALATION CONDITIONS:)
  // or double newlines, but keeping ordered step lists together.
  const sections = text.split(/(?=^[A-Z\s]+:$)/m).filter(Boolean);
  const chunks: string[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}

function summarizeChunks(chunks: StoredKnowledgeChunk[], storage: KnowledgeDocumentSummary["storage"]) {
  const documents = new Map<string, KnowledgeDocumentSummary>();

  for (const chunk of chunks) {
    const existing = documents.get(chunk.documentId);

    if (existing) {
      existing.chunkCount += 1;
      existing.updatedAt = chunk.updatedAt > existing.updatedAt ? chunk.updatedAt : existing.updatedAt;
      continue;
    }

    documents.set(chunk.documentId, {
      documentId: chunk.documentId,
      title: chunk.title,
      category: chunk.category,
      chunkCount: 1,
      storage,
      updatedAt: chunk.updatedAt
    });
  }

  return [...documents.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function cosineSimilarity(left: number[], right: number[]) {
  return left.reduce((score, value, index) => score + value * (right[index] ?? 0), 0);
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

function normalizeCategory(category = "general") {
  const lowered = category.trim().toLowerCase();

  if (lowered.includes("wi-fi") || lowered.includes("wifi")) {
    return "network";
  }

  return lowered || "general";
}

function clampLimit(limit = defaultRetrievalLimit) {
  return Math.max(1, Math.min(10, limit));
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export const defaultKnowledgeDocuments = [
  {
    id: "kb-wifi-not-connecting",
    title: "Wi-Fi not connecting",
    category: "network",
    actionId: "wifi_not_connecting",
    content: [
      "PROBLEM: Wi-Fi is not working or the device cannot connect to a wireless network (e.g. 'Can't connect to this network').",
      "TROUBLESHOOTING STEPS:",
      "1. Confirm Wi-Fi is turned on (check the Wi-Fi toggle / airplane mode is off). Expected: the Wi-Fi list shows available networks.",
      "2. Forget the network and reconnect, re-entering the password. Expected: the device reconnects successfully.",
      "3. Restart the Wi-Fi adapter or toggle airplane mode on then off. Expected: the adapter re-scans and connects.",
      "4. Restart the device. Expected: a clean network stack reconnects automatically.",
      "5. Move closer to the router / access point to rule out signal strength. Expected: stronger signal and a stable connection.",
      "EXPECTED RESULT: The device connects to the Wi-Fi network and can browse the internet.",
      "ESCALATION CONDITIONS: All steps attempted and still no connection, OR multiple users/devices cannot connect, OR the access point appears down."
    ].join("\n")
  },
  {
    id: "kb-internet-connection",
    title: "Connected to Wi-Fi but no internet",
    category: "network",
    actionId: "wifi_no_internet",
    content: [
      "PROBLEM: The device is connected to the network but web pages do not load (no internet / limited connectivity).",
      "TROUBLESHOOTING STEPS:",
      "1. Check whether other devices on the same network have internet. Expected: identifies if the issue is local or network-wide.",
      "2. Power-cycle the modem/router: unplug for 30 seconds, plug back in, wait 2 minutes. Expected: internet is restored.",
      "3. Renew the IP address (disable/enable the adapter). Expected: a valid IP and gateway are obtained.",
      "4. Try a known site by IP to rule out DNS, then flush DNS. Expected: pages resolve normally.",
      "EXPECTED RESULT: Web pages load and internet access is restored.",
      "ESCALATION CONDITIONS: No device on the network has internet (possible ISP/office outage), OR the entire office is affected."
    ].join("\n")
  },
  {
    id: "kb-vpn-will-not-connect",
    title: "VPN will not connect",
    category: "vpn",
    actionId: "vpn_wont_connect",
    content: [
      "PROBLEM: The corporate VPN fails to connect or drops repeatedly.",
      "TROUBLESHOOTING STEPS:",
      "1. Confirm the device has working internet without the VPN. Expected: general browsing works.",
      "2. Sign out and back into the VPN client, re-entering credentials/MFA. Expected: authentication succeeds.",
      "3. Switch to a different VPN server/region if available. Expected: connection establishes on an alternate gateway.",
      "4. Restart the VPN client and the device. Expected: a clean client session connects.",
      "EXPECTED RESULT: The VPN connects and internal resources are reachable.",
      "ESCALATION CONDITIONS: Correct credentials still fail, the VPN gateway appears down, or many users cannot connect."
    ].join("\n")
  },
  {
    id: "kb-printer-not-printing",
    title: "Printer not printing",
    category: "hardware",
    actionId: "printer_not_printing",
    content: [
      "PROBLEM: Documents do not print, or the printer shows offline/error.",
      "TROUBLESHOOTING STEPS:",
      "1. Check the printer is powered on, has paper and toner/ink, and no error lights. Expected: printer shows ready.",
      "2. Confirm the printer is set as default and shows 'Online' (not paused). Expected: status is Online.",
      "3. Clear the print queue and resend the job. Expected: the stuck job clears and the new job prints.",
      "4. Restart the Print Spooler service (or restart the computer). Expected: printing resumes.",
      "5. Reinstall/reconnect the printer driver. Expected: the printer is detected and prints a test page.",
      "EXPECTED RESULT: A test page or document prints successfully.",
      "ESCALATION CONDITIONS: Hardware fault (paper jam that cannot be cleared, hardware error code), or a shared office printer is down for many users."
    ].join("\n")
  },
  {
    id: "kb-outlook-email",
    title: "Outlook not sending or receiving",
    category: "software",
    actionId: "outlook_not_working",
    content: [
      "PROBLEM: Outlook will not send/receive email or is stuck 'Trying to connect'.",
      "TROUBLESHOOTING STEPS:",
      "1. Check internet connectivity. Expected: browsing works.",
      "2. Confirm Outlook is Online (Send/Receive tab, not Work Offline). Expected: status is Connected.",
      "3. Send/Receive All Folders manually. Expected: mail syncs.",
      "4. Restart Outlook, then restart the computer. Expected: the profile reconnects.",
      "5. Verify credentials / re-authenticate the account if prompted. Expected: mailbox authenticates.",
      "EXPECTED RESULT: Email sends and receives normally.",
      "ESCALATION CONDITIONS: Mailbox authentication keeps failing, mailbox is full/locked, or the mail server is unreachable for many users."
    ].join("\n")
  },
  {
    id: "kb-password-account-access",
    title: "Cannot log in / password issues",
    category: "account",
    actionId: "password_account_issues",
    content: [
      "PROBLEM: The user cannot sign in, or the account is locked.",
      "TROUBLESHOOTING STEPS:",
      "1. Confirm the username/email is correct and Caps Lock is off. Expected: correct credentials entered.",
      "2. Verify the correct domain/portal is being used. Expected: sign-in page matches the account.",
      "3. Use the self-service password reset if available. Expected: password is reset and login succeeds.",
      "4. Complete any MFA prompt / re-register the MFA device if needed. Expected: MFA verification passes.",
      "EXPECTED RESULT: The user successfully signs in.",
      "ESCALATION CONDITIONS: The account is locked and self-service reset is unavailable, or MFA cannot be recovered — a technician must reset/unlock the account."
    ].join("\n")
  },
  {
    id: "kb-computer-problems",
    title: "Computer slow, frozen, or not starting",
    category: "system",
    actionId: "computer_slow_frozen",
    content: [
      "PROBLEM: The computer is very slow, frozen, or will not start properly.",
      "TROUBLESHOOTING STEPS:",
      "1. Save work and restart the computer. Expected: performance improves after a reboot.",
      "2. Close heavy or unresponsive apps (Task Manager). Expected: resources free up.",
      "3. Check for and install pending OS updates, then reboot. Expected: stability improves.",
      "4. Ensure enough free disk space (delete temp files if very low). Expected: the system runs normally.",
      "5. If it will not power on, check power cable/battery and hold the power button 10s then restart. Expected: the device boots.",
      "EXPECTED RESULT: The computer runs normally and is responsive.",
      "ESCALATION CONDITIONS: The device will not boot after these steps, shows hardware error/blue-screen loops, or the issue is business-critical."
    ].join("\n")
  },
  {
    id: "kb-wifi-authentication",
    title: "Wi-Fi Authentication Runbook",
    category: "network",
    actionId: "forget_network",
    content:
      "Use this runbook when a device can see the Wi-Fi network but cannot authenticate or keeps asking for credentials.\n\nFirst confirm the user has the correct network password and that their account is active. If credentials are correct, forget the saved Wi-Fi profile and reconnect so the device creates a fresh authentication profile.\n\nThis action is low risk and can be completed by a user or technician. If reconnecting fails, collect the device OS, location, and exact error before trying broader network resets."
  },
  {
    id: "kb-windows-network-reset",
    title: "Windows Network Reset Guide",
    category: "network",
    actionId: "reset_network",
    content:
      "Use network reset only after safer adapter restart and saved-profile cleanup have failed.\n\nThe reset clears local network adapters and stored configuration. The user should be ready to restart the device afterward and may need to reconnect VPN or Wi-Fi profiles.\n\nBecause this can disrupt connectivity, technician approval is recommended unless policy allows supervised user execution."
  },
  {
    id: "kb-adapter-restart",
    title: "Network Adapter Restart Checklist",
    category: "network",
    actionId: "restart_adapter",
    content:
      "Restarting the network adapter is a low-risk first action when connectivity is intermittent or the adapter appears stuck.\n\nAsk the user to disable and re-enable the adapter, or toggle Wi-Fi off and on. Confirm whether the device receives an IP address afterward.\n\nIf the user can see the Wi-Fi network but authentication still fails, prefer forgetting and reconnecting to the network."
  },
  {
    id: "kb-critical-incident",
    title: "Critical Incident Policy",
    category: "server",
    content:
      "Production outage, suspected data loss, and security incidents must bypass automated troubleshooting and create a P1 escalation.\n\nThe assistant should collect impact, start time, affected systems, and recent changes, then route to the technician or incident response team."
  }
];
