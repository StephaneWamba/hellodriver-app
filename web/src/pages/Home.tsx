import { useState } from 'react';

const WA_LINK = 'https://wa.me/24177716770?text=Bonjour%2C%20je%20veux%20commander%20une%20course%20avec%20HelloDriver.%0AD%C3%A9part%20%3A%20%0ADestination%20%3A%20%0ANombre%20de%20passagers%20%3A%20';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <PriceSelector />
      <Benefits />
      <Testimonials />
      <BecomeDriver />
      <Safety />
      <FAQ />
    </main>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="pt-24 pb-16 bg-gradient-to-br from-white via-gray-50 to-emerald-50 min-h-screen flex items-center">
      <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-primary text-sm font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            142 chauffeurs disponibles
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-dark leading-tight mb-4">
            Trouvez un chauffeur au meilleur prix{' '}
            <span className="text-primary">en quelques secondes.</span>
          </h1>
          <p className="text-gray-500 text-lg mb-2">
            Discutez avec notre assistant WhatsApp et choisissez l'offre qui vous convient.
          </p>
          <p className="text-gray-400 mb-8">Choisissez votre chauffeur… et votre prix.</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-primary-dark transition-colors shadow-lg shadow-emerald-200"
            >
              <WhatsAppIcon className="w-5 h-5 fill-white" />
              Commander sur WhatsApp
            </a>
            <a
              href="#drivers"
              className="flex items-center gap-2 border border-gray-300 text-dark font-semibold px-6 py-3 rounded-full hover:border-primary hover:text-primary transition-colors"
            >
              Devenir Driver
              <span>→</span>
            </a>
          </div>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center">
          <div className="relative w-64 h-[500px] bg-dark rounded-[2.5rem] shadow-2xl border-4 border-gray-800 overflow-hidden flex flex-col">
            <div className="bg-gray-900 px-4 pt-8 pb-4 flex-1 overflow-hidden">
              <div className="text-xs text-gray-400 mb-4 text-center">HelloDriver WhatsApp</div>
              <ChatBubble from="bot" text="Bonjour ! 👋 Où souhaitez-vous aller ?" />
              <ChatBubble from="user" text="Alibandeng → Centre-ville" />
              <ChatBubble from="bot" text="Parfait ! Voici les offres disponibles :" />
              <div className="mt-2 space-y-2">
                <PriceChip label="Économique" price="1 500 XAF" />
                <PriceChip label="Standard" price="2 000 XAF" active />
                <PriceChip label="Confort" price="2 500 XAF" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ from, text }: { from: 'bot' | 'user'; text: string }) {
  return (
    <div className={`flex mb-2 ${from === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`text-xs px-3 py-2 rounded-2xl max-w-[80%] ${
          from === 'user' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-100'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function PriceChip({ label, price, active }: { label: string; price: string; active?: boolean }) {
  return (
    <div className={`flex justify-between items-center px-3 py-2 rounded-xl text-xs border ${active ? 'border-primary bg-primary/10 text-primary' : 'border-gray-700 text-gray-300'}`}>
      <span>{label}</span>
      <span className="font-bold">{price}</span>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n: '1', title: 'Envoyez votre demande', desc: 'Ouvrez WhatsApp et envoyez votre demande de course. C\'est aussi simple qu\'un message.' },
    { n: '2', title: 'Choisissez votre prix', desc: 'Sélectionnez le prix qui vous convient dans la fourchette proposée.' },
    { n: '3', title: 'Un driver accepte', desc: 'Les drivers disponibles reçoivent votre demande et acceptent la course.' },
    { n: '4', title: 'Suivez en temps réel', desc: 'Suivez votre chauffeur en temps réel sur la carte jusqu\'à votre destination.' },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-primary font-semibold text-sm uppercase tracking-wide mb-2">Comment ça marche</p>
          <h2 className="text-3xl md:text-4xl font-bold text-dark">Votre trajet en 4 étapes</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="relative p-6 rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-lg mb-4">
                {s.n}
              </div>
              <h3 className="font-bold text-dark mb-2">{s.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Price selector ────────────────────────────────────────────────────────────
function PriceSelector() {
  const [selected, setSelected] = useState(1);
  const options = [
    { label: 'Économique', badge: 'Disponible', price: '1 500 XAF' },
    { label: 'Standard', badge: 'Recommandé', price: '2 000 XAF' },
    { label: 'Confort', badge: 'Disponible', price: '2 500 XAF' },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-primary font-semibold text-sm uppercase tracking-wide mb-2">Sélection de prix intelligente</p>
          <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">
            Choisissez votre chauffeur… et votre prix.
          </h2>
          <p className="text-gray-500 leading-relaxed mb-4">
            Vous choisissez un prix dans la fourchette proposée. Les drivers disponibles acceptent la course, et vous partez en toute sérénité.
          </p>
          <p className="text-primary font-semibold">HelloDriver ne prend que 5% de commission sur chaque course.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <p className="text-sm text-gray-500 mb-1">Choisissez votre prix</p>
          <p className="font-semibold text-dark mb-4">Libreville → Oloumi</p>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Fourchette de prix suggérée</p>
          <div className="space-y-3">
            {options.map((o, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all ${
                  selected === i ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-dark text-sm">{o.label}</p>
                  <p className={`text-xs ${selected === i ? 'text-primary' : 'text-gray-400'}`}>{o.badge}</p>
                </div>
                <p className={`font-bold ${selected === i ? 'text-primary' : 'text-dark'}`}>{o.price}</p>
              </button>
            ))}
          </div>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block w-full text-center bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary-dark transition-colors"
          >
            Confirmer ce prix
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Benefits ──────────────────────────────────────────────────────────────────
function Benefits() {
  const items = [
    { icon: '🚗', title: 'Trouvez rapidement un chauffeur', desc: 'Des dizaines de chauffeurs disponibles prêts à vous conduire à tout moment.' },
    { icon: '💰', title: 'Choisissez le prix qui vous convient', desc: 'Sélectionnez votre tarif dans la fourchette proposée. Vous décidez.' },
    { icon: '📍', title: 'Suivi en temps réel sur la carte', desc: 'Suivez l\'arrivée et le trajet de votre chauffeur directement sur la carte.' },
    { icon: '⭐', title: 'Notez votre expérience', desc: 'Votre avis après chaque course aide à améliorer le service pour tous.' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-primary font-semibold text-sm uppercase tracking-wide mb-2">Avantages</p>
          <h2 className="text-3xl md:text-4xl font-bold text-dark">Pourquoi choisir HelloDriver ?</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.title} className="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-all">
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="font-bold text-dark mb-2 text-sm">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────
function Testimonials() {
  const reviews = [
    { name: 'Marie N.', role: 'Cliente, Libreville', text: '"Super pratique ! J\'envoie juste un message WhatsApp et en 5 minutes mon chauffeur est là. Les prix sont transparents."', stars: 5 },
    { name: 'Patrick M.', role: 'Driver Taxi', text: '"Depuis HelloDriver, je reçois 3x plus de courses. L\'application est simple et je garde 95% de mes revenus."', stars: 5 },
    { name: 'Sandra O.', role: 'Cliente, Port-Gentil', text: '"J\'adore pouvoir comparer les prix avant de choisir. Plus besoin de négocier, tout est clair !"', stars: 5 },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-primary font-semibold text-sm uppercase tracking-wide mb-2">Témoignages</p>
          <h2 className="text-3xl md:text-4xl font-bold text-dark">Ce que disent nos utilisateurs</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <div key={r.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: r.stars }).map((_, i) => (
                  <span key={i} className="text-yellow-400">★</span>
                ))}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{r.text}</p>
              <div>
                <p className="font-bold text-dark text-sm">{r.name}</p>
                <p className="text-gray-400 text-xs">{r.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Become Driver ─────────────────────────────────────────────────────────────
function BecomeDriver() {
  const features = [
    { icon: '🔔', label: 'Notifications de nouvelles courses' },
    { icon: '💳', label: 'Paiements sécurisés' },
    { icon: '📊', label: 'Suivi de vos revenus' },
    { icon: '⭐', label: 'Système de notation' },
  ];

  return (
    <section id="drivers" className="py-20 bg-dark text-white">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <p className="text-primary font-semibold text-sm uppercase tracking-wide mb-2">Partenaires chauffeurs</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Devenez Driver et recevez des demandes de courses
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Recevez des demandes de courses proches, choisissez celles qui vous intéressent, suivez vos revenus et travaillez librement. Vous gardez <span className="text-primary font-bold">95% de vos gains.</span>
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {features.map((f) => (
            <div key={f.label} className="bg-dark-card rounded-xl p-4 flex flex-col items-center gap-2">
              <span className="text-2xl">{f.icon}</span>
              <p className="text-sm font-medium text-gray-200">{f.label}</p>
            </div>
          ))}
        </div>
        <a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-driver text-white font-semibold px-8 py-3 rounded-full hover:bg-blue-600 transition-colors"
        >
          <WhatsAppIcon className="w-5 h-5 fill-white" />
          Devenir Driver sur WhatsApp
        </a>
      </div>
    </section>
  );
}

// ── Safety ────────────────────────────────────────────────────────────────────
function Safety() {
  const items = [
    { icon: '✅', title: 'Chauffeurs vérifiés', desc: 'Documents et permis contrôlés avant chaque inscription.' },
    { icon: '🔒', title: 'Paiements sécurisés', desc: 'Mobile Money et carte bancaire, transactions protégées.' },
    { icon: '🛡️', title: 'Protection des données', desc: 'Vos informations personnelles sont chiffrées et protégées.' },
    { icon: '💬', title: 'Support client', desc: 'Une équipe disponible pour vous aider à tout moment.' },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-primary font-semibold text-sm uppercase tracking-wide mb-2">Sécurité</p>
          <h2 className="text-3xl md:text-4xl font-bold text-dark">Voyagez l'esprit tranquille</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.title} className="p-6 rounded-2xl bg-gray-50 hover:shadow-md transition-all">
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="font-bold text-dark mb-2 text-sm">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  const items = [
    {
      q: 'Comment commander une course ?',
      a: 'Cliquez sur "Commander sur WhatsApp", envoyez votre point de départ et destination. Notre assistant vous proposera des chauffeurs disponibles avec leurs tarifs.',
    },
    {
      q: 'Comment sont fixés les prix ?',
      a: 'Les prix sont calculés selon la distance et les conditions de trafic. Une fourchette vous est proposée — vous choisissez le tarif qui vous convient.',
    },
    {
      q: 'Comment devenir driver ?',
      a: 'Contactez-nous via WhatsApp avec "Je veux devenir driver". Nous vous demanderons vos documents (permis, CNI, carte grise) pour vérification avant activation.',
    },
    {
      q: 'Quels sont les moyens de paiement ?',
      a: 'HelloDriver accepte le paiement via Airtel Money et Moov Money. Le paiement en espèces directement au chauffeur est également possible.',
    },
    {
      q: 'Quelle est la commission HelloDriver ?',
      a: 'HelloDriver prélève seulement 5% de commission sur chaque course. Les chauffeurs conservent 95% du montant de la course.',
    },
  ];

  return (
    <section id="faq" className="py-20 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-primary font-semibold text-sm uppercase tracking-wide mb-2">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold text-dark">Questions fréquentes</h2>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button
                className="w-full flex justify-between items-center px-6 py-4 text-left font-semibold text-dark hover:text-primary transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
              >
                {item.q}
                <span className={`text-primary transition-transform ${open === i ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {open === i && (
                <div className="px-6 pb-4 text-gray-500 text-sm leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Shared icon ───────────────────────────────────────────────────────────────
function WhatsAppIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
