import { Link } from '@tanstack/react-router'
import { WaitingPage } from '@/components/waiting-page'
import { SECONDARY_BUTTON_CLASS } from '@/components/secondary-button.ts'

/**
 * EPG-01 to EPG-03, deferred to v1.1: no collection carries a goal, and §8 of
 * the functional specs holds the open questions — whether a goal is a savings
 * account or an envelope, and what becomes of one that is reached.
 *
 * It points at Comptes because an `epargne` account already holds the money;
 * what is missing is the goal beside it, not the balance.
 */
export function SavingsPage() {
  return (
    <WaitingPage
      title="Épargne"
      lead="Vos objectifs d'épargne arriveront en v1.1. En attendant, un compte de type Épargne suit déjà l'argent mis de côté — c'est l'objectif en face qui manque, pas le solde."
      coming={[
        'Un objectif : un nom, un montant à atteindre, une date facultative',
        'Des versements, et la progression en francs et en pourcentage',
        "La date d'atteinte projetée au rythme actuel",
      ]}
    >
      <Link to="/accounts" className={`${SECONDARY_BUTTON_CLASS} inline-block py-2`}>
        Voir mes Comptes
      </Link>
    </WaitingPage>
  )
}
