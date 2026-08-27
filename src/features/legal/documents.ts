/**
 * The two legal documents the login screen links to, as structured native content.
 *
 * ## Why the content is bundled rather than fetched
 *
 * No endpoint on the deployed backend publishes a legal or policy URL, so there is no address to
 * point a viewer at and the documents ship with the app. That is also the right default for this
 * content: the login screen says "By continuing, I accept the Terms of use & Privacy policy", so a
 * cook being asked to ACCEPT the documents must be able to read them before they have an account —
 * including with no connection. (The User App reached the same conclusion; see its
 * `features/legal/documents.ts`.)
 *
 * ## Why structured blocks and not HTML in a WebView
 *
 * The User App renders its documents as HTML in `react-native-webview`. This app does not carry
 * that native module, and adding one means a new native build — which this project's build notes
 * record as expensive to get right. The documents have a fixed shape (numbered sections,
 * sub-headings, bulleted lists), so they are expressed as typed blocks and rendered with the app's
 * own `Text` primitives instead. When Legal revises a document, the block arrays are replaced
 * wholesale.
 *
 * ## Transcription
 *
 * `terms` is transcribed from `Spoon - Customer Terms of Service.pdf` and `privacy` from
 * `Spoon - Cook Partner Privacy Policy.pdf`, both "Last Updated: September 1, 2026". The wording
 * is verbatim: legal copy is not paraphrased, tidied or abridged here, and the section numbering
 * is the source's own so a cook quoting "clause 5" means what Legal means.
 *
 * WHEN THE DOCUMENTS CHANGE: replace the block arrays and update `updated`. Nothing else reads
 * the date, so the two cannot drift apart.
 */

export type LegalDocumentId = 'terms' | 'privacy';

