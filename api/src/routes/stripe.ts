import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getStripe } from "../lib/stripe";
import { PLANS, type PlanKey } from "../lib/plans";

const router = Router();

// POST /api/stripe/checkout — Create a Stripe Checkout Session
router.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { plan } = req.body as { plan?: string };

  if (!plan || !["STARTER", "PRO", "BUSINESS"].includes(plan)) {
    res.status(400).json({ error: "Plan invalide" });
    return;
  }

  const planKey = plan as PlanKey;
  const planConfig = PLANS[planKey];

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    const stripe = getStripe();

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Vocal2Cal — ${planConfig.name}`,
              description: planConfig.description,
            },
            unit_amount: planConfig.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        plan: planKey,
        credits: String(planConfig.credits),
      },
      success_url: `${clientUrl}?payment=success&plan=${planKey}`,
      cancel_url: `${clientUrl}?payment=cancel`,
    });

    // Record pending payment
    await prisma.payment.create({
      data: {
        userId: user.id,
        stripeSessionId: session.id,
        plan: planKey,
        amount: planConfig.price,
        creditsGranted: planConfig.credits,
        status: "pending",
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe checkout:", error);
    res.status(500).json({ error: "Impossible de créer la session de paiement" });
  }
});

// POST /api/stripe/webhook — Stripe webhook handler
router.post("/webhook", async (req: Request, res: Response) => {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET manquant");
    res.status(500).send("Configuration manquante");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).send("Webhook signature invalide");
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const credits = parseInt(session.metadata?.credits || "0", 10);
    const plan = (session.metadata?.plan || "STARTER") as PlanKey;

    if (userId && credits > 0) {
      try {
        // Update payment status
        await prisma.payment.updateMany({
          where: { stripeSessionId: session.id },
          data: {
            status: "completed",
            stripePaymentId: session.payment_intent as string || null,
          },
        });

        // Add credits to user
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            credits: { increment: credits },
            plan,
          },
        });

        // Record transaction
        await prisma.creditTransaction.create({
          data: {
            userId,
            type: "PURCHASE",
            amount: credits,
            balance: updatedUser.credits,
            description: `Achat ${PLANS[plan].name} — ${credits} crédits`,
          },
        });

        console.log(`✅ ${credits} crédits ajoutés à ${userId} (plan: ${plan})`);
      } catch (err) {
        console.error("Erreur traitement webhook:", err);
      }
    }
  }

  res.json({ received: true });
});

// GET /api/stripe/plans — Public plans info
router.get("/plans", (_req: Request, res: Response) => {
  const plans = Object.entries(PLANS).map(([key, config]) => ({
    id: key,
    name: config.name,
    price: config.price,
    credits: config.credits,
    description: config.description,
  }));
  res.json({ plans });
});

export default router;
