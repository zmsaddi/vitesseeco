<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <h1 class="section-title mb-8">{{ $t('legal.withdrawal') }}</h1>
      <div class="card p-6 md:p-8 text-text-secondary leading-relaxed space-y-6">
        <section v-for="(s, i) in sections" :key="i">
          <h2 class="text-white font-display text-lg font-semibold mb-2">{{ s.h }}</h2>
          <p class="whitespace-pre-line text-sm">{{ s.p }}</p>
        </section>

        <!-- Model withdrawal form (EU directive 2011/83 annex) -->
        <section class="bg-dark-tertiary/30 rounded-xl p-5 border border-dark-tertiary">
          <h2 class="text-white font-display text-lg font-semibold mb-3">{{ form.title }}</h2>
          <p class="text-xs mb-3">{{ form.hint }}</p>
          <pre class="whitespace-pre-wrap text-xs font-mono leading-relaxed">{{ form.body }}</pre>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * U-K2 — Right of withdrawal / Widerrufsbelehrung (EU directive 2011/83,
 * mandatory for the German market incl. the model withdrawal form).
 * German text is authoritative for DE customers; in-page per-locale content
 * (cgv.vue pattern).
 */
const { t, locale } = useI18n()
useHead({
  title: `${t('legal.withdrawal')} — Vitesse Eco`,
  meta: [{ name: 'description', content: `${t('legal.withdrawal')} — Vitesse Eco` }],
})

const ADDR = 'VITESSE ECO SAS, 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France — contact@vitesse-eco.fr'

