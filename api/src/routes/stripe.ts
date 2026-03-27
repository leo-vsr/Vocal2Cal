import { Router, Request, Response } from "express";
import type Stripe from "stripe";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getStripe } from "../lib/stripe";
import {
  PAID_PLAN_KEYS,
  PLANS,
  TOP_UP_PACKS,
  type PaidPlanKey,
  type PlanKey,
  type TopUpPackKey,
  getPlanCreditDelta,
  getPaidPlanKeyByStripePriceId,
  isPaidPlanKey,
  isUpgradePlan,
  isSubscriptionActiveStatus,
  isTopUpPackKey,
} from "../lib/plans";

const router = Router();
let upgradePortalConfigurationId: string | null = null;
let upgradePortalConfigurationSignature: string | null = null;

function getClientUrl() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

function getStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function getStripeSubscriptionId(
  subscription: string | Stripe.Subscription | null
) {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function getStripeScheduleId(
  schedule: string | Stripe.SubscriptionSchedule | null
) {
  if (!schedule) return null;
  return typeof schedule === "string" ? schedule : schedule.id;
}

function getStripePaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null
) {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function getStripePriceId(
  price: string | Stripe.Price | Stripe.DeletedPrice | null | undefined
) {
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  return getStripePriceId(subscription.items.data[0]?.price);
}

function getInvoiceLinePriceId(line: Stripe.InvoiceLineItem) {
  return getStripePriceId(line.pricing?.price_details?.price);
}

function getSchedulePhasePriceId(phase: Stripe.SubscriptionSchedule.Phase) {
  return getStripePriceId(phase.items[0]?.price);
}

function getSubscriptionMetadata(userId: string, plan: PaidPlanKey) {
  return {
    purchaseType: "subscription",
    userId,
    plan,
    credits: String(PLANS[plan].credits),
  };
}

function getPlanFromSubscription(
  subscription: Stripe.Subscription,
  fallbackPlan?: PaidPlanKey
) {
  const pricePlan = getPaidPlanKeyByStripePriceId(getSubscriptionPriceId(subscription));
  if (pricePlan) {
    return pricePlan;
  }

  const metadataPlan = subscription.metadata?.plan;
  if (isPaidPlanKey(metadataPlan || "")) {
    return metadataPlan as PaidPlanKey;
  }

  return fallbackPlan;
}

function getPlanChangeFromInvoice(invoice: Stripe.Invoice) {
  let previousPlan: PaidPlanKey | undefined;
  let previousAmount = 0;
  let targetPlan: PaidPlanKey | undefined;
  let targetAmount = 0;

  for (const line of invoice.lines.data) {
    const plan = getPaidPlanKeyByStripePriceId(getInvoiceLinePriceId(line));
    if (!plan) {
      continue;
    }

    if (line.amount < previousAmount) {
      previousPlan = plan;
      previousAmount = line.amount;
    }

    if (line.amount > targetAmount) {
      targetPlan = plan;
      targetAmount = line.amount;
    }
  }

  return { previousPlan, targetPlan };
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const currentItem = subscription.items.data[0];
  return currentItem?.current_period_end
    ? new Date(currentItem.current_period_end * 1000)
    : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details" || !parent.subscription_details) {
    return null;
  }

  return getStripeSubscriptionId(parent.subscription_details.subscription);
}

function isUpgradableStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  return status === "active" || status === "trialing" || status === "past_due" || status === "unpaid";
}

