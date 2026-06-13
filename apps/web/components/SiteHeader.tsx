import Link from "next/link";
import { ScoutIcon } from "./ScoutIcon";

export function SiteHeader({ suffix }: { suffix?: string }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <ScoutIcon size={32} />
          <span className="brand-name">Scout</span>
          {suffix ? <span className="brand-suffix">{suffix}</span> : null}
        </Link>
      </div>
    </header>
  );
}