/** One renderable unit of a document, in source order. */
export type LegalBlock =
  /** A numbered section heading — `1. ABOUT THESE TERMS`. */
  | { readonly kind: 'section'; readonly text: string }
  /** A bold sub-heading within a section. */
  | { readonly kind: 'subheading'; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  /** A line the source sets in bold as a standalone statement. */
  | { readonly kind: 'callout'; readonly text: string };

export interface LegalDocument {
  /** The header title — also what the login link points at. */
  readonly title: string;
  /** The italic line under the source's title. */
  readonly tagline: string;
  /** Printed under the title, verbatim from the document. */
  readonly updated: string;
  readonly blocks: readonly LegalBlock[];
  /** The bold acknowledgement line both documents close with. */
  readonly closing: string;
}

/** The entity block both documents close with, and the address both print. */
const ENTITY = 'Tametoe Tomatoe Technologies Private Limited';
export const LEGAL_ENTITY_LINE = `${ENTITY} · Bengaluru, Karnataka, India`;
const CONTACT_EMAIL = 'admin@spoonhelp.com';
const OFFICE =
  'Innov8 Mantri Commercio, Tower A, 5th Floor, No. 51, Bellandur, Bengaluru – 560103, Karnataka, India';

const TERMS_BLOCKS: readonly LegalBlock[] = [
  { kind: 'section', text: '1. ABOUT THESE TERMS' },
  {
    kind: 'paragraph',
    text: 'These Terms of Service ("Terms") constitute a legally binding agreement between you ("Customer") and Tametoe Tomatoe Technologies Private Limited ("Spoon"). They govern your access to and use of the Spoon mobile application, website, and all related services (the "Platform").',
  },
  {
    kind: 'paragraph',
    text: 'By downloading the app, creating an account, or placing a booking, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, discontinue use of the Platform immediately.',
  },
  {
    kind: 'paragraph',
    text: 'These Terms are published in compliance with the Indian Contract Act, 1872, the Information Technology Act, 2000, the Consumer Protection Act, 2019, and the Consumer Protection (E-Commerce) Rules, 2020.',
  },

  { kind: 'section', text: '2. ELIGIBILITY' },
  { kind: 'paragraph', text: 'Access to Spoon is restricted to individuals who:' },
  {
    kind: 'bullets',
    items: [
      'Reside in India in a city where Spoon currently operates',
      'Have not previously had an account suspended or terminated by Spoon',
    ],
  },
  {
    kind: 'paragraph',
    text: 'By accessing the Platform, you represent and warrant that you meet all eligibility criteria.',
  },

  { kind: 'section', text: '3. YOUR ACCOUNT' },
  { kind: 'subheading', text: 'Registration and accuracy of information' },
  {
    kind: 'paragraph',
    text: 'To use Spoon, you must register providing your mobile number, name, delivery address, and email. All information must be accurate, complete, and current. Spoon is not liable for loss resulting from your failure to maintain accurate information.',
  },
  { kind: 'subheading', text: 'Account security and responsibility' },
  {
    kind: 'paragraph',
    text: `You are solely responsible for maintaining confidentiality of your login credentials. You accept full responsibility for all activities under your account. Notify Spoon at ${CONTACT_EMAIL} immediately if you suspect unauthorised access.`,
  },
  { kind: 'subheading', text: 'One account per person' },
  {
    kind: 'paragraph',
    text: 'Each individual may hold only one active customer account. Creating multiple accounts to circumvent suspensions or abuse promotional offers is strictly prohibited and will result in permanent termination.',
  },

  { kind: 'section', text: '4. OUR PLATFORM & COOKS' },
  { kind: 'subheading', text: 'What Spoon is' },
  {
    kind: 'paragraph',
    text: 'Spoon is a technology platform that connects customers with trained, verified cooks who provide home cooking services. While Spoon manages the customer relationship, the actual cooking service is performed by the assigned Cook.',
  },
  { kind: 'subheading', text: 'Cook selection and verification' },
  { kind: 'paragraph', text: 'All Cooks are:' },
  {
    kind: 'bullets',
    items: [
      'Identity-verified using government-issued documents',
      'Background-screened before assignment',
      'Trained in food safety, hygiene, and professional conduct',
      'Continuously monitored through customer ratings and performance metrics',
      'Subject to deactivation if performance falls below standards or misconduct is reported',
    ],
  },
  { kind: 'subheading', text: 'Limitations of our service' },
  {
    kind: 'paragraph',
    text: 'While Spoon is committed to providing a high-quality, professional home cooking experience, the nature of the service means certain outcomes depend on factors outside our direct control. Accordingly:',
  },
  {
    kind: 'bullets',
    items: [
      'Taste, presentation, and cooking style are inherently subjective — Spoon ensures professional standards are met but cannot guarantee that every dish will match your personal preference',
      'Cook availability depends on demand and geography — Spoon will notify you promptly if no Cook can be assigned and will offer alternatives or a full refund',
      'Platform availability may occasionally be affected by technical maintenance or circumstances beyond our control — we aim to minimise disruption and communicate in advance where possible',
      'Spoon is not liable for damage to kitchen equipment, utensils, or property arising from normal use during a session, or for adverse reactions to food where accurate allergy or dietary information was not disclosed at the time of booking',
    ],
  },

  { kind: 'section', text: '5. BOOKINGS & SESSIONS' },
  { kind: 'subheading', text: 'Placing a booking' },
  {
    kind: 'paragraph',
    text: 'A booking is confirmed only when: (a) you receive in-app or SMS confirmation from Spoon, and (b) the booking fee has been successfully processed. Spoon may decline any booking request at its sole discretion.',
  },
  { kind: 'subheading', text: 'Session OTP verification' },
  {
    kind: 'paragraph',
    text: "At the start of each session, you will receive a Session OTP. Share it with your Cook only after they have physically arrived at your premises. Do not share the OTP before the Cook's arrival.",
  },
  { kind: 'subheading', text: 'Your obligations during a session' },
  { kind: 'paragraph', text: 'By confirming a booking, you agree to:' },
  {
    kind: 'bullets',
    items: [
      'Ensure a safe, clean, and adequately equipped cooking space for the full session duration',
      'Provide all necessary food ingredients, utensils, and cooking equipment',
      'Ensure a responsible adult aged 18+ is present at the premises throughout the session',
      'Immediately disclose information relevant to Cook safety — pets, allergies, defective appliances, or safety hazards',
      'Provide the Cook with safe and unobstructed access to the kitchen',
    ],
  },
  { kind: 'subheading', text: 'Session extensions' },
  {
    kind: 'paragraph',
    text: "Extensions are subject to the Cook's availability and consent. Additional charges are displayed and confirmed in the app before the extension commences.",
  },

  { kind: 'section', text: '6. PRICING, FEES & PAYMENT' },
  {
    kind: 'paragraph',
    text: 'Fees displayed at the time of booking may include: service charges, convenience fees, surge pricing (during high demand), and GST at the applicable rate. Fee changes do not apply to already-confirmed bookings.',
  },
  {
    kind: 'paragraph',
    text: 'All payments are processed exclusively through PCI-DSS Level 1 compliant payment processors. Spoon does not store your full card number, CVV, or banking credentials.',
  },
  { kind: 'subheading', text: 'Tips' },
  {
    kind: 'paragraph',
    text: 'Tips are entirely voluntary and transferred in full to the Cook. Tips are non-refundable once paid.',
  },
  { kind: 'subheading', text: 'Failed and disputed payments' },
  {
    kind: 'paragraph',
    text: `If a payment fails, your booking will not be confirmed. For payment disputes, contact ${CONTACT_EMAIL} with the booking reference and transaction details.`,
  },

  { kind: 'section', text: '7. CANCELLATIONS & REFUNDS' },
  { kind: 'subheading', text: 'Cancellation by you' },
  {
    kind: 'paragraph',
    text: 'You may cancel a confirmed booking through the app prior to session commencement. Cancellations within the free cancellation window (displayed at booking) are eligible for a full refund. Cancellations after this window may incur a cancellation fee.',
  },
  { kind: 'subheading', text: 'Cancellation by Spoon' },
  {
    kind: 'paragraph',
    text: 'Spoon may cancel a booking if no Cook is available, if safety concerns exist, or if a force majeure event prevents service delivery. In such cases, you will receive a full refund.',
  },
  { kind: 'subheading', text: 'Refund processing' },
  {
    kind: 'paragraph',
    text: 'Approved refunds are credited to your original payment method within 5–7 business days. Refunds may optionally be credited to your Spoon wallet for faster processing.',
  },

  { kind: 'section', text: '8. YOUR CONDUCT' },
  { kind: 'subheading', text: 'Respectful treatment of Cooks' },
  {
    kind: 'paragraph',
    text: 'You must treat your Cook with dignity, courtesy, and professionalism at all times. Abusive, threatening, intimidating, sexually harassing, or demeaning behaviour is strictly prohibited and will result in immediate account suspension or termination.',
  },
  { kind: 'subheading', text: 'Non-solicitation of Cooks' },
  {
    kind: 'paragraph',
    text: 'During your membership and for 12 months following your last completed session, you must not directly or indirectly solicit any Cook to provide services outside of the Spoon Platform. Violation may result in immediate account termination.',
  },
  { kind: 'subheading', text: 'Prohibited conduct' },
  { kind: 'paragraph', text: 'You must not:' },
  {
    kind: 'bullets',
    items: [
      'Use the Platform for any unlawful, fraudulent, or deceptive purpose',
      'Submit knowingly false or defamatory reviews or ratings',
      'Attempt to gain unauthorised access to accounts or Spoon systems',
      'Provide false information about your household, safety hazards, or session requirements',
    ],
  },

  { kind: 'section', text: '9. RATINGS & REVIEWS' },
  {
    kind: 'paragraph',
    text: 'Post-session ratings and reviews must be based on genuine, first-hand experience and must not contain defamatory, offensive, or legally restricted material. By submitting a review, you grant Spoon a non-exclusive, royalty-free licence to reproduce and use it across the Platform and promotional channels.',
  },

  { kind: 'section', text: '10. DISCLAIMERS & WARRANTIES' },
  {
    kind: 'paragraph',
    text: 'The Platform is provided on an "as is" and "as available" basis. While Spoon commits to rigorous Cook selection and training, Spoon does not warrant that the Platform will be continuously available or that the results of any session will meet your individual expectations.',
  },
  {
    kind: 'paragraph',
    text: "Spoon shall not be liable for disputes arising solely from subjective satisfaction with food quality, presentation, or preparation style, provided the Cook has met Spoon's professional standards of food safety, hygiene, and conduct.",
  },

  { kind: 'section', text: '11. LIMITATION OF LIABILITY' },
  {
    kind: 'paragraph',
    text: "Spoon's total aggregate liability for any claim shall not exceed the lower of: (a) the booking fee actually paid for the specific booking giving rise to the claim, or (b) INR 10,000. Spoon shall not be liable for indirect, incidental, special, consequential, or punitive damages.",
  },

  { kind: 'section', text: '12. GOVERNING LAW & DISPUTES' },
  {
    kind: 'paragraph',
    text: 'These Terms are governed by the laws of India. Disputes shall first be referred to amicable resolution. If unresolved within 30 days, disputes shall be resolved by binding arbitration in Bengaluru, Karnataka, in English, per the Arbitration and Conciliation Act, 1996.',
  },

  { kind: 'section', text: '13. GRIEVANCE OFFICER' },
  { kind: 'callout', text: 'Name: Harshvardhan Surana' },
  { kind: 'paragraph', text: 'Designation: Grievance Officer' },
  { kind: 'paragraph', text: `Email: ${CONTACT_EMAIL}` },
  { kind: 'paragraph', text: `Address: ${OFFICE}` },
  {
    kind: 'paragraph',
    text: 'We will acknowledge within 48 hours and resolve all grievances within 30 days.',
  },

  { kind: 'section', text: '14. CHANGES TO THESE TERMS' },
  {
    kind: 'paragraph',
    text: 'Spoon will notify you via in-app notification or email at least 7 days before material changes take effect. Continued use of the Platform after changes constitutes your acceptance of the revised Terms.',
  },
];

const PRIVACY_BLOCKS: readonly LegalBlock[] = [
  { kind: 'section', text: '1. ABOUT THIS POLICY' },
  {
    kind: 'paragraph',
    text: 'This Privacy Policy describes how Tametoe Tomatoe Technologies Private Limited ("Spoon") collects, uses, shares, and protects your personal information when you register and provide cooking services through the Spoon Cook application (the "Platform").',
  },
  {
    kind: 'paragraph',
    text: 'By registering as a Cook Partner, completing onboarding, or providing services through the Platform, you consent to the practices described in this policy.',
  },
  {
    kind: 'paragraph',
    text: 'This policy is published in accordance with the Information Technology Act, 2000, the IT (Reasonable Security Practices) Rules, 2011, and the Digital Personal Data Protection Act, 2023.',
  },

  { kind: 'section', text: '2. INFORMATION WE COLLECT' },
  { kind: 'subheading', text: 'Registration and onboarding information' },
  {
    kind: 'paragraph',
    text: "When you register, we collect: your name, date of birth, mobile number, email address, residential address, government-issued identity documents (Aadhaar, PAN, driver's license, or passport — for KYC only), bank account number and IFSC code (for earnings disbursement only), years of experience, culinary specialties, professional bio, profile photo, and emergency contact information.",
  },
  { kind: 'subheading', text: 'Location data' },
  {
    kind: 'paragraph',
    text: "We collect your location when you are using the app to navigate to a customer's home or during an active booking — used to calculate ETA, share live location with the customer, and optimise routing. We may also collect location data in the background where necessary to ensure accurate session tracking and service delivery.",
  },
  { kind: 'subheading', text: 'Performance and session data' },
  {
    kind: 'paragraph',
    text: 'We collect: check-in and check-out timings, OTP completions, session duration, customer ratings and reviews, earnings, tips, bonuses, and acceptance/decline patterns. This data is used to calculate pay, performance score, booking allocation, and incentive eligibility.',
  },
  { kind: 'subheading', text: 'Usage and technical data' },
  {
    kind: 'paragraph',
    text: 'We automatically collect anonymised usage data: screens visited, session duration, device type, OS version, IP address, app crash logs, and feature usage patterns. This data does not personally identify you.',
  },

  { kind: 'section', text: '3. HOW WE USE YOUR INFORMATION' },
  { kind: 'paragraph', text: 'We use your information to:' },
  {
    kind: 'bullets',
    items: [
      'Create, manage, and verify your Cook Partner account',
      'Conduct identity verification and KYC compliance before your first booking',
      'Match you with customer bookings based on location, availability, specialties, and performance rating',
      'Share your name, profile photo, rating, experience, and specialties with customers',
      'Enable live location sharing with customers during active bookings',
      'Calculate and disburse your earnings, tips, and bonuses to your registered bank account',
      'Send booking notifications, schedule updates, training content, and session reminders',
      'Track your performance through ratings, completion rates, and acceptance metrics',
      'Detect and prevent fraud, safety incidents, and policy violations',
      'Comply with applicable laws and respond to regulatory requests',
    ],
  },
  {
    kind: 'callout',
    text: 'We do NOT use your personal information for marketing purposes without your explicit consent.',
  },

  { kind: 'section', text: '4. SHARING YOUR INFORMATION' },
  { kind: 'subheading', text: 'With customers' },
  {
    kind: 'paragraph',
    text: 'Customers can see your name, profile photo, star rating, years of experience, and culinary specialties. Your phone number is accessible only through the in-app call feature during active sessions and is never displayed in plain text.',
  },
  { kind: 'subheading', text: 'With service providers' },
  {
    kind: 'paragraph',
    text: 'We share data with: banking partners (earnings disbursement), cloud hosting providers, SMS gateways, push notification services, and analytics providers. All are bound by confidentiality agreements.',
  },
  { kind: 'subheading', text: 'We never sell your data' },
  {
    kind: 'paragraph',
    text: 'Spoon does not sell, rent, or trade your personal information to any third party for marketing or commercial purposes.',
  },

  { kind: 'section', text: '5. BANK & FINANCIAL DATA' },
  {
    kind: 'paragraph',
    text: 'Your bank account number and IFSC code are used exclusively for disbursing your earnings, tips, and bonuses. This data is:',
  },
  {
    kind: 'bullets',
    items: [
      'Encrypted at rest and in transit',
      'Accessible only to authorised Spoon finance personnel on a strictly need-to-know basis',
      'Never shared with customers or any non-essential third party',
    ],
  },
  {
    kind: 'paragraph',
    text: 'We do NOT store your Aadhaar number, PAN number, or other government ID details after identity verification is complete. These documents are used solely for KYC and then securely deleted from our primary systems.',
  },

  { kind: 'section', text: '6. DATA RETENTION' },
  {
    kind: 'paragraph',
    text: 'We retain your personal data for as long as your Cook Partner account is active. Earnings records and financial data are retained for 7 years for tax compliance. Account deletion requests are processed within 30 days, subject to legally required retentions. Aggregated, anonymised performance data may be retained indefinitely.',
  },

  { kind: 'section', text: '7. YOUR RIGHTS' },
  { kind: 'subheading', text: 'Right to access' },
  {
    kind: 'paragraph',
    text: 'You may request a copy of all personal data we hold, including your earnings history, performance records, and customer feedback.',
  },
  { kind: 'subheading', text: 'Right to correction' },
  {
    kind: 'paragraph',
    text: 'You may request correction of inaccurate or incomplete data. You are responsible for keeping your profile and bank account details up to date.',
  },
  { kind: 'subheading', text: 'Right to deletion' },
  {
    kind: 'paragraph',
    text: 'You may request deletion of your account and associated data, processed within 30 days subject to legally required retentions.',
  },
  { kind: 'subheading', text: 'How to exercise your rights' },
  {
    kind: 'paragraph',
    text: `Email ${CONTACT_EMAIL} with subject "Data Rights Request". We will respond within 30 days.`,
  },

  { kind: 'section', text: '8. SECURITY' },
  { kind: 'paragraph', text: 'We implement industry-standard security measures including:' },
  {
    kind: 'bullets',
    items: [
      'HTTPS/TLS encryption for all data in transit',
      'Encryption of sensitive fields (bank details, government IDs) at rest',
      'Role-based access controls limiting employee access to personal data',
      'Regular security audits and vulnerability assessments',
    ],
  },
  {
    kind: 'paragraph',
    text: `If you suspect unauthorised access, contact ${CONTACT_EMAIL} immediately.`,
  },

  { kind: 'section', text: "9. CHILDREN'S PRIVACY" },
  {
    kind: 'paragraph',
    text: 'The Spoon Cook Platform is intended for adults aged 18 and above. We do not knowingly onboard or collect personal information from minors. If we become aware that a minor has registered, we will terminate their account and delete their data promptly.',
  },

  { kind: 'section', text: '10. CHANGES TO THIS POLICY' },
  {
    kind: 'paragraph',
    text: 'When we make material changes, we will notify you via in-app notification or email at least 7 days before changes take effect. Continued use of Spoon after changes constitutes your acceptance of the updated policy.',
  },

  { kind: 'section', text: '11. GRIEVANCE OFFICER' },
  { kind: 'callout', text: 'Name: Harshvardhan Surana' },
  { kind: 'paragraph', text: 'Designation: Grievance Officer' },
  { kind: 'paragraph', text: `Email: ${CONTACT_EMAIL}` },
  { kind: 'paragraph', text: `Address: ${OFFICE}` },
  {
    kind: 'paragraph',
    text: 'We will acknowledge receipt within 48 hours and resolve all complaints within 30 days.',
  },
];

export const LEGAL_DOCUMENTS: Readonly<Record<LegalDocumentId, LegalDocument>> = {
  terms: {
    title: 'Customer Terms of Service',
    tagline: 'The terms that govern your use of the Spoon platform',
    updated: `Last Updated: September 1, 2026 · ${ENTITY} · ${CONTACT_EMAIL}`,
    blocks: TERMS_BLOCKS,
    closing:
      'By using Spoon, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.',
  },
  privacy: {
    title: 'Cook Partner Privacy Policy',
    tagline: 'How we collect, use, and protect your personal information',
    updated: `Last Updated: September 1, 2026 · ${ENTITY} · ${CONTACT_EMAIL}`,
    blocks: PRIVACY_BLOCKS,
    closing:
      'By registering as a Cook Partner on Spoon, you consent to the collection and use of your information as described in this Privacy Policy.',
  },
};

/** Narrows a route parameter to a known document, or `null` for anything else. */
export function legalDocumentFor(id: string | undefined): LegalDocumentId | null {
  return id === 'terms' || id === 'privacy' ? id : null;
}
