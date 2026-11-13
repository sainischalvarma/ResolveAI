import { z } from "zod";

export const chatStateSchema = z.object({
  status: z.enum(["new", "troubleshooting", "solved", "escalated"]),
  issue_category: z.string().optional(),
  issue_type: z.string().optional(),
  device: z.string().optional(),
  operating_system: z.string().optional(),
  current_step: z.number().optional(),
  completed_steps: z.array(z.string()).default([]),
  failed_steps: z.array(z.string()).default([]),
  error_message: z.string().optional(),
  screenshot_analysis: z.string().optional(),
  user_name: z.string().optional(),
  user_email: z.string().optional(),
  impact_scope: z.enum(["organization_wide", "multiple_users", "single_user", "minor"]).optional(),
  solved: z.boolean().default(false),
  escalate: z.boolean().default(false),
  reason_for_escalation: z.string().optional(),
  ticketId: z.string().optional(),
  source_id: z.string().optional().describe("The ID or title of the knowledge base runbook used for this step, if any."),
  assistant_reply: z.string().describe("The text message to show to the user, strictly following the tone and step formatting rules.")
});

export type ChatState = z.infer<typeof chatStateSchema>;
