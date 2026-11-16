// Booking form wiring for Formspree. Kept in its own file (not inline) so the
// site's Content-Security-Policy can forbid inline scripts. This queue stub
// must load BEFORE vendor/formspree-ajax-*.js, which drains it on startup.
window.formspree = window.formspree || function () { (formspree.q = formspree.q || []).push(arguments); };
formspree('initForm', { formElement: '#booking-form', formId: 'mjgqednd' });
