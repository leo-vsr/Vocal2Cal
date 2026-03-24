import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { History } from "@/components/History";
import { UsageBar } from "@/components/UsageBar";

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

type AppView = "home" | "dashboard";

const viewTabs: Array<{ id: AppView; label: string; icon: string }> = [
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
];

const SWIPE_DISTANCE_THRESHOLD = 96;
const SWIPE_VELOCITY_THRESHOLD = 650;
const WHEEL_SWIPE_THRESHOLD = 140;
const WHEEL_RESET_DELAY_MS = 180;
const SWIPE_COOLDOWN_MS = 420;

type SwipeDirection = "left" | "right";

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

function useTypewriter(text: string, speed = 70, startDelay = 600) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let i = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const delay = setTimeout(() => {
      intervalId = setInterval(() => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
        } else if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(delay);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [text, speed, startDelay]);
  return displayed;
}

export default function App() {
  const { user, status, signIn, signOut } = useAuth();
  const [usageRefresh, setUsageRefresh] = useState(0);
  const [activeView, setActiveView] = useState<AppView>("home");
  const [swipeHint, setSwipeHint] = useState<SwipeDirection | null>(null);
  const typedText = useTypewriter("à la voix");
  const wheelDeltaRef = useRef(0);
  const wheelResetTimeoutRef = useRef<number | null>(null);
  const swipeCooldownTimeoutRef = useRef<number | null>(null);
  const swipeHintTimeoutRef = useRef<number | null>(null);
  const swipeLockedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setActiveView("home");
    }
  }, [user]);

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

  const showSwipeHint = (direction: SwipeDirection) => {
    setSwipeHint(direction);
    if (swipeHintTimeoutRef.current) {
      window.clearTimeout(swipeHintTimeoutRef.current);
    }
    swipeHintTimeoutRef.current = window.setTimeout(() => {
      setSwipeHint(null);
      swipeHintTimeoutRef.current = null;
    }, 900);
  };

  const setViewFromSwipe = (direction: SwipeDirection) => {
    if (swipeLockedRef.current) {
      return;
    }

    if (direction === "right" && activeView === "home") {
      setActiveView("dashboard");
      showSwipeHint(direction);
    } else if (direction === "left" && activeView === "dashboard") {
      setActiveView("home");
      showSwipeHint(direction);
    } else {
      return;
    }

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
              className="flex items-center gap-3"
            >
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
            /* Logged Out View */
            <motion.div
              key="logged-out"
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative flex w-full max-w-6xl flex-1 items-center justify-center overflow-hidden py-6 text-center sm:py-10"
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                  animate={{ x: [0, 36, -24, 0], y: [0, -26, 22, 0], scale: [1, 1.08, 0.94, 1] }}
                  transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[-10%] top-12 h-64 w-64 rounded-full bg-cyan-400/20 blur-[110px] sm:h-80 sm:w-80"
                />
                <motion.div
                  animate={{ x: [0, -42, 18, 0], y: [0, 18, -30, 0], scale: [1, 0.95, 1.1, 1] }}
                  transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute right-[-6%] top-20 h-72 w-72 rounded-full bg-fuchsia-500/16 blur-[120px] sm:h-[26rem] sm:w-[26rem]"
                />
                <motion.div
                  animate={{ opacity: [0.18, 0.32, 0.16, 0.18] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.18),rgba(2,6,23,0.04))]" />
              </div>

              <div className="relative z-10 grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
                <motion.section
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="relative mx-auto flex w-full max-w-xl flex-col items-center text-center lg:items-start lg:text-left"
                >
                  <motion.div
                    variants={fadeUp}
                    className="glass inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-slate-950/55 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-cyan-200"
                  >
                    <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
                    Calendrier piloté par la voix
                  </motion.div>

                  <motion.h2
                    variants={fadeUp}
                    className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl"
                  >
                    Votre agenda passe de l&apos;id&eacute;e &agrave; l&apos;action,
                    <span className="mt-2 block bg-gradient-to-r from-cyan-300 via-blue-300 to-fuchsia-300 bg-clip-text text-transparent">
                      {typedText}
                      {typedText.length < "à la voix".length && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.55, repeat: Infinity, repeatType: "reverse" }}
                          className="ml-1 inline-block h-10 w-0.5 align-middle bg-cyan-300"
                        />
                      )}
                    </span>
                  </motion.h2>

                  <motion.p
                    variants={fadeUp}
                    className="mt-5 max-w-lg text-base leading-8 text-slate-300 sm:text-lg"
                  >
                    Dictez vos &eacute;v&eacute;nements en fran&ccedil;ais, laissez Vocal2Cal
                    comprendre l&apos;intention, puis envoyez le tout directement dans votre
                    Google Agenda avec une interface plus vivante que votre todo-list.
                  </motion.p>

                  <motion.div
                    variants={fadeUp}
                    className="mt-8 flex w-full max-w-md flex-wrap items-center justify-center gap-3 lg:justify-start"
                  >
                    <motion.button
                      onClick={signIn}
                      whileHover={{ y: -3, scale: 1.015, boxShadow: "0 20px 60px rgba(34,211,238,0.18)" }}
                      whileTap={{ scale: 0.985 }}
                      className="group relative inline-flex min-h-14 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white px-6 py-4 text-base font-semibold text-slate-900 shadow-[0_12px_40px_rgba(255,255,255,0.08)] sm:flex-none sm:min-w-[18rem]"
                    >
                      <motion.span
                        aria-hidden="true"
                        animate={{ x: ["-140%", "160%"] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
                        className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent blur-md"
                      />
                      <span className="relative z-10 flex items-center gap-3">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Se connecter avec Google
                      </span>
                    </motion.button>

                    <motion.div
                      whileHover={{ y: -2 }}
                      className="glass inline-flex min-h-14 items-center rounded-2xl border border-white/10 px-5 py-3 text-sm text-slate-200"
                    >
                      Dites simplement : &quot;R&eacute;union jeudi 14h&quot;
                    </motion.div>
                  </motion.div>

                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="mt-8 grid w-full gap-3 sm:grid-cols-3"
                  >
                    {landingSignals.map((signal, index) => (
                      <motion.div
                        key={signal.value}
                        variants={fadeUp}
                        whileHover={{ y: -4, scale: 1.01 }}
                        transition={{ duration: 0.22, delay: index * 0.04 }}
                        className="glass rounded-[24px] border border-white/10 bg-slate-950/35 p-4 text-left"
                      >
                        <p className="text-sm uppercase tracking-[0.22em] text-cyan-200">{signal.value}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{signal.label}</p>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.section>

                <motion.section
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="relative mx-auto w-full max-w-xl"
                >
                  <motion.div
                    variants={fadeUp}
                    className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_30px_90px_rgba(5,10,20,0.45)] backdrop-blur-2xl sm:p-6"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),transparent_45%,rgba(232,121,249,0.08))]" />
                    <div className="relative flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Studio vocal</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">Parlez, voyez, validez.</h3>
                      </div>
                      <motion.div
                        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.04, 1] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-200"
                      >
                        Live
                      </motion.div>
                    </div>

                    <div className="relative mt-10 flex items-center justify-center py-6">
                      <motion.div
                        animate={{ scale: [1, 1.22, 1], opacity: [0.22, 0.06, 0.22] }}
                        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute h-44 w-44 rounded-full border border-cyan-300/20"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.36, 1], opacity: [0.18, 0.04, 0.18] }}
                        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
                        className="absolute h-56 w-56 rounded-full border border-fuchsia-300/16"
                      />
                      <motion.div
                        animate={{ y: [0, -8, 0], boxShadow: ["0 0 0 rgba(34,211,238,0.15)", "0 0 48px rgba(34,211,238,0.22)", "0 0 0 rgba(34,211,238,0.15)"] }}
                        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                        className="relative flex h-32 w-32 items-center justify-center rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.22),rgba(15,23,42,0.88))]"
                      >
                        <motion.div
                          animate={{ scaleY: [0.72, 1.08, 0.82, 1], opacity: [0.6, 1, 0.75, 1] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.16),transparent_58%)]"
                        />
                        <svg
                          className="relative h-14 w-14 text-cyan-200"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                      </motion.div>
                    </div>

                    <div className="relative mt-4 space-y-3">
                      {landingExamples.map((step, index) => (
                        <motion.div
                          key={step.id}
                          variants={fadeUp}
                          whileHover={{ x: 6, y: -2, scale: 1.01, backgroundColor: "rgba(15,23,42,0.7)" }}
                          transition={{ duration: 0.22, delay: index * 0.05 }}
                          className="group rounded-[24px] border border-white/8 bg-slate-900/55 px-4 py-4 text-left"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300/18 to-fuchsia-300/14 text-cyan-200">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{step.eyebrow}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-200">{step.text}</p>
                            </div>
                            <div className="ml-auto rounded-full border border-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                              {step.id}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </motion.section>
              </div>
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
                          d={swipeHint === "right" ? "M13 5l7 7-7 7M5 12h15" : "M11 19l-7-7 7-7m8 7H4"}
                        />
                      </svg>
                      {swipeHint === "right" ? "Dashboard" : "Accueil"}
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
                  ) : (
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
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

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