async function ensureStripeCustomer(user: {
  id: string;
  email: string | null;
  name: string | null;
  stripeCustomerId: string | null;
}) {
  const existingCustomerId = await findExistingStripeCustomerId(user);
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.name || undefined,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

async function findExistingStripeCustomerId(user: {
  id: string;
  email: string | null;
  stripeCustomerId: string | null;
}) {
  const customerIds = await listCandidateStripeCustomerIds(user);
  const customerId = customerIds[0] ?? null;

  if (!customerId) {
    return null;
  }

  if (customerId !== user.stripeCustomerId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  return customerId;
}

async function listCandidateStripeCustomerIds(user: {
  id: string;
  email: string | null;
  stripeCustomerId: string | null;
}) {
  const rankedIds: string[] = [];
  const seen = new Set<string>();

  const pushId = (id: string | null | undefined) => {
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    rankedIds.push(id);
  };

  pushId(user.stripeCustomerId);

  if (!user.email) {
    return rankedIds;
  }

  const stripe = getStripe();
  const customers = await stripe.customers.list({
    email: user.email,
    limit: 10,
  });

  customers.data
    .filter((customer) => customer.metadata?.userId === user.id)
    .forEach((customer) => pushId(customer.id));
  customers.data
    .filter((customer) => customer.email === user.email)
    .forEach((customer) => pushId(customer.id));

  return rankedIds;
}

async function listCandidateSubscriptionIds(userId: string, storedSubscriptionId: string | null) {
  const ids: string[] = [];
  const seen = new Set<string>();

  const pushId = (id: string | null | undefined) => {
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    ids.push(id);
  };

  pushId(storedSubscriptionId);

  const paymentSubscriptions = await prisma.payment.findMany({
    where: {
      userId,
      stripeSubscriptionId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { stripeSubscriptionId: true },
  });

  for (const payment of paymentSubscriptions) {
    pushId(payment.stripeSubscriptionId);
  }

  return ids;
}

async function resolveManagedSubscription(user: {
  id: string;
  email: string | null;
  plan: PlanKey;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  const stripe = getStripe();
  const fallbackPlan = isPaidPlanKey(user.plan) ? user.plan : undefined;
  const candidateSubscriptionIds = await listCandidateSubscriptionIds(
    user.id,
    user.stripeSubscriptionId
  );

  for (const subscriptionId of candidateSubscriptionIds) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (!isUpgradableStripeSubscriptionStatus(subscription.status)) {
        continue;
      }

      await syncSubscriptionState({
        userId: user.id,
        subscription,
        customerId: getStripeCustomerId(subscription.customer),
        fallbackPlan,
      });
      return subscription;
    } catch {
      continue;
    }
  }

  const customerIds = await listCandidateStripeCustomerIds(user);
  if (customerIds.length === 0) {
    return null;
  }

  const matchingSubscriptions: Stripe.Subscription[] = [];
  const activeSubscriptions: Stripe.Subscription[] = [];

  for (const customerId of customerIds) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    for (const subscription of subscriptions.data) {
      if (!isUpgradableStripeSubscriptionStatus(subscription.status)) {
        continue;
      }

      activeSubscriptions.push(subscription);
      if (getPlanFromSubscription(subscription, fallbackPlan) === fallbackPlan) {
        matchingSubscriptions.push(subscription);
      }
    }
  }

  const subscription = matchingSubscriptions[0] ?? activeSubscriptions[0] ?? null;
  if (!subscription) {
    return null;
  }

  await syncSubscriptionState({
    userId: user.id,
    subscription,
    customerId: getStripeCustomerId(subscription.customer),
    fallbackPlan,
  });

  return subscription;
}

async function resolveManagedSchedule(
  subscription: Stripe.Subscription
) {
  const scheduleId = getStripeScheduleId(subscription.schedule);
  if (!scheduleId) {
    return null;
  }

  const stripe = getStripe();
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  if (schedule.status !== "active" && schedule.status !== "not_started") {
    return null;
  }

  return schedule;
}

async function getOrCreateManagedSchedule(subscription: Stripe.Subscription) {
  const existingSchedule = await resolveManagedSchedule(subscription);
  if (existingSchedule) {
    return existingSchedule;
  }

  const stripe = getStripe();
  return stripe.subscriptionSchedules.create({
    from_subscription: subscription.id,
  });
}

async function releaseManagedScheduleIfAny(subscription: Stripe.Subscription) {
  const schedule = await resolveManagedSchedule(subscription);
  if (!schedule) {
    return null;
  }

  const stripe = getStripe();
  return stripe.subscriptionSchedules.release(schedule.id, {
    preserve_cancel_date: false,
  });
}

function getScheduledPlanChange(schedule: Stripe.SubscriptionSchedule, currentPlan: PaidPlanKey) {
  const scheduledPhase = schedule.phases.find((phase) => {
    const phasePlan = getPaidPlanKeyByStripePriceId(getSchedulePhasePriceId(phase));
    return Boolean(
      phasePlan &&
      phasePlan !== currentPlan &&
      phase.start_date > (schedule.current_phase?.start_date ?? 0)
    );
  });

  if (!scheduledPhase) {
    return null;
  }

  const scheduledPlan = getPaidPlanKeyByStripePriceId(getSchedulePhasePriceId(scheduledPhase));
  if (!scheduledPlan) {
    return null;
  }

  return {
    plan: scheduledPlan,
    effectiveDate: new Date(scheduledPhase.start_date * 1000).toISOString(),
  };
}

async function getOrCreateUpgradePortalConfiguration() {
  const stripe = getStripe();
  const priceIds = PAID_PLAN_KEYS.map((planKey) => PLANS[planKey].stripePriceId).filter(
    (value): value is string => Boolean(value)
  );

  if (priceIds.length !== PAID_PLAN_KEYS.length) {
    throw new Error("Les Price IDs Stripe des abonnements sont incomplets");
  }

  const priceSignature = [...priceIds].sort().join(",");
  if (
    upgradePortalConfigurationId &&
    upgradePortalConfigurationSignature === priceSignature
  ) {
    return upgradePortalConfigurationId;
  }

  const existingConfigurations = await stripe.billingPortal.configurations.list({
    limit: 20,
  });

  const reusableConfiguration = existingConfigurations.data.find(
    (configuration) =>
      configuration.active &&
      configuration.metadata?.managedBy === "vocal2cal" &&
      configuration.metadata?.configurationType === "subscription-upgrade" &&
      configuration.metadata?.priceSignature === priceSignature
  );

  if (reusableConfiguration) {
    upgradePortalConfigurationId = reusableConfiguration.id;
    upgradePortalConfigurationSignature = priceSignature;
    return reusableConfiguration.id;
  }

  const prices = await Promise.all(
    priceIds.map((priceId) => stripe.prices.retrieve(priceId))
  );
  const products = new Map<string, string[]>();

  for (const price of prices) {
    const productId = typeof price.product === "string" ? price.product : price.product.id;
    const existingPrices = products.get(productId) ?? [];
    existingPrices.push(price.id);
    products.set(productId, existingPrices);
  }

  const configuration = await stripe.billingPortal.configurations.create({
    name: "Vocal2Cal Upgrade Flow",
    default_return_url: `${getClientUrl()}?billing=return`,
    metadata: {
      managedBy: "vocal2cal",
      configurationType: "subscription-upgrade",
      priceSignature,
    },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_update: {
        enabled: true,
        billing_cycle_anchor: "unchanged",
        default_allowed_updates: ["price"],
        proration_behavior: "always_invoice",
        products: Array.from(products.entries()).map(([product, prices]) => ({
          product,
          prices,
        })),
      },
    },
  });

  upgradePortalConfigurationId = configuration.id;
  upgradePortalConfigurationSignature = priceSignature;
  return configuration.id;
}

