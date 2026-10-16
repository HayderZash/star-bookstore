import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

import { LiveChat } from "@/components/LiveChat";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { whatsappLink } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Floating customer helper: live chat with the store. */
export function ChatWidget() {
  const { user } = useAuth();
  const settings = useQuery(settingsQuery);
  const [open, setOpen] = useState(false);
  const waPhone = settings.data?.["support_whatsapp"] ?? settings.data?.["store_phone"] ?? "";

  return (
    <>
      <div className="fixed bottom-24 end-4 z-40 flex flex-col items-center gap-2">
        <Button
          size="icon"
          aria-label="محادثة مع الإدارة"
          className="size-12 rounded-full shadow-lg"
          onClick={() => setOpen(!open)}
        >
          <MessageCircle className="size-5" />
        </Button>
      </div>

      {open && (
        <div
          className={cn(
            "fixed inset-x-2 bottom-20 z-50 flex h-[70vh] flex-col overflow-hidden rounded-3xl border bg-background shadow-2xl",
            "sm:inset-x-auto sm:end-4 sm:w-[380px]",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <p className="text-sm font-semibold">محادثة مع إدارة المتجر</p>
            <div className="flex items-center gap-1">
              {waPhone && (
                <a
                  href={whatsappLink(waPhone, "مرحباً مكتبة النجم، لدي استفسار:")}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold text-primary"
                >
                  واتساب
                </a>
              )}
              <Button size="icon" variant="ghost" aria-label="إغلاق" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {user ? (
            <LiveChat userId={user.id} sender="customer" />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              سجّل الدخول لبدء المحادثة مع إدارة المتجر.
            </div>
          )}
        </div>
      )}
    </>
  );
}
