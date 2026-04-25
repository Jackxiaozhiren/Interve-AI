"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { User, Bell, ShieldCheck, LockKey, SignOut, EnvelopeSimple, DeviceMobile } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
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
        {/* Profile Information */}
        <Card className="bg-white/60 border border-white/80 shadow-sm backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <CardTitle className="text-lg font-serif flex items-center gap-2 text-slate-800">
              <User className="w-5 h-5 text-sky-500" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your personal details and resume profile.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" defaultValue="Alex" placeholder="Your first name" className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" defaultValue="Chen" placeholder="Your last name" className="bg-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="alex.chen@example.com" placeholder="Your email address" className="bg-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Professional Bio</Label>
              <textarea 
                id="bio" 
                className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-y"
                defaultValue="Software Engineer with 5+ years of experience in React and Node.js. Looking for senior frontend roles."
                placeholder="A brief summary about yourself..."
              />
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100/50 pt-4 bg-slate-50/50 justify-end">
            <Button variant="default" className="bg-slate-900 hover:bg-slate-800 text-white">Save Profile</Button>
          </CardFooter>
        </Card>

        {/* Notifications */}
        <Card className="bg-white/60 border border-white/80 shadow-sm backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4">
            <CardTitle className="text-lg font-serif flex items-center gap-2 text-slate-800">
              <Bell className="w-5 h-5 text-emerald-500" />
              Notifications
            </CardTitle>
            <CardDescription>Manage how you receive alerts and interview reminders.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium text-sm text-slate-800 flex items-center gap-2">
                  <EnvelopeSimple className="w-4 h-4 text-slate-500" /> Email Notifications
                </div>
                <div className="text-sm text-slate-500">Receive weekly summaries and interview transcripts.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium text-sm text-slate-800 flex items-center gap-2">
                  <DeviceMobile className="w-4 h-4 text-slate-500" /> SMS Reminders
                </div>
                <div className="text-sm text-slate-500">Get text message alerts 30 minutes before scheduled mock interviews.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
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
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4 border-b border-slate-100/50 pb-6">
              <h3 className="font-medium text-sm text-slate-800 flex items-center gap-2">
                <LockKey className="w-4 h-4 text-slate-500" /> Change Password
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" placeholder="••••••••" className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" placeholder="••••••••" className="bg-white" />
                </div>
              </div>
              <Button variant="outline" className="mt-2 text-sm">Update Password</Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium text-sm text-slate-800">Sign out of all devices</div>
                <div className="text-sm text-slate-500">This will log you out of any active sessions on other browsers or devices.</div>
              </div>
              <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                <SignOut className="w-4 h-4 mr-2" />
                Sign Out All
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
                { keys: "Ctrl / ⌘ + S", desc: "保存设置" },
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