function getSubscriptionLineItem(planKey: PaidPlanKey): Stripe.Checkout.SessionCreateParams.LineItem {
  const planConfig = PLANS[planKey];

  if (planConfig.stripePriceId) {
    return {
      price: planConfig.stripePriceId,
      quantity: 1,
    };
  }

  return {
    price_data: {
      currency: "eur",
      recurring: { interval: "month" },
      product_data: {
        name: `Vocal2Cal — ${planConfig.name}`,
        description: planConfig.description,
      },
      unit_amount: planConfig.price,
    },
    quantity: 1,
  };
}

function getTopUpLineItem(packKey: TopUpPackKey): Stripe.Checkout.SessionCreateParams.LineItem {
  const packConfig = TOP_UP_PACKS[packKey];

  return {
    price_data: {
      currency: "eur",
      product_data: {
        name: `Vocal2Cal — ${packConfig.name}`,
        description: `${packConfig.credits} crédits supplémentaires`,
      },
      unit_amount: packConfig.price,
    },
    quantity: 1,
  };
}

async function syncSubscriptionState(params: {
  userId: string;
  subscription: Stripe.Subscription;
  customerId: string | null;
  fallbackPlan?: PaidPlanKey;
}) {
  const { userId, subscription, customerId, fallbackPlan } = params;
  const plan = getPlanFromSubscription(subscription, fallbackPlan);
  const shouldResetPlan =
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired";
  const nextPlan: PlanKey | undefined = plan
    ? shouldResetPlan
      ? "FREE"
      : plan
    : shouldResetPlan
      ? "FREE"
      : undefined;

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: shouldResetPlan ? null : subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
      ...(nextPlan ? { plan: nextPlan } : {}),
    },
  });
}

