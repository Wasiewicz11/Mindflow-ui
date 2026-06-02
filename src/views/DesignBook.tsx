import { useState } from 'react';
import { CalendarDatePicker } from '../shared/ui/CalendarDatePicker';

// ─── Sekcja wrapper ───────────────────────────────────────────────────────────
function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 80 }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f1115', letterSpacing: '-0.02em', marginBottom: 4 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13.5, color: '#8a909a', lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, padding: '20px 0', borderBottom: '1px solid #f1f0ed' }}>
      <div style={{ width: 120, flexShrink: 0, fontSize: 12, fontWeight: 500, color: '#9098a4', textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 3 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</div>
    </div>
  );
}

function Token({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: '#9098a4' }}>{label}</div>
      <div style={{ fontSize: mono ? 11.5 : 13, fontFamily: mono ? 'monospace' : undefined, color: '#0f1115', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ─── Chip (nawigacja) ─────────────────────────────────────────────────────────
const NAV = [
  { id: 'brand',       label: 'Brand' },
  { id: 'colors',      label: 'Kolory' },
  { id: 'typography',  label: 'Typografia' },
  { id: 'spacing',     label: 'Spacing' },
  { id: 'radius',      label: 'Radiusy' },
  { id: 'shadows',     label: 'Cienie' },
  { id: 'components',  label: 'Komponenty' },
  { id: 'motion',      label: 'Motion' },
  { id: 'darkmode',    label: 'Dark Mode' },
];

export function DesignBook() {
  const [activeSection, setActiveSection] = useState('brand');
  const [showCal, setShowCal] = useState(false);
  const [calDate, setCalDate] = useState('');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FDFDFD', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Sidebar nav ── */}
      <aside style={{
        width: 200, flexShrink: 0, padding: '40px 0',
        borderRight: '1px solid #f1f0ed', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '0 20px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/mindle_mark_black.svg" alt="" style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f1115', letterSpacing: '-0.01em' }}>Midle</span>
          <span style={{ fontSize: 11, color: '#b0b5be', marginLeft: 2 }}>Design</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => scrollTo(n.id)}
              style={{
                textAlign: 'left', padding: '7px 10px', borderRadius: 8, fontSize: 13,
                fontWeight: activeSection === n.id ? 600 : 400,
                color: activeSection === n.id ? '#0f1115' : '#5a606b',
                background: activeSection === n.id ? '#f1f0ed' : 'transparent',
                border: 'none', cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, padding: '60px 64px', maxWidth: 860 }}>

        {/* Header */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#b0b5be', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Design System v1.0</div>
          <h1 style={{ fontSize: 40, fontWeight: 750, color: '#0f1115', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 12 }}>Midle<br/>Design Book</h1>
          <p style={{ fontSize: 15, color: '#5a606b', lineHeight: 1.6, maxWidth: 480 }}>
            Kompletny przewodnik po komponentach, tokenach i wzorcach projektowych używanych w aplikacji Midle.
          </p>
        </div>

        {/* ══ 1. BRAND ════════════════════════════════════════════════════════ */}
        <Section id="brand" title="Brand Identity" subtitle="Fundament wizualny Midle — logo, nazwa, misja.">

          <div style={{ background: '#0f1115', borderRadius: 18, padding: 48, marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/mindle_mark_white.svg" alt="" style={{ width: 32, height: 32 }} />
              <span style={{ fontSize: 28, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>Midle</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Think less. Flow more.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { title: 'Misja', desc: 'Uprościć organizację myśli i zadań tak, by użytkownik był zawsze w przepływie — bez zbędnego kognitywnego obciążenia.' },
              { title: 'Wartości', desc: 'Minimalizm, szybkość, elegancja. Każdy piksel musi zasługiwać na swoje miejsce.' },
              { title: 'Ton', desc: 'Profesjonalny ale bliski. Konkretny, bez corporate speak. Mówi jak narzędzie stworzone dla builderów.' },
            ].map(v => (
              <div key={v.title} style={{ background: '#f7f7f4', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9098a4', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{v.title}</div>
                <p style={{ fontSize: 13, color: '#3a3f47', lineHeight: 1.6 }}>{v.desc}</p>
              </div>
            ))}
          </div>

          <Row label="Logo">
            {[
              { bg: '#fff', border: '1px solid #e8e8e4', label: 'Light' },
              { bg: '#0f1115', border: 'none', label: 'Dark' },
              { bg: '#f7f7f4', border: 'none', label: 'Surface' },
            ].map(v => (
              <div key={v.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ background: v.bg, border: v.border, borderRadius: 14, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={v.bg === '#0f1115' ? '/mindle_mark_white.svg' : '/mindle_mark_black.svg'} alt="" style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: v.bg === '#0f1115' ? 'white' : '#0f1115', letterSpacing: '-0.01em' }}>Midle</span>
                </div>
                <span style={{ fontSize: 11, color: '#9098a4' }}>{v.label}</span>
              </div>
            ))}
          </Row>
        </Section>

        {/* ══ 2. KOLORY ═══════════════════════════════════════════════════════ */}
        <Section id="colors" title="Paleta kolorów" subtitle="Neutralny, monochromatyczny system z semantycznymi wyjątkami dla priorytetów i statusów.">

          <Row label="Ink / Text">
            {[
              { name: 'Ink-100', hex: '#0f1115', desc: 'Primary, CTA' },
              { name: 'Ink-80',  hex: '#3a3f47', desc: 'Secondary text' },
              { name: 'Ink-60',  hex: '#5a606b', desc: 'Tertiary text' },
              { name: 'Ink-40',  hex: '#8a909a', desc: 'Muted' },
              { name: 'Ink-30',  hex: '#9098a4', desc: 'Labels' },
              { name: 'Ink-20',  hex: '#b0b5be', desc: 'Placeholder' },
              { name: 'Ink-10',  hex: '#c0c5cc', desc: 'Disabled' },
            ].map(c => (
              <div key={c.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: c.hex, border: '1px solid rgba(0,0,0,0.06)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: '#0f1115' }}>{c.name}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9098a4' }}>{c.hex}</div>
                  <div style={{ fontSize: 10, color: '#b0b5be' }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </Row>

          <Row label="Surface / BG">
            {[
              { name: 'White',      hex: '#FFFFFF', desc: 'Modals, cards' },
              { name: 'BG',         hex: '#FDFDFD', desc: 'App background' },
              { name: 'Surface-02', hex: '#f7f7f4', desc: 'Card, input bg' },
              { name: 'Surface-03', hex: '#f1f0ed', desc: 'Hover, dividers' },
              { name: 'Surface-04', hex: '#ececec', desc: 'Progress, lines' },
            ].map(c => (
              <div key={c.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: c.hex, border: '1px solid #e8e8e4' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: '#0f1115' }}>{c.name}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9098a4' }}>{c.hex}</div>
                  <div style={{ fontSize: 10, color: '#b0b5be' }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </Row>

          <Row label="Border">
            {[
              { name: 'Border',      hex: '#e8e8e4', desc: 'Modals, inputs' },
              { name: 'Border-soft', hex: '#e3e3df', desc: 'Dashed, subtle' },
              { name: 'Divider',     hex: '#f1f0ed', desc: 'Row separators' },
            ].map(c => (
              <div key={c.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: c.hex, border: '1px solid #d4d4d0' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: '#0f1115' }}>{c.name}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9098a4' }}>{c.hex}</div>
                  <div style={{ fontSize: 10, color: '#b0b5be' }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </Row>

          <Row label="Priority">
            {[
              { name: 'P1 Pilne',   fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)' },
              { name: 'P2 Wysokie', fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)' },
              { name: 'P3 Średnie', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)' },
              { name: 'P4 Niskie',  fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
            ].map(c => (
              <div key={c.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ background: c.bg, borderRadius: 6, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg viewBox="0 0 24 24" width="11" height="11" fill={c.fg}><path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" clipRule="evenodd"/></svg>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: c.fg }}>{c.name}</span>
                </div>
              </div>
            ))}
          </Row>

          <Row label="Status">
            {[
              { name: 'Nie rozpoczęto', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)', dot: 'oklch(0.75 0.01 260)' },
              { name: 'W trakcie',      fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)',  dot: 'oklch(0.60 0.18 230)' },
              { name: 'Ukończone',      fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)',  dot: 'oklch(0.55 0.18 145)' },
            ].map(c => (
              <span key={c.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: c.bg, borderRadius: 5, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, color: c.fg }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0, display: 'inline-block' }} />
                {c.name}
              </span>
            ))}
          </Row>

          <Row label="Project">
            {['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#9CA3AF'].map(c => (
              <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: c }} />
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9098a4' }}>{c}</div>
              </div>
            ))}
          </Row>
        </Section>

        {/* ══ 3. TYPOGRAFIA ═══════════════════════════════════════════════════ */}
        <Section id="typography" title="Typografia" subtitle="System font stack — natywna czcionka platformy. Brak custom fontu = zero layout shift, zero ładowania.">

          <Row label="Font">
            <Token label="Family" value="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" mono />
            <Token label="Smoothing" value="antialiased + subpixel" />
            <Token label="Base size" value="16px" />
          </Row>

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { label: 'Display',  size: 40, weight: 750, tracking: '-0.03em', lh: 1.1,  text: 'Dzień dobry, Filip.' },
              { label: 'H1',       size: 28, weight: 700, tracking: '-0.02em', lh: 1.2,  text: 'Twoje zadania na dziś' },
              { label: 'H2',       size: 22, weight: 700, tracking: '-0.02em', lh: 1.3,  text: 'Aktywne projekty' },
              { label: 'H3',       size: 18, weight: 650, tracking: '-0.01em', lh: 1.4,  text: 'Midle - organizuj myśli' },
              { label: 'Body L',   size: 15, weight: 400, tracking: '0',       lh: 1.6,  text: 'Tekst opisu, kontekstu, notatki. Zawsze czytelny, nigdy przytłaczający.' },
              { label: 'Body M',   size: 13.5, weight: 400, tracking: '0',     lh: 1.6,  text: 'Treść zadania, opis projektu, notatka.' },
              { label: 'Body S',   size: 13, weight: 400, tracking: '0',       lh: 1.5,  text: 'Labels, dropdown items, secondary content.' },
              { label: 'Caption',  size: 11.5, weight: 500, tracking: '0',     lh: 1.4,  text: 'Etykiety pól, meta informacje, tagi.' },
              { label: 'Micro',    size: 10.5, weight: 500, tracking: '0.04em', lh: 1.4, text: 'SEKCJA · NAGŁÓWEK GRUPY · LABEL' },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'baseline', gap: 24, padding: '16px 0', borderBottom: '1px solid #f1f0ed' }}>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9098a4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.label}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#b0b5be', marginTop: 2 }}>{t.size}px / {t.weight}</div>
                </div>
                <div style={{ fontSize: t.size, fontWeight: t.weight, letterSpacing: t.tracking, lineHeight: t.lh, color: '#0f1115' }}>{t.text}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ══ 4. SPACING ══════════════════════════════════════════════════════ */}
        <Section id="spacing" title="Spacing" subtitle="System oparty na siatce 4px. Każdy odstęp jest wielokrotnością bazowej jednostki.">
          <Row label="Scale">
            {[1,2,3,4,5,6,8,10,12,16,20].map(n => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: n * 4, height: 20, background: '#0f1115', borderRadius: 2, minWidth: 4 }} />
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9098a4' }}>{n * 4}px</div>
                <div style={{ fontSize: 10, color: '#b0b5be' }}>space-{n}</div>
              </div>
            ))}
          </Row>

          <Row label="Padding">
            <Token label="Inline button S"   value="5px 10px"  mono />
            <Token label="Inline button M"   value="8px 16px"  mono />
            <Token label="Dropdown item"     value="9px 13px"  mono />
            <Token label="Modal body"        value="px-5 py-4" mono />
            <Token label="Card inner"        value="10px 12px" mono />
          </Row>

          <Row label="Gap">
            <Token label="Tight (icons)"  value="4–6px"  mono />
            <Token label="Normal"         value="8–12px" mono />
            <Token label="Sections"       value="24–32px" mono />
            <Token label="Page sections"  value="64–80px" mono />
          </Row>
        </Section>

        {/* ══ 5. RADIUSY ══════════════════════════════════════════════════════ */}
        <Section id="radius" title="Border Radius" subtitle="Spójna hierarchia zaokrągleń — im mniejszy element, tym mniejszy radius.">
          <Row label="Scale">
            {[
              { name: 'xs',   px: 4,    usage: 'Badge, tag' },
              { name: 'sm',   px: 6,    usage: 'Inline chip' },
              { name: 'md',   px: 8,    usage: 'Button, item' },
              { name: 'lg',   px: 12,   usage: 'Input, dropdown' },
              { name: 'xl',   px: 18,   usage: 'Modal, card' },
              { name: '2xl',  px: 24,   usage: 'Large card' },
              { name: 'full', px: 9999, usage: 'Dot, avatar, pill' },
            ].map(r => (
              <div key={r.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 56, height: 56, background: '#f1f0ed', border: '1.5px solid #d4d4d0', borderRadius: Math.min(r.px, 28) }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0f1115' }}>{r.name}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9098a4' }}>{r.px === 9999 ? '∞' : `${r.px}px`}</div>
                  <div style={{ fontSize: 10, color: '#b0b5be' }}>{r.usage}</div>
                </div>
              </div>
            ))}
          </Row>
        </Section>

        {/* ══ 6. CIENIE ═══════════════════════════════════════════════════════ */}
        <Section id="shadows" title="Shadows & Elevation" subtitle="Cień definiuje warstwę. Im wyższy element, tym większy i bardziej rozmyty cień.">
          <Row label="Scale">
            {[
              { name: 'sm',  shadow: '0 2px 8px -2px rgba(15,17,21,.08)',   usage: 'Subtelny card' },
              { name: 'md',  shadow: '0 8px 24px -6px rgba(15,17,21,.16)',  usage: 'Dropdown' },
              { name: 'lg',  shadow: '0 16px 40px -8px rgba(15,17,21,.18)', usage: 'Calendar' },
              { name: 'xl',  shadow: '0 24px 48px -12px rgba(15,17,21,.22)',usage: 'Modal' },
            ].map(s => (
              <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 72, height: 72, background: '#fff', borderRadius: 14, boxShadow: s.shadow, border: '1px solid #f1f0ed' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0f1115' }}>shadow-{s.name}</div>
                  <div style={{ fontSize: 10, color: '#b0b5be' }}>{s.usage}</div>
                </div>
              </div>
            ))}
          </Row>
        </Section>

        {/* ══ 7. KOMPONENTY ═══════════════════════════════════════════════════ */}
        <Section id="components" title="Komponenty" subtitle="Biblioteka gotowych komponentów z interaktywnymi przykładami.">

          {/* Buttons */}
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 15, fontWeight: 650, color: '#0f1115', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #f1f0ed' }}>Przyciski</h3>
            <Row label="Primary">
              <button style={{ padding: '8px 18px', background: '#0f1115', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Zapisz</button>
              <button style={{ padding: '8px 18px', background: '#0f1115', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: 0.4 }}>Wyłączony</button>
              <button style={{ padding: '6px 14px', background: '#0f1115', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Small</button>
              <button style={{ padding: '10px 22px', background: '#0f1115', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Large</button>
            </Row>
            <Row label="Secondary">
              <button style={{ padding: '8px 18px', background: '#f1f0ed', color: '#0f1115', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Anuluj</button>
              <button style={{ padding: '8px 18px', background: '#f1f0ed', color: '#0f1115', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: 0.4 }}>Wyłączony</button>
            </Row>
            <Row label="Ghost">
              <button style={{ padding: '8px 18px', background: 'transparent', color: '#0f1115', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Ghost</button>
              <button style={{ padding: '8px 18px', background: 'transparent', color: '#9098a4', borderRadius: 10, fontSize: 13, fontWeight: 400, border: 'none', cursor: 'pointer' }}>Muted</button>
            </Row>
            <Row label="Danger">
              <button style={{ padding: '8px 18px', background: 'oklch(0.62 0.18 25)', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Usuń zadanie</button>
              <button style={{ padding: '8px 18px', background: 'oklch(0.96 0.03 25)', color: 'oklch(0.62 0.18 25)', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Usuń (soft)</button>
            </Row>
            <Row label="Icon">
              <button style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9098a4' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
              </button>
              <button style={{ width: 32, height: 32, background: '#f1f0ed', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f1115' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
              <button style={{ width: 28, height: 28, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9098a4' }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v16m8-8H4"/></svg>
              </button>
            </Row>
          </div>

          {/* Badges */}
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 15, fontWeight: 650, color: '#0f1115', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #f1f0ed' }}>Badges & Tags</h3>
            <Row label="Priorytety">
              {[
                { label: 'P1', name: 'Pilne',    fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)' },
                { label: 'P2', name: 'Wysokie',  fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)' },
                { label: 'P3', name: 'Średnie',  fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)' },
                { label: 'P4', name: 'Niskie',   fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
              ].map(p => (
                <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: p.bg, color: p.fg, borderRadius: 5, padding: '2px 8px', fontSize: 11.5, fontWeight: 600 }}>
                  {p.label} — {p.name}
                </span>
              ))}
            </Row>
            <Row label="Statusy">
              {[
                { name: 'Nie rozpoczęto', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)', dot: 'oklch(0.75 0.01 260)' },
                { name: 'W trakcie',      fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)',  dot: 'oklch(0.60 0.18 230)' },
                { name: 'Ukończone',      fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)',  dot: 'oklch(0.55 0.18 145)' },
              ].map(s => (
                <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: s.bg, color: s.fg, borderRadius: 5, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                  {s.name}
                </span>
              ))}
            </Row>
            <Row label="Tag">
              {['design', 'frontend', 'research', 'pilne'].map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f1f0ed', color: '#5a606b', borderRadius: 5, padding: '3px 8px 3px 10px', fontSize: 11.5, fontWeight: 500 }}>
                  {t}
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </span>
              ))}
            </Row>
          </div>

          {/* Inputs */}
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 15, fontWeight: 650, color: '#0f1115', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #f1f0ed' }}>Pola formularza</h3>
            <Row label="Input">
              <input
                style={{ fontSize: 13, padding: '9px 13px', borderRadius: 10, border: '1px solid #e8e8e4', background: '#fff', color: '#0f1115', outline: 'none', width: 220 }}
                placeholder="Wpisz nazwę zadania..."
                defaultValue=""
              />
              <input
                style={{ fontSize: 13, padding: '9px 13px', borderRadius: 10, border: '1.5px solid #0f1115', background: '#fff', color: '#0f1115', outline: 'none', width: 220 }}
                placeholder="Fokus"
                defaultValue="Zaktualizować dashboard"
              />
              <input
                style={{ fontSize: 13, padding: '9px 13px', borderRadius: 10, border: '1px solid #e8e8e4', background: '#f7f7f4', color: '#c0c5cc', outline: 'none', width: 180 }}
                placeholder="Wyłączone"
                disabled
              />
            </Row>
            <Row label="Textarea">
              <textarea
                style={{ fontSize: 13, padding: '10px 12px', borderRadius: 10, border: '1px solid #ececec', background: '#f7f7f4', color: '#0f1115', outline: 'none', width: 300, minHeight: 80, resize: 'none', lineHeight: 1.6 }}
                placeholder="Dodaj kontekst, linki, kroki..."
              />
            </Row>
          </div>

          {/* Task row */}
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 15, fontWeight: 650, color: '#0f1115', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #f1f0ed' }}>Task Item</h3>
            <Row label="Warianty">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 420 }}>
                {[
                  { content: 'Zaprojektować onboarding flow', priority: 'P1', done: false, date: '28 maj' },
                  { content: 'Przejrzeć feedback od użytkowników', priority: 'P2', done: false, date: '29 maj' },
                  { content: 'Zaktualizować zależności npm', priority: 'P4', done: true,  date: '25 maj' },
                ].map(t => (
                  <div key={t.content} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#f7f7f4' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${t.done ? '#0f1115' : '#d4d4d0'}`, background: t.done ? '#0f1115' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {t.done && <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: t.done ? '#9098a4' : '#0f1115', textDecoration: t.done ? 'line-through' : 'none' }}>{t.content}</span>
                    <span style={{ fontSize: 11.5, color: '#b0b5be' }}>{t.date}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: t.priority === 'P1' ? 'oklch(0.96 0.03 25)' : t.priority === 'P2' ? 'oklch(0.96 0.03 55)' : 'oklch(0.95 0.005 260)', color: t.priority === 'P1' ? 'oklch(0.62 0.18 25)' : t.priority === 'P2' ? 'oklch(0.70 0.16 55)' : 'oklch(0.65 0.01 260)' }}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </Row>
          </div>

          {/* Calendar */}
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 15, fontWeight: 650, color: '#0f1115', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #f1f0ed' }}>Kalendarz</h3>
            <Row label="DatePicker">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    onClick={() => setShowCal(o => !o)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: '#f1f0ed', fontSize: 13, color: calDate ? '#0f1115' : '#9098a4', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/></svg>
                    {calDate ? new Date(calDate + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }) : 'Wybierz datę'}
                  </div>
                  {calDate && (
                    <button onClick={() => setCalDate('')} style={{ fontSize: 11.5, color: '#9098a4', background: 'none', border: 'none', cursor: 'pointer' }}>wyczyść</button>
                  )}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateRows: showCal ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                  maxWidth: 280,
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{
                      opacity: showCal ? 1 : 0,
                      transform: showCal ? 'translateY(0)' : 'translateY(-4px)',
                      transition: 'opacity 0.22s ease, transform 0.22s ease',
                    }}>
                      <CalendarDatePicker
                        value={calDate}
                        onChange={v => { setCalDate(v); setShowCal(false); }}
                        onClose={() => setShowCal(false)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Row>
          </div>

          {/* Sidebar item */}
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 15, fontWeight: 650, color: '#0f1115', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #f1f0ed' }}>Nawigacja</h3>
            <Row label="Nav item">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 200 }}>
                {[
                  { label: 'Centrum', active: true },
                  { label: 'Zadania', active: false },
                  { label: 'Wiedza',  active: false },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8,
                    fontSize: 13.5, fontWeight: item.active ? 600 : 500,
                    color: item.active ? '#0f1115' : '#5a606b',
                    background: 'transparent',
                  }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    {item.label}
                    {item.active && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: '#0f1115' }} />}
                  </div>
                ))}
              </div>
            </Row>
          </div>
        </Section>

        {/* ══ 8. MOTION ═══════════════════════════════════════════════════════ */}
        <Section id="motion" title="Motion & Animacje" subtitle="Każda animacja ma cel — informuje o stanie, nie dekoruje. Zasada: szybko w, płynnie z.">

          <Row label="Easing">
            <Token label="Default"  value="cubic-bezier(0.4, 0, 0.2, 1)"        mono />
            <Token label="Spring"   value="cubic-bezier(0.34, 1.2, 0.64, 1)"    mono />
            <Token label="Enter"    value="cubic-bezier(0.16, 1, 0.3, 1)"        mono />
          </Row>

          <Row label="Duration">
            <Token label="Instant"  value="0.12s — hover, focus" />
            <Token label="Fast"     value="0.18s — dropdown open" />
            <Token label="Normal"   value="0.22s — fade in/out" />
            <Token label="Slow"     value="0.28s — height expand" />
            <Token label="Subtle"   value="0.30s — scale in" />
          </Row>

          <Row label="Patterns">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#3a3f47', lineHeight: 1.6 }}>
              <div><strong>Dropdown</strong> — opacity + scale(0.97) + translateY(-6px) → 0.18s spring</div>
              <div><strong>Calendar expand</strong> — grid-template-rows 0fr → 1fr → 0.28s ease + opacity 0.22s</div>
              <div><strong>Modal wjazd</strong> — opacity + translateY(-4px) → 0.22s ease</div>
              <div><strong>Fade in up</strong> — opacity + translateY(10px) → 0.5s enter (listy, karty)</div>
              <div><strong>Scale in</strong> — opacity + scale(0.96) → 0.3s enter (modale)</div>
            </div>
          </Row>
        </Section>

        {/* ══ 9. DARK MODE ════════════════════════════════════════════════════ */}
        <Section id="darkmode" title="Dark Mode" subtitle="Dark mode używa czystej czerni #000000 jako bazy. Elementy mają subtelne białe przezroczystości zamiast szarych flat kolorów.">

          <div style={{ background: '#000', borderRadius: 18, padding: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {[
              { label: 'Background',   value: '#000000',                desc: 'App bg' },
              { label: 'Surface',      value: '#1C1C1E',                desc: 'Sidebar, cards' },
              { label: 'Border',       value: 'rgba(255,255,255,0.05)', desc: 'Dividers' },
              { label: 'Border hover', value: 'rgba(255,255,255,0.1)',  desc: 'Hover state' },
              { label: 'Text',         value: '#FFFFFF',                desc: 'Primary' },
              { label: 'Text muted',   value: 'rgba(255,255,255,0.4)',  desc: 'Secondary' },
            ].map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: c.value, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{c.label}</div>
                  <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)' }}>{c.value}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)' }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <Row label="Zasady">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#3a3f47', lineHeight: 1.6 }}>
              <div>• Nie używaj flat szarości — używaj <code style={{ background: '#f1f0ed', padding: '1px 5px', borderRadius: 4 }}>rgba(255,255,255,0.X)</code></div>
              <div>• Cienie w dark mode są niewidoczne — zastąp subtelnym borderem</div>
              <div>• Blur (<code style={{ background: '#f1f0ed', padding: '1px 5px', borderRadius: 4 }}>backdrop-blur-xl</code>) daje głębię bez ciężkich kolorów</div>
              <div>• Sidebar: <code style={{ background: '#f1f0ed', padding: '1px 5px', borderRadius: 4 }}>#1C1C1E</code> z 80% opacity + blur</div>
            </div>
          </Row>
        </Section>

        {/* Footer */}
        <div style={{ paddingTop: 32, borderTop: '1px solid #f1f0ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/mindle_mark_black.svg" alt="" style={{ width: 14, height: 14 }} />
            <span style={{ fontSize: 12, color: '#9098a4' }}>Midle Design System v1.0</span>
          </div>
          <span style={{ fontSize: 12, color: '#b0b5be' }}>Filipwasiewicz — 2026</span>
        </div>

      </main>
    </div>
  );
}
