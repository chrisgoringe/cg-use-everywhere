# UE Nodes

UE nodes are "Use Everywhere". Put a UE node into your workflow, connect its input, and every node with an unconnected input of the same type will act as if connected to it. 

CLIP, IMAGE, MODEL, VAE, CONDITIONING, or LATENT (want something else? Edit `__init__.py` line 3.)

Update: added INT, MASK, and CHECKPOIMNT - which combines MODEL, CLIP, and VAE, and a special node for SEEDs.

| Model, clip, vae, latent and image are all being automagically connected. | Drop this image into ComfyUI to get a working workflow. |
|-|-|
|![workflow](docs/workflow.png)|![portrait](docs/portrait.png)|

## UE? Nodes

UE? nodes are like UE Nodes, but add two widgets, 'title' and 'input'. These are Regular Expressions, and the node will only send to nodes where the node Title and the unconnected input name match. 

It doesn't need to be a complete match - the logic is `regex.match(name) || regex.match(title)`, so if you want to match the exact name `seed`, you'll need something like `^seed$` as your regex.

Regex 101 - ^ means 'the start', $ means 'the end', '.' matches anything, '.*' matches any number of anything. For more than that, visit [regex101](https://regex101.com/) (the flavour you want is ECMAScript, though that probably won't matter).

| So you can do things like: | Drop this image into ComfyUI to get a working workflow. |
|-|-|
|![this](docs/UEQ.png)|![drop](docs/UEQportrait.png)|

## Seed Everywhere

A special case of UE? - Seed Everywhere connects to any unconnected INT input with 'seed' in the input name. So you can use the same seed everywhere.

## Widget?

A UE or UE? node with just one output can have the output converted to a widget. But the combination ones can't. Also note that if you convert it to a widget, you can't then change the title

Why not? because the code gets the data type from the input (weirdly the prompt doesn't contain the data type on outputs), and it's not available if it's a widget, because reasons, so the hack is to get the data type from what comes after `UE ` in the title...

## Caution

It's possible to create a loop with UE, and that currently isn't detected. If you get a RecursionError that's probably what you've done. Remember, *every* unconnected input gets connected to the UE output, even optional ones... you might want to use UE? nodes if this is a problem.
