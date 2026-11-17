export default function CGU() {
  return (
    <main className="pt-24 pb-16 max-w-3xl mx-auto px-4">
      <h1 className="text-3xl font-bold text-dark mb-8">Conditions Générales d'Utilisation</h1>

      <Section title="1. Objet">
        Les présentes CGU régissent l'utilisation de la plateforme HelloDriver, service de mise en relation entre passagers et chauffeurs indépendants à Libreville, Gabon, exploité par Hello Consulting (RCCM GA-LBV-01-2026-A10-01738).
      </Section>

      <Section title="2. Accès au service">
        L'accès à HelloDriver est disponible via l'application mobile ou WhatsApp. L'utilisation du service implique l'acceptation des présentes CGU. Tout utilisateur doit être âgé d'au moins 18 ans.
      </Section>

      <Section title="3. Rôle de HelloDriver">
        HelloDriver est une plateforme de mise en relation. HelloDriver n'est pas transporteur et n'emploie pas les chauffeurs. Les chauffeurs sont des prestataires indépendants. HelloDriver prélève une commission de 5% sur chaque course effectuée.
      </Section>

      <Section title="4. Tarification">
        Les prix sont calculés en XAF (franc CFA) selon la distance et les conditions de trafic. Une fourchette de prix est proposée au passager, qui choisit librement le tarif souhaité. Les prix affichés sont les prix finaux, sans frais cachés.
      </Section>

      <Section title="5. Paiement">
        Le paiement s'effectue via Airtel Money ou Moov Money. Le passager autorise le prélèvement du montant de la course à la confirmation de sa demande. En cas d'annulation, aucune somme n'est prélevée si la course n'a pas débuté.
      </Section>

      <Section title="6. Annulations">
        <ul className="list-disc pl-5 space-y-1 text-gray-600 text-sm">
          <li>Annulation avant acceptation par un driver : gratuite</li>
          <li>Annulation après acceptation : frais d'annulation pouvant s'appliquer</li>
          <li>Absence du passager à l'heure convenue : la course peut être annulée par le driver</li>
        </ul>
      </Section>

      <Section title="7. Obligations du passager">
        Le passager s'engage à : fournir des informations exactes (localisation, nombre de passagers), respecter le chauffeur et son véhicule, ne pas transporter de marchandises illicites, régler le montant convenu.
      </Section>

      <Section title="8. Obligations du chauffeur">
        Le chauffeur s'engage à : maintenir ses documents à jour (permis, assurance, carte grise), assurer un service de qualité, respecter le code de la route gabonais, ne pas annuler abusivement des courses acceptées.
      </Section>

      <Section title="9. Responsabilité">
        HelloDriver n'est pas responsable des accidents, retards ou incidents survenus durant les courses. La responsabilité du chauffeur est engagée en tant que prestataire indépendant. HelloDriver ne garantit pas la disponibilité permanente du service.
      </Section>

      <Section title="10. Modification des CGU">
        HelloDriver se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés des modifications significatives via l'application ou WhatsApp. La poursuite de l'utilisation du service vaut acceptation des nouvelles CGU.
      </Section>

      <Section title="11. Droit applicable">
        Les présentes CGU sont soumises au droit gabonais. Tout litige relève de la compétence des tribunaux de Libreville, Gabon.
      </Section>

      <Section title="12. Contact">
        <p className="text-sm text-gray-600">
          Pour toute question relative aux présentes CGU :{' '}
          <a href="mailto:contact@hellodriver.ga" className="text-primary font-semibold">
            contact@hellodriver.ga
          </a>
        </p>
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