type Section = { h: string; p: string }
const allSections: Record<string, Section[]> = {
  de: [
    { h: 'Widerrufsrecht', p: 'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben.' },
    { h: 'Ausübung des Widerrufsrechts', p: `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${ADDR}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.` },
    { h: 'Folgen des Widerrufs', p: 'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben.' },
    { h: 'Rücksendung', p: 'Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden. Sie tragen die unmittelbaren Kosten der Rücksendung der Waren. Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang zurückzuführen ist.' },
  ],
  fr: [
    { h: 'Droit de rétractation', p: "Vous disposez d'un délai de quatorze jours pour vous rétracter, sans avoir à motiver votre décision. Le délai court à compter du jour où vous, ou un tiers désigné par vous autre que le transporteur, prenez physiquement possession du bien." },
    { h: 'Exercice du droit', p: `Pour exercer votre droit de rétractation, notifiez-nous (${ADDR}) votre décision au moyen d'une déclaration dénuée d'ambiguïté (courrier postal ou e-mail). Vous pouvez utiliser le modèle de formulaire ci-dessous, sans obligation. Il suffit que la notification soit envoyée avant l'expiration du délai.` },
    { h: 'Effets de la rétractation', p: "Nous vous remboursons tous les paiements reçus, y compris les frais de livraison standard, au plus tard quatorze jours à compter du jour où nous sommes informés de votre décision. Nous pouvons différer le remboursement jusqu'à réception du bien ou jusqu'à preuve de son expédition." },
    { h: 'Retour du produit', p: "Vous renvoyez le bien sans retard excessif et au plus tard quatorze jours après nous avoir communiqué votre décision. Les frais directs de renvoi sont à votre charge. Votre responsabilité n'est engagée qu'à l'égard de la dépréciation résultant de manipulations autres que celles nécessaires pour établir la nature, les caractéristiques et le bon fonctionnement du bien." },
  ],
  en: [
    { h: 'Right of withdrawal', p: 'You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period expires fourteen days after the day on which you, or a third party other than the carrier indicated by you, acquires physical possession of the goods.' },
    { h: 'Exercising the right', p: `To exercise the right of withdrawal, you must inform us (${ADDR}) of your decision by an unequivocal statement (letter or e-mail). You may use the model withdrawal form below, but it is not obligatory. Sending your communication before the withdrawal period expires is sufficient.` },
    { h: 'Effects of withdrawal', p: 'We shall reimburse all payments received from you, including standard delivery costs, without undue delay and no later than fourteen days from the day we are informed of your decision. We may withhold reimbursement until we have received the goods back or you have supplied evidence of having sent them back.' },
    { h: 'Returning the goods', p: 'You shall send back the goods without undue delay and in any event not later than fourteen days from the day you communicate your withdrawal. You bear the direct cost of returning the goods. You are only liable for any diminished value resulting from handling other than what is necessary to establish the nature, characteristics and functioning of the goods.' },
  ],
  es: [
    { h: 'Derecho de desistimiento', p: 'Tiene derecho a desistir del contrato en un plazo de catorce días sin necesidad de justificación. El plazo expira a los catorce días del día en que usted, o un tercero indicado por usted distinto del transportista, adquiera la posesión material de los bienes.' },
    { h: 'Ejercicio del derecho', p: `Para ejercer el derecho de desistimiento, deberá notificarnos (${ADDR}) su decisión mediante una declaración inequívoca (carta o correo electrónico). Podrá utilizar el modelo de formulario que figura a continuación, aunque su uso no es obligatorio. Basta con enviar la comunicación antes de que venza el plazo.` },
    { h: 'Consecuencias del desistimiento', p: 'Le devolveremos todos los pagos recibidos, incluidos los gastos de entrega estándar, sin demora indebida y, a más tardar, catorce días a partir de la fecha en que se nos informe de su decisión. Podremos retener el reembolso hasta haber recibido los bienes o hasta que presente prueba de su devolución.' },
    { h: 'Devolución de los bienes', p: 'Deberá devolver los bienes sin demora indebida y, a más tardar, en el plazo de catorce días a partir de la fecha en que nos comunique su decisión. Asumirá el coste directo de la devolución. Solo será responsable de la disminución de valor resultante de una manipulación distinta a la necesaria para establecer la naturaleza, características y funcionamiento de los bienes.' },
  ],
  nl: [
    { h: 'Herroepingsrecht', p: 'U heeft het recht om binnen veertien dagen zonder opgave van redenen de overeenkomst te herroepen. De termijn verstrijkt veertien dagen na de dag waarop u, of een door u aangewezen derde die niet de vervoerder is, het goed fysiek in bezit krijgt.' },
    { h: 'Uitoefening van het recht', p: `Om het herroepingsrecht uit te oefenen, moet u ons (${ADDR}) via een ondubbelzinnige verklaring (brief of e-mail) op de hoogte stellen van uw beslissing. U kunt hiervoor het onderstaande modelformulier gebruiken, maar bent hiertoe niet verplicht. Verzending vóór het verstrijken van de termijn volstaat.` },
    { h: 'Gevolgen van herroeping', p: 'Wij betalen alle van u ontvangen betalingen terug, inclusief standaard leveringskosten, onverwijld en uiterlijk veertien dagen nadat wij op de hoogte zijn gesteld van uw beslissing. Wij mogen wachten met terugbetaling tot wij de goederen hebben teruggekregen of u bewijs van terugzending heeft geleverd.' },
    { h: 'Terugzending', p: 'U dient de goederen onverwijld, doch uiterlijk binnen veertien dagen na de dag van uw mededeling, aan ons terug te zenden. De directe kosten van terugzending komen voor uw rekening. U bent alleen aansprakelijk voor waardevermindering die het gevolg is van gebruik dat verder gaat dan nodig om de aard, kenmerken en werking van de goederen vast te stellen.' },
  ],
  ar: [
    { h: 'حق التراجع', p: 'لديك الحق في التراجع عن هذا العقد خلال أربعة عشر يوماً دون إبداء أي سبب. تنتهي المهلة بعد أربعة عشر يوماً من اليوم الذي تستلم فيه أنت أو طرف ثالث تعيّنه (غير الناقل) البضاعة فعلياً.' },
    { h: 'ممارسة الحق', p: `لممارسة حق التراجع، يجب إبلاغنا (${ADDR}) بقرارك عبر تصريح واضح (رسالة بريدية أو بريد إلكتروني). يمكنك استخدام النموذج أدناه دون إلزام. يكفي إرسال الإشعار قبل انتهاء المهلة.` },
    { h: 'آثار التراجع', p: 'نعيد إليك جميع المدفوعات المستلمة، بما فيها تكاليف التوصيل القياسية، دون تأخير وفي أجل أقصاه أربعة عشر يوماً من إبلاغنا بقرارك. يجوز لنا تأجيل الاسترداد حتى استلام البضاعة أو تقديم دليل إرسالها.' },
    { h: 'إعادة المنتج', p: 'يجب إعادة البضاعة دون تأخير وفي أجل أقصاه أربعة عشر يوماً من تاريخ إبلاغنا. تتحمل التكاليف المباشرة للإعادة. لا تتحمل مسؤولية انخفاض القيمة إلا إذا نتج عن استخدام يتجاوز ما يلزم للتحقق من طبيعة المنتج وخصائصه وعمله.' },
  ],
}
const sections = computed(() => allSections[locale.value] || allSections.fr)

