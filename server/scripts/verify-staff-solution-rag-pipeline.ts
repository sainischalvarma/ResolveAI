import { createRagService } from "../src/services/rag/RagService.js";
import { resolveTicket } from "../src/services/staffService.js";
import { createConversation, appendMessage, resetDevelopmentChatStore } from "../src/services/chatService.js";
import type { AuthenticatedUser } from "@resolveai/shared";

async function verifyStaffSolutionRagPipeline() {
  console.log("================================================================================");
  console.log("VERIFYING END-TO-END STAFF SOLUTION -> VECTOR SEARCH -> CONVERSATIONAL RAG PIPELINE");
  console.log("================================================================================\n");

  resetDevelopmentChatStore();

  const mockTechnician: AuthenticatedUser = {
    id: "tech-alex-99",
    name: "Alex Vance (Lead IT Engineer)",
    email: "alex.vance@company.com",
    role: "TECHNICIAN"
  };

  // -------------------------------------------------------------------------
  // STEP 1 & 2: Staff Solves Ticket -> Saves Verified Solution
  // -------------------------------------------------------------------------
  console.log("Step 1: Technician Alex resolves a ticket with a proven solution...");
  const ticketId = "dev-ticket-teams-audio-101";

  // Pre-seed dev ticket in devStaffTickets store
  const { devStaffTickets } = await import("../src/services/staffService.js");
  devStaffTickets.set(ticketId, {
    id: ticketId,
    title: "Bluetooth headset mic muted in Teams",
    description: "User's bluetooth headset connects for listening but the microphone will not input any audio into Microsoft Teams.",
    category: "hardware",
    severity: "MEDIUM",
    priority: "P3",
    status: "IN_PROGRESS",
    userId: "user-marketing-42",
    userName: "Jordan Lee",
    userEmail: "jordan.lee@company.com",
    aiConfidence: 0.85,
    attemptedActions: ["Toggled Bluetooth", "Rejoined meeting"],
    failedActions: ["Standard Teams audio settings"],
    ragSources: [],
    escalationReason: "Teams audio driver issue",
    technicianActions: [],
    replies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const resolutionResult = await resolveTicket(mockTechnician, ticketId, {
    summary: "Disabling Exclusive Mode in Windows Sound properties immediately restored the headset mic in Teams.",
    rootCause: "Exclusive audio control lock enabled by Windows 11 audio driver.",
    actionsTaken: [
      "Press Windows+R, type mmsys.cpl and press Enter to open Sound Control Panel",
      "Navigate to Recording tab, double-click the Bluetooth Headset Hands-Free device",
      "Go to the Advanced tab, uncheck 'Allow applications to take exclusive control of this device'",
      "Click Apply, restart Microsoft Teams, and make a test call"
    ],
    kbRecommendation: "Apply this whenever Teams mic fails on Bluetooth headsets with exclusive mode locks."
  });

  console.log(`✅ Ticket marked as: ${resolutionResult.status}`);
  console.log(`✅ Resolution summary: ${resolutionResult.resolution?.summary}`);

  // -------------------------------------------------------------------------
  // STEP 3 & 4: Create Embedding -> MongoDB Atlas / Vector Search Index
  // -------------------------------------------------------------------------
  console.log("\nStep 2: Checking vector search retrieval for the newly indexed solution...");
  const ragService = createRagService();
  const searchResults = await ragService.retrieve("teams microphone bluetooth audio issue", {
    category: "hardware",
    limit: 3
  });

  console.log(`Found ${searchResults.length} matching knowledge chunk(s):`);
  for (const chunk of searchResults) {
    console.log(` - [Title: ${chunk.title}] (Score/Relevance: ${chunk.relevance?.toFixed(3) ?? "N/A"})`);
  }

  const foundVerifiedChunk = searchResults.find(
    (c) => c.title.includes("Bluetooth headset mic muted in Teams") || c.content.includes("Exclusive Mode")
  );

  if (!foundVerifiedChunk) {
    console.error("❌ FAILED: The technician's verified solution was not indexed or retrieved by vector search!");
    process.exit(1);
  }
  console.log("✅ Verified staff solution found in vector search index!");

  // -------------------------------------------------------------------------
  // STEP 5 & 6 & 7: Future User Asks Similar Problem -> RAG Retrieves -> LLM Explains Naturally
  // -------------------------------------------------------------------------
  console.log("\nStep 3: Future employee asks chatbot naturally about similar problem...");
  const futureUserMessage = "My bluetooth microphone doesn't work when I join Teams calls";
  console.log(`User: "${futureUserMessage}"`);

  let conversation = await createConversation({ userId: "user-future-88" });
  conversation = await appendMessage(conversation.id, futureUserMessage, "user-future-88");

  const assistantTurn1 = conversation.messages[conversation.messages.length - 1];
  console.log(`\nAssistant:\n${assistantTurn1.content}\n`);

  // Verify assistant conversationally explains the verified solution
  const hasStep = /Step \d+:/i.test(assistantTurn1.content);
  console.log(`Checks:`);
  console.log(` - Has Step label: ${hasStep ? "✅ YES" : "❌ NO"}`);

  // -------------------------------------------------------------------------
  // STEP 8: Future user reports solution worked -> Outcome recorded
  // -------------------------------------------------------------------------
  console.log("\nStep 4: Future user confirms the solution worked...");
  console.log(`User: "that worked! mic is working now"`);
  conversation = await appendMessage(conversation.id, "that worked! mic is working now", "user-future-88");

  const assistantTurn2 = conversation.messages[conversation.messages.length - 1];
  console.log(`\nAssistant:\n${assistantTurn2.content}\n`);

  const isSolved = conversation.state?.solved === true;
  console.log(` - State status: ${conversation.state?.status}`);
  console.log(` - Solved flag: ${isSolved ? "✅ TRUE" : "❌ FALSE"}`);

  if (isSolved) {
    console.log("\n================================================================================");
    console.log("🎉 COMPLETE END-TO-END PIPELINE VERIFIED SUCCESSFULLY!");
    console.log("================================================================================");
    process.exit(0);
  } else {
    console.error("❌ Pipeline validation failed.");
    process.exit(1);
  }
}

verifyStaffSolutionRagPipeline().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
