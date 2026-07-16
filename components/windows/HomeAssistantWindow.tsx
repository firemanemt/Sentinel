import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  Power,
  Thermometer,
  Tv,
  Wind,
  Lock,
  Shield,
  RefreshCw,
  Unlink,
  AlertCircle,
  Home,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  light: <Lightbulb className="w-4 h-4" />,
  switch: <Power className="w-4 h-4" />,
  climate: <Thermometer className="w-4 h-4" />,
  media_player: <Tv className="w-4 h-4" />,
  fan: <Wind className="w-4 h-4" />,
  lock: <Lock className="w-4 h-4" />,
  alarm_control_panel: <Shield className="w-4 h-4" />,
  input_boolean: <Power className="w-4 h-4" />,
};

const DOMAIN_LABELS: Record<string, string> = {
  light: "Lights",
  switch: "Switches",
  climate: "Climate",
  media_player: "Media Players",
  fan: "Fans",
  lock: "Locks",
  alarm_control_panel: "Alarms",
  input_boolean: "Helpers",
  sensor: "Sensors",
  binary_sensor: "Binary Sensors",
};

const CONTROLLABLE_DOMAINS = new Set(["light", "switch", "climate", "fan", "lock", "input_boolean", "media_player"]);

function getFriendlyName(entityId: string, attributes: Record<string, unknown>): string {
  const name = attributes.friendly_name;
  if (typeof name === "string") return name;
  return entityId.split(".")[1].replace(/_/g, " ");
}

function isOn(state: string): boolean {
  return ["on", "playing", "home", "unlocked", "open"].includes(state.toLowerCase());
}

