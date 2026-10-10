import Link from "next/link";

export default function AccueilPage() {
  return (
    <>
      <div className="row between">
        <span className="display display--s">Sortify</span>
        <Link href="/reglages" className="btn btn--ghost btn--sm">
          Réglages
        </Link>
      </div>
      <h1 className="display">Tout est rangé.</h1>
    </>
  );
}
