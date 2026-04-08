/**
 * fill-legal.mjs — Fill all 3 legal pages in Sanity with complete professional content in 6 languages
 * Usage: node scripts/fill-legal.mjs
 */
import { createClient } from '@sanity/client'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function getSanityToken() {
  if (process.env.SANITY_TOKEN) return process.env.SANITY_TOKEN
  const paths = [
    join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'sanity', 'config.json'),
    join(process.env.APPDATA || '', 'sanity', 'config.json'),
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')).authToken
    }
  }
  throw new Error('No token')
}

const client = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  token: getSanityToken(),
  apiVersion: '2024-01-01',
  useCdn: false,
})

// ============================================================================
// MENTIONS LÉGALES (Legal Notice)
// ============================================================================
const mentionsLegales = {
  _type: 'localizedText',

  fr: `MENTIONS LÉGALES

Dernière mise à jour : 07/04/2026

1. ÉDITEUR DU SITE

Le site www.vitesse-eco.com est édité par :
VITESSE ECO — SAS (Société par Actions Simplifiée)
SIREN : 100 732 247
SIRET : 100 732 247 00018
Code APE : 46.90Z (Commerce de gros non spécialisé)
Siège social : 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France
Date d'immatriculation : 03/02/2026
E-mail : contact@vitesse-eco.fr
Site internet : www.vitesse-eco.com

Directeur de la publication : Le représentant légal de la société VITESSE ECO SAS.

2. HÉBERGEMENT

Le site est hébergé par :
Vercel Inc.
440 N Barranca Ave #4133
Covina, CA 91723, États-Unis
Site web : https://vercel.com

3. PROPRIÉTÉ INTELLECTUELLE

L'ensemble des éléments constituant le site www.vitesse-eco.com (textes, images, graphismes, logo, icônes, sons, logiciels, etc.) est la propriété exclusive de VITESSE ECO SAS ou de ses partenaires. Toute reproduction, représentation, modification, publication, adaptation, totale ou partielle, de ces éléments, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite préalable de VITESSE ECO SAS.

Toute exploitation non autorisée du site ou de l'un quelconque de ses éléments sera considérée comme constitutive d'une contrefaçon et poursuivie conformément aux dispositions des articles L.335-2 et suivants du Code de la Propriété Intellectuelle.

Le logo VITESSE ECO, représentant une tête de cerf dorée intégrée dans un engrenage, est une marque déposée. Toute utilisation sans autorisation est strictement interdite.

4. PROTECTION DES DONNÉES PERSONNELLES

Conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la loi française « Informatique et Libertés » du 6 janvier 1978 modifiée, VITESSE ECO SAS s'engage à protéger les données personnelles des utilisateurs de son site.

Les données collectées sont nécessaires au traitement des commandes, à la gestion de la relation client et à l'amélioration de nos services. Elles ne sont en aucun cas cédées à des tiers à des fins commerciales.

Conformément à la réglementation en vigueur, vous disposez des droits suivants :
• Droit d'accès à vos données personnelles
• Droit de rectification de vos données
• Droit à l'effacement (droit à l'oubli)
• Droit à la portabilité de vos données
• Droit d'opposition au traitement
• Droit à la limitation du traitement

Pour exercer ces droits, contactez-nous à : contact@vitesse-eco.fr
Vous pouvez également adresser une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) : www.cnil.fr

Pour plus de détails, consultez notre Politique de Confidentialité.

5. COOKIES

Le site www.vitesse-eco.com utilise des cookies strictement nécessaires au bon fonctionnement du site :
• Cookies techniques : maintien de la session utilisateur, panier d'achat
• Cookies de préférence linguistique : mémorisation de la langue choisie

Aucun cookie publicitaire ou de traçage tiers n'est utilisé sur notre site. Ces cookies ne collectent aucune donnée personnelle à des fins de profilage ou de marketing.

Vous pouvez configurer votre navigateur pour refuser les cookies, mais certaines fonctionnalités du site pourraient être altérées.

6. LIMITATION DE RESPONSABILITÉ

VITESSE ECO SAS s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur son site. Toutefois, elle ne peut garantir l'exactitude, la précision ou l'exhaustivité des informations mises à disposition. En conséquence, VITESSE ECO SAS décline toute responsabilité pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur le site.

Le site peut contenir des liens hypertextes vers d'autres sites. VITESSE ECO SAS n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.

7. DROIT APPLICABLE

Les présentes mentions légales sont régies par le droit français. En cas de litige, et après tentative de résolution amiable, compétence est attribuée aux tribunaux compétents de Poitiers, France.`,

  en: `LEGAL NOTICE

Last updated: 07/04/2026

1. SITE PUBLISHER

The website www.vitesse-eco.com is published by:
VITESSE ECO — SAS (Simplified Joint-Stock Company)
SIREN: 100 732 247
SIRET: 100 732 247 00018
APE Code: 46.90Z (Non-specialised wholesale trade)
Registered office: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France
Registration date: 03/02/2026
Email: contact@vitesse-eco.fr
Website: www.vitesse-eco.com

Publication director: The legal representative of VITESSE ECO SAS.

2. HOSTING

The site is hosted by:
Vercel Inc.
440 N Barranca Ave #4133, Covina, CA 91723, USA
Website: https://vercel.com

3. INTELLECTUAL PROPERTY

All elements of the website www.vitesse-eco.com (texts, images, graphics, logo, icons, sounds, software, etc.) are the exclusive property of VITESSE ECO SAS or its partners. Any reproduction, representation, modification, publication or adaptation, in whole or in part, by any means or process, is prohibited without the prior written consent of VITESSE ECO SAS.

The VITESSE ECO logo, depicting a golden deer head integrated into a gear, is a registered trademark. Any unauthorised use is strictly prohibited.

4. DATA PROTECTION

In accordance with the General Data Protection Regulation (GDPR — EU Regulation 2016/679), VITESSE ECO SAS is committed to protecting users' personal data.

You have the right to access, rectify, delete, port and object to the processing of your personal data. To exercise these rights, contact us at: contact@vitesse-eco.fr

For further details, please refer to our Privacy Policy.

5. COOKIES

The site uses strictly necessary cookies only:
• Technical cookies: session management, shopping cart
• Language preference cookies: remembering your chosen language

No advertising or third-party tracking cookies are used. You may configure your browser to refuse cookies, though some site features may be affected.

6. APPLICABLE LAW

These legal notices are governed by French law. In case of dispute, jurisdiction is attributed to the competent courts of Poitiers, France.`,

  es: `AVISO LEGAL

Última actualización: 07/04/2026

1. EDITOR DEL SITIO

El sitio web www.vitesse-eco.com es editado por:
VITESSE ECO — SAS (Sociedad por Acciones Simplificada)
SIREN: 100 732 247
SIRET: 100 732 247 00018
Código APE: 46.90Z
Sede social: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Francia
Fecha de registro: 03/02/2026
Correo electrónico: contact@vitesse-eco.fr
Sitio web: www.vitesse-eco.com

Director de publicación: El representante legal de VITESSE ECO SAS.

2. ALOJAMIENTO

El sitio está alojado por:
Vercel Inc.
440 N Barranca Ave #4133, Covina, CA 91723, EE.UU.
Sitio web: https://vercel.com

3. PROPIEDAD INTELECTUAL

Todos los elementos del sitio web (textos, imágenes, gráficos, logotipo, iconos, software, etc.) son propiedad exclusiva de VITESSE ECO SAS o de sus socios. Queda prohibida cualquier reproducción, representación, modificación o adaptación sin la autorización previa por escrito de VITESSE ECO SAS.

El logotipo VITESSE ECO, que representa una cabeza de ciervo dorada integrada en un engranaje, es una marca registrada.

4. PROTECCIÓN DE DATOS

De conformidad con el Reglamento General de Protección de Datos (RGPD — Reglamento UE 2016/679), VITESSE ECO SAS se compromete a proteger los datos personales de los usuarios.

Usted tiene derecho a acceder, rectificar, suprimir, portar y oponerse al tratamiento de sus datos personales. Para ejercer estos derechos, contáctenos en: contact@vitesse-eco.fr

Para más detalles, consulte nuestra Política de Privacidad.

5. COOKIES

El sitio utiliza únicamente cookies estrictamente necesarias:
• Cookies técnicas: gestión de sesión, carrito de compras
• Cookies de preferencia de idioma

No se utilizan cookies publicitarias ni de seguimiento de terceros.

6. LEGISLACIÓN APLICABLE

El presente aviso legal se rige por la legislación francesa. En caso de litigio, la competencia se atribuye a los tribunales de Poitiers, Francia.`,

  nl: `JURIDISCHE KENNISGEVING

Laatst bijgewerkt: 07/04/2026

1. UITGEVER VAN DE SITE

De website www.vitesse-eco.com wordt uitgegeven door:
VITESSE ECO — SAS (Vereenvoudigde Naamloze Vennootschap)
SIREN: 100 732 247
SIRET: 100 732 247 00018
APE-code: 46.90Z
Maatschappelijke zetel: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankrijk
Registratiedatum: 03/02/2026
E-mail: contact@vitesse-eco.fr
Website: www.vitesse-eco.com

Directeur publicatie: De wettelijke vertegenwoordiger van VITESSE ECO SAS.

2. HOSTING

De site wordt gehost door:
Vercel Inc.
440 N Barranca Ave #4133, Covina, CA 91723, VS
Website: https://vercel.com

3. INTELLECTUEEL EIGENDOM

Alle elementen van de website (teksten, afbeeldingen, logo, pictogrammen, software, enz.) zijn het exclusieve eigendom van VITESSE ECO SAS of haar partners. Elke reproductie, weergave, wijziging of aanpassing zonder voorafgaande schriftelijke toestemming is verboden.

Het VITESSE ECO-logo, dat een gouden hertenkop geïntegreerd in een tandwiel afbeeldt, is een gedeponeerd handelsmerk.

4. GEGEVENSBESCHERMING

In overeenstemming met de Algemene Verordening Gegevensbescherming (AVG — EU-verordening 2016/679) verbindt VITESSE ECO SAS zich ertoe de persoonsgegevens van gebruikers te beschermen.

U heeft het recht op inzage, rectificatie, verwijdering, overdraagbaarheid en bezwaar tegen de verwerking van uw persoonsgegevens. Neem contact met ons op via: contact@vitesse-eco.fr

Raadpleeg ons Privacybeleid voor meer informatie.

5. COOKIES

De site gebruikt uitsluitend strikt noodzakelijke cookies:
• Technische cookies: sessiebeheer, winkelwagen
• Taalvoorkeurcookies

Er worden geen advertentie- of trackingcookies van derden gebruikt.

6. TOEPASSELIJK RECHT

Deze juridische kennisgeving wordt beheerst door Frans recht. Bij geschillen zijn de bevoegde rechtbanken van Poitiers, Frankrijk, bevoegd.`,

  de: `IMPRESSUM / RECHTLICHE HINWEISE

Letzte Aktualisierung: 07.04.2026

1. HERAUSGEBER DER WEBSITE

Die Website www.vitesse-eco.com wird herausgegeben von:
VITESSE ECO — SAS (Vereinfachte Aktiengesellschaft)
SIREN: 100 732 247
SIRET: 100 732 247 00018
APE-Code: 46.90Z
Sitz: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich
Registrierungsdatum: 03.02.2026
E-Mail: contact@vitesse-eco.fr
Website: www.vitesse-eco.com

Verantwortlich für den Inhalt: Der gesetzliche Vertreter der VITESSE ECO SAS.

2. HOSTING

Die Website wird gehostet von:
Vercel Inc.
440 N Barranca Ave #4133, Covina, CA 91723, USA
Website: https://vercel.com

3. GEISTIGES EIGENTUM

Alle Elemente der Website (Texte, Bilder, Grafiken, Logo, Icons, Software usw.) sind das ausschließliche Eigentum von VITESSE ECO SAS oder ihrer Partner. Jede Vervielfältigung, Darstellung, Änderung oder Anpassung ohne vorherige schriftliche Genehmigung ist untersagt.

Das VITESSE ECO-Logo, das einen goldenen Hirschkopf in einem Zahnrad darstellt, ist eine eingetragene Marke.

4. DATENSCHUTZ

Gemäß der Datenschutz-Grundverordnung (DSGVO — EU-Verordnung 2016/679) verpflichtet sich VITESSE ECO SAS zum Schutz der persönlichen Daten der Nutzer.

Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Datenübertragbarkeit und Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten. Kontaktieren Sie uns unter: contact@vitesse-eco.fr

Weitere Informationen finden Sie in unserer Datenschutzerklärung.

5. COOKIES

Die Website verwendet ausschließlich technisch notwendige Cookies:
• Technische Cookies: Sitzungsverwaltung, Warenkorb
• Sprachpräferenz-Cookies

Es werden keine Werbe- oder Tracking-Cookies von Drittanbietern verwendet.

6. ANWENDBARES RECHT

Dieses Impressum unterliegt französischem Recht. Bei Streitigkeiten sind die zuständigen Gerichte von Poitiers, Frankreich, zuständig.`,

  ar: `إشعار قانوني

آخر تحديث: 07/04/2026

1. ناشر الموقع

الموقع www.vitesse-eco.com منشور من قبل:
VITESSE ECO — SAS (شركة مساهمة مبسطة)
SIREN: 100 732 247
SIRET: 100 732 247 00018
رمز APE: 46.90Z
المقر الرئيسي: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, فرنسا
تاريخ التسجيل: 03/02/2026
البريد الإلكتروني: contact@vitesse-eco.fr
الموقع: www.vitesse-eco.com

مدير النشر: الممثل القانوني لشركة VITESSE ECO SAS.

2. الاستضافة

يُستضاف الموقع من قبل:
Vercel Inc.
440 N Barranca Ave #4133, Covina, CA 91723, الولايات المتحدة
https://vercel.com

3. الملكية الفكرية

جميع عناصر الموقع (نصوص، صور، رسومات، شعار، أيقونات، برمجيات، إلخ) هي ملكية حصرية لشركة VITESSE ECO SAS أو شركائها. يُمنع أي نسخ أو تمثيل أو تعديل أو تكييف بدون إذن كتابي مسبق.

شعار VITESSE ECO الذي يصور رأس غزال ذهبي مدمج في ترس هو علامة تجارية مسجلة.

4. حماية البيانات

وفقاً للائحة العامة لحماية البيانات (GDPR — لائحة الاتحاد الأوروبي 2016/679)، تلتزم VITESSE ECO SAS بحماية البيانات الشخصية للمستخدمين.

لديك الحق في الوصول إلى بياناتك وتصحيحها وحذفها ونقلها والاعتراض على معالجتها. تواصل معنا عبر: contact@vitesse-eco.fr

لمزيد من التفاصيل، راجع سياسة الخصوصية الخاصة بنا.

5. ملفات تعريف الارتباط (الكوكيز)

يستخدم الموقع فقط ملفات تعريف الارتباط الضرورية:
• ملفات تقنية: إدارة الجلسة، سلة التسوق
• ملفات تفضيل اللغة

لا يتم استخدام أي ملفات تعريف ارتباط إعلانية أو تتبع من جهات خارجية.

6. القانون المعمول به

يخضع هذا الإشعار القانوني للقانون الفرنسي. في حالة النزاع، تختص محاكم بواتييه، فرنسا.`,
}

