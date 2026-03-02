import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { History } from "@/components/History";
import { UsageBar } from "@/components/UsageBar";

export default function App() {
  const { user, status, signIn, signOut } = useAuth();
  const [usageRefresh, setUsageRefresh] = useState(0);

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom safe-x">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <img
            src="/icon-192.png"
            alt="Vocal2Cal"
            width={28}
            height={28}
            className="w-7 h-7 rounded-md"
          />
          <h1 className="text-lg font-bold text-white">Vocal2Cal</h1>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            {user.image && (
              <img
                src={user.image}
                alt=""
                width={32}
                height={32}
                className="w-8 h-8 rounded-full border border-white/20"
              />
            )}
            <button
              onClick={signOut}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              D&eacute;connexion
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-6 sm:px-6 sm:py-10 md:py-14">
        {status === "loading" ? (
          <div className="flex-1 flex items-center justify-center">
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
          </div>
        ) : !user ? (
          /* Logged Out View */
          <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center w-full max-w-sm sm:max-w-md">
            <div className="space-y-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 text-blue-400"
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
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                Votre agenda, &agrave; la voix
              </h2>
              <p className="text-slate-400 leading-relaxed text-sm sm:text-base">
                Dictez vos &eacute;v&eacute;nements en fran&ccedil;ais et
                Vocal2Cal les ajoute automatiquement &agrave; votre Google
                Agenda.
              </p>
            </div>

            <div className="space-y-3 text-left w-full">
              <div className="flex items-start gap-3 text-sm">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <p className="text-slate-300">
                  &ldquo;Coiffeur demain &agrave; 14h&rdquo;
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <p className="text-slate-300">
                  &ldquo;R&eacute;union lundi 9h et dentiste mardi
                  16h30&rdquo;
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <p className="text-slate-300">
                  Plusieurs &eacute;v&eacute;nements en une seule phrase !
                </p>
              </div>
            </div>

            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium py-3.5 px-6 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all shadow-lg sm:max-w-xs"
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
            </button>
          </div>
        ) : (
          /* Logged In View */
          <div className="flex flex-col items-center gap-8 sm:gap-10 w-full max-w-md sm:max-w-lg pt-4 sm:pt-8">
            <div className="text-center space-y-1">
              <p className="text-slate-400 text-sm">
                Bonjour
                {user.name ? `, ${user.name.split(" ")[0]}` : ""} !
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold text-white">
                Que souhaitez-vous planifier ?
              </h2>
            </div>

            <VoiceRecorder
              onSuccess={() => setUsageRefresh((n) => n + 1)}
            />

            <UsageBar refreshKey={usageRefresh} />

            <div className="w-full border-t border-white/5 pt-6">
              <History />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-600 border-t border-white/5">
        Vocal2Cal — Projet Ynov Web Full-Stack
      </footer>
    </div>
  );
}
