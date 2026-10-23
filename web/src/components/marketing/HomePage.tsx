import React, { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, Code2, Network, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DeferredRiskScene } from '../3d/DeferredRiskScene';
import { homeContent } from './homeContent';
import './home.css';

interface HomePageProps {
  onStart: () => void;
  onExploreApi: () => void;
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onStart, onExploreApi, onNavigate }) => {
  const { language, isRTL } = useLanguage();
  const copy = homeContent[language];
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const [decision, setDecision] = useState<'allow' | 'review' | 'reject'>('review');

  const decisionText = {
    allow: [copy.allow, copy.allowText],
    review: [copy.review, copy.reviewText],
    reject: [copy.reject, copy.rejectText],
  } as const;

  return (
    <div className="ordium-home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-grid home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-eyebrow hero-enter">{copy.eyebrow}<span>ORD / 01</span></p>
            <h1 id="home-title" className="home-title">
              <span className="title-mask"><span>{copy.titleA}</span></span>
              <span className="title-mask title-accent"><span>{copy.titleB}</span></span>
            </h1>
            <p className="home-intro hero-enter">{copy.intro}</p>
            <div className="home-actions hero-enter">
              <button className="home-button home-button-primary" type="button" onClick={onStart}>
                {copy.primary}<Arrow aria-hidden="true" />
              </button>
              <button className="home-text-link" type="button" onClick={onExploreApi}>
                {copy.secondary}<ArrowUpRight aria-hidden="true" />
              </button>
            </div>
            <p className="home-proof hero-enter"><Check aria-hidden="true" />{copy.proof}</p>
          </div>

          <div className="home-hero-visual" aria-label={copy.sceneReason}>
            <div className="scene-poster" aria-hidden="true"><span /><span /><span /></div>
            <DeferredRiskScene />
            <div className="scene-topline">
              <span><i />{copy.sceneLive}</span>
              <span dir="ltr">{copy.sceneOrder}</span>
            </div>
            <div className="scene-score">
              <span>{copy.sceneScore}</span>
              <strong dir="ltr">64<small>/100</small></strong>
              <b>{copy.sceneDecision}</b>
              <p>{copy.sceneReason}</p>
            </div>
            <div className="scene-signals" aria-hidden="true">
              <span>{copy.signalIdentity}</span><span>{copy.signalBehavior}</span>
              <span>{copy.signalNetwork}</span><span>{copy.signalHistory}</span>
            </div>
            <div className="scene-bottomline"><span>{copy.sceneFooter}</span><Network aria-hidden="true" /></div>
          </div>
        </div>
        <a className="hero-scroll" href="#principle" aria-label={copy.manifestoLabel}><ArrowDown /></a>
      </section>

      <section className="home-light home-principle" id="principle" aria-labelledby="principle-title">
        <div className="home-grid">
          <p className="home-section-label dark-label">{copy.manifestoLabel}</p>
          <div className="principle-content">
            <h2 id="principle-title">{copy.manifesto}</h2>
            <div className="principle-detail">
              <p>{copy.manifestoBody}</p>
              <ul>
                {[copy.manifestoPointA, copy.manifestoPointB, copy.manifestoPointC].map((point) => (
                  <li key={point}><Check aria-hidden="true" />{point}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="home-pipeline" id="platform" aria-labelledby="pipeline-title">
        <div className="home-grid">
          <div className="pipeline-heading">
            <p className="home-section-label">{copy.pipelineLabel}</p>
            <h2 id="pipeline-title">{copy.pipelineTitle}</h2>
            <p>{copy.pipelineBody}</p>
          </div>
          <ol className="pipeline-steps">
            {copy.steps.map(([number, title, body]) => (
              <li key={number}>
                <span className="step-number" dir="ltr">{number}</span>
                <div><h3>{title}</h3><p>{body}</p></div>
                <span className="step-line" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-review" aria-labelledby="review-title">
        <div className="home-grid review-grid">
          <div className="review-copy">
            <p className="home-section-label">{copy.decisionLabel}</p>
            <h2 id="review-title">{copy.decisionTitle}</h2>
            <p>{copy.decisionBody}</p>
            <button className="home-text-link" type="button" onClick={() => onNavigate('/platform')}>
              {copy.reviewAction}<ArrowUpRight aria-hidden="true" />
            </button>
            <small>{copy.reviewMeta}</small>
          </div>
          <div className="review-workbench">
            <div className="workbench-top"><span dir="ltr">ORD-8F2A-91</span><span>64 / 100</span></div>
            <div className="decision-tabs" role="tablist" aria-label={copy.decisionLabel}>
              {(['allow', 'review', 'reject'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={decision === item}
                  aria-controls="decision-panel"
                  className={decision === item ? 'active' : ''}
                  onClick={() => setDecision(item)}
                >{decisionText[item][0]}</button>
              ))}
            </div>
            <div className={`decision-panel decision-${decision}`} id="decision-panel" role="tabpanel">
              <span className="decision-status">{decisionText[decision][0]}</span>
              <p>{decisionText[decision][1]}</p>
              <div className="evidence-list" aria-hidden="true">
                <span><b>01</b><i style={{ width: decision === 'allow' ? '32%' : '74%' }} /></span>
                <span><b>02</b><i style={{ width: decision === 'reject' ? '88%' : '51%' }} /></span>
                <span><b>03</b><i style={{ width: decision === 'review' ? '67%' : '39%' }} /></span>
              </div>
            </div>
            <div className="workbench-foot"><ShieldCheck aria-hidden="true" /><span>Merchant-scoped / Explainable / Auditable</span></div>
          </div>
        </div>
      </section>

      <section className="home-light home-integration" id="developers" aria-labelledby="integration-title">
        <div className="home-grid integration-grid">
          <div className="integration-copy">
            <p className="home-section-label dark-label">{copy.integrationLabel}</p>
            <h2 id="integration-title">{copy.integrationTitle}</h2>
            <p>{copy.integrationBody}</p>
            <button className="home-button home-button-dark" type="button" onClick={onExploreApi}>
              {copy.docsCta}<Arrow aria-hidden="true" />
            </button>
          </div>
          <div className="code-window" dir="ltr">
            <div className="code-title"><Code2 aria-hidden="true" /><span>evaluate-order.ts</span><span>API / V1</span></div>
            <pre><code><span className="code-comment">{copy.codeComment}</span>{'\n'}{copy.code.join('\n')}</code></pre>
            <div className="code-response"><span>200 OK</span><code>{copy.codeResponse}</code></div>
          </div>
        </div>
      </section>

      <section className="home-architecture" id="security" aria-labelledby="architecture-title">
        <div className="home-grid">
          <div className="architecture-heading">
            <p className="home-section-label">{copy.architectureLabel}</p>
            <h2 id="architecture-title">{copy.architectureTitle}</h2>
            <p>{copy.architectureBody}</p>
          </div>
          <div className="architecture-lanes">
            {[
              [copy.architectureA, copy.architectureAText],
              [copy.architectureB, copy.architectureBText],
              [copy.architectureC, copy.architectureCText],
            ].map(([title, body], index) => (
              <article key={title}>
                <span dir="ltr">0{index + 1}</span><h3>{title}</h3><p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-final">
        <div className="home-grid">
          <p className="home-section-label">ORD / NEXT</p>
          <h2>{copy.finalTitle}</h2>
          <p>{copy.finalBody}</p>
          <div className="home-actions">
            <button className="home-button home-button-primary" type="button" onClick={onStart}>{copy.primary}<Arrow /></button>
            <button className="home-text-link" type="button" onClick={onExploreApi}>{copy.secondary}<ArrowUpRight /></button>
          </div>
        </div>
      </section>
    </div>
  );
};