// ============================================================================
// POLITIQUE DE CONFIDENTIALITÉ (Privacy Policy)
// ============================================================================
const politiqueConfidentialite = {
  _type: 'localizedText',

  fr: `POLITIQUE DE CONFIDENTIALITÉ

Dernière mise à jour : 07/04/2026

VITESSE ECO SAS (SIREN : 100 732 247), dont le siège social est situé au 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France, s'engage à protéger la vie privée des utilisateurs de son site www.vitesse-eco.com conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la loi française « Informatique et Libertés » du 6 janvier 1978 modifiée.

1. DONNÉES COLLECTÉES

Dans le cadre de votre utilisation du site et de vos commandes, nous collectons les données suivantes :
• Données d'identification : nom, prénom
• Données de contact : adresse e-mail, numéro de téléphone
• Données postales : adresse de livraison et de facturation
• Données de commande : historique des achats, produits commandés, montants
• Données de connexion : adresse IP, données de navigation (cookies techniques)
• Données de compte : mot de passe (hashé et non lisible)

Ces données sont collectées directement auprès de vous lors de la création de votre compte, de la passation d'une commande ou de l'utilisation du formulaire de contact.

2. FINALITÉS DU TRAITEMENT

Vos données personnelles sont utilisées pour les finalités suivantes :
• Traitement et suivi de vos commandes
• Gestion de votre compte client
• Livraison de vos produits
• Communication relative à vos commandes (confirmations, suivi, factures)
• Réponse à vos demandes via le formulaire de contact
• Amélioration de notre site et de nos services
• Respect de nos obligations légales et comptables

Base légale : exécution du contrat de vente, consentement, intérêt légitime et obligations légales.

3. STOCKAGE ET SÉCURITÉ DES DONNÉES

Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données :
• Mots de passe hashés avec l'algorithme bcrypt (irréversible)
• Communications sécurisées par protocole HTTPS (chiffrement SSL/TLS)
• Cookies de session httpOnly (non accessibles par JavaScript)
• Accès aux données restreint aux personnes autorisées
• Hébergement sécurisé chez Vercel Inc. (certifié SOC 2)

Les données sont conservées pendant la durée de la relation commerciale et pendant une durée de 3 ans après la dernière commande, sauf obligation légale de conservation plus longue (10 ans pour les données comptables).

4. PARTAGE DES DONNÉES

Vos données personnelles ne sont jamais vendues à des tiers. Elles peuvent être partagées uniquement avec :
• Stripe : pour le traitement sécurisé des paiements par carte bancaire (certifié PCI DSS niveau 1)
• Transporteurs : nom et adresse de livraison pour l'acheminement de vos colis
• Prestataires techniques : hébergement (Vercel), envoi d'e-mails transactionnels

Chacun de ces prestataires est tenu par des obligations contractuelles de confidentialité et de sécurité des données.

5. VOS DROITS (RGPD)

Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
• Droit d'accès (article 15) : obtenir une copie de vos données
• Droit de rectification (article 16) : corriger des données inexactes
• Droit à l'effacement (article 17) : demander la suppression de vos données
• Droit à la portabilité (article 20) : recevoir vos données dans un format structuré
• Droit d'opposition (article 21) : vous opposer au traitement de vos données
• Droit à la limitation (article 18) : restreindre le traitement de vos données

Délai de réponse : 30 jours maximum à compter de la réception de votre demande.

Pour exercer vos droits :
• Par e-mail : contact@vitesse-eco.fr
• Par courrier : VITESSE ECO SAS, 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France

En cas de désaccord, vous pouvez adresser une réclamation à la CNIL : www.cnil.fr

6. COOKIES

Notre site utilise uniquement des cookies strictement nécessaires :
• Cookies techniques : maintien de votre session, fonctionnement du panier d'achat
• Cookies de préférence linguistique : mémorisation de la langue d'affichage choisie

Aucun cookie publicitaire, analytique ou de traçage tiers n'est déposé. Ces cookies ne collectent aucune donnée personnelle à des fins de profilage ou de ciblage publicitaire.

Durée de conservation des cookies :
• Cookies de session : supprimés à la fermeture du navigateur
• Cookies de préférence : 12 mois maximum

Vous pouvez configurer votre navigateur pour bloquer les cookies. Cependant, certaines fonctionnalités du site (panier, connexion) pourraient ne plus fonctionner correctement.

7. SUPPRESSION DE COMPTE

Vous pouvez demander la suppression complète de votre compte et de toutes vos données personnelles associées à tout moment. Cette suppression est définitive et irréversible.

Pour demander la suppression :
• Depuis votre espace client (section « Mon compte »)
• Par e-mail à : contact@vitesse-eco.fr

La suppression sera effectuée dans un délai de 30 jours, sous réserve de nos obligations légales de conservation (données comptables et fiscales).

8. MODIFICATION DE LA POLITIQUE

VITESSE ECO SAS se réserve le droit de modifier la présente politique de confidentialité à tout moment. Toute modification sera publiée sur cette page avec la date de mise à jour. Nous vous encourageons à consulter régulièrement cette page.

9. CONTACT

Pour toute question relative à la protection de vos données personnelles :
VITESSE ECO SAS
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France
E-mail : contact@vitesse-eco.fr
Site : www.vitesse-eco.com`,

  en: `PRIVACY POLICY

Last updated: 07/04/2026

VITESSE ECO SAS (SIREN: 100 732 247), registered at 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France, is committed to protecting the privacy of users of its website www.vitesse-eco.com in accordance with the General Data Protection Regulation (GDPR — EU Regulation 2016/679).

1. DATA COLLECTED

We collect the following data in connection with your use of the site and orders:
• Identification data: first name, last name
• Contact data: email address, phone number
• Postal data: delivery and billing address
• Order data: purchase history, products ordered, amounts
• Connection data: IP address, browsing data (technical cookies)
• Account data: password (hashed and unreadable)

2. PURPOSE OF DATA USE

Your personal data is used for the following purposes:
• Processing and tracking your orders
• Managing your customer account
• Delivering your products
• Order-related communications (confirmations, tracking, invoices)
• Responding to your enquiries
• Improving our website and services
• Complying with legal and accounting obligations

3. STORAGE AND SECURITY

We implement technical and organisational security measures to protect your data:
• Passwords hashed with bcrypt algorithm (irreversible)
• Secure communications via HTTPS protocol (SSL/TLS encryption)
• httpOnly session cookies (not accessible by JavaScript)
• Data access restricted to authorised personnel
• Secure hosting by Vercel Inc. (SOC 2 certified)

Data is retained for the duration of the business relationship and for 3 years after the last order, unless a longer legal retention period applies.

4. DATA SHARING

Your personal data is never sold to third parties. It may only be shared with:
• Stripe: for secure card payment processing (PCI DSS Level 1 certified)
• Carriers: name and delivery address for parcel delivery
• Technical providers: hosting (Vercel), transactional email

Each provider is bound by contractual confidentiality and data security obligations.

5. YOUR RIGHTS (GDPR)

Under the GDPR, you have the following rights:
• Right of access (Article 15): obtain a copy of your data
• Right to rectification (Article 16): correct inaccurate data
• Right to erasure (Article 17): request deletion of your data
• Right to portability (Article 20): receive your data in a structured format
• Right to object (Article 21): object to the processing of your data
• Right to restriction (Article 18): restrict the processing of your data

Response time: maximum 30 days from receipt of your request.
Contact: contact@vitesse-eco.fr

You may also lodge a complaint with the French data protection authority (CNIL): www.cnil.fr

6. COOKIES

Our site uses only strictly necessary cookies:
• Technical cookies: session management, shopping cart
• Language preference cookies: remembering your display language

No advertising, analytics or third-party tracking cookies are used. Session cookies are deleted when the browser is closed. Preference cookies are retained for a maximum of 12 months.

7. ACCOUNT DELETION

You may request the complete deletion of your account and all associated personal data at any time. This deletion is permanent and irreversible.
• From your account settings ("My Account" section)
• By email to: contact@vitesse-eco.fr

Deletion will be carried out within 30 days, subject to legal retention obligations.

8. CONTACT

VITESSE ECO SAS
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France
Email: contact@vitesse-eco.fr
Website: www.vitesse-eco.com`,

  es: `POLÍTICA DE PRIVACIDAD

Última actualización: 07/04/2026

VITESSE ECO SAS (SIREN: 100 732 247), con sede en 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Francia, se compromete a proteger la privacidad de los usuarios de su sitio web www.vitesse-eco.com de conformidad con el Reglamento General de Protección de Datos (RGPD — Reglamento UE 2016/679).

1. DATOS RECOPILADOS

Recopilamos los siguientes datos:
• Datos de identificación: nombre, apellidos
• Datos de contacto: correo electrónico, número de teléfono
• Datos postales: dirección de entrega y facturación
• Datos de pedido: historial de compras, productos, importes
• Datos de conexión: dirección IP, datos de navegación (cookies técnicas)
• Datos de cuenta: contraseña (cifrada e ilegible)

2. FINALIDAD DEL TRATAMIENTO

Sus datos se utilizan para:
• Procesar y dar seguimiento a sus pedidos
• Gestionar su cuenta de cliente
• Entregar sus productos
• Comunicaciones relativas a sus pedidos
• Responder a sus consultas
• Mejorar nuestro sitio y servicios
• Cumplir con obligaciones legales y contables

3. ALMACENAMIENTO Y SEGURIDAD

Implementamos medidas de seguridad técnicas y organizativas:
• Contraseñas cifradas con algoritmo bcrypt (irreversible)
• Comunicaciones seguras mediante protocolo HTTPS (cifrado SSL/TLS)
• Cookies de sesión httpOnly
• Acceso a datos restringido al personal autorizado
• Alojamiento seguro en Vercel Inc. (certificado SOC 2)

Los datos se conservan durante la relación comercial y 3 años después del último pedido.

4. COMPARTICIÓN DE DATOS

Sus datos nunca se venden a terceros. Solo se comparten con:
• Stripe: procesamiento seguro de pagos con tarjeta (certificado PCI DSS Nivel 1)
• Transportistas: nombre y dirección de entrega
• Proveedores técnicos: alojamiento (Vercel), correo electrónico transaccional

5. SUS DERECHOS (RGPD)

Conforme al RGPD, usted tiene derecho a:
• Acceso a sus datos (Artículo 15)
• Rectificación de datos inexactos (Artículo 16)
• Supresión de sus datos (Artículo 17)
• Portabilidad de sus datos (Artículo 20)
• Oposición al tratamiento (Artículo 21)
• Limitación del tratamiento (Artículo 18)

Plazo de respuesta: máximo 30 días.
Contacto: contact@vitesse-eco.fr

6. COOKIES

Nuestro sitio utiliza únicamente cookies estrictamente necesarias:
• Cookies técnicas: gestión de sesión, carrito de compras
• Cookies de preferencia de idioma

No se utilizan cookies publicitarias ni de seguimiento de terceros.

7. ELIMINACIÓN DE CUENTA

Puede solicitar la eliminación completa de su cuenta en cualquier momento contactando a: contact@vitesse-eco.fr

La eliminación se realizará en un plazo de 30 días.

8. CONTACTO

VITESSE ECO SAS
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Francia
Correo: contact@vitesse-eco.fr`,

  nl: `PRIVACYBELEID

Laatst bijgewerkt: 07/04/2026

VITESSE ECO SAS (SIREN: 100 732 247), gevestigd te 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankrijk, verbindt zich ertoe de privacy van gebruikers van haar website www.vitesse-eco.com te beschermen in overeenstemming met de Algemene Verordening Gegevensbescherming (AVG — EU-verordening 2016/679).

1. VERZAMELDE GEGEVENS

Wij verzamelen de volgende gegevens:
• Identificatiegegevens: voornaam, achternaam
• Contactgegevens: e-mailadres, telefoonnummer
• Postgegevens: lever- en factuuradres
• Bestelgegevens: aankoopgeschiedenis, bestelde producten, bedragen
• Verbindingsgegevens: IP-adres, navigatiegegevens (technische cookies)
• Accountgegevens: wachtwoord (gehasht en onleesbaar)

2. DOEL VAN GEGEVENSVERWERKING

Uw gegevens worden gebruikt voor:
• Verwerken en opvolgen van uw bestellingen
• Beheer van uw klantenaccount
• Levering van uw producten
• Communicatie over uw bestellingen
• Beantwoorden van uw vragen
• Verbeteren van onze website en diensten
• Naleving van wettelijke verplichtingen

3. OPSLAG EN BEVEILIGING

Wij implementeren technische en organisatorische beveiligingsmaatregelen:
• Wachtwoorden gehasht met bcrypt-algoritme (onomkeerbaar)
• Beveiligde communicatie via HTTPS-protocol (SSL/TLS-versleuteling)
• httpOnly sessiecookies
• Gegevenstoegang beperkt tot geautoriseerd personeel
• Veilige hosting bij Vercel Inc. (SOC 2-gecertificeerd)

Gegevens worden bewaard gedurende de zakelijke relatie en 3 jaar na de laatste bestelling.

4. DELEN VAN GEGEVENS

Uw gegevens worden nooit verkocht aan derden. Ze worden alleen gedeeld met:
• Stripe: veilige kaartbetalingsverwerking (PCI DSS Level 1)
• Vervoerders: naam en leveradres
• Technische dienstverleners: hosting (Vercel), transactionele e-mail

5. UW RECHTEN (AVG)

Onder de AVG heeft u de volgende rechten:
• Recht op inzage (Artikel 15)
• Recht op rectificatie (Artikel 16)
• Recht op verwijdering (Artikel 17)
• Recht op overdraagbaarheid (Artikel 20)
• Recht op bezwaar (Artikel 21)
• Recht op beperking (Artikel 18)

Reactietermijn: maximaal 30 dagen.
Contact: contact@vitesse-eco.fr

6. COOKIES

Onze site gebruikt uitsluitend strikt noodzakelijke cookies:
• Technische cookies: sessiebeheer, winkelwagen
• Taalvoorkeurcookies

Geen advertentie- of trackingcookies van derden.

7. ACCOUNTVERWIJDERING

U kunt op elk moment de volledige verwijdering van uw account aanvragen via: contact@vitesse-eco.fr

Verwijdering vindt plaats binnen 30 dagen.

8. CONTACT

VITESSE ECO SAS
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankrijk
E-mail: contact@vitesse-eco.fr`,

  de: `DATENSCHUTZERKLÄRUNG

Letzte Aktualisierung: 07.04.2026

VITESSE ECO SAS (SIREN: 100 732 247), mit Sitz in 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich, verpflichtet sich zum Schutz der Privatsphäre der Nutzer ihrer Website www.vitesse-eco.com gemäß der Datenschutz-Grundverordnung (DSGVO — EU-Verordnung 2016/679).

1. ERHOBENE DATEN

Wir erheben folgende Daten:
• Identifikationsdaten: Vorname, Nachname
• Kontaktdaten: E-Mail-Adresse, Telefonnummer
• Postdaten: Liefer- und Rechnungsadresse
• Bestelldaten: Kaufhistorie, bestellte Produkte, Beträge
• Verbindungsdaten: IP-Adresse, Navigationsdaten (technische Cookies)
• Kontodaten: Passwort (gehasht und nicht lesbar)

2. ZWECK DER DATENVERARBEITUNG

Ihre Daten werden verwendet für:
• Bearbeitung und Verfolgung Ihrer Bestellungen
• Verwaltung Ihres Kundenkontos
• Lieferung Ihrer Produkte
• Bestellbezogene Kommunikation
• Beantwortung Ihrer Anfragen
• Verbesserung unserer Website und Dienstleistungen
• Erfüllung gesetzlicher Pflichten

3. SPEICHERUNG UND SICHERHEIT

Wir setzen technische und organisatorische Sicherheitsmaßnahmen um:
• Passwörter mit bcrypt-Algorithmus gehasht (irreversibel)
• Sichere Kommunikation über HTTPS-Protokoll (SSL/TLS-Verschlüsselung)
• httpOnly-Sitzungscookies
• Datenzugriff auf autorisiertes Personal beschränkt
• Sicheres Hosting bei Vercel Inc. (SOC 2-zertifiziert)

Daten werden während der Geschäftsbeziehung und 3 Jahre nach der letzten Bestellung aufbewahrt.

4. DATENWEITERGABE

Ihre Daten werden niemals an Dritte verkauft. Sie werden nur geteilt mit:
• Stripe: sichere Kartenzahlungsabwicklung (PCI DSS Level 1)
• Spediteure: Name und Lieferadresse
• Technische Dienstleister: Hosting (Vercel), transaktionale E-Mails

5. IHRE RECHTE (DSGVO)

Gemäß der DSGVO haben Sie folgende Rechte:
• Recht auf Auskunft (Artikel 15)
• Recht auf Berichtigung (Artikel 16)
• Recht auf Löschung (Artikel 17)
• Recht auf Datenübertragbarkeit (Artikel 20)
• Recht auf Widerspruch (Artikel 21)
• Recht auf Einschränkung (Artikel 18)

Antwortfrist: maximal 30 Tage.
Kontakt: contact@vitesse-eco.fr

6. COOKIES

Unsere Website verwendet ausschließlich technisch notwendige Cookies:
• Technische Cookies: Sitzungsverwaltung, Warenkorb
• Sprachpräferenz-Cookies

Keine Werbe- oder Tracking-Cookies von Drittanbietern.

7. KONTOLÖSCHUNG

Sie können jederzeit die vollständige Löschung Ihres Kontos beantragen unter: contact@vitesse-eco.fr

Die Löschung erfolgt innerhalb von 30 Tagen.

8. KONTAKT

VITESSE ECO SAS
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich
E-Mail: contact@vitesse-eco.fr`,

  ar: `سياسة الخصوصية

آخر تحديث: 07/04/2026

شركة VITESSE ECO SAS (رقم SIREN: 100 732 247)، المسجلة في 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, فرنسا، تلتزم بحماية خصوصية مستخدمي موقعها www.vitesse-eco.com وفقاً للائحة العامة لحماية البيانات (GDPR — لائحة الاتحاد الأوروبي 2016/679).

1. البيانات المجمعة

نقوم بجمع البيانات التالية:
• بيانات التعريف: الاسم الأول، اسم العائلة
• بيانات الاتصال: البريد الإلكتروني، رقم الهاتف
• البيانات البريدية: عنوان التوصيل والفواتير
• بيانات الطلبات: سجل المشتريات، المنتجات المطلوبة، المبالغ
• بيانات الاتصال: عنوان IP، بيانات التصفح (ملفات تعريف ارتباط تقنية)
• بيانات الحساب: كلمة المرور (مشفرة وغير قابلة للقراءة)

2. الغرض من استخدام البيانات

تُستخدم بياناتك من أجل:
• معالجة وتتبع طلباتك
• إدارة حساب العميل الخاص بك
• توصيل منتجاتك
• التواصل المتعلق بطلباتك
• الرد على استفساراتك
• تحسين موقعنا وخدماتنا
• الامتثال للالتزامات القانونية

3. التخزين والأمان

نطبق إجراءات أمنية تقنية وتنظيمية:
• كلمات المرور مشفرة بخوارزمية bcrypt (غير قابلة للعكس)
• اتصالات آمنة عبر بروتوكول HTTPS (تشفير SSL/TLS)
• ملفات تعريف ارتباط httpOnly
• الوصول إلى البيانات مقيد بالموظفين المصرح لهم
• استضافة آمنة لدى Vercel Inc. (معتمدة SOC 2)

يتم الاحتفاظ بالبيانات طوال مدة العلاقة التجارية و3 سنوات بعد آخر طلب.

4. مشاركة البيانات

لا يتم بيع بياناتك أبداً لأطراف ثالثة. تتم مشاركتها فقط مع:
• Stripe: معالجة آمنة لمدفوعات البطاقات (معتمد PCI DSS المستوى 1)
• شركات النقل: الاسم وعنوان التوصيل
• مقدمي الخدمات التقنية: الاستضافة (Vercel)، البريد الإلكتروني

5. حقوقك (GDPR)

بموجب GDPR، لديك الحقوق التالية:
• الحق في الوصول (المادة 15)
• الحق في التصحيح (المادة 16)
• الحق في الحذف (المادة 17)
• الحق في نقل البيانات (المادة 20)
• الحق في الاعتراض (المادة 21)
• الحق في تقييد المعالجة (المادة 18)

مهلة الرد: 30 يوماً كحد أقصى.
التواصل: contact@vitesse-eco.fr

6. ملفات تعريف الارتباط (الكوكيز)

يستخدم موقعنا فقط ملفات تعريف الارتباط الضرورية:
• ملفات تقنية: إدارة الجلسة، سلة التسوق
• ملفات تفضيل اللغة

لا يتم استخدام ملفات تعريف ارتباط إعلانية أو تتبع.

7. حذف الحساب

يمكنك طلب حذف حسابك بالكامل في أي وقت عبر: contact@vitesse-eco.fr

سيتم الحذف خلال 30 يوماً.

8. التواصل

VITESSE ECO SAS
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, فرنسا
البريد الإلكتروني: contact@vitesse-eco.fr`,
}