const allForms: Record<string, { title: string; hint: string; body: string }> = {
  de: {
    title: 'Muster-Widerrufsformular',
    hint: 'Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie es zurück.',
    body: `An: ${ADDR}\n\nHiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*):\n— Bestellt am (*) / erhalten am (*):\n— Name des/der Verbraucher(s):\n— Anschrift des/der Verbraucher(s):\n— Unterschrift (nur bei Mitteilung auf Papier):\n— Datum:\n\n(*) Unzutreffendes streichen.`,
  },
  fr: {
    title: 'Modèle de formulaire de rétractation',
    hint: 'Complétez et renvoyez ce formulaire uniquement si vous souhaitez vous rétracter du contrat.',
    body: `À l'attention de : ${ADDR}\n\nJe/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien ci-dessous :\n— Commandé le (*) / reçu le (*) :\n— Nom du (des) consommateur(s) :\n— Adresse du (des) consommateur(s) :\n— Signature (uniquement en cas de notification sur papier) :\n— Date :\n\n(*) Rayez la mention inutile.`,
  },
  en: {
    title: 'Model withdrawal form',
    hint: 'Complete and return this form only if you wish to withdraw from the contract.',
    body: `To: ${ADDR}\n\nI/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*):\n— Ordered on (*) / received on (*):\n— Name of consumer(s):\n— Address of consumer(s):\n— Signature (only if this form is notified on paper):\n— Date:\n\n(*) Delete as appropriate.`,
  },
  es: {
    title: 'Modelo de formulario de desistimiento',
    hint: 'Cumplimente y envíe este formulario solo si desea desistir del contrato.',
    body: `A la atención de: ${ADDR}\n\nPor la presente le comunico/comunicamos (*) que desisto de mi/desistimos de nuestro (*) contrato de venta del siguiente bien (*):\n— Pedido el (*) / recibido el (*):\n— Nombre del consumidor(es):\n— Domicilio del consumidor(es):\n— Firma (solo si se presenta en papel):\n— Fecha:\n\n(*) Táchese lo que no proceda.`,
  },
  nl: {
    title: 'Modelformulier voor herroeping',
    hint: 'Vul dit formulier alleen in en stuur het terug als u de overeenkomst wilt herroepen.',
    body: `Aan: ${ADDR}\n\nIk/Wij (*) deel/delen (*) u hierbij mede dat ik/wij (*) onze overeenkomst betreffende de verkoop van de volgende goederen herroep/herroepen (*):\n— Besteld op (*) / ontvangen op (*):\n— Naam consument(en):\n— Adres consument(en):\n— Handtekening (alleen bij melding op papier):\n— Datum:\n\n(*) Doorhalen wat niet van toepassing is.`,
  },
  ar: {
    title: 'نموذج التراجع',
    hint: 'املأ هذا النموذج وأرسله فقط إذا كنت ترغب في التراجع عن العقد.',
    body: `إلى: ${ADDR}\n\nأُخطركم بموجب هذا بتراجعي عن عقد بيع المنتج التالي:\n— تاريخ الطلب / تاريخ الاستلام:\n— اسم المستهلك:\n— عنوان المستهلك:\n— التوقيع (فقط عند الإرسال ورقياً):\n— التاريخ:`,
  },
}
const form = computed(() => allForms[locale.value] || allForms.fr)
</script>