async function handleTopUpCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  const credits = parseInt(session.metadata?.credits || "0", 10);

  if (!userId || !isPaidPlanKey(plan || "") || credits <= 0) {
    return;
  }
  const planKey = plan as PaidPlanKey;

  const paymentIntentId = getStripePaymentIntentId(session.payment_intent);

  await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.updateMany({
      where: {
        stripeSessionId: session.id,
        status: "pending",
      },
      data: {
        status: "completed",
        stripePaymentId: paymentIntentId,
      },
    });

    if (updatedPayment.count === 0) {
      return;
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        credits: { increment: credits },
        plan: planKey,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "PURCHASE",
        amount: credits,
        balance: updatedUser.credits,
        description: `Recharge ${credits} crédits`,
      },
    });
  });
}

async function handleSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  const subscriptionId = getStripeSubscriptionId(session.subscription);
  const customerId = getStripeCustomerId(session.customer);

  if (!userId || !subscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const fallbackPlan = isPaidPlanKey(plan || "") ? (plan as PaidPlanKey) : undefined;

  await syncSubscriptionState({
    userId,
    subscription,
    customerId,
    fallbackPlan,
  });

  const latestInvoiceId =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;

  if (!latestInvoiceId) {
    return;
  }

  const latestInvoice = await stripe.invoices.retrieve(latestInvoiceId);
  if (latestInvoice.status === "paid") {
    await handleInvoicePaid(latestInvoice);
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const customerId = getStripeCustomerId(invoice.customer);

  if (!subscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;
  const plan = getPlanFromSubscription(subscription);

  if (!userId || !plan) {
    return;
  }
  const planKey = plan;
  const credits = PLANS[planKey].credits;
  const isPlanChangeInvoice = invoice.billing_reason === "subscription_update";

  await prisma.$transaction(async (tx) => {
    const existingPayment = await tx.payment.findUnique({
      where: { stripeInvoiceId: invoice.id },
      select: { id: true },
    });

    if (existingPayment) {
      return;
    }

    if (isPlanChangeInvoice) {
      const { previousPlan, targetPlan } = getPlanChangeFromInvoice(invoice);
      const nextPlan = targetPlan ?? planKey;
      const addedCredits = previousPlan ? getPlanCreditDelta(previousPlan, nextPlan) : 0;
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          plan: nextPlan,
          ...(addedCredits > 0 ? { credits: { increment: addedCredits } } : {}),
          ...(customerId ? { stripeCustomerId: customerId } : {}),
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
        },
      });

      await tx.payment.create({
        data: {
          userId,
          kind: "SUBSCRIPTION",
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subscription.id,
          plan: nextPlan,
          amount: invoice.amount_paid || invoice.amount_due || 0,
          creditsGranted: addedCredits,
          status: "completed",
        },
      });

      if (addedCredits > 0 && previousPlan && previousPlan !== nextPlan) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type: "PURCHASE",
            amount: addedCredits,
            balance: updatedUser.credits,
            description: `Upgrade ${PLANS[previousPlan].name} -> ${PLANS[nextPlan].name} — +${addedCredits} crédits`,
          },
        });
      }

      return;
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        credits: { increment: credits },
        plan: planKey,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
      },
    });

    await tx.payment.create({
      data: {
        userId,
        kind: "SUBSCRIPTION",
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscription.id,
        plan: planKey,
        amount: invoice.amount_paid || invoice.amount_due || PLANS[planKey].price,
        creditsGranted: credits,
        status: "completed",
      },
    });

    const isInitialInvoice = invoice.billing_reason === "subscription_create";

    await tx.creditTransaction.create({
      data: {
        userId,
        type: isInitialInvoice ? "PURCHASE" : "SUBSCRIPTION_RENEWAL",
        amount: credits,
        balance: updatedUser.credits,
        description: `${isInitialInvoice ? "Activation" : "Renouvellement"} ${PLANS[planKey].name} — ${credits} crédits`,
      },
    });
  });
}

