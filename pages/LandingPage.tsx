import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Zap,
  Calendar,
  Music,
  Github,
  MessageSquare,
  Home,
  Mic,
  Sun,
  ChevronRight,
  Star,
  Globe,
  Lock,
  Cpu,
} from "lucide-react";

const FEATURES = [
  {
    icon: Cpu,
    title: "AI-Powered Intelligence",
    description: "Sentinel understands natural language. Ask it anything — it reasons, remembers, and acts on your behalf.",
  },
  {
    icon: Calendar,
    title: "Unified Calendar",
    description: "Connect Google Calendar, Outlook, and Apple Calendar. See all your events in one place and create new ones by voice.",
  },
  {
    icon: Music,
    title: "Music Control",
    description: "Control Spotify playback, search for tracks, and manage your queue without leaving the interface.",
  },
  {
    icon: Github,
    title: "GitHub Integration",
    description: "Browse repositories, check pull requests, and get notified about issues — all from your assistant.",
  },
  {
    icon: MessageSquare,
    title: "Slack & Discord",
    description: "Send messages, check channels, and stay connected to your teams without switching apps.",
  },
  {
    icon: Home,
    title: "Smart Home",
    description: "Control lights, thermostats, and devices through Home Assistant integration.",
  },
  {
    icon: Mic,
    title: "Voice Commands",
    description: "Speak naturally. Sentinel listens, transcribes, and responds with a realistic AI voice.",
  },
  {
    icon: Sun,
    title: "Morning Briefings",
    description: "Start every day with a personalized briefing: weather, calendar, news, reminders, and more.",
  },
];

const STATS = [
  { value: "8+", label: "Integrations" },
  { value: "100%", label: "Private" },
  { value: "24/7", label: "Always On" },
  { value: "1 app", label: "Everything" },
];

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#050a0f] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050a0f]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-bold text-lg tracking-wider">SENTINEL</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-white/70 hover:text-white"
            >
              Sign In
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/billing")}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          <Badge
            variant="outline"
            className="mb-6 border-cyan-500/30 text-cyan-400 bg-cyan-500/5 px-4 py-1.5 text-xs tracking-widest uppercase"
          >
            <Zap className="w-3 h-3 mr-2" />
            Intelligent Assistant Platform
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight tracking-tight">
            Your personal{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              AI command center
            </span>
          </h1>

          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            Sentinel connects all your tools — calendars, music, GitHub, smart home, and more — into a single intelligent interface that understands you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/")}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-8 h-12 text-base"
            >
              Launch Sentinel
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/billing")}
              className="border-white/20 text-white/70 hover:text-white hover:border-white/40 px-8 h-12 text-base"
            >
              View Pricing
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="max-w-3xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-1">{value}</div>
              <div className="text-sm text-white/50">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything you need, unified</h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Stop switching between apps. Sentinel brings your entire digital life into one intelligent interface.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:border-cyan-500/20 hover:bg-cyan-500/[0.03] transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="font-semibold mb-2 text-sm">{title}</h3>
                <p className="text-white/50 text-xs leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl border border-white/5 bg-white/[0.02]">
              <Lock className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Private by Design</h3>
              <p className="text-white/50 text-sm">Your data stays yours. Tokens are stored encrypted and never shared.</p>
            </div>
            <div className="text-center p-6 rounded-xl border border-white/5 bg-white/[0.02]">
              <Globe className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Works Everywhere</h3>
              <p className="text-white/50 text-sm">Fully responsive — desktop, tablet, or mobile. Your assistant goes where you go.</p>
            </div>
            <div className="text-center p-6 rounded-xl border border-white/5 bg-white/[0.02]">
              <Star className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Always Improving</h3>
              <p className="text-white/50 text-sm">New integrations and features ship regularly. Your subscription includes everything.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Simple pricing</h2>
          <p className="text-white/50 text-lg mb-10">
            Start free. Upgrade when you're ready for the full experience.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-10">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="text-xl font-bold mb-1">Free</h3>
              <p className="text-white/50 text-sm mb-4">Get started with the basics</p>
              <div className="text-3xl font-bold mb-6">$0<span className="text-white/40 text-base font-normal">/mo</span></div>
              <Button
                variant="outline"
                className="w-full border-white/20 text-white/70 hover:text-white"
                onClick={() => navigate("/")}
              >
                Launch App
              </Button>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
              <h3 className="text-xl font-bold mb-1 flex items-center gap-2 relative">
                Pro <Zap className="w-4 h-4 text-cyan-400" />
              </h3>
              <p className="text-white/50 text-sm mb-4 relative">Everything unlocked</p>
              <div className="text-3xl font-bold mb-6 relative">$14.99<span className="text-white/40 text-base font-normal">/mo</span></div>
              <Button
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold relative"
                onClick={() => navigate("/billing")}
              >
                <Zap className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-4xl font-bold mb-4">Ready to meet Sentinel?</h2>
          <p className="text-white/50 text-lg mb-8">
            Your intelligent assistant is one click away.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/")}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-10 h-12 text-base"
          >
            Launch Sentinel
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-white/30 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400/50" />
            <span>SENTINEL AI</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate("/billing")} className="hover:text-white/60 transition-colors">Pricing</button>
            <button onClick={() => navigate("/")} className="hover:text-white/60 transition-colors">App</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
