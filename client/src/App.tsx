import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

type AppView = "home" | "dashboard";

const viewTabs: Array<{ id: AppView; label: string }> = [
  { id: "home", label: "Accueil" },
  { id: "dashboard", label: "Dashboard" },
];

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

export default function App() {
  const { user, status, signIn, signOut } = useAuth();
  const [usageRefresh, setUsageRefresh] = useState(0);
  const [activeView, setActiveView] = useState<AppView>("home");

  useEffect(() => {
    if (!user) {
      setActiveView("home");
    }
  }, [user]);

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
      <main className="flex-1 flex flex-col items-center px-4 py-6 sm:px-6 sm:py-10 md:py-14">
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
              className="flex-1 flex flex-col items-center justify-center gap-10 text-center w-full max-w-sm sm:max-w-md"
            >
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                <motion.div
                  variants={fadeUp}
                  className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-2"
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/10 blur-xl" />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/10 border border-white/10 flex items-center justify-center">
                    <svg
                      className="w-11 h-11 sm:w-13 sm:h-13 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>
                </motion.div>
                <motion.h2
                  variants={fadeUp}
                  className="text-3xl sm:text-4xl font-bold tracking-tight text-white"
                >
                  Votre agenda,{" "}
                  <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                    &agrave; la voix
                  </span>
                </motion.h2>
                <motion.p
                  variants={fadeUp}
                  className="text-slate-400 leading-relaxed text-sm sm:text-base max-w-xs mx-auto"
                >
                  Dictez vos &eacute;v&eacute;nements en fran&ccedil;ais et
                  Vocal2Cal les ajoute automatiquement &agrave; votre Google
                  Agenda.
                </motion.p>
              </motion.div>

              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-3 w-full"
              >
                {[
                  { num: "1", text: "\u201CCoiffeur demain \u00e0 14h\u201D", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
                  { num: "2", text: "\u201CR\u00e9union lundi 9h et dentiste mardi 16h30\u201D", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
                  { num: "3", text: "Plusieurs \u00e9v\u00e9nements en une seule phrase !", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
                ].map((step) => (
                  <motion.div
                    key={step.num}
                    variants={fadeUp}
                    whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.04)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex items-center gap-4 text-sm text-left rounded-xl px-4 py-3"
                  >
                    <span className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/15 to-violet-500/10 border border-white/5 text-blue-400 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                      </svg>
                    </span>
                    <p className="text-slate-300">{step.text}</p>
                  </motion.div>
                ))}
              </motion.div>

              <motion.button
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.03, boxShadow: "0 12px 40px rgba(59,130,246,0.25)" }}
                whileTap={{ scale: 0.97 }}
                onClick={signIn}
                className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-4 px-6 rounded-2xl hover:bg-gray-50 transition-all shadow-lg shadow-white/5 sm:max-w-xs"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              </motion.button>
            </motion.div>
          ) : (
            /* Logged In View */
            <motion.div
              key="logged-in"
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-5xl pt-3 sm:pt-6"
            >
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="mx-auto flex w-full flex-col items-center gap-5"
              >
                <motion.div
                  variants={fadeUp}
                  className="glass-strong inline-flex items-center gap-1 rounded-full border border-white/8 p-1"
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