// ============================================================================
// CGV (Terms & Conditions)
// ============================================================================
const cgv = {
  _type: 'localizedText',

  fr: `CONDITIONS GÉNÉRALES DE VENTE

Dernière mise à jour : 07/04/2026

Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent l'ensemble des ventes conclues par la société VITESSE ECO SAS via son site internet www.vitesse-eco.com.

VITESSE ECO — SAS (Société par Actions Simplifiée)
SIREN : 100 732 247 | SIRET : 100 732 247 00018
Code APE : 46.90Z
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France
E-mail : contact@vitesse-eco.fr | Site : www.vitesse-eco.com

1. OBJET

Les présentes CGV définissent les droits et obligations des parties dans le cadre de la vente en ligne de vélos électriques fatbike et accessoires proposés par VITESSE ECO SAS. Toute commande passée sur le site implique l'acceptation sans réserve des présentes CGV.

2. PRIX

Tous les prix affichés sur le site sont indiqués en euros (EUR), toutes taxes comprises (TTC), incluant la TVA française applicable au jour de la commande. VITESSE ECO SAS se réserve le droit de modifier ses prix à tout moment, les produits étant facturés au prix en vigueur au moment de la validation de la commande.

Les frais de livraison, le cas échéant, sont indiqués avant la validation définitive de la commande et s'ajoutent au prix des produits.

3. COMMANDES ET CONFIRMATION

La passation d'une commande se fait en plusieurs étapes :
1. Sélection des produits et ajout au panier
2. Vérification du panier et des quantités
3. Renseignement des informations de livraison
4. Choix du mode de livraison
5. Choix du mode de paiement
6. Vérification récapitulative de la commande
7. Validation et paiement

Un e-mail de confirmation est envoyé automatiquement après validation du paiement. Cet e-mail récapitule les détails de la commande et constitue l'acceptation de la vente. VITESSE ECO SAS se réserve le droit de refuser ou d'annuler toute commande en cas de litige antérieur, de suspicion de fraude ou de non-paiement.

4. MODES DE PAIEMENT

VITESSE ECO SAS propose les modes de paiement suivants :
• Carte bancaire : Visa, Mastercard, American Express (via Stripe, certifié PCI DSS niveau 1)
• PayPal : paiement sécurisé via votre compte PayPal
• Paiement en magasin : lors du retrait de votre commande à Poitiers
• Virement bancaire : sur demande, les coordonnées bancaires seront communiquées par e-mail

Le paiement est exigible immédiatement à la commande (sauf virement bancaire, délai de 5 jours ouvrés). La commande n'est traitée qu'après réception effective du paiement.

5. LIVRAISON

5.1 Livraison standard en France métropolitaine
• Gratuite pour toutes les commandes
• Délai : 5 à 10 jours ouvrés selon la disponibilité
• Livraison à l'adresse indiquée par le client

5.2 Livraison express en France métropolitaine
• Frais de livraison indiqués au moment de la commande
• Délai : 2 à 4 jours ouvrés
• Avec suivi et assurance

5.3 Livraison internationale
• Disponible pour certains pays européens
• Frais de livraison calculés et affichés au moment du choix du pays de livraison
• Délai variable selon la destination (7 à 21 jours ouvrés)
• Les éventuels droits de douane et taxes locales sont à la charge du client

5.4 Réception
Le client s'engage à vérifier l'état du colis à la réception. En cas de dommage visible, le client doit émettre des réserves auprès du transporteur et nous contacter dans les 48 heures à contact@vitesse-eco.fr avec photos du colis et du produit.

6. RETRAIT EN MAGASIN (CLICK & COLLECT)

Le retrait en magasin est disponible à notre point de vente de Poitiers :
• Adresse : 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers
• Délai de mise à disposition : 1 à 2 jours ouvrés après confirmation de commande
• Paiement possible sur place (espèces, carte bancaire)
• Un e-mail de notification est envoyé lorsque votre commande est prête
• Pièce d'identité requise lors du retrait
• Délai de retrait : 14 jours après notification (passé ce délai, la commande pourra être annulée)

7. DROIT DE RÉTRACTATION

Conformément aux articles L.221-18 et suivants du Code de la consommation, le client dispose d'un délai de 14 jours calendaires à compter de la réception du produit pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.

Conditions de retour :
• Le produit doit être retourné dans son emballage d'origine, complet, non utilisé et en parfait état
• Les frais de retour sont à la charge du client
• Le produit doit être retourné dans les 14 jours suivant la notification de rétractation

Pour exercer votre droit de rétractation :
• Par e-mail : contact@vitesse-eco.fr en indiquant votre numéro de commande
• Par courrier : VITESSE ECO SAS, 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers

Remboursement :
Le remboursement sera effectué dans un délai maximum de 14 jours à compter de la réception du produit retourné, par le même moyen de paiement utilisé lors de la commande. Le remboursement peut être différé jusqu'à réception du produit ou preuve d'expédition.

Exclusions du droit de rétractation :
• Produits personnalisés ou fabriqués sur mesure
• Produits descellés ne pouvant être renvoyés pour des raisons d'hygiène ou de sécurité

8. GARANTIES

8.1 Garantie légale de conformité
Conformément aux articles L.217-4 et suivants du Code de la consommation, VITESSE ECO SAS est tenue de livrer un bien conforme au contrat. Le client bénéficie d'un délai de 2 ans à compter de la délivrance du bien pour agir en garantie de conformité.

En cas de défaut de conformité constaté dans les 24 mois suivant la délivrance, le défaut est présumé exister au moment de la délivrance, sauf preuve contraire. Le client peut choisir entre la réparation ou le remplacement du bien, sous réserve de conditions de coût.

8.2 Garantie des vices cachés
Conformément aux articles 1641 et suivants du Code civil, le client peut exercer la garantie des vices cachés dans un délai de 2 ans à compter de la découverte du vice. Le client peut choisir entre la résolution de la vente ou une réduction du prix.

8.3 Procédure de garantie
Pour toute demande de garantie, contactez-nous à contact@vitesse-eco.fr avec :
• Votre numéro de commande
• Une description détaillée du problème
• Des photos du défaut constaté
• La facture d'achat

9. RESPONSABILITÉ

VITESSE ECO SAS ne saurait être tenue responsable :
• Des dommages résultant d'une mauvaise utilisation du produit
• De l'usure normale du produit
• Des modifications ou réparations effectuées par un tiers non agréé
• Des dommages indirects (perte de jouissance, préjudice commercial, etc.)
• De la non-disponibilité temporaire du site pour maintenance ou mise à jour
• Des cas de force majeure tels que définis par l'article 1218 du Code civil

La responsabilité de VITESSE ECO SAS est limitée au montant de la commande concernée.

10. DONNÉES PERSONNELLES

VITESSE ECO SAS collecte et traite les données personnelles des clients conformément au RGPD et à la loi « Informatique et Libertés ». Pour toute information relative au traitement de vos données personnelles, consultez notre Politique de Confidentialité accessible sur notre site.

11. LITIGES ET MÉDIATION

Les présentes CGV sont soumises au droit français.

En cas de litige, le client est invité à contacter en premier lieu le service client de VITESSE ECO SAS à contact@vitesse-eco.fr pour tenter de résoudre le différend à l'amiable.

Conformément aux articles L.612-1 et suivants du Code de la consommation, le client peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige. Le client peut se rendre sur la plateforme de règlement en ligne des litiges de la Commission européenne : https://ec.europa.eu/consumers/odr/

À défaut de résolution amiable, tout litige sera soumis aux tribunaux compétents de Poitiers, France, conformément aux règles de compétence en vigueur.

12. MODIFICATION DES CGV

VITESSE ECO SAS se réserve le droit de modifier les présentes CGV à tout moment. Les CGV applicables sont celles en vigueur à la date de la commande.`,

  en: `TERMS AND CONDITIONS OF SALE

Last updated: 07/04/2026

These Terms and Conditions of Sale (hereinafter "T&Cs") govern all sales made by VITESSE ECO SAS through its website www.vitesse-eco.com.

VITESSE ECO — SAS
SIREN: 100 732 247 | SIRET: 100 732 247 00018
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, France
Email: contact@vitesse-eco.fr | Website: www.vitesse-eco.com

1. PURPOSE

These T&Cs define the rights and obligations of the parties in the context of online sales of electric fatbikes and accessories offered by VITESSE ECO SAS. Any order placed on the site implies unreserved acceptance of these T&Cs.

2. PRICES

All prices displayed on the site are in euros (EUR), inclusive of all taxes (TTC), including applicable French VAT. VITESSE ECO SAS reserves the right to modify prices at any time; products are invoiced at the price in effect at the time of order validation.

Delivery costs, where applicable, are indicated before final order validation.

3. ORDERS AND CONFIRMATION

An order is placed through the following steps: product selection, cart review, delivery information, delivery method, payment method, order summary, and validation. A confirmation email is sent automatically after payment validation. VITESSE ECO SAS reserves the right to refuse or cancel any order in case of prior dispute, suspected fraud or non-payment.

4. PAYMENT METHODS

The following payment methods are accepted:
• Credit/debit card: Visa, Mastercard, American Express (via Stripe, PCI DSS Level 1 certified)
• PayPal: secure payment via your PayPal account
• In-store payment: upon collection at our Poitiers location
• Bank transfer: upon request, bank details will be provided by email

Payment is due immediately at the time of order (except bank transfer: 5 business days).

5. DELIVERY

5.1 Standard delivery in metropolitan France
• Free for all orders
• Delivery time: 5 to 10 business days
• Delivery to the address provided by the customer

5.2 Express delivery in metropolitan France
• Delivery fees shown at checkout
• Delivery time: 2 to 4 business days
• With tracking and insurance

5.3 International delivery
• Available for select European countries
• Delivery fees calculated at checkout
• Delivery time: 7 to 21 business days depending on destination
• Customs duties and local taxes are the customer's responsibility

5.4 Receipt
The customer must check the condition of the parcel upon receipt. In case of visible damage, the customer must note reservations with the carrier and contact us within 48 hours at contact@vitesse-eco.fr with photos.

6. STORE PICKUP (CLICK & COLLECT)

Store pickup is available at our Poitiers location:
• Address: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers
• Availability: 1 to 2 business days after order confirmation
• On-site payment available (cash, card)
• Notification email sent when ready
• ID required for collection
• Collection deadline: 14 days after notification

7. RIGHT OF WITHDRAWAL

In accordance with Articles L.221-18 et seq. of the French Consumer Code, the customer has 14 calendar days from product receipt to exercise the right of withdrawal.

Return conditions:
• Product must be returned in original packaging, complete, unused and in perfect condition
• Return shipping costs are borne by the customer
• Product must be returned within 14 days of withdrawal notification

Refund within 14 days of receiving the returned product, using the original payment method.

Exclusions: customised or made-to-order products.

8. WARRANTIES

8.1 Legal warranty of conformity
VITESSE ECO SAS is bound to deliver goods conforming to the contract. The customer has 2 years from delivery to act under the warranty of conformity. Within this period, the defect is presumed to have existed at the time of delivery.

8.2 Hidden defects warranty
The customer may exercise the hidden defects warranty within 2 years of discovering the defect.

8.3 Warranty procedure
Contact us at contact@vitesse-eco.fr with your order number, description of the issue, photos and proof of purchase.

9. LIABILITY

VITESSE ECO SAS shall not be liable for damages resulting from misuse, normal wear, unauthorised modifications, indirect damages or force majeure. Liability is limited to the order amount.

10. PERSONAL DATA

VITESSE ECO SAS processes personal data in accordance with the GDPR. Please refer to our Privacy Policy for details.

11. DISPUTES AND MEDIATION

These T&Cs are governed by French law. In case of dispute, the customer is invited to contact customer service at contact@vitesse-eco.fr first. The customer may also use the European Commission's online dispute resolution platform: https://ec.europa.eu/consumers/odr/

Failing amicable resolution, disputes shall be submitted to the competent courts of Poitiers, France.`,

  es: `CONDICIONES GENERALES DE VENTA

Última actualización: 07/04/2026

Las presentes Condiciones Generales de Venta (en adelante "CGV") rigen todas las ventas realizadas por VITESSE ECO SAS a través de su sitio web www.vitesse-eco.com.

VITESSE ECO — SAS
SIREN: 100 732 247 | SIRET: 100 732 247 00018
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Francia
Correo: contact@vitesse-eco.fr | Web: www.vitesse-eco.com

1. OBJETO

Las presentes CGV definen los derechos y obligaciones de las partes en el marco de la venta en línea de bicicletas eléctricas fatbike y accesorios. Todo pedido implica la aceptación sin reservas de estas CGV.

2. PRECIOS

Todos los precios se indican en euros (EUR), impuestos incluidos (TTC). VITESSE ECO SAS se reserva el derecho de modificar sus precios en cualquier momento. Los gastos de envío se indican antes de la validación final del pedido.

3. PEDIDOS Y CONFIRMACIÓN

Se envía un correo electrónico de confirmación automáticamente tras la validación del pago. VITESSE ECO SAS se reserva el derecho de rechazar cualquier pedido en caso de litigio previo o sospecha de fraude.

4. MÉTODOS DE PAGO

• Tarjeta bancaria: Visa, Mastercard, American Express (vía Stripe, certificado PCI DSS Nivel 1)
• PayPal
• Pago en tienda: al recoger su pedido en Poitiers
• Transferencia bancaria: bajo petición

5. ENTREGA

5.1 Entrega estándar en Francia metropolitana
• Gratuita para todos los pedidos
• Plazo: 5 a 10 días laborables

5.2 Entrega exprés en Francia metropolitana
• Gastos indicados al realizar el pedido
• Plazo: 2 a 4 días laborables

5.3 Entrega internacional
• Disponible para determinados países europeos
• Gastos calculados en el momento del pedido
• Los derechos de aduana son responsabilidad del cliente

5.4 Recepción
El cliente debe verificar el estado del paquete. En caso de daño, contactar en 48 horas a contact@vitesse-eco.fr con fotos.

6. RECOGIDA EN TIENDA (CLICK & COLLECT)

• Dirección: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers
• Disponibilidad: 1 a 2 días laborables tras la confirmación
• Pago en el lugar posible (efectivo, tarjeta)
• Se requiere documento de identidad
• Plazo de recogida: 14 días tras la notificación

7. DERECHO DE DESISTIMIENTO

El cliente dispone de 14 días naturales desde la recepción del producto para ejercer su derecho de desistimiento.

Condiciones:
• Producto en embalaje original, completo, sin usar y en perfecto estado
• Gastos de devolución a cargo del cliente

Reembolso en un plazo máximo de 14 días tras la recepción del producto devuelto.

8. GARANTÍAS

• Garantía legal de conformidad: 2 años desde la entrega
• Garantía de vicios ocultos: 2 años desde el descubrimiento del vicio

Contacto para garantía: contact@vitesse-eco.fr con número de pedido, descripción, fotos y factura.

9. RESPONSABILIDAD

VITESSE ECO SAS no será responsable de daños por mal uso, desgaste normal, modificaciones no autorizadas o fuerza mayor. La responsabilidad se limita al importe del pedido.

10. DATOS PERSONALES

Consulte nuestra Política de Privacidad para más información sobre el tratamiento de sus datos.

11. LITIGIOS Y MEDIACIÓN

Las presentes CGV se rigen por la legislación francesa. En caso de litigio, el cliente puede contactar primero al servicio de atención al cliente en contact@vitesse-eco.fr. Plataforma europea de resolución de litigios: https://ec.europa.eu/consumers/odr/

En su defecto, competencia de los tribunales de Poitiers, Francia.`,

  nl: `ALGEMENE VERKOOPVOORWAARDEN

Laatst bijgewerkt: 07/04/2026

Deze Algemene Verkoopvoorwaarden (hierna "AV") zijn van toepassing op alle verkopen door VITESSE ECO SAS via haar website www.vitesse-eco.com.

VITESSE ECO — SAS
SIREN: 100 732 247 | SIRET: 100 732 247 00018
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankrijk
E-mail: contact@vitesse-eco.fr | Website: www.vitesse-eco.com

1. DOEL

Deze AV definiëren de rechten en verplichtingen van de partijen bij de online verkoop van elektrische fatbikes en accessoires. Elke bestelling impliceert onvoorwaardelijke aanvaarding van deze AV.

2. PRIJZEN

Alle prijzen zijn in euro's (EUR), inclusief alle belastingen (TTC). VITESSE ECO SAS behoudt zich het recht voor prijzen op elk moment te wijzigen. Verzendkosten worden aangegeven voor de definitieve bevestiging van de bestelling.

3. BESTELLINGEN EN BEVESTIGING

Er wordt automatisch een bevestigingsmail verzonden na betalingsbevestiging. VITESSE ECO SAS behoudt zich het recht voor bestellingen te weigeren bij een eerder geschil of vermoeden van fraude.

4. BETAALMETHODEN

• Bankkaart: Visa, Mastercard, American Express (via Stripe, PCI DSS Level 1)
• PayPal
• Betaling in de winkel: bij ophaling in Poitiers
• Bankoverschrijving: op aanvraag

5. LEVERING

5.1 Standaardlevering in metropolitaans Frankrijk
• Gratis voor alle bestellingen
• Levertijd: 5 tot 10 werkdagen

5.2 Expreslevering in metropolitaans Frankrijk
• Verzendkosten aangegeven bij bestelling
• Levertijd: 2 tot 4 werkdagen

5.3 Internationale levering
• Beschikbaar voor bepaalde Europese landen
• Verzendkosten berekend bij bestelling
• Invoerrechten zijn voor rekening van de klant

5.4 Ontvangst
De klant moet de staat van het pakket controleren. Bij zichtbare schade: contact opnemen binnen 48 uur via contact@vitesse-eco.fr met foto's.

6. AFHALEN IN DE WINKEL (CLICK & COLLECT)

• Adres: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers
• Beschikbaarheid: 1 tot 2 werkdagen na bevestiging
• Betaling ter plaatse mogelijk (contant, kaart)
• Identiteitsbewijs vereist
• Afhaaltermijn: 14 dagen na notificatie

7. HERROEPINGSRECHT

De klant heeft 14 kalenderdagen na ontvangst van het product om het herroepingsrecht uit te oefenen.

Voorwaarden:
• Product in originele verpakking, compleet, ongebruikt en in perfecte staat
• Retourkosten zijn voor rekening van de klant

Terugbetaling binnen 14 dagen na ontvangst van het geretourneerde product.

8. GARANTIES

• Wettelijke garantie van conformiteit: 2 jaar vanaf levering
• Garantie voor verborgen gebreken: 2 jaar vanaf ontdekking

Contact voor garantie: contact@vitesse-eco.fr met bestelnummer, beschrijving, foto's en factuur.

9. AANSPRAKELIJKHEID

VITESSE ECO SAS is niet aansprakelijk voor schade door verkeerd gebruik, normale slijtage, ongeautoriseerde wijzigingen of overmacht. Aansprakelijkheid is beperkt tot het bestelbedrag.

10. PERSOONSGEGEVENS

Raadpleeg ons Privacybeleid voor informatie over gegevensverwerking.

11. GESCHILLEN EN BEMIDDELING

Deze AV worden beheerst door Frans recht. Bij geschillen kan de klant eerst contact opnemen via contact@vitesse-eco.fr. Europees platform voor geschillenbeslechting: https://ec.europa.eu/consumers/odr/

Bij gebreke van minnelijke schikking zijn de rechtbanken van Poitiers, Frankrijk, bevoegd.`,

  de: `ALLGEMEINE GESCHÄFTSBEDINGUNGEN

Letzte Aktualisierung: 07.04.2026

Diese Allgemeinen Geschäftsbedingungen (nachfolgend "AGB") regeln alle Verkäufe der VITESSE ECO SAS über ihre Website www.vitesse-eco.com.

VITESSE ECO — SAS
SIREN: 100 732 247 | SIRET: 100 732 247 00018
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, Frankreich
E-Mail: contact@vitesse-eco.fr | Website: www.vitesse-eco.com

1. GEGENSTAND

Diese AGB definieren die Rechte und Pflichten der Parteien beim Online-Verkauf von elektrischen Fatbikes und Zubehör. Jede Bestellung impliziert die vorbehaltlose Annahme dieser AGB.

2. PREISE

Alle Preise sind in Euro (EUR) angegeben, inklusive aller Steuern (TTC). VITESSE ECO SAS behält sich das Recht vor, Preise jederzeit zu ändern. Versandkosten werden vor der endgültigen Bestellbestätigung angezeigt.

3. BESTELLUNGEN UND BESTÄTIGUNG

Eine Bestätigungsmail wird automatisch nach Zahlungsbestätigung versendet. VITESSE ECO SAS behält sich das Recht vor, Bestellungen bei vorherigen Streitigkeiten oder Betrugsverdacht abzulehnen.

4. ZAHLUNGSMETHODEN

• Kreditkarte: Visa, Mastercard, American Express (über Stripe, PCI DSS Level 1)
• PayPal
• Zahlung vor Ort: bei Abholung in Poitiers
• Banküberweisung: auf Anfrage

5. LIEFERUNG

5.1 Standardlieferung in Frankreich (Festland)
• Kostenlos für alle Bestellungen
• Lieferzeit: 5 bis 10 Werktage

5.2 Expresslieferung in Frankreich (Festland)
• Versandkosten bei Bestellung angegeben
• Lieferzeit: 2 bis 4 Werktage

5.3 Internationale Lieferung
• Verfügbar für ausgewählte europäische Länder
• Versandkosten bei Bestellung berechnet
• Zollgebühren gehen zu Lasten des Kunden

5.4 Empfang
Der Kunde muss den Zustand des Pakets prüfen. Bei sichtbaren Schäden: Kontakt innerhalb von 48 Stunden unter contact@vitesse-eco.fr mit Fotos.

6. ABHOLUNG IM GESCHÄFT (CLICK & COLLECT)

• Adresse: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers
• Verfügbarkeit: 1 bis 2 Werktage nach Bestätigung
• Zahlung vor Ort möglich (bar, Karte)
• Ausweis erforderlich
• Abholfrist: 14 Tage nach Benachrichtigung

7. WIDERRUFSRECHT

Der Kunde hat 14 Kalendertage ab Erhalt des Produkts, um sein Widerrufsrecht auszuüben.

Bedingungen:
• Produkt in Originalverpackung, vollständig, unbenutzt und in einwandfreiem Zustand
• Rücksendekosten trägt der Kunde

Erstattung innerhalb von 14 Tagen nach Erhalt des zurückgesandten Produkts.

8. GARANTIEN

• Gesetzliche Konformitätsgarantie: 2 Jahre ab Lieferung
• Garantie für versteckte Mängel: 2 Jahre ab Entdeckung

Kontakt für Garantie: contact@vitesse-eco.fr mit Bestellnummer, Beschreibung, Fotos und Rechnung.

9. HAFTUNG

VITESSE ECO SAS haftet nicht für Schäden durch Fehlgebrauch, normalen Verschleiß, nicht autorisierte Änderungen oder höhere Gewalt. Die Haftung ist auf den Bestellbetrag beschränkt.

10. PERSONENBEZOGENE DATEN

Informationen zur Datenverarbeitung finden Sie in unserer Datenschutzerklärung.

11. STREITIGKEITEN UND MEDIATION

Diese AGB unterliegen französischem Recht. Bei Streitigkeiten kann der Kunde zunächst den Kundenservice unter contact@vitesse-eco.fr kontaktieren. Europäische Plattform zur Online-Streitbeilegung: https://ec.europa.eu/consumers/odr/

Bei Scheitern einer gütlichen Einigung sind die zuständigen Gerichte von Poitiers, Frankreich, zuständig.`,

  ar: `الشروط والأحكام العامة للبيع

آخر تحديث: 07/04/2026

تحكم هذه الشروط والأحكام العامة للبيع (المشار إليها فيما بعد بـ "الشروط") جميع عمليات البيع التي تتم بواسطة شركة VITESSE ECO SAS عبر موقعها www.vitesse-eco.com.

VITESSE ECO — SAS
SIREN: 100 732 247 | SIRET: 100 732 247 00018
32 Rue du Faubourg du Pont Neuf, 86000 Poitiers, فرنسا
البريد الإلكتروني: contact@vitesse-eco.fr | الموقع: www.vitesse-eco.com

1. الموضوع

تحدد هذه الشروط حقوق والتزامات الأطراف في إطار البيع عبر الإنترنت للدراجات الكهربائية والإكسسوارات. كل طلب يعني القبول غير المشروط لهذه الشروط.

2. الأسعار

جميع الأسعار معروضة باليورو (EUR)، شاملة جميع الضرائب (TTC). تحتفظ VITESSE ECO SAS بالحق في تعديل الأسعار في أي وقت. يتم عرض تكاليف الشحن قبل التأكيد النهائي للطلب.

3. الطلبات والتأكيد

يتم إرسال بريد إلكتروني للتأكيد تلقائياً بعد التحقق من الدفع. تحتفظ VITESSE ECO SAS بالحق في رفض أي طلب في حالة نزاع سابق أو اشتباه في احتيال.

4. طرق الدفع

• بطاقة مصرفية: Visa، Mastercard، American Express (عبر Stripe، معتمد PCI DSS المستوى 1)
• PayPal
• الدفع في المتجر: عند استلام طلبك من بواتييه
• تحويل مصرفي: عند الطلب

5. التوصيل

5.1 التوصيل القياسي في فرنسا
• مجاني لجميع الطلبات
• المدة: 5 إلى 10 أيام عمل

5.2 التوصيل السريع في فرنسا
• تكاليف الشحن تُعرض عند الطلب
• المدة: 2 إلى 4 أيام عمل

5.3 التوصيل الدولي
• متاح لبعض الدول الأوروبية
• تُحسب تكاليف الشحن عند الطلب
• الرسوم الجمركية على حساب العميل

5.4 الاستلام
يجب على العميل التحقق من حالة الطرد. في حالة التلف: التواصل خلال 48 ساعة عبر contact@vitesse-eco.fr مع صور.

6. الاستلام من المتجر (CLICK & COLLECT)

• العنوان: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers
• التوفر: 1 إلى 2 أيام عمل بعد التأكيد
• الدفع في الموقع ممكن (نقداً، بطاقة)
• يُطلب إثبات الهوية
• مهلة الاستلام: 14 يوماً بعد الإشعار

7. حق الانسحاب

يحق للعميل خلال 14 يوماً تقويمياً من استلام المنتج ممارسة حق الانسحاب.

الشروط:
• المنتج في عبوته الأصلية، كامل، غير مستخدم وبحالة ممتازة
• تكاليف الإرجاع على حساب العميل

الاسترداد خلال 14 يوماً من استلام المنتج المُرجع.

8. الضمانات

• ضمان المطابقة القانوني: سنتان من التسليم
• ضمان العيوب المخفية: سنتان من اكتشاف العيب

للتواصل بخصوص الضمان: contact@vitesse-eco.fr مع رقم الطلب والوصف والصور والفاتورة.

9. المسؤولية

لا تتحمل VITESSE ECO SAS المسؤولية عن الأضرار الناتجة عن سوء الاستخدام أو التآكل الطبيعي أو التعديلات غير المصرح بها أو القوة القاهرة. تقتصر المسؤولية على مبلغ الطلب.

10. البيانات الشخصية

راجع سياسة الخصوصية الخاصة بنا لمعرفة المزيد عن معالجة بياناتك.

11. النزاعات والوساطة

تخضع هذه الشروط للقانون الفرنسي. في حالة النزاع، يُدعى العميل للتواصل أولاً مع خدمة العملاء عبر contact@vitesse-eco.fr. منصة تسوية النزاعات الأوروبية: https://ec.europa.eu/consumers/odr/

في حالة عدم التوصل إلى حل ودي، تختص محاكم بواتييه، فرنسا.`,
}

// ============================================================================
// PUSH TO SANITY
// ============================================================================
async function main() {
  console.log('Filling legal pages in Sanity...')

  // First check if legalPages document exists
  const existing = await client.fetch(`*[_type == "legalPages"][0]`)

  if (existing) {
    console.log(`Found existing legalPages document: ${existing._id}`)
    await client
      .patch(existing._id)
      .set({ mentionsLegales, politiqueConfidentialite, cgv })
      .commit()
    console.log(`Updated document ${existing._id}`)
  } else {
    console.log('No legalPages document found, creating one...')
    const doc = await client.create({
      _type: 'legalPages',
      mentionsLegales,
      politiqueConfidentialite,
      cgv,
    })
    console.log(`Created document ${doc._id}`)
  }

  console.log('')
  console.log('All 3 legal pages filled with content in 6 languages:')
  console.log('  - mentionsLegales (Legal Notice): FR, EN, ES, NL, DE, AR')
  console.log('  - politiqueConfidentialite (Privacy Policy): FR, EN, ES, NL, DE, AR')
  console.log('  - cgv (Terms & Conditions): FR, EN, ES, NL, DE, AR')
  console.log('')
  console.log('Done!')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
