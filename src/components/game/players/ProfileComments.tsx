"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { Flag, MessageSquareReply, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { communicationFetch } from "~/components/game/communication/useCommunication";
import { timeAgo } from "~/game/communication";
import { MAX_COMMENT_LENGTH, playerProfileHref } from "~/game/players";
import {
  DEFAULT_PLAYER_AVATAR,
  getPlayerAvatarBySrc,
} from "~/lib/player-avatars";
import { cn } from "~/lib/utils";
import type { ProfileCommentPage, ProfileCommentView } from "~/server/players";

type Pages = InfiniteData<ProfileCommentPage, number | null>;

const commentsKey = (profileId: string) =>
  ["players", profileId, "comments"] as const;

const iconButtonClass =
  "grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50";

/** "3 minutes ago", worked out in the browser so it matches the reader's clock. */
function When({ at }: { at: string }) {
  const [text, setText] = useState("");
  useEffect(() => setText(timeAgo(at)), [at]);
  return (
    <time dateTime={at} className="shrink-0 text-[11px] text-muted-foreground">
      {text}
    </time>
  );
}

function Portrait({
  image,
  size,
}: {
  image: string | null;
  size: "md" | "sm";
}) {
  const avatar = getPlayerAvatarBySrc(image) ?? DEFAULT_PLAYER_AVATAR;
  return (
    <Image
      src={avatar.src}
      alt=""
      width={80}
      height={80}
      className={cn(
        "shrink-0 rounded-[8px] bg-secondary/40 object-contain",
        size === "md" ? "h-10 w-10" : "h-8 w-8",
      )}
    />
  );
}

