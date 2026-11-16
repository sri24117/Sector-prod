import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { rawDb, schema } from "@sector/db";
import { logSecurityEvent } from "../auth/middleware.js";
import { sendPlanRequestEmails } from "../lib/email.js";

const PlanRequestSchema = z.object({
  organizationName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  plan: z.enum(["starter", "growth", "pro"]),
  billingCycle: z.enum(["monthly", "annual"]),
  notes: z.string().trim().max(2_000).optional(),
}).strict();

const ACKNOWLEDGEMENT = {
  message: "Request received. Nothing has been charged. The SEctOr team will contact you to arrange the invoice or waitlist onboarding.",
};

export async function registerPlanRequestRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/plan-requests",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = PlanRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "invalid_input",
          message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
        });
      }

      const input = parsed.data;
      const [created] = await rawDb.insert(schema.planRequests).values({
        organizationName: input.organizationName,
        contactName: input.contactName,
        email: input.email,
        plan: input.plan,
        billingCycle: input.billingCycle,
        notes: input.notes || null,
      }).returning();

      let delivery = "email_not_configured";
      try {
        const sent = await sendPlanRequestEmails({ requestId: created!.id, ...input });
        delivery = sent.acknowledgementSent
          ? sent.opsNotificationSent ? "ack_and_ops_sent" : "ack_sent_ops_not_configured"
          : "email_not_configured";
      } catch (error) {
        request.log.error(error, "plan request email failed");
        delivery = "email_failed";
      }

      await logSecurityEvent({
        action: "plan_request_created",
        result: "success",
        detail: `request=${created!.id};plan=${input.plan};delivery=${delivery}`,
      });

      return reply.status(202).send(ACKNOWLEDGEMENT);
    },
  );
}