async function handleSubscriptionLifecycle(subscription: Stripe.Subscription) {
  const customerId = getStripeCustomerId(subscription.customer);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: { id: true },
  });

  if (!user) {
    return;
  }

  await syncSubscriptionState({
    userId: user.id,
    subscription,
    customerId,
    fallbackPlan: undefined,
  });
}

// POST /api/stripe/checkout — Create a Stripe Checkout Session
router.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { plan, topUpPack } = req.body as { plan?: string; topUpPack?: string };

  if ((plan && topUpPack) || (!plan && !topUpPack)) {
    res.status(400).json({ error: "Choix de paiement invalide" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        credits: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    const customerId = await ensureStripeCustomer(user);
    const stripe = getStripe();
    const clientUrl = getClientUrl();
    const managedSubscription = await resolveManagedSubscription({
      id: user.id,
      email: user.email,
      plan: user.plan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    });

    if (plan) {
      if (!isPaidPlanKey(plan)) {
        res.status(400).json({ error: "Plan invalide" });
        return;
      }

      if (managedSubscription && isUpgradableStripeSubscriptionStatus(managedSubscription.status)) {
        res.status(409).json({ error: "Un abonnement actif existe déjà" });
        return;
      }

      const planConfig = PLANS[plan];
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [getSubscriptionLineItem(plan)],
        metadata: {
          purchaseType: "subscription",
          userId: user.id,
          plan,
          credits: String(planConfig.credits),
        },
        subscription_data: {
          metadata: {
            purchaseType: "subscription",
            userId: user.id,
            plan,
            credits: String(planConfig.credits),
          },
        },
        success_url: `${clientUrl}?payment=success&type=subscription&plan=${plan}`,
        cancel_url: `${clientUrl}?payment=cancel`,
      });

      res.json({ url: session.url });
      return;
    }

    if (!isTopUpPackKey(topUpPack!)) {
      res.status(400).json({ error: "Recharge invalide" });
      return;
    }

    if (!isSubscriptionActiveStatus(user.subscriptionStatus) || user.plan === "FREE") {
      res.status(403).json({ error: "Les recharges sont réservées aux abonnés actifs" });
      return;
    }

    if (user.credits > 0) {
      res.status(409).json({ error: "Les recharges sont disponibles une fois le solde à zéro" });
      return;
    }

    const packConfig = TOP_UP_PACKS[topUpPack];
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [getTopUpLineItem(topUpPack)],
      metadata: {
        purchaseType: "topup",
        userId: user.id,
        plan: user.plan,
        topUpPack,
        credits: String(packConfig.credits),
      },
      success_url: `${clientUrl}?payment=success&type=topup&pack=${topUpPack}`,
      cancel_url: `${clientUrl}?payment=cancel`,
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        kind: "TOP_UP",
        stripeSessionId: session.id,
        plan: user.plan as PlanKey,
        amount: packConfig.price,
        creditsGranted: packConfig.credits,
        status: "pending",
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe checkout:", error);
    res.status(500).json({ error: "Impossible de créer la session de paiement" });
  }
});

