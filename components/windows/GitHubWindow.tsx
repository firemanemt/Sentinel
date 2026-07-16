import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitBranch,
  GitPullRequest,
  CircleDot,
  Bell,
  Star,
  GitFork,
  ExternalLink,
  RefreshCw,
  Unlink,
  Lock,
  Unlock,
  AlertCircle,
} from "lucide-react";

export default function GitHubWindow() {
  const [tokenInput, setTokenInput] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [connectError, setConnectError] = useState("");

  const { data: status, refetch: refetchStatus } = trpc.github.status.useQuery();
  const { data: me } = trpc.github.me.useQuery();
  const {
    data: repos,
    isLoading: reposLoading,
    refetch: refetchRepos,
  } = trpc.github.repos.useQuery({ perPage: 20 }, { enabled: !!status?.connected });

  const { data: prs, isLoading: prsLoading } = trpc.github.pullRequests.useQuery(
    { owner: selectedRepo?.owner ?? "", repo: selectedRepo?.repo ?? "", state: "open" },
    { enabled: !!selectedRepo }
  );

  const { data: issues, isLoading: issuesLoading } = trpc.github.issues.useQuery(
    { owner: selectedRepo?.owner ?? "", repo: selectedRepo?.repo ?? "", state: "open" },
    { enabled: !!selectedRepo }
  );

  const { data: notifications, refetch: refetchNotifications } = trpc.github.notifications.useQuery(
    { all: false },
    { enabled: !!status?.connected }
  );

  const connectMutation = trpc.github.connect.useMutation({
    onSuccess: () => {
      setConnectError("");
      setTokenInput("");
      refetchStatus();
    },
    onError: (err) => setConnectError(err.message),
  });

  const disconnectMutation = trpc.github.disconnect.useMutation({
    onSuccess: () => refetchStatus(),
  });

  const markReadMutation = trpc.github.markNotificationRead.useMutation({
    onSuccess: () => refetchNotifications(),
  });

  const utils = trpc.useUtils();

  if (!status?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-[#24292e] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Connect GitHub</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Enter a Personal Access Token with <code className="bg-muted px-1 rounded text-xs">repo</code> and{" "}
            <code className="bg-muted px-1 rounded text-xs">notifications</code> scopes.
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <Input
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
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
            className="w-full"
            onClick={() => connectMutation.mutate({ token: tokenInput.trim() })}
            disabled={!tokenInput.trim() || connectMutation.isPending}
          >
            {connectMutation.isPending ? "Connecting…" : "Connect"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            <a
              href="https://github.com/settings/tokens/new"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Create a token on GitHub
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-foreground">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          <span className="text-sm font-medium">
            {me ? `@${me.login}` : "GitHub"}
          </span>
          {notifications && notifications.length > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
              {notifications.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => { refetchRepos(); refetchNotifications(); }}
            title="Refresh"
          >
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

      <Tabs defaultValue="repos" className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-4 mt-2 shrink-0 h-8 text-xs">
          <TabsTrigger value="repos" className="text-xs">Repos</TabsTrigger>
          <TabsTrigger value="prs" className="text-xs">
            PRs {selectedRepo ? `(${prs?.length ?? 0})` : ""}
          </TabsTrigger>
          <TabsTrigger value="issues" className="text-xs">
            Issues {selectedRepo ? `(${issues?.length ?? 0})` : ""}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">
            <Bell className="w-3 h-3 mr-1" />
            {notifications?.length ?? 0}
          </TabsTrigger>
        </TabsList>

        {/* Repos */}
        <TabsContent value="repos" className="flex-1 min-h-0 mt-0 px-2 pb-2">
          <ScrollArea className="h-full">
            {reposLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {repos?.map((repo) => {
                  const [owner, name] = repo.full_name.split("/");
                  const isSelected = selectedRepo?.repo === name && selectedRepo?.owner === owner;
                  return (
                    <button
                      key={repo.id}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/30 hover:border-border/60 hover:bg-muted/30"
                      }`}
                      onClick={() => setSelectedRepo({ owner, repo: name })}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {repo.private ? (
                            <Lock className="w-3 h-3 shrink-0 text-muted-foreground" />
                          ) : (
                            <Unlock className="w-3 h-3 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium truncate">{repo.name}</span>
                        </div>
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {repo.language && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary/60" />
                            {repo.language}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" /> {repo.stargazers_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork className="w-3 h-3" /> {repo.forks_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <CircleDot className="w-3 h-3" /> {repo.open_issues_count}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Pull Requests */}
        <TabsContent value="prs" className="flex-1 min-h-0 mt-0 px-2 pb-2">
          <ScrollArea className="h-full">
            {!selectedRepo ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                <GitPullRequest className="w-8 h-8 opacity-30" />
                <p>Select a repository to view PRs</p>
              </div>
            ) : prsLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : prs?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                <GitPullRequest className="w-8 h-8 opacity-30" />
                <p>No open pull requests</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {prs?.map((pr) => (
                  <a
                    key={pr.id}
                    href={pr.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3 rounded-lg border border-border/30 hover:border-border/60 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <GitPullRequest className="w-4 h-4 shrink-0 mt-0.5 text-green-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{pr.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          #{pr.number} by @{pr.user.login} · {pr.head.ref} → {pr.base.ref}
                        </p>
                      </div>
                      {pr.draft && (
                        <Badge variant="outline" className="text-xs shrink-0">Draft</Badge>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Issues */}
        <TabsContent value="issues" className="flex-1 min-h-0 mt-0 px-2 pb-2">
          <ScrollArea className="h-full">
            {!selectedRepo ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                <CircleDot className="w-8 h-8 opacity-30" />
                <p>Select a repository to view issues</p>
              </div>
            ) : issuesLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : issues?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                <CircleDot className="w-8 h-8 opacity-30" />
                <p>No open issues</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {issues?.map((issue) => (
                  <a
                    key={issue.id}
                    href={issue.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-3 rounded-lg border border-border/30 hover:border-border/60 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <CircleDot className="w-4 h-4 shrink-0 mt-0.5 text-green-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{issue.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            #{issue.number} by @{issue.user.login}
                          </span>
                          {issue.labels.map((label) => (
                            <span
                              key={label.name}
                              className="text-xs px-1.5 py-0 rounded-full border"
                              style={{ borderColor: `#${label.color}`, color: `#${label.color}` }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      {issue.comments > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">{issue.comments} 💬</span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="flex-1 min-h-0 mt-0 px-2 pb-2">
          <ScrollArea className="h-full">
            {!notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                <Bell className="w-8 h-8 opacity-30" />
                <p>No unread notifications</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-2 p-3 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    <Bell className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{n.subject.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.repository.full_name} · {n.reason}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => markReadMutation.mutate({ id: n.id })}
                      title="Mark as read"
                    >
                      ✓
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
