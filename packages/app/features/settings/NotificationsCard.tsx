"use client";

import { Bell, Save } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * NotificationsCard — Boar-style card sized for a single input. No big
 * metric or bar; the email field IS the body. Save state mirrors the
 * other two cards so the three feel like one form.
 */

export interface NotificationsCardProps {
  email: string;
  onChange: (next: string) => void;
  onSave: () => void;
  dirty: boolean;
  justSaved: boolean;
}

export function NotificationsCard({
  email,
  onChange,
  onSave,
  dirty,
  justSaved,
}: NotificationsCardProps) {
  return (
    <Card className="bg-card">
      <CardContent>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400"
              >
                <Bell className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                  NOTIFICATIONS
                </h2>
                <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                  COMING NEXT
                </span>
              </div>
            </div>
          </div>

          {/* Email field */}
          <div className="space-y-2">
            <label
              htmlFor="notif-email"
              className="block text-sm text-foreground"
            >
              Notification email{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="notif-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => onChange(e.target.value)}
              className="w-full rounded-md border border-border bg-card/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-mezo focus:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              When the keeper bot fires your weekly vote, we&rsquo;ll send a
              summary of the new allocation. Delivery ships in a follow-up.
            </p>
          </div>

          {/* Status row */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Stored locally in your browser; nothing leaves the client.
            </p>
            <div className="flex items-center gap-2">
              {dirty ? (
                <Button
                  type="button"
                  onClick={onSave}
                  className="bg-mezo text-primary-foreground hover:bg-mezo-hover"
                >
                  <Save aria-hidden className="mr-1.5 h-4 w-4" />
                  Save preferences
                </Button>
              ) : justSaved ? (
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-foreground/60">
                  Saved
                </span>
              ) : (
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  No changes
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
