# Privacy — Oddinote

This is a short summary. The complete privacy policy — legal bases, how long data is kept, your rights and how to complain — is at **https://oddinote-web.vercel.app/privacy.html**.

**Who is responsible:** Neuroxcx, an independent developer in Colombia. Private requests (access, deletion, objection, removing a view-only link): through GitHub's private report form, https://github.com/Neuroxcx1/Odinote/security/advisories/new (it needs a GitHub account). Please do not post personal data in public issues.

## Usage statistics

The app on every platform (Windows, macOS, Linux, Android) and the official web app (`neuroxcx1.github.io/Odinote`) send **pseudonymous usage statistics to Google Analytics** — they carry no name, no email and no content, but they are linked to a random identifier per device, so they are not anonymous. They help to know whether Oddinote is used and which parts are useful.

What is sent:

- That the app was opened, on which platform, its theme, language and screen-size range, and for how many minutes it is used.
- Which **kinds** of node are created (note, image, board…), how deep you go into boards, and how many strokes a saved drawing has.
- Whether live sessions and putting a project online in Google Drive work or fail (for live sessions, with a short error message stripped of emails, addresses and file paths), and that a view-only link was created.
- The page is always reported as "Oddinote": no project names and no link keys.

What Google adds by itself:

- Your **approximate country and city**, worked out from your internet connection, and the type of device, system and browser.
- A **random identifier for each device**, so that a returning device is not counted as a new one. **In the EU/EEA, the UK and Switzerland no identifier is stored on your device**: there the app uses Google's Consent Mode with storage denied, so Google only receives cookieless pings.

What is **never** sent: your name, your email, the names of your projects, or anything you write, draw or put in your notes.

Copies of Oddinote that are run from the source code (or a fork) send nothing.

## Your projects and the optional features

Your projects stay on your device (in your vault folder or in the app's data). They only leave it if **you** use one of these:

- **Sign in with Google:** the app receives your name, email and profile picture, to show your account, connect Google Drive, show your name in live sessions and check donor perks.
- **Google Drive:** the project is saved in a folder of *your* Drive (permission `drive.file`). Images and files uploaded there are shared as "anyone with the link can view", so that the project opens on your other devices.
- **View-only link:** a copy of that project is stored in Google Firebase (Cloud Firestore). Anyone with the link can read it, and it stays until you remove the link.
- **Live sessions:** Firebase only helps the participants find each other (an anonymous account and connection messages that include network addresses); the canvas travels directly between the devices. Other participants see your name.
- **Link previews:** when you paste a web address, it is sent to Microlink to fetch the title and picture.
- **Donations on Ko-fi:** if you donate, Ko-fi sends the donation details (including your email) so the app can turn on the cosmetic perks.

## Children

Oddinote is **not directed at children under 13**, and it does not knowingly collect information from them. If you are under 16, or under the age of digital consent where you live, use Oddinote only with the permission of a parent or guardian. The app never asks for your age.

## Contact

Private requests: https://github.com/Neuroxcx1/Odinote/security/advisories/new. General questions: an issue or a discussion at [github.com/Neuroxcx1/Odinote](https://github.com/Neuroxcx1/Odinote).
