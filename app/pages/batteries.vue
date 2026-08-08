<script setup lang="ts">
/**
 * The German battery take-back notice.
 *
 * Hardcoded in German for the same reason as the Impressum: it is a statutory
 * disclosure owed to a German buyer, and a French translation of it discharges
 * nothing. It is not routed through $t().
 *
 * Selling e-bikes into Germany makes us a distributor of traction batteries, so
 * the take-back obligation and this notice exist whether or not we advertise
 * them. The safety section is not boilerplate — a swollen lithium pack posted as
 * an ordinary parcel is a fire in someone else's van.
 */
const localePath = useLocalePath()

useSeoMeta({
  title: 'Batterieentsorgung und Rücknahme von Altbatterien — Vitesse Eco',
  description:
    'Hinweise nach dem Batterierecht: Rückgabe gebrauchter Lithium-Ionen-Akkus für Elektrofahrräder, kostenlose Rücknahme bei Vitesse Eco, Bedeutung der durchgestrichenen Mülltonne und Sicherheitshinweise für beschädigte Akkus.',
  robots: 'index, follow',
})
</script>

<template>
  <div class="container-page py-12">
    <!-- lang="de" so assistive technology switches pronunciation: the document
         language is French on the unprefixed URL. -->
    <article lang="de" class="mx-auto max-w-3xl">
      <h1 class="font-display text-3xl font-extrabold text-content-strong">
        Batterieentsorgung und Rücknahme von Altbatterien
      </h1>
      <p class="mt-3 text-content-muted">
        Hinweise nach dem Batterierecht (Batterierecht-Durchführungsgesetz, vormals Batteriegesetz).
      </p>

      <p class="mt-6 text-content">
        Wir verkaufen Elektrofahrräder mit Lithium-Ionen-Akkus sowie Ersatzakkus und Zubehör mit
        Batterien. Deshalb sind wir verpflichtet, Sie über die Rückgabe und die Entsorgung
        gebrauchter Batterien zu informieren. Diese Hinweise gelten für alle Batterien und Akkus, die
        wir liefern — insbesondere für Traktionsakkus von Elektrofahrrädern, also Batterien für
        leichte Verkehrsmittel.
      </p>

      <section class="mt-10">
        <h2 class="font-display text-xl font-bold text-content-strong">
          Das Symbol der durchgestrichenen Mülltonne
        </h2>
        <div class="card mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <!-- Drawn inline in currentColor rather than shipped as an image file:
               the notice has to explain the symbol next to the symbol, and an
               icon that inherits the text colour stays legible in both themes. -->
          <svg
            viewBox="0 0 48 48"
            class="h-20 w-20 shrink-0 text-content-strong"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M13 14h22l-2 26H15L13 14Z" />
            <path d="M9 11h30" />
            <path d="M19 11V7h10v4" />
            <circle cx="17" cy="43" r="2.5" />
            <circle cx="31" cy="43" r="2.5" />
            <path d="M7 6 41 44" />
            <path d="M41 6 7 44" />
          </svg>
          <p class="text-content">
            Batterien und Akkus tragen dieses Zeichen auf dem Gehäuse, dem Etikett oder der
            Verpackung. Es bedeutet: Diese Batterie gehört nicht in den Hausmüll. Auch die
            Restmülltonne, die Gelbe Tonne, das Altpapier und der Sperrmüll sind keine zulässigen
            Entsorgungswege.
          </p>
        </div>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          Ihre Pflicht als Endnutzerin oder Endnutzer
        </h2>
        <p class="mt-3 text-content">
          Sie sind gesetzlich verpflichtet, Altbatterien und Altakkus einer getrennten Sammlung
          zuzuführen. Die Rückgabe ist für Sie unentgeltlich. Das Verbot ist kein Formalismus:
          beschädigte Lithium-Ionen-Zellen entzünden sich in Müllfahrzeugen und Sortieranlagen
          regelmäßig und verursachen dort schwere Brände.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          Rücknahme bei uns — unentgeltlich
        </h2>
        <p class="mt-3 text-content">
          Altakkus der Art, die wir im Sortiment führen, nehmen wir unentgeltlich zurück, unabhängig
          davon, ob Sie den Akku bei uns gekauft haben. Rückgabeadresse:
        </p>
        <address class="mt-3 space-y-1 not-italic text-content">
          <p class="font-semibold text-content-strong">VITESSE ECO SAS</p>
          <p>32 Rue du Faubourg du Pont Neuf</p>
          <p>86000 Poitiers</p>
          <p>Frankreich</p>
        </address>
        <p class="mt-4 text-content">
          Wenn wir mit unserem eigenen Fahrzeug zu Ihnen liefern — Belgien, die Niederlande und das
          französische Département 86 — können wir den alten Akku bei der Lieferung mitnehmen. Bitte
          kündigen Sie das vorher unter
          <ContactLink kind="email" class="hover:text-accent" />
          oder <ContactLink kind="phone" class="hover:text-accent" /> an, damit
          wir den Transport als Gefahrgut korrekt vorbereiten können.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Weitere Rückgabestellen</h2>
        <ul class="mt-3 space-y-2 text-content">
          <li class="flex gap-2">
            <span aria-hidden="true" class="text-accent">·</span>
            <span>
              Kommunale Sammelstellen und Wertstoffhöfe nehmen Lithium-Ionen-Akkus an. Fragen Sie bei
              großen Traktionsakkus bitte vorher nach, ob die Annahmestelle sie entgegennimmt.
            </span>
          </li>
          <li class="flex gap-2">
            <span aria-hidden="true" class="text-accent">·</span>
            <span>
              Vertreiber, die Akkus derselben Art im Sortiment führen — etwa Fahrradhändler mit
              E-Bike-Angebot — sind ebenfalls zur unentgeltlichen Rücknahme verpflichtet.
            </span>
          </li>
          <li class="flex gap-2">
            <span aria-hidden="true" class="text-accent">·</span>
            <span>
              Geben Sie den Akku immer vollständig ab. Öffnen, zerlegen oder entnehmen Sie keine
              Zellen; ein geöffneter Akku ist weder sicher zu transportieren noch verwertbar.
            </span>
          </li>
        </ul>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Die Zeichen Pb, Cd und Hg</h2>
        <p class="mt-3 text-content">
          Trägt eine Batterie unter der durchgestrichenen Mülltonne zusätzlich ein chemisches
          Zeichen, weist dieses auf einen Schadstoffgehalt oberhalb der gesetzlichen Grenzwerte hin:
        </p>
        <dl class="mt-3 space-y-2 text-content">
          <div class="flex flex-wrap gap-x-2">
            <dt class="font-semibold text-content-strong">Pb</dt>
            <dd>Blei — mehr als 0,004 Masseprozent</dd>
          </div>
          <div class="flex flex-wrap gap-x-2">
            <dt class="font-semibold text-content-strong">Cd</dt>
            <dd>Cadmium — mehr als 0,002 Masseprozent</dd>
          </div>
          <div class="flex flex-wrap gap-x-2">
            <dt class="font-semibold text-content-strong">Hg</dt>
            <dd>Quecksilber — mehr als 0,0005 Masseprozent</dd>
          </div>
        </dl>
        <p class="mt-3 text-content">
          Batterien mit einem dieser Zeichen müssen besonders zuverlässig getrennt gesammelt werden.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">
          Sicherheit: beschädigte oder aufgeblähte Akkus
        </h2>
        <p class="mt-3 text-content">
          Ein Lithium-Ionen-Akku, der aufgebläht oder verformt ist, warm wird, riecht, ausläuft oder
          nach einem Sturz sichtbar beschädigt ist, gilt als Gefahrgut. Er darf nicht mit der Post
          und nicht mit einem gewöhnlichen Paketdienst versendet werden.
        </p>
        <ul class="mt-3 space-y-2 text-content">
          <li class="flex gap-2">
            <span aria-hidden="true" class="text-danger">·</span>
            <span>
              Bringen Sie den Akku persönlich zu uns oder rufen Sie uns an, damit wir die Abholung
              organisieren.
            </span>
          </li>
          <li class="flex gap-2">
            <span aria-hidden="true" class="text-danger">·</span>
            <span>
              Kleben Sie die Kontakte vor jedem Transport mit Klebeband ab, damit kein Kurzschluss
              entstehen kann.
            </span>
          </li>
          <li class="flex gap-2">
            <span aria-hidden="true" class="text-danger">·</span>
            <span>
              Lagern Sie den Akku bis zur Abgabe kühl, trocken, außerhalb von Wohnräumen und nicht
              auf brennbarem Untergrund. Laden Sie ihn nicht mehr auf.
            </span>
          </li>
          <li class="flex gap-2">
            <span aria-hidden="true" class="text-danger">·</span>
            <span>Werfen Sie ihn unter keinen Umständen in den Hausmüll oder ins Feuer.</span>
          </li>
        </ul>
      </section>

      <section class="mt-8">
        <h2 class="font-display text-xl font-bold text-content-strong">Fragen zur Rückgabe</h2>
        <p class="mt-3 text-content">
          Schreiben Sie an
          <ContactLink kind="email" class="hover:text-accent" />,
          rufen Sie <ContactLink kind="phone" class="hover:text-accent" /> an
          oder schreiben Sie uns über
          <ContactLink kind="whatsapp" label="WhatsApp" class="hover:text-accent" />.
          Unsere vollständigen Anbieterangaben stehen im
          <NuxtLink :to="localePath('/impressum')" class="text-accent hover:underline">Impressum</NuxtLink>.
        </p>
      </section>
    </article>
  </div>
</template>
