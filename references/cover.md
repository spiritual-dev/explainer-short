# Cover: split title card, end frame, safe zones

Profile cover / title card for a finished short. Run after audio finish, before
calling the film post-ready.

## Split card

| Half | Content |
|------|---------|
| Top | Title + short promise on theme surface |
| Bottom | Real frame from the take (or presenter panel) |

## End-cover bake

Append ~0.4s of the cover to the end so platforms that pick a late frame
(thumbnailOffset style) can land on the title card. See `template/bake_endcover.sh`.

## Platform safe zones (9:16, 1080x1920)

Keep critical type and faces inside the center clear area. UI chrome eats the edges.

| Zone | Keep clear of critical copy |
|------|-----------------------------|
| Top ~150 px | Platform username / progress / close |
| Bottom ~250 px | Captions, like/share/comment rail |
| Right ~120 px | Action buttons on some apps |
| Left ~60 px | Usually safer; still avoid edge-hugging |

Caption chips in this skill sit near the vertical seam (graphics / presenter). Keep
them short so they do not collide with platform captions if those are also on.

## Rules

- No em dashes in titles or on-card copy.
- Face (if any) is a real frame the person approved; no synthetic likeness.
- Deliver 2-3 variants when taste is unclear; the person picks.
- Custom thumbnails on some platforms are an in-app step, not part of this skill.
