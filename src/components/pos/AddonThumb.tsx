import { gradientForId } from "@/lib/queries";
import type { Addon } from "@/lib/types";

/** Shows the product photo once addons.image_url is set; falls back to a
 * stable per-item gradient placeholder until real photos are uploaded. */
export default function AddonThumb({ addon, className }: { addon: Addon; className: string }) {
  if (addon.image_url) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/storage URLs, no fixed domain to allowlist
    return <img src={addon.image_url} alt={addon.name} className={`${className} object-cover`} />;
  }
  const gradient = gradientForId(addon.addon_id);
  return (
    <div
      className={className}
      style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
    />
  );
}
