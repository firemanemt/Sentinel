import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle2,
  Zap,
  Shield,
  Calendar,
  Music,
  Github,
  MessageSquare,
  Home,
  Mic,
  Sun,
  ArrowLeft,
  Loader2,
  ExternalLink,
} from "lucide-react";

const FREE_FEATURES = [
  { icon: Shield, label: "SENTINEL AI assistant" },
  { icon: Calendar, label: "1 calendar integration" },
  { icon: CheckCircle2, label: "Basic reminders & facts" },
  { icon: Sun, label: "Weather & news" },
];

const PRO_FEATURES = [
  { icon: Shield, label: "Everything in Free" },
  { icon: Calendar, label: "Unlimited calendar integrations" },
  { icon: Music, label: "Spotify music control" },
  { icon: Github, label: "GitHub repository access" },
  { icon: MessageSquare, label: "Slack & Discord integration" },
  { icon: Home, label: "Home Assistant smart home" },
  { icon: Mic, label: "Voice commands (TTS/STT)" },
  { icon: Sun, label: "Morning briefings" },
  { icon: Zap, label: "Priority support" },
];

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: billing, isLoading } = trpc.billing.status.useQuery(undefined, {
    enabled: !!user,
  });

  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      toast.info("Redirecting to Stripe checkout…");
    },
    onError: (err) => {
      toast.error(`Checkout failed: ${err.message}`);
    },
  });

  const portalMutation = trpc.billing.createPortal.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      toast.info("Opening billing portal…");
    },
    onError: (err) => {
      toast.error(`Portal failed: ${err.message}`);
    },
  });

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      toast.success("Subscription activated! Welcome to Sentinel Pro.");
      window.history.replaceState({}, "", "/billing");
    } else if (params.get("canceled") === "1") {
      toast.info("Checkout canceled. Your plan was not changed.");
      window.history.replaceState({}, "", "/billing");
    }
  }, []);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const isPro = billing?.plan === "pro";
  const periodEnd = billing?.periodEnd ? new Date(billing.periodEnd).toLocaleDateString() : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to SENTINEL
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-lg font-semibold tracking-wide">Billing & Subscription</h1>
          {isPro && (
            <Badge className="ml-auto bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
              <Zap className="w-3 h-3 mr-1" />
              PRO
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Current plan banner */}
        {isPro && (
          <div className="mb-8 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-cyan-400 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Sentinel Pro — Active
              </p>
              {periodEnd && (
                <p className="text-sm text-muted-foreground mt-1">
                  Renews on {periodEnd}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            >
              {portalMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Manage Subscription
                </>
              )}
            </Button>
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <div
            className={`rounded-xl border p-6 flex flex-col ${
              !isPro
                ? "border-cyan-500/50 bg-cyan-500/5 ring-1 ring-cyan-500/30"
                : "border-border/40 bg-card/30"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Free</h2>
                <p className="text-muted-foreground text-sm mt-1">Get started with SENTINEL</p>
              </div>
              {!isPro && (
                <Badge variant="secondary" className="text-xs">Current Plan</Badge>
              )}
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground ml-1">/month</span>
            </div>

            <ul className="space-y-3 flex-1 mb-6">
              {FREE_FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>

            <Button variant="outline" disabled className="w-full">
              {isPro ? "Downgrade" : "Current Plan"}
            </Button>
          </div>

          {/* Pro Plan */}
          <div
            className={`rounded-xl border p-6 flex flex-col relative overflow-hidden ${
              isPro
                ? "border-cyan-500/50 bg-cyan-500/5 ring-1 ring-cyan-500/30"
                : "border-border/40 bg-card/30"
            }`}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />

            <div className="flex items-start justify-between mb-4 relative">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Pro
                  <Zap className="w-4 h-4 text-cyan-400" />
                </h2>
                <p className="text-muted-foreground text-sm mt-1">Full SENTINEL experience</p>
              </div>
              {isPro ? (
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                  Recommended
                </Badge>
              )}
            </div>

            <div className="mb-6 relative">
              <span className="text-4xl font-bold">$14.99</span>
              <span className="text-muted-foreground ml-1">/month</span>
            </div>

            <ul className="space-y-3 flex-1 mb-6 relative">
              {PRO_FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>

            {isPro ? (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 relative"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Manage Subscription
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold relative"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Upgrade to Pro
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Test card note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Test payments: use card <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code> with any future expiry and any CVC.
        </p>
      </div>
    </div>
  );
}