function Composer({
  profileId,
  parentId,
  placeholder,
  autoFocus,
  onPosted,
  onCancel,
}: {
  profileId: string;
  parentId?: number;
  placeholder: string;
  autoFocus?: boolean;
  onPosted?: () => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();

  const post = useMutation({
    mutationFn: () =>
      communicationFetch<ProfileCommentView>(
        `/api/players/${encodeURIComponent(profileId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, parentId }),
        },
      ),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: commentsKey(profileId) });
      onPosted?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ready = body.trim().length > 0 && !post.isPending;

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) post.mutate();
      }}
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (ready) post.mutate();
          }
        }}
        maxLength={MAX_COMMENT_LENGTH}
        rows={parentId ? 2 : 3}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className="w-full resize-none rounded-[8px] bg-surface-inset/70 px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {body.length > 0 ? `${body.length} / ${MAX_COMMENT_LENGTH}` : null}
        </span>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={!ready}>
            {post.isPending ? "Posting…" : parentId ? "Reply" : "Post"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ReportBox({
  profileId,
  comment,
  onClose,
}: {
  profileId: string;
  comment: ProfileCommentView;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const report = useMutation({
    mutationFn: () =>
      communicationFetch(
        `/api/players/${encodeURIComponent(profileId)}/comments/${comment.id}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      ),
    onSuccess: () => {
      onClose();
      toast.success("Reported. A moderator will read this comment.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-2 grid gap-2 rounded-[8px] bg-destructive/10 p-3">
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="What is wrong here? (optional)"
        maxLength={MAX_COMMENT_LENGTH}
        className="h-9 text-[13px]"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={report.isPending}
          onClick={() => report.mutate()}
        >
          {report.isPending ? "Reporting…" : "Report comment"}
        </Button>
      </div>
    </div>
  );
}

function Comment({
  profileId,
  comment,
  reply,
  canReply,
  onReply,
}: {
  profileId: string;
  comment: ProfileCommentView;
  /** A reply inside a thread: smaller, and it has no replies of its own. */
  reply?: boolean;
  canReply: boolean;
  onReply: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () =>
      communicationFetch(
        `/api/players/${encodeURIComponent(profileId)}/comments/${comment.id}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.setQueryData<Pages>(commentsKey(profileId), (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                comments: page.comments
                  .filter((entry) => entry.id !== comment.id)
                  .map((entry) => ({
                    ...entry,
                    replies: entry.replies.filter(
                      (entry) => entry.id !== comment.id,
                    ),
                  })),
              })),
            }
          : data,
      );
      void queryClient.invalidateQueries({ queryKey: commentsKey(profileId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <article
      id={`comment-${comment.id}`}
      className="flex scroll-mt-24 gap-3"
      aria-label={`${comment.author.name}'s comment`}
    >
      <Link
        href={playerProfileHref(comment.author.name)}
        className="shrink-0 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Portrait image={comment.author.image} size={reply ? "sm" : "md"} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-8 items-center gap-2">
          <Link
            href={playerProfileHref(comment.author.name)}
            className="truncate text-[13px] font-semibold text-primary hover:underline"
          >
            {comment.author.name}
          </Link>
          <When at={comment.createdAt} />
          <div className="ml-auto flex shrink-0 items-center">
            {confirming ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirming(false)}
                >
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  Remove
                </Button>
              </>
            ) : (
              <>
                {comment.canReport ? (
                  <button
                    type="button"
                    onClick={() => setReporting((open) => !open)}
                    className={cn(
                      iconButtonClass,
                      reporting ? "text-destructive" : "hover:text-destructive",
                    )}
                    title="Report"
                  >
                    <Flag size={14} aria-hidden="true" />
                    <span className="sr-only">Report this comment</span>
                  </button>
                ) : null}
                {comment.canDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className={cn(iconButtonClass, "hover:text-destructive")}
                    title="Remove"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    <span className="sr-only">Remove this comment</span>
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
        <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-text-secondary">
          {comment.body}
        </p>
        {canReply ? (
          <button
            type="button"
            onClick={onReply}
            className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-md text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <MessageSquareReply size={13} aria-hidden="true" />
            Reply
          </button>
        ) : null}
        {reporting ? (
          <ReportBox
            profileId={profileId}
            comment={comment}
            onClose={() => setReporting(false)}
          />
        ) : null}
      </div>
    </article>
  );
}

function Thread({
  profileId,
  comment,
}: {
  profileId: string;
  comment: ProfileCommentView;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li className="rounded-xl bg-surface-inset/40 p-3 sm:p-4">
      <Comment
        profileId={profileId}
        comment={comment}
        canReply
        onReply={() => setReplying(true)}
      />
      {comment.replies.length > 0 || replying ? (
        <div className="mt-3 grid gap-3 pl-[52px]">
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              profileId={profileId}
              comment={reply}
              reply
              canReply
              onReply={() => setReplying(true)}
            />
          ))}
          {replying ? (
            <Composer
              profileId={profileId}
              parentId={comment.id}
              placeholder={`Reply to ${comment.author.name}`}
              autoFocus
              onPosted={() => setReplying(false)}
              onCancel={() => setReplying(false)}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** The comment wall under a profile, newest thread first. */
export function ProfileComments({
  profileId,
  profileName,
  isOwner,
  initialPage,
}: {
  profileId: string;
  profileName: string;
  isOwner: boolean;
  initialPage: ProfileCommentPage;
}) {
  const query = useInfiniteQuery({
    queryKey: commentsKey(profileId),
    queryFn: ({ pageParam }) =>
      communicationFetch<ProfileCommentPage>(
        `/api/players/${encodeURIComponent(profileId)}/comments${
          pageParam ? `?cursor=${pageParam}` : ""
        }`,
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => page.nextCursor,
    initialData: { pages: [initialPage], pageParams: [null] },
    staleTime: 30_000,
  });

  // A notification links straight to one comment; bring it into view.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;
    document.querySelector(hash)?.scrollIntoView({ block: "center" });
  }, []);

  const comments = query.data?.pages.flatMap((page) => page.comments) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <section
      id="comments"
      aria-labelledby="comments-heading"
      className="game-panel-flat mt-5 min-w-0 scroll-mt-24 p-4 sm:p-6"
    >
      <div className="mb-4 flex items-baseline gap-2">
        <h2 id="comments-heading" className="game-section-title">
          Comments
        </h2>
        {total > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {total}
          </span>
        ) : null}
      </div>

      <div className="mb-5">
        <Composer
          profileId={profileId}
          placeholder={
            isOwner ? "Write on your profile" : `Write to ${profileName}`
          }
        />
      </div>

      {comments.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          No comments yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {comments.map((comment) => (
            <Thread key={comment.id} profileId={profileId} comment={comment} />
          ))}
        </ul>
      )}

      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
