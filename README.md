
Hi everyone, thank for your interest in this project. This is the
still-in-development version of Connected Notes, a note taking app based on Zettelkasten.
Some major features are still missing (see below for full list).

I have set up a test version at connectednotes.net - I wouldn't use it for
anything serious just yet, but I'd love to get some feedback via github bugs or IRC messages.

# Goals

- A modern take on Zettelkasten
- Progressive web app (PWA) usable from both mobile and desktop
- Low upkeep cost combined with open-sourcing to give reasonable long-term support 
- Give users as much control over their notes as possible
  - Notes are synced in personal cloud (currently Google Drive works)
  - Store notes in plain text with any metadata stored separately
  - Possibly support for local notes (although so far only Chrome has any sort of filesystem API available)
- Markdown based
- Graph view for exploring notes easily
- Open source (duh)

# Current status

Integration with Google Drive works - however, since this is beta
changes are possible.

# Running locally

First, run npm install && ng serve

Then, navigate to localhost:4200/gd for the Google Drive backed version.
I've included an API key that works when serving on ports 4200, 5000 and 8080.
This API key is separate from prod and only able to use the drive API so
there shouldn't be risk in having it committed (right...?).

# Major missing features

- Search from note contents (not just titles)
- Reasonable offline support
- Settings to control eg. showing timestamps on notes
- Proper testing with browsers other than Chrome
- Sorting notes by different criteria (eg. creation time, modification time)
- Disentangle anything firebase related from the current app
- Dropbox integration
- On the technical side, needs more tests (currently only some default tests exist).

# Tech stack

Angular (ie. Typescript) is the main framework. Codemirror is used to provide markdown
highlighting, marked.js provides markdown rendering.

# Comparison to other Zettelkasten-ish note taking apps

While there are some
other open source Zettelkasten based note taking apps (shoutout to the great
Zettlr) AFAIK none of those provide direct integration with cloud storage,
accessibility via web/mobile and first-class flashcard integration.

Also, many such apps (open source or not) are currently based on Electron, which
has its own set of problems.

# Setting up your own instance

The only gotcha when setting up your own instance is that you need to create
Google Drive API key and replace the current one with that (the API key only
allows certain domains). Aside from that, everything deploying it should be
a breeze.

In addition, analytics currently works only for connectednotes.net so that would need
to be set up.

# Contact me

tsiki @ freenode/IRCnet

Or just create a github bug
