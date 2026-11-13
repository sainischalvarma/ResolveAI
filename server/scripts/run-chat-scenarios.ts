import fs from "node:fs/promises";
import path from "node:path";
import { createConversation, appendMessage, resetDevelopmentChatStore } from "../src/services/chatService.js";

async function runScenarios() {
  const scenariosPath = path.resolve(process.cwd(), "../eval/chat-scenarios.json");
  const scenariosData = await fs.readFile(scenariosPath, "utf-8");
  const scenarios = JSON.parse(scenariosData);

  let passed = 0;
  let total = scenarios.length;

  console.log(`Running ${total} scenarios...`);
  
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    console.log(`\nScenario ${i + 1}/${total}: ${scenario.name}`);
    
    resetDevelopmentChatStore();
    
    let conversation = await createConversation({ userId: "test-user" });
    let scenarioPassed = true;

    for (const turn of scenario.turns) {
      console.log(`User: ${turn.user}`);
      conversation = await appendMessage(conversation.id, turn.user, "test-user");
      
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      const assistantContent = lastMessage.content;
      console.log(`Assistant: ${assistantContent}`);

      const regex = new RegExp(turn.expectedSystemPattern, "i");
      if (!regex.test(assistantContent)) {
        console.error(`❌ FAILED: Expected pattern /${turn.expectedSystemPattern}/ not found in response.`);
        scenarioPassed = false;
        break;
      }
    }
    
    // State Validation at end of conversation
    if (scenarioPassed && conversation.state) {
      if (conversation.state.status === "troubleshooting" && !conversation.state.current_step) {
         console.error(`❌ FAILED: Status is troubleshooting but current_step is missing.`);
         scenarioPassed = false;
      }
    }

    if (scenarioPassed) {
      console.log(`✅ PASSED`);
      passed++;
    }
  }

  console.log(`\nResults: ${passed}/${total} passed.`);
  process.exit(passed === total ? 0 : 1);
}

runScenarios().catch(err => {
  console.error("Error running scenarios:", err);
  process.exit(1);
});
