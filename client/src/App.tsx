import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { History } from "@/components/History";
import { UsageBar } from "@/components/UsageBar";
import { AdminPanel } from "@/components/AdminPanel";
import type { SubscriptionManagementData, UsageData } from "@/types";

const smoothEase = [0.22, 1, 0.36, 1] as const;
const dashboardHighlights = [
  {
    title: "Dictée naturelle",
    value: "1 phrase",
    description: "Décrivez plusieurs rendez-vous dans la même demande.",
    icon: "M12 18h.01M8 21h8a2 2 0 002-2v-1.126a1 1 0 01.553-.894l3.618-1.809A2 2 0 0015 13.382V8.618a2 2 0 00-1.106-1.789l-3.618-1.809A1 1 0 019 4.126V3a2 2 0 00-2-2H5a2 2 0 00-2 2v1.126a1 1 0 01-.553.894l-.447.223A2 2 0 001 7.03v9.94a2 2 0 001.106 1.789l.447.223A1 1 0 013 19.874V21a2 2 0 002 2h2a2 2 0 002-2z",
  },
  {
    title: "Ajout agenda",
    value: "Google",
    description: "Les événements créés partent directement dans votre calendrier principal.",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    title: "Traçabilité",
    value: "Historique",
    description: "Retrouvez vos dernières dictées et les créneaux générés juste à côté.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

const dashboardSteps = [
  {
    title: "Dictez comme vous parlez",
    description: "Exemple : réunion mardi 9h, dentiste jeudi 17h30.",
  },
  {
    title: "Vérifiez la transcription",
    description: "La phrase reconnue reste visible avant l'envoi.",
  },
  {
    title: "Confirmez puis contrôlez l'historique",
    description: "Le panneau de droite vous permet de revoir chaque événement créé.",
  },
];

const landingExamples = [
  {
    id: "01",
    eyebrow: "Demain",
    text: "Coiffeur à 14h",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    id: "02",
    eyebrow: "Semaine",
    text: "Réunion lundi 9h et dentiste mardi 16h30",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    id: "03",
    eyebrow: "Naturel",
    text: "Plusieurs événements en une seule phrase",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
];

const landingSignals = [
  { value: "1 phrase", label: "peut suffire pour plusieurs événements" },
  { value: "Google", label: "synchronisation directe à l'agenda" },
  { value: "Instantané", label: "relecture rapide avant validation" },
];

const PLAN_LABELS = {
  FREE: "Découverte",
  STARTER: "Starter",
  PRO: "Pro",
  BUSINESS: "Business",
} as const;

const PLAN_TIERS = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  BUSINESS: 3,
} as const;

const PRICING_PLANS = [
  { id: "FREE", name: "Découverte", price: "0€", period: "", credits: "5 crédits", desc: "Offerts à l'inscription", popular: false },
  { id: "STARTER", name: "Starter", price: "4,99€", period: "/mois", credits: "60 crédits", desc: "Pour rester léger, sans exploser le budget", popular: false },
  { id: "PRO", name: "Pro", price: "9,99€", period: "/mois", credits: "180 crédits", desc: "Le meilleur équilibre entre volume et prix", popular: true },
  { id: "BUSINESS", name: "Business", price: "19,99€", period: "/mois", credits: "600 crédits", desc: "Pensé pour un usage intensif toute l'année", popular: false },
] as const;

const TOP_UP_PACKS = [
  { id: "BOOST_20", name: "Boost 20", price: "1,99€", credits: "20 crédits", desc: "Petit appoint pour terminer le mois sans changer d'offre" },
  { id: "BOOST_80", name: "Boost 80", price: "6,99€", credits: "80 crédits", desc: "Recharge souple, volontairement moins rentable qu'un abonnement" },
  { id: "BOOST_200", name: "Boost 200", price: "17,99€", credits: "200 crédits", desc: "Gros appoint ponctuel, utile si vous êtes déjà abonné" },
] as const;

type AppView = "home" | "dashboard" | "pricing" | "settings" | "admin";

const baseViewTabs: Array<{ id: AppView; label: string; icon: string }> = [
  {
    id: "home",
    label: "Accueil",
    icon: "M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "M3 13h8V3H3v10zm10 8h8V3h-8v18zm-10 0h8v-6H3v6z",
  },
  {
    id: "pricing",
    label: "Tarifs",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    id: "settings",
    label: "Réglages",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
];

const adminTab: { id: AppView; label: string; icon: string } = {
  id: "admin",
  label: "Admin",
  icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

const SWIPE_DISTANCE_THRESHOLD = 96;
const SWIPE_VELOCITY_THRESHOLD = 650;
const WHEEL_SWIPE_THRESHOLD = 140;
const WHEEL_RESET_DELAY_MS = 180;
const SWIPE_COOLDOWN_MS = 420;

const pageVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.3 },
  },
};

const staggerContainer = {
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: smoothEase },
  },
};

const panelVariants = {
  initial: { opacity: 0, y: 18, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    y: -14,
    scale: 0.98,
    transition: { duration: 0.2, ease: smoothEase },
  },
};

const rotatingPhrases = [
  "à la voix",
  "en une phrase",
  "sans formulaire",
];

function formatFrenchDate(date: string | null) {
  if (!date) {
    return null;
  }

  return new Date(date).toLocaleDateString("fr-FR");
}

function getPlanLabel(planId: string | null) {
  if (!planId) {
    return null;
  }

  return PLAN_LABELS[planId as keyof typeof PLAN_LABELS] || planId;
}

function getPlanDisplay(planId: string | null) {
  if (!planId) {
    return null;
  }

  return PRICING_PLANS.find((plan) => plan.id === planId) ?? null;
}

function useRotatingTypewriter(phrases: string[], typeSpeed = 70, eraseSpeed = 40, startDelay = 600, holdDelay = 2200) {
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let phase: "waiting" | "typing" | "holding" | "erasing" = "waiting";
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function tick() {
      const current = phrases[phraseIndex];

      if (phase === "waiting") {
        phase = "typing";
        setIsTyping(true);
        timeoutId = setTimeout(tick, startDelay);
      } else if (phase === "typing") {
        if (charIndex <= current.length) {
          setDisplayed(current.slice(0, charIndex));
          charIndex++;
          timeoutId = setTimeout(tick, typeSpeed);
        } else {
          phase = "holding";
          setIsTyping(false);
          timeoutId = setTimeout(tick, holdDelay);
        }
      } else if (phase === "holding") {
        phase = "erasing";
        setIsTyping(true);
        charIndex = current.length;
        timeoutId = setTimeout(tick, eraseSpeed);
      } else if (phase === "erasing") {
        if (charIndex > 0) {
          charIndex--;
          setDisplayed(current.slice(0, charIndex));
          timeoutId = setTimeout(tick, eraseSpeed);
        } else {
          phraseIndex = (phraseIndex + 1) % phrases.length;
          charIndex = 0;
          phase = "typing";
          timeoutId = setTimeout(tick, 300);
        }
      }
    }

    tick();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [phrases, typeSpeed, eraseSpeed, startDelay, holdDelay]);

  return { displayed, isTyping };
}

