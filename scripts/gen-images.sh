#!/bin/zsh
# Generates slide frames + scene textures with the Codex CLI built-in image generation tool.
cd "$(dirname "$0")/.."
STYLE="Style for every image: a single still frame grabbed from a vintage black-and-white closed-circuit industrial video camera (1980s vidicon tube). Monochrome grayscale only. Subject centered on a pure black background, harsh high-contrast lighting, bright white highlights, deep blacks, slightly soft analog focus, fine video grain. Photorealistic real physical specimen and real hardware, not an illustration, not a 3D render. No text, no letters, no labels, no captions, no watermark, no border, no frame. Square 1:1 composition with the subject filling about 70 percent of the frame."
RULES="Rules: use your built-in image generation tool (imagegen) once per image. Never draw, composite or synthesize the images with code, and never make a contact sheet. Generate the images one after another, and after each one copy the generated PNG to the exact path given. If a file already exists at a path, skip it. When all are done, list the files with their pixel dimensions."

job() { # name, prompt
  codex exec --skip-git-repo-check -c model_reasoning_effort="low" -C "$PWD" "$2" > "logs/$1.log" 2>&1 &
}

job heart "$RULES
$STYLE
Images:
- assets-src/heart/2.png : a real anatomical human heart specimen clamped tight in the jaws of a heavy steel machinist bench vise, short rubber hoses pushed onto the cut arteries and fastened with hose clamps.
- assets-src/heart/3.png : a real human heart cut in cross-section showing all four chambers, with small brass plumbing ball valves and threaded pipe fittings installed where the heart valves should be.
- assets-src/heart/4.png : a real human heart suspended in liquid inside a cylindrical glass laboratory jar, thin wires and electrodes clipped to it, small bubbles rising."

job brain "$RULES
$STYLE
Images:
- assets-src/brain/1.png : a real human brain specimen seen from a three-quarter side view, wet glistening folds.
- assets-src/brain/2.png : a real human brain bristling with dozens of thin steel needle electrodes and small alligator clips trailing fine wires.
- assets-src/brain/3.png : a thick coronal cross-section slice of a real human brain lying flat, showing white and gray matter and the ventricles, seen straight from above.
- assets-src/brain/4.png : a real human brain tightly wound with enamelled copper magnet wire like a transformer coil, two screw terminals at the ends of the winding."

job eye "$RULES
$STYLE
For the eye images the eye fills the frame instead of floating on black.
Images:
- assets-src/eye/1.png : extreme close-up of one wide-open human eye staring straight into the lens, wet reflections, eyelashes, skin pores.
- assets-src/eye/2.png : extreme close-up of the same kind of human eye looking hard to the far left side, showing a lot of the white of the eye.
- assets-src/eye/3.png : extreme close-up of a human eye caught mid-blink, eyelid three quarters closed, lashes blurred.
- assets-src/eye/4.png : extreme close-up of a human eye whose iris is a mechanical steel camera aperture diaphragm with overlapping metal blades, surrounded by real eyelids and lashes."

job lungs "$RULES
$STYLE
Images:
- assets-src/lungs/1.png : a pair of real human lungs with the trachea and bronchi attached, front view specimen.
- assets-src/lungs/2.png : a resin corrosion cast of the complete human bronchial tree, both lungs, looking like dense white coral branches.
- assets-src/lungs/3.png : a pair of lungs made of pleated black industrial rubber bellows, the windpipe a ribbed rubber hose with steel hose clamps and a brass air fitting on top.
- assets-src/lungs/4.png : a real chest radiograph X-ray, front view, rib cage, spine and both lungs, bones white on black."

job stomach "$RULES
$STYLE
Images:
- assets-src/stomach/1.png : a real human stomach specimen with a length of esophagus on top and duodenum at the bottom, the classic J-shaped pouch.
- assets-src/stomach/2.png : a real human stomach cut open and pinned flat showing the deep wrinkled rugae folds of the inner lining.
- assets-src/stomach/3.png : a human stomach fitted like an industrial pressure vessel, a round analog pressure gauge dial bolted on top, steel pipe flanges with bolts on the inlet and outlet.
- assets-src/stomach/4.png : a real barium swallow X-ray radiograph of a human stomach, the barium-filled stomach bright white against black, faint spine behind."

job kidney "$RULES
$STYLE
Images:
- assets-src/kidney/1.png : a pair of real human kidneys side by side with their ureters and blood vessels trailing, front view specimen.
- assets-src/kidney/2.png : one real human kidney cut in half lengthwise, showing the cortex, the renal pyramids and the pelvis.
- assets-src/kidney/3.png : a real human kidney plumbed like a machine part, brass hose barbs screwed into it and clear plastic tubing running to a small cylindrical inline filter cartridge.
- assets-src/kidney/4.png : a real human kidney lying in a polished stainless steel kidney-shaped surgical dish, seen from above."

job gut "$RULES
$STYLE
Images:
- assets-src/gut/1.png : a dense pile of real human small intestine coils, wet and glistening, seen from above.
- assets-src/gut/2.png : a long length of real human intestine wound neatly like a garden hose on a steel wall-mounted hose reel.
- assets-src/gut/3.png : a real barium enema X-ray radiograph of the human large intestine, the colon framing the abdomen, bright white against black.
- assets-src/gut/4.png : real human intestine that gradually turns into ribbed corrugated flexible electrical conduit and then into a coiled black telephone handset cord, all one continuous tangled tube."

job tex "Rules: use your built-in image generation tool (imagegen) once per image. Never draw, composite or synthesize the images with code. Generate the images one after another, and after each one copy the generated PNG to the exact path given. If a file already exists at a path, skip it. When all are done, list the files with their pixel dimensions.
All four images are flat material textures for 3D rendering: photographed perfectly straight-on (orthographic), completely even shadowless diffuse lighting, no perspective, no vignette, no objects, no text, the material fills the entire frame edge to edge. Square 1:1.
Images:
- assets-src/tex/concrete.png : a raw board-formed poured concrete wall in an old factory, mid-grey, subtle formwork seams and a few plugged tie holes, faint water stains and hairline cracks, fine pores.
- assets-src/tex/floor.png : an old sealed industrial concrete workshop floor, darker charcoal grey, worn smooth and slightly glossy, scuff marks, faint tyre marks, oil stains, a couple of hairline cracks.
- assets-src/tex/pcb.png : a vintage 1980s single-sided through-hole circuit board seen straight from above, tan phenolic board densely packed with resistors, ceramic and electrolytic capacitors, transistors on small heat sinks, coils, trim pots and a few connectors, component side up.
- assets-src/tex/grunge.png : a greyscale wear map for metal: a mid-grey surface covered in fine random scratches, smudges, fingerprints, water spots and faint brushed streaks, high detail, low contrast, evenly distributed."

wait
echo ALL_DONE
ls -la assets-src/*/
