import Link from 'next/link';
import { ArrowRight, MapPin } from '@/components/Icons';

export default function NotFound() {
  return (
    <div className="container">
      <section className="page-hero" aria-labelledby="not-found-title">
        <div>
          <p className="eyebrow">404 · no such case</p>
          <h1 id="not-found-title" className="page-title">
            This record is not in the replay.
          </h1>
          <p className="page-lead">
            The case, asset or work-order ID was not found. Nothing is invented to fill the gap. Return to the public map
            or open a recorded case.
          </p>
          <div className="hero__actions">
            <Link className="button" href="/">
              <MapPin size={17} aria-hidden="true" /> Public map
            </Link>
            <Link className="button button--ghost" href="/cases/WO-BENCH-001-0001">
              Bench repair <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
