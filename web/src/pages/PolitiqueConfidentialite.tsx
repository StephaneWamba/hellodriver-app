export default function PolitiqueConfidentialite() {
  return (
    <main className="pt-24 pb-16 max-w-3xl mx-auto px-4">
      <h1 className="text-3xl font-bold text-dark mb-8">Politique de Confidentialité</h1>

      <Section title="Collecte des données">
        HelloDriver collecte les données personnelles nécessaires au bon fonctionnement de la plateforme : nom, prénom, numéro de téléphone, adresse e-mail, données de géolocalisation et informations de paiement.
      </Section>

      <Section title="Utilisation des données">
        <p className="mb-2">Les données collectées sont utilisées pour :</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-600 text-sm">
          <li>Mettre en relation les clients avec les chauffeurs</li>
          <li>Traiter les paiements (Mobile Money, carte bancaire)</li>
          <li>Améliorer la qualité du service</li>
          <li>Assurer la sécurité des utilisateurs</li>
          <li>Envoyer des notifications relatives aux courses</li>
        </ul>
      </Section>

      <Section title="Partage des données">
        HelloDriver ne vend ni ne loue vos données personnelles à des tiers. Les données peuvent être partagées avec les chauffeurs dans le cadre d'une course, ou avec des prestataires de paiement pour le traitement des transactions.
      </Section>

      <Section title="Conservation des données">
        Les données personnelles sont conservées pendant la durée de votre utilisation du service, puis supprimées dans un délai de 12 mois après la clôture de votre compte.
      </Section>

      <Section title="Sécurité">
        HelloDriver met en œuvre des mesures techniques et organisationnelles pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.
      </Section>

      <Section title="Vos droits">
        <p className="mb-2">Conformément à la réglementation applicable, vous disposez des droits suivants :</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-600 text-sm mb-3">
          <li>Droit d'accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit de suppression</li>
          <li>Droit d'opposition au traitement</li>
        </ul>
        <p className="text-sm text-gray-600">
          Pour exercer vos droits, contactez-nous à{' '}
          <a href="mailto:contact@hellodriver.ga" className="text-primary font-semibold">
            contact@hellodriver.ga
          </a>.
        </p>
      </Section>

      <Section title="Cookies">
        Le site utilise des cookies techniques nécessaires à son fonctionnement. Aucun cookie publicitaire n'est utilisé sans votre consentement.
      </Section>

      <p className="text-xs text-gray-400 mt-8">Dernière mise à jour : mai 2026</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-dark mb-3">{title}</h2>
      <div className="text-gray-600 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
