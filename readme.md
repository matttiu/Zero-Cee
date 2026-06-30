---
How to update things

Add/edit events — open script.js, edit the EVENTS array at the very top. Just fill in the date, venue, city, country, type, and a ticket link (or leave tickets as "").

Add your photo — drop a photo file (e.g. photo.jpg) into the folder, then in index.html find the about-photo-placeholder div and swap it with <img src="photo.jpg" alt="Zero Cee" class="about-photo">.

Add music embeds — in index.html, find the <!-- Paste your SoundCloud... --> comments and replace the placeholder div above each comment with your iframe embed code.

Connect the booking form — the simplest free option is Formspree (https://formspree.io) — create a free account, get a form ID, and update the <form> tag with action="https://formspree.io/f/YOUR_ID" method="POST". Full instructions are in the HTML comments.

Change the colour scheme — open styles.css, edit --cyan and --purple at the top. That's it.

To preview it, just double-click index.html to open it in any browser.