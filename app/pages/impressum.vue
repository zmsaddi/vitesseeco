<script setup lang="ts">
/**
 * The German Impressum.
 *
 * The text is hardcoded in German and deliberately not routed through $t().
 * An Impressum is a disclosure a German visitor must be able to read in German;
 * a translated one satisfies nobody and a missing one is what Abmahnung letters
 * are written about. It is served at every locale prefix on purpose — the
 * obligation follows the reader, not the URL.
 *
 * Statute citations are the current ones: the TMG was replaced by the DDG in
 * May 2024, so § 5 DDG carries what used to be § 5 TMG.
 */
const localePath = useLocalePath()

/**
 * The DDG requires the legal representative to be named, and § 18 MStV requires
 * a named person responsible for the content. No name was supplied, and inventing
 * one on a legal page is worse than a gap that is visible — so it sits here once,
 * as a single line to fill in, instead of twice inside the markup.
 */
const vertretungsberechtigt = '[Vor- und Nachname der vertretungsberechtigten Person eintragen]'

useSeoMeta({
  title: 'Impressum — Vitesse Eco',
  description:
    'Impressum der VITESSE ECO SAS: Anbieterkennzeichnung nach § 5 DDG, Kontakt, Umsatzsteuer-Identifikationsnummer und Haftungshinweise.',
  robots: 'index, follow',
})
</script>

<template>
  <div class="container-page py-12">
    <!-- lang="de" because the surrounding document is French on the unprefixed
         URL, and a screen reader would otherwise read German with French rules. -->
    <article lang="de" class="mx-auto max-w-3xl">
      <h1 class="font-display text-3xl font-extrabold text-content-strong">Impressum</h1>
      <p class="mt-3 text-content-muted">
        Anbieterkennzeichnung nach § 5 Digitale-Dienste-Gesetz (DDG, vormals § 5 TMG) und
        § 18 Abs. 2 Medienstaatsvertrag.
      </p>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">Angaben gemäß § 5 DDG</h2>
        <address class="mt-3 space-y-1 not-italic text-content">
          <p class="font-semibold text-content-strong">VITESSE ECO SAS</p>
          <p>Société par actions simplifiée (SAS) — vereinfachte Aktiengesellschaft französischen Rechts</p>
          <p>32 Rue du Faubourg du Pont Neuf</p>
          <p>86000 Poitiers</p>
          <p>Frankreich</p>
        </address>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Vertreten durch</h2>
        <p class="mt-3 text-content">Président (gesetzlicher Vertreter): {{ vertretungsberechtigt }}</p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Kontakt</h2>
        <dl class="mt-3 space-y-1 text-content">
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-content-muted">Telefon:</dt>
            <dd><ContactLink kind="phone" class="hover:text-accent" /></dd>
          </div>
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-content-muted">WhatsApp:</dt>
            <dd>
              <ContactLink kind="whatsapp" class="hover:text-accent" />
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-content-muted">E-Mail:</dt>
            <dd>
              <ContactLink kind="email" class="hover:text-accent" />
            </dd>
          </div>
          <div class="flex flex-wrap gap-x-2">
            <dt class="text-content-muted">Website:</dt>
            <dd>vitesse-eco.fr</dd>
          </div>
        </dl>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Registereintrag</h2>
        <p class="mt-3 text-content">
          Eingetragen im französischen Handels- und Gesellschaftsregister (Registre du commerce et
          des sociétés).
        </p>
        <p class="mt-1 text-content">Unternehmensnummer (SIREN): 100 732 247</p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          Umsatzsteuer-Identifikationsnummer
        </h2>
        <p class="mt-3 text-content">
          Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: FR43 100 732 247
        </p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Redaktionell verantwortlich</h2>
        <address class="mt-3 space-y-1 not-italic text-content">
          <p>{{ vertretungsberechtigt }}</p>
          <p>VITESSE ECO SAS, 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich</p>
        </address>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          EU-Streitschlichtung und Verbraucherstreitbeilegung
        </h2>
        <!-- No link to the OS platform: it was shut down on 20 July 2025, and
             pointing consumers at a dead redress route is itself a warnable
             misstatement. The § 36 VSBG declaration below is the part that still
             has legal effect. -->
        <p class="mt-3 text-content">
          Die Plattform der Europäischen Kommission zur Online-Streitbeilegung (OS-Plattform) wurde
          zum 20. Juli 2025 eingestellt. Ein Verweis darauf entfällt daher.
        </p>
        <p class="mt-3 text-content">
          Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen. Bei Beanstandungen wenden Sie sich bitte
          direkt an
          <ContactLink kind="email" class="hover:text-accent" />
          — wir beantworten jede Nachricht.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Haftung für Inhalte</h2>
        <p class="mt-3 text-content">
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach
          den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter
          jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
          überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
          allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist erst ab dem
          Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden
          entsprechender Rechtsverletzungen entfernen wir diese Inhalte umgehend.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Haftung für Links</h2>
        <p class="mt-3 text-content">
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
          Einfluss haben. Für diese fremden Inhalte können wir deshalb keine Gewähr übernehmen. Für
          die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
          verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
          Rechtsverstöße überprüft; rechtswidrige Inhalte waren zu diesem Zeitpunkt nicht erkennbar.
          Eine dauerhafte inhaltliche Kontrolle ohne konkrete Anhaltspunkte einer Rechtsverletzung
          ist nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links
          umgehend.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Urheberrecht</h2>
        <p class="mt-3 text-content">
          Die von uns erstellten Inhalte und Werke auf diesen Seiten unterliegen dem französischen
          und dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
          Verwertung außerhalb der Grenzen des Urheberrechts bedürfen unserer schriftlichen
          Zustimmung. Downloads und Kopien dieser Seite sind nur für den privaten, nicht
          kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht von uns
          erstellt wurden, werden die Urheberrechte Dritter beachtet und entsprechend gekennzeichnet.
          Sollten Sie dennoch auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
          Hinweis; bei Bekanntwerden entfernen wir solche Inhalte umgehend.
        </p>
      </section>

      <!-- German shops are expected to reach the battery notice from here, and
           this page is the one German visitors actually look for. -->
      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Batterien und Akkus</h2>
        <p class="mt-3 text-content">
          Hinweise zur unentgeltlichen Rücknahme und zur Entsorgung von Altbatterien finden Sie unter
          <NuxtLink :to="localePath('/batteries')" class="text-accent hover:underline">
            Batterieentsorgung
          </NuxtLink>.
        </p>
      </section>
    </article>
  </div>
</template>
