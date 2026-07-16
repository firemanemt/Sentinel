import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Hash, Send, RefreshCw, Unlink, AlertCircle, ChevronLeft } from "lucide-react";

export default function DiscordWindow() {
  const [tokenInput, setTokenInput] = useState("");
  const [connectError, setConnectError] = useState("");
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedChannelName, setSelectedChannelName] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: status, refetch: refetchStatus } = trpc.discord.status.useQuery();
  const { data: guilds, isLoading: guildsLoading } = trpc.discord.guilds.useQuery(
    undefined,
    { enabled: !!status?.connected }
  );
  const { data: channels, isLoading: channelsLoading } = trpc.discord.channels.useQuery(
    { guildId: selectedGuildId ?? "" },
    { enabled: !!selectedGuildId }
  );
  const {
    data: messages,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = trpc.discord.messages.useQuery(
    { channelId: selectedChannelId ?? "", limit: 30 },
    { enabled: !!selectedChannelId, refetchInterval: 15_000 }
  );

  const connectMutation = trpc.discord.connect.useMutation({
    onSuccess: () => { setConnectError(""); setTokenInput(""); refetchStatus(); },
    onError: (err) => setConnectError(err.message),
  });

  const disconnectMutation = trpc.discord.disconnect.useMutation({
    onSuccess: () => { refetchStatus(); setSelectedGuildId(null); setSelectedChannelId(null); },
  });

  const sendMutation = trpc.discord.sendMessage.useMutation({
    onSuccess: () => { setMessageInput(""); refetchMessages(); },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedGuild = guilds?.find((g) => g.id === selectedGuildId);

  if (!status?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-[#5865F2] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Connect Discord Bot</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Enter your Discord Bot Token to read channels and messages from your servers.
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <Input
            type="password"
            placeholder="Bot token…"
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
            className="w-full bg-[#5865F2] hover:bg-[#4752c4]"
            onClick={() => connectMutation.mutate({ token: tokenInput.trim() })}
            disabled={!tokenInput.trim() || connectMutation.isPending}
          >
            {connectMutation.isPending ? "Connecting…" : "Connect"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Get a bot token from Discord Developer Portal
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
          {selectedGuildId && !selectedChannelId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSelectedGuildId(null)}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
          )}
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#5865F2]">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          <span className="text-sm font-medium">
            {selectedChannelId
              ? `#${selectedChannelName}`
              : selectedGuild
              ? selectedGuild.name
              : "Discord"}
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
        {/* Guild list */}
        {!selectedGuildId && (
          <ScrollArea className="h-full">
            {guildsLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-1 p-3">
                <p className="text-xs text-muted-foreground px-1 mb-2">Your Servers</p>
                {guilds?.map((guild) => (
                  <button
                    key={guild.id}
                    className="w-full text-left p-3 rounded-lg border border-border/30 hover:border-border/60 hover:bg-muted/30 transition-colors flex items-center gap-3"
                    onClick={() => setSelectedGuildId(guild.id)}
                  >
                    {guild.icon ? (
                      <img
                        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=48`}
                        alt={guild.name}
                        className="w-8 h-8 rounded-full shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">
                          {guild.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{guild.name}</p>
                      {guild.approximate_member_count && (
                        <p className="text-xs text-muted-foreground">
                          {guild.approximate_member_count.toLocaleString()} members
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {/* Channel list */}
        {selectedGuildId && !selectedChannelId && (
          <ScrollArea className="h-full">
            {channelsLoading ? (
              <div className="space-y-1 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-0.5 p-3">
                <p className="text-xs text-muted-foreground px-1 mb-2">Text Channels</p>
                {channels?.map((channel) => (
                  <button
                    key={channel.id}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted/40 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setSelectedChannelId(channel.id);
                      setSelectedChannelName(channel.name);
                    }}
                  >
                    <Hash className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate">{channel.name}</span>
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
                      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))
                ) : (
                  [...(messages ?? [])].reverse().map((msg) => (
                    <div key={msg.id} className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted shrink-0 flex items-center justify-center">
                        {msg.author.avatar ? (
                          <img
                            src={`https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=32`}
                            alt={msg.author.username}
                            className="w-7 h-7 rounded-full"
                          />
                        ) : (
                          <span className="text-xs font-bold">
                            {msg.author.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold">
                            {msg.author.bot ? `🤖 ${msg.author.username}` : msg.author.username}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {msg.content && (
                          <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                        )}
                        {msg.embeds?.map((embed, i) => (
                          <div key={i} className="mt-1 pl-2 border-l-2 border-primary/40">
                            {embed.title && <p className="text-xs font-semibold">{embed.title}</p>}
                            {embed.description && (
                              <p className="text-xs text-muted-foreground truncate">{embed.description}</p>
                            )}
                          </div>
                        ))}
                        {msg.attachments?.map((att) => (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary underline underline-offset-2"
                          >
                            📎 {att.filename}
                          </a>
                        ))}
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
                    sendMutation.mutate({ channelId: selectedChannelId, content: messageInput.trim() });
                  }
                }}
                className="text-sm h-8"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0 bg-[#5865F2] hover:bg-[#4752c4]"
                onClick={() => {
                  if (messageInput.trim()) {
                    sendMutation.mutate({ channelId: selectedChannelId, content: messageInput.trim() });
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
