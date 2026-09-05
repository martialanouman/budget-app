import { Link } from '@tanstack/react-router'
import { WaitingPage } from '@/components/waiting-page'
import { SECONDARY_BUTTON_CLASS } from '@/components/secondary-button.ts'

/**
 * RAP-03 to RAP-05 and the two twelve-month curves of RAP-02, deferred to v1.1
 * (§8 of the functional specs). What already exists is the current month's
 * breakdown, on the dashboard — so this screen says where it is rather than
 * pretending nothing is reported yet.
 */
export function ReportsPage() {
  return (
    <WaitingPage
      title="Rapports"
      lead="La répartition des dépenses du mois est déjà sur l'accueil. Ce qui arrivera ici en v1.1, c'est tout ce qui demande de comparer plusieurs mois."
      coming={[
        "Une catégorie suivie mois par mois, sur six mois d'historique",
        'Revenus, dépenses et endettement sur douze mois',
        'Une synthèse mensuelle à consulter et à exporter en PDF',
        'Un export CSV sur une période choisie',
      ]}
    >
      <Link to="/" className={`${SECONDARY_BUTTON_CLASS} inline-block py-2`}>
        Voir la répartition du mois
      </Link>
    </WaitingPage>
  )
}