export default function HomeAssistantWindow() {
  const [urlInput, setUrlInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [connectError, setConnectError] = useState("");
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(["light", "switch", "climate"]));
  const [brightnessMap, setBrightnessMap] = useState<Record<string, number>>({});

  const { data: status, refetch: refetchStatus } = trpc.homeAssistant.getStatus.useQuery();
  const {
    data: statesByDomain,
    isLoading: statesLoading,
    refetch: refetchStates,
  } = trpc.homeAssistant.states.useQuery(undefined, {
    enabled: !!status?.connected,
    refetchInterval: 30_000,
  });

  const connectMutation = trpc.homeAssistant.connect.useMutation({
    onSuccess: () => { setConnectError(""); setUrlInput(""); setTokenInput(""); refetchStatus(); },
    onError: (err) => setConnectError(err.message),
  });

  const disconnectMutation = trpc.homeAssistant.disconnect.useMutation({
    onSuccess: () => refetchStatus(),
  });

  const toggleMutation = trpc.homeAssistant.toggle.useMutation({
    onSuccess: () => refetchStates(),
  });

  const brightnessMutation = trpc.homeAssistant.setBrightness.useMutation({
    onSuccess: () => refetchStates(),
  });

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  if (!status?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#18BCF2] flex items-center justify-center">
            <Home className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold">Connect Home Assistant</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Enter your Home Assistant URL and a Long-Lived Access Token from your profile settings.
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <Input
            placeholder="http://homeassistant.local:8123"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Long-lived access token…"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && urlInput.trim() && tokenInput.trim()) {
                connectMutation.mutate({ url: urlInput.trim(), token: tokenInput.trim() });
              }
            }}
          />
          {connectError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {connectError}
            </p>
          )}
          <Button
            className="w-full bg-[#18BCF2] hover:bg-[#0ea5d4] text-white"
            onClick={() => connectMutation.mutate({ url: urlInput.trim(), token: tokenInput.trim() })}
            disabled={!urlInput.trim() || !tokenInput.trim() || connectMutation.isPending}
          >
            {connectMutation.isPending ? "Connecting…" : "Connect"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Profile → Security → Long-Lived Access Tokens in Home Assistant
          </p>
        </div>
      </div>
    );
  }

  const domains = Object.keys(statesByDomain ?? {}).sort((a, b) => {
    const order = ["light", "switch", "climate", "media_player", "fan", "lock", "sensor", "binary_sensor"];
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-[#18BCF2]" />
          <span className="text-sm font-medium">Home Assistant</span>
          {statesByDomain && (
            <Badge variant="outline" className="text-xs">
              {Object.values(statesByDomain).flat().length} entities
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchStates()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => disconnectMutation.mutate()}
            title="Disconnect"
          >
            <Unlink className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {statesLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))
          ) : domains.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <Home className="w-8 h-8 opacity-30" />
              <p>No entities found</p>
            </div>
          ) : (
            domains.map((domain) => {
              const entities = statesByDomain![domain];
              const isExpanded = expandedDomains.has(domain);
              const icon = DOMAIN_ICONS[domain] ?? <Power className="w-4 h-4" />;
              const label = DOMAIN_LABELS[domain] ?? domain.replace(/_/g, " ");
              const onCount = entities.filter((e) => isOn(e.state)).length;

              return (
                <div key={domain} className="rounded-lg border border-border/30 overflow-hidden">
                  {/* Domain header */}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
                    onClick={() => toggleDomain(domain)}
                  >
                    <span className="text-muted-foreground">{icon}</span>
                    <span className="text-sm font-medium flex-1 text-left">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {onCount}/{entities.length}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>

                  {/* Entity list */}
                  {isExpanded && (
                    <div className="border-t border-border/20">
                      {entities.map((entity) => {
                        const name = getFriendlyName(entity.entity_id, entity.attributes);
                        const on = isOn(entity.state);
                        const isControllable = CONTROLLABLE_DOMAINS.has(domain);
                        const brightness = (entity.attributes.brightness as number | undefined);
                        const brightnessPercent = brightness != null
                          ? Math.round((brightness / 255) * 100)
                          : null;
                        const currentBrightness = brightnessMap[entity.entity_id] ?? brightnessPercent ?? 100;

                        return (
                          <div
                            key={entity.entity_id}
                            className="px-3 py-2 border-t border-border/10 hover:bg-muted/10 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{name}</p>
                                {domain === "climate" && (
                                  <p className="text-xs text-muted-foreground">
                                    {entity.attributes.current_temperature as number}°F
                                    {entity.attributes.temperature != null && (
                                      <> → {entity.attributes.temperature as number}°F</>
                                    )}
                                  </p>
                                )}
                                {domain === "sensor" && (
                                  <p className="text-xs text-muted-foreground">
                                    {entity.state} {entity.attributes.unit_of_measurement as string ?? ""}
                                  </p>
                                )}
                                {domain === "media_player" && on && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {entity.attributes.media_title as string ?? entity.state}
                                  </p>
                                )}
                              </div>
                              {isControllable ? (
                                <Switch
                                  checked={on}
                                  onCheckedChange={() =>
                                    toggleMutation.mutate({ entityId: entity.entity_id })
                                  }
                                  disabled={toggleMutation.isPending}
                                  className="shrink-0"
                                />
                              ) : (
                                <Badge
                                  variant={on ? "default" : "outline"}
                                  className="text-xs shrink-0"
                                >
                                  {entity.state}
                                </Badge>
                              )}
                            </div>

                            {/* Brightness slider for lights */}
                            {domain === "light" && on && brightnessPercent != null && (
                              <div className="mt-2 flex items-center gap-2">
                                <Lightbulb className="w-3 h-3 text-muted-foreground shrink-0" />
                                <Slider
                                  value={[currentBrightness]}
                                  min={1}
                                  max={100}
                                  step={5}
                                  className="flex-1"
                                  onValueChange={([v]) => {
                                    setBrightnessMap((prev) => ({
                                      ...prev,
                                      [entity.entity_id]: v,
                                    }));
                                  }}
                                  onValueCommit={([v]) => {
                                    brightnessMutation.mutate({
                                      entityId: entity.entity_id,
                                      brightness: v,
                                    });
                                  }}
                                />
                                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                                  {currentBrightness}%
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