export default function App() {
  const { user, status, signIn, signOut } = useAuth();
  const [usageRefresh, setUsageRefresh] = useState(0);
  const [activeView, setActiveView] = useState<AppView>("home");
  const [swipeHint, setSwipeHint] = useState<string | null>(null);
  const [accountUsage, setAccountUsage] = useState<UsageData | null>(null);
  const [subscriptionManagement, setSubscriptionManagement] = useState<SubscriptionManagementData | null>(null);
  const [checkoutTargetId, setCheckoutTargetId] = useState<string | null>(null);
  const [pendingPlanSelection, setPendingPlanSelection] = useState<string | null>(null);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const { displayed: typedText, isTyping } = useRotatingTypewriter(rotatingPhrases);
  const viewTabs = user?.role === "ADMIN" ? [...baseViewTabs, adminTab] : baseViewTabs;
  const wheelDeltaRef = useRef(0);
  const wheelResetTimeoutRef = useRef<number | null>(null);
  const swipeCooldownTimeoutRef = useRef<number | null>(null);
  const swipeHintTimeoutRef = useRef<number | null>(null);
  const swipeLockedRef = useRef(false);
  const activePlanId = accountUsage?.plan ?? user?.plan ?? "FREE";
  const activePlanLabel = PLAN_LABELS[activePlanId as keyof typeof PLAN_LABELS] || activePlanId;
  const availableCredits = accountUsage?.credits ?? user?.credits ?? 0;
  const hasActiveSubscription = accountUsage?.subscription.isActive ?? false;
  const hasPaidPlan = activePlanId !== "FREE";
  const isEffectivelySubscribed = hasActiveSubscription || hasPaidPlan;
  const canBuyTopUp = accountUsage?.canBuyTopUp ?? false;
  const subscriptionPeriodEnd = accountUsage?.subscription.currentPeriodEnd;
  const managedPeriodEnd = subscriptionManagement?.currentPeriodEnd ?? subscriptionPeriodEnd;
  const managedPeriodEndLabel = formatFrenchDate(managedPeriodEnd ?? null);
  const scheduledPlanId = subscriptionManagement?.scheduledPlan ?? null;
  const scheduledPlanLabel = getPlanLabel(scheduledPlanId);
  const scheduledPlanEffectiveDate = subscriptionManagement?.scheduledPlanEffectiveDate ?? managedPeriodEnd;
  const scheduledPlanEffectiveLabel = formatFrenchDate(scheduledPlanEffectiveDate ?? null);
  const pendingPlanDisplay = getPlanDisplay(pendingPlanSelection);
  const cancelAtPeriodEnd = subscriptionManagement?.cancelAtPeriodEnd ?? false;
  const hasManagedSubscription = subscriptionManagement?.hasManagedSubscription ?? false;
  const creditAccentClass =
    availableCredits <= 2
      ? "text-red-300"
      : availableCredits <= 10
        ? "text-amber-200"
        : "text-cyan-100";

  useEffect(() => {
    if (!user) {
      setActiveView("home");
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get("payment");
    const paymentType = params.get("type");
    const purchasedPlan = params.get("plan");
    const purchasedPack = params.get("pack");
    const billingState = params.get("billing");
    const upgradedPlan = params.get("plan");
    const refreshTimeouts: number[] = [];

    const scheduleUsageRefresh = () => {
      setUsageRefresh((value) => value + 1);
      refreshTimeouts.push(
        window.setTimeout(() => setUsageRefresh((value) => value + 1), 1500)
      );
      refreshTimeouts.push(
        window.setTimeout(() => setUsageRefresh((value) => value + 1), 4500)
      );
    };

    if (paymentState === "success") {
      if (paymentType === "subscription") {
        const planName = purchasedPlan && purchasedPlan in PLAN_LABELS
          ? PLAN_LABELS[purchasedPlan as keyof typeof PLAN_LABELS]
          : "votre abonnement";
        setBillingSuccess(`${planName} activé. Les crédits du cycle sont en cours de synchronisation.`);
        setPendingPlanSelection(null);
        setActiveView("settings");
        scheduleUsageRefresh();
      } else if (paymentType === "topup") {
        const packName = TOP_UP_PACKS.find((pack) => pack.id === purchasedPack)?.name || "La recharge";
        setBillingSuccess(`${packName} confirmée. Le solde est en cours de mise à jour.`);
        setActiveView("settings");
        scheduleUsageRefresh();
      }

      params.delete("payment");
      params.delete("type");
      params.delete("plan");
      params.delete("pack");
    } else if (paymentState === "cancel") {
      setBillingError("Paiement annulé.");
      params.delete("payment");
    }

    if (billingState === "updated") {
      const planName = upgradedPlan && upgradedPlan in PLAN_LABELS
        ? PLAN_LABELS[upgradedPlan as keyof typeof PLAN_LABELS]
        : "votre nouveau plan";
      setBillingSuccess(`${planName} activé. Stripe a confirmé le prorata du mois en cours.`);
      setCancelConfirmationOpen(false);
      setPendingPlanSelection(null);
      setActiveView("settings");
      scheduleUsageRefresh();
      params.delete("billing");
      params.delete("plan");
    } else if (billingState === "scheduled") {
      const planName = upgradedPlan && upgradedPlan in PLAN_LABELS
        ? PLAN_LABELS[upgradedPlan as keyof typeof PLAN_LABELS]
        : "votre prochain plan";
      setBillingSuccess(`${planName} est maintenant planifié pour la prochaine échéance Stripe.`);
      setCancelConfirmationOpen(false);
      setPendingPlanSelection(null);
      setActiveView("settings");
      scheduleUsageRefresh();
      params.delete("billing");
      params.delete("plan");
    } else if (billingState === "canceled") {
      setBillingSuccess("La résiliation est programmée. Votre abonnement reste actif jusqu'à la fin du cycle en cours.");
      setCancelConfirmationOpen(false);
      setActiveView("settings");
      scheduleUsageRefresh();
      params.delete("billing");
    }

    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
    );

    return () => {
      refreshTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setAccountUsage(null);
      setSubscriptionManagement(null);
      return;
    }

    let isMounted = true;

    Promise.all([
      fetch("/api/usage", { credentials: "include" })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch("/api/stripe/subscription-state", { credentials: "include" })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]).then(([usageData, subscriptionData]: [UsageData | null, SubscriptionManagementData | null]) => {
      if (!isMounted) {
        return;
      }

      if (usageData && typeof usageData.credits === "number") {
        setAccountUsage(usageData);
      }

      setSubscriptionManagement(subscriptionData);
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id, usageRefresh]);

  useEffect(() => {
    return () => {
      if (wheelResetTimeoutRef.current) {
        window.clearTimeout(wheelResetTimeoutRef.current);
      }
      if (swipeCooldownTimeoutRef.current) {
        window.clearTimeout(swipeCooldownTimeoutRef.current);
      }
      if (swipeHintTimeoutRef.current) {
        window.clearTimeout(swipeHintTimeoutRef.current);
      }
    };
  }, []);

  const showSwipeHint = (label: string) => {
    setSwipeHint(label);
    if (swipeHintTimeoutRef.current) {
      window.clearTimeout(swipeHintTimeoutRef.current);
    }
    swipeHintTimeoutRef.current = window.setTimeout(() => {
      setSwipeHint(null);
      swipeHintTimeoutRef.current = null;
    }, 900);
  };

  const setViewFromSwipe = (direction: "left" | "right") => {
    if (swipeLockedRef.current) {
      return;
    }

    const currentIndex = viewTabs.findIndex((t) => t.id === activeView);
    if (currentIndex === -1) return;

    const nextIndex = direction === "right" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= viewTabs.length) return;

    setActiveView(viewTabs[nextIndex].id);
    showSwipeHint(viewTabs[nextIndex].label);

    swipeLockedRef.current = true;
    if (swipeCooldownTimeoutRef.current) {
      window.clearTimeout(swipeCooldownTimeoutRef.current);
    }
    swipeCooldownTimeoutRef.current = window.setTimeout(() => {
      swipeLockedRef.current = false;
      swipeCooldownTimeoutRef.current = null;
    }, SWIPE_COOLDOWN_MS);
  };

  const resetWheelSwipe = () => {
    wheelDeltaRef.current = 0;
    if (wheelResetTimeoutRef.current) {
      window.clearTimeout(wheelResetTimeoutRef.current);
      wheelResetTimeoutRef.current = null;
    }
  };

  const handleLoggedInPanEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const horizontalDistance = Math.abs(info.offset.x);
    const verticalDistance = Math.abs(info.offset.y);
    const horizontalVelocity = Math.abs(info.velocity.x);

    if (horizontalDistance <= verticalDistance * 1.15) {
      return;
    }

    if (
      horizontalDistance < SWIPE_DISTANCE_THRESHOLD &&
      horizontalVelocity < SWIPE_VELOCITY_THRESHOLD
    ) {
      return;
    }

    setViewFromSwipe(info.offset.x > 0 ? "right" : "left");
  };

  const handleLoggedInWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 10) {
      return;
    }

    wheelDeltaRef.current += event.deltaX;

    if (wheelResetTimeoutRef.current) {
      window.clearTimeout(wheelResetTimeoutRef.current);
    }
    wheelResetTimeoutRef.current = window.setTimeout(() => {
      resetWheelSwipe();
    }, WHEEL_RESET_DELAY_MS);

    if (Math.abs(wheelDeltaRef.current) < WHEEL_SWIPE_THRESHOLD) {
      return;
    }

    const direction = wheelDeltaRef.current < 0 ? "right" : "left";
    resetWheelSwipe();
    setViewFromSwipe(direction);
  };

  const handleCheckout = async (options: { planId?: string; topUpPackId?: string }) => {
    if (checkoutTargetId) {
      return;
    }

    const targetId = options.planId ? `plan:${options.planId}` : `topup:${options.topUpPackId}`;
    setBillingError(null);
    setBillingSuccess(null);
    setCheckoutTargetId(targetId);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          options.planId
            ? { plan: options.planId }
            : { topUpPack: options.topUpPackId }
        ),
      });

      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.error) {
        setBillingError(data.error);
      }
    } catch {
      setBillingError("Impossible de lancer Stripe pour le moment");
    }

    setCheckoutTargetId(null);
  };

  const handleManageSubscription = async () => {
    if (checkoutTargetId) {
      return;
    }

    setBillingError(null);
    setBillingSuccess(null);
    setCheckoutTargetId("portal");

    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.error) {
        setBillingError(data.error);
      }
    } catch {
      setBillingError("Impossible d'ouvrir le portail Stripe");
    }

    setCheckoutTargetId(null);
  };

  const handleChangePlan = async (targetPlanId: string) => {
    if (checkoutTargetId) {
      return;
    }

    setBillingError(null);
    setBillingSuccess(null);
    setCheckoutTargetId(`change:${targetPlanId}`);

    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetPlan: targetPlanId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (!res.ok) {
        setBillingError(data.error || "Impossible de changer de plan");
      }
    } catch {
      setBillingError("Impossible de changer de plan");
    } finally {
      setCheckoutTargetId(null);
    }
  };

  const handlePrepareScheduledPlanChange = (targetPlanId: string) => {
    setBillingError(null);
    setBillingSuccess(null);
    setPendingPlanSelection(targetPlanId);
  };

  const handleSchedulePlanChange = async (targetPlanId: string) => {
    if (checkoutTargetId) {
      return;
    }

    setBillingError(null);
    setBillingSuccess(null);
    setCheckoutTargetId(`schedule:${targetPlanId}`);

    try {
      const res = await fetch("/api/stripe/schedule-plan-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetPlan: targetPlanId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBillingError(data.error || "Impossible de planifier ce changement");
        return;
      }

      setBillingSuccess(data.message || "Changement de plan programmé.");
      setPendingPlanSelection(null);
      setUsageRefresh((value) => value + 1);
      setActiveView("settings");
    } catch {
      setBillingError("Impossible de planifier ce changement");
    } finally {
      setCheckoutTargetId(null);
    }
  };

  const handleClearScheduledPlanChange = async () => {
    if (checkoutTargetId) {
      return;
    }

    setBillingError(null);
    setBillingSuccess(null);
    setCheckoutTargetId("clear-scheduled-plan");

    try {
      const res = await fetch("/api/stripe/clear-scheduled-plan-change", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBillingError(data.error || "Impossible d'annuler le changement planifié");
        return;
      }

      setBillingSuccess(data.message || "Changement planifié annulé.");
      setPendingPlanSelection(null);
      setUsageRefresh((value) => value + 1);
      setActiveView("settings");
    } catch {
      setBillingError("Impossible d'annuler le changement planifié");
    } finally {
      setCheckoutTargetId(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (checkoutTargetId) {
      return;
    }

    setBillingError(null);
    setBillingSuccess(null);
    setPendingPlanSelection(null);
    setCancelConfirmationOpen(false);
    setCheckoutTargetId("cancel-subscription");

    try {
      const res = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBillingError(data.error || "Impossible de programmer la résiliation");
        return;
      }

      setBillingSuccess(data.message || "Résiliation programmée.");
      setUsageRefresh((value) => value + 1);
      setActiveView("settings");
    } catch {
      setBillingError("Impossible de programmer la résiliation");
    } finally {
      setCheckoutTargetId(null);
    }
  };

  const handleResumeSubscription = async () => {
    if (checkoutTargetId) {
      return;
    }

    setBillingError(null);
    setBillingSuccess(null);
    setPendingPlanSelection(null);
    setCancelConfirmationOpen(false);
    setCheckoutTargetId("resume-subscription");

    try {
      const res = await fetch("/api/stripe/resume-subscription", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBillingError(data.error || "Impossible de reprendre l'abonnement");
        return;
      }

      setBillingSuccess(data.message || "Abonnement réactivé.");
      setUsageRefresh((value) => value + 1);
      setActiveView("settings");
    } catch {
      setBillingError("Impossible de reprendre l'abonnement");
    } finally {
      setCheckoutTargetId(null);
    }
  };

  return (
    <div className="app-shell min-h-dvh flex flex-col safe-top safe-bottom safe-x">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: smoothEase }}
        className="glass-strong sticky top-0 z-50 flex items-center justify-between border-b border-white/6 bg-slate-950/70 px-5 py-3.5 shadow-[0_18px_50px_rgba(6,10,20,0.24)] backdrop-blur-xl sm:px-8 sm:py-4"
      >
        <motion.div
          className="flex items-center gap-2.5"
          whileHover={{ scale: 1.03 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <img
            src="/icon-192.png"
            alt="Vocal2Cal"
            width={28}
            height={28}
            className="w-7 h-7 rounded-lg"
          />
          <h1 className="text-lg font-bold tracking-tight text-white">Vocal2Cal</h1>
        </motion.div>

        <AnimatePresence>
          {user && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 sm:gap-3"
            >
              <button
                type="button"
                onClick={() => setActiveView("settings")}
                className="inline-flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1 transition-colors hover:bg-white/[0.07] sm:hidden"
              >
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">
                  {activePlanLabel}
                </span>
                <span className="text-[8px] text-white/15">&#x2022;</span>
                <span className={`text-[11px] font-semibold tabular-nums tracking-wide ${creditAccentClass}`}>{availableCredits}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("settings")}
                className="hidden items-center gap-3.5 rounded-xl bg-white/[0.04] px-4 py-1.5 transition-colors hover:bg-white/[0.07] sm:flex"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
                  {activePlanLabel}
                </span>
                <span className="text-[7px] text-white/15">&#x2022;</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-[15px] font-semibold tabular-nums leading-none tracking-tight ${creditAccentClass}`}>{availableCredits}</span>
                  <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">cr</span>
                </div>
              </button>
              {user.image && (
                <img
                  src={user.image}
                  alt=""
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full ring-2 ring-white/10"
                />
              )}
              <motion.button
                onClick={signOut}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-sm text-slate-500 hover:text-white transition-colors"
              >
                D&eacute;connexion
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col items-center px-4 py-6 sm:px-6 sm:py-10 md:py-14 ${user ? "pb-28 sm:pb-10 md:pb-14" : ""}`}>
        <AnimatePresence mode="wait">
          {status === "loading" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <svg
                className="w-8 h-8 text-blue-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </motion.div>
          ) : !user ? (
            /* Logged Out — Full-page landing */
            <motion.div
              key="logged-out"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="w-full"
            >
              {/* ── Hero ── */}
              <section className="relative flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-8 sm:py-20">
                {/* Animated mesh background */}
                <div className="pointer-events-none absolute inset-0">
                  <motion.div
                    animate={{ x: [0, 30, -15, 0], y: [0, -20, 12, 0], scale: [1, 1.08, 0.95, 1] }}
                    transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-cyan-400/[0.12] blur-[120px]"
                  />
                  <motion.div
                    animate={{ x: [0, -28, 18, 0], y: [0, 16, -22, 0], scale: [1, 0.94, 1.1, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -right-24 top-16 h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/[0.09] blur-[130px]"
                  />
                  <motion.div
                    animate={{ x: [0, 14, -10, 0], y: [0, -10, 18, 0] }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-500/[0.08] blur-[100px]"
                  />
                  <motion.div
                    animate={{ opacity: [0.08, 0.25, 0.08] }}
                    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  />
                </div>

                <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col items-center"
                  >
                    {/* Badge */}
                    <motion.div
                      variants={fadeUp}
                      className="glass inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-slate-950/60 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-cyan-200 sm:text-[11px]"
                    >
                      <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
                      Connexion Google en un tap
                    </motion.div>

                    {/* Main heading */}
                    <motion.h2
                      variants={fadeUp}
                      className="mt-6 max-w-3xl text-4xl font-bold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl"
                    >
                      Organisez vos rendez-vous{" "}
                      <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-fuchsia-300 bg-clip-text text-transparent">
                        {typedText}
                        {isTyping && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.55, repeat: Infinity, repeatType: "reverse" }}
                            className="ml-1 inline-block h-8 w-0.5 align-middle bg-cyan-300 sm:h-12"
                          />
                        )}
                      </span>
                    </motion.h2>

                    {/* Subtitle */}
                    <motion.p
                      variants={fadeUp}
                      className="mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8"
                    >
                      Dites une phrase simple, laissez Vocal2Cal comprendre la date,
                      l&apos;heure et le contexte, puis ajoutez l&apos;&eacute;v&eacute;nement dans
                      Google Agenda — sans formulaire.
                    </motion.p>

                    {/* CTA */}
                    <motion.div variants={fadeUp} className="mt-8 w-full max-w-sm">
                      <motion.button
                        onClick={signIn}
                        whileHover={{ y: -2, scale: 1.02, boxShadow: "0 20px 50px rgba(34,211,238,0.15)" }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white px-6 py-4 text-base font-semibold text-slate-900 shadow-[0_16px_50px_rgba(255,255,255,0.08)]"
                      >
                        <motion.span
                          aria-hidden="true"
                          animate={{ x: ["-150%", "170%"] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.7 }}
                          className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent blur-md"
                        />
                        <span className="relative z-10 flex items-center gap-3">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Se connecter avec Google
                        </span>
                      </motion.button>
                      <p className="mt-3 text-center text-xs text-slate-500">
                        Aucun mot de passe — connexion directe avec votre compte Google.
                      </p>
                    </motion.div>
                  </motion.div>

                  {/* Scroll indicator */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="mt-12 flex flex-col items-center gap-2 sm:mt-16"
                  >
                    <span className="text-[10px] uppercase tracking-[0.3em] text-slate-600">Découvrir</span>
                    <motion.div
                      animate={{ y: [0, 6, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </motion.div>
                </div>
              </section>

              {/* ── Feature strip ── */}
              <section className="relative px-4 py-16 sm:px-8 sm:py-20">
                <div className="mx-auto max-w-5xl">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.6, ease: smoothEase }}
                    className="grid gap-4 sm:grid-cols-3"
                  >
                    {landingSignals.map((signal, index) => (
                      <motion.div
                        key={signal.value}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1, duration: 0.5, ease: smoothEase }}
                        whileHover={{ y: -4, scale: 1.02 }}
                        className="glass-strong rounded-2xl border border-white/8 p-6 text-center sm:text-left"
                      >
                        <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{signal.value}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{signal.label}</p>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </section>

              {/* ── How it works ── */}
              <section className="relative px-4 py-16 sm:px-8 sm:py-24">
                <div className="mx-auto max-w-5xl">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, ease: smoothEase }}
                    className="text-center"
                  >
                    <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Comment ça marche</p>
                    <h3 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
                      3&nbsp;&eacute;tapes, z&eacute;ro friction
                    </h3>
                  </motion.div>

                  <div className="mt-12 grid gap-6 sm:mt-16 sm:grid-cols-3 sm:gap-8">
                    {landingExamples.map((step, index) => (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ delay: index * 0.12, duration: 0.5, ease: smoothEase }}
                        whileHover={{ y: -6 }}
                        className="glass group relative overflow-hidden rounded-2xl border border-white/6 p-6 sm:p-8"
                      >
                        {/* Subtle top gradient on hover */}
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="relative">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300/15 to-fuchsia-300/10 border border-white/8">
                            <svg className="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                            </svg>
                          </div>
                          <p className="mt-5 text-[10px] uppercase tracking-[0.3em] text-slate-500">&Eacute;tape {step.id}</p>
                          <p className="mt-2 text-lg font-semibold text-white">{step.eyebrow}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Pricing ── */}
              <section className="relative px-4 py-16 sm:px-8 sm:py-24" id="pricing">
                <div className="mx-auto max-w-5xl">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, ease: smoothEase }}
                    className="text-center"
                  >
                    <p className="text-[11px] uppercase tracking-[0.3em] text-fuchsia-300">Tarifs</p>
                    <h3 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
                      Des abonnements pens&eacute;s pour durer
                    </h3>
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-400">
                      Vos cr&eacute;dits se renouvellent chaque mois. Et si vous videz votre solde, une recharge ponctuelle reste possible c&ocirc;t&eacute; app.
                    </p>
                  </motion.div>

                  <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
                    {PRICING_PLANS.map((plan, index) => {
                      const isFreePlan = plan.id === "FREE";

                      return (
                        <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.08, duration: 0.5, ease: smoothEase }}
                        whileHover={{ y: -6 }}
                        className={`relative flex flex-col rounded-2xl border p-6 ${
                          plan.popular
                            ? "border-cyan-400/30 bg-gradient-to-b from-cyan-500/[0.08] to-transparent shadow-[0_0_40px_rgba(34,211,238,0.08)]"
                            : "border-white/6 bg-white/[0.02]"
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900">
                            Populaire
                          </div>
                        )}
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{plan.name}</p>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-white">{plan.price}</span>
                          {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                        </div>
                        <p className="mt-1 text-sm font-medium text-cyan-300">{plan.credits}</p>
                        <p className="mt-2 flex-1 text-sm text-slate-400">{plan.desc}</p>
                        <motion.button
                          whileHover={!isFreePlan ? { scale: 1.03 } : undefined}
                          whileTap={!isFreePlan ? { scale: 0.97 } : undefined}
                          onClick={!isFreePlan ? signIn : undefined}
                          disabled={isFreePlan}
                          className={`mt-5 w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
                            plan.popular
                              ? "bg-white text-slate-900 hover:bg-gray-100"
                              : isFreePlan
                                ? "bg-white/5 text-slate-500 cursor-default"
                                : "bg-white/10 text-white hover:bg-white/15"
                          }`}
                        >
                          {isFreePlan ? "Offert à l'inscription" : `Choisir ${plan.name}`}
                        </motion.button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* ── Phone mockup ── */}
              <section className="relative overflow-hidden px-4 py-16 sm:px-8 sm:py-24">
                <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
                  {/* Text */}
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.6, ease: smoothEase }}
                    className="flex-1 text-center lg:text-left"
                  >
                    <p className="text-[11px] uppercase tracking-[0.3em] text-fuchsia-300">Aper&ccedil;u</p>
                    <h3 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl">
                      Pens&eacute; pour le mobile
                    </h3>
                    <p className="mt-4 max-w-md text-sm leading-7 text-slate-400 sm:text-base sm:leading-8 lg:max-w-none">
                      Un bouton, une phrase, un &eacute;v&eacute;nement dans votre agenda.
                      L&apos;interface s&apos;adapte &agrave; tous les &eacute;crans.
                    </p>
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/6 bg-white/[0.02] p-4 text-left">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">&Eacute;tape 1</p>
                        <p className="mt-1.5 text-sm leading-6 text-slate-300">Connectez-vous en un tap via Google.</p>
                      </div>
                      <div className="rounded-xl border border-white/6 bg-white/[0.02] p-4 text-left">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">&Eacute;tape 2</p>
                        <p className="mt-1.5 text-sm leading-6 text-slate-300">Dictez puis consultez vos &eacute;v&eacute;nements cr&eacute;&eacute;s.</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Phone */}
                  <motion.div
                    initial={{ opacity: 0, y: 30, rotate: -3 }}
                    whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.7, ease: smoothEase }}
                    className="relative w-full max-w-xs shrink-0"
                  >
                    <div className="absolute -inset-8 rounded-full bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 blur-3xl" />
                    <div className="relative rounded-[36px] border border-white/10 bg-slate-900/85 p-3 shadow-[0_24px_80px_rgba(7,14,26,0.6)]">
                      <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] p-4">
                        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/10" />

                        {/* Voice capture card */}
                        <div className="rounded-2xl border border-cyan-300/12 bg-cyan-300/8 px-4 py-4 text-left">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">Capture vocale</p>
                            <div className="flex h-7 items-end gap-1.5">
                              {[0, 1, 2].map((bar) => (
                                <motion.span
                                  key={bar}
                                  animate={{ height: [8, 18 + bar * 4, 8] }}
                                  transition={{ duration: 1.1, repeat: Infinity, repeatType: "mirror", delay: bar * 0.12 }}
                                  className="block w-1 rounded-full bg-cyan-300"
                                />
                              ))}
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-100">
                            &quot;Rendez-vous client mercredi 10h30&quot;
                          </p>
                        </div>

                        {/* Example items */}
                        <div className="mt-4 space-y-3">
                          {landingExamples.map((step, index) => (
                            <motion.div
                              key={step.id}
                              initial={{ opacity: 0, x: -10 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ delay: 0.3 + index * 0.08, duration: 0.35 }}
                              className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300/15 to-fuchsia-300/10 text-cyan-200">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{step.eyebrow}</p>
                                  <p className="mt-0.5 text-sm leading-5 text-slate-200">{step.text}</p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </section>

              {/* ── Bottom CTA ── */}
              <section className="px-4 py-16 sm:px-8 sm:py-20">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, ease: smoothEase }}
                  className="mx-auto max-w-2xl text-center"
                >
                  <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Pr&ecirc;t &agrave; simplifier votre agenda&nbsp;?
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
                    Rejoignez Vocal2Cal gratuitement et commencez &agrave; dicter vos &eacute;v&eacute;nements d&egrave;s maintenant.
                  </p>
                  <motion.button
                    onClick={signIn}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-base font-semibold text-slate-900 shadow-[0_12px_40px_rgba(255,255,255,0.08)]"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Commencer gratuitement
                  </motion.button>
                </motion.div>
              </section>
            </motion.div>
          ) : (
            /* Logged In View */
            <motion.div
              key="logged-in"
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onPanEnd={handleLoggedInPanEnd}
              onWheel={handleLoggedInWheel}
              style={{ touchAction: "pan-y" }}
              className="w-full max-w-5xl pt-3 sm:pt-6"
            >
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="mx-auto flex w-full flex-col items-center gap-5"
              >
                <AnimatePresence>
                  {swipeHint && (
                    <motion.div
                      key={swipeHint}
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.22, ease: smoothEase }}
                      className="pointer-events-none fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-400/15 bg-slate-950/85 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cyan-200 shadow-[0_20px_55px_rgba(8,15,34,0.45)] backdrop-blur-xl sm:bottom-8"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M13 5l7 7-7 7M5 12h15"
                        />
                      </svg>
                      {swipeHint}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.p
                  variants={fadeUp}
                  className="text-center text-xs uppercase tracking-[0.24em] text-slate-500 sm:text-[11px]"
                >
                  Glissez horizontalement ou utilisez le trackpad pour changer de vue
                </motion.p>

                <motion.div
                  variants={fadeUp}
                  className="glass-strong hidden items-center gap-1 rounded-full border border-white/8 p-1 sm:inline-flex"
                >
                  {viewTabs.map((tab) => {
                    const isActive = activeView === tab.id;

                    return (
                      <motion.button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveView(tab.id)}
                        whileTap={{ scale: 0.97 }}
                        className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="active-view-pill"
                            className="absolute inset-0 rounded-full bg-white/10"
                            transition={{ type: "spring", stiffness: 360, damping: 28 }}
                          />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                      </motion.button>
                    );
                  })}
                </motion.div>

                <AnimatePresence mode="wait">
                  {activeView === "home" ? (
                    <motion.div
                      key="home-view"
                      variants={panelVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="flex w-full max-w-md flex-col items-center gap-8 sm:max-w-lg sm:gap-10"
                    >
                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        className="text-center space-y-2"
                      >
                        <motion.p variants={fadeUp} className="text-slate-500 text-sm">
                          Bonjour
                          {user.name ? `, ${user.name.split(" ")[0]}` : ""}
                        </motion.p>
                        <motion.h2
                          variants={fadeUp}
                          className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
                        >
                          Que souhaitez-vous{" "}
                          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                            planifier
                          </span>
                          &nbsp;?
                        </motion.h2>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.45, ease: smoothEase }}
                        className="w-full"
                      >
                        <VoiceRecorder
                          isAdmin={user.role === "ADMIN"}
                          onSuccess={() => setUsageRefresh((n) => n + 1)}
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="w-full flex justify-center"
                      >
                        <UsageBar refreshKey={usageRefresh} />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.35, ease: smoothEase }}
                        className="w-full"
                      >
                        <History />
                      </motion.div>
                    </motion.div>
                  ) : activeView === "dashboard" ? (
                    <motion.div
                      key="dashboard-view"
                      variants={panelVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full space-y-5"
                    >
                      <motion.section
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        className="glass-strong rounded-[30px] border border-white/8 p-5 sm:p-6"
                      >
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Vue d&apos;ensemble</p>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                              Dashboard Vocal2Cal
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                              Retrouvez vos dernières dictées, le suivi d&apos;usage et quelques repères utiles sans alourdir la page d&apos;accueil mobile.
                            </p>
                          </div>
                          <motion.button
                            type="button"
                            onClick={() => setActiveView("home")}
                            whileHover={{ x: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour &agrave; la dict&eacute;e
                          </motion.button>
                        </div>
                      </motion.section>

                      <motion.section
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.08 }}
                        className="grid gap-4 md:grid-cols-3"
                      >
                        {dashboardHighlights.map((item, index) => (
                          <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 + index * 0.06, duration: 0.3 }}
                            className="glass rounded-[24px] border border-white/6 p-5"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/16 to-cyan-400/10 text-blue-300">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={item.icon} />
                              </svg>
                            </div>
                            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">{item.title}</p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{item.value}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                          </motion.div>
                        ))}
                      </motion.section>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <motion.section
                          variants={fadeUp}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0.12 }}
                          className="glass rounded-[26px] border border-white/6 p-5 sm:p-6"
                        >
                          <div className="mb-4 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Capacité du jour</p>
                              <h3 className="mt-1 text-lg font-semibold text-white">Suivi d&apos;usage</h3>
                            </div>
                            <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                              En direct
                            </div>
                          </div>
                          <UsageBar refreshKey={usageRefresh} className="max-w-none" />
                        </motion.section>

                        <motion.section
                          variants={fadeUp}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0.16 }}
                          className="glass rounded-[26px] border border-white/6 p-5 sm:p-6"
                        >
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Rep&egrave;res</p>
                          <h3 className="mt-1 text-lg font-semibold text-white">Cycle rapide</h3>
                          <div className="mt-5 space-y-4">
                            {dashboardSteps.map((step, index) => (
                              <motion.div
                                key={step.title}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.22 + index * 0.06, duration: 0.25 }}
                                className="flex items-start gap-3"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-sm font-semibold text-blue-300">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white">{step.title}</p>
                                  <p className="mt-1 text-sm leading-6 text-slate-400">{step.description}</p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.section>
                      </div>

                      <motion.section
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.2 }}
                        className="glass-strong rounded-[30px] border border-white/8 p-5 sm:p-6"
                      >
                        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Historique</p>
                            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">Derni&egrave;res dict&eacute;es</h3>
                          </div>
                          <p className="max-w-md text-sm leading-6 text-slate-400">
                            Le m&ecirc;me historique que sur l&apos;accueil, mais int&eacute;gr&eacute; &agrave; une vue de suivi plus large.
                          </p>
                        </div>
                        <History />
                      </motion.section>
                    </motion.div>
                  ) : activeView === "pricing" ? (
                    <motion.div
                      key="pricing-view"
                      variants={panelVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full space-y-5"
                    >
                      <motion.section
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        className="glass-strong rounded-[30px] border border-white/8 p-5 sm:p-6"
                      >
                        <p className="text-xs uppercase tracking-[0.22em] text-fuchsia-300">Tarifs</p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                          Comparez les offres
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                          1 cr&eacute;dit = 1 demande compl&egrave;te. Les abonnements mensuels assurent le meilleur prix au cr&eacute;dit, et les recharges restent volontairement moins avantageuses.
                        </p>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                          Les changements de plan et la gestion de facturation se confirment ensuite dans l&apos;espace <span className="text-slate-300">R&eacute;glages</span> ou directement dans Stripe selon le cas.
                        </p>
                      </motion.section>

                      <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.08 }}
                        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
                      >
                        {PRICING_PLANS.map((plan, index) => {
                          const isFreePlan = plan.id === "FREE";
                          const isCurrentPlan = activePlanId === plan.id;
                          const isCurrentDisplayedPlan = isCurrentPlan && !isFreePlan && hasPaidPlan;
                          const isHigherPlan = PLAN_TIERS[plan.id as keyof typeof PLAN_TIERS] > PLAN_TIERS[activePlanId as keyof typeof PLAN_TIERS];
                          const isLowerPlan = PLAN_TIERS[plan.id as keyof typeof PLAN_TIERS] < PLAN_TIERS[activePlanId as keyof typeof PLAN_TIERS];
                          const isCheckoutLoading = checkoutTargetId === `plan:${plan.id}`;
                          const isPlanChangeLoading = checkoutTargetId === `change:${plan.id}`;
                          const isScheduledPlanChangeLoading = checkoutTargetId === `schedule:${plan.id}`;
                          const isScheduledPlan = scheduledPlanId === plan.id;
                          const isDisabled =
                            isFreePlan ||
                            isCurrentDisplayedPlan ||
                            isScheduledPlan ||
                            checkoutTargetId !== null;

                          return (
                            <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + index * 0.06, duration: 0.3 }}
                            whileHover={!isDisabled ? { y: -4 } : undefined}
                            className={`relative flex flex-col rounded-2xl border p-6 ${
                              plan.popular
                                ? "border-cyan-400/30 bg-gradient-to-b from-cyan-500/[0.08] to-transparent shadow-[0_0_40px_rgba(34,211,238,0.08)]"
                                : "border-white/6 bg-white/[0.02]"
                            }`}
                          >
                            {isCurrentPlan && (
                              <div className="absolute right-4 top-4 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                                Plan actuel
                              </div>
                            )}
                            {plan.popular && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900">
                                Populaire
                              </div>
                            )}
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{plan.name}</p>
                            <div className="mt-3 flex items-baseline gap-1">
                              <span className="text-3xl font-bold text-white">{plan.price}</span>
                              {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                            </div>
                            <p className="mt-1 text-sm font-medium text-cyan-300">{plan.credits}</p>
                            <p className="mt-2 flex-1 text-sm text-slate-400">{plan.desc}</p>
                            <motion.button
                              whileHover={!isDisabled ? { scale: 1.03 } : undefined}
                              whileTap={!isDisabled ? { scale: 0.97 } : undefined}
                              onClick={
                                isCurrentDisplayedPlan
                                  ? undefined
                                  : isEffectivelySubscribed && isHigherPlan
                                    ? () => handleChangePlan(plan.id)
                                    : isEffectivelySubscribed && isLowerPlan
                                      ? () => handlePrepareScheduledPlanChange(plan.id)
                                      : !isFreePlan && !isEffectivelySubscribed
                                    ? () => handleCheckout({ planId: plan.id })
                                    : undefined
                              }
                              disabled={isDisabled}
                              aria-busy={isCheckoutLoading || isPlanChangeLoading || isScheduledPlanChangeLoading}
                              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                                isCurrentDisplayedPlan
                                  ? "bg-white/8 text-white/70 cursor-default"
                                  : plan.popular
                                    ? "bg-white text-slate-900 hover:bg-gray-100"
                                  : isFreePlan
                                    ? "bg-white/5 text-slate-500 cursor-default"
                                  : isDisabled
                                      ? "bg-white/10 text-white/60"
                                      : "bg-white/10 text-white hover:bg-white/15"
                              }`}
                            >
                              {(isCheckoutLoading || isPlanChangeLoading || isScheduledPlanChangeLoading) && (
                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              )}
                              {isFreePlan
                                ? "Inclus"
                                : isCurrentDisplayedPlan
                                  ? "Plan actuel"
                                  : isScheduledPlan
                                    ? "Déjà planifié"
                                    : isPlanChangeLoading || isCheckoutLoading
                                      ? "Redirection..."
                                      : isScheduledPlanChangeLoading
                                        ? "Planification..."
                                      : "Passer à ce plan"}
                            </motion.button>
                            </motion.div>
                          );
                        })}
                      </motion.div>

                      <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.2 }}
                        className="glass rounded-2xl border border-white/6 p-5 text-center"
                      >
                        <p className="text-sm text-slate-400">
                          Paiement s&eacute;curis&eacute; par <span className="font-medium text-white">Stripe</span>. Les abonnements alimentent automatiquement le solde &agrave; chaque cycle et les recharges restent moins rentables qu&apos;une mont&eacute;e de plan.
                        </p>
                        {checkoutTargetId && (
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-200">
                            Ouverture du checkout Stripe en cours...
                          </p>
                        )}
                        {billingSuccess && (
                          <p className="mt-3 text-sm text-emerald-300">
                            {billingSuccess}
                          </p>
                        )}
                        {billingError && (
                          <p className="mt-3 text-sm text-amber-200">
                            {billingError}
                          </p>
                        )}
                      </motion.div>
                    </motion.div>
                  ) : activeView === "settings" ? (
                    <motion.div
                      key="settings-view"
                      variants={panelVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full space-y-5"
                    >
                      <motion.section
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        className="glass-strong rounded-[30px] border border-white/8 p-5 sm:p-6"
                      >
                        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Réglages</p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                          Paramètres du compte
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                          Retrouvez ici la gestion de votre abonnement, vos informations de compte et les actions de session utiles.
                        </p>
                      </motion.section>

                      <motion.section
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.04 }}
                        className="glass rounded-[26px] border border-cyan-400/15 bg-cyan-400/[0.04] p-5 sm:p-6"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Gérer votre abonnement</p>
                            <h3 className="mt-1 text-xl font-semibold text-white">
                              {activePlanLabel}
                            </h3>
                            {!hasPaidPlan ? (
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                                Vous êtes sur l&apos;offre Découverte. Rendez-vous dans l&apos;onglet Tarifs pour choisir un abonnement mensuel.
                              </p>
                            ) : !hasManagedSubscription ? (
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/90">
                                Le plan local est bien connu, mais l&apos;abonnement Stripe n&apos;a pas encore pu &ecirc;tre rattach&eacute; automatiquement. Si le paiement est tr&egrave;s r&eacute;cent, rechargez la page. Sinon, le rattachement a probablement &eacute;t&eacute fait sur un autre client Stripe li&eacute; &agrave; votre email et sera recherch&eacute; automatiquement apr&egrave;s red&eacute;ploiement.
                              </p>
                            ) : cancelAtPeriodEnd && managedPeriodEndLabel ? (
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-100/90">
                                La r&eacute;siliation est programm&eacute;e. Vous conservez les avantages {activePlanLabel} jusqu&apos;au {managedPeriodEndLabel}, puis votre abonnement s&apos;arr&ecirc;tera. Vous pouvez encore revenir en arri&egrave;re avant cette date.
                              </p>
                            ) : scheduledPlanLabel && scheduledPlanEffectiveLabel ? (
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/90">
                                Votre abonnement actuel reste actif jusqu&apos;au {scheduledPlanEffectiveLabel}. &Agrave; cette date, Stripe basculera automatiquement sur {scheduledPlanLabel} avec ses cr&eacute;dits et son tarif. Vous pouvez encore annuler ce changement avant qu&apos;il prenne effet.
                              </p>
                            ) : managedPeriodEndLabel ? (
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                                Prochain renouvellement estim&eacute; le {managedPeriodEndLabel}. Les prochains mois restent factur&eacute;s au tarif habituel de votre plan.
                              </p>
                            ) : (
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                                Votre abonnement reste actif et vos cr&eacute;dits se rechargent automatiquement &agrave; chaque cycle mensuel.
                              </p>
                            )}
                          </div>
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[240px]">
                            {scheduledPlanLabel ? (
                              <motion.button
                                type="button"
                                onClick={handleClearScheduledPlanChange}
                                whileHover={checkoutTargetId ? undefined : { y: -2 }}
                                whileTap={checkoutTargetId ? undefined : { scale: 0.98 }}
                                disabled={checkoutTargetId !== null}
                                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                                  checkoutTargetId === "clear-scheduled-plan"
                                    ? "bg-white/10 text-white/60"
                                    : "bg-white text-slate-900 hover:bg-slate-100"
                                }`}
                              >
                                {checkoutTargetId === "clear-scheduled-plan" ? "Annulation..." : "Annuler le changement planifié"}
                              </motion.button>
                            ) : cancelAtPeriodEnd ? (
                              <motion.button
                                type="button"
                                onClick={handleResumeSubscription}
                                whileHover={checkoutTargetId ? undefined : { y: -2 }}
                                whileTap={checkoutTargetId ? undefined : { scale: 0.98 }}
                                disabled={checkoutTargetId !== null}
                                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                                  checkoutTargetId === "resume-subscription"
                                    ? "bg-white/10 text-white/60"
                                    : "bg-white text-slate-900 hover:bg-slate-100"
                                }`}
                              >
                                {checkoutTargetId === "resume-subscription" ? "Réactivation..." : "Réactiver l'abonnement"}
                              </motion.button>
                            ) : (
                              <motion.button
                                type="button"
                                onClick={() => setCancelConfirmationOpen(true)}
                                whileHover={checkoutTargetId ? undefined : { y: -2 }}
                                whileTap={checkoutTargetId ? undefined : { scale: 0.98 }}
                                disabled={checkoutTargetId !== null || !hasManagedSubscription || !hasPaidPlan}
                                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                                  checkoutTargetId === "cancel-subscription"
                                    ? "bg-white/10 text-white/60"
                                    : "bg-white text-slate-900 hover:bg-slate-100"
                                } disabled:bg-white/10 disabled:text-white/60`}
                              >
                                {checkoutTargetId === "cancel-subscription" ? "Ouverture..." : "Programmer la résiliation"}
                              </motion.button>
                            )}
                            <motion.button
                              type="button"
                              onClick={handleManageSubscription}
                              whileHover={checkoutTargetId ? undefined : { y: -2 }}
                              whileTap={checkoutTargetId ? undefined : { scale: 0.98 }}
                              disabled={checkoutTargetId !== null || !hasManagedSubscription}
                              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                                checkoutTargetId === "portal"
                                  ? "bg-white/10 text-white/60"
                                  : "bg-white/10 text-white hover:bg-white/15"
                              } disabled:bg-white/10 disabled:text-white/60`}
                            >
                              {checkoutTargetId === "portal" ? "Ouverture..." : "Paiement et factures"}
                            </motion.button>
                            <motion.button
                              type="button"
                              onClick={() => setActiveView("pricing")}
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06]"
                            >
                              Voir les tarifs
                            </motion.button>
                          </div>
                        </div>
                      </motion.section>

                      {pendingPlanDisplay && hasPaidPlan && activePlanId !== pendingPlanDisplay.id && (
                        <motion.section
                          variants={fadeUp}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0.06 }}
                          className="glass rounded-[26px] border border-amber-300/15 bg-amber-300/[0.04] p-5 sm:p-6"
                        >
                          <p className="text-xs uppercase tracking-[0.22em] text-amber-200">Confirmation</p>
                          <h3 className="mt-1 text-xl font-semibold text-white">
                            Programmer le passage &agrave; {pendingPlanDisplay.name}
                          </h3>
                          {hasManagedSubscription && managedPeriodEndLabel ? (
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                              Vous conservez les avantages <span className="font-medium text-white">{activePlanLabel}</span> jusqu&apos;au {managedPeriodEndLabel}. &Agrave; partir de cette date, votre abonnement passera sur <span className="font-medium text-white">{pendingPlanDisplay.name}</span>, avec un tarif de {pendingPlanDisplay.price}{pendingPlanDisplay.period} et {pendingPlanDisplay.credits.toLowerCase()} par cycle. Vous pourrez encore annuler ce changement avant sa date d&apos;effet depuis cette page.
                            </p>
                          ) : (
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/90">
                              L&apos;abonnement Stripe doit encore &ecirc;tre rattach&eacute; proprement avant de confirmer ce changement de plan.
                            </p>
                          )}
                          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                            <motion.button
                              type="button"
                              onClick={() => handleSchedulePlanChange(pendingPlanDisplay.id)}
                              whileHover={checkoutTargetId || !hasManagedSubscription ? undefined : { y: -2 }}
                              whileTap={checkoutTargetId || !hasManagedSubscription ? undefined : { scale: 0.98 }}
                              disabled={checkoutTargetId !== null || !hasManagedSubscription}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:bg-white/10 disabled:text-white/60"
                            >
                              {checkoutTargetId === `schedule:${pendingPlanDisplay.id}` ? "Planification..." : "Confirmer ce changement"}
                            </motion.button>
                            <motion.button
                              type="button"
                              onClick={() => setPendingPlanSelection(null)}
                              whileHover={checkoutTargetId ? undefined : { y: -2 }}
                              whileTap={checkoutTargetId ? undefined : { scale: 0.98 }}
                              disabled={checkoutTargetId !== null}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] disabled:bg-white/10 disabled:text-white/60"
                            >
                              Garder mon plan actuel
                            </motion.button>
                          </div>
                        </motion.section>
                      )}

                      <div className="grid gap-4 lg:grid-cols-2">
                        <motion.section
                          variants={fadeUp}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0.08 }}
                          className="glass rounded-[26px] border border-white/6 p-5 sm:p-6"
                        >
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Compte</p>
                          <h3 className="mt-1 text-xl font-semibold text-white">Informations connectées</h3>
                          <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Nom</p>
                              <p className="mt-2 text-sm text-slate-200">{user.name || "Compte Google"}</p>
                            </div>
                            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Email</p>
                              <p className="mt-2 text-sm text-slate-200">{user.email || "Adresse non disponible"}</p>
                            </div>
                            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Calendrier</p>
                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                Les événements sont créés sur votre agenda Google principal via la session actuellement connectée.
                              </p>
                            </div>
                          </div>
                        </motion.section>

                        <motion.section
                          variants={fadeUp}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0.12 }}
                          className="glass rounded-[26px] border border-white/6 p-5 sm:p-6"
                        >
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Session</p>
                          <h3 className="mt-1 text-xl font-semibold text-white">Actions rapides</h3>
                          <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Crédits disponibles</p>
                              <p className={`mt-2 text-2xl font-semibold ${creditAccentClass}`}>{availableCredits}</p>
                            </div>
                            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Navigation</p>
                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                Utilisez cette page pour gérer votre abonnement, confirmer un changement de plan futur et acheter des recharges si votre solde tombe &agrave; z&eacute;ro.
                              </p>
                            </div>
                            <motion.button
                              type="button"
                              onClick={signOut}
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                            >
                              Se déconnecter
                            </motion.button>
                          </div>
                        </motion.section>
                      </div>

                      {hasActiveSubscription && (
                        <motion.section
                          variants={fadeUp}
                          initial="hidden"
                          animate="visible"
                          transition={{ delay: 0.14 }}
                          className="glass rounded-[26px] border border-white/6 p-5 sm:p-6"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-amber-300">Recharges</p>
                              <h3 className="mt-1 text-xl font-semibold text-white">Crédits supplémentaires</h3>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                                Les recharges servent de filet de sécurité. Elles sont moins rentables qu&apos;un abonnement et se débloquent uniquement si votre abonnement est actif et que votre solde atteint zéro.
                              </p>
                            </div>
                            {!canBuyTopUp && (
                              <div className="rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                                Disponible &agrave; 0 cr&eacute;dit
                              </div>
                            )}
                          </div>

                          <div className="mt-5 grid gap-4 lg:grid-cols-3">
                            {TOP_UP_PACKS.map((pack, index) => {
                              const isTopUpLoading = checkoutTargetId === `topup:${pack.id}`;
                              const isDisabled = !canBuyTopUp || checkoutTargetId !== null;

                              return (
                                <motion.div
                                  key={pack.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.16 + index * 0.06, duration: 0.3 }}
                                  className="rounded-2xl border border-white/6 bg-white/[0.02] p-5"
                                >
                                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{pack.name}</p>
                                  <div className="mt-3 flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-white">{pack.price}</span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-amber-300">{pack.credits}</p>
                                  <p className="mt-2 min-h-[3rem] text-sm text-slate-400">{pack.desc}</p>
                                  <motion.button
                                    whileHover={!isDisabled ? { scale: 1.03 } : undefined}
                                    whileTap={!isDisabled ? { scale: 0.97 } : undefined}
                                    onClick={!isDisabled ? () => handleCheckout({ topUpPackId: pack.id }) : undefined}
                                    disabled={isDisabled}
                                    aria-busy={isTopUpLoading}
                                    className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                                      isDisabled
                                        ? "bg-white/10 text-white/60"
                                        : "bg-white/10 text-white hover:bg-white/15"
                                    }`}
                                  >
                                    {isTopUpLoading && (
                                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                    )}
                                    {isTopUpLoading
                                      ? "Redirection..."
                                      : canBuyTopUp
                                        ? "Acheter des crédits"
                                        : "Solde positif"}
                                  </motion.button>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.section>
                      )}

                      <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: 0.16 }}
                        className="glass rounded-2xl border border-white/6 p-5 text-center"
                      >
                        {billingSuccess ? (
                          <p className="text-sm text-emerald-300">{billingSuccess}</p>
                        ) : billingError ? (
                          <p className="text-sm text-amber-200">{billingError}</p>
                        ) : (
                          <p className="text-sm text-slate-400">
                            Les opérations d&apos;abonnement passent par <span className="font-medium text-white">Stripe</span>. Les changements de plan supérieurs sont immédiats, les plans inférieurs et résiliations prennent effet à la fin de la période en cours.
                          </p>
                        )}
                      </motion.div>
                    </motion.div>
                  ) : activeView === "admin" && user?.role === "ADMIN" ? (
                    <motion.div
                      key="admin-view"
                      variants={panelVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="w-full space-y-5"
                    >
                      <motion.section
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        className="glass-strong rounded-[30px] border border-white/8 p-5 sm:p-6"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-amber-400">Administration</p>
                            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                              Panneau admin
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                              Vue d&apos;ensemble de la plateforme, utilisateurs, revenus et co&ucirc;ts API.
                            </p>
                          </div>
                          <motion.button
                            type="button"
                            onClick={() => setActiveView("home")}
                            whileHover={{ x: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-white/[0.06]"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Retour
                          </motion.button>
                        </div>
                      </motion.section>
                      <AdminPanel />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {cancelConfirmationOpen && hasPaidPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
            onClick={() => checkoutTargetId === null && setCancelConfirmationOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.22, ease: smoothEase }}
              onClick={(event) => event.stopPropagation()}
              className="glass-strong w-full max-w-lg rounded-[28px] border border-white/10 p-6 shadow-[0_24px_80px_rgba(6,10,20,0.45)]"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-rose-200">Confirmation</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Programmer la résiliation
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Cette action programme la fin de votre abonnement à la prochaine échéance. Vous pourrez encore l&apos;annuler tant que cette date n&apos;est pas atteinte.
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                  Votre plan <span className="font-medium text-white">{activePlanLabel}</span> reste actif jusqu&apos;au{" "}
                  <span className="font-medium text-white">{managedPeriodEndLabel || "prochain renouvellement"}</span>.
                </div>
                <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                  Aucun nouveau prélèvement ne sera effectué après cette date, sauf si vous réactivez l&apos;abonnement avant l&apos;échéance.
                </div>
                <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                  Vos éventuels changements de plan différés n&apos;auront plus d&apos;effet si la résiliation Stripe est confirmée.
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <motion.button
                  type="button"
                  onClick={handleCancelSubscription}
                  whileHover={checkoutTargetId ? undefined : { y: -2 }}
                  whileTap={checkoutTargetId ? undefined : { scale: 0.98 }}
                  disabled={checkoutTargetId !== null}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:bg-white/10 disabled:text-white/60"
                >
                  {checkoutTargetId === "cancel-subscription" ? "Programmation..." : "Confirmer la résiliation"}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setCancelConfirmationOpen(false)}
                  whileHover={checkoutTargetId ? undefined : { y: -2 }}
                  whileTap={checkoutTargetId ? undefined : { scale: 0.98 }}
                  disabled={checkoutTargetId !== null}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] disabled:bg-white/10 disabled:text-white/60"
                >
                  Garder mon abonnement
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {user && (
        <motion.nav
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35, ease: smoothEase }}
          className="fixed inset-x-0 bottom-4 z-50 px-4 sm:hidden"
        >
          <div className="glass-strong mx-auto flex max-w-sm items-center gap-1 rounded-[26px] border border-white/10 p-1.5 shadow-[0_18px_60px_rgba(6,10,20,0.35)] backdrop-blur-xl">
            {viewTabs.map((tab) => {
              const isActive = activeView === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveView(tab.id)}
                  whileTap={{ scale: 0.97 }}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-3 py-3 text-[11px] font-medium transition-colors ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="mobile-active-view-pill"
                      className="absolute inset-0 rounded-[20px] bg-white/10"
                      transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    />
                  )}
                  <svg className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={tab.icon} />
                  </svg>
                  <span className="relative z-10">{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.nav>
      )}

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="text-center py-5 text-xs text-slate-600/60"
      >
        Vocal2Cal — Projet Ynov Web Full-Stack
      </motion.footer>
    </div>
  );
}
