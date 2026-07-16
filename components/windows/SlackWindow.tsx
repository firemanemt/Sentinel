import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Hash, Lock, Send, RefreshCw, Unlink, AlertCircle, ChevronLeft } from "lucide-react";

export default function SlackWindow() {
  const [tokenInput, setTokenInput] = useState("");
  const [connectError, setConnectError] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedChannelName, setSelectedChannelName] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: status, refetch: refetchStatus } = trpc.slack.status.useQuery();
  const { data: workspace } = trpc.slack.workspace.useQuery();
  const { data: channels, isLoading: channelsLoading } = trpc.slack.channels.useQuery(
    undefined,
    { enabled: !!status?.connected }
  );
  const {
    data: messages,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = trpc.slack.messages.useQuery(
    { channelId: selectedChannelId ?? "", limit: 30 },
    { enabled: !!selectedChannelId, refetchInterval: 15_000 }
  );

  const connectMutation = trpc.slack.connect.useMutation({
    onSuccess: () => { setConnectError(""); setTokenInput(""); refetchStatus(); },
    onError: (err) => setConnectError(err.message),
  });

  const disconnectMutation = trpc.slack.disconnect.useMutation({
    onSuccess: () => { refetchStatus(); setSelectedChannelId(null); },
  });

  const sendMutation = trpc.slack.sendMessage.useMutation({
    onSuccess: () => { setMessageInput(""); refetchMessages(); },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!status?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#4A154B] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Connect Slack</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Enter a Slack Bot Token (<code className="bg-muted px-1 rounded text-xs">xoxb-…</code>) with{" "}
            <code className="bg-muted px-1 rounded text-xs">channels:read</code> and{" "}
            <code className="bg-muted px-1 rounded text-xs">chat:write</code> scopes.
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <Input
            type="password"
            placeholder="xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tokenInput.trim()) {
                connectMutation.mutate({ token: tokenInput.trim() });
              }
            }}
          />
          {connectError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {connectError}
            </p>
          )}
          <Button
            className="w-full bg-[#4A154B] hover:bg-[#3a1039]"
            onClick={() => connectMutation.mutate({ token: tokenInput.trim() })}
            disabled={!tokenInput.trim() || connectMutation.isPending}
          >
            {connectMutation.isPending ? "Connecting…" : "Connect"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Create a Slack app to get a bot token
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          {selectedChannelId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setSelectedChannelId(null); setSelectedChannelName(""); }}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
          )}
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#4A154B]">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
          <span className="text-sm font-medium">
            {selectedChannelId
              ? `#${selectedChannelName}`
              : workspace?.name ?? "Slack"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {selectedChannelId && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchMessages()}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
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

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Channel list */}
        {!selectedChannelId && (
          <ScrollArea className="h-full">
            {channelsLoading ? (
              <div className="space-y-1 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-0.5 p-3">
                <p className="text-xs text-muted-foreground px-1 mb-2">Channels</p>
                {channels?.map((ch) => (
                  <button
                    key={ch.id}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted/40 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setSelectedChannelId(ch.id);
                      setSelectedChannelName(ch.name);
                    }}
                  >
                    {ch.is_private ? (
                      <Lock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Hash className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm truncate">{ch.name}</span>
                    {ch.num_members > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        {ch.num_members}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {/* Messages */}
        {selectedChannelId && (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-2">
                {messagesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-2">
                      <Skeleton className="w-7 h-7 rounded shrink-0" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))
                ) : (
                  [...(messages ?? [])].reverse().map((msg) => (
                    <div key={msg.ts} className="flex gap-2">
                      <div className="w-7 h-7 rounded bg-muted shrink-0 flex items-center justify-center">
                        <span className="text-xs font-bold">
                          {(msg.username ?? msg.user ?? "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold">
                            {msg.username ?? msg.user ?? "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {msg.text && (
                          <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                        )}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {msg.reactions.map((r) => (
                              <span
                                key={r.name}
                                className="text-xs bg-muted/50 border border-border/30 rounded px-1.5 py-0.5"
                              >
                                :{r.name}: {r.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="p-2 border-t border-border/40 shrink-0 flex gap-2">
              <Input
                placeholder={`Message #${selectedChannelName}`}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && messageInput.trim()) {
                    sendMutation.mutate({ channelId: selectedChannelId, text: messageInput.trim() });
                  }
                }}
                className="text-sm h-8"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0 bg-[#4A154B] hover:bg-[#3a1039]"
                onClick={() => {
                  if (messageInput.trim()) {
                    sendMutation.mutate({ channelId: selectedChannelId, text: messageInput.trim() });
                  }
                }}
                disabled={!messageInput.trim() || sendMutation.isPending}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
