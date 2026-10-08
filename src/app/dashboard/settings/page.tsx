"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Bell, ShieldCheck, LockKey, SignOut, GlobeHemisphereWest, PersonArmsSpread } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  // Phase 6 (V2): preferences wired to real, persisted stores — no
  // decorative toggles. LanguageContext persists `interve-lang`;
  // useAccessibilityStore persists `accessibility-storage`.
  const { lang, setLang, t } = useLanguage();
  const { user, logout } = useAuth();
  const {
    isCalmMode,
    toggleCalmMode,
    isLiveCaptionsEnabled,
    toggleLiveCaptions,
    isDyslexiaMode,
    toggleDyslexiaMode,
    showLiveInsights,
    toggleLiveInsights,
  } = useAccessibilityStore();
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-slate-900 tracking-tight">Settings</h1>
        <p className="text-slate-500 mt-2">Manage your account preferences and configurations.</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid gap-6"
      >
        {/* Phase 6 (V2): Language + Accessibility — real preferences.
            Every control below writes to a persisted store on click. */}
        <Card className="bg-white/60 border border-white/80 shadow-sm backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <CardTitle className="text-lg font-serif flex items-center gap-2 text-slate-800">
              <GlobeHemisphereWest className="w-5 h-5 text-sky-500" />
              {t.settings.language} · {t.settings.accessibility}
            </CardTitle>
            <CardDescription>{t.settings.languageDesc} {t.settings.accessibilityDesc}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="font-medium text-sm text-slate-800">{t.settings.language}</div>
                <div className="text-sm text-slate-500">{t.settings.languageDesc}</div>
              </div>
              <div className="flex gap-2 shrink-0" role="group" aria-label={t.settings.language}>
                <Button
                  variant={lang === "en" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLang("en")}
                  aria-pressed={lang === "en"}
                  className={lang === "en" ? "bg-slate-900 hover:bg-slate-800 text-white" : ""}
                >
                  {t.settings.english}
                </Button>
                <Button
                  variant={lang === "zh" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLang("zh")}
                  aria-pressed={lang === "zh"}
                  className={lang === "zh" ? "bg-slate-900 hover:bg-slate-800 text-white" : ""}
                >
                  {t.settings.chinese}
                </Button>
              </div>
            </div>
            {([
              { key: "calmMode", desc: "calmModeDesc", on: isCalmMode, toggle: toggleCalmMode },
              { key: "liveCaptions", desc: "liveCaptionsDesc", on: isLiveCaptionsEnabled, toggle: toggleLiveCaptions },
              { key: "dyslexiaMode", desc: "dyslexiaModeDesc", on: isDyslexiaMode, toggle: toggleDyslexiaMode },
              { key: "liveInsights", desc: "liveInsightsDesc", on: showLiveInsights, toggle: toggleLiveInsights },
            ] as const).map(({ key, desc, on, toggle }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-medium text-sm text-slate-800 flex items-center gap-2">
                    <PersonArmsSpread className="w-4 h-4 text-slate-500" />
                    {t.settings[key]}
                  </div>
                  <div className="text-sm text-slate-500">{t.settings[desc]}</div>
                </div>
                <Button
                  variant={on ? "default" : "outline"}
                  size="sm"
                  onClick={toggle}
                  aria-pressed={on}
                  aria-label={`${t.settings[key]}: ${on ? t.settings.on : t.settings.off}`}
                  className={on ? "bg-slate-900 hover:bg-slate-800 text-white min-w-16" : "min-w-16"}
                >
                  {on ? t.settings.on : t.settings.off}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/*
          Sign-in identity. This card used to prefill a whole stranger: "Alex",
          "Chen", alex.chen@example.com and a five-year React/Node bio, above a
          "Save Profile" button with no handler, no form and no store — the file
          has no useState and no persistence call anywhere in it. So the page a
          signed-in user opens to see what the product knows about them showed
          invented personal data as if it were theirs, next to an action that
          could not happen. Two fields is all the session carries; both are shown
          read-only, and the edit path is named as absent instead of faked.
        */}
        <Card className="bg-white/60 border border-white/80 shadow-sm backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <CardTitle className="text-lg font-serif flex items-center gap-2 text-slate-800">
              <User className="w-5 h-5 text-sky-500" />
              Sign-in identity
            </CardTitle>
            <CardDescription>What this browser&apos;s session carries. Editing waits for credential sign-in.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identityEmail">Email</Label>
              <Input id="identityEmail" type="email" value={user?.email ?? "not signed in"} readOnly aria-readonly className="bg-slate-50 text-slate-600" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identityUsername">Display name</Label>
              <Input id="identityUsername" value={user?.username ?? ""} readOnly aria-readonly className="bg-slate-50 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        {/*
          The two toggles here were `defaultChecked` checkboxes with no onChange,
          no handler and no store — they held a value only until the page
          reloaded, and the app has no mailer and no SMS provider, so no alert can
          be sent by any path in it. The accessibility and language toggles above
          are the real ones: they write to persisted stores. Deleting the section
          is a product call; claiming a channel the product cannot use is not.
        */}
        <Card className="bg-white/60 border border-white/80 shadow-sm backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <CardTitle className="text-lg font-serif flex items-center gap-2 text-slate-800">
              <Bell className="w-5 h-5 text-emerald-500" />
              Notifications
            </CardTitle>
            <CardDescription>Nothing is sent yet.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">
              This app has no email sender and no SMS provider, so there are no reminders to switch on.
              Weekly summaries, transcripts and interview results appear in the dashboard instead.
            </p>
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card className="bg-white/60 border border-white/80 shadow-sm backdrop-blur-xl border-red-100/50">
          <CardHeader className="border-b border-red-50 pb-4">
            <CardTitle className="text-lg font-serif flex items-center gap-2 text-slate-800">
              <ShieldCheck className="w-5 h-5 text-rose-500" />
              Account Security
            </CardTitle>
            <CardDescription>Manage your password and active sessions.</CardDescription>
          </CardHeader>
          {/*
            "Change Password" and "Sign out of all devices" were both inert. The
            first had two password inputs and a button with no handler, on an app
            that stores no credential at all — the `demo-auth: unverified-mint`
            line in docs/SECURITY.md is the record — which is the most damaging
            kind of dead control, because a user who clicked it would reasonably
            believe a password had been rotated. The second promised to revoke
            sessions on other devices, but the model is one HttpOnly cookie per
            browser with no way to enumerate or revoke another one. Signing this
            browser out is real, so that is what stays, and it is wired.
          */}
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-1">
              <h3 className="font-medium text-sm text-slate-800 flex items-center gap-2">
                <LockKey className="w-4 h-4 text-slate-500" /> Password
              </h3>
              <p className="text-sm text-slate-500">
                There is no password to change yet: sign-in is a demo session, not a credential.
                Passwords and email verification arrive together, with the account cutover.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="font-medium text-sm text-slate-800">Sign out of this browser</div>
                <div className="text-sm text-slate-500">Clears this device&apos;s session. Other browsers keep theirs — this app cannot see or revoke them.</div>
              </div>
              <Button
                variant="outline"
                className="shrink-0 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => void logout()}
              >
                <SignOut className="w-4 h-4 mr-2" aria-hidden />
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card className="bg-white/60 border border-white/80 shadow-sm backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <CardTitle className="text-lg font-serif flex items-center gap-2 text-slate-800">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
              </svg>
              Keyboard Shortcuts
            </CardTitle>
            <CardDescription>Global shortcuts available throughout the application.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-3">
              {[
                { keys: "Ctrl / ⌘ + K", desc: "聚焦搜索框" },
                { keys: "Ctrl / ⌘ + N", desc: "新建对话" },
                { keys: "Esc", desc: "关闭当前弹窗 / 抽屉" },
                { keys: "Enter", desc: "发送消息" },
                { keys: "Shift + Enter", desc: "输入框换行" },
                { keys: "Ctrl / ⌘ + S", desc: "提交本页表单（有提交按钮时）" },
              ].map(({ keys, desc }) => (
                <div key={keys} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/50">
                  <span className="text-sm text-slate-600">{desc}</span>
                  <kbd className="px-2.5 py-1 text-xs font-mono bg-slate-100 text-slate-600 rounded-md border border-slate-200 shadow-sm">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );
}