// POST /api/stripe/change-plan — Open a Stripe confirmation flow for an upgrade
router.post("/change-plan", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { targetPlan } = req.body as { targetPlan?: string };

  if (!targetPlan || !isPaidPlanKey(targetPlan)) {
    res.status(400).json({ error: "Plan cible invalide" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        credits: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    if (!isPaidPlanKey(user.plan)) {
      res.status(409).json({ error: "Aucun abonnement actif modifiable" });
      return;
    }

    if (user.plan === targetPlan) {
      res.status(400).json({ error: "Vous êtes déjà sur ce plan" });
      return;
    }

    if (!isUpgradePlan(user.plan, targetPlan)) {
      res.status(400).json({ error: "Les changements vers un plan inférieur se planifient depuis l'application" });
      return;
    }

    const targetPriceId = PLANS[targetPlan].stripePriceId;
    if (!targetPriceId) {
      res.status(500).json({ error: "Prix Stripe manquant pour ce plan" });
      return;
    }

    const currentSubscription = await resolveManagedSubscription(user);
    if (!currentSubscription || !isUpgradableStripeSubscriptionStatus(currentSubscription.status)) {
      res.status(409).json({ error: "Aucun abonnement actif modifiable" });
      return;
    }

    const currentItem = currentSubscription.items.data[0];

    if (!currentItem) {
      res.status(404).json({ error: "Aucun item d'abonnement Stripe trouvé" });
      return;
    }

    const stripe = getStripe();
    const customerId = getStripeCustomerId(currentSubscription.customer) || user.stripeCustomerId;
    if (!customerId) {
      res.status(404).json({ error: "Aucun compte Stripe lié" });
      return;
    }

    const portalConfigurationId = await getOrCreateUpgradePortalConfiguration();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: portalConfigurationId,
      return_url: `${getClientUrl()}?billing=return`,
      flow_data: {
        type: "subscription_update_confirm",
        after_completion: {
          type: "redirect",
          redirect: {
            return_url: `${getClientUrl()}?billing=updated&plan=${targetPlan}`,
          },
        },
        subscription_update_confirm: {
          subscription: currentSubscription.id,
          items: [
            {
              id: currentItem.id,
              price: targetPriceId,
            },
          ],
        },
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur changement de plan Stripe:", error);

    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "Impossible de changer de plan" });
  }
});

// GET /api/stripe/subscription-state — Resolve live Stripe subscription management state
router.get("/subscription-state", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    const currentPlan = isPaidPlanKey(user.plan) ? user.plan : null;
    if (!currentPlan) {
      res.json({
        hasManagedSubscription: false,
        currentPlan: user.plan,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        scheduledPlan: null,
        scheduledPlanEffectiveDate: null,
      });
      return;
    }

    const subscription = await resolveManagedSubscription(user);
    if (!subscription) {
      res.json({
        hasManagedSubscription: false,
        currentPlan,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        scheduledPlan: null,
        scheduledPlanEffectiveDate: null,
      });
      return;
    }

    const schedule = await resolveManagedSchedule(subscription);
    const scheduledChange = schedule ? getScheduledPlanChange(schedule, currentPlan) : null;

    res.json({
      hasManagedSubscription: true,
      currentPlan,
      status: subscription.status,
      currentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription)?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      scheduledPlan: scheduledChange?.plan ?? null,
      scheduledPlanEffectiveDate: scheduledChange?.effectiveDate ?? null,
    });
  } catch (error) {
    console.error("Erreur récupération état abonnement Stripe:", error);
    res.status(500).json({ error: "Impossible de récupérer l'état de l'abonnement" });
  }
});

