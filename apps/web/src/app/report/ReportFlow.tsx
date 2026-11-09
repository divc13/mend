'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PhotoPrivacyEditor, type PhotoPrivacyState } from '@/components/PhotoPrivacyEditor';
import { CopyButton } from '@/components/CopyButton';
import { Badge, Callout, PageHero } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import { useMode } from '@/components/ModeProvider';
import { submitReport } from '@/lib/api';
import { LOCATIONS } from '@/lib/fixtures';
import { shortHash } from '@/lib/format';
import { AlertTriangle, ArrowRight, Check, FileText, Lock, MapPin, ShieldCheck, Wallet } from '@/components/Icons';

type DuplicateChoice = 'same' | 'different' | 'unsure';

interface ResultState {
  id: string;
  caseLink: string;
  privatePath: string;
  source: 'api' | 'replay';
  mediaHash?: string;
  note?: string;
}

const areas = [
  { value: 'bench', label: 'Riverside Park — east gate bench area' },
  { value: 'rack', label: 'Community Centre — north entrance' },
  { value: 'door', label: 'Community Centre — side entrance' },
  { value: 'fence', label: 'Allotment gardens — west boundary' },
  { value: 'playground', label: 'Playground — south corner' },
] as const;

const categories = [
  { value: 'bench', label: 'Bench / seating' },
  { value: 'bicycle_rack', label: 'Bicycle rack' },
  { value: 'fence', label: 'Fence' },
  { value: 'door', label: 'Door / closer' },
  { value: 'playground', label: 'Non-electrical playground fixture' },
  { value: 'other', label: 'Other low-risk community asset' },
] as const;

const stepTitles = ['The problem', 'Protect privacy', 'Duplicate check', 'Review & send'];

function makeToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `case_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function makeReportId() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return `R-${String(100 + (bytes[0]! % 900)).padStart(3, '0')}`;
}

export function ReportFlow() {
  const { mode } = useMode();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('bench');
  const [area, setArea] = useState('bench');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<PhotoPrivacyState>({
    dataUrl: null,
    width: 0,
    height: 0,
    redactionCount: 0,
    exifStripped: false,
  });
  const [duplicateChoice, setDuplicateChoice] = useState<DuplicateChoice | ''>('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const selectedArea = LOCATIONS[area] ?? LOCATIONS.bench!;
  const selectedCategory = categories.find((item) => item.value === category)?.label ?? 'Other';

  function validateStep(current: number): string[] {
    const next: string[] = [];
    if (current === 1) {
      if (description.trim().length < 20) {
        next.push('Describe the problem in at least 20 characters so a steward can understand it.');
      }
      if (!category) next.push('Choose an asset category.');
      if (!area) next.push('Choose a public area.');
    }
    if (current === 2) {
      if (!photo.dataUrl || !photo.exifStripped) {
        next.push('Add a photo. It is re-encoded in your browser so EXIF and GPS metadata are removed.');
      }
    }
    if (current === 3) {
      if (!duplicateChoice) next.push('Choose how this report relates to the suggested duplicate.');
      if (!acknowledged) next.push('Acknowledge that a steward may merge this report with an existing case.');
    }
    return next;
  }

  function goNext() {
    const found = validateStep(step);
    setErrors(found);
    if (found.length === 0) setStep((value) => Math.min(4, value + 1));
  }

  function goBack() {
    setErrors([]);
    setStep((value) => Math.max(1, value - 1));
  }

  async function onSubmit() {
    const found = [...validateStep(1), ...validateStep(2), ...validateStep(3)];
    setErrors(found);
    if (found.length > 0) {
      setStep(found.some((item) => item.includes('photo')) ? 2 : 1);
      return;
    }

    setSubmitting(true);
    const assetId =
      category === 'bench' && area === 'bench'
        ? 'BENCH-001'
        : category === 'bicycle_rack' && area === 'rack'
          ? 'RACK-002'
          : category === 'door' && area === 'door'
            ? 'DOOR-003'
            : category === 'fence' && area === 'fence'
              ? 'FENCE-004'
              : category === 'playground' && area === 'playground'
                ? 'PLAY-005'
                : 'UNASSIGNED';

    const submitted =
      mode === 'REPLAY'
        ? null
        : await submitReport({
            description: description.trim(),
            publicLocation: selectedArea,
            assetId,
            redactedMediaHash: photo.mediaHash,
            exifStripped: true,
            category,
            duplicateChoice: duplicateChoice || 'unsure',
          });

    if (submitted?.ok) {
      setResult({
        id: submitted.data.id,
        caseLink: submitted.data.reporterCaseLink,
        privatePath: submitted.data.reporterCaseLink.includes('/report/status')
          ? submitted.data.reporterCaseLink.slice(submitted.data.reporterCaseLink.indexOf('/report/status'))
          : '/report',
        source: 'api',
        mediaHash: photo.mediaHash,
      });
      setSubmitting(false);
      return;
    }

    const token = makeToken();
    const reportId = makeReportId();
    const caseLink = `${window.location.origin}/report/status?case=${token}`;
    const receipt = {
      id: reportId,
      caseLink,
      token,
      description: description.trim(),
      category,
      area,
      areaLabel: selectedArea.label,
      exifStripped: true,
      redactionCount: photo.redactionCount,
      mediaHash: photo.mediaHash,
      duplicateChoice,
      submittedAt: new Date().toISOString(),
      source: 'replay',
      note:
        submitted?.message ??
        'Replay mode selected. A local receipt was created; no report left this browser.',
    };
    try {
      window.localStorage.setItem(`mend-report:${token}`, JSON.stringify(receipt));
    } catch {
      // The link still exists; this browser simply cannot persist the replay receipt.
    }
    setResult({
      id: reportId,
      caseLink,
      privatePath: `/report/status?case=${token}`,
      source: 'replay',
      mediaHash: photo.mediaHash,
      note: receipt.note,
    });
    setSubmitting(false);
  }

  if (result) {
    return (
      <div className="container">
        <div className="form-shell">
          <div className="form-main">
            <section className="result-card" aria-labelledby="report-result-title">
              <Badge tone={result.source === 'api' ? 'positive' : 'warning'}>
                {result.source === 'api' ? 'API response' : 'Replay receipt'}
              </Badge>
              <h2 id="report-result-title" style={{ marginTop: 12 }}>
                Report received. Keep the private link.
              </h2>
              <p>
                {result.source === 'api'
                  ? 'The API accepted the report. Duplicate triage and steward review follow the same private workflow.'
                  : 'This is a replay receipt stored only in this browser. It is not a live report and no private media left this device.'}
              </p>
              {result.source === 'replay' && result.note ? (
                <p className="field__hint" style={{ marginTop: 6 }}>
                  {result.note}
                </p>
              ) : null}

              <div className="case-link">
                <code>{result.caseLink}</code>
                <CopyButton value={result.caseLink} label="Copy private link" />
                <Link className="button button--small" href={result.privatePath}>
                  Open status
                </Link>
              </div>

              <div className="receipt-grid">
                <div className="receipt-item">
                  <span>Report</span>
                  <strong>{result.id}</strong>
                </div>
                <div className="receipt-item">
                  <span>EXIF / GPS</span>
                  <strong>Removed in browser</strong>
                </div>
                <div className="receipt-item">
                  <span>Redactions burned in</span>
                  <strong>{photo.redactionCount}</strong>
                </div>
                <div className="receipt-item">
                  <span>Duplicate choice</span>
                  <strong>
                    {duplicateChoice === 'same'
                      ? 'Same problem'
                      : duplicateChoice === 'different'
                        ? 'Different problem'
                        : 'Steward decides'}
                  </strong>
                </div>
                <div className="receipt-item">
                  <span>Environment</span>
                  <strong>{mode === 'REPLAY' ? 'REPLAY / SIMULATION' : 'LIVE TESTNET'}</strong>
                </div>
                <div className="receipt-item">
                  <span>Wallet used</span>
                  <strong>None</strong>
                </div>
              </div>

              {result.mediaHash ? (
                <div className="hash-display" style={{ marginTop: 14 }}>
                  <span className="hash-display__label">Redacted preview hash</span>
                  <code title={result.mediaHash}>{shortHash(result.mediaHash, 18, 10)}</code>
                  <CopyButton value={result.mediaHash} label="Copy hash" />
                </div>
              ) : null}

              <Callout tone="warning" title="This link is private">
                Anyone who has it can open the case status. Do not post it publicly. In replay, the receipt exists only in
                this browser and is not recoverable from another device.
              </Callout>

              <div className="form-actions">
                <Link className="button button--ghost" href="/">
                  Public map
                </Link>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setResult(null);
                    setStep(1);
                    setDescription('');
                    setPhoto({
                      dataUrl: null,
                      width: 0,
                      height: 0,
                      redactionCount: 0,
                      exifStripped: false,
                    });
                    setDuplicateChoice('');
                    setAcknowledged(false);
                  }}
                >
                  Report another problem
                </button>
              </div>
            </section>
          </div>
          <aside className="form-aside" aria-label="After you submit">
            <section className="side-card">
              <h2>What happens next</h2>
              <ol className="decision-list" style={{ marginTop: 10 }}>
                <li>
                  <Check size={15} aria-hidden="true" /> Private duplicate triage; a human confirms any merge.
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> A steward edits the scope and maximum budget.
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> A DAO envelope and roster authorize the market.
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> You can follow the case with the private link.
                </li>
              </ol>
            </section>
            <DataSourceNote detail="A submitted report is a replay receipt stored only in this browser. No private media leaves this device." />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container">
        <PageHero
          eyebrow="Walletless report"
          title="Tell us what you found."
          lead="A photo, a short description and a rough area are enough. No wallet, no seed phrase and no payment. You keep a private case link."
          aside={
            <div className="side-card">
              <h2>No wallet. No account.</h2>
              <p className="side-card__note">
                Reporting is open to anyone. We never ask for a wallet, a signature or a private precise location in
                public.
              </p>
              <div className="hero__note" style={{ marginTop: 12 }}>
                <span>
                  <Wallet size={15} aria-hidden="true" /> Walletless
                </span>
                <span>
                  <Lock size={15} aria-hidden="true" /> EXIF removed
                </span>
              </div>
            </div>
          }
        />
      </div>

      <div className="container">
        <div className="form-shell">
          <div className="form-main">
            <div className="stepper" aria-label="Report progress">
              {stepTitles.map((title, index) => {
                const number = index + 1;
                return (
                  <span
                    key={title}
                    className={`step${number === step ? ' is-current' : ''}${number < step ? ' is-complete' : ''}`}
                    aria-current={number === step ? 'step' : undefined}
                  >
                    <span className="step__num">{number < step ? <Check size={10} /> : number}</span>
                    {title}
                  </span>
                );
              })}
            </div>

            {errors.length > 0 ? (
              <div className="callout callout--danger" role="alert" style={{ marginBottom: 16 }}>
                <div className="callout__icon">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="callout__title">A few things need attention</p>
                  <ul className="callout__body">
                    {errors.map((error) => (
                      <li key={error}>— {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            <form
              className="form-card"
              onSubmit={(event) => {
                event.preventDefault();
                if (step < 4) goNext();
                else void onSubmit();
              }}
              noValidate
            >
              <h2 ref={headingRef} tabIndex={-1} id="step-heading">
                {step}. {stepTitles[step - 1]}
              </h2>

              {step === 1 ? (
                <>
                  <p>
                    Describe the damage in plain language. Avoid naming private individuals. This description may become
                    the public case summary.
                  </p>
                  <Callout tone="warning" title="Not for emergencies">
                    Gas, live electricity, structural collapse or danger to people? Contact local emergency services or
                    the asset owner. MEND is for low-risk, non-urgent community repairs.
                  </Callout>

                  <div className="form-grid" style={{ marginTop: 16 }}>
                    <div className="field">
                      <label htmlFor="report-category">Asset category</label>
                      <select
                        id="report-category"
                        className="select"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                      >
                        {categories.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="report-area">Public area</label>
                      <select
                        id="report-area"
                        className="select"
                        value={area}
                        onChange={(event) => setArea(event.target.value)}
                        aria-describedby="report-area-hint"
                      >
                        {areas.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <span id="report-area-hint" className="field__hint">
                        Public pin only: {selectedArea.coarseLat.toFixed(3)}, {selectedArea.coarseLng.toFixed(3)}. Exact
                        coordinates stay private.
                      </span>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="report-description">What is wrong?</label>
                    <textarea
                      id="report-description"
                      className="textarea"
                      value={description}
                      maxLength={2000}
                      onChange={(event) => setDescription(event.target.value)}
                      aria-describedby="report-description-hint report-description-count"
                      aria-invalid={errors.some((error) => error.includes('Describe'))}
                      placeholder="For example: the seat plank is cracked, one armrest is loose and a sharp edge is exposed."
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span id="report-description-hint" className="field__hint">
                        Minimum 20 characters. Do not include names, phone numbers or precise addresses.
                      </span>
                      <span id="report-description-count" className="field__hint mono">
                        {description.length}/2000
                      </span>
                    </div>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <p>
                    The preview is re-encoded in your browser. That removes EXIF, GPS, camera model and capture time.
                    Black out anything private before it leaves this device.
                  </p>
                  <PhotoPrivacyEditor value={photo} onChange={setPhoto} />
                  <Callout tone="positive" title="What leaves the browser">
                    Only the redacted JPEG preview and its SHA-256 hash would be uploaded in a live run. Raw files,
                    metadata and private evidence URLs stay off-chain.
                  </Callout>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <p>
                    Private triage found a nearby report with the same perceptual hash. This is a <strong>suggestion</strong>
                    , not an automatic merge.
                  </p>
                  <div className="duplicate-card">
                    <div className="duplicate-card__top">
                      <h3>Possible duplicate · 94% confidence</h3>
                      <Badge tone="warning">Needs human confirmation</Badge>
                    </div>
                    <p>
                      Same asset, identical perceptual hash, 12 m apart, near-identical damage description. A steward
                      decides whether the reports form one work order.
                    </p>
                    <div className="duplicate-card__reports">
                      <span className="duplicate-card__report">R-001 · CLUSTERED</span>
                      <span className="duplicate-card__report">R-002 · CLUSTERED</span>
                      <span className="duplicate-card__report">CL-0001 · CONFIRMED</span>
                    </div>
                  </div>

                  <fieldset className="field" style={{ border: 0, padding: 0 }}>
                    <legend className="label">Is this the same problem?</legend>
                    <div className="radio-grid">
                      <label className="radio-card">
                        <input
                          type="radio"
                          name="duplicate-choice"
                          value="same"
                          checked={duplicateChoice === 'same'}
                          onChange={() => setDuplicateChoice('same')}
                        />
                        <span>
                          Same problem
                          <small>Merge is appropriate. A steward still confirms it.</small>
                        </span>
                      </label>
                      <label className="radio-card">
                        <input
                          type="radio"
                          name="duplicate-choice"
                          value="different"
                          checked={duplicateChoice === 'different'}
                          onChange={() => setDuplicateChoice('different')}
                        />
                        <span>
                          Different problem
                          <small>Keep this report separate and route it for triage.</small>
                        </span>
                      </label>
                      <label className="radio-card">
                        <input
                          type="radio"
                          name="duplicate-choice"
                          value="unsure"
                          checked={duplicateChoice === 'unsure'}
                          onChange={() => setDuplicateChoice('unsure')}
                        />
                        <span>
                          Not sure — let a steward decide
                          <small>The safest default. No automatic merge.</small>
                        </span>
                      </label>
                    </div>
                  </fieldset>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(event) => setAcknowledged(event.target.checked)}
                    />
                    <span>
                      I understand this report may be merged with an existing case. I will still be able to see its
                      duplicate status through my private link.
                    </span>
                  </label>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <p>Review what would be sent. Nothing has been submitted yet.</p>
                  <dl className="facts-grid" style={{ marginTop: 16 }}>
                    <div className="fact">
                      <dt>Category</dt>
                      <dd>{selectedCategory}</dd>
                    </div>
                    <div className="fact">
                      <dt>Public area</dt>
                      <dd>{selectedArea.label}</dd>
                    </div>
                    <div className="fact">
                      <dt>Photo</dt>
                      <dd>{photo.dataUrl ? 'Redacted preview ready' : 'No photo'}</dd>
                    </div>
                    <div className="fact">
                      <dt>EXIF / GPS</dt>
                      <dd>{photo.exifStripped ? 'Removed in browser' : 'Not removed'}</dd>
                    </div>
                    <div className="fact">
                      <dt>Redactions</dt>
                      <dd>{photo.redactionCount} burned in</dd>
                    </div>
                    <div className="fact">
                      <dt>Duplicate choice</dt>
                      <dd>
                        {duplicateChoice === 'same'
                          ? 'Same problem'
                          : duplicateChoice === 'different'
                            ? 'Different problem'
                            : 'Let a steward decide'}
                      </dd>
                    </div>
                  </dl>
                  <div className="field">
                    <span className="label">Description</span>
                    <p className="scope-copy" style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
                      {description.trim()}
                    </p>
                  </div>
                  {photo.mediaHash ? (
                    <div className="hash-display" style={{ marginTop: 12 }}>
                      <span className="hash-display__label">Preview SHA-256</span>
                      <code title={photo.mediaHash}>{shortHash(photo.mediaHash, 18, 10)}</code>
                      <CopyButton value={photo.mediaHash} label="Copy hash" />
                    </div>
                  ) : null}
                  <Callout tone="info" title="No wallet, no gas, no payment">
                    Submission is free. You do not sign anything. The private case link is the only key to your report
                    status.
                  </Callout>
                  <p className="source-note source-note--replay" style={{ marginTop: 14 }}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>
                      <strong>Environment: {mode === 'REPLAY' ? 'REPLAY / SIMULATION' : 'LIVE TESTNET'}.</strong>{' '}
                      {mode === 'REPLAY'
                        ? 'No API is connected; submitting creates a local replay receipt only.'
                        : 'A real testnet report is submitted only if the API responds successfully. On failure, a replay receipt is created and labelled.'}
                    </span>
                  </p>
                </>
              ) : null}

              <div className="form-actions">
                <button type="button" className="button button--ghost" onClick={goBack} disabled={step === 1 || submitting}>
                  Back
                </button>
                <div className="form-actions__right">
                  {step < 4 ? (
                    <button type="button" className="button" onClick={goNext}>
                      Continue <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button type="button" className="button" disabled={submitting} onClick={() => void onSubmit()}>
                      {submitting ? 'Creating report…' : 'Submit report'} <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          <aside className="form-aside" aria-label="Report privacy notes">
            <section className="side-card">
              <h2>What we never ask for</h2>
              <ul className="decision-list" style={{ marginTop: 10 }}>
                <li>
                  <Check size={15} aria-hidden="true" /> A wallet, seed phrase or signature.
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> A precise public address or live location.
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> Payment to file a report.
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> Your real name.
                </li>
              </ul>
            </section>
            <section className="side-card">
              <h2>Public vs private</h2>
              <ul className="decision-list" style={{ marginTop: 10 }}>
                <li>
                  <MapPin size={15} aria-hidden="true" /> Public: coarse area and redacted photo.
                </li>
                <li>
                  <Lock size={15} aria-hidden="true" /> Private: precise location, raw file and case token.
                </li>
                <li>
                  <FileText size={15} aria-hidden="true" /> On-chain: hashes only, never media.
                </li>
              </ul>
            </section>
            <DataSourceNote detail="This report form runs from frozen fixtures until a live API is configured. In replay, submission creates a local receipt only." />
          </aside>
        </div>
      </div>
    </>
  );
}
