export default function MentionsLegales() {
  return (
    <main className="pt-24 pb-16 max-w-3xl mx-auto px-4">
      <h1 className="text-3xl font-bold text-dark mb-8">Mentions Légales</h1>

      <Section title="Éditeur du site">
        <table className="text-sm text-gray-600 w-full">
          <tbody className="divide-y divide-gray-100">
            <Row label="Raison sociale" value="Hello Consulting" />
            <Row label="Forme juridique" value="Entreprise Individuelle" />
            <Row label="N° RCCM" value="GA-LBV-01-2026-A10-01738" />
            <Row label="N° NIF" value="20262006137-B" />
            <Row label="Siège social" value="Alibandeng, A IGADE, BP 001 — Libreville, Gabon" />
            <Row label="Représentant légal" value="Patrick Ronny Serge BIAM WORA" />
            <Row label="Contact" value="contact@hellodriver.ga" />
            <Row label="Téléphone" value="+241 077 71 67 70" />
          </tbody>
        </table>
      </Section>

      <Section title="Hébergement">
        <table className="text-sm text-gray-600 w-full">
          <tbody className="divide-y divide-gray-100">
            <Row label="Hébergeur" value="Vercel Inc." />
            <Row label="Adresse" value="440 N Barranca Ave #4133, Covina, CA 91723, USA" />
            <Row label="Site" value="vercel.com" />
          </tbody>
        </table>
      </Section>

      <Section title="Propriété intellectuelle">
        L'ensemble du contenu de ce site (textes, images, logo, interface) est la propriété exclusive de Hello Consulting. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.
      </Section>

      <Section title="Données personnelles">
        Conformément à la réglementation en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à{' '}
        <a href="mailto:contact@hellodriver.ga" className="text-primary font-semibold">
          contact@hellodriver.ga
        </a>.
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-2 pr-4 font-medium text-gray-700 w-40">{label}</td>
      <td className="py-2 text-gray-600">{value}</td>
    </tr>
  );
}
