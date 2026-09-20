"use client";

import { useEffect, useState } from "react";
import { Gift, Search } from "lucide-react";
import { fetchGiftCardByCode, fetchGiftCards } from "@/lib/queries";
import { issueGiftCard, redeemGiftCard } from "@/lib/mutations";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuthStore } from "@/lib/store/authStore";
import type { GiftCard } from "@/lib/types";

const STATUS_LABEL: Record<GiftCard["status"], string> = {
  active: "ใช้งานได้",
  redeemed: "ใช้หมดแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

export default function GiftCardsPage() {
  const user = useAuthStore((s) => s.user)!;
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState("500");
  const [issuedTo, setIssuedTo] = useState("");
  const [issueMessage, setIssueMessage] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const [lookupCode, setLookupCode] = useState("");
  const [found, setFound] = useState<GiftCard | null | undefined>(undefined);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  function loadCards() {
    fetchGiftCards()
      .then(setCards)
      .finally(() => setLoading(false));
  }

  useEffect(loadCards, []);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    setIssuing(true);
    setIssueMessage(null);
    const result = await issueGiftCard({ amount: value, issuedTo: issuedTo || undefined, staffId: user.user_id });
    setIssuing(false);
    if (!result.ok || !result.giftCard) {
      setIssueMessage(result.message ?? "ออกบัตรไม่สำเร็จ");
      return;
    }
    setIssueMessage(`ออกบัตรสำเร็จ รหัส ${result.giftCard.code}`);
    setIssuedTo("");
    loadCards();
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupCode.trim()) return;
    const card = await fetchGiftCardByCode(lookupCode);
    setFound(card);
    setRedeemMessage(null);
    setRedeemAmount(card ? String(card.balance) : "");
  }

  async function handleRedeem() {
    if (!found) return;
    const value = Number(redeemAmount);
    if (!value || value <= 0) return;
    setRedeeming(true);
    setRedeemMessage(null);
    const result = await redeemGiftCard({ giftCard: found, amount: value, staffId: user.user_id });
    setRedeeming(false);
    if (!result.ok) {
      setRedeemMessage(result.message ?? "ใช้บัตรไม่สำเร็จ");
      return;
    }
    setRedeemMessage(`ใช้บัตรสำเร็จ คงเหลือ ${formatCurrency(result.balance ?? 0)}`);
    setFound({ ...found, balance: result.balance ?? 0, status: (result.balance ?? 0) === 0 ? "redeemed" : "active" });
    loadCards();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-lg font-bold">Gift Card</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleIssue}
          className="flex flex-col gap-3 rounded-xl border border-border bg-bg-elevated p-4"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="h-4 w-4 text-accent" /> ออกบัตรใหม่
          </h2>
          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">มูลค่าบัตร (บาท)</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-text-muted">ผู้รับ (ไม่บังคับ)</span>
            <input
              value={issuedTo}
              onChange={(e) => setIssuedTo(e.target.value)}
              placeholder="ชื่อลูกค้า"
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-text-faint focus:border-accent"
            />
          </label>
          <button
            disabled={issuing}
            className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            ออกบัตร
          </button>
          {issueMessage && <p className="text-xs text-text-muted">{issueMessage}</p>}
        </form>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-elevated p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4 text-accent" /> ตรวจสอบ / ใช้บัตร
          </h2>
          <form onSubmit={handleLookup} className="flex gap-2">
            <input
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              placeholder="รหัสบัตร เช่น GC1234ABCD"
              className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-text-faint focus:border-accent"
            />
            <button className="shrink-0 rounded-xl border border-border-strong px-4 text-sm font-medium text-text-muted hover:text-text">
              ค้นหา
            </button>
          </form>

          {found === null && (
            <p className="text-xs text-text-faint">ไม่พบบัตรรหัสนี้</p>
          )}

          {found && (
            <div className="space-y-2 rounded-xl border border-border bg-bg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold">{found.code}</span>
                <span className="text-xs text-text-faint">{STATUS_LABEL[found.status]}</span>
              </div>
              <p className="text-text-muted">
                คงเหลือ <span className="font-bold text-gold">{formatCurrency(found.balance)}</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={found.balance}
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-bg-elevated px-2 py-1.5 text-sm outline-none focus:border-accent"
                />
                <button
                  onClick={handleRedeem}
                  disabled={redeeming || found.status !== "active"}
                  className="shrink-0 rounded-lg bg-accent px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  ใช้บัตร
                </button>
              </div>
              {redeemMessage && <p className="text-xs text-text-muted">{redeemMessage}</p>}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">บัตรล่าสุด</h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-text-faint">กำลังโหลด...</p>
        ) : cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-faint">ยังไม่มีบัตรของขวัญ</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div
                key={c.gift_card_id}
                className="flex items-center justify-between rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold">{c.code}</p>
                  <p className="text-xs text-text-faint">{formatDate(c.created_at)}</p>
                </div>
                <span className="shrink-0 font-semibold text-gold">{formatCurrency(c.balance)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