// POST /api/stripe/schedule-plan-change — Schedule a downgrade for the next billing cycle
router.post("/schedule-plan-change", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { targetPlan } = req.body as { targetPlan?: string };

  if (!targetPlan || !isPaidPlanKey(targetPlan)) {
    res.status(400).json({ error: "Plan cible invalide" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user || !isPaidPlanKey(user.plan)) {
      res.status(409).json({ error: "Aucun abonnement actif modifiable" });
      return;
    }

    if (user.plan === targetPlan) {
      res.status(400).json({ error: "Vous êtes déjà sur ce plan" });
      return;
    }

    if (isUpgradePlan(user.plan, targetPlan)) {
      res.status(400).json({ error: "Utilisez l'upgrade immédiat pour un plan supérieur" });
      return;
    }

    const currentSubscription = await resolveManagedSubscription(user);
    if (!currentSubscription || !isUpgradableStripeSubscriptionStatus(currentSubscription.status)) {
      res.status(409).json({ error: "Aucun abonnement Stripe actif à planifier" });
      return;
    }

    const currentItem = currentSubscription.items.data[0];
    const currentPriceId = getStripePriceId(currentItem?.price);
    const targetPriceId = PLANS[targetPlan].stripePriceId;
    const currentPeriodEnd = currentItem?.current_period_end;
    const currentPeriodStart = currentItem?.current_period_start;

    if (!currentItem || !currentPriceId || !targetPriceId || !currentPeriodEnd || !currentPeriodStart) {
      res.status(400).json({ error: "Impossible de planifier ce changement pour le moment" });
      return;
    }

    if (currentSubscription.cancel_at_period_end) {
      const stripe = getStripe();
      await stripe.subscriptions.update(currentSubscription.id, {
        cancel_at_period_end: false,
      });
    }

    const schedule = await getOrCreateManagedSchedule(currentSubscription);
    const stripe = getStripe();
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "renew",
      proration_behavior: "none",
      phases: [
        {
          start_date: currentPeriodStart,
          end_date: currentPeriodEnd,
          items: [
            {
              price: currentPriceId,
              quantity: currentItem.quantity ?? 1,
            },
          ],
          metadata: getSubscriptionMetadata(user.id, user.plan),
        },
        {
          start_date: currentPeriodEnd,
          duration: { interval: "month", interval_count: 1 },
          items: [
            {
              price: targetPriceId,
              quantity: currentItem.quantity ?? 1,
            },
          ],
          metadata: getSubscriptionMetadata(user.id, targetPlan),
        },
      ],
    });

    res.json({
      success: true,
      scheduledPlan: targetPlan,
      effectiveDate: new Date(currentPeriodEnd * 1000).toISOString(),
      message: `Votre plan ${PLANS[user.plan].name} reste actif jusqu'au ${new Date(currentPeriodEnd * 1000).toLocaleDateString("fr-FR")}. Ensuite, Stripe basculera automatiquement sur ${PLANS[targetPlan].name}.`,
    });
  } catch (error) {
    console.error("Erreur planification changement de plan Stripe:", error);
    const message = error instanceof Error ? error.message : "Impossible de planifier le changement de plan";
    res.status(500).json({ error: message });
  }
});

// POST /api/stripe/clear-scheduled-plan-change — Remove a pending downgrade and keep the current plan
router.post("/clear-scheduled-plan-change", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user || !isPaidPlanKey(user.plan)) {
      res.status(409).json({ error: "Aucun abonnement actif modifiable" });
      return;
    }

    const currentSubscription = await resolveManagedSubscription(user);
    if (!currentSubscription) {
      res.status(409).json({ error: "Aucun abonnement Stripe actif à modifier" });
      return;
    }

    const releasedSchedule = await releaseManagedScheduleIfAny(currentSubscription);
    if (!releasedSchedule) {
      res.status(404).json({ error: "Aucun changement planifié à annuler" });
      return;
    }

    res.json({
      success: true,
      message: `Le changement planifié a été annulé. Votre plan ${PLANS[user.plan].name} continuera à se renouveler normalement.`,
    });
  } catch (error) {
    console.error("Erreur annulation changement planifié Stripe:", error);
    const message = error instanceof Error ? error.message : "Impossible d'annuler le changement planifié";
    res.status(500).json({ error: message });
  }
});

// POST /api/stripe/cancel-subscription — Schedule cancellation at period end
router.post("/cancel-subscription", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user || !isPaidPlanKey(user.plan)) {
      res.status(409).json({ error: "Aucun abonnement actif à résilier" });
      return;
    }

    const currentSubscription = await resolveManagedSubscription(user);
    if (!currentSubscription || !isUpgradableStripeSubscriptionStatus(currentSubscription.status)) {
      res.status(409).json({ error: "Aucun abonnement Stripe actif à résilier" });
      return;
    }

    await releaseManagedScheduleIfAny(currentSubscription);

    const stripe = getStripe();
    const updatedSubscription = await stripe.subscriptions.update(currentSubscription.id, {
      cancel_at_period_end: true,
    });

    await syncSubscriptionState({
      userId: user.id,
      subscription: updatedSubscription,
      customerId: getStripeCustomerId(updatedSubscription.customer),
      fallbackPlan: user.plan,
    });

    const endDate = getSubscriptionCurrentPeriodEnd(updatedSubscription)?.toISOString() ?? null;
    res.json({
      success: true,
      currentPeriodEnd: endDate,
      message: endDate
        ? `Votre abonnement restera actif jusqu'au ${new Date(endDate).toLocaleDateString("fr-FR")}, puis il s'arrêtera automatiquement.`
        : "Votre résiliation a bien été programmée en fin de période.",
    });
  } catch (error) {
    console.error("Erreur résiliation abonnement Stripe:", error);
    const message = error instanceof Error ? error.message : "Impossible de programmer la résiliation";
    res.status(500).json({ error: message });
  }
});

// POST /api/stripe/resume-subscription — Undo a cancellation scheduled for period end
router.post("/resume-subscription", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user || !isPaidPlanKey(user.plan)) {
      res.status(409).json({ error: "Aucun abonnement actif à reprendre" });
      return;
    }

    const currentSubscription = await resolveManagedSubscription(user);
    if (!currentSubscription) {
      res.status(409).json({ error: "Aucun abonnement Stripe actif à reprendre" });
      return;
    }

    const stripe = getStripe();
    const updatedSubscription = await stripe.subscriptions.update(currentSubscription.id, {
      cancel_at_period_end: false,
    });

    await syncSubscriptionState({
      userId: user.id,
      subscription: updatedSubscription,
      customerId: getStripeCustomerId(updatedSubscription.customer),
      fallbackPlan: user.plan,
    });

    res.json({
      success: true,
      message: "La résiliation planifiée a été retirée. Votre abonnement continuera normalement.",
    });
  } catch (error) {
    console.error("Erreur reprise abonnement Stripe:", error);
    const message = error instanceof Error ? error.message : "Impossible de reprendre l'abonnement";
    res.status(500).json({ error: message });
  }
});

// POST /api/stripe/portal — Open Stripe Billing Portal
router.post("/portal", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
      },
    });

    const customerId = user ? await findExistingStripeCustomerId(user) : null;
    if (!customerId) {
      res.status(404).json({ error: "Aucun compte Stripe lié" });
      return;
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getClientUrl()}?billing=return`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe portal:", error);
    res.status(500).json({ error: "Impossible d'ouvrir le portail Stripe" });
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

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).send("Webhook signature invalide");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const purchaseType = session.metadata?.purchaseType;

      if (purchaseType === "subscription") {
        await handleSubscriptionCheckoutCompleted(session);
      } else if (purchaseType === "topup") {
        await handleTopUpCheckoutCompleted(session);
      }
    }

    if (event.type === "invoice.paid") {
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await handleSubscriptionLifecycle(event.data.object as Stripe.Subscription);
    }
  } catch (error) {
    console.error("Erreur traitement webhook Stripe:", error);
  }

  res.json({ received: true });
});

// GET /api/stripe/plans — Public pricing info
router.get("/plans", (_req: Request, res: Response) => {
  const subscriptions = Object.entries(PLANS).map(([key, config]) => ({
    id: key,
    name: config.name,
    price: config.price,
    credits: config.credits,
    description: config.description,
  }));

  const topUps = Object.entries(TOP_UP_PACKS).map(([key, config]) => ({
    id: key,
    name: config.name,
    price: config.price,
    credits: config.credits,
    description: config.description,
  }));

  res.json({ subscriptions, topUps });
});

export default router;
